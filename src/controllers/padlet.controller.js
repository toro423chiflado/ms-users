const prisma = require('../config/db');

/**
 * POST /padlet/solicitar
 * ESTUDIANTE solicita acceso al padlet de un profesor_curso.
 * Body: { profesorCursoId }
 */
async function solicitar(req, res) {
  try {
    const { profesorCursoId } = req.body;
    const estudianteId = req.usuario.sub;

    if (!profesorCursoId) {
      return res.status(400).json({ error: 'profesorCursoId requerido' });
    }

    // Verificar que no exista ya una solicitud
    const existente = await prisma.accesoPadlet.findUnique({
      where: { estudianteId_profesorCursoId: { estudianteId, profesorCursoId: Number(profesorCursoId) } },
    });

    if (existente) {
      return res.status(409).json({
        error: 'Ya tienes una solicitud para este padlet',
        estado: existente.estado,
      });
    }

    const acceso = await prisma.accesoPadlet.create({
      data: { estudianteId, profesorCursoId: Number(profesorCursoId) },
    });

    return res.status(201).json({ mensaje: 'Solicitud enviada', acceso });
  } catch (err) {
    console.error('[PADLET] solicitar error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * GET /padlet/solicitudes/:profesorCursoId
 * PROFESOR ve las solicitudes pendientes para su clase.
 */
async function verSolicitudes(req, res) {
  try {
    const { profesorCursoId } = req.params;

    const solicitudes = await prisma.accesoPadlet.findMany({
      where: { profesorCursoId: Number(profesorCursoId) },
      include: {
        estudiante: {
          select: { id: true, nombre: true, apellido: true, correo: true, foto: true },
        },
      },
      orderBy: { solicitadoAt: 'desc' },
    });

    return res.status(200).json(solicitudes);
  } catch (err) {
    console.error('[PADLET] verSolicitudes error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * PUT /padlet/:id/responder
 * PROFESOR responde una solicitud (PERMITIDO | DENEGADO).
 * Body: { estado: "PERMITIDO" | "DENEGADO" }
 */
async function responder(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!['PERMITIDO', 'DENEGADO'].includes(estado)) {
      return res.status(400).json({ error: 'estado debe ser PERMITIDO o DENEGADO' });
    }

    const acceso = await prisma.accesoPadlet.update({
      where: { id },
      data: { estado, respondidoAt: new Date() },
    });

    return res.status(200).json({ mensaje: `Solicitud ${estado.toLowerCase()}`, acceso });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Solicitud no encontrada' });
    console.error('[PADLET] responder error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * GET /padlet/verificar/:profesorCursoId
 * Verifica si el usuario autenticado tiene acceso PERMITIDO.
 * Usado por MS3 para validar antes de subir evidencias.
 */
async function verificarAcceso(req, res) {
  try {
    const { profesorCursoId } = req.params;
    const estudianteId = req.usuario.sub;

    const acceso = await prisma.accesoPadlet.findUnique({
      where: {
        estudianteId_profesorCursoId: {
          estudianteId,
          profesorCursoId: Number(profesorCursoId),
        },
      },
    });

    const tieneAcceso = acceso?.estado === 'PERMITIDO';

    return res.status(200).json({
      tieneAcceso,
      estado: acceso?.estado ?? 'SIN_SOLICITUD',
    });
  } catch (err) {
    console.error('[PADLET] verificarAcceso error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { solicitar, verSolicitudes, responder, verificarAcceso };
