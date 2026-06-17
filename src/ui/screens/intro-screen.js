// src/ui/screens/intro-screen.js — The cold open, Samaritan-style.
// Faithful to the goncalomb/Samaritan demo: a stark two-tone message box,
// a centered line + pulsing red arrow, and big mono text — the system
// "assessing" you before you take office. Inverts with the game theme
// (white-on-black in dark, ink-on-paper in light).

import { govRaw } from '../../utils/governor.js';

const TIER_LABEL = { easy: 'LOW', medium: 'MODERATE', hard: 'HIGH', extreme: 'CRITICAL', war: 'ACTIVE CONFLICT' };

export class IntroScreen {
  static render(state) {
    const city = state.city ?? {};
    const os   = city.opening_sequence ?? {};
    const name = (govRaw(state) || 'Acting Governor').toUpperCase();
    const tier = (city.tier ?? 'medium');
    const cn   = (city.city_name ?? 'UNKNOWN').toUpperCase();
    let sit    = String(os.intro_body || os.intro || os.title || '').trim();
    if (sit.length > 150) sit = sit.slice(0, 147).replace(/\s+\S*$/, '') + '…';

    return `
      <div class="screen sv2"
           data-name="${name}" data-city="${cn}" data-threat="${TIER_LABEL[tier] ?? 'MODERATE'}"
           data-approval="${state.approval}" data-budget="${state.budget}" data-cab="${(state.advisors ?? []).length}"
           data-sit="${sit.replace(/"/g, '&quot;')}">
        <div class="sv2-stage">
          <div class="sv2-box" id="sv2box">
            <div class="sv2-box-t" id="sv2title">GOVERNED &middot; CIVIC OVERSIGHT</div>
            <div class="sv2-box-b" id="sv2body">TOTAL ACCESS ACHIEVED</div>
            <div class="sv2-box-f"></div>
          </div>
          <div class="sv2-text hidden" id="sv2text"></div>
          <div class="sv2-line hidden" id="sv2line"></div>
          <div class="sv2-arrow hidden" id="sv2arrow"></div>
          <div class="sv2-sub hidden" id="sv2sub"></div>
          <button class="sv2-cta hidden" id="sv2cta">ASSUME CONTROL</button>
        </div>
        <div class="sv2-skip" id="sv2skip">SKIP &#9656;</div>
      </div>`;
  }

  static bind(container, handlers) {
    const root = container.querySelector('.sv2');
    if (!root) return;
    const d = root.dataset;
    const $ = id => container.querySelector(id);
    const box = $('#sv2box'), title = $('#sv2title'), body = $('#sv2body'),
          text = $('#sv2text'), line = $('#sv2line'), arrow = $('#sv2arrow'),
          sub = $('#sv2sub'), cta = $('#sv2cta'), skip = $('#sv2skip');

    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const clear = () => { timers.forEach(clearTimeout); timers.length = 0; };
    const go = () => { clear(); handlers.beginTerm?.(); };
    cta.addEventListener('click', go);
    skip.addEventListener('click', go);

    const flash = (el, html) => {
      el.classList.add('sv2-flash');
      setTimeout(() => { el.innerHTML = html; el.classList.remove('sv2-flash'); }, 150);
    };

    at(1300, () => flash(body, 'ASSIMILATING GOVERNMENT FEEDS'));
    at(2700, () => {
      title.innerHTML = `${d.city} &middot; THREAT ${d.threat}`;
      body.innerHTML =
        `SUBJECT &mdash; GOVERNOR ${d.name}<br>` +
        `APPROVAL ${d.approval}% &nbsp;&middot;&nbsp; TREASURY ${d.budget}M<br>` +
        `MANDATE 12 TURNS &nbsp;&middot;&nbsp; CABINET ${d.cab} ASSETS`;
    });
    at(4900, () => {
      box.classList.add('hidden');
      text.classList.remove('hidden');
      line.classList.remove('hidden');
      arrow.classList.remove('hidden');
      text.textContent = 'ASSESSING ' + d.city;
      if (d.sit) { sub.textContent = d.sit; sub.classList.remove('hidden'); }
    });
    at(6600, () => {
      text.textContent = `ARE YOU READY TO TAKE A CHANCE, ${d.name}?`;
      cta.classList.remove('hidden');
      skip.classList.add('hidden');
    });
  }
}
