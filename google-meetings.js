// One-way overlay of SIAP's dated calendar on top of the weekly Google series.
// Within the window Snoomy shows (this week and next, clipped to the dates SIAP sent), a weekly
// SIAP class with no identical meeting on that date is cancelled for that one date, and a moved
// or extra meeting becomes a single event. Snoomy records every event it touches here so the
// two-way sync does not mistake these per-date changes for edits made by hand in Google.
import { hash } from './google-model.js';
import { courseKey } from './undip-import.js';

const DAY = 86400000;
const iso = ms => new Date(ms).toISOString().slice(0, 10);
const dayOf = s => (new Date(s + 'T12:00:00Z').getUTCDay() + 6) % 7 + 1;
const wibDate = value => { const t = Date.parse(value); return Number.isFinite(t) ? iso(t + 7 * 3600000) : ''; };
export const MEETING_PREFIX = '5001';

export function meetingWindow(now = Date.now()) {
 const today = Date.parse(iso(now + 7 * 3600000) + 'T00:00:00Z');
 const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * DAY;
 return { from: iso(monday), to: iso(monday + 13 * DAY) };
}

export async function ownOverlayIds(db, user) {
 return new Set((await db.prepare('SELECT event_id FROM google_overlay WHERE user_name=?').all(user)).map(r => r.event_id));
}

function plan(series, meetings, instances, from, to, user, calendarId) {
 const want = new Map();
 for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += DAY) {
  const date = iso(t), slots = series.filter(s => s.day === dayOf(date)), used = new Set();
  for (const m of meetings.filter(m => m.date === date)) {
   const match = slots.find(s => !used.has(s.id) && courseKey(s.course) === courseKey(m.course) && s.start === m.start && s.end === m.end && (!m.room || m.room === s.room));
   if (match) { used.add(match.id); continue; }
   const id = MEETING_PREFIX + hash(JSON.stringify([user, calendarId, date, m.start, m.end, m.course, m.room]));
   want.set(id, { kind: 'extra', date, body: {
    id, summary: m.course, location: m.room || '', colorId: '6',
    description: 'Perubahan jadwal dari kalender SIAP, diatur otomatis oleh Snoomy. Edit lewat SIAP, bukan di sini.',
    start: { dateTime: `${date}T${m.start}:00+07:00`, timeZone: 'Asia/Jakarta' },
    end: { dateTime: `${date}T${m.end}:00+07:00`, timeZone: 'Asia/Jakarta' },
   } });
  }
  for (const s of slots) {
   if (used.has(s.id)) continue;
   const instance = instances.get(s.id)?.get(date);
   if (instance) want.set(instance.id, { kind: 'cancel', date, instance });
  }
 }
 return want;
}

export async function syncMeetings(db, user, remote, events, { checkTime = () => {}, now = Date.now() } = {}) {
 const result = { changed: 0, warnings: [] };
 const { from, to } = meetingWindow(now);
 const range = await db.prepare('SELECT MIN(date) AS lo, MAX(date) AS hi FROM schedule_meetings WHERE owner=?').get(user);
 let want = new Map();
 if (range?.lo && range.lo <= to && range.hi >= from) {
  const lo = range.lo > from ? range.lo : from, hi = range.hi < to ? range.hi : to;
  const meetings = await db.prepare('SELECT date, start, end, course, room FROM schedule_meetings WHERE owner=? AND date BETWEEN ? AND ? ORDER BY date,start').all(user, lo, hi);
  const series = await db.prepare(`SELECT s.id, s.day, s.start, s.end, s.course, s.room, gm.event_id FROM schedules s
   JOIN schedule_sources ss ON ss.schedule_id=s.id AND ss.source='siap'
   JOIN google_maps gm ON gm.kind='schedule' AND gm.local_id=s.id AND gm.user_name=?
   WHERE s.owner=?`).all(user, user);
  const instances = new Map();
  for (const s of series) {
   checkTime();
   try {
    const list = await remote.instances(s.event_id, lo + 'T00:00:00+07:00', iso(Date.parse(hi + 'T00:00:00Z') + DAY) + 'T00:00:00+07:00');
    const byDate = new Map();
    for (const i of list.items || []) { const d = wibDate(i.originalStartTime?.dateTime || i.start?.dateTime); if (d) byDate.set(d, i); }
    instances.set(s.id, byDate);
   } catch (e) { if (e.code) throw e; result.warnings.push('Sebagian perubahan jadwal SIAP belum bisa dikirim ke Google. Sinkronkan lagi nanti.'); }
  }
  want = plan(series, meetings, instances, lo, hi, user, remote.calendarId);
 }
 const record = (id, kind, date) => db.prepare('INSERT INTO google_overlay(user_name,event_id,kind,date,active) VALUES(?,?,?,?,1) ON CONFLICT(user_name,event_id) DO UPDATE SET active=1').run(user, id, kind, date);
 for (const [id, item] of want) {
  checkTime();
  if (item.kind === 'cancel') {
   if (item.instance.status !== 'cancelled') { await record(id, 'cancel', item.date); await remote.remove(id, item.instance.etag); result.changed++; }
   else await record(id, 'cancel', item.date);
   continue;
  }
  const existing = events.get(id);
  if (existing && existing.status !== 'cancelled') { await record(id, 'extra', item.date); continue; }
  await record(id, 'extra', item.date);
  if (existing) await remote.update(id, { ...item.body, status: 'confirmed' }, existing.etag);
  else await remote.create(item.body);
  result.changed++;
 }
 // Undo what no longer applies, but leave past dates as they happened.
 const active = await db.prepare('SELECT event_id, kind FROM google_overlay WHERE user_name=? AND active=1 AND date>=?').all(user, from);
 for (const row of active) {
  if (want.has(row.event_id)) continue;
  checkTime();
  const event = events.get(row.event_id) || await remote.get(row.event_id);
  if (row.kind === 'extra') { if (event && event.status !== 'cancelled') await remote.remove(row.event_id, event.etag); }
  else if (event && event.status === 'cancelled') await remote.update(row.event_id, { status: 'confirmed' }, event.etag);
  // Rows stay recorded (inactive) because Google keeps the exception and the guard must keep ignoring it.
  await db.prepare('UPDATE google_overlay SET active=0 WHERE user_name=? AND event_id=?').run(user, row.event_id);
  result.changed++;
 }
 return result;
}
