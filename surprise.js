// A dated surprise. The words and photos live only in the database (this repository is public), and the server
// refuses to hand them to anyone but Moreno before the date. Moreno uploads them and can preview at any time.
export const SURPRISE_DATE = '2026-11-19';
const AUTO_OPEN_UNTIL = '2026-11-26', AUTHOR = 'Moreno', MAX_ITEMS = 40, MAX_PHOTO = 1500000;
const fail = (message, status = 400) => { const e = Error(message); e.status = status; throw e; };
const wibDate = now => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export function mountSurprise(app, db, { clock = Date.now } = {}) {
  const unlocked = () => wibDate(clock()) >= SURPRISE_DATE;
  const allowed = user => user === AUTHOR || unlocked();

  app.get('/api/surprise', async (req, res) => {
    if (!allowed(req.user)) return res.json({ show: false });
    const rows = await db.prepare('SELECT position,meta FROM surprise_items ORDER BY position').all();
    const parts = rows.map(row => ({ position: Number(row.position), ...JSON.parse(row.meta) }));
    const today = wibDate(clock());
    res.json({ show: rows.length > 0 && unlocked(), author: req.user === AUTHOR, ready: rows.length > 0,
      autoOpen: req.user !== AUTHOR && today >= SURPRISE_DATE && today <= AUTO_OPEN_UNTIL, text: parts.find(part => part.position === 0) || null, items: parts.filter(part => part.position > 0) });
  });
  app.get('/api/surprise/photo/:position', async (req, res) => {
    if (!allowed(req.user)) fail('Belum waktunya.', 403);
    const row = await db.prepare('SELECT photo FROM surprise_items WHERE position=?').get(Number(req.params.position));
    if (!row?.photo) fail('Foto tidak ditemukan.', 404);
    res.set('Content-Type', 'image/jpeg').end(Buffer.from(row.photo, 'base64'));
  });
  app.post('/api/surprise/item', async (req, res) => {
    if (req.user !== AUTHOR) fail('Hanya Moreno yang bisa mengisi ini.', 403);
    const { position, meta, photo = '' } = req.body || {};
    if (!Number.isInteger(position) || position < 0 || position > MAX_ITEMS || typeof meta !== 'object' || !meta) fail('Isi kejutan tidak valid.');
    if (typeof photo !== 'string' || photo.length > MAX_PHOTO * 4 / 3 || !/^[A-Za-z0-9+/=]*$/.test(photo)) fail('Foto tidak valid.');
    if (photo && Buffer.from(photo.slice(0, 8), 'base64')[0] !== 0xff) fail('Foto harus JPEG.');
    await db.prepare('INSERT INTO surprise_items(position,meta,photo) VALUES(?,?,?) ON CONFLICT(position) DO UPDATE SET meta=excluded.meta,photo=excluded.photo RETURNING position').get(position, JSON.stringify(meta), photo);
    res.json({ ok: true });
  });
  app.post('/api/surprise/clear', async (req, res) => {
    if (req.user !== AUTHOR) fail('Hanya Moreno yang bisa mengisi ini.', 403);
    await db.prepare('DELETE FROM surprise_items').run();
    res.json({ ok: true });
  });
}
