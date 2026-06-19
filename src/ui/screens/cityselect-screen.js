import * as d3 from 'd3';
import * as topo from 'topojson-client';
import landData from '../../data/geo/land-50m.json';
import countriesData from '../../data/geo/countries-50m.json';

// City data
const CITIES = [
  { key: 'singapore', name: 'Singapore', tier: 'easy', color: 'var(--tier-easy)', lon: 103.82, lat: 1.35, zoomW: 160, problems: 'Rigid governance, Aging population', flavor: 'Efficient, sterile, and quietly terrifying.' },
  { key: 'sf', name: 'San Francisco', tier: 'easy', color: 'var(--tier-easy)', lon: -122.42, lat: 37.77, zoomW: 160, problems: 'Tech inequality, Homelessness', flavor: 'Brilliant and broken in equal measure.' },
  { key: 'shenzhen', name: 'Shenzhen', tier: 'easy', color: 'var(--tier-easy)', lon: 114.06, lat: 22.54, zoomW: 160, problems: 'Tech boom, Surveillance', flavor: 'Built in 40 years. Will be rebuilt in 10.' },
  { key: 'brisbane', name: 'Brisbane', tier: 'easy', color: 'var(--tier-easy)', lon: 153.03, lat: -27.47, zoomW: 160, problems: 'Housing, Flooding, Transport', flavor: "The Olympics are coming. The budget is healthy. Don't blow it." },
  { key: 'jakarta', name: 'Jakarta', tier: 'medium', color: 'var(--tier-medium)', lon: 106.87, lat: -6.21, zoomW: 160, problems: 'Governance, Climate, Traffic', flavor: 'Chaotic, exhausted, somehow still functioning.' },
  { key: 'lagos', name: 'Lagos', tier: 'medium', color: 'var(--tier-medium)', lon: 3.38, lat: 6.52, zoomW: 160, problems: 'Governance, Tech boom, Infrastructure', flavor: 'Loud, ambitious, and not taking your calls.' },
  { key: 'frankfurt', name: 'Frankfurt', tier: 'medium', color: 'var(--tier-medium)', lon: 8.68, lat: 50.11, zoomW: 160, problems: 'Migration, EU bureaucracy, Finance', flavor: 'Efficient on the outside. Quietly overwhelmed.' },
  { key: 'jeddah', name: 'Jeddah', tier: 'medium', color: 'var(--tier-medium)', lon: 39.19, lat: 21.49, zoomW: 160, problems: 'Holy city governance, Warzone area', flavor: 'Sacred, oil-rich, and increasingly nervous.' },
  { key: 'beijing', name: 'Beijing', tier: 'medium', color: 'var(--tier-medium)', lon: 116.41, lat: 39.90, zoomW: 160, problems: 'Surveillance, Housing, Geopolitics', flavor: 'Watching you as much as you watch it.' },
  { key: 'nyc', name: 'New York City', tier: 'medium', color: 'var(--tier-medium)', lon: -74.01, lat: 40.71, zoomW: 160, problems: 'Housing, Inequality, Political chaos', flavor: 'Infinite ambition. Zero patience.' },
  { key: 'toronto', name: 'Toronto', tier: 'medium', color: 'var(--tier-medium)', lon: -79.38, lat: 43.65, zoomW: 160, problems: 'Housing crisis, Identity, Immigration', flavor: 'Polite on the outside. Housing crisis within.' },
  { key: 'johannesburg', name: 'Johannesburg', tier: 'medium', color: 'var(--tier-medium)', lon: 28.05, lat: -26.20, zoomW: 160, problems: 'Power cuts, Inequality, Crime', flavor: 'The City of Gold is rusting.' },
  { key: 'karachi', name: 'Karachi', tier: 'hard', color: 'var(--tier-hard)', lon: 67.01, lat: 24.86, zoomW: 160, problems: 'Infrastructure, Crime, Water shortage', flavor: 'The economic engine of Pakistan is sputtering.' },
  { key: 'cayman', name: 'George Town', tier: 'hard', color: 'var(--tier-hard)', lon: -81.37, lat: 19.29, zoomW: 160, problems: 'Housing, Inequality, Climate change', flavor: 'Offshore accounts overflowing. Locals priced out of paradise.' },
  { key: 'tehran', name: 'Tehran', tier: 'war', color: 'var(--tier-war)', lon: 51.39, lat: 35.69, zoomW: 130, problems: 'Active War, Internal faction war', flavor: 'Sanctions, strikes, and a city holding its breath.' },
  { key: 'tel_aviv', name: 'Tel Aviv', tier: 'war', color: 'var(--tier-war)', lon: 34.78, lat: 32.09, zoomW: 40, labelDx: 3, labelDy: -4, labelAnchor: 'start', problems: 'Active War, Missile threat', flavor: 'Modern, brilliant, under fire. Literally.' },
  { key: 'crimea', name: 'Crimea', tier: 'war', color: 'var(--tier-war)', lon: 34.10, lat: 45.00, zoomW: 130, problems: 'Active warzone, Split allegiance', flavor: 'Two flags. One peninsula. No easy answers.' },
  { key: 'gaza', name: 'Gaza', tier: 'extreme', color: 'var(--tier-extreme)', lon: 34.47, lat: 31.51, zoomW: 40, labelDx: -3, labelDy: 0, labelAnchor: 'end', problems: 'Destroyed, Active warzone', flavor: 'Survival mode only. Just endure.' },
  { key: 'caracas', name: 'Caracas', tier: 'extreme', color: 'var(--tier-extreme)', lon: -66.90, lat: 10.48, zoomW: 130, problems: 'Instability, Economic collapse', flavor: "Everything is broken. You're in charge. Good luck." },
  { key: 'mogadishu', name: 'Mogadishu', tier: 'extreme', color: 'var(--tier-extreme)', lon: 45.34, lat: 2.05, zoomW: 130, problems: 'Terrorism, Corruption, Infrastructure', flavor: 'The city is rebuilding from decades of war, but the shadows are long.' },
  { key: 'tokyo', name: 'Tokyo', tier: 'easy', color: 'var(--tier-easy)', lon: 139.69, lat: 35.68, zoomW: 160, problems: 'Aging society, Governance, Housing', flavor: 'Impeccably organized. Quietly buckling under the surface.' },
  { key: 'labuanbajo', name: 'Labuan Bajo', tier: 'medium', color: 'var(--tier-medium)', lon: 119.89, lat: -8.50, zoomW: 160, problems: 'Tourism, Environment, Development', flavor: 'Paradise on the edge of being loved to death.' },
  { key: 'guatemala', name: 'Guatemala City', tier: 'hard', color: 'var(--tier-hard)', lon: -90.51, lat: 14.63, zoomW: 160, problems: 'Crime, Corruption, Migration', flavor: 'The capital the country deserves. Not the one it needs.' },
  { key: 'vladivostok', name: 'Vladivostok', tier: 'hard', color: 'var(--tier-hard)', lon: 131.92, lat: 43.12, zoomW: 160, problems: 'Isolation, Geopolitics, Sanctions', flavor: 'Russia\u2019s Pacific edge. Far from Moscow, close to the fire.' },
  { key: 'erbil', name: 'Erbil', tier: 'extreme', color: 'var(--tier-extreme)', lon: 44.00, lat: 36.19, zoomW: 160, problems: 'Conflict, Autonomy, Regional instability', flavor: 'A Kurdish city navigating empires. As always.' },
];

