// Nonton bareng (one shared YouTube video kept in step between both phones) and the shared
// "Musik kita" playlist. Only YouTube video IDs are stored; titles come from YouTube's oEmbed.
const ID = /^[A-Za-z0-9_-]{11}$/;
const PLAYERS = ['Moreno', 'Cahya'];
const REACTIONS = ['♡', '😂', '😮', '😭', '👏', '🔥'];
const ONLINE_MS = 9000;
const fail = (message, status = 400) => { const e = Error(message); e.status = status; throw e; };

export function parseStart(value) {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);
  const parts = String(value).match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  return parts ? Number(parts[1] || 0) * 3600 + Number(parts[2] || 0) * 60 + Number(parts[3] || 0) : 0;
}
export function parseYouTube(input) {
  const text = String(input ?? '').trim().slice(0, 500);
  if (ID.test(text)) return { id: text, start: 0 };
  let url;
  try { url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`); } catch { return null; }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1];
  }
  if (!id || !ID.test(id)) return null;
  return { id, start: Math.min(parseStart(url.searchParams.get('t') || url.searchParams.get('start')), 86400) };
}

async function lookupTitle(id) {
  if (process.env.SNOOMY_OFFLINE === '1') return null;
  try {
    const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, { signal: AbortSignal.timeout(3500) });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.title === 'string' && data.title.trim() ? data.title.trim().slice(0, 160) : null;
  } catch { return null; }
}
const cleanTitle = value => typeof value === 'string' && value.trim() ? value.trim().slice(0, 160) : null;
const position = value => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) fail('Posisi video tidak valid.');
  return Math.min(number, 86400);
};
const blank = () => ({ videoId: null, title: '', playing: false, position: 0, updatedAt: 0, by: null, reaction: null, history: [] });

export function watchAction(state, user, body, now, title) {
  const next = { ...blank(), ...state };
  const action = body?.action;
  if (action === 'load') {
    const video = parseYouTube(body.url);
    if (!video) fail('Link YouTube-nya belum dikenali. Tempel link video dari YouTube.');
    const name = title || 'Video YouTube';
    return { ...next, videoId: video.id, title: name, playing: true, position: video.start, updatedAt: now, by: user,
      history: [{ videoId: video.id, title: name }, ...next.history.filter(item => item.videoId !== video.id)].slice(0, 8) };
  }
  if (action === 'react') {
    if (!REACTIONS.includes(body.emoji)) fail('Reaksi tidak dikenal.');
    return { ...next, reaction: { emoji: body.emoji, by: user, at: now, id: (next.reaction?.id || 0) + 1 } };
  }
  if (action === 'clear') return { ...next, videoId: null, title: '', playing: false, position: 0, updatedAt: now, by: user };
  if (!['play', 'pause', 'seek'].includes(action)) fail('Aksi tidak dikenal.');
  if (!next.videoId) fail('Belum ada video yang diputar.', 409);
  return { ...next, playing: action === 'play' ? true : action === 'pause' ? false : next.playing, position: position(body.position), updatedAt: now, by: user };
}

export function mountParty(app, db) {
  // Each poll is a handful of small queries run side by side, so the page stays quick even on a slow link.
  const partnerSeen = user => db.prepare('SELECT seen FROM watch_presence WHERE user_name=?').get(PLAYERS.find(p => p !== user));
  const view = (state, version, user, seen, now = Date.now()) => ({ ...blank(), ...state, version: Number(version), now, you: user,
    partner: { name: PLAYERS.find(p => p !== user), online: !!seen && now - Number(seen.seen) < ONLINE_MS } });
  app.get('/api/watch', async (req, res) => {
    const now = Date.now();
    const [, row, seen] = await Promise.all([
      // get() rather than run(): the Postgres adapter adds RETURNING id to run() inserts, and this table has no id.
      db.prepare('INSERT INTO watch_presence(user_name,seen) VALUES(?,?) ON CONFLICT(user_name) DO UPDATE SET seen=excluded.seen RETURNING seen').get(req.user, now),
      db.prepare('SELECT state,version FROM watch_party WHERE id=1').get(),
      partnerSeen(req.user),
    ]);
    res.json(view(row?.state ? JSON.parse(row.state) : blank(), row?.version || 0, req.user, seen, now));
  });
  app.post('/api/watch', async (req, res) => {
    const video = req.body?.action === 'load' ? parseYouTube(req.body.url) : null;
    const title = video ? await lookupTitle(video.id) : null;
    // Both phones can act at the same moment (a reaction while the other pauses). Each write must start from the
    // state it read, so a change made in between is re-read and kept instead of being overwritten.
    for (let attempt = 1; ; attempt++) {
      const row = await db.prepare('SELECT state,version FROM watch_party WHERE id=1').get();
      const next = watchAction(row?.state ? JSON.parse(row.state) : blank(), req.user, req.body, Date.now(), title);
      const [updated, seen] = await Promise.all([
        db.prepare('UPDATE watch_party SET state=?,version=version+1 WHERE id=1 AND version=? RETURNING version').get(JSON.stringify(next), Number(row?.version || 0)),
        partnerSeen(req.user),
      ]);
      if (updated) return res.json(view(next, updated.version, req.user, seen));
      if (attempt === 5) fail('Ada perubahan bersamaan. Coba lagi.', 409);
    }
  });

  const tracks = async () => (await db.prepare('SELECT id,video_id,title,added_by FROM music_tracks ORDER BY id').all())
    .map(row => ({ id: Number(row.id), videoId: row.video_id, title: row.title, addedBy: row.added_by }));
  app.get('/api/music', async (req, res) => res.json({ tracks: await tracks() }));
  app.post('/api/music', async (req, res) => {
    const video = parseYouTube(req.body?.url);
    if (!video) fail('Link YouTube-nya belum dikenali. Tempel link lagu dari YouTube.');
    const list = await tracks();
    if (list.some(track => track.videoId === video.id)) fail('Lagu itu sudah ada di playlist.', 409);
    if (list.length >= 200) fail('Playlist sudah penuh (200 lagu). Hapus beberapa dulu.');
    const title = cleanTitle(req.body.title) || await lookupTitle(video.id) || 'Lagu YouTube';
    const result = await db.prepare('INSERT INTO music_tracks(video_id,title,added_by,created) VALUES(?,?,?,?)').run(video.id, title, req.user, Date.now());
    res.status(201).json({ id: Number(result.lastInsertRowid), tracks: await tracks() });
  });
  app.delete('/api/music/:id', async (req, res) => {
    const result = await db.prepare('DELETE FROM music_tracks WHERE id=?').run(Number(req.params.id));
    if (!result.changes) fail('Lagu tidak ditemukan.', 404);
    res.json({ tracks: await tracks() });
  });
}
