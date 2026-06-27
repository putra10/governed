import { renderTopBar } from '../components/top-bar.js';
import { renderPublicFeed } from '../components/public-feed.js';
import { renderStoryCard } from '../components/story-card.js';
import { renderDecisionCards } from '../components/decision-cards.js';
import { renderAdvisorCard } from '../components/advisor-card.js';
import { pick } from '../ui-helpers.js';
import { SCANDAL_SEVERITY } from '../../engine/scandal-system.js';
import { renderNewspaper, bindNewspaper } from './newspaper-screen.js';
import { protestChant } from '../../utils/governor.js';


// Source ids → human explanation of WHY this scandal just hit
function _revealSourceLabel(source) {
  if (!source) return 'The story broke overnight.';
  if (source.startsWith('bribe_'))     return 'The back-channel payment leaked.';
  if (source === 'threat_backfire')    return 'Your threat backfired — they went to the press.';
  if (source === 'leak')               return 'Your leak splashed back on the office.';
  if (source === 'corrupt_pact')       return 'The corruption scheme was discovered.';
  if (source === 'romance')            return 'The affair went public.';
  if (source === 'auto_fired')         return 'You left the story unanswered. It ran.';
  if (source === 'ignored_problem')    return 'You left it on your desk for three weeks.';
  if (source === 'impeachment')        return 'The hearings have begun.';
  if (source === 'black_market')       return 'A deal went wrong.';
  return 'Fallout from your decision.';
}

function renderScandalReveals(reveals) {
  if (!reveals || !reveals.length) return '';
  return reveals.map((r, i) => `
    <div class="betrayal-overlay" data-scandal-reveal-index="${i}">
      <div class="betrayal-modal sr-modal">
        <div class="betrayal-header">
          <span class="betrayal-icon">&#x1F4F0;</span>
          <span class="betrayal-label">SCANDAL ERUPTS</span>
          <span class="sr-tier sr-tier--${r.severity_tier}">${(r.severity_tier ?? 'minor').replace('_', '-').toUpperCase()}</span>
        </div>
        <div class="betrayal-name">${r.title}</div>
        <div class="betrayal-note">${_revealSourceLabel(r.source)}</div>
        <div class="sr-penalty">${r.penalty}% approval</div>
        <button class="betrayal-dismiss" data-dismiss-scandal-reveal="${i}">ACKNOWLEDGE</button>
      </div>
    </div>`).join('');
}

function renderHeatNotices(notices) {
  if (!notices || !notices.length) return '';
  return notices.map((n, i) => `
    <div class="betrayal-overlay" data-heat-notice-index="${i}">
      <div class="betrayal-modal sr-modal">
        <div class="betrayal-header">
          <span class="betrayal-icon">&#x1F50E;</span>
          <span class="betrayal-label">SCRUTINY: ${n.level}</span>
        </div>
        <div class="betrayal-note">${n.note}</div>
        <button class="betrayal-dismiss" data-dismiss-heat-notice="${i}">ACKNOWLEDGE</button>
      </div>
    </div>`).join('');
}

function renderMarketOffers(offers) {
  if (!offers || !offers.length) return '';
  return `
    <div class="market-card">
      ${offers.map(o => {
        const price = o.askingPrice ?? 0;
        const priceLabel = price < 0 ? `+${-price}M` : `${price}M`;
        const riskLabel = o.risk ? `${Math.round(o.risk.chance * 100)}% it goes wrong` : 'no visible risk';
        return `
        <div class="mk-offer">
          <div class="mk-name">${o.title} <span class="mk-type">${o.type.toUpperCase()}</span></div>
          <div class="mk-desc">${o.desc}</div>
          <div class="mk-terms">
            ${price < 0 ? `Pays: <span class="mk-good">${priceLabel}</span>` : `Cost: <span class="mk-bad">${priceLabel}</span>`}
            &nbsp;&middot;&nbsp; Heat: <span class="mk-warn">+${o.heat ?? 0}</span>
            &nbsp;&middot;&nbsp; <span class="mk-warn">${riskLabel}</span>
          </div>
          <button class="mk-buy" data-buy-offer="${o.id}">${price < 0 ? 'SELL' : 'BUY'} (${priceLabel})</button>
        </div>`;
      }).join('')}
      <div class="mk-foot">Paid from personal funds &middot; offers vanish at dawn &middot; every deal raises SCRUTINY</div>
    </div>`;
}

