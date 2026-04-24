const { verificarAccessToken } = require('../services/jwt.service');

/**
 * Middleware que valida el Bearer token en Authorization header.
 * Inyecta req.usuario con el payload del JWT.
 */
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verificarAccessToken(token);
    req.usuario = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

/**
 * Middleware que restringe el acceso a ciertos roles.
 * Uso: checkRole('ADMIN') o checkRole('ADMIN', 'PROFESOR')
 */
function checkRole(...roles) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({
        error: `Acceso denegado. Roles permitidos: ${roles.join(', ')}`,
      });
    }
    next();
  };
}

module.exports = { verifyJWT, checkRole };
