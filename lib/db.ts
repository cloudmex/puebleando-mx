import { Pool } from "pg";

let _pool: Pool | null = null;

/** true when APP_ENV=production or NODE_ENV=production */
export const isProduction =
  process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";

/**
 * Returns a pg Pool if DATABASE_URL is set, otherwise null.
 * In production, SSL is enabled (required by Supabase and most cloud providers).
 */
export function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!_pool) {
    _pool = new Pool({
      connectionString: url,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    });
  }
  return _pool;
}
