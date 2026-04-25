FROM node:20-slim

WORKDIR /app

# OpenSSL requerido por Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Dependencias
COPY package*.json ./
RUN npm ci --omit=dev

# Código fuente
COPY . .

# Generar cliente Prisma
RUN npx prisma generate

# Script de inicio con seed automático
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001

CMD ["/entrypoint.sh"]
