import { renderTopBar } from '../components/top-bar.js';
import { govRaw, govLast } from '../../utils/governor.js';
import { pickClosingRemark } from '../../utils/closing-remark.js';
import { pickLegacy, pickClipping } from '../../utils/report-content.js';
import { typeText } from '../../utils/typewriter.js';
import { getGenericProblemById } from '../../engine/generic-problems.js';

const LVL = { red: 'var(--color-red)', reddim: 'var(--color-red-dim)', amber: 'var(--color-amber)', green: 'var(--color-green)', dim: 'var(--color-text-muted)' };

// The same context line the scandal popup showed the player (by source).
const SCANDAL_SOURCE = {
  threat_backfire: 'Your threat backfired \u2014 they went to the press.',
  leak: 'Your leak splashed back on the office.',
  corrupt_pact: 'The corruption scheme was discovered.',
  romance: 'The affair went public.',
  auto_fired: 'You left the story unanswered. It ran.',
  ignored_problem: 'You left it on your desk for three weeks.',
  impeachment: 'The hearings have begun.',
  black_market: 'A deal went wrong.',
  oversight_raid: 'Investigators raided your office.',
  funding: 'A funded project drew scrutiny.',
};
function scandalContext(source) {
  if (!source) return 'The story broke overnight.';
  if (String(source).startsWith('bribe_')) return 'The back-channel payment leaked.';
  return SCANDAL_SOURCE[source] || 'Fallout from your decision.';
}

// The fullest 'what happened' for a scandal: an authored description if it has
// one; otherwise, for a decision-caused scandal, name the problem AND the option
// the player picked; otherwise the generic context line.
function scandalStory(sc, state) {
  if (sc.description) return sc.description;
  const prob = getGenericProblemById(sc.sourceId, state.city);
  if (prob) {
    const pd = (state.pastDecisions ?? []).find(p => p.decisionId === sc.sourceId);
    const opt = (pd && prob.options) ? prob.options[pd.optionIndex] : null;
    const choice = (opt && opt.label) ? ` \u2014 you chose &ldquo;${opt.label}&rdquo;` : '';
    return `Fallout from &ldquo;${prob.title}&rdquo;${choice}.`;
  }
  return scandalContext(sc.sourceId);
}

// One-line news sentence on the governor's history with an advisor.
function relationNews(a) {
  const n = a.name;
  if (a.betrayed && a.sacrificed) return `${n} was thrown to the wolves — and never forgave it.`;
  if (a.betrayed) return `${n} turned on the governor and walked out.`;
  if (a.sacrificed) return `${n} was sacrificed to the press to save the administration.`;
  if (a.relationshipType === 'romantic' && a.romanceExposed) return `The governor's affair with ${n} spilled into the open.`;
  if (a.relationshipType === 'romantic') return `The governor and ${n} grew close behind closed doors.`;
  if (a.romanceExposed) return `An old flame with ${n} resurfaced in the headlines.`;
  if ((a.totalSkimmed ?? 0) > 0) return `${n} ran a quiet arrangement with the governor — ${a.totalSkimmed}M skimmed.`;
  if ((a.threatCount ?? 0) > 0) return `${n} was leaned on, hard, more than once.`;
  if (a.leakUsed) return `${n} was smeared in the press on the governor's orders.`;
  if ((a.scorned ?? 0) > 0) return `${n}, a scorned former flame, stayed dangerous.`;
  if (a.relationshipType === 'rivalry') return `${n} and the governor were open rivals to the end.`;
  if ((a.trust ?? 0) >= 60) return `${n} stayed loyal through it all.`;
  return `${n} kept a cool, professional distance.`;
}

