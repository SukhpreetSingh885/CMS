import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { ENV } from './config/env.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { requestIdMiddleware } from './middlewares/requestId.middleware.js';
import { apiLimiter } from './middlewares/rateLimit.middleware.js';
import { NotFoundError } from './utils/AppError.js';

const app = express();

// Request ID & Duration Tracking (first middleware)
app.use(requestIdMiddleware);

// Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS Configuration
app.use(
  cors({
    origin: [ENV.CORS_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  })
);

// Body Parsing & Cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static File Uploads
const uploadsPath = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsPath));

// API Rate Limiting
app.use('/api', apiLimiter);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Viralstan CMS Backend API',
    requestId: req.id,
  });
});

// Master API Routes
app.use('/api/v1', apiRouter);

// 404 Handler for undefined API routes
app.use('*', (req, res, next) => {
  next(new NotFoundError(`API endpoint [${req.method}] ${req.originalUrl} not found.`));
});

// Centralized Error Handling Middleware (must be registered last)
app.use(errorHandler);

export default app;
