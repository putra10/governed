import { renderTopBar } from '../components/top-bar.js';
import { govRaw, govLast } from '../../utils/governor.js';
import { pickClosingRemark } from '../../utils/closing-remark.js';
import { pickLegacy, pickClipping } from '../../utils/report-content.js';
import { typeText } from '../../utils/typewriter.js';

const LVL = { red: 'var(--color-red)', reddim: 'var(--color-red-dim)', amber: 'var(--color-amber)', green: 'var(--color-green)', dim: 'var(--color-text-muted)' };

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
        <div class="ssl">${scandalExit ? 'WHY YOU RESIGNED' : 'WHAT BROUGHT YOU DOWN'} &middot; ${String(state.endScandal.tier || 'major').replace('_', ' ').toUpperCase()} SCANDAL</div>
        <div class="sst"><strong>${state.endScandal.title}</strong>${state.endScandal.description ? ` — ${state.endScandal.description}` : ''}</div>
      </div>` : '';

    const shareText = `${subject} — ${stampWord} · ${state.approval}% · ${state.city?.city_name ?? ''} · Relevance: ${classification}. GOVERNED — putra10.github.io/governed`;

    // ── Verdict overlay payload ──
    const verdict = walkedAway ? 'RESIGNED' : scandalExit ? 'RESIGNED IN DISGRACE' : recalled ? 'RECALLED' : 'TERM COMPLETE';
    const adminLine = govRaw(state) ? `THE ${govLast(state).toUpperCase()} ADMINISTRATION` : 'FINAL ASSESSMENT';
    const govUpper = (govRaw(state) || 'Acting Governor').toUpperCase();

    return `
      <div class="screen sv-report">
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
          <div class="dsr" data-share="${shareText.replace(/"/g, '&quot;')}" data-card="${JSON.stringify({ name: subject, stamp: stampWord, cls: classification, approval: state.approval, city: state.city?.city_name ?? '', weeks, fileno: fileNo, tone, loyal, total }).replace(/"/g, '&quot;')}">

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
      let card = {};
      try { card = JSON.parse(dsr?.dataset.card || '{}'); } catch { /* ignore */ }
      const btn = e.currentTarget;
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = 'Rendering…';
      try {
        const blob = await ReportScreen._makeShareCard(card);
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
  }

  // Draws the shareable dossier card (portrait, 1080x1350) to a PNG Blob.
  static async _makeShareCard(card) {
    const W = 1080, H = 1350;
    const TONE = { red: '#f0685c', amber: '#e0a93b', green: '#5fb55f' };
    const accent = TONE[card.tone] || '#e0a93b';
    const MONO = "'IBM Plex Mono', monospace";
    const SERIF = "'IBM Plex Serif', serif";
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch { /* ignore */ }

    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');

    c.fillStyle = '#16150f'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#3a3629'; c.lineWidth = 2; c.strokeRect(40, 40, W - 80, H - 80);
    c.strokeStyle = accent; c.lineWidth = 6; c.strokeRect(40, 40, W - 80, 6);

    const PAD = 90;
    c.textBaseline = 'alphabetic';

    c.fillStyle = '#a89f88'; c.font = `700 24px ${MONO}`; c.textAlign = 'left';
    c.fillText('GOVERNED · CIVIC OVERSIGHT', PAD, 150);
    c.textAlign = 'right';
    c.fillText(`FILE ${card.fileno || '—'}`, W - PAD, 150);
    c.textAlign = 'left';
    c.fillStyle = '#3a3629'; c.fillRect(PAD, 175, W - PAD * 2, 2);

    c.fillStyle = '#a89f88'; c.font = `700 22px ${MONO}`;
    c.fillText('SUBJECT', PAD, 270);
    c.fillStyle = '#f6f3ea'; c.font = `700 64px ${SERIF}`;
    const name = String(card.name || 'The Administration');
    const words = name.split(' '); let line = '', y = 345;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (c.measureText(test).width > W - PAD * 2 && line) { c.fillText(line, PAD, y); line = w; y += 74; }
      else line = test;
    }
    c.fillText(line, PAD, y); y += 30;
    c.fillStyle = '#d8d2c2'; c.font = `400 30px ${MONO}`;
    c.fillText(`${(card.city || '').toUpperCase()}  ·  ${card.weeks || 0} WEEKS IN OFFICE`, PAD, y + 30);

    const sw = String(card.stamp || '').toUpperCase();
    c.save();
    c.translate(W - PAD - 150, 560); c.rotate(-11 * Math.PI / 180);
    c.font = `700 46px ${SERIF}`; const tw = c.measureText(sw).width;
    c.strokeStyle = accent; c.lineWidth = 5; c.globalAlpha = 0.85;
    c.strokeRect(-tw / 2 - 26, -52, tw + 52, 78);
    c.fillStyle = accent; c.textAlign = 'center';
    c.fillText(sw, 0, 0); c.restore();
    c.globalAlpha = 1; c.textAlign = 'left';

    c.fillStyle = '#a89f88'; c.font = `700 26px ${MONO}`;
    c.fillText('RELEVANCE INDEX', PAD, 760);
    c.fillStyle = accent; c.font = `700 220px ${SERIF}`;
    c.fillText(String(card.approval ?? 0), PAD - 6, 950);
    c.fillStyle = '#a89f88'; c.font = `400 34px ${MONO}`;
    c.fillText('%  APPROVAL AT FINAL ASSESSMENT', PAD + 6, 1000);

    c.fillStyle = '#3a3629'; c.fillRect(PAD, 1060, W - PAD * 2, 2);
    c.fillStyle = '#a89f88'; c.font = `700 24px ${MONO}`;
    c.fillText('CLASSIFICATION', PAD, 1130);
    c.fillStyle = accent; c.font = `700 48px ${SERIF}`;
    c.fillText(String(card.cls || '—'), PAD, 1185);
    c.fillStyle = '#a89f88'; c.font = `700 24px ${MONO}`; c.textAlign = 'right';
    c.fillText('LOYALTY', W - PAD, 1130);
    c.fillStyle = '#d8d2c2'; c.font = `700 48px ${SERIF}`;
    c.fillText(`${card.loyal ?? 0}/${card.total ?? 0}`, W - PAD, 1185);
    c.textAlign = 'left';

    c.fillStyle = '#6b6452'; c.font = `400 24px ${MONO}`;
    c.fillText('putra10.github.io/governed', PAD, H - 70);

    return await new Promise((res, rej) =>
      cv.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/png'));
  }
}
