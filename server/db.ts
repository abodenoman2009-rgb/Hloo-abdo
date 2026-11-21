import { readFileSync } from 'fs';
import path from 'path';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;

export const pool = new pg.Pool({
  connectionString,
  max: 10,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

export async function initDatabase(): Promise<void> {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Add a PostgreSQL database and set DATABASE_URL.');
  }
  const sql = readFileSync(path.resolve(process.cwd(), 'migrations/001_initial_schema.sql'), 'utf8');
  await pool.query(sql);
  await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
}
