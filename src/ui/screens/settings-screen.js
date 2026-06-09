// src/ui/screens/settings-screen.js
// Full tabbed settings UI using st-* CSS classes

export class SettingsScreen {
  static render(state) {
    const s = state.settings ?? {};
    const sound       = s.sound       ?? false;
    const feedSpeed   = s.feedSpeed   ?? 'normal';
    const scandalFreq = s.scandalFreq ?? 'normal';
    const language    = s.language    ?? 'english';

    // Helper: toggle button HTML
    const toggle = (id, on) =>
      `<button class="st-speed-btn ${on ? 'active' : ''}" id="${id}">${on ? 'ENABLED' : 'DISABLED'}</button>`;

    // Helper: speed group
    const speedGroup = (name, values, current) =>
      `<div class="st-speed-btns">${values.map(v =>
        `<button class="st-speed-btn ${current === v ? 'active' : ''}" data-setting="${name}" data-value="${v}">${v.toUpperCase()}</button>`
      ).join('')}</div>`;

    // Stats helpers
    const crisisCount   = state.resolvedCrises?.length ?? 0;
    const scandalCount  = state.resolvedScandals?.length ?? 0;
    const betrayedCount = state.advisors?.filter(a => a.betrayed).length ?? 0;
    const loyalCount    = state.advisors?.filter(a => !a.betrayed).length ?? 0;

    return `
      <div class="st-screen">
        <div class="st-topbar">
          <button class="st-back" id="btn-settings-back">&#x2190; BACK</button>
          <span class="st-title">SETTINGS</span>
        </div>

        <div class="st-body">

          <!-- Sidenav -->
          <div class="st-sidenav">
            <div class="st-nav-section">PREFERENCES</div>
            <div class="st-nav-item active" data-tab="gameplay">Gameplay</div>
            <div class="st-nav-item" data-tab="display">Display</div>
            <div class="st-nav-item" data-tab="audio">Audio</div>
            <div class="st-nav-section">SESSION</div>
            <div class="st-nav-item" data-tab="stats">Stats</div>
            <div class="st-nav-item st-nav-danger" data-tab="data">Data</div>
          </div>

          <!-- Content -->
          <div class="st-content">

            <!-- GAMEPLAY -->
            <div class="st-section active" id="tab-gameplay">
              <div class="st-s-title">GAMEPLAY</div>

              <div class="st-row">
                <div class="st-row-label">
                  <div class="st-rl-name">Scandal Frequency</div>
                  <div class="st-rl-desc">How often random scandals erupt between crises</div>
                </div>
                <div class="st-row-control">
                  ${speedGroup('scandalFreq', ['low', 'normal', 'high'], scandalFreq)}
                </div>
              </div>

              <div class="st-row">
                <div class="st-row-label">
                  <div class="st-rl-name">Language</div>
                  <div class="st-rl-desc">Interface language -- only English is available now</div>
                </div>
                <div class="st-row-control">
                  <div class="st-speed-btns">
                    <button class="st-speed-btn ${language === 'english' ? 'active' : ''}" data-setting="language" data-value="english">EN</button>
                    <button class="st-speed-btn st-lang-unavail" disabled title="Coming soon">ID</button>
                    <button class="st-speed-btn st-lang-unavail" disabled title="Coming soon">FR</button>
                    <button class="st-speed-btn st-lang-unavail" disabled title="Coming soon">ZH</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- DISPLAY -->
            <div class="st-section" id="tab-display">
              <div class="st-s-title">DISPLAY</div>

              <div class="st-row">
                <div class="st-row-label">
                  <div class="st-rl-name">Public Feed Speed</div>
                  <div class="st-rl-desc">How fast citizen comments scroll in the sidebar</div>
                </div>
                <div class="st-row-control">
                  ${speedGroup('feedSpeed', ['slow', 'normal', 'fast'], feedSpeed)}
                </div>
              </div>
            </div>

            <!-- AUDIO -->
            <div class="st-section" id="tab-audio">
              <div class="st-s-title">AUDIO</div>

              <div class="st-row">
                <div class="st-row-label">
                  <div class="st-rl-name">Sound Effects</div>
                  <div class="st-rl-desc">Play feedback clicks and crisis alarm hums</div>
                </div>
                <div class="st-row-control">
                  ${toggle('toggle-sound', sound)}
                </div>
              </div>
            </div>

            <!-- STATS -->
            <div class="st-section" id="tab-stats">
              <div class="st-s-title">PLAYER STATS</div>

              ${state.city ? `
              <div class="st-stat-grid">
                <div class="st-stat-card">
                  <div class="st-sc-label">CURRENT CITY</div>
                  <div class="st-sc-val" style="font-size: 1rem">${state.city.city_name}</div>
                  <div class="st-sc-sub">Turn ${state.turn} of 12</div>
                </div>
                <div class="st-stat-card">
                  <div class="st-sc-label">APPROVAL</div>
                  <div class="st-sc-val">${state.approval}%</div>
                  <div class="st-sc-sub">Public support</div>
                </div>
                <div class="st-stat-card">
                  <div class="st-sc-label">BUDGET</div>
                  <div class="st-sc-val" style="font-size: 1rem">${state.budget}M</div>
                  <div class="st-sc-sub">${state.budget < 0 ? 'In deficit' : 'Surplus'}</div>
                </div>
                <div class="st-stat-card">
                  <div class="st-sc-label">LOYAL ADVISORS</div>
                  <div class="st-sc-val">${loyalCount}</div>
                  <div class="st-sc-sub">${betrayedCount > 0 ? betrayedCount + ' betrayed' : 'None betrayed'}</div>
                </div>
                <div class="st-stat-card">
                  <div class="st-sc-label">CRISES HANDLED</div>
                  <div class="st-sc-val">${crisisCount}</div>
                  <div class="st-sc-sub">This term</div>
                </div>
                <div class="st-stat-card">
                  <div class="st-sc-label">SCANDALS</div>
                  <div class="st-sc-val">${scandalCount}</div>
                  <div class="st-sc-sub">Resolved this term</div>
                </div>
              </div>` : `<div class="st-rl-desc" style="padding: 0.5rem 0">No active game session.</div>`}
            </div>

            <!-- DATA -->
            <div class="st-section" id="tab-data">
              <div class="st-s-title">SESSION DATA</div>

              <div class="st-row" style="margin-top: 0.5rem">
                <div class="st-row-label">
                  <div class="st-rl-name" style="color:#e05c5c">Reset Save Data</div>
                  <div class="st-rl-desc">Wipe saved game and return to city select. Cannot be undone.</div>
                </div>
                <div class="st-row-control">
                  <button class="st-speed-btn st-warn-btn" id="btn-reset-save">RESET SAVE</button>
                </div>
              </div>
            </div>

          </div>
        </div>

        <div class="st-bottombar">
          <button class="st-cancel-btn" id="btn-settings-back2">CLOSE</button>
        </div>
      </div>`;
  }

