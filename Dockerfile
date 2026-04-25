FROM node:20-slim

WORKDIR /app

# Instalar OpenSSL (requerido por Prisma)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Instalar dependencias primero (capa cacheada)
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar código fuente
COPY . .

# Generar cliente de Prisma
RUN npx prisma generate

EXPOSE 3001

# Esperar a que la BD esté lista, correr migraciones + app
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
