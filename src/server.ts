import { app } from './app';
import prisma from './lib/prisma';
import logger from './lib/logger';
import fs from 'fs';
import path from 'path';

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

    app.listen(PORT, () => {
      logger.info(`teste`);
      logger.info(`🚀 Server running at http://localhost:${PORT}`);
      logger.info(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();