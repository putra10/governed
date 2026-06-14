import { tagClass } from '../ui-helpers.js';

export function renderDecisionCards(decision) {
  return decision.options.map((opt, i) => {
    const tc  = tagClass(opt.tag);
    const ch  = (opt.tag || '').toUpperCase() === 'CHAOS' ? 'ch' : '';
    const appDelta = opt.consequences?.approval_delta ?? 0;
    const budDelta = opt.consequences?.budget_delta   ?? 0;

    // Approval / reputation icon: ★ star — green if positive, red if negative
    const appIconStyle = appDelta < 0
      ? 'background:var(--color-red-bg);color:var(--color-red)'
      : '';

    // Budget / money icon: ◆ diamond — amber if positive (income), red if spend
    const budIconCls  = budDelta >= 0 ? 'budget gain' : 'budget';

    return `
      <div class="card ${ch}" data-decision="${decision.id}" data-index="${i}">
        <div class="ctag ${tc}">${opt.tag ?? 'OPTION'}</div>
        <div class="ctext">${opt.label}</div>
        <div class="card-preview">
          <div class="cp-item">
            <div class="cp-icon approval" style="${appIconStyle}">&#9733;</div>
            <span class="cp-text">${appDelta >= 0 ? '+' : ''}${appDelta} rep</span>
          </div>
          <div class="cp-item">
            <div class="cp-icon ${budIconCls}">&#9670;</div>
            <span class="cp-text">${budDelta >= 0 ? '+' : ''}${budDelta}M</span>
          </div>
        </div>
      </div>`;
  }).join('');
}
