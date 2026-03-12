# ==========================================
# Estágio 1: Build 
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build 

# ==========================================
# Estágio 2: Produção
# ==========================================
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci --omit=dev && npm install prisma

# Copia os arquivos compilados e as pastas do prisma
COPY --from=builder /app/dist ./dist 
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

RUN npx prisma generate

EXPOSE 5000

# Agora ele vai achar a config e rodar lindamente!
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]