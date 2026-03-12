# ==========================================
# Estágio 1: Build (Compila TypeScript e Alias)
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

# Instala o OpenSSL (Obrigatório para Prisma no Alpine)
RUN apk add --no-cache openssl

# Instala todas as dependências (incluindo as de dev para o tsc-alias funcionar)
COPY package*.json ./
RUN npm ci

# Copia o código e a pasta prisma
COPY . .

# Gera o client do Prisma e faz o build (tsc && tsc-alias)
RUN npx prisma generate
RUN npm run build 

# ==========================================
# Estágio 2: Produção (Roda a API)
# ==========================================
FROM node:20-alpine
WORKDIR /app

# OpenSSL também é necessário para rodar o app final
RUN apk add --no-cache openssl

# Copia arquivos de dependência
COPY package*.json ./

# Instala apenas pacotes de produção E o CLI do Prisma (necessário para o comando migrate)
RUN npm ci --omit=dev && npm install prisma

# Copia os arquivos compilados do estágio 1 e a pasta do prisma
COPY --from=builder /app/dist ./dist 
COPY --from=builder /app/prisma ./prisma

# Gera o client do Prisma na imagem final
RUN npx prisma generate

# Exponha a porta da API (ajuste no docker-compose se não for 3333)
EXPOSE 3333

# O PULO DO GATO: Roda a migration e depois usa o SEU script "start" do package.json
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]