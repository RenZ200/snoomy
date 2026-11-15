// Runs on siap.undip.ac.id pages. After you log in with SSO yourself, it loads the
// Jadwal Kuliah page in the background with your own session and hands the table to
// the extension, which sends it to Snoomy. It never reads or stores your password.
(() => {
  const JADWAL = '/jadwal_mahasiswa/mhs/jadwal/';
  const MIN_GAP = 10 * 60 * 1000; // at most one background read every 10 minutes

  async function readSchedule() {
    if (location.pathname.startsWith(JADWAL)) return siapScheduleText(document);
    const res = await fetch(JADWAL, { credentials: 'include', redirect: 'follow' });
    if (!res.ok || !new URL(res.url).pathname.startsWith(JADWAL)) return '';
    return siapScheduleText(new DOMParser().parseFromString(await res.text(), 'text/html'));
  }

  async function sync(force) {
    const { lastRead = 0 } = await chrome.storage.local.get('lastRead');
    if (!force && Date.now() - lastRead < MIN_GAP) return { ok: true, skipped: 'recent' };
    let text = '';
    try { text = await readSchedule(); } catch { /* offline or SIAP error: try again on the next page */ }
    if (!text) return { ok: false, error: 'Jadwal belum terbaca. Pastikan kamu sudah login SSO di SIAP.' };
    await chrome.storage.local.set({ lastRead: Date.now() });
    return chrome.runtime.sendMessage({ type: 'siap-schedule', text, force: !!force });
  }

  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message?.type !== 'sync-now') return false;
    sync(true).then(reply, e => reply({ ok: false, error: String(e?.message || e) }));
    return true;
  });

  sync(false);
})();