export class ReportScreen {
  static render(state) {
    const scandalExit = state.endReason === 'career_ending_scandal';
    const walkedAway  = state.endReason === 'resigned';
    const resigned = scandalExit || walkedAway;
    const recalled = !resigned && (state.endReason === 'recalled' || state.approval <= 0);

    // ── Departmental signal (advisor trust) ──
    const domainDefs = [
      { id: 'finance', name: 'FINANCE' },
      { id: 'military_liaison', name: 'SECURITY' },
      { id: 'urban_planning', name: 'INFRASTRUCTURE' },
      { id: 'transport', name: 'TRANSPORT' },
    ];
    const dColor = s => s >= 60 ? 'var(--color-green)' : s >= 40 ? 'var(--color-amber)' : 'var(--color-red)';
    // Advisor ids are domain-prefixed (e.g. "finance_Siti", "military_liaison_Budi"),
    // so match by prefix and average the trust of everyone in that department.
    const domains = domainDefs.map(d => {
      const inDomain = state.advisors.filter(a => a.id === d.id || String(a.id).startsWith(d.id + '_'));
      const score = inDomain.length
        ? Math.round(inDomain.reduce((sum, a) => sum + (a.trust ?? 50), 0) / inDomain.length)
        : 50;
      return { name: d.name, score, col: dColor(score) };
    });

    const loyal = state.advisors.filter(a => !a.betrayed && a.trust >= 60).length;
    const total = state.advisors.length;
    const cityReaction = state.approval >= 60 ? 'Satisfied' : state.approval >= 40 ? 'Skeptical' : 'Outraged';
    const cityCol = dColor(state.approval);

    // ── Outcome ──
    let outcomeTitle, outcomeDesc, primaryCls = '';
    const unresolved = (state.presentedDecisions ?? []).filter(id => !state.pastDecisions.some(p => p.decisionId === id)).length;
    if (walkedAway) {
      outcomeTitle = 'RESIGNED';
      outcomeDesc = `You walked away on your own terms at turn ${state.turn}. The city shrugs and moves on.`;
    } else if (scandalExit) {
      const gambled = state.flags?.miracle_failed;
      const scName = state.endScandal?.title ? `"${state.endScandal.title}"` : 'a career-ending scandal';
      outcomeTitle = gambled ? 'THE LAST STAND FAILED' : 'RESIGNED IN DISGRACE';
      outcomeDesc = gambled
        ? `You gambled 150M on a desperate last stand over ${scName} — and lost.`
        : `${scName} forced you to resign before the end of your term.`;
    } else if (recalled) {
      outcomeTitle = 'RECALLED';
      outcomeDesc = 'Public confidence collapsed. Your term ended early.';
    } else if (state.approval >= 65 && unresolved <= 1) {
      outcomeTitle = 'INVITATION RECEIVED';
      outcomeDesc = `Your ${state.approval}% approval earned recognition. A senior position awaits.`;
      primaryCls = 'primary';
    } else if (state.approval >= 65) {
      outcomeTitle = 'NO INVITATION — UNFINISHED BUSINESS';
      outcomeDesc = `Your ${state.approval}% impressed. The stack of unanswered problems on your desk did not.`;
    } else {
      outcomeTitle = 'NO INVITATION';
      outcomeDesc = `Your ${state.approval}% approval was noted but not rewarded. The city moves on.`;
    }
    const invitation = outcomeTitle === 'INVITATION RECEIVED';

    // ── Stamp + classification ──
    let stampWord, tone, classification;
    if (invitation) { stampWord = 'PROMOTED'; tone = 'green'; classification = 'ASSET'; }
    else if (recalled) { stampWord = 'RECALLED'; tone = 'red'; classification = 'DEVIANT'; }
    else if (scandalExit) { stampWord = 'DISGRACED'; tone = 'red'; classification = 'DEVIANT'; }
    else if (walkedAway) { stampWord = 'RESIGNED'; tone = 'amber'; classification = 'IRRELEVANT'; }
    else { stampWord = 'NO INVITATION'; tone = 'amber'; classification = 'IRRELEVANT'; }

    // ── Identity / file ──
    const CITY = (state.city?.city_name ?? 'THE CITY').toUpperCase();
    const NAME = govRaw(state) ? govLast(state).toUpperCase() : 'THE GOVERNOR';
    const weeks = state.turn * 6;
    const fileNo = (((state.city?.city_id ?? state.city?.city_name ?? 'CTY') + '').replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase() || 'CTY') + '-' + state.turn;
    const crisesStr = `${state.pastCrises.length}/${Math.min(3, state.city?.crises?.length ?? 3)}`;
    const subject = govRaw(state) ? `The ${govLast(state)} Administration` : `Final Report — ${state.city?.city_name ?? 'City'}`;
    const remark = pickClosingRemark(state);

    // ── Legacy ──
    const legacy = pickLegacy(state);

    // ── Press clipping ──
    const clip = pickClipping(state);

    // ── Associated persons (watchlist) ──
    const watchHTML = state.advisors.map(a => {
      let level = 'dim', tag = 'Neutral';
      if (a.betrayed) { level = 'red'; tag = 'Betrayed you'; }
      else if (a.sacrificed) { level = 'red'; tag = 'Sacrificed'; }
      else if (a.relationshipType === 'romantic') { level = 'amber'; tag = a.romanceExposed ? 'Lover · exposed' : 'Secret lover'; }
      else if (a.romanceExposed) { level = 'amber'; tag = 'Affair exposed'; }
      else if ((a.totalSkimmed ?? 0) > 0) { level = 'amber'; tag = `Pact · ${a.totalSkimmed}M`; }
      else if ((a.threatCount ?? 0) > 0) { level = 'reddim'; tag = `Coerced ×${a.threatCount}`; }
      else if (a.leakUsed) { level = 'reddim'; tag = 'Smeared in press'; }
      else if ((a.scorned ?? 0) > 0) { level = 'amber'; tag = 'Scorned ex-lover'; }
      else if (a.relationshipType === 'rivalry') { level = 'amber'; tag = 'Open rivalry'; }
      else if ((a.trust ?? 0) >= 60) { level = 'green'; tag = 'Held loyal'; }
      return `<div class="dsr-wrow"><span class="wdot" style="background:${LVL[level]}"></span><span class="wwho">${a.name}</span><span class="wtag">${tag}</span></div>`;
    }).join('');

    // ── Findings / anomalies ──
    const dd = state.dirtyDeeds ?? {};
    const anomalies = [];
    if ((dd.skimmed ?? 0) > 0) anomalies.push(`{R:${dd.skimmed}M} diverted from the treasury — funds unaccounted`);
    if ((dd.threats ?? 0) > 0) anomalies.push(`${dd.threats} subject(s) coerced into compliance`);
    if ((dd.leaks ?? 0) > 0) anomalies.push(`${dd.leaks} press operation(s) run from your office`);
    if ((dd.marketBuys ?? 0) > 0) anomalies.push(`${dd.marketBuys} transaction(s) with parties this office cannot name`);
    if ((dd.exposed ?? 0) > 0) anomalies.push(`${dd.exposed} scheme(s) exposed`);
    const dirty = anomalies.length > 0;
    const findingsHTML = dirty
      ? anomalies.map(a => `<div class="dsr-finding">${a.replace(/\{R:([^}]+)\}/, '<span class="dsr-redact" data-secret="$1">&#9608;&#9608;&#9608;&#9608;</span>')}.</div>`).join('')
      : `<div class="dsr-finding clean">No misappropriation. No coercion. No undisclosed dealings. The audit returned nothing — because there was nothing.</div>`;
    const scandalHTML = state.endScandal ? `
      <div class="dsr-scandal">
        <div class="ssl">${scandalExit ? 'WHY YOU RESIGNED' : recalled ? 'WHAT BROUGHT YOU DOWN' : 'THE STORY THAT BROKE'} &middot; ${String(state.endScandal.tier || 'major').replace('_', ' ').toUpperCase()} SCANDAL</div>
        <div class="sst"><strong>${state.endScandal.title}</strong>${state.endScandal.description ? ` — ${state.endScandal.description}` : ''}</div>
      </div>` : '';

    const shareText = `${subject} — ${stampWord} · ${state.approval}% · ${state.city?.city_name ?? ''} · Relevance: ${classification}. GOVERNED — putra10.github.io/governed`;

    // ── Verdict overlay payload ──
    const verdict = walkedAway ? 'RESIGNED' : scandalExit ? 'RESIGNED IN DISGRACE' : recalled ? 'RECALLED' : 'TERM COMPLETE';
    const adminLine = govRaw(state) ? `THE ${govLast(state).toUpperCase()} ADMINISTRATION` : 'FINAL ASSESSMENT';
    const govUpper = (govRaw(state) || 'Acting Governor').toUpperCase();

    // Every scandal that reached print this term — as newspaper briefs inside the Ledger.
    const SS_TIER = { minor: 'Minor', moderate: 'Moderate', major: 'Major', career_ending: 'Career-ending' };
    const scandalSheet = (state.activeScandals ?? [])
      .slice()
      .sort((a, b) => (a.sourceTurn ?? 0) - (b.sourceTurn ?? 0))
      .map(sc => {
        const t = sc.severity_tier ?? 'minor';
        const wk = (sc.sourceTurn ?? 0) * 6;
        const story = scandalStory(sc, state);
        return `<div class="clip-brief ${t}"><div class="cb-hl">${sc.title ?? 'Unnamed scandal'}</div><div class="cb-body">${story}</div><div class="cb-dl">Week ${wk || '\u2014'} &middot; ${SS_TIER[t] ?? t} scandal</div></div>`;
      }).join('');

    // ── Share-card payload (computed once; the share button picks the active tab) ──
    const RANK_SC = { minor: 1, moderate: 2, major: 3, career_ending: 4 };
    const topScandals = (state.activeScandals ?? [])
      .slice()
      .sort((a, b) => (RANK_SC[b.severity_tier] ?? 0) - (RANK_SC[a.severity_tier] ?? 0))
      .slice(0, 3)
      .map(sc => ({ title: sc.title ?? 'Unnamed scandal', story: scandalStory(sc, state), tier: sc.severity_tier ?? 'minor' }));
    const relations = state.advisors.map(relationNews).filter(Boolean);
    const findingsLines = dirty
      ? anomalies.map(a => a.replace(/\{R:([^}]+)\}/, '$1') + '.')
      : ['No misappropriation. No coercion. No undisclosed dealings. The audit found nothing.'];
    const _bh = state.budgetHistory ?? [];
    let highestBudget = state.startBudget ?? state.budget, biggestDrop = 0, biggestDropWk = null, totalSpend = 0, spendTurns = 0;
    for (let i = 0; i < _bh.length; i++) {
      highestBudget = Math.max(highestBudget, _bh[i].budget);
      if (i > 0) { const dlt = _bh[i].budget - _bh[i - 1].budget; if (dlt < 0) { totalSpend += -dlt; spendTurns++; if (-dlt > biggestDrop) { biggestDrop = -dlt; biggestDropWk = _bh[i].turn * 6; } } }
    }
    const _startA = state.startApproval ?? state.approval, _startB = state.startBudget ?? state.budget;
    const _pct = (cur, st) => st ? Math.round(((cur - st) / Math.abs(st)) * 100) : 0;
    const payload = {
      city: CITY, name: subject, weeks, tone, stamp: stampWord, cls: classification,
      approval: state.approval, startApproval: _startA, apprPct: _pct(state.approval, _startA),
      budget: state.budget, startBudget: _startB, budgPct: _pct(state.budget, _startB),
      outcomeTitle, outcomeDesc, remark,
      avgSpend: spendTurns ? Math.round(totalSpend / spendTurns) : 0,
      highestBudget, biggestDrop, biggestDropWk,
      scandals: topScandals, relations, findings: findingsLines,
    };