function renderAddressCard(state) {
  if ((state.heat ?? 0) < 25 || state.flags?.address_used) return '';
  const atn = state.city?.address_the_nation ?? {};
  const flavor = atn.option_flavor ?? {};
  return `
    <div class="address-card">
      <div class="ad-header">
        <span class="ad-icon">&#x1F399;</span>
        <span class="ad-title">${atn.title ?? 'ADDRESS THE NATION'}</span>
        <span class="ad-once">ONCE PER TERM</span>
      </div>
      <div class="ad-body">${atn.body ?? 'The press demands answers. A podium waits. What you say next will follow you.'}</div>
      <div class="ad-actions">
        <button class="ad-opt" data-address-option="own_it">
          ${flavor.own_it ?? 'Own everything. Full apology.'} <span class="sc-resp-note">(-5% approval · heat -6)</span>
        </button>
        <button class="ad-opt" data-address-option="defiant">
          ${flavor.defiant ?? 'Go on the attack. The press is the real scandal.'} <span class="sc-resp-note">(+3% approval · heat +2 · 15% scandal)</span>
        </button>
        <button class="ad-opt" data-address-option="deflect">
          ${flavor.deflect ?? 'Blame outside agitators.'} <span class="sc-resp-note">(-2% approval · heat -3 · someone takes it personally)</span>
        </button>
      </div>
    </div>`;
}

function renderBetrayalEvents(betrayals) {
  if (!betrayals || !betrayals.length) return '';
  return betrayals.map((b, i) => {
    const relIcon = b.relationship === 'romantic' ? '\u{1F494}' : b.relationship === 'trust' ? '\u{1F5E1}' : '⚠';
    const relNote = b.relationship === 'romantic'
      ? 'Someone you trusted closely has turned on you.'
      : b.relationship === 'rivalry'
      ? 'The rivalry has reached its breaking point.'
      : 'An advisor has abandoned your government.';
    return `
    <div class="betrayal-overlay" data-betrayal-index="${i}">
      <div class="betrayal-modal">
        <div class="betrayal-header">
          <span class="betrayal-icon">${b.sacrificed ? '\u{1F68C}' : relIcon}</span>
          <span class="betrayal-label">${b.sacrificed ? 'SACRIFICED' : 'ADVISOR BETRAYAL'}</span>
        </div>
        <div class="betrayal-name">${b.advisorName}</div>
        <div class="betrayal-note">${relNote}</div>
        <div class="betrayal-quote">"${b.line}"</div>
        <button class="betrayal-dismiss" data-dismiss-betrayal="${i}">ACKNOWLEDGE</button>
      </div>
    </div>`;
  }).join('');
}

function _contractTerms(c) {
  const sign = c.approval_delta >= 0 ? '+' : '';
  const apClass = c.approval_delta > 0 ? 'co-good' : c.approval_delta < 0 ? 'co-bad' : '';
  const rarityBadge = c.rarity !== 'common' ? `<span class="co-rarity co-rarity--${c.rarity}">${c.rarity.toUpperCase()}</span>` : '';
  const durationNote = c.duration > 1 ? ` <span class="co-dur">(${c.duration}-turn installments)</span>` : '';
  return `
    <div class="co-name">${c.title}${rarityBadge}</div>
    <div class="co-desc">${c.description}</div>
    <div class="co-terms">
      Reward: <span class="co-good">+${c.reward_budget}M${durationNote}</span>
      ${c.approval_delta !== 0 ? `&nbsp;&middot;&nbsp; <span class="${apClass}">${sign}${c.approval_delta}%</span>` : ''}
      ${c.scandal_risk > 0 ? `&nbsp;&middot;&nbsp; Scandal: <span class="co-warn">${Math.round(c.scandal_risk * 100)}%</span>` : ''}
      ${c.decline_penalty ? `&nbsp;&middot;&nbsp; <span class="co-warn">Decline: ${c.decline_penalty}%</span>` : ''}
    </div>`;
}

function renderContractOffers(offers, activeDeals) {
  let html = '';

  // Active multi-turn deals
  if (activeDeals?.length) {
    html += `<div class="co-active-deals">
      <div class="co-ad-header">ACTIVE DEALS</div>
      ${activeDeals.map(d => `
        <div class="co-ad-row">
          <span class="co-ad-title">${d.title}</span>
          <span class="co-ad-val">+${d.installmentAmount}M x ${d.turnsRemaining} left</span>
        </div>`).join('')}
    </div>`;
  }

  if (!offers?.length) return html;

  const isCompeting = offers.length >= 2;

  if (isCompeting) {
    html += `
    <div class="contract-card contract-card--competing">
      <div class="co-header">
        <span class="co-icon">\u{1F4CB}</span>
        <span class="co-title">COMPETING OFFERS -- CHOOSE ONE</span>
      </div>
      ${offers.map(c => `
        <div class="co-compete-item">
          <div class="co-client">${c.client}</div>
          ${_contractTerms(c)}
          <button class="co-accept" data-accept-contract="${c.id}">ACCEPT (+${c.reward_budget}M)</button>
        </div>`).join('<div class="co-vs">OR</div>')}
      <button class="co-decline co-decline-all" id="btn-decline-all-contracts">DECLINE BOTH</button>
    </div>`;
  } else {
    const c = offers[0];
    html += `
    <div class="contract-card">
      <div class="co-header">
        <span class="co-icon">\u{1F4CB}</span>
        <span class="co-title">CONTRACT OFFER</span>
        <span class="co-client">${c.client}</span>
      </div>
      ${_contractTerms(c)}
      <div class="co-actions">
        <button class="co-accept" data-accept-contract="${c.id}">ACCEPT (+${c.reward_budget}M)</button>
        <button class="co-decline" data-decline-contract="${c.id}">DECLINE${c.decline_penalty ? ` (${c.decline_penalty}%)` : ''}</button>
      </div>
    </div>`;
  }

  return html;
}

