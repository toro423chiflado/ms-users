const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/db');

const ACCESS_SECRET  = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRY  = '8h';
const REFRESH_EXPIRY = '7d';
const REFRESH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Genera access token (8h) y refresh token (7d)
 */
async function generarTokens(usuario) {
  const payload = {
    sub:  usuario.id,
    correo: usuario.correo,
    rol:  usuario.rol,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
  };

  const accessToken = jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });

  const rawRefresh  = crypto.randomBytes(64).toString('hex');
  const expiresAt   = new Date(Date.now() + REFRESH_EXPIRY_MS);

  await prisma.refreshToken.create({
    data: {
      usuarioId: usuario.id,
      token:     rawRefresh,
      expiresAt,
    },
  });

  return { accessToken, refreshToken: rawRefresh };
}

/**
 * Rota el refresh token: revoca el viejo y emite uno nuevo
 */
async function rotarRefreshToken(rawToken) {
  const registro = await prisma.refreshToken.findUnique({
    where:   { token: rawToken },
    include: { usuario: true },
  });

  if (!registro)               throw new Error('Refresh token no encontrado');
  if (registro.revocado)       throw new Error('Refresh token ya revocado');
  if (registro.expiresAt < new Date()) throw new Error('Refresh token expirado');

  // Revocar el token viejo
  await prisma.refreshToken.update({
    where: { id: registro.id },
    data:  { revocado: true },
  });

  return generarTokens(registro.usuario);
}

/**
 * Revoca todos los refresh tokens del usuario (logout)
 */
async function revocarTodos(usuarioId) {
  await prisma.refreshToken.updateMany({
    where: { usuarioId, revocado: false },
    data:  { revocado: true },
  });
}

/**
 * Verifica un access token y devuelve el payload
 */
function verificarAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

module.exports = { generarTokens, rotarRefreshToken, revocarTodos, verificarAccessToken };