    // Scandal popup gating: only when a scandal actually ended the term.
    const scandalEnded = !!state.endScandal && (recalled || scandalExit);

    return `
      <div class="screen sv-report">
        ${scandalEnded ? `
        <div class="sv-scandal-alert" id="sv-scandal-alert">
          <div class="ssa-box">
            <div class="ssa-label">&#9888; SCANDAL BREAKS</div>
            <div class="ssa-tier ${tone}">${String(state.endScandal.tier || 'major').replace('_', ' ').toUpperCase()} SCANDAL</div>
            <div class="ssa-title">${state.endScandal.title}</div>
            <div class="ssa-sub">This is what ended your term.</div>
            <button class="ssa-ok" id="sv-scandal-ok">CONTINUE &#9656;</button>
          </div>
        </div>` : ''}
        <div class="sv-verdict sv2" id="sv-verdict" data-verdict="${verdict}" data-admin="${adminLine}"
             data-name="${govUpper}" data-comment="${remark.replace(/"/g, '&quot;')}">
          <div class="sv2-stage">
            <div class="sv2-box" id="rvbox">
              <div class="sv2-box-t" id="rvtitle">GOVERNED &middot; CIVIC OVERSIGHT</div>
              <div class="sv2-box-b" id="rvbody">ASSESSMENT COMPLETE</div>
              <div class="sv2-box-f"></div>
            </div>
            <div class="sv2-text hidden" id="rvtext"></div>
            <div class="sv2-line hidden" id="rvline"></div>
            <div class="sv2-arrow hidden" id="rvarrow"></div>
            <button class="sv2-cta hidden" id="rvcta">VIEW FINAL REPORT &#9656;</button>
          </div>
          <div class="sv-verdict-skip" id="rvskip">SKIP &#9656;</div>
        </div>
        ${renderTopBar(state, { report: true })}
        <div class="report-screen">
          <div class="dsr" data-share="${shareText.replace(/"/g, '&quot;')}" data-card="${JSON.stringify({ name: subject, stamp: stampWord, cls: classification, approval: state.approval, city: state.city?.city_name ?? '', weeks, fileno: fileNo, tone, loyal, total }).replace(/"/g, '&quot;')}" data-payload="${JSON.stringify(payload).replace(/"/g, '&quot;')}">

            <div class="dsr-tabs">
              <button class="dsr-tab active" data-tab="verdict">VERDICT</button>
              <button class="dsr-tab" data-tab="record">RECORD</button>
              <button class="dsr-tab" data-tab="persons">ASSOCIATES</button>
              <button class="dsr-tab" data-tab="findings">FINDINGS</button>
            </div>

            <div class="dsr-file">
              <div class="dsr-stamp ${tone}" id="dsr-stamp">${stampWord}</div>
              <div class="dsr-letterhead">
                <div><div class="dsr-org">Office of Civic Oversight</div><div class="dsr-sub">Post-Term Assessment</div></div>
                <div class="dsr-fileno">FILE ${fileNo}<br>RELEVANCE: <span class="dsr-cls ${tone}">${classification}</span><br>${weeks} WEEKS</div>
              </div>
              <div class="dsr-row"><span class="k">Subject</span><span class="v"><b>${subject}</b></span></div>
              <div class="dsr-row"><span class="k">Standing</span><span class="v"><b>${state.approval}%</b> approval &middot; <b>${crisesStr}</b> crises &middot; loyalty <b>${loyal}/${total}</b></span></div>

              <!-- VERDICT -->
              <div class="dsr-panel active" data-panel="verdict">
                <div class="dsr-ph">Determination</div>
                <div class="dsr-verdict-strip"><strong>${outcomeTitle}.</strong> ${outcomeDesc}</div>
                <div class="dsr-grid2">
                  <div class="dsr-mini"><span class="ml">City reaction</span><span class="mv" style="color:${cityCol}">${cityReaction}</span></div>
                  <div class="dsr-mini"><span class="ml">Relevance index</span><span class="mv big" style="color:${LVL[tone]}">${state.approval}</span></div>
                </div>
                <div class="dsr-ph">Legacy</div>
                <div class="dsr-legacy">${legacy}</div>
              </div>

              <!-- PUBLIC RECORD -->
              <div class="dsr-panel" data-panel="record">
                <div class="dsr-ph">Public Record</div>
                <div class="dsr-clip">
                  <div class="clip-mast">THE ${CITY} LEDGER</div>
                  <div class="clip-dl"><span>Final Edition</span><span>Price: Your Reputation</span></div>
                  <div class="clip-hl">${clip.headline}</div>
                  <div class="clip-deck">${clip.deck}</div>
                  <div class="clip-pull">&ldquo;${clip.pull}&rdquo;</div>
                  ${scandalSheet
                    ? `<div class="clip-sub">Also in this edition</div><div class="clip-briefs">${scandalSheet}</div>`
                    : `<div class="clip-sub clean">A quiet term &mdash; nothing else made the front page.</div>`}
                </div>
              </div>

              <!-- ASSOCIATED PERSONS -->
              <div class="dsr-panel" data-panel="persons">
                <div class="dsr-ph">Signal Analysis &middot; Departmental</div>
                <div class="dsr-sig">
                  ${domains.map(d => `<div class="sig-row"><span class="sig-n">${d.name}</span><span class="sig-bar"><i data-w="${d.score}" style="background:${d.col}"></i></span><span class="sig-pc" style="color:${d.col}">${d.score}</span></div>`).join('')}
                </div>
                <div class="dsr-ph">Associated Persons &middot; Watchlist</div>
                <div class="dsr-watch">${watchHTML}</div>
              </div>

              <!-- FINDINGS -->
              <div class="dsr-panel" data-panel="findings">
                <div class="dsr-ph">Findings on Conduct</div>
                <div class="dsr-anom-h">${dirty ? `&#9888; Anomalies Detected — ${anomalies.length}` : '&#10003; Clean Hands'}</div>
                ${findingsHTML}
                ${scandalHTML}
              </div>

