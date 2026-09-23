import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = dirname(fileURLToPath(import.meta.url));
export function postgresStatement(sql) {
  let index = 0;
  // These are application-owned queries, never user-provided SQL.
  return sql.replace(/\bend\b/g, '"end"').replace(/\?/g, () => `$${++index}`);
}
export function postgresAdapter(pool) {
  return {
    prepare(sql) {
      const query = postgresStatement(sql);
      return {
        all: async (...args) => (await pool.query(query, args)).rows,
        get: async (...args) => (await pool.query(query, args)).rows[0],
        run: async (...args) => {
          const insert = /^INSERT\b/i.test(query);
          const result = await pool.query(query + (insert ? ' RETURNING id' : ''), args);
          return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id };
        },
      };
    },
    close: () => pool.end(),
  };
}
export async function openDatabase() {
  if (process.env.DATABASE_URL) {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 15000, idleTimeoutMillis: 10000 });
    pool.on('error', () => console.error('Koneksi database terputus. Akan mencoba lagi pada permintaan berikutnya.'));
    try { await pool.query(readFileSync(resolve(root, 'schema-postgres.sql'), 'utf8')); }
    catch { await pool.end(); throw Error('Database cloud belum tersambung. Periksa DATABASE_URL di pengaturan server.'); }
    return postgresAdapter(pool);
  }
  if (process.env.NODE_ENV === 'production') throw Error('Hosting memerlukan DATABASE_URL agar data tidak hilang.');
  const { DatabaseSync } = await import('node:sqlite');
  const path = resolve(process.env.DB_PATH || resolve(root, 'data/matcha-duo.sqlite'));
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(readFileSync(resolve(root, 'schema.sql'), 'utf8'));
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}
