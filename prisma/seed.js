const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker');
 
const prisma = new PrismaClient();
const ROLES = ['ADMIN', 'PROFESOR', 'ESTUDIANTE'];
 
async function main() {
  console.log('🌱 Iniciando seed...');
 
  await prisma.accesoPadlet.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.usuario.deleteMany();
  console.log('🧹 Tablas limpias');
 
  const adminHash    = await bcrypt.hash('admin123', 10);
  const profHash     = await bcrypt.hash('profesor123', 10);
  const estHash      = await bcrypt.hash('estudiante123', 10);
 
  // Usuarios fijos con UUIDs que coinciden con data.sql del MS2
  await prisma.usuario.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000000000',
        nombre: 'Admin', apellido: 'UTEC',
        correo: 'admin@utec.edu.pe',
        passwordHash: adminHash, rol: 'ADMIN',
      },
      {
        id: '00000000-0000-0000-0000-000000000001',
        nombre: 'Juan', apellido: 'Pérez',
        correo: 'juan.perez@utec.edu.pe',
        passwordHash: profHash, rol: 'PROFESOR',
        github: 'https://github.com/jperez',
        linkedin: 'https://linkedin.com/in/jperez',
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        nombre: 'Ana', apellido: 'Torres',
        correo: 'ana.torres@utec.edu.pe',
        passwordHash: profHash, rol: 'PROFESOR',
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        nombre: 'Pedro', apellido: 'Ruiz',
        correo: 'pedro.ruiz@utec.edu.pe',
        passwordHash: profHash, rol: 'PROFESOR',
      },
      {
        id: '00000000-0000-0000-0000-000000000004',
        nombre: 'María', apellido: 'García',
        correo: 'maria.garcia@utec.edu.pe',
        passwordHash: estHash, rol: 'ESTUDIANTE',
      },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Usuarios fijos creados');
 
  // 25,000 usuarios fake en batches de 500
  const TOTAL      = 25000;
  const BATCH_SIZE = 500;
  const fakeHash   = await bcrypt.hash('utec2025', 10);
 
  let created = 0;
  for (let i = 0; i < TOTAL; i += BATCH_SIZE) {
    const batch = [];
    const size  = Math.min(BATCH_SIZE, TOTAL - i);
 
    for (let j = 0; j < size; j++) {
      const nombre   = faker.person.firstName();
      const apellido = faker.person.lastName();
      // userName() es compatible con faker v8+
      const uniq     = faker.string.alphanumeric(6).toLowerCase();
      const rol      = ROLES[Math.floor(Math.random() * ROLES.length)];
 
      batch.push({
        nombre,
        apellido,
        correo:       `${nombre.toLowerCase()}.${apellido.toLowerCase()}.${uniq}@utec.edu.pe`,
        passwordHash: fakeHash,
        rol,
        github:   Math.random() > 0.6 ? `https://github.com/${faker.internet.userName()}` : null,
        linkedin: Math.random() > 0.6 ? `https://linkedin.com/in/${faker.internet.userName()}` : null,
      });
    }
 
    await prisma.usuario.createMany({ data: batch, skipDuplicates: true });
    created += size;
    if (created % 5000 === 0) console.log(`   ${created}/${TOTAL} usuarios creados...`);
  }
 
  const total = await prisma.usuario.count();
  console.log(`\n✅ Seed completado — ${total} usuarios en la BD`);
  console.log('\n📋 Credenciales:');
  console.log('   ADMIN      → admin@utec.edu.pe        / admin123');
  console.log('   PROFESOR   → juan.perez@utec.edu.pe   / profesor123');
  console.log('   ESTUDIANTE → maria.garcia@utec.edu.pe / estudiante123');
}
 
main().catch(console.error).finally(() => prisma.$disconnect());