// src/utils/typewriter.js — minimal char-by-char typing with a blinking caret.
// Returns a stop() that finishes the line instantly (used when the player skips).

export function typeText(el, text, opts = {}) {
  if (!el) return () => {};
  const speed = opts.speed ?? 32;
  let i = 0, timer = null, stopped = false;
  el.textContent = '';
  el.classList.add('sv-typing');
  const step = () => {
    if (stopped) return;
    i++;
    el.textContent = text.slice(0, i);
    if (i < text.length) {
      timer = setTimeout(step, speed);
    } else {
      el.classList.remove('sv-typing');
      opts.done && opts.done();
    }
  };
  timer = setTimeout(step, opts.delay ?? speed);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    el.classList.remove('sv-typing');
    el.textContent = text;
  };
}