            </div>

            <div class="dsr-actions">
              <button class="dsr-btn ${primaryCls}" id="btn-restart">Main Menu</button>
              <button class="dsr-btn share" id="dsr-share">Declassify &amp; Share</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  static bind(container) {
    container.querySelector('#btn-restart')?.addEventListener('click', () => window.location.reload());

    let toastEl = null, toastT = null;
    const toast = (msg) => {
      if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.className = 'dsr-toast';
        (container.querySelector('.screen') || container).appendChild(toastEl);
      }
      toastEl.textContent = msg;
      toastEl.classList.add('show');
      clearTimeout(toastT);
      toastT = setTimeout(() => toastEl.classList.remove('show'), 1800);
    };

    // Tab switching
    const fillBars = () => requestAnimationFrame(() => container.querySelectorAll('.dsr-sig i').forEach(i => { i.style.width = (i.dataset.w || 0) + '%'; }));
    container.querySelectorAll('.dsr-tab').forEach(t => t.addEventListener('click', () => {
      const tab = t.dataset.tab;
      container.querySelectorAll('.dsr-tab').forEach(x => x.classList.toggle('active', x === t));
      container.querySelectorAll('.dsr-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab));
      if (tab === 'persons') fillBars();
    }));

    // Click-to-declassify
    container.querySelectorAll('.dsr-redact').forEach(r => r.addEventListener('click', () => {
      if (r.classList.contains('open')) return;
      r.classList.add('open');
      r.textContent = r.dataset.secret;
    }));

    // Share — render a portrait card (1080x1350, IG-friendly) to a PNG, then
    // open the native share sheet on mobile or download the file on desktop.
    container.querySelector('#dsr-share')?.addEventListener('click', async (e) => {
      const dsr = container.querySelector('.dsr');
      const txt = dsr?.dataset.share || 'GOVERNED';
      let payload = {};
      try { payload = JSON.parse(dsr?.dataset.payload || '{}'); } catch { /* ignore */ }
      const tab = container.querySelector('.dsr-tab.active')?.dataset.tab || 'verdict';
      const btn = e.currentTarget;
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = 'Rendering…';
      try {
        const blob = await ReportScreen._makeNewsCard(tab, payload);
        const file = new File([blob], 'governed-dossier.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: txt });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'governed-dossier.png';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          toast('Image saved — upload it anywhere');
        }
      } catch (err) {
        if (err && err.name === 'AbortError') { /* user cancelled */ }
        else if (navigator.clipboard) { navigator.clipboard.writeText(txt).then(() => toast('Copied text instead')).catch(() => toast('Share failed')); }
        else toast('Share failed');
      } finally {
        btn.disabled = false; btn.textContent = prev;
      }
    });

    const dropStamp = () => container.querySelector('.dsr')?.classList.add('stamped');

    // Verdict reveal overlay
    const ov = container.querySelector('#sv-verdict');
    if (!ov) { dropStamp(); return; }
    const $ = id => container.querySelector(id);
    const box = $('#rvbox'), title = $('#rvtitle'), body = $('#rvbody'),
          text = $('#rvtext'), line = $('#rvline'), arrow = $('#rvarrow'), cta = $('#rvcta');
    const d = ov.dataset;
    const timers = [];
    let stopTyping = null, dismissed = false;
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const done = () => {
      if (dismissed) return;
      dismissed = true;
      timers.forEach(clearTimeout);
      if (stopTyping) stopTyping();
      ov.style.opacity = '0';
      setTimeout(() => ov.remove(), 800);
      dropStamp();
    };
    cta?.addEventListener('click', e => { e.stopPropagation(); done(); });
    container.querySelector('#rvskip')?.addEventListener('click', e => { e.stopPropagation(); done(); });
    ov.addEventListener('click', done);

    const startVerdict = () => {
      at(1200, () => { body.innerHTML = 'COMPILING FINAL REPORT'; });
      at(2400, () => { title.innerHTML = d.admin; body.innerHTML = 'ASSESSMENT RENDERED'; });
      at(3600, () => {
        box.classList.add('hidden');
        text.classList.remove('hidden');
        line.classList.remove('hidden');
        arrow.classList.remove('hidden');
        stopTyping = typeText(text, d.verdict, { speed: 70 });
      });
      at(5600, () => {
        text.classList.add('sv2-remark');
        stopTyping = typeText(text, d.comment, { speed: 24, done: () => { cta.classList.remove('hidden'); } });
        container.querySelector('#rvskip')?.classList.add('hidden');
      });
    };

    // A scandal that ended the term gets its own popup first — the Samaritan
    // reveal waits behind it until the player acknowledges.
    const scandalAlert = container.querySelector('#sv-scandal-alert');
    if (scandalAlert) {
      container.querySelector('#sv-scandal-ok')?.addEventListener('click', () => {
        scandalAlert.style.opacity = '0';
        setTimeout(() => scandalAlert.remove(), 350);
        startVerdict();
      });
    } else {
      startVerdict();
    }
  }

