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
    async transaction(fn) {
      const client = await pool.connect();
      try { await client.query('BEGIN'); const result=await fn(postgresAdapter(client)); await client.query('COMMIT'); return result; }
      catch(error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
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
    if (process.env.VERCEL) {
      try {
        const { attachDatabasePool } = await import('@vercel/functions');
        attachDatabasePool(pool);
      } catch { /* fallback tanpa pool attach di lokal */ }
    }
    pool.on('error', () => console.error('Koneksi database terputus. Akan mencoba lagi pada permintaan berikutnya.'));
    try { await pool.query(readFileSync(resolve(root, 'schema-postgres.sql'), 'utf8')); }
    catch { await pool.end(); throw Error('Database cloud belum tersambung. Periksa DATABASE_URL di pengaturan server.'); }
    return postgresAdapter(pool);
  }
  if (process.env.VERCEL && !process.env.DATABASE_URL) {
    console.warn('DATABASE_URL belum diisi; memakai memori sementara (data hilang tiap cold start). Isi DATABASE_URL untuk data permanen.');
    const { PGlite } = await import('@electric-sql/pglite');
    const lite = new PGlite();
    await lite.exec(readFileSync(resolve(root, 'schema-postgres.sql'), 'utf8'));
    return {
      prepare(sql) {
        const q = postgresStatement(sql);
        return {
          all: async (...a) => (await lite.query(q, a)).rows,
          get: async (...a) => (await lite.query(q, a)).rows[0],
          run: async (...a) => {
            const insert = /^INSERT\b/i.test(q);
            const r = await lite.query(q + (insert ? ' RETURNING id' : ''), a);
            return { changes: r.affectedRows ?? r.rowCount ?? 0, lastInsertRowid: r.rows?.[0]?.id };
          },
        };
      },
      transaction: async fn => fn({ prepare(sql) {
        const q = postgresStatement(sql);
        return {
          all: (...a) => lite.query(q, a).then(r => r.rows),
          get: (...a) => lite.query(q, a).then(r => r.rows[0]),
          run: async (...a) => {
            const insert = /^INSERT\b/i.test(q);
            const r = await lite.query(q + (insert ? ' RETURNING id' : ''), a);
            return { changes: r.affectedRows ?? r.rowCount ?? 0, lastInsertRowid: r.rows?.[0]?.id };
          },
        };
      } }),
      close: async () => lite.close(),
      exec: undefined,
    };
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
