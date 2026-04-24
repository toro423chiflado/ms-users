const { Router } = require('express');
const { listar, obtener, crear, actualizar, desactivar } = require('../controllers/usuarios.controller');
const { solicitar, verSolicitudes, responder, verificarAcceso } = require('../controllers/padlet.controller');
const { verifyJWT, checkRole } = require('../middleware/auth.middleware');

const router = Router();

// ── Todas las rutas requieren autenticación ──────────────────────
router.use(verifyJWT);

// ── Usuarios ─────────────────────────────────────────────────────
router.get('/',              checkRole('ADMIN'), listar);
router.get('/:id',           obtener);
router.post('/',             checkRole('ADMIN'), crear);
router.put('/:id',           actualizar);
router.delete('/:id',        checkRole('ADMIN'), desactivar);

// ── Padlet ───────────────────────────────────────────────────────
// Estudiante solicita acceso
router.post('/padlet/solicitar',                    checkRole('ESTUDIANTE'), solicitar);

// Profesor ve y responde solicitudes
router.get('/padlet/solicitudes/:profesorCursoId',  checkRole('PROFESOR', 'ADMIN'), verSolicitudes);
router.put('/padlet/:id/responder',                 checkRole('PROFESOR', 'ADMIN'), responder);

// Verificación de acceso (usado por otros MS)
router.get('/padlet/verificar/:profesorCursoId',    verificarAcceso);

module.exports = router;
