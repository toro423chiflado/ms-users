const admin = require('firebase-admin');

try {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    // Si la llave privada viene con saltos de línea literales "\\n", los reemplazamos por reales "\n"
    const privateKey = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    console.log('✅ Firebase Admin SDK inicializado correctamente.');
  } else {
    console.warn('⚠️ Variables de Firebase incompletas en el .env. La integración con Firebase fallará.');
  }
} catch (error) {
  console.error('❌ Error al inicializar Firebase Admin:', error.message);
}

module.exports = admin;
