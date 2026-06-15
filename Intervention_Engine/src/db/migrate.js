
import pool from './pool.js';
import logger from '../config/logger.js';

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS intervention_log (
    id               SERIAL PRIMARY KEY,
    customer_id      VARCHAR(20),
    triggered_at     TIMESTAMP DEFAULT NOW(),
    risk_tier        VARCHAR(20),
    delinquency_prob FLOAT,
    offer_type       VARCHAR(50),
    channel          VARCHAR(20) DEFAULT 'gmail',
    email_type       VARCHAR(30),
    message_sent     TEXT,
    email_subject    VARCHAR(255),
    email_delivered  BOOLEAN DEFAULT false,
    model_version    VARCHAR(30),
    dry_run          BOOLEAN DEFAULT false
  );

  CREATE TABLE IF NOT EXISTS outcome_log (
    id                  SERIAL PRIMARY KEY,
    intervention_id     INT REFERENCES intervention_log(id),
    customer_id         VARCHAR(20),
    recorded_at         TIMESTAMP DEFAULT NOW(),
    offer_accepted      BOOLEAN,
    days_to_resolve     INT,
    did_default_anyway  BOOLEAN
  );
`;

export async function migrate() {
  try {
    await pool.query(MIGRATION_SQL);
    logger.info('Database migration completed — intervention_log + outcome_log ready');
  } catch (err) {
    logger.error('Database migration failed', { error: err.message });
    throw err;
  }
}

export default migrate;