  // Builds a 9:16 (1080x1920) two-column newspaper share card for the active tab.
  static async _makeNewsCard(tab, d) {
    const W = 1080, H = 1920;
    const PAPER = '#efe9d9', INK = '#2b2519', MUTE = '#6f6451', RULE = '#b8ad90', RED = '#7a1f12', GREEN = '#3b6d11';
    const SERIF = "'IBM Plex Serif', serif", MONO = "'IBM Plex Mono', monospace";
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch { /* ignore */ }
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'); c.textBaseline = 'alphabetic';
    const PAD = 76, RIGHT = W - PAD, MAXW = W - PAD * 2;
    const GAP = 46, COLW = (MAXW - GAP) / 2, COLX = [PAD, PAD + COLW + GAP];

    c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
    c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(26, 26, W - 52, H - 52);

    const ent = (t) => String(t ?? '').replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”').replace(/&mdash;/g, '—').replace(/&middot;/g, '·').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    const center = (txt, y, font, color) => { c.font = font; c.fillStyle = color; c.textAlign = 'center'; c.fillText(ent(txt), W / 2, y); c.textAlign = 'left'; };
    const hrule = (y, w, x0 = PAD, x1 = RIGHT) => { c.strokeStyle = RULE; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); };
    const wrapH = (txt, x, y, maxW, lh, font, color, draw, align) => {
      c.font = font; const words = ent(txt).split(' '); let ln = '', cy = y, lines = 0;
      const ax = align === 'center' ? (x + maxW / 2) : x;
      if (draw) { c.fillStyle = color; c.textAlign = align || 'left'; }
      for (const w of words) { const t = ln ? ln + ' ' + w : w; if (c.measureText(t).width > maxW && ln) { if (draw) c.fillText(ln, ax, cy); ln = w; cy += lh; lines++; } else ln = t; }
      if (ln) { if (draw) c.fillText(ln, ax, cy); cy += lh; lines++; }
      if (draw) c.textAlign = 'left';
      return lines * lh;
    };

