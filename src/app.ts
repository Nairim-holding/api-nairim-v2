import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';
import routes from './routes';
import { errorHandler } from './middlewares/error';

const isDev = process.env.NODE_ENV !== 'production';

export const app = express();

// Logging
app.use(
  pinoHttp({
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
            messageFormat: '{req.method} {req.url} → {res.statusCode} ({responseTime}ms)',
          },
        }
      : undefined,
  })
);

// Security
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'Imobiliaria API'
  });
});

// Routes
app.use(routes);

// Error handling - este deve vir antes do 404 handler
app.use(errorHandler);

// 404 handler - usar função regular em vez de app.use('*')
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});