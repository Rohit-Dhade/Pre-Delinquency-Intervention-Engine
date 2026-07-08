// ─────────────────────────────────────────────────────
// src/server.js — Express application entry point
// ─────────────────────────────────────────────────────
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import config from './config/index.js';
import logger from './config/logger.js';
import { migrate } from './db/migrate.js';
import pool from './db/pool.js';
import { closeTransporter } from './email/mailer.js';
import interventionRoutes from './routes/intervention.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// ── Middleware ────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// CORS — allow the React frontend (Vite dev server or production) to call
// this service directly when not behind the FastAPI proxy.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Rate limiting on POST /intervention/trigger
const triggerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests — max 100 per 15 minutes',
  },
});
app.use('/intervention/trigger', triggerLimiter);

// ── Routes ───────────────────────────────────────────
app.use('/intervention', interventionRoutes);

// Root health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'intervention-engine' });
});

// ── Global error handler (must be last) ──────────────
app.use(errorHandler);

// ── Startup ──────────────────────────────────────────
async function start() {
  try {
    // Run migration before listening
    await migrate();
    logger.info('Migration completed successfully');

    const server = app.listen(config.port, () => {
      logger.info(`Intervention Engine running on port ${config.port}`, {
        env: config.nodeEnv,
        bank: config.bankName,
      });
    });

    // ── Graceful shutdown ──────────────────────────────
    const shutdown = async (signal) => {
      logger.info(`${signal} received — shutting down cleanly`);

      server.close(async () => {
        try {
          await pool.end();
          logger.info('PostgreSQL pool closed');
        } catch (err) {
          logger.error('Error closing PostgreSQL pool', { error: err.message });
        }

        try {
          closeTransporter();
          logger.info('Nodemailer transporter closed');
        } catch (err) {
          logger.error('Error closing transporter', { error: err.message });
        }

        logger.info('Shutting down cleanly');
        process.exit(0);
      });

      // Force shutdown after 10s
      setTimeout(() => {
        logger.warn('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

start();

export { app };