// ── Action points + meetings ──────────────────────────────────────────────

function renderActionPoints(state) {
  const max = state.maxActionPoints ?? 3;
  const ap  = Math.max(0, state.actionPoints ?? max);
  const pips = Array.from({ length: max }, (_, i) =>
    `<span class="ap-pip${i < ap ? ' ap-pip--on' : ''}"></span>`).join('');
  return `<span class="ap-box" title="Meetings, consultations and back-channel moves each cost one">
    HOURS ${pips}
  </span>`;
}

function renderMeetingRow(state, decision) {
  if (!decision?.external_actors?.length) return '';
  if (state.pendingMeeting) return '';
  const used = state.meetingUsedTurn === state.turn;
  const skipped = state.meetingSkippedTurn === state.turn;
  const noAP = (state.actionPoints ?? 0) <= 0;
  if (used || skipped) return '';
  return `
    <div class="meet-roster">
      ${decision.external_actors.slice(0, 2).map(a => `
        <button class="meet-actor-card" data-summon-actor="${a}" ${noAP ? 'disabled' : ''}>
          <span class="mac-icon">\u{1F4DE}</span>
          <span class="mac-name">${a}</span>
          <span class="mac-cost">${noAP ? 'NO HOURS LEFT' : '1 HOUR'}</span>
        </button>`).join('')}
    </div>`;
}

function renderPendingMeetingStory(m, decision, turn) {
  if (!m) return '';
  const o = m.offer;
  return `
    <div class="kicker">TODAY'S DISPATCH</div>
    <div class="headline">${decision?.title || 'Unknown Issue'}</div>
    <div class="byline">WEEK ${turn * 6} OF YOUR TERM</div>
    <hr class="divider">
    <div class="sbody">${decision?.body || decision?.description || ''}</div>
    <div class="mt-offer" style="margin-top: 1.5rem; background: var(--surface-2); border-left: 4px solid var(--accent); padding: 1rem;">
      <div style="font-size: 0.75rem; font-weight: 700; color: var(--accent); letter-spacing: 0.1em; margin-bottom: 0.5rem;">MEETING IN PROGRESS: ${m.actorName.toUpperCase()}</div>
      <div class="sbody" style="font-size: 0.9rem; font-style: italic; margin-bottom: 0.75rem;">"${m.greeting}"</div>
      <div class="mt-offer-label" style="font-size: 0.85rem;">OFFER: ${o.label}</div>
      <div class="mt-offer-desc" style="font-size: 0.85rem;">${o.desc}</div>
    </div>
  `;
}

function renderPendingMeetingActions(m) {
  if (!m) return '';
  const o = m.offer;
  return `
    <div class="cards" style="margin-top: 0;">
      <button class="mt-accept" data-meeting-response="accept" style="width: 100%; margin-bottom: 0.25rem;">SHAKE ON IT <span class="mt-note">(${o.accept_note ?? ''})</span></button>
      <button class="mt-decline" data-meeting-response="decline" style="width: 100%;">SHOW THEM OUT <span class="mt-note">(${o.decline_note ?? ''})</span></button>
    </div>
  `;
}

function renderMeetingResult(state) {
  const r = state.lastMeetingResult;
  if (!r || r.turn !== state.turn) return '';
  return `
    <div class="meeting-result">
      <div class="mr-label">AFTER THE MEETING — ${r.actorName.toUpperCase()}</div>
      ${(r.lines ?? []).map(l => `<div class="mr-line">${l}</div>`).join('')}
    </div>`;
}

const UNREST_META = {
  strike: {
    icon: '✊', label: "WORKERS' STRIKE",
    desc: 'Organized labor has walked out. Production has halted across key sectors.',
    actions: [
      { id: 'meet_demands', label: 'MEET DEMANDS',      note: '-20M budget',             cls: 'uc-costly' },
      { id: 'stand_firm',   label: 'STAND FIRM',        note: '-5% approval',            cls: 'uc-hard'   },
    ]
  },
  demonstration: {
    icon: '\u{1F4E2}', label: 'PUBLIC DEMONSTRATION',
    desc: 'Thousands have taken to the streets. The city is watching how you respond.',
    actions: [
      { id: 'engage',   label: 'ENGAGE PROTESTERS', note: '-25M, +2% approval',   cls: 'uc-costly' },
      { id: 'disperse', label: 'DISPERSE CROWD',     note: '-10% approval',        cls: 'uc-hard'   },
    ]
  },
  riot: {
    icon: '\u{1F525}', label: 'CIVIL RIOT',
    desc: 'Riots have broken out across the city. Property destruction is spreading fast.',
    actions: [
      { id: 'negotiate', label: 'NEGOTIATE',  note: '-40M budget',              cls: 'uc-costly' },
      { id: 'crackdown', label: 'CRACKDOWN',  note: '-18% approval + scandal',  cls: 'uc-danger' },
    ]
  },
};