const PLANNED_CITIES = [
  { name: 'Tallinn', lon: 24.75, lat: 59.44 }, { name: 'Tirana', lon: 19.82, lat: 41.33 },
  { name: 'Delhi', lon: 77.20, lat: 28.61 },
  { name: 'Cairo', lon: 31.24, lat: 30.04 }, { name: 'São Paulo', lon: -46.63, lat: -23.55 },
  { name: 'Moscow', lon: 37.62, lat: 55.75 }, { name: 'Davos', lon: 9.51, lat: 46.80 },
  { name: 'Istanbul', lon: 28.98, lat: 41.01 }, { name: 'Dar es Salaam', lon: 39.28, lat: -6.79 },
  { name: 'Mexico City', lon: -99.13, lat: 19.43 }, { name: 'Buenos Aires', lon: -58.38, lat: -34.60 },
  { name: 'Bangkok', lon: 100.52, lat: 13.75 }, { name: 'Dubai', lon: 55.30, lat: 25.20 },
  { name: 'Chisinau', lon: 28.86, lat: 47.01 }, { name: 'Djibouti', lon: 43.15, lat: 11.59 },
  { name: 'Barcelona', lon: 2.17, lat: 41.39 }, { name: 'Lima', lon: -77.04, lat: -12.04 },
  { name: 'Swansea', lon: -3.94, lat: 51.62 }, { name: 'Ho Chi Minh', lon: 106.63, lat: 10.82 },
  { name: 'Vancouver', lon: -123.12, lat: 49.28 },
  { name: 'Kampala', lon: 32.58, lat: 0.35 }, { name: 'Tunis', lon: 10.17, lat: 36.80 },
  { name: 'Casablanca', lon: -7.62, lat: 33.57 }, { name: 'Cape Town', lon: 18.42, lat: -33.93 },
  { name: 'Bandar Abbas', lon: 55.80, lat: 27.18 }, { name: 'Honiara', lon: 159.95, lat: -9.43 },
  { name: 'Nicosia', lon: 33.36, lat: 35.17 }, { name: 'Benghazi', lon: 20.07, lat: 32.12 },
  { name: 'Havana', lon: -82.36, lat: 23.11 },
  { name: 'Manila', lon: 120.98, lat: 14.60 }, { name: 'Chengdu', lon: 104.06, lat: 30.67 },
  { name: 'Austin', lon: -97.74, lat: 30.27 },
  { name: 'Suva', lon: 178.44, lat: -18.14 },
  { name: 'Falkland', lon: -58.43, lat: -51.80 }, { name: 'Perth', lon: 115.86, lat: -31.95 }
];

