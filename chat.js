// Chat: one conversation between Moreno and Cahya. Messages are text; each side sees when the other has read them.
// Every new message is its own notification on the partner's phones (they stack, none is replaced), unless the
// partner has the chat open right now. "Colek" sends a nudge notification on demand, at most once per NUDGE_MS.
export const PLAYERS = ['Moreno', 'Cahya'];
export const MAX_LENGTH = 1000;
const PAGE = 50, OPEN_MS = 10000, NUDGE_MS = 20000;
const fail = (message, status = 400) => { const e = Error(message); e.status = status; throw e; };
const other = user => PLAYERS.find(p => p !== user);
const quiet = { notify: async () => 0 };
const shape = row => ({ id: Number(row.id), from: row.sender, text: row.body, at: Number(row.created) });

export function mountChat(app, db, { clock = Date.now, push = quiet } = {}) {
  // Where each side has read up to, and whether the chat is open on one of their phones.
  const reader = async user => {
    const row = await db.prepare('SELECT read_upto,seen FROM chat_readers WHERE user_name=?').get(user);
    return { readUpTo: Number(row?.read_upto || 0), seen: Number(row?.seen || 0) };
  };
  const mark = (user, field, value) => db.prepare(`INSERT INTO chat_readers(user_name,${field}) VALUES(?,?) ON CONFLICT(user_name) DO UPDATE SET ${field}=excluded.${field}`).get(user, value);
  async function state(user, messages) {
    const [mine, theirs, unread] = await Promise.all([
      reader(user), reader(other(user)),
      db.prepare('SELECT COUNT(*) AS total FROM chat_messages WHERE sender=? AND id>(SELECT COALESCE(MAX(read_upto),0) FROM chat_readers WHERE user_name=?)').get(other(user), user),
    ]);
    return { you: user, partner: other(user), messages, unread: Number(unread.total), readUpTo: mine.readUpTo,
      partnerRead: theirs.readUpTo, partnerHere: clock() - theirs.seen < OPEN_MS, now: clock() };
  }

  // after=<id> returns only newer messages (the open chat polls with it); without it, the latest page.
  // before=<id> loads older history. open=1 tells the partner's phone not to ring for messages you can see.
  app.get('/api/chat', async (req, res) => {
    const after = Number(req.query.after), before = Number(req.query.before);
    let rows;
    if (Number.isInteger(after) && after >= 0 && req.query.after !== undefined) rows = await db.prepare('SELECT id,sender,body,created FROM chat_messages WHERE id>? ORDER BY id LIMIT 200').all(after);
    else if (Number.isInteger(before) && before > 0) rows = (await db.prepare('SELECT id,sender,body,created FROM chat_messages WHERE id<? ORDER BY id DESC LIMIT ?').all(before, PAGE)).reverse();
    else rows = (await db.prepare('SELECT id,sender,body,created FROM chat_messages ORDER BY id DESC LIMIT ?').all(PAGE)).reverse();
    if (req.query.open === '1') await mark(req.user, 'seen', clock());
    res.json({ ...await state(req.user, rows.map(shape)), more: req.query.after === undefined && rows.length === PAGE });
  });

  app.post('/api/chat', async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.replace(/\r\n?/g, '\n').trim() : '';
    if (!text) fail('Pesannya masih kosong.');
    if (text.length > MAX_LENGTH) fail(`Pesan maksimal ${MAX_LENGTH} karakter.`);
    const now = clock();
    const row = await db.prepare('INSERT INTO chat_messages(sender,body,created) VALUES(?,?,?) RETURNING id,sender,body,created').get(req.user, text, now);
    const message = shape(row);
    // Sending also means you have read everything up to your own message.
    await mark(req.user, 'read_upto', message.id);
    const partner = await reader(other(req.user));
    if (now - partner.seen >= OPEN_MS) {
      await push.notify([other(req.user)], { title: `💬 ${req.user}`, body: text.length > 140 ? `${text.slice(0, 137)}…` : text, tag: `chat-${message.id}`, url: '/#chat', ttl: 24 * 3600 });
    }
    res.status(201).json({ message, ...await state(req.user, []) });
  });

  app.post('/api/chat/nudge', async (req, res) => {
    const now = clock(), partner = other(req.user);
    const last = await db.prepare('SELECT at FROM chat_nudges WHERE user_name=?').get(req.user);
    const wait = Math.ceil((NUDGE_MS - (now - Number(last?.at || 0))) / 1000);
    if (wait > 0) fail(`Tunggu ${wait} detik sebelum colek lagi.`, 429);
    await db.prepare('INSERT INTO chat_nudges(user_name,at) VALUES(?,?) ON CONFLICT(user_name) DO UPDATE SET at=excluded.at RETURNING at').get(req.user, now);
    const delivered = await push.notify([partner], { title: `👋 ${req.user} nyolek kamu`, body: 'Buka Snoomy yuk, ada yang kangen ♡', tag: `nudge-${now}`, url: '/#chat', ttl: 3600 });
    if (!delivered) fail(`${partner} belum menyalakan notifikasi di HP-nya.`, 409);
    res.json({ delivered });
  });

  app.post('/api/chat/read', async (req, res) => {
    const upTo = Number(req.body?.upTo);
    if (!Number.isInteger(upTo) || upTo < 0) fail('Penanda baca tidak valid.');
    const current = await reader(req.user);
    if (upTo > current.readUpTo) await mark(req.user, 'read_upto', upTo);
    res.json(await state(req.user, []));
  });
}
