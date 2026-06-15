import pg from 'pg';
import config from '../config/index.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export default pool;
