import webpush from 'web-push';

// Web Push for phone notifications (the Real reminder, a partner's new Real), sent even while Snoomy is closed.
// The VAPID key pair comes from VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY when set; otherwise it is created once and kept
// in the database, so notifications work without extra hosting settings. Each phone that turns them on stores one
// subscription; subscriptions the push service reports as gone are removed.
const SUBJECT = process.env.VAPID_SUBJECT || 'https://snoomy.vercel.app';
const fail = (message, status = 400) => { const e = Error(message); e.status = status; throw e; };
const KEY = /^[A-Za-z0-9_-]+$/;

export function createPush(db, { send = webpush.sendNotification, generate = webpush.generateVAPIDKeys } = {}) {
  let keys = null;
  async function vapid() {
    if (keys) return keys;
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) return keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    // Two cold starts may race; ON CONFLICT keeps the first pair and both read it back.
    const fresh = generate();
    await db.prepare('INSERT INTO push_keys(id,public_key,private_key) VALUES(1,?,?) ON CONFLICT(id) DO NOTHING').get(fresh.publicKey, fresh.privateKey);
    const row = await db.prepare('SELECT public_key,private_key FROM push_keys WHERE id=1').get();
    return keys = { publicKey: row.public_key, privateKey: row.private_key };
  }

  // Sends one message to every phone of the given people. Never throws: a reminder must not break the request.
  async function notify(users, message) {
    if (!users.length) return 0;
    let delivered = 0;
    try {
      const { publicKey, privateKey } = await vapid();
      const rows = await db.prepare(`SELECT endpoint,p256dh,auth FROM push_subscriptions WHERE user_name IN (${users.map(() => '?').join(',')})`).all(...users);
      const body = JSON.stringify({ title: message.title, body: message.body, tag: message.tag, url: message.url || '/' });
      await Promise.all(rows.map(async row => {
        try {
          await send({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, body,
            { vapidDetails: { subject: SUBJECT, publicKey, privateKey }, TTL: message.ttl ?? 3600, urgency: 'high', timeout: 5000 });
          delivered += 1;
        } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) await db.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').run(row.endpoint);
          else console.error('Notifikasi gagal dikirim:', error.statusCode || error.code || 'unknown');
        }
      }));
    } catch (error) { console.error('Notifikasi gagal disiapkan:', error.code || error.name || 'unknown'); }
    return delivered;
  }

  function mount(app) {
    app.get('/api/push', async (req, res) => {
      const { publicKey } = await vapid();
      const devices = await db.prepare('SELECT COUNT(*) AS total FROM push_subscriptions WHERE user_name=?').get(req.user);
      res.json({ publicKey, devices: Number(devices.total) });
    });
    app.post('/api/push/subscribe', async (req, res) => {
      const { endpoint, keys: sub } = req.body?.subscription || {};
      let url;
      try { url = new URL(endpoint); } catch { fail('Langganan notifikasi tidak valid.'); }
      if (url.protocol !== 'https:' || endpoint.length > 1000 || !KEY.test(sub?.p256dh || '') || !KEY.test(sub?.auth || '') || sub.p256dh.length > 200 || sub.auth.length > 100) fail('Langganan notifikasi tidak valid.');
      // One row per phone; a phone that changes hands (Ganti profil) moves to the new person.
      await db.prepare('INSERT INTO push_subscriptions(endpoint,user_name,p256dh,auth,created) VALUES(?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_name=excluded.user_name,p256dh=excluded.p256dh,auth=excluded.auth')
        .get(endpoint, req.user, sub.p256dh, sub.auth, Date.now());
      res.status(201).json({ ok: true });
    });
    app.post('/api/push/unsubscribe', async (req, res) => {
      if (typeof req.body?.endpoint !== 'string') fail('Langganan notifikasi tidak valid.');
      await db.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND user_name=?').run(req.body.endpoint, req.user);
      res.json({ ok: true });
    });
    app.post('/api/push/test', async (req, res) => {
      const delivered = await notify([req.user], { title: 'Notifikasi Snoomy nyala ✨', body: 'Begini nanti rasanya saat waktunya Real.', tag: 'snoomy-test', url: '/#real', ttl: 300 });
      if (!delivered) fail('Belum ada HP yang menerima notifikasi. Nyalakan dulu di HP ini.', 409);
      res.json({ delivered });
    });
  }
  return { vapid, notify, mount };
}
