/* "Our cakes" carousel: native horizontal scroll with snap,
   plus arrow buttons, mouse drag and a progress bar. */
(() => {
  const track = document.getElementById('cake-track');
  if (!track) return;
  const arrows = document.querySelectorAll('.cakes-arrow');
  const bar = document.getElementById('cakes-progress-bar');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stepSize = () => {
    const card = track.querySelector('.cake-card');
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const perView = Math.max(1, Math.floor(track.clientWidth / (card.offsetWidth + gap)));
    return (card.offsetWidth + gap) * perView;
  };

  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    const x = track.scrollLeft;
    arrows[0].setAttribute('aria-disabled', x <= 2 ? 'true' : 'false');
    arrows[1].setAttribute('aria-disabled', x >= max - 2 ? 'true' : 'false');
    const visible = track.clientWidth / track.scrollWidth;
    bar.style.width = `${visible * 100}%`;
    bar.style.transform = `translateX(${max > 0 ? (x / max) * (1 / visible - 1) * 100 : 0}%)`;
  };

  arrows.forEach((btn) => btn.addEventListener('click', () => {
    track.scrollBy({ left: stepSize() * Number(btn.dataset.dir), behavior: reduceMotion ? 'auto' : 'smooth' });
  }));

  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      track.scrollBy({ left: stepSize() * (e.key === 'ArrowRight' ? 1 : -1), behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  });

  /* Click-and-drag for mouse users (touch and trackpads scroll natively) */
  let startX = 0, startScroll = 0, dragging = false, moved = false;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    dragging = true; moved = false;
    startX = e.clientX; startScroll = track.scrollLeft;
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > 5) { moved = true; track.classList.add('is-dragging'); }
    if (moved) track.scrollLeft = startScroll - dx;
  });
  window.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    if (moved) {
      // let snap settle on the nearest card after the drag
      const keep = track.scrollLeft;
      track.classList.remove('is-dragging');
      track.scrollLeft = keep;
    }
  });
  // Don't treat the end of a drag as a click on an Order button
  track.addEventListener('click', (e) => { if (moved) { e.preventDefault(); moved = false; } }, true);

  track.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
