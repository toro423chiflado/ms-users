const { Router } = require('express');
const { cambiarRol } = require('../controllers/usuarios.controller');
const { verifyJWT, checkRole } = require('../middleware/auth.middleware');

const router = Router();

// Todas las rutas de admin requieren JWT y rol ADMIN
router.use(verifyJWT);
router.use(checkRole('ADMIN'));

/**
 * @openapi
 * /admin/usuarios/{id}/role:
 *   put:
 *     tags: [Admin]
 *     summary: Cambiar el rol de un usuario
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rol]
 *             properties:
 *               rol:
 *                 type: string
 *                 example: PROFESOR
 */
router.put('/usuarios/:id/role', cambiarRol);

module.exports = router;
