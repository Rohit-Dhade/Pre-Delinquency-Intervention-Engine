// ─────────────────────────────────────────────────────
// src/config/index.js — Centralised configuration
// ─────────────────────────────────────────────────────
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,

  mistralApiKey: process.env.MISTRAL_API_KEY,

  gmail: {
    user: process.env.GMAIL_USER,
    appPassword: process.env.GMAIL_APP_PASSWORD,
  },

  fastapiBaseUrl: process.env.FASTAPI_BASE_URL || 'http://localhost:8000',
  modelVersion: process.env.MODEL_VERSION || 'v1.0.0',
  bankName: process.env.BANK_NAME || 'FinTrust Bank',
};

export default config;
