const $ = id => document.getElementById(id);
const DEFAULT_URL = 'https://snoomy.vercel.app';
const when = t => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(t));

function showStatus(result, token) {
  const box = $('status');
  box.className = 'status';
  if (!token) { box.textContent = 'Belum ada token. Buat token di Snoomy lalu tempel di bawah.'; return; }
  if (!result) { box.textContent = 'Siap. Login SSO di siap.undip.ac.id dan jadwalmu akan terkirim otomatis.'; return; }
  if (result.ok) {
    box.classList.add('ok');
    box.textContent = `Tersinkron ${when(result.at)}${result.user ? ' (' + result.user + ')' : ''}: ${result.added ?? 0} baru, ${result.updated ?? 0} berubah, ${result.removed ?? 0} dihapus, ${result.same ?? 0} sama.`;
  } else {
    box.classList.add('err');
    box.textContent = `Gagal ${when(result.at)}: ${result.error || 'tidak diketahui'}`;
  }
}

function allowedUrl(value) {
  try {
    const u = new URL(value);
    return u.origin === DEFAULT_URL || (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)) ? u.origin : null;
  } catch { return null; }
}

async function load() {
  const { snoomyUrl = DEFAULT_URL, token = '', lastResult = null } = await chrome.storage.local.get(['snoomyUrl', 'token', 'lastResult']);
  const custom = snoomyUrl !== DEFAULT_URL;
  $('url-choice').value = custom ? 'custom' : DEFAULT_URL;
  $('custom-wrap').hidden = !custom;
  $('custom-url').value = custom ? snoomyUrl : '';
  $('token').value = token;
  showStatus(lastResult, token);
}

$('url-choice').addEventListener('change', () => { $('custom-wrap').hidden = $('url-choice').value !== 'custom'; });

$('save').addEventListener('click', async () => {
  const token = $('token').value.trim();
  const url = $('url-choice').value === 'custom' ? allowedUrl($('custom-url').value.trim()) : DEFAULT_URL;
  if (!url) { $('status').className = 'status err'; $('status').textContent = 'Alamat lokal harus http://localhost:PORT atau http://127.0.0.1:PORT.'; return; }
  if (token && !/^snm_[A-Za-z0-9_-]{20,100}$/.test(token)) { $('status').className = 'status err'; $('status').textContent = 'Format token tidak dikenali. Salin ulang dari Snoomy.'; return; }
  await chrome.storage.local.set({ snoomyUrl: url, token, lastHash: '', lastSentAt: 0, lastRead: 0 });
  $('status').className = 'status ok';
  $('status').textContent = 'Tersimpan. Buka atau muat ulang tab SIAP untuk sinkron.';
});

$('sync').addEventListener('click', async () => {
  const button = $('sync'); button.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ url: 'https://siap.undip.ac.id/*' });
    if (!tab) { $('status').className = 'status err'; $('status').textContent = 'Buka siap.undip.ac.id dan login SSO dulu, lalu tekan lagi.'; return; }
    const result = await chrome.tabs.sendMessage(tab.id, { type: 'sync-now' });
    if (result && result.ok === false && !result.at) { $('status').className = 'status err'; $('status').textContent = result.error; }
    else await load();
  } catch {
    $('status').className = 'status err'; $('status').textContent = 'Muat ulang tab SIAP dulu, lalu coba lagi.';
  } finally { button.disabled = false; }
});

load();
