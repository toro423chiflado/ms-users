FROM node:20-alpine

WORKDIR /app

# Instalar dependencias primero (capa cacheada)
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar código fuente
COPY . .

# Generar cliente de Prisma
RUN npx prisma generate

EXPOSE 3001

# En producción: node src/index.js
# Esperar a que la BD esté lista y luego correr migraciones + app
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
