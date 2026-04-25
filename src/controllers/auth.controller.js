const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { generarTokens, rotarRefreshToken, revocarTodos } = require('../services/jwt.service');
const admin = require('../config/firebase');

// Regex estricta: solo correos @utec.edu.pe
const UTEC_REGEX = /^[a-zA-Z0-9._%+\-]+@utec\.edu\.pe$/i;

/**
 * POST /auth/login
 * Body: { correo, password }
 *
 * Solo acepta correos @utec.edu.pe.
 * No permite crear cuentas — el registro es tarea del admin.
 */
async function login(req, res) {
  try {
    const { correo, password } = req.body;

    // ── 1. Validaciones básicas ──────────────────────────────────
    if (!correo || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
    }

    // ── 2. Dominio @utec.edu.pe ──────────────────────────────────
    if (!UTEC_REGEX.test(correo)) {
      return res.status(403).json({
        error: 'Solo se permiten correos con dominio @utec.edu.pe',
        code: 'INVALID_DOMAIN',
      });
    }

    // ── 3. Buscar usuario ────────────────────────────────────────
    const usuario = await prisma.usuario.findUnique({
      where: { correo: correo.toLowerCase() },
    });

    // Mismo mensaje para usuario no encontrado y contraseña incorrecta
    // (evita enumeración de usuarios)
    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // ── 4. Cuenta activa ─────────────────────────────────────────
    if (!usuario.activo) {
      return res.status(403).json({
        error: 'Cuenta desactivada. Contacta al administrador.',
        code: 'ACCOUNT_DISABLED',
      });
    }

    // ── 5. Verificar contraseña ──────────────────────────────────
    const passwordOk = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // ── 6. Generar tokens ────────────────────────────────────────
    const { accessToken, refreshToken } = await generarTokens(usuario);

    return res.status(200).json({
      mensaje: `Bienvenido, ${usuario.nombre}`,
      accessToken,
      refreshToken,
      usuario: {
        id:       usuario.id,
        nombre:   usuario.nombre,
        apellido: usuario.apellido,
        correo:   usuario.correo,
        rol:      usuario.rol,
        foto:     usuario.foto,
      },
    });
  } catch (err) {
    console.error('[AUTH] login error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * POST /auth/refresh
 * Body: { refreshToken }
 * Rota el refresh token y devuelve un nuevo par de tokens.
 */
async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken requerido' });
    }

    const tokens = await rotarRefreshToken(refreshToken);
    return res.status(200).json(tokens);
  } catch (err) {
    return res.status(401).json({ error: err.message });
  }
}

/**
 * POST /auth/logout
 * Header: Authorization Bearer <accessToken>
 * Revoca todos los refresh tokens del usuario.
 */
async function logout(req, res) {
  try {
    await revocarTodos(req.usuario.sub);
    return res.status(200).json({ mensaje: 'Sesión cerrada correctamente' });
  } catch (err) {
    console.error('[AUTH] logout error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * GET /auth/me
 * Devuelve el perfil del usuario autenticado.
 */
async function whoami(req, res) {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.sub },
      select: {
        id: true, nombre: true, apellido: true,
        correo: true, rol: true, foto: true,
        github: true, linkedin: true, createdAt: true,
      },
    });

    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    return res.status(200).json(usuario);
  } catch (err) {
    console.error('[AUTH] whoami error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * POST /auth/register
 * Body: { nombre, apellido, correo, password }
 * Registro público para estudiantes. Validar @utec.edu.pe
 */
async function register(req, res) {
  try {
    const { nombre, apellido, correo, password } = req.body;

    if (!nombre || !apellido || !correo || !password) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    if (!UTEC_REGEX.test(correo)) {
      return res.status(403).json({ error: 'Solo se permiten correos @utec.edu.pe' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const existe = await prisma.usuario.findUnique({ where: { correo: correo.toLowerCase() } });
    if (existe) {
      return res.status(409).json({ error: 'El correo ya está registrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombre,
        apellido,
        correo: correo.toLowerCase(),
        passwordHash,
        rol: 'ESTUDIANTE', // Por defecto
      },
    });

    const { accessToken, refreshToken } = await generarTokens(nuevoUsuario);

    return res.status(201).json({
      mensaje: 'Registro exitoso',
      accessToken,
      refreshToken,
      usuario: {
        id: nuevoUsuario.id,
        nombre: nuevoUsuario.nombre,
        apellido: nuevoUsuario.apellido,
        correo: nuevoUsuario.correo,
        rol: nuevoUsuario.rol,
      },
    });
  } catch (err) {
    console.error('[AUTH] register error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * POST /auth/google
 * Body: { idToken }
 * Recibe el token de Firebase, verifica, busca o crea usuario ESTUDIANTE.
 */
async function googleSignIn(req, res) {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'idToken es requerido' });
    }

    if (!admin) {
      return res.status(500).json({ error: 'Firebase no está configurado en el servidor' });
    }

    // 1. Verificar token con Firebase
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      console.error('[AUTH] google token error:', error);
      return res.status(401).json({ error: 'Token de Google inválido o expirado' });
    }

    const { email, name, picture } = decodedToken;

    // 2. Validar dominio
    if (!UTEC_REGEX.test(email)) {
      return res.status(403).json({ error: 'Solo se permiten correos @utec.edu.pe' });
    }

    // 3. Buscar usuario
    let usuario = await prisma.usuario.findUnique({
      where: { correo: email.toLowerCase() },
    });

    // 4. Si no existe, crearlo como ESTUDIANTE
    if (!usuario) {
      // Intentar extraer nombre y apellido si es posible, o usar el name entero
      const partesNombre = name ? name.split(' ') : ['Usuario', 'Google'];
      const nombre = partesNombre[0] || 'Estudiante';
      const apellido = partesNombre.slice(1).join(' ') || '';

      usuario = await prisma.usuario.create({
        data: {
          nombre,
          apellido,
          correo: email.toLowerCase(),
          passwordHash: '', // No tiene password local
          foto: picture,
          rol: 'ESTUDIANTE',
        },
      });
    }

    if (!usuario.activo) {
      return res.status(403).json({ error: 'Cuenta desactivada' });
    }

    // 5. Generar nuestros JWTs
    const { accessToken, refreshToken } = await generarTokens(usuario);

    return res.status(200).json({
      mensaje: `Bienvenido, ${usuario.nombre}`,
      accessToken,
      refreshToken,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol,
        foto: usuario.foto,
      },
    });
  } catch (err) {
    console.error('[AUTH] googleSignIn error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { login, register, googleSignIn, refresh, logout, whoami };
