require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const YAML    = require('yamljs');
const swaggerUi = require('swagger-ui-express');
const path    = require('path');

const authRoutes    = require('./routes/auth.routes');
const usuariosRoutes = require('./routes/usuarios.routes');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares globales ─────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Swagger UI ───────────────────────────────────────────────────
try {
  const swaggerDoc = YAML.load(path.join(__dirname, '../swagger.yaml'));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc, {
    customSiteTitle: 'MS1 — Users API',
    swaggerOptions: { persistAuthorization: true },
  }));
} catch (e) {
  console.warn('⚠️  swagger.yaml no cargado:', e.message);
}

// ── Health check ─────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ms-users',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── Rutas ────────────────────────────────────────────────────────
app.use('/auth',     authRoutes);
app.use('/usuarios', usuariosRoutes);

// ── 404 ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

// ── Error global ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR GLOBAL]', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ── Iniciar ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 MS1 ms-users corriendo en puerto ${PORT}`);
  console.log(`📚 Swagger UI:  http://localhost:${PORT}/docs`);
  console.log(`❤️  Health:     http://localhost:${PORT}/health`);
  console.log(`\n🔑 Credenciales de prueba:`);
  console.log(`   ADMIN      → admin@utec.edu.pe        / admin123`);
  console.log(`   PROFESOR   → juan.perez@utec.edu.pe   / profesor123`);
  console.log(`   ESTUDIANTE → maria.garcia@utec.edu.pe / estudiante123\n`);
});

module.exports = app;
