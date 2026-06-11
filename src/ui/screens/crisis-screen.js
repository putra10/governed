import { renderTopBar } from '../components/top-bar.js';
import { renderCrisisBanner } from '../components/crisis-banner.js';
import { renderEscalationTracker } from '../components/escalation-tracker.js';
import { tagClass, pick } from '../ui-helpers.js';
import { domainOf } from '../../engine/advisor-system.js';

// Secret options offered by advisors with matching domain and trust >= 60.
const ADVISOR_SECRET_OPTIONS = {
  finance: {
    tag: 'ADVISOR',
    label: 'Financial restructuring package',
    advisorNote: 'Finance Advisor recommends a controlled economic adjustment.',
    consequences: { approval_delta: 2, budget_delta: -30 },
  },
  military_liaison: {
    tag: 'ADVISOR',
    label: 'Negotiated withdrawal & ceasefire',
    advisorNote: 'Military Liaison has a back-channel contact who can broker a deal.',
    consequences: { approval_delta: 6, budget_delta: -20 },
  },
  urban_planning: {
    tag: 'ADVISOR',
    label: 'Community mediation program',
    advisorNote: 'Urban Planning can mobilise district reps to defuse tensions.',
    consequences: { approval_delta: 8, budget_delta: -25 },
  },
  religious_affairs: {
    tag: 'ADVISOR',
    label: 'Inter-faith reconciliation summit',
    advisorNote: 'Religious Affairs calls for calm, uniting communities under a shared appeal.',
    consequences: { approval_delta: 7, budget_delta: -10 },
  },
  transport: {
    tag: 'ADVISOR',
    label: 'Emergency supply corridor',
    advisorNote: 'Transport can ease shortages within 48 hours and calm the public.',
    consequences: { approval_delta: 4, budget_delta: -15 },
  },
};

export class CrisisScreen {
  static render(state, activeCrisisId) {
    const crisis = state.city?.crises?.find(c => c.id === activeCrisisId);
    if (!crisis) return '';

    const escalationPct = Math.min(85, Math.round((state.turn / 12) * 100));
    const advisors = state.advisors.filter(a => !a.betrayed).slice(0, 3);

    // Find most-trusted advisor whose secret option is available (trust >= 60)
    const secretAdvisor = state.advisors
      .filter(a => !a.betrayed && (a.trust ?? 0) >= 60 && ADVISOR_SECRET_OPTIONS[domainOf(a)])
      .sort((a, b) => (b.trust ?? 0) - (a.trust ?? 0))[0];
    const secretOpt = secretAdvisor ? ADVISOR_SECRET_OPTIONS[domainOf(secretAdvisor)] : null;
    const secretIdx = secretOpt ? crisis.options.length : -1;

    const crisisCards = crisis.options.map((opt, i) => {
      const tc   = tagClass(opt.tag);
      const urg  = ['CHAOS', 'ATTACK', 'RESIGN'].includes((opt.tag || '').toUpperCase()) ? 'urgent' : '';
      const appD = opt.consequences?.approval_delta ?? 0;
      const budD = opt.consequences?.budget_delta   ?? 0;
      const appCls = appD >= 0 ? 'good' : 'bad';
      const budCls = budD >= 0 ? 'good' : 'bad';
      return `
        <div class="cc ${urg}" data-index="${i}">
          <div class="cc-tag ${tc}">${opt.tag ?? 'OPTION'}</div>
          <div class="cc-text">${opt.label}</div>
          <div class="cc-preview">
            <div class="ccp-item"><span class="${appCls}">${appD >= 0 ? '+' : ''}${appD} approval</span></div>
            <div class="ccp-item"><span class="${budCls}">${budD >= 0 ? '+' : ''}${budD}M budget</span></div>
          </div>
        </div>`;
    }).join('');

    const pressureCards = advisors.map(a => {
      const t  = Math.round(a.trust);
      const ac = t >= 70 ? 'var(--color-green)' : t >= 40 ? 'var(--color-amber)' : 'var(--color-red)';
      const ln = pick(a.dialogue?.briefing) ?? 'Monitoring situation.';
      const short = ln.length > 65 ? ln.slice(0, 65) + '...' : ln;
      return `
        <div class="ext-actor" style="border-left-color:${ac}">
          <div class="ea-name">${a.name}</div>
          <div class="ea-pos">${a.domain}</div>
          <div class="ea-msg">"${short}"</div>
        </div>`;
    }).join('');

    const allAdvisors = state.advisors.filter(a => !a.betrayed).slice(0, 4);
    const stanceCards = allAdvisors.map(a => {
      const t   = Math.round(a.trust);
      const ac  = t >= 70 ? '#5ca85c' : t >= 40 ? '#d4a843' : '#e05c5c';
      const ln  = pick(a.dialogue?.briefing) ?? 'Monitoring situation closely.';
      const short = ln.length > 80 ? ln.slice(0, 80) + '…' : ln;
      return `
        <div class="cs-stance">
          <div class="cs-stance-hd">
            <span class="cs-stance-name">${a.name}</span>
            <span class="cs-stance-role">${a.domain}</span>
            <span class="cs-stance-trust" style="color:${ac}">${t}% trust</span>
          </div>
          <div class="cs-stance-msg">"${short}"</div>
        </div>`;
    }).join('');

    return `
      <div class="screen">
        ${renderTopBar(state)}
        <div class="crisis-screen">
          <div class="crisis-main">
            ${renderCrisisBanner(state, crisis)}
            <div class="crisis-body">
              <div class="crisis-desc">${crisis.description ?? crisis.trigger}</div>
              ${renderEscalationTracker(escalationPct)}
              <div class="crisis-intel">
                <div class="ci-label">ADVISOR POSITIONS</div>
                <div class="ci-stances">${stanceCards}</div>
              </div>
            </div>
            <div class="crisis-dec">
              <div class="crisis-dec-l">CRISIS RESPONSE — CHOOSE ONE</div>
              <div class="crisis-cards">
                ${crisisCards}
                ${secretOpt ? `
                  <div class="cc cc-secret" data-index="${secretIdx}" data-advisor-secret="${secretAdvisor.id}">
                    <div class="cc-tag cc-tag-advisor">ADVISOR</div>
                    <div class="cc-secret-advisor">${secretAdvisor.name} (${Math.round(secretAdvisor.trust)}% trust)</div>
                    <div class="cc-text">${secretOpt.label}</div>
                    <div class="cc-secret-note">"${secretOpt.advisorNote}"</div>
                    <div class="cc-preview">
                      <div class="ccp-item"><span class="good">+${secretOpt.consequences.approval_delta} approval</span></div>
                      <div class="ccp-item"><span class="bad">${secretOpt.consequences.budget_delta}M budget</span></div>
                    </div>
                  </div>` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  static bind(activeCrisisId, container, handlers) {
    container.querySelectorAll('.cc[data-index]').forEach(btn => {
      btn.addEventListener('click', () => {
        const advisorSecret = btn.dataset.advisorSecret ?? null;
        handlers.handleCrisisDecision(activeCrisisId, parseInt(btn.dataset.index), advisorSecret);
      });
    });
  }
}
