import { advisorCardClass, trustStatus, pick } from '../ui-helpers.js';
import { renderTrustBar } from './trust-bar.js';

const REL_ICONS = {
  neutral:  '',
  trust:    '\u{1F91D}',
  rivalry:  '⚔',
  romantic: '\u{1F4AC}',
};
const REL_COLORS = {
  neutral:  'var(--color-text-muted)',
  trust:    'var(--color-green)',
  rivalry:  'var(--color-red)',
  romantic: 'var(--color-accent)',
};

function agendaColor(pct) {
  if (pct >= 80) return 'var(--color-red)';
  if (pct >= 60) return 'var(--color-amber)';
  if (pct >= 40) return 'var(--color-amber)';
  return 'var(--color-green)';
}

export function renderAdvisorCard(advisor, hasOffer = false, needsAnswer = false, hasUnread = false) {
  const trust    = Math.round(advisor.trust);
  const agenda   = Math.round(advisor.agendaProgress ?? 0);
  const cardCls  = advisorCardClass(trust, advisor.betrayed);
  const status   = trustStatus(trust);
  const line     = pick(advisor.dialogue?.briefing) ?? '...';
  const short    = line.length > 52 ? line.slice(0, 52) + '...' : line;
  const rel      = advisor.relationshipType ?? 'neutral';
  const relIcon  = REL_ICONS[rel];
  const relColor = REL_COLORS[rel] ?? '#666';
  const relLabel = rel === 'romantic' ? 'Lover' : rel.charAt(0).toUpperCase() + rel.slice(1);

  let warningHtml = '';
  if (advisor.betrayed) {
    warningHtml = `<div class="acard-warn acard-warn--betrayed">&#x26A0; BETRAYED</div>`;
  } else if (agenda >= 80) {
    warningHtml = `<div class="acard-warn acard-warn--danger">&#x1F534; PLOTTING AGAINST YOU</div>`;
  } else if (hasOffer) {
    // Only when a real bribe offer exists in state.pendingBribes —
    // previously this showed at agenda >= 60 even with no actual offer
    warningHtml = `<div class="acard-warn acard-warn--bribe">&#x26A1; OFFERING A DEAL</div>`;
  } else if (trust < 30) {
    warningHtml = `<div class="acard-warn acard-warn--low">&#x1F4C9; CHECKED OUT</div>`;
  } else if (agenda >= 60) {
    warningHtml = `<div class="acard-warn acard-warn--bribe">&#x26A1; GROWING RESTLESS</div>`;
  }

  const aColor = agendaColor(agenda);

  return `
    <div class="acard ${cardCls}" data-advisor="${advisor.id}">
      <div class="an">
        ${advisor.name}
        ${relIcon ? `<span style="color:${relColor};font-size: 0.625rem;margin-left: 0.25rem">${relIcon} ${relLabel}</span>` : ''}
        ${(needsAnswer || hasUnread) ? `<span class="acard-unread" title="${needsAnswer ? 'Needs an answer' : 'New message'}">1</span>` : ''}
      </div>
      <div class="ar">${advisor.domain} &middot; Trust ${trust}%</div>
      ${warningHtml}
      <div class="am">"${short}"</div>
      ${renderTrustBar(trust)}
      <div class="trust-label">
        <span style="color:${status.color}">${status.label}</span>
        <span style="color:${status.color}">${trust}%</span>
      </div>
      <div class="agenda-row">
        <span class="agenda-label">Hidden Agenda</span>
        <span class="agenda-pct" style="color:${aColor}">${agenda}%</span>
      </div>
      <div class="agenda-bar-bg">
        <div class="agenda-bar-fill" style="width:${agenda}%;background:${aColor}"></div>
      </div>
      <div class="at${(needsAnswer || hasUnread) ? ' at-urgent' : ''}">${needsAnswer ? '&#x2709; needs an answer' : hasUnread ? '&#x2709; new message' : 'tap to chat'}</div>
    </div>`;
}
