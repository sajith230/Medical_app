import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool(
  connectionString
    ? {
        connectionString,
        ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
      }
    : {
        host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
        port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432', 10),
        database: process.env.DB_NAME || process.env.PGDATABASE || 'medilanka',
        user: process.env.DB_USER || process.env.PGUSER || 'postgres',
        password: process.env.DB_PASSWORD || process.env.PGPASSWORD || 'postgres',
        ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
      }
);

let isConnected = false;

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW()');
    
    // Auto-migration for payment security fields & consultation booking session idempotency
    await client.query(`
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS card_brand TEXT;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS card_last4 TEXT;
      ALTER TABLE consultations ADD COLUMN IF NOT EXISTS booking_session_id TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_consultations_booking_session
      ON consultations (booking_session_id);
    `).catch((err) => {
      console.warn('[PostgreSQL Migration Warning]', err.message);
    });

    client.release();
    isConnected = true;
    console.log(`[PostgreSQL] Connected successfully to database at ${res.rows[0].now}`);
    return true;
  } catch (err: any) {
    isConnected = false;
    console.warn(`[PostgreSQL Notice] Database not yet reachable (${err.message}).`);
    console.warn(`[PostgreSQL Notice] When you have your PostgreSQL connection details, update server/.env (DATABASE_URL) and run "npm run db:init".`);
    return false;
  }
}

export function isDbConnected(): boolean {
  return isConnected;
}

export async function query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}
