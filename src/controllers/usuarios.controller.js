const bcrypt = require('bcryptjs');
const prisma = require('../config/db');

const UTEC_REGEX = /^[a-zA-Z0-9._%+\-]+@utec\.edu\.pe$/i;

/**
 * GET /usuarios
 * Solo ADMIN — lista todos los usuarios con filtros opcionales.
 * Query params: rol, activo, buscar (nombre/apellido/correo)
 */
async function listar(req, res) {
  try {
    const { rol, activo, buscar, pagina = 1, limite = 20 } = req.query;

    const where = {};
    if (rol) where.rol = rol.toUpperCase();
    if (activo !== undefined) where.activo = activo === 'true';
    if (buscar) {
      where.OR = [
        { nombre:   { contains: buscar, mode: 'insensitive' } },
        { apellido: { contains: buscar, mode: 'insensitive' } },
        { correo:   { contains: buscar, mode: 'insensitive' } },
      ];
    }

    const skip  = (Number(pagina) - 1) * Number(limite);
    const take  = Number(limite);

    const [usuarios, total] = await Promise.all([
      prisma.usuario.findMany({
        where, skip, take,
        select: {
          id: true, nombre: true, apellido: true,
          correo: true, rol: true, activo: true,
          foto: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.usuario.count({ where }),
    ]);

    return res.status(200).json({
      data: usuarios,
      meta: { total, pagina: Number(pagina), limite: take, paginas: Math.ceil(total / take) },
    });
  } catch (err) {
    console.error('[USUARIOS] listar error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * GET /usuarios/:id
 * ADMIN ve cualquier perfil. El propio usuario ve el suyo.
 */
async function obtener(req, res) {
  try {
    const { id } = req.params;

    // Solo admin puede ver otros perfiles
    if (req.usuario.rol !== 'ADMIN' && req.usuario.sub !== id) {
      return res.status(403).json({ error: 'Sin permiso para ver este perfil' });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true, nombre: true, apellido: true, correo: true,
        rol: true, activo: true, foto: true, github: true,
        linkedin: true, createdAt: true,
      },
    });

    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    return res.status(200).json(usuario);
  } catch (err) {
    console.error('[USUARIOS] obtener error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * POST /usuarios
 * Solo ADMIN puede crear cuentas. No hay registro público.
 * Body: { nombre, apellido, correo, password, rol }
 */
async function crear(req, res) {
  try {
    const { nombre, apellido, correo, password, rol } = req.body;

    // Validaciones
    if (!nombre || !apellido || !correo || !password || !rol) {
      return res.status(400).json({ error: 'Todos los campos son requeridos: nombre, apellido, correo, password, rol' });
    }

    if (!UTEC_REGEX.test(correo)) {
      return res.status(400).json({ error: 'El correo debe ser @utec.edu.pe' });
    }

    const rolesValidos = ['ADMIN', 'PROFESOR', 'ESTUDIANTE'];
    if (!rolesValidos.includes(rol.toUpperCase())) {
      return res.status(400).json({ error: `Rol inválido. Valores: ${rolesValidos.join(', ')}` });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    // Verificar duplicado
    const existe = await prisma.usuario.findUnique({ where: { correo: correo.toLowerCase() } });
    if (existe) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const nuevo = await prisma.usuario.create({
      data: {
        nombre, apellido,
        correo: correo.toLowerCase(),
        passwordHash,
        rol: rol.toUpperCase(),
      },
      select: {
        id: true, nombre: true, apellido: true,
        correo: true, rol: true, createdAt: true,
      },
    });

    return res.status(201).json({ mensaje: 'Usuario creado', usuario: nuevo });
  } catch (err) {
    console.error('[USUARIOS] crear error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * PUT /usuarios/:id
 * El propio usuario actualiza su perfil (foto, github, linkedin).
 * ADMIN puede cambiar rol y estado activo.
 */
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const esAdmin = req.usuario.rol === 'ADMIN';
    const esPropio = req.usuario.sub === id;

    if (!esAdmin && !esPropio) {
      return res.status(403).json({ error: 'Sin permiso para modificar este perfil' });
    }

    const { foto, github, linkedin, nombre, apellido, rol, activo } = req.body;

    const data = {};
    if (foto      !== undefined) data.foto     = foto;
    if (github    !== undefined) data.github   = github;
    if (linkedin  !== undefined) data.linkedin = linkedin;
    if (nombre    !== undefined) data.nombre   = nombre;
    if (apellido  !== undefined) data.apellido = apellido;

    // Solo admin puede cambiar rol y estado
    if (esAdmin) {
      if (rol    !== undefined) data.rol    = rol.toUpperCase();
      if (activo !== undefined) data.activo = activo;
    }

    const actualizado = await prisma.usuario.update({
      where: { id },
      data,
      select: {
        id: true, nombre: true, apellido: true, correo: true,
        rol: true, activo: true, foto: true, github: true, linkedin: true,
      },
    });

    return res.status(200).json({ mensaje: 'Perfil actualizado', usuario: actualizado });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' });
    console.error('[USUARIOS] actualizar error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * DELETE /usuarios/:id  (soft delete)
 * Solo ADMIN. No elimina, desactiva la cuenta.
 */
async function desactivar(req, res) {
  try {
    const { id } = req.params;

    // No puede desactivarse a sí mismo
    if (req.usuario.sub === id) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    }

    await prisma.usuario.update({
      where: { id },
      data: { activo: false },
    });

    return res.status(200).json({ mensaje: 'Cuenta desactivada' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' });
    console.error('[USUARIOS] desactivar error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * PUT /admin/usuarios/:id/role
 * Solo ADMIN. Cambia exclusivamente el rol.
 */
async function cambiarRol(req, res) {
  try {
    const { id } = req.params;
    const { rol } = req.body;

    if (!rol) {
      return res.status(400).json({ error: 'El campo rol es requerido' });
    }

    const rolesValidos = ['ADMIN', 'PROFESOR', 'ESTUDIANTE'];
    if (!rolesValidos.includes(rol.toUpperCase())) {
      return res.status(400).json({ error: `Rol inválido. Valores: ${rolesValidos.join(', ')}` });
    }

    const actualizado = await prisma.usuario.update({
      where: { id },
      data: { rol: rol.toUpperCase() },
      select: {
        id: true, nombre: true, apellido: true, correo: true, rol: true
      },
    });

    return res.status(200).json({ mensaje: 'Rol actualizado', usuario: actualizado });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' });
    console.error('[USUARIOS] cambiarRol error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listar, obtener, crear, actualizar, desactivar, cambiarRol };
