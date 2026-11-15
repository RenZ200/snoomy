// Impor jadwal kuliah dari SIAP / Gentayu.
// The student logs in to SIAP or Gentayu themself, copies their schedule (or saves it as a file)
// and brings it here. Snoomy never asks for or stores the SSO password.
(() => {
 const $ = s => document.querySelector(s);
 const days = ['','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
 const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
 const fieldName = { day:'hari', start:'mulai', end:'selesai', course:'nama', lecturer:'dosen', room:'ruang' };
 const skipName = { exam:'jadwal ujian', incomplete:'baris tidak lengkap', unreadable:'baris tidak terbaca', time:'jam tidak valid', limit:'melebihi batas 80 kelas' };

 const button = document.createElement('button');
 button.type = 'button'; button.id = 'import-siap'; button.className = 'secondary';
 button.textContent = 'Impor SIAP';
 button.title = 'Ambil jadwal kuliah dari SIAP / Gentayu';
 const add = $('#add-schedule');
 if (!add) return;
 const group = document.createElement('div'); group.className = 'schedule-actions';
 add.replaceWith(group); group.append(button, add);

 const dialog = document.createElement('dialog');
 dialog.id = 'undip-dialog'; dialog.setAttribute('aria-labelledby', 'undip-title');
 dialog.innerHTML = `<form id="undip-form" novalidate>
  <div class="section-title"><h2 id="undip-title">Jadwal dari SIAP</h2><button type="button" class="icon" data-undip="close" aria-label="Tutup">×</button></div>
  <ol class="undip-steps">
   <li>Login sendiri di <strong>SIAP</strong> (siap.undip.ac.id) atau <strong>Gentayu</strong>.</li>
   <li>Di SIAP buka <strong>Dasbor → Jadwal Kuliah</strong>, blok tabel jadwal dari judul <em>No</em> sampai baris terakhir, lalu salin. File JSON / CSV jadwal juga bisa.</li>
   <li>Tempel di bawah, cek perubahannya, lalu simpan.</li>
  </ol>
  <p class="undip-note">Snoomy tidak pernah meminta password SSO. Jadwal yang kamu tambah sendiri tidak akan diubah.</p>
  <label>Jadwal dari SIAP / Gentayu<textarea name="text" rows="7" maxlength="300000" placeholder="Contoh:&#10;Senin 07:00-09:30 Termodinamika | A.502&#10;Rabu 10:00-12:30 Perpindahan Panas | B.201"></textarea></label>
  <div class="undip-file"><label class="text-button" for="undip-file-input">Pilih file…</label><input id="undip-file-input" type="file" accept=".json,.txt,.csv,.tsv,application/json,text/plain,text/csv"><span id="undip-file-name"></span></div>
  <label class="undip-check"><input type="checkbox" name="removeMissing" checked> Hapus matkul SIAP yang sudah tidak ada di data baru</label>
  <div id="undip-preview" aria-live="polite"></div>
  <p id="undip-error" class="error" role="alert"></p>
  <details class="undip-auto" id="undip-auto"><summary>Sinkron otomatis (ekstensi laptop)</summary>
   <p>Pasang ekstensi <strong>Snoomy × SIAP</strong> di Chrome/Edge laptop. Setiap kamu login SSO di SIAP, jadwalmu terkirim ke Snoomy sendiri.</p>
   <p id="undip-token-status" class="undip-token-status">Memeriksa…</p>
   <div id="undip-token-box" class="undip-token-box" hidden><input id="undip-token" readonly aria-label="Token sinkron"><button type="button" class="secondary" id="undip-token-copy">Salin</button><small>Tempel di pengaturan ekstensi. Token hanya ditampilkan sekali.</small></div>
   <div class="undip-token-actions"><button type="button" class="secondary" id="undip-token-new">Buat token</button><button type="button" class="text-button" id="undip-token-revoke" hidden>Cabut token</button></div>
  </details>
  <div class="form-actions"><button type="button" class="secondary" data-undip="close">Batal</button><button type="button" class="secondary" id="undip-check">Cek dulu</button><button type="submit" id="undip-save" disabled>Simpan ke Snoomy</button></div>
 </form>`;
 document.body.append(dialog);

 const form = $('#undip-form'), preview = $('#undip-preview'), error = $('#undip-error'), save = $('#undip-save'), check = $('#undip-check');
 let checkedText = null;

 async function post(path, body) {
  const res = await fetch('/api' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Error(res.status === 401 ? 'Sesi habis. Pilih profil lagi dulu.' : data.error || 'Permintaan gagal.');
  return data;
 }
 const slot = i => `${days[i.day]} ${esc(i.start)}–${esc(i.end)}`;
 const line = (cls, label, i, extra = '') => `<li class="${cls}"><span class="undip-tag">${label}</span><div><strong>${esc(i.course)}</strong><small>${slot(i)}${i.room ? ' · ' + esc(i.room) : ''}${i.lecturer ? ' · ' + esc(i.lecturer) : ''}</small>${extra}</div></li>`;
 function show(plan) {
  const removing = form.removeMissing.checked;
  const changes = u => `<small class="undip-was">Sebelumnya: ${u.changes.map(f => `${fieldName[f]} ${esc(f === 'day' ? days[u.before[f]] : u.before[f] || '–')}`).join(', ')}</small>`;
  const skipped = Object.entries(plan.skipped || {}).map(([k, n]) => `${n} ${skipName[k] || k}`).join(', ');
  const nothing = !plan.add.length && !plan.update.length && !(removing && plan.remove.length);
  preview.innerHTML = `<p class="undip-summary"><strong>${plan.total} kelas terbaca.</strong> ${plan.add.length} baru · ${plan.update.length} berubah · ${removing ? plan.remove.length : 0} dihapus · ${plan.same} sama${skipped ? `<br><small>Dilewati: ${skipped}.</small>` : ''}</p>
   ${nothing ? '<p class="undip-same">Jadwal di Snoomy sudah sama dengan SIAP ♡</p>' : `<ul class="undip-list">${plan.add.map(i => line('add', 'Baru', i)).join('')}${plan.update.map(i => line('update', 'Berubah', i, changes(i))).join('')}${removing ? plan.remove.map(i => line('remove', 'Dihapus', i)).join('') : ''}</ul>`}`;
  save.disabled = nothing;
 }
 function reset() { checkedText = null; save.disabled = true; preview.innerHTML = ''; }
 async function runCheck() {
  error.textContent = ''; check.disabled = true;
  try { const text = form.text.value; show(await post('/undip/preview', { text })); checkedText = text; }
  catch (e) { reset(); error.textContent = e.message; }
  finally { check.disabled = false; }
 }

 const when = t => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(t));
 async function loadToken() {
  const status = $('#undip-token-status');
  try {
   const res = await fetch('/api/undip/token'); const info = await res.json();
   if (!res.ok) throw Error(info.error || 'Gagal memeriksa token.');
   $('#undip-token-revoke').hidden = !info.exists;
   $('#undip-token-new').textContent = info.exists ? 'Buat token baru' : 'Buat token';
   if (!info.exists) { status.textContent = 'Belum tersambung ke ekstensi.'; return; }
   const r = info.lastResult;
   status.textContent = !info.lastUsed ? `Token dibuat ${when(info.created)}. Belum ada kiriman dari ekstensi.`
    : r && r.ok ? `Terakhir sinkron otomatis ${when(r.at)}: ${r.added} baru, ${r.updated} berubah, ${r.removed} dihapus.`
    : `Kiriman terakhir ${when(info.lastUsed)} gagal${r && r.error ? ': ' + r.error : '.'}`;
  } catch (e) { status.textContent = e.message; }
 }
 $('#undip-token-new').addEventListener('click', async e => {
  if ($('#undip-token-revoke').hidden === false && !confirm('Token lama akan berhenti bekerja. Buat token baru?')) return;
  e.target.disabled = true;
  try { const { token } = await post('/undip/token', {}); $('#undip-token').value = token; $('#undip-token-box').hidden = false; $('#undip-token').select(); await loadToken(); }
  catch (err) { $('#undip-token-status').textContent = err.message; }
  finally { e.target.disabled = false; }
 });
 $('#undip-token-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#undip-token').value); $('#undip-token-copy').textContent = 'Tersalin ✓'; }
  catch { $('#undip-token').select(); }
 });
 $('#undip-token-revoke').addEventListener('click', async () => {
  if (!confirm('Cabut token? Ekstensi berhenti mengirim jadwal sampai kamu membuat token baru.')) return;
  try { const res = await fetch('/api/undip/token', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: '{}' }); if (!res.ok) throw Error('Gagal mencabut token.'); $('#undip-token-box').hidden = true; await loadToken(); }
  catch (e) { $('#undip-token-status').textContent = e.message; }
 });

 button.addEventListener('click', () => {
  const user = document.body.dataset.user;
  if (!user || user === 'null') { add.click(); return; } // app.js shows the profile picker
  $('#undip-title').textContent = `Jadwal SIAP ${user}`;
  form.reset(); reset(); error.textContent = ''; $('#undip-file-name').textContent = '';
  $('#undip-token-box').hidden = true; $('#undip-token').value = ''; $('#undip-token-copy').textContent = 'Salin';
  dialog.showModal(); form.text.focus(); loadToken();
 });
 dialog.addEventListener('click', e => { if (e.target.closest('[data-undip="close"]')) dialog.close(); });
 form.text.addEventListener('input', reset);
 form.removeMissing.addEventListener('change', () => { if (checkedText !== null) runCheck(); });
 check.addEventListener('click', runCheck);
 $('#undip-file-input').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  if (file.size > 300000) { error.textContent = 'File terlalu besar (maksimal 300 KB).'; return; }
  form.text.value = await file.text(); $('#undip-file-name').textContent = file.name; reset(); runCheck();
 });
 form.addEventListener('submit', async e => {
  e.preventDefault();
  if (checkedText !== form.text.value) return runCheck();
  error.textContent = ''; save.disabled = true;
  try {
   const r = await post('/undip/import', { text: checkedText, keepMissing: !form.removeMissing.checked });
   dialog.close();
   document.dispatchEvent(new Event('snoomy-data-changed'));
   document.dispatchEvent(new CustomEvent('snoomy-schedules-imported', { detail: r }));
  } catch (err) { error.textContent = err.message; save.disabled = false; }
 });
})();
