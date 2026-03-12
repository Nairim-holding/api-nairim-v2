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

COPY --from=builder /app/dist ./dist 
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]