  static bind(state, container, handlers, reRenderCallback) {
    // Back buttons
    container.querySelector('#btn-settings-back')?.addEventListener('click', () => handlers.goToMenu());
    container.querySelector('#btn-settings-back2')?.addEventListener('click', () => handlers.goToMenu());

    // Tab switching
    container.querySelectorAll('[data-tab]').forEach(item => {
      item.addEventListener('click', () => {
        container.querySelectorAll('.st-nav-item').forEach(n => n.classList.remove('active'));
        container.querySelectorAll('.st-section').forEach(s => s.classList.remove('active'));
        item.classList.add('active');
        const section = container.querySelector(`#tab-${item.dataset.tab}`);
        if (section) section.classList.add('active');
      });
    });

    // Toggle: sound
    container.querySelector('#toggle-sound')?.addEventListener('click', () => {
      state.settings.sound = !state.settings.sound;
      reRenderCallback();
    });

    // Setting groups (feedSpeed, scandalFreq, language)
    container.querySelectorAll('[data-setting]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.setting;
        const val = btn.dataset.value;
        state.settings[key] = val;
        reRenderCallback();
      });
    });

    // Reset save
    container.querySelector('#btn-reset-save')?.addEventListener('click', () => {
      if (confirm('Reset all saved game data? This cannot be undone.')) {
        localStorage.removeItem('governed_save');
        handlers.goToMenu();
      }
    });
  }
}
