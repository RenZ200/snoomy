import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw Error('Isi DATABASE_URL di .env lokal terlebih dahulu. Jangan kirim kredensial lewat chat.');
const local = new DatabaseSync(resolve(process.env.DB_PATH || 'data/matcha-duo.sqlite'), { readOnly: true });
let schedules, tasks;
try {
  local.exec('BEGIN');
  schedules = local.prepare('SELECT * FROM schedules ORDER BY id').all();
  tasks = local.prepare('SELECT * FROM tasks ORDER BY id').all();
  local.exec('COMMIT');
} finally { local.close(); }
console.log(`Sumber lokal: ${schedules.length} jadwal, ${tasks.length} tugas.`);
if (!process.argv.includes('--apply')) {
  console.log('Belum ada data dikirim. Tambahkan --apply untuk menyalin ke database cloud kosong.');
  process.exit(0);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query(readFileSync(new URL('../schema-postgres.sql', import.meta.url), 'utf8'));
  await client.query('LOCK TABLE schedules, tasks IN ACCESS EXCLUSIVE MODE');
  const count = await client.query('SELECT (SELECT count(*) FROM schedules) + (SELECT count(*) FROM tasks) AS total');
  if (Number(count.rows[0].total)) throw Error('Database tujuan sudah berisi data. Migrasi dibatalkan agar tidak menimpa/duplikasi.');
  for (const s of schedules) await client.query('INSERT INTO schedules(owner,day,start,"end",course,lecturer,room) VALUES($1,$2,$3,$4,$5,$6,$7)',[s.owner,s.day,s.start,s.end,s.course,s.lecturer,s.room]);
  for (const t of tasks) await client.query('INSERT INTO tasks(title,deadline,assignee,priority,done) VALUES($1,$2,$3,$4,$5)',[t.title,t.deadline,t.assignee,t.priority,t.done]);
  await client.query('COMMIT');
  console.log('Penyalinan berhasil. Data SQLite asli tetap utuh. ID internal baru dibuat otomatis.');
} catch {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Migrasi dibatalkan. Periksa koneksi dan pastikan database tujuan kosong. Tidak ada data tujuan ditimpa.');
  process.exitCode = 1;
} finally { await client.end(); }
