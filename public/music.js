// Musik kita: a floating player for the shared playlist. Each phone plays on its own;
// the list of songs is shared, and either of you can add or remove songs.
(() => {
  if (window.self !== window.top) return;
  const YT = window.SnoomyYouTube;
  const KEY = 'snoomy-music-current';
  const box = document.createElement('aside');
  box.className = 'snoomy-music';
  box.setAttribute('aria-label', 'Musik untuk menemani');
  box.innerHTML = `<button class="music-toggle" type="button" aria-expanded="false" aria-controls="music-panel">♫ Musik kita</button>
    <div id="music-panel" class="music-panel" hidden>
      <div class="music-heading"><h2>Musik kita ♡</h2><button class="music-close icon" type="button" aria-label="Kecilkan pemutar">×</button></div>
      <p class="music-now" aria-live="polite">Pilih lagu dari playlist kita.</p>
      <div class="music-player"></div>
      <div class="music-controls" hidden><button class="music-prev secondary" type="button" aria-label="Lagu sebelumnya">⏮</button><button class="music-next secondary" type="button" aria-label="Lagu berikutnya">⏭</button><button class="music-stop secondary" type="button">Hentikan</button></div>
      <form class="music-add"><input name="url" autocomplete="off" inputmode="url" placeholder="Tempel link lagu YouTube" aria-label="Link lagu YouTube" required><button type="submit">Tambah</button></form>
      <ol class="music-list"></ol>
      <p class="music-help">Playlist ini dipakai berdua; lagunya diputar di HP masing-masing. Musik tetap jalan saat pindah menu Snoomy.</p>
    </div>`;
  document.body.append(box);
  const $ = selector => box.querySelector(selector);
  const toggle = $('.music-toggle'), panel = $('.music-panel'), stage = $('.music-player'), list = $('.music-list'), now = $('.music-now');
  let tracks = [], current = null, player = null, loaded = false;
  const blocked = new Set();
  const notify = message => window.toast ? window.toast(message) : alert(message);
  const el = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  try { current = Number(localStorage.getItem(KEY)) || null; } catch {}

  async function api(path = '', options = {}) {
    const response = await fetch('/api/music' + path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
    const data = await response.json().catch(() => ({ error: 'Server belum merespons. Coba lagi.' }));
    if (!response.ok) { const error = Error(data.error); error.status = response.status; throw error; }
    return data;
  }
  function renderList() {
    list.replaceChildren(...tracks.map((track, index) => {
      const item = el('li', null, track.id === current ? 'playing' : '');
      const play = el('button', null, 'music-pick'); play.type = 'button'; play.dataset.play = track.id;
      play.append(el('span', track.id === current ? '♫' : String(index + 1), 'music-index'), el('span', track.title, 'music-title'), el('small', `ditambah ${track.addedBy}${blocked.has(track.videoId) ? ' · tidak bisa diputar di sini' : ''}`));
      const remove = el('button', '×', 'music-remove icon'); remove.type = 'button'; remove.dataset.remove = track.id; remove.setAttribute('aria-label', `Hapus ${track.title} dari playlist`);
      item.append(play, remove);
      return item;
    }));
    if (!tracks.length) list.append(el('li', 'Belum ada lagu. Tempel link YouTube lagu favorit kalian di atas ♡', 'music-empty'));
    $('.music-controls').hidden = !player;
  }
  async function refresh() {
    try { tracks = (await api()).tracks; loaded = true; }
    catch (error) { if (error.status === 401) { tracks = []; now.textContent = 'Masuk ke Snoomy dulu untuk membuka playlist.'; } else now.textContent = error.message; }
    renderList();
  }
  function play(id) {
    const track = tracks.find(item => item.id === id);
    if (!track || !YT) return;
    current = id;
    try { localStorage.setItem(KEY, String(id)); } catch {}
    player?.destroy();
    const frame = YT.embed(track.videoId, { autoplay: true, title: `Musik kita: ${track.title}` });
    stage.replaceChildren(frame);
    player = YT.connect(frame, {
      onState: state => { if (state === 0) step(1); },
      onError: code => {
        blocked.add(track.videoId);
        now.textContent = `${track.title}: ${YT.errorText(code)}`;
        renderList();
        // Skip to the next playable song so the music keeps going.
        if (tracks.some(item => !blocked.has(item.videoId))) setTimeout(() => step(1), 1500);
      },
    });
    now.textContent = `Sedang diputar: ${track.title}`;
    toggle.classList.add('is-playing');
    renderList();
  }
  function step(direction) {
    if (!tracks.length) return;
    const index = tracks.findIndex(item => item.id === current);
    for (let i = 1; i <= tracks.length; i++) {
      const next = tracks[(index + direction * i + tracks.length * i) % tracks.length];
      if (!blocked.has(next.videoId)) return play(next.id);
    }
  }
  function stop() {
    player?.destroy(); player = null; stage.replaceChildren();
    toggle.classList.remove('is-playing');
    now.textContent = 'Musik dihentikan. Pilih lagu untuk memutar lagi.';
    renderList();
  }
  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open && !loaded) refresh();
    if (!open) toggle.focus();
  }

  toggle.addEventListener('click', () => setOpen(panel.hidden));
  $('.music-close').addEventListener('click', () => setOpen(false));
  $('.music-stop').addEventListener('click', stop);
  $('.music-prev').addEventListener('click', () => step(-1));
  $('.music-next').addEventListener('click', () => step(1));
  list.addEventListener('click', async event => {
    const pick = event.target.closest('[data-play]'), remove = event.target.closest('[data-remove]');
    if (pick) play(Number(pick.dataset.play));
    if (remove) {
      const track = tracks.find(item => item.id === Number(remove.dataset.remove));
      if (!track || !confirm(`Hapus “${track.title}” dari playlist kita?`)) return;
      try { tracks = (await api('/' + track.id, { method: 'DELETE', body: '{}' })).tracks; if (track.id === current) stop(); renderList(); }
      catch (error) { notify(error.message); }
    }
  });
  $('.music-add').addEventListener('submit', async event => {
    event.preventDefault();
    const input = event.target.url, button = event.submitter;
    if (YT && !YT.parse(input.value)) return notify('Link YouTube-nya belum dikenali. Tempel link lagu dari YouTube.');
    button.disabled = true;
    try {
      const data = await api('', { method: 'POST', body: JSON.stringify({ url: input.value.trim() }) });
      tracks = data.tracks; input.value = ''; renderList();
      // Start the new song right away unless something playable is already on.
      const playing = tracks.find(item => item.id === current);
      if (!player || !playing || blocked.has(playing.videoId)) play(data.id);
      else notify('Lagu masuk ke playlist ♡');
    } catch (error) { notify(error.message); }
    finally { button.disabled = false; }
  });
  box.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) setOpen(false);
  });
  // Starting a shared video pauses the background music.
  document.addEventListener('snoomy-media', event => { if (event.detail?.source !== 'music' && player) player.command('pauseVideo'); });
  let who = null;
  document.addEventListener('snoomy-session', event => {
    const next = event.detail?.user || null;
    if (next === who) return;
    who = next; loaded = false; tracks = [];
    if (!panel.hidden) refresh(); else renderList();
  });
})();
