import { app } from './app';
import prisma from './lib/prisma';
import logger from './lib/logger';

const PORT = process.env.PORT || 5000;

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