    // ── Header ──
    center('GOVERNED · CIVIC OVERSIGHT DISPATCH', 108, `700 22px ${MONO}`, MUTE);
    center(`THE ${d.city || 'CITY'} LEDGER`, 186, `700 60px ${SERIF}`, INK);
    hrule(212, 4); hrule(220, 2);
    c.font = `700 20px ${MONO}`; c.fillStyle = MUTE; c.textAlign = 'left'; c.fillText('FINAL EDITION', PAD, 254);
    c.textAlign = 'right'; c.fillText(`${d.weeks || 0} WEEKS IN OFFICE`, RIGHT, 254); c.textAlign = 'left';
    hrule(274, 1);
    const SECTION = { verdict: 'THE VERDICT', record: 'THE SCANDAL FILE', persons: 'THE CABINET', findings: 'THE BOOKS' };
    center(SECTION[tab] || 'SPECIAL REPORT', 326, `700 24px ${MONO}`, RED);

    // ── Column block builders (width = COLW) ──
    const bPara = (txt, font = `400 26px ${SERIF}`, lh = 35, color = INK, gap = 16) => (x, y, draw) => wrapH(txt, x, y, COLW, lh, font, color, draw) + gap;
    const bLead = (txt) => bPara(txt, `400 29px ${SERIF}`, 39, INK, 22);
    const bSub = (txt) => (x, y, draw) => { if (draw) { c.font = `700 18px ${MONO}`; c.fillStyle = RED; c.textAlign = 'left'; c.fillText(ent(txt), x, y); } return 34; };
    const bStat = (label, val, color = INK) => (x, y, draw) => { if (draw) { c.font = `700 16px ${MONO}`; c.fillStyle = MUTE; c.fillText(label, x, y); c.font = `700 36px ${SERIF}`; c.fillStyle = color; c.fillText(ent(val), x, y + 38); } return 70; };
    const compose = (...fns) => (x, y, draw) => { let yy = y; for (const fn of fns) yy += fn(x, yy, draw); return yy - y; };

