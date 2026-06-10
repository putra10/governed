import { trustStatus, advisorCardClass, pick, now } from '../ui-helpers.js';
import { EMERGENCY_POWERS, BACK_CHANNEL_ACTIONS } from '../../engine/advisor-system.js';

export class MessengerScreen {
  static render(state, activeAdvisorId) {
    const advisor = state.advisors.find(a => a.id === activeAdvisorId);
    if (!advisor) return '';

    if (!advisor._msgLog) {
      advisor._msgLog = [];
      advisor._msgLog.push({ type: 'sys', text: `${advisor.name} is available for consultation.` });
      const brief = pick(advisor.dialogue?.briefing);
      if (brief) advisor._msgLog.push({ type: 'them', sender: advisor.name, text: brief, time: now() });
      const trust = Math.round(advisor.trust);
      if (trust < 40) {
        const warn = pick(advisor.dialogue?.betrayal_warning);
        if (warn) advisor._msgLog.push({ type: 'them', sender: advisor.name, text: warn, time: now() });
      } else if (trust < 60) {
        const thr = pick(advisor.dialogue?.threat);
        if (thr) advisor._msgLog.push({ type: 'them', sender: advisor.name, text: thr, time: now() });
      }
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
      <div class="screen">
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
            ${MessengerScreen._renderEmergencyPower(state, advisor)}
            ${MessengerScreen._renderBackChannel(state, advisor)}
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

    return `
      <div class="adv-rec">
        <div class="adv-rec-header">\u{1F4CB} RECOMMENDATION</div>
        <div class="adv-rec-body">
          I'd recommend: <strong>${opt.label ?? opt.tag ?? `Option ${recIdx + 1}`}</strong>
        </div>
        <div class="adv-rec-note">Following my advice +3 trust &middot; Ignoring -2 trust</div>
      </div>`;
  }

  static _renderEmergencyPower(state, advisor) {
    if (advisor.emergencyPowerUsed) return '';
    const power = EMERGENCY_POWERS[advisor.id];
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
    if (msgList) msgList.scrollTop = msgList.scrollHeight;

    container.querySelector('#btn-back')?.addEventListener('click', () => {
      handlers.backToDispatch();
    });

    container.querySelectorAll('.qr[data-qr-index]').forEach(btn => {
      btn.addEventListener('click', () => {
        const isDangerous = btn.classList.contains('dng');
        const index = parseInt(btn.dataset.qrIndex);

        advisor._msgLog.push({ type: 'me', text: btn.textContent.trim(), time: now() });

        if (isDangerous) {
          advisor.trust = Math.max(0, advisor.trust - 5);
          advisor.agendaProgress = Math.min(100, (advisor.agendaProgress ?? 0) + 10);
        } else {
          advisor.trust = Math.min(100, advisor.trust + 2);
        }

        let response;
        if (isDangerous && advisor.dialogue?.threat?.length) {
          response = pick(advisor.dialogue.threat);
        } else if (advisor.agendaProgress >= 80 && advisor.dialogue?.betrayal_warning?.length) {
          response = pick(advisor.dialogue.betrayal_warning);
        } else {
          response = pick(advisor.dialogue?.briefing) ?? '...';
        }
        advisor._msgLog.push({ type: 'them', sender: advisor.name, text: response, time: now() });

        reRenderCallback();
      });
    });

    container.querySelector('[data-use-emergency]')?.addEventListener('click', (e) => {
      handlers.useEmergencyPower?.(e.currentTarget.dataset.useEmergency);
    });

    container.querySelectorAll('[data-back-channel]').forEach(btn => {
      btn.addEventListener('click', () => {
        handlers.backChannelAction?.(activeAdvisorId, btn.dataset.backChannel);
      });
    });
  }
}
