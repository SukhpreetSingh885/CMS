import app from './app.js';
import { ENV } from './config/env.js';
import { prisma } from './config/db.js';
import { logger } from './utils/logger.js';
import { BackgroundJobs } from './jobs/renewalReminder.job.js';

const PORT = Number(ENV.PORT) || 5000;

const server = app.listen(PORT, () => {
  logger.info(`🚀 Viralstan CMS Backend running on http://localhost:${PORT}`);
  logger.info(`📌 Environment: ${ENV.NODE_ENV}`);
  logger.info(`🔒 CORS Origin: ${ENV.CORS_ORIGIN}`);

  // Schedule background jobs (every hour)
  setInterval(() => {
    BackgroundJobs.checkRenewalReminders();
  }, 60 * 60 * 1000);
});

let isShuttingDown = false;

async function shutdown(signal: string, exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.warn(`Received ${signal}. Shutting down gracefully...`);

  // Force shutdown after 10 seconds if graceful close hangs
  const forceExitTimeout = setTimeout(() => {
    logger.error('Forcing process exit due to timeout during shutdown.');
    process.exit(1);
  }, 10000);
  forceExitTimeout.unref();

  server.close(async () => {
    try {
      await prisma.$disconnect();
      logger.info('Database connection closed safely. Server stopped.');
    } catch (err) {
      logger.error('Error during Prisma disconnect:', err as Error);
    } finally {
      process.exit(exitCode);
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM', 0));
process.on('SIGINT', () => shutdown('SIGINT', 0));

process.on('unhandledRejection', (reason: unknown) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error(`[UNHANDLED REJECTION] ${err.message}`, err);
});

process.on('uncaughtException', (err: Error) => {
  logger.error(`[UNCAUGHT EXCEPTION] ${err.message}`, err);
  shutdown('UNCAUGHT_EXCEPTION', 1);
});
