(() => {
  const box = document.createElement('aside');
  box.className = 'snoomy-music';
  box.setAttribute('aria-label', 'Musik untuk menemani');
  box.innerHTML = `<button class="music-toggle" type="button" aria-expanded="false" aria-controls="music-panel">♫ Musik kita</button>
    <div id="music-panel" class="music-panel" hidden>
      <div class="music-heading"><h2>Teman nugas ♡</h2><button class="music-close secondary" type="button" aria-label="Tutup dan hentikan musik">×</button></div>
      <p>Cute Aesthetic Mix · Happy Study & Relaxing BGM</p>
      <div class="music-player"></div>
      <p class="music-help">Tekan play di pemutar. Menutup panel atau pindah halaman akan menghentikan musik.</p>
      <a href="https://www.youtube.com/watch?v=BX7z7AvTCNw" target="_blank" rel="noopener noreferrer">Buka di YouTube</a>
    </div>`;
  document.body.append(box);
  const toggle = box.querySelector('.music-toggle');
  const panel = box.querySelector('.music-panel');
  const player = box.querySelector('.music-player');
  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) {
      const frame = document.createElement('iframe');
      frame.src = 'https://www.youtube-nocookie.com/embed/BX7z7AvTCNw?playsinline=1&rel=0';
      frame.title = 'Cute Aesthetic Mix, musik belajar dari YouTube';
      frame.allow = 'encrypted-media; fullscreen; picture-in-picture';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      player.replaceChildren(frame);
    } else {
      player.replaceChildren();
      toggle.focus();
    }
  }
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  box.querySelector('.music-close').addEventListener('click', () => setOpen(false));
  box.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) setOpen(false);
  });
})();
