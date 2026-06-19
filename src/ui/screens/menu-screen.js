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

    const COLORS = ['rgba(80,74,64,0.36)', 'rgba(74,80,70,0.35)', 'rgba(86,72,66,0.35)', 'rgba(70,72,84,0.34)', 'rgba(82,80,66,0.35)', 'rgba(68,78,78,0.34)', 'rgba(78,72,84,0.34)'];

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
          <p><strong>JOB.</strong> You are governor. Survive <strong>12 turns</strong>. Approval hits 0% and you're recalled. How clean your hands stay is up to you.</p>

          <p><strong>EACH TURN.</strong> You face a strict sequence of events each day.</p>
          <ol>
            <li><strong>The Morning Paper:</strong> Read yesterday's fallout and see who's talking to the press.</li>
            <li><strong>The Dispatch:</strong> Face the day's problem. You have <strong>3 hours/day</strong> to spend: take a meeting with a named player, get an advisor's private read, or work the back channel (each costs one hour). Then you must make a decision: SAFE is expensive, BOLD is risky, CHAOS is cheap and unhinged.</li>
            <li><strong>The Black Market:</strong> Off-the-books fixers may offer deals. Buy, sell, or walk away.</li>
            <li><strong>Urban Unrest:</strong> If the city is furious and broke, strikes or riots may break out requiring immediate action.</li>
            <li><strong>Scandals:</strong> Finally, any breaking scandals hit your desk. You must suppress, accept, or manage the story before the day ends.</li>
          </ol>
          <p>Crises hit on turns <strong>4, 8 and 12</strong>; they cannot be ignored.</p>
          <p><strong>ADVISORS.</strong> Each has trust (keep it fed or they check out) and a hidden agenda (at 80, they betray you). They argue their advice in chat, with reasons — based on what <em>they</em> value, and a restless advisor's recommendation may be designed to hurt you. Watch the agenda bar before you trust anyone. Ignore their advice and pay for it, and a smug "I told you so" lands in your messages the next morning — red badge and all.</p>

          <p><strong>BACK CHANNEL.</strong> In any advisor's chat: get closer (all the way to romance — loyal, useful, and one leaked photo from disaster), run a corrupt pact, launder the trail, threaten, leak dirt, or throw someone under the bus. One dirty move per turn, and <strong>every back-channel move is paid from your personal funds</strong> — never the city budget. Lovers and crime partners are <strong>needy</strong>: most turns one wants something, and a long-running, fat scheme can curdle into the partner <strong>blackmailing you</strong> — pay for silence, or call their bluff and watch them run to the investigators.</p>

          <p><strong>SCANDALS.</strong> Suppress them with money, accept the hit, or manage the story with a response. Ignore one and it runs at full force tomorrow. Career-ending scandals offer only a 25% miracle — or resignation. The final report names the scandal that ended you.</p>

          <p><strong>STEP DOWN.</strong> Done with this term? Open your <em>most trusted advisor's</em> chat and choose <strong>Step down from office</strong> — you resign on your own terms, any turn, no scandal required.</p>

          <p><strong>SCRUTINY.</strong> Every scandal and every scheme raises the press's attention: MURMURS &rarr; WATCHED &rarr; INVESTIGATED &rarr; UNDER SIEGE. High scrutiny makes everything leak faster; three turns under siege ends you. Stay clean to cool off — or address the nation, sacrifice a colleague, or pay to make files disappear.</p>

          <p><strong>BLACK MARKET.</strong> Some nights after your decision, dealers knock: bought approval, wiretaps, fixers, militia payoffs, or cash for pieces of your city. Every deal works. Every deal raises scrutiny. Every deal can go wrong at the printed odds.</p>

          <p><strong>MONEY.</strong> Taxes scale with approval. Deficits bleed approval every turn, and a broke, hated city riots. Contracts and emergency powers are your lifelines. The city budget is <em>public</em> money — what you govern with.</p>
          <p><strong>PERSONAL FUNDS.</strong> You also keep an <em>off-books wallet</em>. It starts at 30% of the city's opening treasury (your first paycheck), and a salary — 4% of the city budget, at least 1M — lands on turns 3, 5, 7, 9 and 11. This wallet pays for every dirty move, and corrupt skims flow straight into it. The bridge runs both ways: from your sidebar you can <strong>donate</strong> personal money back into the city treasury for <strong>+1% approval</strong> and a flattering front page tomorrow. Every coin you pocket — or burn on a leak — is a coin that can't save the city later.</p>
          <p><strong>CORRUPT PACTS.</strong> A pact with a trusted advisor skims money into your wallet every turn while reading as loyalty. The paper trail <em>never resets</em>, so discovery odds climb the longer it runs and the eventual scandal scales from minor to career-ending. You can run <strong>several pacts at once</strong> for compounding income — and compounding risk. <strong>Launder the trail</strong> (30M) rolls the discovery clock back and cools scrutiny.</p>
          <p><strong>RAIDS.</strong> Corruption has no separate meter — running schemes push your <strong>SCRUTINY</strong> up like everything else. Once the press is <strong>INVESTIGATING</strong> or you're <strong>UNDER SIEGE</strong>, investigators can <strong>raid</strong>: every active pact blown open at once, half your slush seized. The more schemes you run, the faster the heat climbs and the bigger the blast. Launder, wind schemes down, or lie low to cool off.</p>

          <p><strong>25 CITIES</strong>, five difficulty tiers — from stable and well-funded to war zones where the city is on fire before you arrive. Each has its own advisors, scandals, and voice.</p>

          <p><strong>YOUR NAME.</strong> The name you choose threads through the headlines, your advisors' greetings, the protest placards, and the history books. Prefer the dark? <strong>Settings &rarr; Display &rarr; Theme</strong> switches between light and dark — both built to stay readable in sunlight.</p>

          <p>Finish at <strong>65%+ approval</strong> for the good ending. Finish at all for an honest one. The final report remembers everything — including what happened in the back rooms.</p>
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
          <p><strong>GOVERNED</strong> — A Governance Simulator</p>
          <p>Game Design &amp; Direction: Hunt</p>
          <p>Narrative &amp; World Design: Hunt</p>
          <p>Interface Design: Claude Opus 4.8</p>
          <p>Engine Development: Claude Sonnet 4.6, Kimi K2.6</p>
          <p>Development Assistance — AI Systems:</p>
          <ul>
            <li>Claude Fable 5, Claude Opus 4.8, Claude Opus 4.7, Claude Sonnet 4.6 (Anthropic)</li>
            <li>Gemini 3.1 Pro, Gemini 3.5 Flash (Google)</li>
            <li>GPT-5.5 (OpenAI)</li>
            <li>DeepSeek-V3 (DeepSeek)</li>
            <li>Kimi K2.6 (Moonshot AI)</li>
            <li>Qwen 3.7 Pro, Qwen 3.6 27B (Alibaba Cloud)</li>
          </ul>
          <p>Built with Vite and vanilla JavaScript.</p>
          <p>&copy; 2026 Hunt. All rights reserved.</p>
        </div>
        <button class="modal-close" id="modal-close">CLOSE</button>
      </div>`;
    container.querySelector('.menu-screen')?.appendChild(overlay);
    container.querySelector('#modal-close')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }
}
