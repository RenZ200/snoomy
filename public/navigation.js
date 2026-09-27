// Keep the main document and music player alive when switching to Budgeting.
(() => {
  const main = document.querySelector('main');
  const nav = document.querySelector('nav');
  let frame;
  function route() {
    const budgeting = location.hash === '#budgeting';
    document.body.classList.toggle('budgeting-mode', budgeting);
    if (budgeting && !frame) {
      frame = document.createElement('iframe');
      frame.id = 'budget-page-frame';
      frame.title = 'Budgeting Moreno dan Cahya';
      frame.src = '/budgeting.html?embedded=1';
      main.append(frame);
    }
    if (frame) frame.hidden = !budgeting;
    nav.querySelectorAll('a').forEach(link => {
      if (link.hash === (location.hash || '#dashboard')) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (budgeting) window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  route();
})();
