import { renderTopBar } from '../components/top-bar.js';
import { renderReportCard } from '../components/report-card.js';
import { govRaw, govLast } from '../../utils/governor.js';

export class ReportScreen {
  static render(state) {
    const scandalExit = state.endReason === 'career_ending_scandal';
    const walkedAway  = state.endReason === 'resigned';
    const resigned = scandalExit || walkedAway;
    const recalled = !resigned && (state.endReason === 'recalled' || state.approval <= 0);
    const decisions = state.pastDecisions;

    const worstDecision = decisions.reduce((worst, d) => {
      const delta = d.consequences?.approval_delta ?? 0;
      return (worst === null || delta < worst.delta) ? { ...d, delta } : worst;
    }, null);

    // Domain scores from advisor trust
    const domainDefs = [
      { id: 'finance',           name: 'FINANCE'        },
      { id: 'military_liaison',  name: 'SECURITY'       },
      { id: 'urban_planning',    name: 'INFRASTRUCTURE' },
      { id: 'transport',         name: 'TRANSPORT'      },
    ];
    const domainColor = s => s >= 60 ? 'var(--color-green)' : s >= 40 ? 'var(--color-amber)' : 'var(--color-red)';
    const domainGrade = s => s >= 60 ? 'Good' : s >= 40 ? 'Fair' : 'Poor';

    const domainsHTML = domainDefs.map(d => {
      const adv   = state.advisors.find(a => a.id === d.id);
      const score = adv ? Math.round(adv.trust) : 50;
      const col   = domainColor(score);
      return `
        <div class="domain">
          <div class="d-name">${d.name}</div>
          <div class="d-bar-wrap"><div class="d-bar" style="width:${score}%;background:${col}"></div></div>
          <div class="d-score" style="color:${col}">${score} / 100 - ${domainGrade(score)}</div>
        </div>`;
    }).join('');

    const loyal = state.advisors.filter(a => !a.betrayed && a.trust >= 60).length;
    const total = state.advisors.length;

    const cityReaction = state.approval >= 60 ? 'Satisfied' : state.approval >= 40 ? 'Skeptical' : 'Outraged';
    const cityCol      = domainColor(state.approval);

    // Outcome
    let outcomeTitle, outcomeDesc, primaryCls;
    if (walkedAway) {
      outcomeTitle = 'RESIGNED';
      outcomeDesc  = `You walked away on your own terms at turn ${state.turn}. The city shrugs and moves on.`;
      primaryCls   = '';
    } else if (scandalExit) {
      const gambled = state.flags?.miracle_failed;
      const scName = state.endScandal?.title ? `"${state.endScandal.title}"` : 'a career-ending scandal';
      outcomeTitle = gambled ? 'THE LAST STAND FAILED' : 'RESIGNED IN DISGRACE';
      outcomeDesc  = gambled
        ? `You gambled 150M on a desperate last stand over ${scName} — and lost. The scandal ended your career anyway.`
        : `${scName} forced you to resign before the end of your term.`;
      primaryCls   = '';
    } else if (recalled) {
      outcomeTitle = 'RECALLED';
      outcomeDesc  = 'Public confidence collapsed. Your term ended early.';
      primaryCls   = '';
    } else if (state.approval >= 65 && (() => {
      // More than one problem left undecided = no invitation, period.
      const unresolved = (state.presentedDecisions ?? []).filter(id =>
        !state.pastDecisions.some(p => p.decisionId === id)).length;
      return unresolved <= 1;
    })()) {
      outcomeTitle = 'INVITATION RECEIVED';
      outcomeDesc  = `Your ${state.approval}% approval earned recognition. A senior position awaits.`;
      primaryCls   = 'primary';
    } else if (state.approval >= 65) {
      outcomeTitle = 'NO INVITATION — UNFINISHED BUSINESS';
      outcomeDesc  = `Your ${state.approval}% approval impressed. The stack of unanswered problems on your desk did not.`;
      primaryCls   = '';
    } else {
      outcomeTitle = 'NO INVITATION';
      outcomeDesc  = `Your ${state.approval}% approval was noted but not rewarded. The city moves on.`;
      primaryCls   = '';
    }

    const roastBody = state.city?.opening_sequence?.intro_body
      ?? `Another governor, another term. The city has seen it all before. Some things improved, others didn't. History will record the numbers and forget the context.`;

    return `
      <div class="screen">
        ${renderTopBar(state)}
        <div class="report-screen">
          <div class="report-header">
            <div class="rh-kicker">END OF TERM &middot; ${(state.city?.city_name ?? 'CITY').toUpperCase()} &middot; ${state.turn * 6} WEEKS IN OFFICE</div>
            <div class="rh-title">${resigned ? 'RESIGNED - ' : recalled ? 'RECALLED - ' : ''}${govRaw(state) ? `The ${govLast(state)} Administration` : `Final Report - ${state.city?.city_name ?? 'City'}`}</div>
            <div class="rh-sub">${walkedAway ? 'You left office voluntarily.' : scandalExit ? 'The scandal could not be survived.' : recalled ? 'Public confidence collapsed.' : 'Term completed. That alone is an achievement.'}</div>
          </div>
          ${state.endScandal ? `
            <div class="resign-box">
              <div class="resign-l">${scandalExit ? 'WHY YOU RESIGNED' : 'WHAT BROUGHT YOU DOWN'} &middot; ${String(state.endScandal.tier || 'major').replace('_', ' ').toUpperCase()} SCANDAL</div>
              <div class="resign-t"><strong>${state.endScandal.title}</strong>${state.endScandal.description ? ` — ${state.endScandal.description}` : ''}</div>
            </div>` : ''}
          ${renderReportCard(state)}
          <div class="domain-grid">${domainsHTML}</div>
          <div class="verdict-grid">
            <div class="verdict">
              <div class="v-name">CITY REACTION</div>
              <div class="v-val" style="color:${cityCol}">${cityReaction}</div>
              <div class="v-label">${state.approval}% final approval</div>
            </div>
            <div class="verdict">
              <div class="v-name">ADVISOR LOYALTY</div>
              <div class="v-val" style="color:${domainColor(loyal / total * 100)}">${loyal} / ${total}</div>
              <div class="v-label">${loyal === total ? 'Full loyalty' : 'Some betrayals'}</div>
            </div>
            <div class="verdict">
              <div class="v-name">CRISES SURVIVED</div>
              <div class="v-val" style="color:var(--color-amber)">${state.pastCrises.length}</div>
              <div class="v-label">out of ${Math.min(3, state.city?.crises?.length ?? 3)} possible</div>
            </div>
          </div>
          ${worstDecision ? `
            <div class="worst-box">
              <div class="worst-l">WORST DECISION</div>
              <div class="worst-t">Turn ${worstDecision.turn} - ${worstDecision.decisionId}. Approval delta: ${worstDecision.delta >= 0 ? '+' : ''}${worstDecision.delta}.</div>
            </div>` : ''}
          ${(() => {
            const dd = state.dirtyDeeds ?? {};
            const dirty = (dd.skimmed ?? 0) + (dd.threats ?? 0) + (dd.leaks ?? 0) + (dd.exposed ?? 0) + (dd.marketBuys ?? 0) > 0;
            return dirty ? `
            <div class="worst-box">
              <div class="worst-l">DIRTY HANDS</div>
              <div class="worst-t">Skimmed ${dd.skimmed ?? 0}M from the treasury &middot; ${dd.threats ?? 0} threat(s) &middot; ${dd.leaks ?? 0} leak(s) &middot; ${dd.marketBuys ?? 0} black market deal(s) &middot; ${dd.exposed ?? 0} scheme(s) exposed. History keeps receipts.</div>
            </div>` : `
            <div class="worst-box">
              <div class="worst-l">CLEAN HANDS</div>
              <div class="worst-t">No back-channel schemes this term. The auditors found nothing — because there was nothing.</div>
            </div>`;
          })()}
          ${(() => {
            // BACKROOM RELATIONS: what really happened between you and them
            const lines = state.advisors.map(a => {
              const bits = [];
              if (a.sacrificed) bits.push('thrown under the bus');
              else if (a.betrayed) bits.push('betrayed you');
              if (a.relationshipType === 'romantic' && !a.betrayed) bits.push(a.romanceExposed ? 'your lover — exposed, stayed' : 'your secret lover');
              else if (a.romanceExposed) bits.push('the affair that went public');
              if ((a.scorned ?? 0) > 0) bits.push('scorned ex-lover');
              if ((a.totalSkimmed ?? 0) > 0) bits.push(`pact partner (${a.totalSkimmed}M skimmed)`);
              if ((a.threatCount ?? 0) > 0) bits.push(`threatened ×${a.threatCount}`);
              if (a.leakUsed) bits.push('smeared in the press by your office');
              if (!bits.length && a.relationshipType === 'rivalry') bits.push('open rivalry');
              return bits.length ? `<div class="br-line"><strong>${a.name}</strong> — ${bits.join(' · ')}</div>` : '';
            }).filter(Boolean);
            return lines.length ? `
            <div class="worst-box">
              <div class="worst-l">BACKROOM RELATIONS</div>
              <div class="worst-t">${lines.join('')}</div>
            </div>` : '';
          })()}
          <div class="roast-box">
            <div class="roast-l">CITY SPEAKS</div>
            <div class="roast-t">"${roastBody}"</div>
          </div>
          <div class="outcome-section">
            <div class="outcome-text">
              <strong>${outcomeTitle}.</strong> ${outcomeDesc}
            </div>
            <div class="outcome-actions">
              <div class="oa-btn ${primaryCls}" id="btn-restart">Main Menu</div>
            </div>
          </div>
        </div>
      </div>`;
  }

  static bind(container) {
    container.querySelector('#btn-restart')?.addEventListener('click', () => window.location.reload());
  }
}