const TIER_LABEL = { easy: 'EASY', medium: 'MEDIUM', hard: 'HARD', extreme: 'EXTREME', war: 'WAR ZONE' };
const TIER_COLOR = { easy: 'var(--tier-easy)', medium: 'var(--tier-medium)', hard: 'var(--tier-hard)', extreme: 'var(--tier-extreme)', war: 'var(--tier-war)' };
// Drive every city marker from theme variables so the map recolors with light/dark mode.
CITIES.forEach(c => { c.color = 'var(--tier-' + c.tier + ')'; });
const TIER_META = {
  easy: { bars: 2, mandate: 'Stabilize existing systems. Maintain growth. Build a legacy the city deserves.' },
  medium: { bars: 3, mandate: 'Balance competing pressures. Hard choices ahead, but the city can still be saved.' },
  hard: { bars: 4, mandate: 'Failing systems require bold action. One wrong move accelerates the collapse.' },
  extreme: { bars: 5, mandate: 'Survival is the primary objective. Everything else is a luxury you cannot afford.' },
  war: { bars: 5, mandate: 'Navigate active conflict. Keep civilians alive. Do not trust anyone.' },
};

export class CitySelectScreen {
  static render(state) {
    const termList = ['easy', 'medium', 'hard', 'extreme', 'war'].map(tier => {
      const cities = CITIES.filter(c => c.tier === tier);
      if (!cities.length) return '';
      return '<div class="cs-term-tier-label" style="color:' + TIER_COLOR[tier] + '">' + TIER_LABEL[tier] + '</div>' +
        cities.map(c => '<div class="cs-term-city" data-key="' + c.key + '" data-color="' + c.color + '">' +
          '<span class="cs-tc-dot" style="background:' + c.color + '"></span>' +
          '<span class="cs-tc-name">' + c.name + '</span>' +
          '<span class="cs-tc-prob">' + ((c.problems || '').split(',')[0].trim()) + '</span>' +
          '</div>').join('');
    }).join('');

    const govVal = (state.governorName && state.governorName !== 'Governor') ? state.governorName : '';

    return `
      <div class="screen cs-screen">
        <div class="cs-topbar">
          <div class="cs-tb-left">
            <div class="cs-back" id="cs-back">&#x2190; BACK</div>
            <div class="cs-title">CHOOSE YOUR CITY</div>
          </div>
        </div>
        <div class="cs-body">
          <div class="cs-ledger">
            <div class="cs-term-header">
              <div class="cs-term-title">CITY_SELECT &gt; POSTING_BOARD</div>
              <input class="cs-term-search" id="cs-term-search" placeholder="search cities..." />
            </div>
            <div class="cs-term-list cs-ledger-list" id="cs-term-list">${termList}</div>
          </div>
          <div class="cs-map-panel" id="cs-map-panel" style="background-color: var(--map-ocean); position: relative; overflow: hidden;">
            <svg id="cs-worldmap" xmlns="http://www.w3.org/2000/svg"
              style="width:100%;height:100%;display:block;cursor:grab;touch-action:none">
              <!-- Giant rect behind everything for ocean color consistency -->
              <rect x="-5000" y="-5000" width="10000" height="10000" style="fill:var(--map-ocean)"/>
              <g class="countries-group"></g>
              <g class="pins-group"></g>
            </svg>
            <div class="cs-map-loading" id="cs-map-loading">LOADING MAP DATA...</div>
          </div>
          <div class="cs-dossier">
            <div class="cs-term-detail" id="cs-term-detail">
              <div class="cs-td-empty" id="cs-td-empty">
                <div class="cs-td-empty-icon">_</div>
                <div class="cs-td-empty-text">hover or click a city<br>to view posting details</div>
              </div>
              <div class="cs-td-content" id="cs-td-content" style="display:none">
                <div class="cs-td-tier" id="cs-td-tier"></div>
                <div class="cs-td-name" id="cs-td-name"></div>
                <div class="cs-td-problems" id="cs-td-problems"></div>
                <div class="cs-td-flavor" id="cs-td-flavor"></div>
                <div class="cs-td-divider"></div>
                <div class="cs-td-brief-label">FIELD BRIEF</div>
                <div class="cs-td-diff-row">
                  <span class="cs-td-diff-text">DIFFICULTY</span>
                  <div class="cs-td-diff-bars" id="cs-td-diff-bars"></div>
                </div>
                <div class="cs-td-mandate" id="cs-td-mandate"></div>
                <div class="cs-td-turns-row">
                  <span class="cs-td-turns-label">MANDATE</span>
                  <span class="cs-td-turns-val">12 TURNS</span>
                </div>
              </div>
            </div>
            <div class="cs-term-footer">
              <div class="cs-gov-row">
                <label class="cs-gov-label">GOV. NAME</label>
                <input class="cs-gov-input" id="gov-name-input" placeholder="Enter name..." maxlength="20" value="${govVal}">
              </div>
              <button class="cs-accept-btn" id="cs-accept-btn" disabled>ACCEPT POSTING</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  static bind(container, handlers) {
    container.querySelector('#cs-back')?.addEventListener('click', () => handlers.goToMenu());

    // --- MATHEMATICAL LIMITS OF THE D3 MAP ---
    // The scale(153) projection specifically draws the continents exactly inside this box:
    const WORLD_X = 61;   // The far left edge (Alaska/Americas)
    const WORLD_Y = 32;   // Top of Greenland
    const WORLD_W = 838;  // Width of all continents
    const WORLD_H = 436;  // Height down to Antarctica

    let vb = { x: 247.5, y: 116.4, w: 480.2, h: 250.1 }; // Initial startup coords
    const MIN_W = 50; // Closest allowed zoom
    let animFrame = null;

    const svg = container.querySelector('#cs-worldmap');
    const mapPanel = container.querySelector('#cs-map-panel');
    const hintEl = container.querySelector('#cs-map-hint');

    function applyVB() {
      svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    }

    function clampVB() {
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const screenRatio = rect.height / rect.width;

      // 1. DYNAMIC ZOOM OUT LIMIT
      // We calculate the largest possible box that fits perfectly inside the continents
      // without revealing the empty oceans beyond WORLD_W or WORLD_H.
      const maxAllowedW = Math.min(WORLD_W, WORLD_H / screenRatio);

      // Enforce zoom boundaries
      if (vb.w > maxAllowedW) vb.w = maxAllowedW;
      if (vb.w < MIN_W) vb.w = MIN_W;

      // Update height dynamically to match your screen aspect ratio flawlessly (NO Letterboxing)
      vb.h = vb.w * screenRatio;

      // 2. PANNING BOUNDARIES
      // Treat the exact edge of the landmasses as solid brick walls.
      const maxX = (WORLD_X + WORLD_W) - vb.w;
      const maxY = (WORLD_Y + WORLD_H) - vb.h;

      vb.x = Math.max(WORLD_X, Math.min(vb.x, maxX));
      vb.y = Math.max(WORLD_Y, Math.min(vb.y, maxY));
    }

    // Call on load and window resize to constantly adjust boundaries
    setTimeout(() => { clampVB(); applyVB(); }, 10);
    window.addEventListener('resize', () => { clampVB(); applyVB(); });

    function getResetTarget() {
      const rect = svg.getBoundingClientRect();
      const screenRatio = rect.height / rect.width;

      // We try to use your preferred starting zoom (width: 480.2)
      let targetW = 480.2;
      const maxAllowedW = Math.min(WORLD_W, WORLD_H / screenRatio);
      if (targetW > maxAllowedW) targetW = maxAllowedW;

      let targetH = targetW * screenRatio;

      // We aim for your preferred center point (Middle East/Asia)
      const prefCenterX = 247.5 + (480.2 / 2);
      const prefCenterY = 116.4 + (250.1 / 2);

      let targetX = prefCenterX - (targetW / 2);
      let targetY = prefCenterY - (targetH / 2);

      // Ensure the reset target is legally in bounds
      targetX = Math.max(WORLD_X, Math.min(targetX, (WORLD_X + WORLD_W) - targetW));
      targetY = Math.max(WORLD_Y, Math.min(targetY, (WORLD_Y + WORLD_H) - targetH));

      return { x: targetX, y: targetY, w: targetW, h: targetH };
    }

    function animateToVB(target, duration) {
      duration = duration || 500;
      if (animFrame) cancelAnimationFrame(animFrame);
      const start = { ...vb };
      const t0 = performance.now();

      (function step(now) {
        const t = Math.min((now - t0) / duration, 1);
        const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        vb = {
          x: start.x + (target.x - start.x) * e,
          y: start.y + (target.y - start.y) * e,
          w: start.w + (target.w - start.w) * e,
          h: start.h + (target.h - start.h) * e,
        };

        clampVB(); // Safety net: constantly enforce aspect ratio and walls during animation
        applyVB();

        if (t < 1) animFrame = requestAnimationFrame(step);
      })(t0);
    }

    mapPanel.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;

      const svgX = vb.x + (mx / rect.width) * vb.w;
      const svgY = vb.y + (my / rect.height) * vb.h;

      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      vb.w *= factor; // Only adjust width initially

      // CLAMP 1: Enforces max zoom constraints and generates precise vb.h
      clampVB();

      // Slide x and y so the mouse cursor stays exactly over the target landmass
      vb.x = svgX - (mx / rect.width) * vb.w;
      vb.y = svgY - (my / rect.height) * vb.h;

      // CLAMP 2: Make sure the new mouse-tracking coordinates didn't push us into the wall
      clampVB();
      applyVB();
    }, { passive: false });

    let drag = null;
    svg.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      drag = { sx: e.clientX, sy: e.clientY, vb: { ...vb } };
      svg.style.cursor = 'grabbing';
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!drag) return;
      const rect = svg.getBoundingClientRect();
      vb = {
        ...drag.vb,
        x: drag.vb.x - ((e.clientX - drag.sx) / rect.width) * drag.vb.w,
        y: drag.vb.y - ((e.clientY - drag.sy) / rect.height) * drag.vb.h,
      };
      clampVB();
      applyVB();
    });
    window.addEventListener('mouseup', () => { if (drag) { drag = null; svg.style.cursor = 'grab'; } });

    let touch = null, pinchData = null, touchStart = null;
    svg.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        touch = { sx: e.touches[0].clientX, sy: e.touches[0].clientY, vb: { ...vb } };
        pinchData = null;
      } else if (e.touches.length === 2) {
        const t0 = e.touches[0], t1 = e.touches[1];
        pinchData = {
          dist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
          vb: { ...vb },
          cx: (t0.clientX + t1.clientX) / 2,
          cy: (t0.clientY + t1.clientY) / 2,
        };
        touch = null; touchStart = null;
      }
    }, { passive: false });

    svg.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      if (e.touches.length === 1 && touch) {
        vb = {
          ...touch.vb,
          x: touch.vb.x - ((e.touches[0].clientX - touch.sx) / rect.width) * touch.vb.w,
          y: touch.vb.y - ((e.touches[0].clientY - touch.sy) / rect.height) * touch.vb.h,
        };
        clampVB();
        applyVB();
      } else if (e.touches.length === 2 && pinchData) {
        const t0 = e.touches[0], t1 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);

        vb.w = pinchData.vb.w * (pinchData.dist / dist);
        clampVB(); // Generates constrained w and exact h

        const mx = pinchData.cx - rect.left, my = pinchData.cy - rect.top;
        const svgX = pinchData.vb.x + (mx / rect.width) * pinchData.vb.w;
        const svgY = pinchData.vb.y + (my / rect.height) * pinchData.vb.h;

        vb.x = svgX - (mx / rect.width) * vb.w;
        vb.y = svgY - (my / rect.height) * vb.h;

        clampVB(); // Secondary clamp for walls
        applyVB();
      }
    }, { passive: false });

    svg.addEventListener('touchend', (e) => {
      if (touchStart && e.changedTouches.length === 1) {
        const t = e.changedTouches[0];
        if (Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) < 8) {
          const el = document.elementFromPoint(t.clientX, t.clientY);
          if (el && el.closest) {
            const pin = el.closest('.city-pin');
            if (pin) pin.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          }
        }
      }
      touch = null; pinchData = null; touchStart = null;
    });

    let selectedKey = null;
    const CITIES_MAP = {};
    CITIES.forEach(function (c) { CITIES_MAP[c.key] = Object.assign({}, c); });

    const tdEmpty = container.querySelector('#cs-td-empty');
    const tdContent = container.querySelector('#cs-td-content');
    const tdTier = container.querySelector('#cs-td-tier');
    const tdName = container.querySelector('#cs-td-name');
    const tdProblems = container.querySelector('#cs-td-problems');
    const tdFlavor = container.querySelector('#cs-td-flavor');
    const tdDiffBars = container.querySelector('#cs-td-diff-bars');
    const tdMandate = container.querySelector('#cs-td-mandate');
    const acceptBtn = container.querySelector('#cs-accept-btn');

    function showDetail(c) {
      tdEmpty.style.display = 'none';
      tdContent.style.display = 'block';
      tdTier.textContent = TIER_LABEL[c.tier] || c.tier.toUpperCase();
      tdTier.style.color = c.color;
      tdName.textContent = c.name;
      tdProblems.innerHTML = c.problems.split(',').map(function (p) {
        return '<span class="cs-td-tag" style="border-color:' + c.color + ';color:' + c.color + '">' + p.trim() + '</span>';
      }).join('');
      tdFlavor.textContent = c.flavor;
      const meta = TIER_META[c.tier] || TIER_META.medium;
      tdDiffBars.innerHTML = Array.from({ length: 5 }, function (_, i) {
        return '<span class="cs-td-bar' + (i < meta.bars ? ' active' : '') + '"' + (i < meta.bars ? ' style="background:' + c.color + '"' : '') + '/>';
      }).join('');
      tdMandate.textContent = meta.mandate;
    }

    function clearDetail() {
      tdEmpty.style.display = 'flex';
      tdContent.style.display = 'none';
    }

    function selectCity(key) {
      selectedKey = key;
      const c = CITIES_MAP[key];
      showDetail(c);
      acceptBtn.disabled = false;
      acceptBtn.style.borderColor = c.color;
      acceptBtn.style.color = c.color;
      container.querySelectorAll('.cs-term-city').forEach(function (el) {
        el.classList.toggle('selected', el.dataset.key === key);
      });
      container.querySelectorAll('.city-pin').forEach(function (pin) {
        const isSelected = pin.dataset.key === key;
        const isWar = pin.dataset.tier === 'war' || pin.dataset.tier === 'extreme';
        const baseR = isWar ? 1.0 : 0.7;
        const dot = pin.querySelector('.pin-dot');
        const lbl = pin.querySelector('.pin-label');
        if (dot) dot.setAttribute('r', isSelected ? String(baseR * 2.2) : String(baseR));
        if (lbl) {
          lbl.setAttribute('opacity', isSelected ? '1' : '0.85');
          lbl.setAttribute('font-weight', isSelected ? 'bold' : 'normal');
        }
      });
    }

    function zoomToCity(key) {
      const c = CITIES_MAP[key];
      if (!c || c.projX == null) return;

      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;

      const screenRatio = rect.height / rect.width;

      const targetW = c.zoomW || 160;
      const targetH = targetW * screenRatio;

      let targetX = c.projX - targetW / 2;
      let targetY = c.projY - targetH / 2;

      // Auto-zooming wall clamps
      targetX = Math.max(WORLD_X, Math.min(targetX, (WORLD_X + WORLD_W) - targetW));
      targetY = Math.max(WORLD_Y, Math.min(targetY, (WORLD_Y + WORLD_H) - targetH));

      animateToVB({ x: targetX, y: targetY, w: targetW, h: targetH });
    }

    container.querySelectorAll('.cs-term-city').forEach(function (el) {
      const key = el.dataset.key;
      el.addEventListener('click', function () { selectCity(key); zoomToCity(key); });
      el.addEventListener('mouseenter', function () { if (!selectedKey) showDetail(CITIES_MAP[key]); });
      el.addEventListener('mouseleave', function () {
        if (!selectedKey) clearDetail(); else showDetail(CITIES_MAP[selectedKey]);
      });
    });

    container.querySelector('#cs-term-search').addEventListener('input', function (e) {
      const q = e.target.value.toLowerCase();
      container.querySelectorAll('.cs-term-city').forEach(function (el) {
        const nm = el.querySelector('.cs-tc-name');
        el.style.display = (nm && nm.textContent.toLowerCase().indexOf(q) >= 0) ? '' : 'none';
      });
      container.querySelectorAll('.cs-term-tier-label').forEach(function (lbl) {
        let nx = lbl.nextElementSibling, any = false;
        while (nx && nx.classList.contains('cs-term-city')) {
          if (nx.style.display !== 'none') any = true;
          nx = nx.nextElementSibling;
        }
        lbl.style.display = any ? '' : 'none';
      });
    });

    svg.addEventListener('dblclick', function () { animateToVB(getResetTarget()); });

    acceptBtn.addEventListener('click', function () {
      if (!selectedKey) return;
      const nameEl = container.querySelector('#gov-name-input');
      handlers.startGame(selectedKey, (nameEl && nameEl.value.trim()) || 'Governor');
    });

    // Build map from bundled Natural Earth 50m data
    const loadingEl = container.querySelector('#cs-map-loading');
    const ns = 'http://www.w3.org/2000/svg';

    try {
      const projection = d3.geoNaturalEarth1().scale(153).translate([960 / 2, 500 / 2]);
      const pathGen = d3.geoPath().projection(projection);
      const countriesG = container.querySelector('.countries-group');

      // Graticule
      const gEl = document.createElementNS(ns, 'path');
      gEl.setAttribute('d', pathGen(d3.geoGraticule()()));
      gEl.setAttribute('fill', 'none');
      gEl.style.stroke = 'var(--map-graticule)';
      gEl.setAttribute('stroke-width', '0.4');
      countriesG.appendChild(gEl);

      // Land fill
      const landEl = document.createElementNS(ns, 'path');
      landEl.setAttribute('d', pathGen(topo.feature(landData, landData.objects.land)));
      landEl.style.fill = 'var(--map-land)';
      landEl.setAttribute('stroke', 'none');
      countriesG.appendChild(landEl);

      // Country borders
      topo.feature(countriesData, countriesData.objects.countries).features.forEach(function (f) {
        const p = document.createElementNS(ns, 'path');
        p.setAttribute('d', pathGen(f));
        p.setAttribute('fill', 'none');
        p.style.stroke = 'var(--map-border)';
        p.setAttribute('stroke-width', '0.3');
        countriesG.appendChild(p);
      });

      // Playable City pins
      const pinsG = container.querySelector('.pins-group');
      CITIES.forEach(function (c) {
        const proj = projection([c.lon, c.lat]);
        const px = proj[0], py = proj[1];
        CITIES_MAP[c.key].projX = px;
        CITIES_MAP[c.key].projY = py;

        const isWar = c.tier === 'war' || c.tier === 'extreme';
        const r = isWar ? 1.0 : 0.7;
        const dur = (2.5 + Math.random() * 1.2).toFixed(1) + 's';
        const anim = isWar
          ? 'animation:pulse-war ' + dur + ' ease-in-out infinite'
          : 'animation:pulse-slow ' + dur + ' ease-in-out infinite';

        const lx = px + (c.labelDx != null ? c.labelDx : 2.5);
        const ly = py + (c.labelDy != null ? c.labelDy : -2.5);
        const anchor = c.labelAnchor || 'start';
        const sw = isWar ? '1.0' : '0.7';

        const g = document.createElementNS(ns, 'g');
        g.classList.add('city-pin');
        g.style.cursor = 'pointer';
        g.dataset.key = c.key;
        g.dataset.tier = c.tier;
        g.dataset.color = c.color;

        const hitCircle = document.createElementNS(ns, 'circle');
        hitCircle.setAttribute('cx', String(px));
        hitCircle.setAttribute('cy', String(py));
        hitCircle.setAttribute('r', '7');
        hitCircle.setAttribute('fill', 'transparent');
        g.appendChild(hitCircle);

        const dot = document.createElementNS(ns, 'circle');
        dot.classList.add('pin-dot');
        dot.setAttribute('cx', String(px));
        dot.setAttribute('cy', String(py));
        dot.setAttribute('r', String(r));
        dot.style.fill = c.color;
        dot.setAttribute('opacity', '0.95');
        g.appendChild(dot);

        const ring1 = document.createElementNS(ns, 'circle');
        ring1.setAttribute('cx', String(px));
        ring1.setAttribute('cy', String(py));
        ring1.setAttribute('r', String(r));
        ring1.setAttribute('fill', 'none');
        ring1.style.stroke = c.color;
        ring1.setAttribute('stroke-width', sw);
        ring1.setAttribute('opacity', '0.45');
        ring1.style.cssText = anim;
        g.appendChild(ring1);

        if (isWar) {
          const ring2 = document.createElementNS(ns, 'circle');
          ring2.setAttribute('cx', String(px));
          ring2.setAttribute('cy', String(py));
          ring2.setAttribute('r', String(r));
          ring2.setAttribute('fill', 'none');
          ring2.style.stroke = c.color;
          ring2.setAttribute('stroke-width', '0.4');
          ring2.setAttribute('opacity', '0.2');
          ring2.style.cssText = anim + ';animation-delay:0.5s';
          g.appendChild(ring2);
        }

        const lbl = document.createElementNS(ns, 'text');
        lbl.classList.add('pin-label');
        lbl.setAttribute('x', String(lx));
        lbl.setAttribute('y', String(ly));
        lbl.style.fill = c.color;
        lbl.setAttribute('font-size', '2.5');
        lbl.setAttribute('font-family', 'monospace');
        lbl.setAttribute('letter-spacing', '0.3');
        lbl.setAttribute('text-anchor', anchor);
        lbl.setAttribute('opacity', '0.85');
        lbl.textContent = c.name.toUpperCase();
        g.appendChild(lbl);

        pinsG.appendChild(g);

        g.addEventListener('mouseenter', function () { if (!selectedKey) showDetail(c); });
        g.addEventListener('mouseleave', function () {
          if (!selectedKey) clearDetail(); else showDetail(CITIES_MAP[selectedKey]);
        });
        g.addEventListener('click', function (e) {
          e.stopPropagation();
          selectCity(c.key);
          zoomToCity(c.key);
        });
      });

      // Planned (locked) city dots
      PLANNED_CITIES.forEach(function (c) {
        const proj = projection([c.lon, c.lat]);
        const px = proj[0], py = proj[1];

        const g = document.createElementNS(ns, 'g');
        g.style.cursor = 'default';
        g.style.pointerEvents = 'none';

        const dot = document.createElementNS(ns, 'circle');
        dot.setAttribute('cx', String(px));
        dot.setAttribute('cy', String(py));
        dot.setAttribute('r', '0.5');
        dot.setAttribute('fill', '#3a3a3a');
        dot.setAttribute('opacity', '1');
        g.appendChild(dot);

        const ring = document.createElementNS(ns, 'circle');
        ring.setAttribute('cx', String(px));
        ring.setAttribute('cy', String(py));
        ring.setAttribute('r', '0.9');
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', '#444');
        ring.setAttribute('stroke-width', '0.4');
        ring.setAttribute('opacity', '1');
        g.appendChild(ring);

        const lbl = document.createElementNS(ns, 'text');
        lbl.setAttribute('x', String(px - 4));
        lbl.setAttribute('y', String(py + 3));
        lbl.setAttribute('fill', '#adabab');
        lbl.setAttribute('font-size', '2');
        lbl.setAttribute('font-family', 'monospace');
        lbl.setAttribute('letter-spacing', '0.2');
        lbl.setAttribute('text-anchor', 'start');
        lbl.setAttribute('opacity', '0.78');
        lbl.textContent = c.name.toUpperCase();
        g.appendChild(lbl);

        pinsG.insertBefore(g, pinsG.firstChild);
      });

      if (loadingEl) loadingEl.style.display = 'none';
      if (hintEl) {
        hintEl.style.opacity = '1';
        setTimeout(function () { hintEl.style.opacity = '0'; }, 3000);
      }
    } catch (err) {
      console.error('[CitySelect] map error:', err);
      if (loadingEl) {
        loadingEl.style.display = 'block';
        loadingEl.textContent = 'MAP ERROR -- check console';
      }
    }
  }
}