function renderUnrestActions(unrest) {
  if (!unrest) return '';
  const m = UNREST_META[unrest.type] ?? UNREST_META.demonstration;
  const btns = m.actions.map(a =>
    `<button class="uc-btn ${a.cls}" data-resolve-unrest="${a.id}" style="width: 100%; margin-bottom: 0.25rem;">${a.label} <span class="uc-note">(${a.note})</span></button>`
  ).join('');
  return `
    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
      ${btns}
    </div>`;
}

function renderBribeOffers(bribes) {
  if (!bribes || !bribes.length) return '';
  return bribes.map(b => `
    <div class="bribe-card">
      <div class="bc-header">
        <span class="bc-icon">⚠</span>
        <span class="bc-title">BACK-CHANNEL OFFER</span>
      </div>
      <div class="bc-body">
        <strong>${b.advisorName}</strong> is offering a deal to stay loyal.
      </div>
      <div class="bc-terms">
        Cost: <strong>${b.cost}M</strong> &nbsp;&middot;&nbsp;
        Agenda <span class="bc-good">-${b.agendaReduction}%</span> &nbsp;&middot;&nbsp;
        Trust <span class="bc-good">+${b.trustGain}%</span> &nbsp;&middot;&nbsp;
        Scandal risk <span class="bc-warn">${Math.round(b.scandalRisk * 100)}%</span>
      </div>
      <div class="bc-actions">
        <button class="bc-accept" data-accept-bribe="${b.advisorId}">PAY ${b.cost}M</button>
        <button class="bc-decline" data-decline-bribe="${b.advisorId}">DECLINE</button>
      </div>
    </div>`).join('');
}


function renderScandalStory(scandal) {
  const tier     = scandal.severity_tier ?? 'minor';
  const tierDef  = SCANDAL_SEVERITY[tier] ?? SCANDAL_SEVERITY.minor;
  const label    = tierDef.label ?? 'Political Scandal';
  const isCareer = tier === 'career_ending';

  return `
    <div class="kicker">BREAKING NEWS</div>
    <div class="headline">${scandal.title ?? scandal.description ?? 'Political Scandal'}</div>
    <div class="byline">${tier.replace('_', ' ').toUpperCase()} SCANDAL</div>
    <hr class="divider">
    <div class="sbody">${scandal.description ?? ''}</div>
    ${isCareer ? `
      <div class="sc-terms" style="margin-top: 1rem; border-left: 3px solid #e55; padding-left: 0.5rem;">
        <span class="sc-bad">This cannot be suppressed or accepted. Survive it — or resign.</span>
      </div>
    ` : ''}
  `;
}

