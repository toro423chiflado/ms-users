const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { generarTokens, rotarRefreshToken, revocarTodos } = require('../services/jwt.service');

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

module.exports = { login, refresh, logout, whoami };
