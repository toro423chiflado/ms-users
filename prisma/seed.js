const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker');

const prisma = new PrismaClient();

const ROLES = ['ADMIN', 'PROFESOR', 'ESTUDIANTE'];

async function main() {
  console.log('🌱 Iniciando seed...');

  // Limpiar tablas en orden correcto
  await prisma.accesoPadlet.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.usuario.deleteMany();
  console.log('🧹 Tablas limpias');

  // Admin fijo — para que puedas hacer login inmediatamente
  const adminHash = await bcrypt.hash('admin123', 10);
  await prisma.usuario.create({
    data: {
      nombre: 'Admin',
      apellido: 'UTEC',
      correo: 'admin@utec.edu.pe',
      passwordHash: adminHash,
      rol: 'ADMIN',
    },
  });

  // Profesor fijo de prueba
  const profHash = await bcrypt.hash('profesor123', 10);
  await prisma.usuario.create({
    data: {
      nombre: 'Juan',
      apellido: 'Pérez',
      correo: 'juan.perez@utec.edu.pe',
      passwordHash: profHash,
      rol: 'PROFESOR',
      github: 'https://github.com/jperez',
      linkedin: 'https://linkedin.com/in/jperez',
    },
  });

  // Estudiante fijo de prueba
  const estHash = await bcrypt.hash('estudiante123', 10);
  await prisma.usuario.create({
    data: {
      nombre: 'María',
      apellido: 'García',
      correo: 'maria.garcia@utec.edu.pe',
      passwordHash: estHash,
      rol: 'ESTUDIANTE',
    },
  });

  console.log('✅ Usuarios fijos creados (admin, profesor, estudiante)');

  // 25,000 usuarios fake en batches de 500
  const TOTAL = 25000;
  const BATCH_SIZE = 500;
  const salt = await bcrypt.genSalt(10);
  const fakeHash = await bcrypt.hash('utec2025', salt);

  let created = 0;

  for (let i = 0; i < TOTAL; i += BATCH_SIZE) {
    const batch = [];
    const size = Math.min(BATCH_SIZE, TOTAL - i);

    for (let j = 0; j < size; j++) {
      const nombre = faker.person.firstName();
      const apellido = faker.person.lastName();
      const uniq = faker.string.alphanumeric(6).toLowerCase();
      const rol = ROLES[Math.floor(Math.random() * ROLES.length)];

      batch.push({
        nombre,
        apellido,
        correo: `${nombre.toLowerCase()}.${apellido.toLowerCase()}.${uniq}@utec.edu.pe`,
        passwordHash: fakeHash,
        rol,
        github: Math.random() > 0.6 ? `https://github.com/${faker.internet.username()}` : null,
        linkedin: Math.random() > 0.6 ? `https://linkedin.com/in/${faker.internet.username()}` : null,
      });
    }

    await prisma.usuario.createMany({ data: batch, skipDuplicates: true });
    created += size;

    if (created % 5000 === 0) {
      console.log(`   ${created}/${TOTAL} usuarios creados...`);
    }
  }

  const total = await prisma.usuario.count();
  console.log(`\n✅ Seed completado — ${total} usuarios en la BD`);
  console.log('\n📋 Credenciales de prueba:');
  console.log('   ADMIN      → admin@utec.edu.pe       / admin123');
  console.log('   PROFESOR   → juan.perez@utec.edu.pe  / profesor123');
  console.log('   ESTUDIANTE → maria.garcia@utec.edu.pe / estudiante123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