    let headline, deck; const blocks = [];
    const tierC = (t) => (t === 'major' || t === 'career_ending') ? RED : INK;

    if (tab === 'record') {
      const n = (d.scandals || []).length;
      headline = n ? `${n} Scandal${n === 1 ? '' : 's'} on the Record` : 'A Clean Record';
      deck = 'The permanent public record, filed by Civic Oversight.';
      blocks.push(bLead(n ? `${n === 1 ? 'One story' : 'These stories'} defined how the ${d.weeks}-week term will be remembered.` : `${d.weeks} weeks, and not one scandal reached print.`));
      (d.scandals || []).forEach(sc => blocks.push(compose(
        bSub(String(sc.tier || 'minor').replace('_', '-').toUpperCase() + ' SCANDAL'),
        bPara(sc.title, `700 31px ${SERIF}`, 38, tierC(sc.tier), 6),
        bPara(sc.story, `400 25px ${SERIF}`, 34, INK, 26))));
      if (!n) blocks.push(bPara('The auditors went home early. A rare, quiet administration.'));
      blocks.push(bPara(`The books close with public approval at ${d.approval}%.`, `italic 400 25px ${SERIF}`, 34, MUTE, 0));
    } else if (tab === 'persons') {
      headline = 'Inside the Cabinet';
      deck = `${(d.relations || []).length} figures shaped the term — some loyal, some not.`;
      (d.relations || []).forEach(t => blocks.push(bPara('▪  ' + t, `400 27px ${SERIF}`, 36, INK, 22)));
    } else if (tab === 'findings') {
      headline = 'The Books, Examined';
      deck = 'What the audit turned up — and what the term cost.';
      (d.findings || []).forEach(t => blocks.push(bPara(t, `400 26px ${SERIF}`, 35, INK, 20)));
      blocks.push(compose(bSub('SPENDING'), (x, y, dr) => 8 + 0 * (dr ? 1 : 1)));
      blocks.push(bStat('AVG SPENDING / TURN', `${d.avgSpend || 0}M`));
      blocks.push(bStat('HIGHEST TREASURY', `${d.highestBudget || 0}M`));
      blocks.push(bStat('BIGGEST SINGLE-TURN SPEND', d.biggestDropWk ? `${d.biggestDrop}M · wk ${d.biggestDropWk}` : `${d.biggestDrop || 0}M`));
    } else {
      headline = d.outcomeTitle || 'Term Complete';
      deck = 'Final assessment, Office of Civic Oversight.';
      blocks.push(bLead(d.outcomeDesc || ''));
      blocks.push(compose(
        bStat('PUBLIC APPROVAL', `${d.startApproval}% → ${d.approval}%`, d.apprPct >= 0 ? GREEN : RED),
        bPara(`A ${d.apprPct >= 0 ? '+' : ''}${d.apprPct}% swing in public support across ${d.weeks} weeks in office.`, `400 25px ${SERIF}`, 34, INK, 22)));
      blocks.push(compose(
        bStat('CITY TREASURY', `${d.startBudget}M → ${d.budget}M`, d.budgPct >= 0 ? GREEN : RED),
        bPara(`The treasury ${d.budgPct >= 0 ? 'grew' : 'shrank'} ${Math.abs(d.budgPct)}% from the day you took office.`, `400 25px ${SERIF}`, 34, INK, 22)));
    }

