(() => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const burger = document.querySelector('.burger');
  const mobileMenu = document.getElementById('mobileMenu');

  function setMenu(open) {
    if (!burger || !mobileMenu) return;
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    mobileMenu.hidden = !open;
  }

  if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
      const open = burger.getAttribute('aria-expanded') === 'true';
      setMenu(!open);
    });

    mobileMenu.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (href.startsWith('#')) setMenu(false);
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 980) setMenu(false);
    });
  }

  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  let lastFocus = null;

  function openLightbox(src, alt) {
    if (!lightbox || !lightboxImg) return;
    lastFocus = document.activeElement;
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';

    const closeBtn = lightbox.querySelector('[data-close]');
    if (closeBtn) closeBtn.focus();
  }

  function closeLightbox() {
    if (!lightbox || !lightboxImg) return;
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    lightboxImg.src = '';

    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    lastFocus = null;
  }

  document.addEventListener('click', (e) => {
    const t = e.target;

    const trigger = t.closest('[data-lightbox]');
    if (trigger) {
      const src = trigger.getAttribute('data-src');
      const img = trigger.querySelector('img');
      openLightbox(src || '', img ? img.alt : '');
      return;
    }

    if (lightbox && lightbox.classList.contains('open')) {
      const close = t.closest('[data-close]');
      if (close) closeLightbox();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });

  if (!prefersReduced) {
    const nodes = Array.from(document.querySelectorAll('[data-reveal]'));
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('revealIn');
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.12 }
    );

    for (const n of nodes) io.observe(n);
  } else {
    for (const n of document.querySelectorAll('[data-reveal]')) n.classList.add('revealIn');
  }
})();
