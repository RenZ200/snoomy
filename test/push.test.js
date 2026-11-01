import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createECDH, createDecipheriv, createPublicKey, hkdfSync, randomBytes, verify } from 'node:crypto';
import express from 'express';
import webpush from 'web-push';
import { createPush } from '../push.js';

const database = () => { const db = new DatabaseSync(':memory:'); db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')); return db; };
// A phone's side of a subscription: its key pair and auth secret.
function phone(endpoint = `https://push.example/${randomBytes(6).toString('hex')}`) {
  const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
  const auth = randomBytes(16);
  return { ecdh, auth, subscription: { endpoint, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } } };
}
// RFC 8291 decryption written independently of the library, so the test checks the real wire format.
function decrypt(body, { ecdh, auth }) {
  const salt = body.subarray(0, 16), idLength = body[20], sender = body.subarray(21, 21 + idLength), sealed = body.subarray(21 + idLength);
  const info = Buffer.concat([Buffer.from('WebPush: info\0'), ecdh.getPublicKey(), sender]);
  const ikm = Buffer.from(hkdfSync('sha256', ecdh.computeSecret(sender), auth, info, 32));
  const key = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const decipher = createDecipheriv('aes-128-gcm', key, nonce);
  decipher.setAuthTag(sealed.subarray(-16));
  const padded = Buffer.concat([decipher.update(sealed.subarray(0, -16)), decipher.final()]);
  let end = padded.length - 1;
  while (padded[end] === 0) end -= 1;
  assert.equal(padded[end], 2, 'last-record delimiter');
  return JSON.parse(padded.subarray(0, end).toString());
}

test('VAPID keys are made once, kept in the database and shared by every server instance', async () => {
  const db = database();
  let made = 0;
  const generate = () => { made += 1; return webpush.generateVAPIDKeys(); };
  const first = await createPush(db, { generate }).vapid();
  const second = await createPush(db, { generate }).vapid();
  assert.deepEqual(second, first, 'a second cold start reads the stored pair');
  assert.equal(made, 2, 'a racing instance may generate, but only the first pair is kept');
  assert.match(first.publicKey, /^[A-Za-z0-9_-]{87}$/);
  db.close();
});

test('a notification is encrypted for the phone and signed with the stored key', async () => {
  const db = database();
  const push = createPush(db);
  const { publicKey, privateKey } = await push.vapid();
  const device = phone('https://push.example/send/abc');
  const message = { title: '⚡ Waktunya Real!', body: 'Dua menit.', tag: 'real-2026-11-01', url: '/#real' };
  const request = webpush.generateRequestDetails(device.subscription, JSON.stringify(message), { vapidDetails: { subject: 'https://snoomy.vercel.app', publicKey, privateKey }, TTL: 60, urgency: 'high' });
  assert.equal(request.headers['Content-Encoding'], 'aes128gcm');
  assert.equal(request.headers.TTL, 60);
  assert.deepEqual(decrypt(request.body, device), message);
  const [, token, key] = /^vapid t=([^,]+), k=(.+)$/.exec(request.headers.Authorization);
  assert.equal(key, publicKey);
  const [head, claims, signature] = token.split('.');
  const payload = JSON.parse(Buffer.from(claims, 'base64url'));
  assert.equal(payload.aud, 'https://push.example');
  assert.equal(payload.sub, 'https://snoomy.vercel.app');
  assert.ok(payload.exp * 1000 > Date.now());
  const point = Buffer.from(publicKey, 'base64url');
  const jwk = { kty: 'EC', crv: 'P-256', x: point.subarray(1, 33).toString('base64url'), y: point.subarray(33).toString('base64url') };
  assert.ok(verify('sha256', Buffer.from(`${head}.${claims}`), { key: createPublicKey({ key: jwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')), 'ES256 signature checks out');
  db.close();
});

test('push API: subscribe, move with the profile, unsubscribe, test message, and gone phones are dropped', async () => {
  const db = database();
  const sent = [];
  let gone = new Set();
  const send = async (subscription, body, options) => {
    sent.push({ endpoint: subscription.endpoint, message: JSON.parse(body), ttl: options.TTL });
    if (gone.has(subscription.endpoint)) throw Object.assign(Error('Gone'), { statusCode: 410 });
  };
  const push = createPush(db, { send });
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = req.get('x-user'); next(); });
  push.mount(app);
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/push`;
  const call = async (user, path = '', body) => {
    const res = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'x-user': user, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  try {
    const info = await call('Moreno');
    assert.equal(info.body.publicKey, (await push.vapid()).publicKey);
    assert.equal(info.body.devices, 0);
    assert.equal((await call('Moreno', '/test', {})).status, 409, 'no phone has turned notifications on yet');

    const morenoPhone = phone(), cahyaPhone = phone(), laptop = phone();
    assert.equal((await call('Moreno', '/subscribe', { subscription: { ...morenoPhone.subscription, endpoint: 'http://insecure.example/x' } })).status, 400);
    assert.equal((await call('Moreno', '/subscribe', { subscription: { ...morenoPhone.subscription, keys: { p256dh: '<bad>', auth: 'x' } } })).status, 400);
    for (const [user, device] of [['Moreno', morenoPhone], ['Cahya', cahyaPhone], ['Moreno', laptop]]) assert.equal((await call(user, '/subscribe', { subscription: device.subscription })).status, 201);
    assert.equal((await call('Moreno')).body.devices, 2);

    assert.equal(await push.notify(['Cahya'], { title: 'Moreno baru posting Real ✨', body: 'x', tag: 't' }), 1);
    assert.deepEqual(sent.map(s => s.endpoint), [cahyaPhone.subscription.endpoint], 'only the chosen person is notified');

    // Cahya signs in on Moreno's laptop: the laptop now belongs to her.
    await call('Cahya', '/subscribe', { subscription: laptop.subscription });
    assert.equal((await call('Moreno')).body.devices, 1);
    assert.equal((await call('Cahya')).body.devices, 2);

    sent.length = 0;
    const tested = await call('Moreno', '/test', {});
    assert.deepEqual([tested.status, tested.body.delivered], [200, 1]);
    assert.equal(sent[0].message.title, 'Notifikasi Snoomy nyala ✨');

    // A phone the push service no longer knows is removed on the next message.
    gone = new Set([cahyaPhone.subscription.endpoint]);
    assert.equal(await push.notify(['Moreno', 'Cahya'], { title: '⚡ Waktunya Real!', body: 'x', tag: 'real' }), 2);
    assert.equal((await call('Cahya')).body.devices, 1);

    assert.equal((await call('Cahya', '/unsubscribe', { endpoint: morenoPhone.subscription.endpoint })).status, 200);
    assert.equal((await call('Moreno')).body.devices, 1, "one cannot unsubscribe someone else's phone");
    await call('Moreno', '/unsubscribe', { endpoint: morenoPhone.subscription.endpoint });
    assert.equal((await call('Moreno')).body.devices, 0);
  } finally {
    server.close();
    db.close();
  }
});
