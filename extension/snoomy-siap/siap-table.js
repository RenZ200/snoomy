// Reads the "Jadwal Kuliah" table from a SIAP page (siap.undip.ac.id/jadwal_mahasiswa/mhs/jadwal/)
// and returns it as tab-separated text that Snoomy's importer understands. Returns '' when the page
// has no schedule table (for example when the SSO session has ended and SIAP shows the login page).
// Only the schedule columns are kept, so attendance percentages do not cause needless re-sends.
(function (root) {
  const KEEP = ['no', 'hari', 'matakuliah', 'ruangan', 'waktu', 'sks'];
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

  function siapScheduleText(doc) {
    for (const table of doc.querySelectorAll('table')) {
      const head = [...table.querySelectorAll('thead th, tr:first-child th')].map(th => clean(th.textContent).toLowerCase());
      if (!['hari', 'matakuliah', 'waktu'].every(h => head.includes(h))) continue;
      const columns = KEEP.map(name => head.indexOf(name)).filter(i => i >= 0);
      const lines = [columns.map(i => head[i]).join('\t')];
      for (const row of table.querySelectorAll('tbody tr')) {
        const cells = [...row.cells].map(td => clean(td.textContent));
        if (cells.length < head.length) continue;
        lines.push(columns.map(i => cells[i]).join('\t'));
      }
      if (lines.length > 1) return lines.join('\n');
    }
    return '';
  }

  root.siapScheduleText = siapScheduleText;
  if (typeof module !== 'undefined') module.exports = { siapScheduleText };
})(typeof globalThis !== 'undefined' ? globalThis : this);
