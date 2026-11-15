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

  // The same request the Jadwal Kuliah page makes for its calendar: one row per dated meeting,
  // including moved and extra meetings. Returns null when it cannot be read.
  async function readMeetings() {
    try {
      const res = await fetch(JADWAL + 'get_jadwal', { method: 'POST', credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      if (!res.ok) return null;
      const data = await res.json();
      const rows = Array.isArray(data) ? data : Object.values(data || {});
      return rows.filter(r => r && r.tanggal_pertemuan && r.nama_mk).map(r => ({
        id: String(r.id_trx_pertemuan ?? ''), date: String(r.tanggal_pertemuan).slice(0, 10),
        start: String(r.waktu_mulai || '').slice(0, 5), end: String(r.waktu_selesai || '').slice(0, 5),
        course: String(r.nama_mk), room: String(r.nama_ruang || ''), kind: String(r.jenis_perkuliahan || ''),
      }));
    } catch { return null; }
  }

  async function sync(force) {
    const { lastRead = 0 } = await chrome.storage.local.get('lastRead');
    if (!force && Date.now() - lastRead < MIN_GAP) return { ok: true, skipped: 'recent' };
    let text = '';
    try { text = await readSchedule(); } catch { /* offline or SIAP error: try again on the next page */ }
    if (!text) return { ok: false, error: 'Jadwal belum terbaca. Pastikan kamu sudah login SSO di SIAP.' };
    await chrome.storage.local.set({ lastRead: Date.now() });
    const meetings = await readMeetings();
    return chrome.runtime.sendMessage({ type: 'siap-schedule', text, meetings, force: !!force });
  }

  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message?.type !== 'sync-now') return false;
    sync(true).then(reply, e => reply({ ok: false, error: String(e?.message || e) }));
    return true;
  });

  sync(false);
})();
