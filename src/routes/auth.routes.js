const { Router } = require('express');
const { login, register, googleSignIn, refresh, logout, whoami } = require('../controllers/auth.controller');
const { verifyJWT } = require('../middleware/auth.middleware');

const router = Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Iniciar sesión con correo @utec.edu.pe
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [correo, password]
 *             properties:
 *               correo:
 *                 type: string
 *                 example: admin@utec.edu.pe
 *               password:
 *                 type: string
 *                 example: admin123
 *     responses:
 *       200:
 *         description: Login exitoso, devuelve tokens y perfil
 *       401:
 *         description: Credenciales incorrectas
 *       403:
 *         description: Dominio no permitido o cuenta desactivada
 */
router.post('/login', login);

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registro local para estudiantes
 */
router.post('/register', register);

/**
 * @openapi
 * /auth/google:
 *   post:
 *     tags: [Auth]
 *     summary: Iniciar sesión o registrarse con Google (Firebase)
 */
router.post('/google', googleSignIn);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rota el refresh token y emite nuevos tokens
 */
router.post('/refresh', refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Cierra sesión (revoca todos los refresh tokens)
 *     security:
 *       - bearerAuth: []
 */
router.post('/logout', verifyJWT, logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Perfil del usuario autenticado
 *     security:
 *       - bearerAuth: []
 */
router.get('/me', verifyJWT, whoami);

module.exports = router;
