import { randomInt } from 'node:crypto';

// Real: once a day, at a random moment between 09.00 and 21.00 WIB, both of you take one photo with the back and the
// front camera. Your partner's photo of the day stays locked until you post yours, posts after two minutes are marked
// late, and each of you can react to the other's photo.
export const PLAYERS = ['Moreno', 'Cahya'];
export const WINDOW = 2 * 60 * 1000;
export const REACTIONS = ['😍', '😂', '🥺', '😮', '🔥', '❤️'];
// Decoded byte limits per image; the client compresses to fit.
export const LIMITS = { main: 700 * 1024, inset: 250 * 1024, thumb: 60 * 1024 };
// Full-size photos are kept this many days; the small previews stay for the memories strip.
export const KEEP_DAYS = 60;
const FIRST = 9 * 60, LAST = 21 * 60, WIB = 7 * 3600 * 1000, DAY = 86400000;
const fail = (message, status = 400) => { const e = Error(message); e.status = status; throw e; };
const other = user => PLAYERS.find(p => p !== user);

// Calendar day in WIB for a moment, and the moment a WIB day starts.
export const dayOf = time => new Date(time + WIB).toISOString().slice(0, 10);
export const startOf = day => Date.parse(`${day}T00:00:00Z`) - WIB;
export const shiftDay = (day, days) => dayOf(startOf(day) + days * DAY + 12 * 3600 * 1000);
export const pickMoment = (day, rand = randomInt) => startOf(day) + (FIRST + rand(LAST - FIRST)) * 60000 + rand(60) * 1000;

// A JPEG or WebP sent as a data URL, checked by its own bytes.
export function image(value, limit, label) {
  const match = typeof value === 'string' && /^data:image\/(jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) fail(`${label} tidak valid. Ambil fotonya lagi.`);
  const bytes = Buffer.from(match[2], 'base64');
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!(match[1] === 'jpeg' ? jpeg : webp)) fail(`${label} tidak valid. Ambil fotonya lagi.`);
  if (bytes.length > limit) fail(`${label} terlalu besar. Coba ambil lagi.`, 413);
  return match[2];
}

// Days in a row, ending today or yesterday, on which both of you posted.
export function streak(days, today) {
  const both = new Set(days);
  let day = both.has(today) ? today : shiftDay(today, -1), count = 0;
  while (both.has(day)) { count += 1; day = shiftDay(day, -1); }
  return count;
}

