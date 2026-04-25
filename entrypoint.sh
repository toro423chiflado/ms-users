#!/bin/sh
# ================================================================
# Entrypoint del MS1
# 1. Aplica el schema de Prisma (crea tablas)
# 2. Corre el seed si la BD está vacía
# 3. Inicia el servidor
# ================================================================

echo "⏳ Aplicando schema Prisma..."
npx prisma db push --accept-data-loss

echo "🌱 Verificando si hay usuarios..."
COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.usuario.count().then(n => { console.log(n); p.\$disconnect(); });
")

if [ "$COUNT" = "0" ]; then
  echo "🌱 BD vacía — corriendo seed..."
  node prisma/seed.js
else
  echo "✅ BD ya tiene $COUNT usuarios — saltando seed"
fi

echo "🚀 Iniciando servidor..."
node src/index.js