function renderScandalActions(scandal) {
  const tier     = scandal.severity_tier ?? 'minor';
  const tierDef  = SCANDAL_SEVERITY[tier] ?? SCANDAL_SEVERITY.minor;
  const penalty  = Math.abs(scandal.approval_penalty ?? tierDef.approvalPenalty);
  const isCareer = tier === 'career_ending';

  const responseNote = (r) => {
    const parts = [];
    if (r.budgetCost)  parts.push(`-${r.budgetCost}M`);
    if (r.approvalMod) parts.push(`${r.approvalMod > 0 ? '+' : ''}${r.approvalMod}% recovery`);
    if (r.agendaMod)   parts.push(`agendas ${r.agendaMod > 0 ? '+' : ''}${r.agendaMod}`);
    return parts.join(' · ');
  };

  let actionButtons;
  if (isCareer) {
    actionButtons = `
      <div style="display: flex; flex-direction: column; gap: 0.25rem;">
        ${tierDef.responses.map(r => {
          const bits = [];
          if (r.budgetCost)  bits.push(`-${r.budgetCost}M`);
          if (r.miracleRoll) bits.push('25% survival — failure ends your term');
          if (r.gameOver)    bits.push('ends your term');
          return `
          <button class="sc-response sc-response--${r.id}" data-scandal-response="${r.id}" style="width: 100%;">
            ${r.label}${bits.length ? ` <span class="sc-resp-note">(${bits.join(' · ')})</span>` : ''}
          </button>`;
        }).join('')}
      </div>`;
  } else {
    actionButtons = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem;">
        <button class="sc-suppress" id="btn-suppress-scandal" style="width: 100%;">SUPPRESS (${scandal.suppress_cost}M)</button>
        <button class="sc-accept" id="btn-accept-scandal" style="width: 100%;">ACCEPT (-${penalty}%)</button>
      </div>
      <div class="sc-manage-label" style="margin-top: 0.75rem; margin-bottom: 0.25rem;">OR MANAGE THE STORY &middot; base hit -${penalty}% applies, then:</div>
      <div style="display: flex; flex-direction: column; gap: 0.25rem;">
        ${tierDef.responses.map(r => `
          <button class="sc-response sc-response--${r.id}" data-scandal-response="${r.id}" style="width: 100%;">
            ${r.label}${responseNote(r) ? ` <span class="sc-resp-note">(${responseNote(r)})</span>` : ''}
          </button>`).join('')}
      </div>`;
  }

  return `
    <div style="margin-top: 0;">
      ${actionButtons}
    </div>
  `;
}

function renderTreasuryPanel(state) {
  const pf = state.personalFunds ?? 0;
  const def = Math.min(pf, Math.max(10, Math.round(pf * 0.25)));
  const NEXT = [3, 5, 7, 9, 11].find(t => t > state.turn);
  const nextPay = NEXT ? `Next salary &middot; turn ${NEXT}` : 'Final salary in';
  const dis = pf <= 0;
  return `
    <div class="treasury">
      <div class="trez-top">
        <span class="trez-h">PERSONAL FUNDS</span>
        <span class="trez-next">${nextPay}</span>
      </div>
      <div class="trez-amt">${pf}<span class="trez-m">M</span></div>
      <button type="button" class="trez-toggle" id="trez-toggle" ${dis ? 'disabled' : ''} aria-expanded="false">
        <span>DONATE TO CITY</span><span class="trez-caret">&#9656;</span>
      </button>
      <div class="trez-donate is-collapsed ${dis ? 'is-empty' : ''}" id="trez-panel">
        <div class="trez-drow">
          <span class="trez-lbl">AMOUNT</span>
          <span class="trez-out"><span id="trez-out">${dis ? 0 : def}</span>M</span>
        </div>
        <input type="range" class="trez-slider" id="trez-slider" min="0" max="${pf}" step="1" value="${dis ? 0 : def}" ${dis ? 'disabled' : ''}>
        <div class="trez-presets">
          <button type="button" class="trez-pre" data-donate-set="10" ${pf < 10 ? 'disabled' : ''}>10</button>
          <button type="button" class="trez-pre" data-donate-set="50" ${pf < 50 ? 'disabled' : ''}>50</button>
          <button type="button" class="trez-pre" data-donate-set="100" ${pf < 100 ? 'disabled' : ''}>100</button>
          <button type="button" class="trez-pre" data-donate-set="max" ${dis ? 'disabled' : ''}>MAX</button>
        </div>
        <button type="button" class="trez-go" id="trez-donate-btn" ${dis ? 'disabled' : ''}>
          GIVE <span id="trez-go-amt">${dis ? 0 : def}</span>M &middot; +1% APPROVAL
        </button>
        <div class="trez-note">Lands in the public treasury &middot; front page tomorrow</div>
      </div>
    </div>`;
}

export class DispatchScreen {
  static render(state) {
    const city = state.city;
    // getNextDecision() enforces one-per-turn pacing and tracks presented decisions
    const decision = state.getNextDecision();

    const approval = state.approval;
    const angerPct = 100 - approval;

    // Ticker
    const tickerParts = [];
    if (state.activeCrises.length) {
      const c = city?.crises?.find(c => c.id === state.activeCrises[0]);
      if (c) tickerParts.push(c.name);
    }
    const advisors = state.advisors.filter(a => !a.betrayed);
    advisors.slice(0, 2).forEach(a => {
      const line = pick(a.dialogue?.briefing);
      if (line) tickerParts.push(line.slice(0, 80) + (line.length > 80 ? '…' : ''));
    });

    // Crisis window — must match the engine's CRISIS_TURNS [4, 8, 12]
    // (the old formula ceil(turn/3)*3+3 produced 6/9/15, none of which
    // are actual crisis turns)
    const CRISIS_TURNS = [4, 8, 12];
    const nextWindow = CRISIS_TURNS.find(t => t > state.turn);
    const crisisWindowText = state.activeCrises.length
      ? 'CRISIS ACTIVE - respond now'
      : nextWindow
        ? `Next eligible: Turn ${nextWindow}`
        : 'No further windows this term';

    // Story section
    let storyHTML = renderStoryCard(state, decision);

    // Pip row helper
    const crisisNow = state.activeCrises.length > 0;
    const pipRowHTML = Array.from({ length: 12 }, (_, i) => {
      const n = i + 1;
      if (n < state.turn)  return '<div class="pip d"></div>';
      if (n === state.turn) return crisisNow ? '<div class="pip c"></div>' : '<div class="pip d"></div>';
      return '<div class="pip"></div>';
    }).join('');

    const FEED_DURATIONS = { slow: '120s', normal: '75s', fast: '35s' };
    const feedDuration = FEED_DURATIONS[state.settings?.feedSpeed ?? 'normal'];

    const needsMeetingChoice = decision?.external_actors?.length > 0 &&
                               !state.pendingMeeting &&
                               state.meetingUsedTurn !== state.turn &&
                               state.meetingSkippedTurn !== state.turn;
    const hasPendingMeeting = !!state.pendingMeeting;
    
    // Strict phase priority: Meeting -> Problem -> Riot -> Market -> Scandal -> Done
    const phaseMeeting = needsMeetingChoice || hasPendingMeeting;
    const phaseProblem = !phaseMeeting && !!decision;
    const phaseRiot    = !phaseMeeting && !phaseProblem && !!state.pendingUnrest;
    const phaseMarket  = !phaseMeeting && !phaseProblem && !phaseRiot && (state.pendingMarketOffers?.length > 0);
    const phaseScandal = !phaseMeeting && !phaseProblem && !phaseRiot && !phaseMarket && !!state.pendingScandal;
    const phaseDone    = !phaseMeeting && !phaseProblem && !phaseRiot && !phaseMarket && !phaseScandal;

    return `
      <div class="screen">
        ${renderNewspaper(state.pendingNewspaper)}
        ${renderHeatNotices(state.pendingHeatNotices)}
        ${renderScandalReveals(state.pendingScandalReveals)}
        ${renderBetrayalEvents(state.pendingBetrayals)}
        ${renderTopBar(state)}
        <div class="mobile-tab-strip">
          <button class="mob-tab mob-tab--active" data-mob-tab="dispatch">DISPATCH</button>
          <button class="mob-tab" data-mob-tab="advisors">ADVISORS${(state.pendingLoverDemand || state.pendingPartnerDemand || state.pendingFundingRequest || state.pendingBribes?.length || state.advisors.some(a => a.pendingReactionMsg && !a.betrayed)) ? '<span class="tab-dot"></span>' : ''}</button>
          <button class="mob-tab" data-mob-tab="feed">FEED</button>
        </div>
        <div class="main-body">

          <div class="sidebar">
            <div class="sh">
              <span class="sh-t">PUBLIC FEED</span>
              <div class="sm">
                <div class="sm-b"><div class="sm-f" style="width:${angerPct}%"></div></div>
                <span class="sm-t">${angerPct}% angry</span>
              </div>
            </div>
            <div class="feed-platform">${city?.city_personality?.media_outlet || 'Live Feed'}</div>
            <div class="feed">
              <div class="feed-scroll" style="animation-duration:${feedDuration}">${renderPublicFeed(state, decision)}</div>
            </div>
            ${state.budget < 0 ? '<div class="budget-warn">⚠ DEFICIT -- AUSTERITY ACTIVE</div>' : ''}
            <div class="sf">
              <div class="sf-l">SENTIMENT</div>
              <div class="sf-t"><div class="sf-f" style="width:${angerPct}%"></div></div>
              <div class="sf-p">${approval}% approval</div>
            </div>
            ${renderTreasuryPanel(state)}
          </div>

          <div class="center">
            ${phaseMeeting ? `
              <div class="story">
                <div class="pip-row">${pipRowHTML}</div>
                ${hasPendingMeeting 
                  ? renderPendingMeetingStory(state.pendingMeeting, decision, state.turn)
                  : `
                    <div class="kicker">TODAY'S DISPATCH</div>
                    <div class="headline">${decision?.title || 'Unknown Issue'}</div>
                    <div class="byline">WEEK ${state.turn * 6} OF YOUR TERM</div>
                    <hr class="divider">
                    <div class="sbody">${decision?.body || decision?.description || ''}</div>
                    <div class="mt-offer" style="margin-top: 1.5rem; background: var(--surface-2); border-left: 4px solid var(--accent); padding: 1rem;">
                      <div style="font-size: 0.75rem; font-weight: 700; color: var(--accent); letter-spacing: 0.1em; margin-bottom: 0.5rem;">THE WAITING ROOM</div>
                      <div class="sbody" style="font-size: 0.9rem;">There are people outside your office who would like a word regarding this issue before you make a decision. You may hear them out — or send them away.</div>
                    </div>
                  `
                }
              </div>
              <div class="dec">
                <div class="dec-l">YOUR DECISION ${renderActionPoints(state)}</div>
                ${hasPendingMeeting 
                  ? renderPendingMeetingActions(state.pendingMeeting) 
                  : `
                    ${renderMeetingRow(state, decision)}
                    <button class="skip-btn" id="btn-skip-meeting" style="margin-top: 1rem;">I WON'T TAKE ANY MEETINGS TODAY</button>
                  `
                }
              </div>
            ` : phaseScandal ? `
              <div class="story">
                <div class="pip-row">${pipRowHTML}</div>
                ${renderScandalStory(state.pendingScandal)}
              </div>
              <div class="dec">
                <div class="dec-l">YOUR DECISION ${renderActionPoints(state)}</div>
                ${renderScandalActions(state.pendingScandal)}
              </div>
            ` : phaseRiot ? (() => {
              const uMeta = UNREST_META[state.pendingUnrest.type] ?? UNREST_META.demonstration;
              return `
              <div class="story">
                <div class="pip-row">${pipRowHTML}</div>
                <div class="kicker" style="color: var(--danger);">EMERGENCY DISPATCH</div>
                <div class="headline">${uMeta.icon} ${uMeta.label}</div>
                <div class="byline">THE STREETS ARE BOILING OVER</div>
                <hr class="divider" style="border-color: var(--danger);">
                <div class="unrest-chant">&laquo; ${protestChant(state, state.pendingUnrest.type)} &raquo;</div>
                <div class="sbody">${uMeta.desc}</div>
                <div style="margin-top: 1.5rem;">
                  ${renderUnrestActions(state.pendingUnrest)}
                </div>
              </div>
              <div class="dec" style="display: none;">
                <!-- Decision handled entirely inside the story card -->
              </div>
            `; })() : phaseMarket ? `
              <div class="story">
                <div class="pip-row">${pipRowHTML}</div>
                <div class="kicker" style="color: #a8a8a8;">THE UNDERGROUND</div>
                <div class="headline">Late Night Dealings</div>
                <div class="byline">THE CITY SLEEPS, BUT MONEY DOES NOT</div>
                <hr class="divider" style="border-color: #555;">
                <div class="sbody">You have been contacted by individuals offering off-the-books solutions to your current problems. These actions are highly illegal and carry significant risk of exposure.</div>
                ${renderMarketOffers(state.pendingMarketOffers)}
              </div>
              <div class="dec">
                <div class="dec-l">YOUR DECISION</div>
                <button class="skip-btn" id="btn-pass-market" style="margin-top: 1rem;">WALK AWAY</button>
              </div>
            ` : phaseProblem ? `
              <div class="story">
                <div class="pip-row">${pipRowHTML}</div>
                ${storyHTML}
              </div>
              <div class="dec">
                <div class="dec-l">YOUR DECISION ${renderActionPoints(state)}</div>
                <div class="cards">${renderDecisionCards(decision)}</div>
                <button class="confirm-btn" id="btn-confirm-decision" disabled>SELECT AN OPTION ABOVE</button>
                ${renderMeetingResult(state)}
                ${renderAddressCard(state)}
              </div>
            ` : `
              <div class="story">
                <div class="pip-row">${pipRowHTML}</div>
                <div class="kicker">END OF DAY</div>
                <div class="headline">The Dust Settles</div>
                <div class="byline">DISPATCH - WEEK ${state.turn * 6} OF YOUR TERM</div>
                <hr class="divider">
                <div class="sbody">The day's crises have been managed. Review your standing and proceed when ready.</div>
              </div>
              <div class="dec">
                <div class="dec-l">YOUR DECISION</div>
                <button class="skip-btn" id="btn-next-turn">END TURN</button>
              </div>
            `}
          </div>

          <div class="right">
            <div class="adv-area">
              <div class="adv-h">ADVISORS</div>
              ${advisors.map(a => renderAdvisorCard(
                a,
                (state.pendingBribes ?? []).some(b => b.advisorId === a.id),
                state.pendingLoverDemand?.advisorId === a.id || state.pendingPartnerDemand?.advisorId === a.id || state.pendingFundingRequest?.advisorId === a.id,
                !!a.pendingReactionMsg
              )).join('')}
              ${renderBribeOffers(state.pendingBribes)}
              ${renderContractOffers(state.pendingContractOffers, state.activeContractDeals)}
            </div>
            <div class="crisis-box">
              <div class="cr-l">CRISIS WINDOW</div>
              <div class="cr-t">${crisisWindowText}</div>
            </div>
            <div class="ticker">
              <div class="tk-l">LIVE TICKER</div>
              <div class="tk-t"><div class="tk-track">${((tickerParts.join('\u2003\u25C6\u2003') || 'City status nominal') + '\u2003\u25C6\u2003').repeat(2)}</div></div>
            </div>
          </div>

        </div>
      </div>`;
  }

  static bind(state, container, handlers) {
    // Morning paper
    bindNewspaper(container, handlers);

    const trezToggle = container.querySelector('#trez-toggle');
    const trezPanel = container.querySelector('#trez-panel');
    if (trezToggle && trezPanel) {
      trezToggle.addEventListener('click', () => {
        const open = trezPanel.classList.toggle('is-collapsed') === false;
        trezToggle.classList.toggle('open', open);
        trezToggle.setAttribute('aria-expanded', String(open));
      });
    }

    const trezSlider = container.querySelector('#trez-slider');
    if (trezSlider) {
      const trezOut = container.querySelector('#trez-out');
      const trezGo = container.querySelector('#trez-go-amt');
      const trezMax = Number(trezSlider.max) || 0;
      const sync = (v) => {
        const n = Math.max(0, Math.min(trezMax, Math.round(Number(v) || 0)));
        trezSlider.value = n;
        if (trezOut) trezOut.textContent = n;
        if (trezGo) trezGo.textContent = n;
      };
      trezSlider.addEventListener('input', () => sync(trezSlider.value));
      container.querySelectorAll('[data-donate-set]').forEach(b =>
        b.addEventListener('click', () =>
          sync(b.dataset.donateSet === 'max' ? trezMax : Number(b.dataset.donateSet))));
      container.querySelector('#trez-donate-btn')?.addEventListener('click', () => {
        const amt = Number(trezSlider.value);
        if (amt > 0) handlers.donateToCity?.(amt);
      });
    }

    // External actor meetings
    container.querySelectorAll('[data-summon-actor]').forEach(btn => {
      btn.addEventListener('click', () => handlers.summonActor?.(btn.dataset.summonActor));
    });
    container.querySelectorAll('[data-meeting-response]').forEach(btn => {
      btn.addEventListener('click', () => handlers.meetingResponse?.(btn.dataset.meetingResponse === 'accept'));
    });
    container.querySelector('#btn-skip-meeting')?.addEventListener('click', () => {
      handlers.skipMeeting?.();
    });

    // Mobile tab switching
    const mainBody = container.querySelector('.main-body');
    container.querySelectorAll('.mob-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('.mob-tab').forEach(t => t.classList.remove('mob-tab--active'));
        tab.classList.add('mob-tab--active');
        mainBody?.setAttribute('data-mob-tab', tab.dataset.mobTab);
      });
    });

    container.querySelectorAll('#btn-next-turn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (state.pendingScandal && !state.viewingScandal) {
          handlers.viewScandal?.();
        } else {
          handlers.nextTurn?.();
        }
      });
    });

    // getNextDecision() returns the same decision that was shown in render()
    const decision = state.getNextDecision();

    let selectedDecisionId = null;
    let selectedIndex = null;
    const confirmBtn = container.querySelector('#btn-confirm-decision');

    container.querySelectorAll('.card[data-decision]').forEach(card => {
      card.addEventListener('click', () => {
        container.querySelectorAll('.card[data-decision]').forEach(c => c.classList.remove('sel'));
        card.classList.add('sel');
        selectedDecisionId = card.dataset.decision;
        selectedIndex      = parseInt(card.dataset.index);
        if (confirmBtn) {
          confirmBtn.disabled = false;
          const tag = card.querySelector('.ctag')?.textContent ?? 'OPTION';
          confirmBtn.textContent = 'EXECUTE: ' + tag;
        }
      });
    });

    confirmBtn?.addEventListener('click', () => {
      if (selectedDecisionId !== null && selectedIndex !== null) {
        handlers.handleDecision(selectedDecisionId, selectedIndex);
      }
    });

    container.querySelector('#btn-accept-scandal')?.addEventListener('click', () => {
      handlers.acceptScandal?.();
    });

    container.querySelector('#btn-suppress-scandal')?.addEventListener('click', () => {
      handlers.suppressScandal?.();
    });

    // Career-ending tier: tier-specific response buttons
    container.querySelectorAll('[data-scandal-response]').forEach(btn => {
      btn.addEventListener('click', () => {
        handlers.respondToScandal?.(btn.dataset.scandalResponse);
      });
    });

    container.querySelectorAll('[data-dismiss-betrayal]').forEach(btn => {
      btn.addEventListener('click', () => {
        handlers.dismissBetrayal?.();
      });
    });

    container.querySelectorAll('[data-dismiss-scandal-reveal]').forEach(btn => {
      btn.addEventListener('click', () => {
        handlers.dismissScandalReveal?.();
      });
    });

    container.querySelectorAll('[data-dismiss-heat-notice]').forEach(btn => {
      btn.addEventListener('click', () => {
        handlers.dismissHeatNotice?.();
      });
    });

    container.querySelectorAll('[data-buy-offer]').forEach(btn => {
      btn.addEventListener('click', () => {
        handlers.buyMarketOffer?.(btn.dataset.buyOffer);
      });
    });

    container.querySelector('#btn-pass-market')?.addEventListener('click', () => {
      handlers.passMarket?.();
    });

    container.querySelectorAll('[data-address-option]').forEach(btn => {
      btn.addEventListener('click', () => {
        handlers.addressNation?.(btn.dataset.addressOption);
      });
    });

    container.querySelectorAll('[data-accept-bribe]').forEach(btn => {
      btn.addEventListener('click', () => {
        handlers.acceptBribe?.(btn.dataset.acceptBribe);
      });
    });

    container.querySelectorAll('[data-decline-bribe]').forEach(btn => {
      btn.addEventListener('click', () => {
        handlers.declineBribe?.(btn.dataset.declineBribe);
      });
    });

    container.querySelectorAll('.acard[data-advisor]').forEach(btn => {
      btn.addEventListener('click', () => {
        handlers.openMessenger(btn.dataset.advisor);
      });
    });

    container.querySelectorAll('[data-accept-contract]').forEach(btn => {
      btn.addEventListener('click', () => handlers.acceptContract?.(btn.dataset.acceptContract));
    });

    container.querySelectorAll('[data-decline-contract]').forEach(btn => {
      btn.addEventListener('click', () => handlers.declineContract?.(btn.dataset.declineContract));
    });

    container.querySelector('#btn-decline-all-contracts')?.addEventListener('click', () => {
      handlers.declineAllContracts?.();
    });

    container.querySelectorAll('[data-resolve-unrest]').forEach(btn => {
      btn.addEventListener('click', () => handlers.resolveUnrest?.(btn.dataset.resolveUnrest));
    });
  }
}
