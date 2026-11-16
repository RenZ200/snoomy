import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { postgresAdapter } from '../database.js';
import { syncCalendar } from '../google-sync.js';
import { meetingWindow, MEETING_PREFIX } from '../google-meetings.js';

const DAY = 86400000, iso = ms => new Date(ms).toISOString().slice(0, 10);
const plus = (date, n) => iso(Date.parse(date + 'T00:00:00Z') + n * DAY);
const dayOf = s => (new Date(s + 'T12:00:00Z').getUTCDay() + 6) % 7 + 1;

// A fake Google calendar that also expands weekly series into instances, like events.instances.
function remote() {
 const events = new Map(); let sequence = 0;
 const save = e => { const next = { ...e, etag: String(++sequence) }; events.set(e.id, next); return structuredClone(next); };
 const virtual = (series, date) => ({ id: `${series.id}_${date}`, recurringEventId: series.id, status: 'confirmed', etag: 'v',
  originalStartTime: { dateTime: date + series.start.dateTime.slice(10) }, start: { dateTime: date + series.start.dateTime.slice(10) } });
 return { calendarId: 'test', events, save,
  list: async () => ({ items: [...events.values()].map(e => structuredClone(e)) }),
  get: async id => structuredClone(events.get(id)),
  create: async e => events.has(e.id) ? { ...structuredClone(events.get(e.id)), recovered: true } : save(e),
  async instances(id, min, max) {
   const series = events.get(id), items = [];
   for (let d = min.slice(0, 10); d < max.slice(0, 10); d = plus(d, 1))
    if (dayOf(d) === dayOf(series.start.dateTime.slice(0, 10))) items.push(structuredClone(events.get(`${id}_${d}`) || virtual(series, d)));
   return { items };
  },
  async update(id, body, etag) { assert.equal(events.get(id).etag, etag); return save({ ...events.get(id), ...body }); },
  async remove(id, etag) {
   const old = events.get(id);
   if (old) assert.equal(old.etag, etag); else assert.equal(etag, 'v');
   const [series, date] = id.split('_');
   save({ ...(old || virtual(events.get(series), date)), status: 'cancelled' });
  },
 };
}

async function scenario(db) {
 const { from } = meetingWindow();
 const tue = plus(from, 1), wed = plus(from, 2), tue2 = plus(from, 8), wed2 = plus(from, 9);
 const addClass = async (day, start, end, course, room, key) => {
  const r = await db.prepare('INSERT INTO schedules(owner,day,start,end,course,lecturer,room) VALUES(?,?,?,?,?,?,?)').run('Moreno', day, start, end, course, '', room);
  await db.prepare('INSERT INTO schedule_sources(schedule_id,owner,source,external_id,imported) VALUES(?,?,?,?,?)').run(Number(r.lastInsertRowid), 'Moreno', 'siap', key, Date.now());
 };
 await addClass(2, '08:00', '09:00', 'Teknik Separasi II', 'A.1', 'tsep#1');
 await addClass(3, '10:00', '12:00', 'Start Up', 'B.2', 'startup#1');
 await db.prepare('INSERT INTO schedules(owner,day,start,end,course,lecturer,room) VALUES(?,?,?,?,?,?,?)').run('Moreno', 2, '13:00', '14:00', 'Manual', '', '');
 const g = remote();
 await syncCalendar(db, 'Moreno', g);
 const series = name => [...g.events.values()].find(e => e.summary === name && e.recurrence);
 const cancelled = () => [...g.events.values()].filter(e => e.recurringEventId && e.status === 'cancelled').map(e => e.id).sort();
 const extras = () => [...g.events.values()].filter(e => e.id.startsWith(MEETING_PREFIX) && e.status !== 'cancelled');

 // SIAP: Tuesday's class moved to 06:40 in another room, Wednesday cancelled, next Wednesday as usual.
 const meeting = (id, date, start, end, course, room) => db.prepare('INSERT INTO schedule_meetings(owner,external_id,date,start,end,course,room,kind) VALUES(?,?,?,?,?,?,?,?)').run('Moreno', id, date, start, end, course, room, 'tatap muka');
 await meeting('m1', tue, '06:40', '09:10', 'Teknik Separasi II', 'E 1.6');
 await meeting('m2', tue2, '08:00', '09:00', 'Teknik Separasi II', 'A.1');
 await meeting('m3', wed2, '10:00', '12:00', 'Start Up', 'B.2');
 let result = await syncCalendar(db, 'Moreno', g);
 assert.deepEqual(result.warnings, []);
 const sep = series('Teknik Separasi II').id, start = series('Start Up').id;
 assert.deepEqual(cancelled(), [`${sep}_${tue}`, `${start}_${wed}`].sort());
 assert.deepEqual(extras().map(e => [e.summary, e.start.dateTime, e.end.dateTime, e.location]), [['Teknik Separasi II', `${tue}T06:40:00+07:00`, `${tue}T09:10:00+07:00`, 'E 1.6']]);
 assert.ok(!cancelled().some(id => id.startsWith(series('Manual').id)), 'manual classes are never touched');

 // A second sync changes nothing, and the per-date changes do not block the weekly series.
 result = await syncCalendar(db, 'Moreno', g);
 assert.equal(result.changed, 0); assert.deepEqual(result.warnings, []);
 g.save({ ...g.events.get(sep), description: 'Dr. Budi' });
 result = await syncCalendar(db, 'Moreno', g);
 assert.deepEqual(result.warnings, []);
 assert.equal((await db.prepare("SELECT lecturer FROM schedules WHERE course='Teknik Separasi II'").get()).lecturer, 'Dr. Budi');

 // SIAP moves the class back: the extra event goes away and the weekly instance returns.
 await db.prepare("DELETE FROM schedule_meetings WHERE external_id='m1'").run();
 await meeting('m1', tue, '08:00', '09:00', 'Teknik Separasi II', '');
 result = await syncCalendar(db, 'Moreno', g);
 assert.deepEqual(result.warnings, []);
 assert.deepEqual(extras(), []);
 assert.deepEqual(cancelled(), [`${start}_${wed}`]);
 assert.equal(g.events.get(`${sep}_${tue}`).status, 'confirmed');
 assert.equal((await syncCalendar(db, 'Moreno', g)).changed, 0);
}

test('SQLite: SIAP dated changes reach Google without breaking the two-way weekly sync', async () => {
 const db = new DatabaseSync(':memory:'); db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
 try { await scenario(db); } finally { db.close(); }
});

test('PostgreSQL: SIAP dated changes reach Google', async () => {
 const engine = new PGlite();
 const db = postgresAdapter({
  query: async (sql, args) => { const r = await engine.query(sql, args); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }; },
  end: () => engine.close(),
 });
 try { await engine.exec(readFileSync(new URL('../schema-postgres.sql', import.meta.url), 'utf8')); await scenario(db); } finally { await db.close(); }
});