export function mountReal(app, db, { clock = Date.now, rand = randomInt } = {}) {
  // The day's moment is chosen by whichever phone asks first; ON CONFLICT keeps one moment for both.
  async function moment(day) {
    await db.prepare('INSERT INTO real_days(day,moment) VALUES(?,?) ON CONFLICT(day) DO NOTHING').get(day, pickMoment(day, rand));
    return Number((await db.prepare('SELECT moment FROM real_days WHERE day=?').get(day)).moment);
  }
  const post = row => row ? { id: Number(row.id), user: row.user_name, day: row.day, posted: Number(row.posted), late: Number(row.late), caption: row.caption,
    reactions: JSON.parse(row.reactions || '{}'), full: !!row.kept } : null;
  const COLUMNS = 'id,day,user_name,posted,late,caption,reactions,main IS NOT NULL AS kept';
  async function today(user) {
    const now = clock(), day = dayOf(now), at = await moment(day), started = now >= at;
    const rows = await db.prepare(`SELECT ${COLUMNS} FROM real_posts WHERE day=?`).all(day);
    const mine = rows.find(row => row.user_name === user), theirs = rows.find(row => row.user_name === other(user));
    return { now, day, started, at: started ? at : null, mine: post(mine), theirs: post(theirs) };
  }

  // Polled by every page so the alert shows wherever Snoomy is open. It never reveals a moment before it happens.
  app.get('/api/real/status', async (req, res) => {
    const t = await today(req.user);
    res.json({ day: t.day, now: t.now, started: t.started, at: t.at, window: WINDOW, you: !!t.mine, partner: !!t.theirs });
  });

  app.get('/api/real', async (req, res) => {
    const t = await today(req.user), partner = other(req.user);
    const since = shiftDay(t.day, -30);
    const [recent, history] = await Promise.all([
      db.prepare(`SELECT ${COLUMNS} FROM real_posts WHERE day>=? AND day<? ORDER BY day DESC`).all(since, t.day),
      db.prepare('SELECT day FROM real_posts WHERE day>=? GROUP BY day HAVING COUNT(*)=2').all(shiftDay(t.day, -400)),
    ]);
    const days = [...new Set(recent.map(row => row.day))];
    const memories = days.map(day => Object.fromEntries([['day', day], ...PLAYERS.map(name => [name, post(recent.find(row => row.day === day && row.user_name === name)) || null])]));
    res.json({
      you: req.user, partner, day: t.day, now: t.now, started: t.started, at: t.at, window: WINDOW, keepDays: KEEP_DAYS,
      mine: t.mine,
      // Until you post, only the fact that your partner posted (and when) is shared, never the photo.
      theirs: t.theirs && (t.mine ? t.theirs : { locked: true, user: partner, posted: t.theirs.posted, late: t.theirs.late }),
      streak: streak(history.map(row => row.day), t.day),
      memories,
    });
  });

  app.get('/api/real/:id/:kind', async (req, res) => {
    // A refusal (photo still locked) must never be cached; only a photo you may see is.
    res.set('Cache-Control', 'no-store');
    if (!['main', 'inset', 'thumb'].includes(req.params.kind) || !/^\d+$/.test(req.params.id)) fail('Foto tidak ditemukan.', 404);
    const row = await db.prepare(`SELECT day,user_name,${req.params.kind} AS data FROM real_posts WHERE id=?`).get(Number(req.params.id));
    if (!row?.data) fail('Foto tidak ditemukan.', 404);
    const day = dayOf(clock());
    if (row.day === day && row.user_name !== req.user && !await db.prepare('SELECT id FROM real_posts WHERE day=? AND user_name=?').get(day, req.user)) {
      fail('Posting Real-mu dulu untuk melihat foto ini.', 403);
    }
    const bytes = Buffer.from(row.data, 'base64');
    // A posted photo never changes, so the browser may keep it.
    res.set({ 'Content-Type': bytes[0] === 0xff ? 'image/jpeg' : 'image/webp', 'Cache-Control': 'private, max-age=604800, immutable', 'Content-Length': String(bytes.length) });
    res.end(bytes);
  });

  app.post('/api/real', async (req, res) => {
    const now = clock(), day = dayOf(now), at = await moment(day);
    if (now < at) fail('Belum waktunya Real hari ini. Tunggu sampai Snoomy memberi tahu.', 409);
    const body = req.body || {};
    const caption = typeof body.caption === 'string' ? body.caption.trim().slice(0, 120) : '';
    const main = image(body.main, LIMITS.main, 'Foto belakang'), inset = image(body.inset, LIMITS.inset, 'Foto depan'), thumb = image(body.thumb, LIMITS.thumb, 'Pratinjau');
    if (await db.prepare('SELECT id FROM real_posts WHERE day=? AND user_name=?').get(day, req.user)) fail('Kamu sudah posting Real hari ini.', 409);
    try {
      await db.prepare('INSERT INTO real_posts(day,user_name,posted,late,caption,main,inset,thumb,reactions) VALUES(?,?,?,?,?,?,?,?,?)')
        .run(day, req.user, now, now - at, caption, main, inset, thumb, '{}');
    } catch (error) {
      if (/unique|duplicate/i.test(String(error.message))) fail('Kamu sudah posting Real hari ini.', 409);
      throw error;
    }
    // Older full-size photos make room; their previews stay in the memories.
    await db.prepare('UPDATE real_posts SET main=NULL,inset=NULL WHERE day<? AND main IS NOT NULL').run(shiftDay(day, -KEEP_DAYS));
    const t = await today(req.user);
    res.status(201).json({ mine: t.mine, theirs: t.theirs });
  });

  app.post('/api/real/:id/react', async (req, res) => {
    const emoji = req.body?.emoji ?? '';
    if (emoji !== '' && !REACTIONS.includes(emoji)) fail('Reaksi tidak dikenal.');
    const row = await db.prepare('SELECT id,day,user_name,reactions FROM real_posts WHERE id=?').get(Number(req.params.id));
    if (!row) fail('Real tidak ditemukan.', 404);
    if (row.user_name === req.user) fail('Reaksi untuk Real pasanganmu, bukan punyamu sendiri.');
    const day = dayOf(clock());
    if (row.day === day && !await db.prepare('SELECT id FROM real_posts WHERE day=? AND user_name=?').get(day, req.user)) fail('Posting Real-mu dulu.', 403);
    const reactions = JSON.parse(row.reactions || '{}');
    if (emoji) reactions[req.user] = emoji; else delete reactions[req.user];
    await db.prepare('UPDATE real_posts SET reactions=? WHERE id=?').run(JSON.stringify(reactions), row.id);
    res.json({ id: Number(row.id), reactions });
  });
}
