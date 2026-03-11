import { Pool } from "pg";

let _pool: Pool | null = null;

/**
 * Returns a pg Pool if DATABASE_URL is set, otherwise null.
 * Used for local PostgreSQL development.
 */
export function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!_pool) _pool = new Pool({ connectionString: url });
  return _pool;
}