    // ── Headline + deck (full width, upper third) ──
    let hy = 404 + wrapH(headline, PAD, 404, MAXW, 62, `700 54px ${SERIF}`, INK, true, 'center');
    hy += 8;
    hy += wrapH(deck, PAD, hy, MAXW, 40, `italic 400 30px ${SERIF}`, MUTE, true, 'center');
    hy += 24; hrule(hy, 2);
    const colTop = hy + 48;

    // ── Two balanced columns (split near the height midpoint) ──
    const quoteTop = d.remark ? 1512 : 1660;
    const colBottom = quoteTop - 40;
    const availH = colBottom - colTop;
    const heights = blocks.map(b => b(0, 0, false));
    const total = heights.reduce((a, b) => a + b, 0);
    let acc = 0, split = blocks.length;
    for (let i = 0; i < blocks.length; i++) { acc += heights[i]; if (acc >= total / 2) { split = i + 1; break; } }
    const leftIdx = []; for (let i = 0; i < split; i++) leftIdx.push(i);
    const rightIdx = []; for (let i = split; i < blocks.length; i++) rightIdx.push(i);
    // Justify each column vertically: spread its blocks with even padding so the
    // content fills from the top of the body down to the pull-quote (no big void).
    const drawCol = (idxs, x) => {
      if (!idxs.length) return;
      const ch = idxs.reduce((a, i) => a + heights[i], 0);
      const pad = Math.max(16, (availH - ch) / (idxs.length + 1));
      let cy = colTop;
      for (const i of idxs) { cy += pad; blocks[i](x, cy, true); cy += heights[i]; }
    };
    drawCol(leftIdx, COLX[0]);
    drawCol(rightIdx, COLX[1]);
    c.strokeStyle = RULE; c.lineWidth = 1; c.beginPath(); c.moveTo(W / 2, colTop - 18); c.lineTo(W / 2, colBottom); c.stroke();

    // ── Pull-quote band (anchors the lower golden section) ──
    if (d.remark) {
      hrule(quoteTop, 2);
      const qh = wrapH('“' + ent(d.remark) + '”', PAD + 24, quoteTop + 54, MAXW - 48, 44, `italic 600 32px ${SERIF}`, RED, true, 'center');
      hrule(quoteTop + 54 + qh - 28, 2);
    }

    // ── Footer ──
    hrule(H - 150, 1);
    center(d.name || 'The Administration', H - 100, `italic 700 30px ${SERIF}`, INK);
    center('putra10.github.io/governed', H - 64, `400 22px ${MONO}`, MUTE);

    return await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/png'));
  }
}
