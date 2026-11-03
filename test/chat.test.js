import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import { mountChat } from '../chat.js';

test('chat: messages, unread count, read receipts, history pages and notifications', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  let now = Date.parse('2026-11-01T10:00:00Z');
  const sent = [];
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = req.get('x-user'); next(); });
  mountChat(app, db, { clock: () => now, push: { notify: async (users, message) => { sent.push({ users, ...message }); return 1; } } });
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/chat`;
  const call = async (user, path = '', body) => {
    const res = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'x-user': user, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  try {
    let chat = (await call('Moreno')).body;
    assert.deepEqual([chat.messages, chat.unread, chat.partner, chat.more], [[], 0, 'Cahya', false]);
    assert.equal((await call('Moreno', '', { text: '   ' })).status, 400);
    assert.equal((await call('Moreno', '', { text: 'x'.repeat(1001) })).status, 400);

    const first = await call('Moreno', '', { text: '  udah makan?\r\nkangen ♡ ' });
    assert.equal(first.status, 201);
    assert.deepEqual([first.body.message.from, first.body.message.text], ['Moreno', 'udah makan?\nkangen ♡']);
    assert.deepEqual(sent.map(m => [m.users, m.title, m.body, m.tag, m.url]), [[['Cahya'], '💬 Moreno', 'udah makan?\nkangen ♡', 'chat-1', '/#chat']]);

    chat = (await call('Cahya')).body;
    assert.equal(chat.unread, 1);
    assert.equal(chat.messages[0].text, 'udah makan?\nkangen ♡');
    assert.equal((await call('Moreno')).body.partnerRead, 0, 'not read yet');

    // Cahya opens the chat: she reads it, and while she is here Moreno's next message does not ring her phone.
    now += 1000;
    await call('Cahya', `?after=${first.body.message.id}&open=1`);
    const read = await call('Cahya', '/read', { upTo: first.body.message.id });
    assert.deepEqual([read.body.unread, read.body.readUpTo], [0, first.body.message.id]);
    assert.equal((await call('Moreno')).body.partnerRead, first.body.message.id, 'Moreno sees it was read');
    assert.equal((await call('Moreno')).body.partnerHere, true);
    now += 3000;
    const second = await call('Moreno', '', { text: 'aku jemput jam 5 ya' });
    assert.equal(sent.length, 1, 'no notification while the chat is open on her phone');
    assert.deepEqual((await call('Cahya', `?after=${first.body.message.id}`)).body.messages.map(m => m.text), ['aku jemput jam 5 ya']);
    assert.equal((await call('Cahya', '/read', { upTo: -1 })).status, 400);

    // Later, with the chat closed, a long message is shortened in the notification.
    now += 60000;
    await call('Moreno', '', { text: 'a'.repeat(300) });
    assert.equal(sent.at(-1).body.length, 138);
    assert.equal((await call('Cahya')).body.unread, 2);
    assert.equal(second.body.partnerRead, first.body.message.id);

    // Replying marks everything before it as read.
    const reply = await call('Cahya', '', { text: 'oke ♡' });
    assert.equal(reply.body.unread, 0);
    assert.deepEqual(sent.at(-1).users, ['Moreno']);

    for (let i = 0; i < 60; i++) await call('Moreno', '', { text: `pesan ${i}` });
    chat = (await call('Moreno')).body;
    assert.deepEqual([chat.messages.length, chat.more, chat.messages.at(-1).text], [50, true, 'pesan 59']);
    const page = (await call('Moreno', `?before=${chat.messages[0].id}`)).body;
    assert.equal(page.messages.length, 14);
    assert.equal(page.messages[0].text, 'udah makan?\nkangen ♡');

    // Every message gets its own tag, so the phone keeps all of them instead of only the last one.
    const tags = sent.filter(m => m.tag.startsWith('chat-')).map(m => m.tag);
    assert.equal(new Set(tags).size, tags.length);

    // Colek: one nudge notification to the partner, then a short cooldown.
    const nudge = await call('Cahya', '/nudge', {});
    assert.equal(nudge.status, 200);
    assert.deepEqual([sent.at(-1).users, sent.at(-1).title, sent.at(-1).url], [['Moreno'], '👋 Cahya nyolek kamu', '/#chat']);
    assert.equal((await call('Cahya', '/nudge', {})).status, 429);
    now += 21000;
    assert.equal((await call('Cahya', '/nudge', {})).status, 200);
    assert.notEqual(sent.at(-1).tag, sent.at(-2).tag);
  } finally {
    server.close();
    db.close();
  }
});
