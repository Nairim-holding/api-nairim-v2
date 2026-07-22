import { app } from './app';
import prisma from './lib/prisma';
import logger from './lib/logger';
import { startRecurringScheduler } from './lib/recurringScheduler';
import fs from 'fs';
import path from 'path';
import http from 'http';

const PORT = process.env.PORT || 5000;

// Garante diretórios de upload em runtime (necessário no Docker onde o volume é montado após o build)
['uploads/temp', 'uploads/properties'].forEach((dir) => {
  const fullPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

async function startServer() {
  try {
    // Testar conexão com o banco
    await prisma.$connect();
    logger.info('✅ Database connected successfully');

    const server: http.Server = app.listen(PORT, () => {
      logger.info(`🚀 Server running at http://localhost:${PORT}`);
      logger.info(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Timeout = 0: conexões nunca são fechadas por inatividade.
    // Necessário para uploads de vídeos grandes que podem demorar minutos.
    server.timeout = 0;
    server.keepAliveTimeout = 0;
    server.headersTimeout = 0;

    logger.info('⏱️  Server timeouts disabled (unlimited) for large file uploads');

    // Agendador embutido: mantém sempre ~5 anos de lançamentos recorrentes à
    // frente, sem intervenção manual. Idempotente.
    startRecurringScheduler();

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();