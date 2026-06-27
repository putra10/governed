import { trustStatus, advisorCardClass, pick, now } from '../ui-helpers.js';
import { EMERGENCY_POWERS, BACK_CHANNEL_ACTIONS, domainOf } from '../../engine/advisor-system.js';
import { advisorAddress, personalize } from '../../utils/governor.js';

export class MessengerScreen {
  static render(state, activeAdvisorId) {
    const advisor = state.advisors.find(a => a.id === activeAdvisorId);
    if (!advisor) return '';

    if (!advisor._msgLog) {
      advisor._msgLog = [];
      advisor._msgLog.push({ type: 'sys', text: `${advisor.name} is available for consultation.` });
      const brief = pick(advisor.dialogue?.briefing);
      if (brief) advisor._msgLog.push({ type: 'them', sender: advisor.name, text: advisorAddress(advisor, state) + personalize(brief, state), time: now() });
      const trust = Math.round(advisor.trust);
      if (trust < 40) {
        const warn = pick(advisor.dialogue?.betrayal_warning);
        if (warn) advisor._msgLog.push({ type: 'them', sender: advisor.name, text: personalize(warn, state), time: now() });
      } else if (trust < 60) {
        const thr = pick(advisor.dialogue?.threat);
        if (thr) advisor._msgLog.push({ type: 'them', sender: advisor.name, text: personalize(thr, state), time: now() });
      }
    }

    // Pending reaction ("I told you so") — delivered into the chat log the
    // first time the player opens this messenger; badge cleared by consuming it
    if (advisor.pendingReactionMsg) {
      advisor._msgLog.push({ type: 'them', sender: advisor.name, text: personalize(advisor.pendingReactionMsg, state), time: now() });
      advisor.pendingReactionMsg = null;
    }

    const trust    = Math.round(advisor.trust);
    const status   = trustStatus(trust);
    const cardCls  = advisorCardClass(trust, advisor.betrayed);
    const initials = advisor.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    let tpClass = 'tp-neut';
    if (trust < 40)  tpClass = 'tp-warn';
    if (trust >= 70) tpClass = 'tp-safe';

    const agendaPct  = Math.min(100, advisor.agendaProgress ?? 0);
    const showAgenda = agendaPct > 25;

    const qrs = advisor.dialogue?.quick_replies?.length
      ? advisor.dialogue.quick_replies
      : [
          "What's your assessment of the situation?",
          "Any concerns I should know about?",
          "I need your full support on this.",
          "Are you with me or not?",
        ];

    const msgHTML = advisor._msgLog.map(m => {
      if (m.type === 'sys') return `<div class="msg" style="align-self:center"><div class="bub sys">${m.text}</div></div>`;
      return `
        <div class="msg ${m.type}">
          <div class="bub ${m.type}">${m.text}</div>
          <div class="mm">${m.sender ? m.sender + ' - ' : ''}${m.time ?? ''}</div>
        </div>`;
    }).join('');

    return `
      <div class="screen msg-screen-override">
        <div class="msg-wrap">
          <div class="msg-top">
            <div class="back-btn" id="btn-back">back</div>
            <div class="av ${cardCls === 'sus' ? 'sus' : ''}">${initials}</div>
            <div>
              <div class="adv-nm">${advisor.name}</div>
              <div class="adv-rl">${advisor.domain}</div>
            </div>
            <div class="tp ${tpClass}">${status.label} - ${trust}%</div>
          </div>
          <div class="ctx">Turn ${state.turn} - ${state.activeCrises.length ? 'Crisis active' : 'City stable'} - Trust: ${trust}%</div>
          <div class="msgs" id="msg-list">
            ${msgHTML}
            ${showAgenda ? `
              <div class="agenda">
                <div class="ag-l">ATTENTION - AGENDA PROGRESS</div>
                ${advisor.name}'s hidden agenda is advancing. Their actions may not align with city interests.
                <div class="ag-progress"><div class="ag-fill" style="width:${agendaPct}%"></div></div>
                <div class="ag-label"><span>Betrayal imminent at 100%</span><span>${agendaPct}%</span></div>
              </div>` : ''}
            ${MessengerScreen._renderRecommendation(state, advisor)}
            ${MessengerScreen._renderConsult(state, advisor)}
            ${MessengerScreen._renderEmergencyPower(state, advisor)}
            ${MessengerScreen._renderLoverDemand(state, advisor)}
            ${MessengerScreen._renderPartnerDemand(state, advisor)}
            ${MessengerScreen._renderFundingRequest(state, advisor)}
            ${MessengerScreen._renderBackChannel(state, advisor)}
            ${MessengerScreen._renderResign(state, advisor)}
          </div>
          <div class="qr-bar">
            <div class="qr-l">CHOOSE RESPONSE</div>
            <div class="qrs">
              ${qrs.slice(0, 4).map((qr, i) => {
                const dng = trust < 40 && i >= 2 ? 'dng' : '';
                return `<div class="qr ${dng}" data-qr-index="${i}">${qr}</div>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>`;
  }

  static _renderRecommendation(state, advisor) {
    const recs   = state.pendingDecisionRecommendations ?? {};
    const recIdx = recs[advisor.id];
    if (recIdx === undefined) return '';

    const decision = state.getNextDecision?.();
    if (!decision) return '';

    const opt = decision.options[recIdx];
    if (!opt) return '';

    // Rendered as a normal chat bubble: the advisor makes their case (the
    // option's authored advisor_reason), then names their pick
    const reason = opt.advisor_reason
      ? `<div class="adv-rec-reason">${opt.advisor_reason}</div>`
      : '';

    return `
      <div class="msg them">
        <div class="bub them adv-rec">
          <div class="adv-rec-header">\u{1F4CB} RECOMMENDATION</div>
          ${reason}
          <div class="adv-rec-body">
            My recommendation: <strong>${opt.label ?? opt.tag ?? `Option ${recIdx + 1}`}</strong>
          </div>
          <div class="adv-rec-note">Following my advice +3 trust &middot; Ignoring -2 trust</div>
        </div>
        <div class="mm">${advisor.name}</div>
      </div>`;
  }

  static _renderConsult(state, advisor) {
    if (advisor.betrayed) return '';
    if (advisor.consultedTurn === state.turn) {
      return `<div class="consult-done">They've given you their read for today.</div>`;
    }
    const noAP = (state.actionPoints ?? 0) <= 0;
    const recIds = Object.keys(state.pendingDecisionRecommendations ?? {});
    const verifying = recIds.some(id => id !== advisor.id);
    const label = verifying ? 'VERIFY TODAY’S ADVICE' : 'ASK FOR A FORECAST';
    const desc = verifying
      ? 'Have them quietly check whether today’s recommendation is honest. They’re usually right. Usually.'
      : 'Their private read on what’s coming — deficits, unrest, the press.';
    return `
      <div class="consult-box">
        <button class="consult-btn" data-consult="${advisor.id}" ${noAP ? 'disabled' : ''}>
          \u{1F50D} ${label} <span class="consult-cost">(1 hour${noAP ? ' — none left' : ''})</span>
        </button>
        <div class="consult-desc">${desc}</div>
      </div>`;
  }

  // Voluntary resignation — handled as a formal act through your most trusted
  // advisor in post (your de-facto Chief of Staff). Deliberate and in-fiction,
  // rather than a settings switch.
  static _renderResign(state, advisor) {
    const inPost = state.advisors.filter(a => !a.betrayed);
    const chief = (inPost.length ? inPost : state.advisors)
      .slice()
      .sort((a, b) => (b.trust ?? 0) - (a.trust ?? 0))[0];
    if (!chief || chief.id !== advisor.id) return '';
    return `
      <div class="resign-office">
        <div class="ro-l">&#9099; STEP DOWN</div>
        <div class="ro-d">Tell ${advisor.name}, your most trusted advisor, that you're ready to leave office. Your term ends now and the final report is written. This is recorded as a resignation.</div>
        <button class="ro-btn" data-resign-office="1">Step down from office</button>
      </div>`;
  }

  // In-game confirmation modal (replaces the browser's native confirm()).
  static _confirmResign(container, onConfirm) {
    const host = container.querySelector('.screen') || container;
    if (host.querySelector('.confirm-overlay')) return;
    const ov = document.createElement('div');
    ov.className = 'confirm-overlay';
    ov.innerHTML = `
      <div class="confirm-modal">
        <div class="confirm-l">&#9099; STEP DOWN FROM OFFICE</div>
        <div class="confirm-b">Your term ends immediately and this is recorded as a resignation. There is no walking it back.</div>
        <div class="confirm-acts">
          <button class="confirm-cancel">STAY IN OFFICE</button>
          <button class="confirm-ok">RESIGN</button>
        </div>
      </div>`;
    host.appendChild(ov);
    const close = () => ov.remove();
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelector('.confirm-cancel').addEventListener('click', close);
    ov.querySelector('.confirm-ok').addEventListener('click', () => { close(); onConfirm(); });
  }

  static _renderEmergencyPower(state, advisor) {
    if (advisor.emergencyPowerUsed) return '';
    const power = EMERGENCY_POWERS[domainOf(advisor)];
    if (!power) return '';
    if (!power.condition(state, advisor)) return '';

    return `
      <div class="adv-ep">
        <div class="adv-ep-header">&#x26A1; EMERGENCY POWER</div>
        <div class="adv-ep-desc">${power.desc}</div>
        <div class="adv-ep-note">${power.note}</div>
        <button class="adv-ep-btn" data-use-emergency="${advisor.id}">
          ACTIVATE -- ${power.label}
        </button>
        <div class="adv-ep-warn">One-time use &middot; -8 trust</div>
      </div>`;
  }

  static _renderLoverDemand(state, advisor) {
    const d = state.pendingLoverDemand;
    if (!d || d.advisorId !== advisor.id) return '';
    const ask = d.type === 'fund'
      ? `"My district needs that community center. 30M and it breaks ground next month. For me?"`
      : `"My cousin's case... it could just go away, couldn't it? One word from you."`;
    const cost = d.type === 'fund' ? '-30M, +5 trust' : '+1 heat, +5 trust';
    return `
      <div class="adv-bc lover-demand">
        <div class="adv-bc-header">&#x1F498; ${advisor.name.toUpperCase()} ASKS</div>
        <div class="ld-ask">${ask}</div>
        <button class="bc-action" data-lover-demand="accept">
          <span class="bca-label">DO IT FOR THEM</span>
          <span class="bca-note">${cost}</span>
        </button>
        <button class="bc-action" data-lover-demand="refuse">
          <span class="bca-label">REFUSE</span>
          <span class="bca-note">The relationship cools one step</span>
        </button>
      </div>`;
  }

  static _renderFundingRequest(state, advisor) {
    const r = state.pendingFundingRequest;
    if (!r || r.advisorId !== advisor.id) return '';
    const afford = (state.budget ?? 0) >= r.amount;
    const acc = r.accept || {};
    const parts = [`-${r.amount}M`];
    if (acc.trust)    parts.push(`+${acc.trust} trust`);
    if (acc.approval) parts.push(`${acc.approval > 0 ? '+' : ''}${acc.approval}% approval`);
    if (acc.scandalRisk) parts.push(`${Math.round(acc.scandalRisk * 100)}% scandal`);
    const dec = r.decline || {};
    const decNote = dec.trust ? `${dec.trust} trust` : 'they remember this';
    return `
      <div class="adv-bc partner-demand">
        <div class="adv-bc-header">&#x1F4B0; ${advisor.name.toUpperCase()} REQUESTS FUNDING</div>
        <div class="ld-ask">${r.ask}</div>
        <button class="bc-action" data-fund-request="accept" ${afford ? '' : 'disabled'}>
          <span class="bca-label">FUND IT</span>
          <span class="bca-note">${afford ? parts.join(' &middot; ') : `Treasury needs ${r.amount}M`}</span>
        </button>
        <button class="bc-action" data-fund-request="refuse">
          <span class="bca-label">DECLINE</span>
          <span class="bca-note">${decNote}</span>
        </button>
      </div>`;
  }

  static _renderPartnerDemand(state, advisor) {
    const d = state.pendingPartnerDemand;
    if (!d || d.advisorId !== advisor.id) return '';
    if (d.type === 'blackmail') {
      const pay = d.demand ?? 50;
      return `
      <div class="adv-bc partner-demand">
        <div class="adv-bc-header">&#x1F92B; YOUR PARTNER IS BLACKMAILING YOU</div>
        <div class="ld-ask">"I kept every receipt, Governor. Every transfer. ${pay}M and the file stays in my drawer. Refuse, and it goes to Civic Oversight."</div>
        <button class="bc-action" data-partner-demand="accept">
          <span class="bca-label">PAY FOR SILENCE</span>
          <span class="bca-note">-${pay}M personal &middot; +4 trust</span>
        </button>
        <button class="bc-action" data-partner-demand="refuse">
          <span class="bca-label">CALL THEIR BLUFF</span>
          <span class="bca-note">They betray you &middot; scrutiny spikes</span>
        </button>
      </div>`;
    }
    const isCut = d.type === 'bigger_cut';
    const ask = isCut
      ? `"My people are taking all the risk out there. We need a bigger cut — 25M keeps everyone smiling and silent."`
      : `"I don't like it. Someone's been asking questions at the depot. Maybe we go quiet for a while... maybe we stop."`;
    return `
      <div class="adv-bc partner-demand">
        <div class="adv-bc-header">&#x1F91D; YOUR PARTNER NEEDS AN ANSWER</div>
        <div class="ld-ask">${ask}</div>
        <button class="bc-action" data-partner-demand="accept">
          <span class="bca-label">${isCut ? 'PAY THEM' : 'LIE LOW'}</span>
          <span class="bca-note">${isCut ? '-25M personal, +5 trust' : 'No skim or discovery risk next turn'}</span>
        </button>
        <button class="bc-action" data-partner-demand="refuse">
          <span class="bca-label">REFUSE</span>
          <span class="bca-note">${isCut ? 'Trail thickens, -8 trust' : 'Trail thickens, -5 trust'}</span>
        </button>
      </div>`;
  }

  static _renderBackChannel(state, advisor) {
    if (advisor.betrayed) return '';

    // Active scheme status (always visible while a pact runs)
    let pactHtml = '';
    if (advisor.corruptPact) {
      const riskPct = Math.round((0.05 + 0.01 * (advisor.pactTurns ?? 0)) * 100);
      pactHtml = `
        <div class="bc-status">
          ACTIVE SCHEME &middot; turn ${advisor.pactTurns ?? 0} &middot;
          skimmed ${advisor.totalSkimmed ?? 0}M &middot;
          discovery risk ${riskPct}%/turn
        </div>`;
    }

    const available = Object.entries(BACK_CHANNEL_ACTIONS)
      .filter(([, a]) => a.condition(state, advisor));

    if (!available.length && !pactHtml) return '';

    const used = state.backChannelUsedTurn === state.turn;
    const body = used
      ? `<div class="bc-used">Back channel already used this turn.</div>`
      : available.map(([id, a]) => `
          <button class="bc-action" data-back-channel="${id}">
            <span class="bca-label">${a.label}</span>
            <span class="bca-desc">${a.desc}</span>
            <span class="bca-note">${a.note}</span>
          </button>`).join('');

    return `
      <div class="adv-bc">
        <div class="adv-bc-header">&#x1F56F; BACK CHANNEL</div>
        ${pactHtml}
        ${body}
        <div class="adv-bc-warn">One back-channel action per turn &middot; nothing here is deniable forever</div>
      </div>`;
  }

  static bind(state, activeAdvisorId, container, handlers, reRenderCallback) {
    const advisor = state.advisors.find(a => a.id === activeAdvisorId);
    if (!advisor) return;

    const msgList = container.querySelector('#msg-list');
    if (msgList) {
      // Defer scroll until after the browser has painted the layout —
      // synchronous scrollTop = scrollHeight doesn't work on mobile because
      // the browser hasn't resolved the final scrollHeight yet at bind time.
      requestAnimationFrame(() => {
        msgList.scrollTop = msgList.scrollHeight;
      });
    }

    container.querySelector('#btn-back')?.addEventListener('click', () => {
      handlers.backToDispatch();
    });

    container.querySelectorAll('.qr[data-qr-index]').forEach(btn => {
      btn.addEventListener('click', () => {
        const isDangerous = btn.classList.contains('dng');
        const index = parseInt(btn.dataset.qrIndex);

        advisor._msgLog.push({ type: 'me', text: btn.textContent.trim(), time: now() });

        // Chatting is just talk — it does NOT build trust. Trust is earned
        // through real choices (serving their domain, funding their ministry,
        // the back channel), never by spamming quick replies. A hostile reply
        // still has a real cost.
        if (isDangerous) {
          advisor.trust = Math.max(0, advisor.trust - 5);
          advisor.agendaProgress = Math.min(100, (advisor.agendaProgress ?? 0) + 10);
        }

        let response;
        if (isDangerous && advisor.dialogue?.threat?.length) {
          response = pick(advisor.dialogue.threat);
        } else if (advisor.agendaProgress >= 80 && advisor.dialogue?.betrayal_warning?.length) {
          response = pick(advisor.dialogue.betrayal_warning);
        } else {
          response = pick(advisor.dialogue?.briefing) ?? '...';
        }
        advisor._msgLog.push({ type: 'them', sender: advisor.name, text: personalize(response, state), time: now() });

        reRenderCallback();
      });
    });

    container.querySelector('[data-use-emergency]')?.addEventListener('click', (e) => {
      handlers.useEmergencyPower?.(e.currentTarget.dataset.useEmergency);
    });

    container.querySelector('[data-consult]')?.addEventListener('click', (e) => {
      handlers.consultAdvisor?.(e.currentTarget.dataset.consult);
    });

    container.querySelector('[data-resign-office]')?.addEventListener('click', () => {
      MessengerScreen._confirmResign(container, () => handlers.resignEarly?.());
    });

    container.querySelectorAll('[data-back-channel]').forEach(btn => {
      btn.addEventListener('click', () => {
        handlers.backChannelAction?.(activeAdvisorId, btn.dataset.backChannel);
      });
    });

    container.querySelectorAll('[data-lover-demand]').forEach(btn => {
      btn.addEventListener('click', () => {
        handlers.loverDemand?.(btn.dataset.loverDemand === 'accept');
      });
    });

    container.querySelectorAll('[data-fund-request]').forEach(btn => {
      btn.addEventListener('click', () => handlers.fundDomain?.(btn.dataset.fundRequest === 'accept'));
    });

    container.querySelectorAll('[data-partner-demand]').forEach(btn => {
      btn.addEventListener('click', () => {
        handlers.partnerDemand?.(btn.dataset.partnerDemand === 'accept');
      });
    });
  }
}
