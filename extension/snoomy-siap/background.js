// Sends the schedule table read from SIAP to Snoomy with your personal sync token.
// Re-sends only when the schedule changed, or at most every 6 hours as a check-in.
const DEFAULT_URL = 'https://snoomy.vercel.app';
const RESEND_AFTER = 6 * 60 * 60 * 1000;

async function sha256(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function badge(ok) {
  await chrome.action.setBadgeText({ text: ok ? '' : '!' });
  if (!ok) await chrome.action.setBadgeBackgroundColor({ color: '#E75CA6' });
}

async function send(text, meetings, force) {
  const { snoomyUrl = DEFAULT_URL, token = '', lastHash = '', lastSentAt = 0 } =
    await chrome.storage.local.get(['snoomyUrl', 'token', 'lastHash', 'lastSentAt']);
  if (!token) {
    const result = { ok: false, error: 'Token sinkron belum diisi. Buka ikon ekstensi lalu tempel token dari Snoomy.', at: Date.now() };
    await chrome.storage.local.set({ lastResult: result }); await badge(false); return result;
  }
  const hash = await sha256(JSON.stringify({ text, meetings }));
  if (!force && hash === lastHash && Date.now() - lastSentAt < RESEND_AFTER) return { ok: true, skipped: 'unchanged' };
  let result;
  try {
    const res = await fetch(snoomyUrl.replace(/\/+$/, '') + '/api/undip/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(meetings ? { text, meetings } : { text }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) return { ok: true, skipped: 'rate-limited' };
    result = { ...data, ok: res.ok && data.ok !== false, status: res.status, at: Date.now() };
    if (!res.ok && !result.error) result.error = `Snoomy membalas ${res.status}.`;
  } catch {
    result = { ok: false, error: 'Snoomy tidak bisa dihubungi. Cek internet atau alamat Snoomy.', at: Date.now() };
  }
  await chrome.storage.local.set(result.ok ? { lastResult: result, lastHash: hash, lastSentAt: Date.now() } : { lastResult: result });
  await badge(result.ok);
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== 'siap-schedule' || typeof message.text !== 'string') return false;
  // Accept schedule text only from the SIAP content script.
  if (!sender.url || new URL(sender.url).origin !== 'https://siap.undip.ac.id') return false;
  const meetings = Array.isArray(message.meetings) ? message.meetings.slice(0, 600) : null;
  send(message.text.slice(0, 300000), meetings, message.force).then(reply);
  return true;
});
