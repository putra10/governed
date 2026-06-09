export class MenuScreen {
  static render(state) {
    return `
      <div class="screen menu-screen">
        <div class="bg-text">GOV</div>
        <div class="menu-feed-layer" id="menu-feed-layer"></div>

        <div class="menu-top">
          <div class="menu-eyebrow">A GOVERNANCE SIMULATOR</div>
          <div class="menu-title">GOVERNED</div>
          <div class="menu-tagline">
            The city is a mess. Your advisors are lying.<br>
            The public is furious. <em>You're in charge now. Good luck.</em>
          </div>
        </div>

        <div class="menu-mid">
          <div class="pill-row">
            <div class="pill pill-red">25 CITIES</div>
            <div class="pill pill-amber">12 TURNS</div>
            <div class="pill pill-green">INFINITE REGRET</div>
          </div>
          <button class="play-btn" id="btn-play">&#9654;&nbsp; PLAY</button>
        </div>

        <div class="menu-bottom">
          <div class="menu-link" id="btn-howto">HOW TO PLAY</div>
          <div class="menu-vline">|</div>
          <div class="menu-link" id="btn-settings">SETTINGS</div>
          <div class="menu-vline">|</div>
          <div class="menu-link" id="btn-credits">CREDITS</div>
        </div>
      </div>`;
  }

  static bind(container, handlers) {
    container.querySelector('#btn-play')?.addEventListener('click', () => {
      handlers.goToCitySelect();
    });
    container.querySelector('#btn-settings')?.addEventListener('click', () => {
      handlers.goToSettings();
    });
    container.querySelector('#btn-howto')?.addEventListener('click', () => {
      this.showHowToPlay(container);
    });
    container.querySelector('#btn-credits')?.addEventListener('click', () => {
      this.showCredits(container);
    });

    this._spawnFeed(container);
  }

  // -- Ambient feed ---------------------------------------------------------

  static _spawnFeed(container) {
    const COMMENTS = [
      // Citizens
      "the governor hasn't responded to a single petition this month",
      "my street flooded again. third time this year.",
      "approval at 34%? how is that even still a job?",
      "they raised taxes while my neighborhood has no water",
      "someone explain why the finance minister bought a yacht",
      "the new road project ran out of budget halfway through",
      "i waited 6 hours at the public hospital today",
      "schools are overcrowded but the budget went to stadiums",
      "my landlord raised rent 40% after the new zoning laws",
      "power cuts every night but the government buildings have generators",
      "the corruption report just disappeared from the news cycle",
      "they keep promising reforms. this is the fourth promise.",
      "the mayor's nephew got the infrastructure contract. shocking.",
      "crime is up but police funding was cut. classic.",
      "three advisors arrested this quarter. new record.",
      "foreign investors are pulling out. can you blame them?",
      "the opposition leaked the budget projections. it's bad.",
      "another scandal. another statement. nothing changes.",
      "i voted for change. i got the same suits with new names.",
      "my pension got cut to fund the emergency relief fund",
      "they built a statue instead of fixing the hospital wing",
      "the press conference lasted 45 minutes and said nothing",
      "governor's approval down 12 points overnight",
      "riot police deployed for the third week in a row",
      "the austerity measures hit the poorest neighborhoods first",
      "we didn't vote for this. none of us voted for this.",
      "the trade deal fell through. 8000 jobs gone.",
      "another emergency session. another closed door.",
      "journalists are being denied press credentials now",
      "the public transport strike enters its 9th day",
      // Media
      "BREAKING: Governor denies involvement in contractor scandal",
      "EXCLUSIVE: Leaked docs show advisor met with lobbyists 14x",
      "REPORT: City budget deficit wider than disclosed",
      "LIVE: Protests outside city hall, crowd growing",
      "UPDATE: Emergency bill fails in committee -- third attempt",
      "ANALYSIS: Approval collapse follows policy reversal",
      "SOURCES: Finance minister considering resignation",
      "DEVELOPING: Military advisor hasn't been seen in 6 days",
      "POLL: 61% believe city is heading in the wrong direction",
      "CONFIRMED: Infrastructure funds rerouted to crisis account",
      "EDITORIAL: When does incompetence become complicity?",
      "FACT CHECK: Governor's claims on crime stats are misleading",
      "OPINION: The city deserves better than managed decline",
      "INTERVIEW: Whistleblower speaks about internal corruption",
      "COLUMN: Three scandals in two weeks. We're numb now.",
      // Politicians / opposition
      "the governor has lost the confidence of his own cabinet",
      "we are calling for an independent inquiry. immediately.",
      "this administration has broken every promise it made",
      "the silence from the governor's office is damning",
      "budget numbers don't lie. the people see through this.",
      "we will not allow this city to be governed into the ground",
      "the emergency powers were meant to be temporary. it's been 8 months.",
      "a vote of no confidence is no longer off the table",
      // Street
      "this city used to work. now it doesn't.",
      "i'm moving my business out if nothing changes by Q3",
      "my kids' school got defunded. i'm not being quiet about it.",
      "nobody tells the truth anymore. not even the opposition.",
      "the advisor who got fired was the only good one",
      "every scandal they survive makes them more arrogant",
      "i don't care about politics. i care about the water pressure.",
      "the last three terms ended in disgrace. this one won't be different.",
      "they cut the arts budget but approved a military parade",
      "the housing crisis was predictable. we predicted it.",
      "all i ask is that the bins get collected once a week",
      "the governor smiled at a charity gala while we flooded",
      "the city is not broken. it is being broken on purpose.",
      "i've filed four complaints. still no response.",
      "whoever is advising the governor needs to be fired yesterday",
    ];

    const layer = container.querySelector('#menu-feed-layer');
    if (!layer) return;

    // Positions spread across screen avoiding center
    const SLOTS = [
      { top: '6%', left: '2%' },
      { top: '11%', right: '3%' },
      { top: '22%', left: '1%' },
      { top: '28%', right: '2%' },
      { top: '38%', left: '3%' },
      { top: '44%', right: '1%' },
      { top: '55%', left: '2%' },
      { top: '60%', right: '3%' },
      { top: '70%', left: '1%' },
      { top: '75%', right: '2%' },
      { top: '83%', left: '3%' },
      { top: '88%', right: '1%' },
    ];

    const COLORS = ['#2a1800', '#1a2a1a', '#2a1a1a', '#1a1a2a', '#2a2a1a', '#1a2020', '#201a2a'];

    // Pick random comments for each slot, render, then cycle them
    const used = new Set();
    const pick = () => {
      let idx;
      do { idx = Math.floor(Math.random() * COMMENTS.length); } while (used.has(idx) && used.size < COMMENTS.length);
      used.add(idx);
      return COMMENTS[idx];
    };

    SLOTS.forEach((pos, i) => {
      const el = document.createElement('div');
      el.className = 'menu-ambient';
      el.textContent = pick();
      Object.assign(el.style, {
        position: 'absolute',
        ...pos,
        color: COLORS[i % COLORS.length],
        fontSize: '0.5rem',
        fontFamily: 'var(--font-mono)',
        letterSpacing: '.05em',
        maxWidth: '13.75rem',
        lineHeight: '1.4',
        pointerEvents: 'none',
        zIndex: '0',
        opacity: '0',
        transition: 'opacity 1.5s ease',
      });
      layer.appendChild(el);

      // Stagger fade-in
      setTimeout(() => { el.style.opacity = '1'; }, i * 300 + Math.random() * 400);

      // Cycle text every 6-10s
      const cycle = () => {
        el.style.opacity = '0';
        setTimeout(() => {
          el.textContent = COMMENTS[Math.floor(Math.random() * COMMENTS.length)];
          el.style.opacity = '1';
        }, 1500);
      };
      setInterval(cycle, 6000 + i * 800 + Math.random() * 4000);
    });
  }

  // -- Modals ---------------------------------------------------------------

  static showHowToPlay(container) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-title">HOW TO PLAY</div>
        <div class="modal-body">
          <p>You are governor. You have <strong>12 turns</strong> to keep the city alive.</p>

          <p><strong>Each turn:</strong> read the dispatch, resolve a policy decision, and manage your advisors. Crises hit on turns 4, 8, and 12 -- respond or pay the price.</p>

          <p><strong>Approval</strong> drops to 0% and your term ends in disgrace. Keep citizens on side, handle scandals quickly, and don't run out of budget.</p>

          <p><strong>Advisors</strong> have hidden agendas. Their trust decays every turn. Ignore their domain too long and they go absent -- or worse, betray you. If one betrays you, a full-screen alert fires and you must acknowledge it before continuing.</p>

          <p><strong>Scandals</strong> erupt randomly. Minor ones can be suppressed (costs budget) or accepted (costs approval). Career-ending scandals are existential -- one wrong move and it's over.</p>

          <p><strong>Bribes</strong> appear when an advisor's agenda is running hot. Pay them off to buy loyalty, or decline and watch them accelerate toward betrayal.</p>

          <p><strong>Difficulty</strong> varies by city: Easy cities are stable and well-funded. Hard and Extreme cities start with low approval, broken budgets, and advisors who are already plotting. War zones are survival mode.</p>

          <p><strong>25 cities</strong> available -- each with unique advisors (3-5 depending on city size), scandals, crises, and cultural voice. Some cities have special income mechanics: Cayman's offshore tax base pays regardless of approval; Gaza runs on international aid.</p>

          <p>End your term with <strong>65%+ approval</strong> to receive an invitation to govern again.</p>
        </div>
        <button class="modal-close" id="modal-close">UNDERSTOOD</button>
      </div>`;
    container.querySelector('.menu-screen')?.appendChild(overlay);
    container.querySelector('#modal-close')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  static showCredits(container) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-title">CREDITS</div>
        <div class="modal-body">
          <p><strong>GOVERNED</strong> — A Relentless Governance Simulator</p>
          <p>Vision &amp; Architecture: Hunt</p>
          <p>Visuals &amp; Interface: Claude Opus 4.8</p>
          <p>Core Engineering: Claude Sonnet 4.6 &amp; Kimi K2.6</p>
          <p>Lore &amp; Narrative: Hunt</p>
          <p>Synthetic Advisors &amp; Neural Collaborators:</p>
          <ul>
            <li>DeepSeek-V3</li>
            <li>Claude Sonnet 4.6</li>
            <li>Claude Opus 4.7</li>
            <li>OpenAI GPT-5.5</li>
            <li>Kimi K2.6</li>
            <li>Gemini 3.1 Pro</li>
            <li>Gemini 3.5 Flash</li>
          </ul>
          <p>Forged with Vite + Vanilla JavaScript</p>
        </div>
        <button class="modal-close" id="modal-close">CLOSE</button>
      </div>`;
    container.querySelector('.menu-screen')?.appendChild(overlay);
    container.querySelector('#modal-close')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }
}
