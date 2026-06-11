import { chance } from '../utils/random.js';

const AGENDA_MAX = 100;
const BETRAYAL_THRESHOLD = 80;

export class ConsequenceSim {
  constructor(state, advisorSystem, scandalSystem) {
    this.state = state;
    this.advisorSystem = advisorSystem;
    this.scandalSystem = scandalSystem;
  }

  apply(cons, meta = {}) {
    if (!cons) return;
    const s = this.state;

    s.shiftApproval(cons.approval_delta ?? 0);
    s.shiftBudget(cons.budget_delta ?? 0);

    // Advisor trust/agenda effects
    for (const effect of (cons.advisor_effects ?? [])) {
      // advisor_id in content is a canonical domain ('finance'); findAdvisor
      // resolves it even when the picked candidate has a unique id
      const advisor = s.findAdvisor ? s.findAdvisor(effect.advisor_id) : s.getAdvisor(effect.advisor_id);
      if (advisor) {
        advisor.trust = Math.max(0, Math.min(100, advisor.trust + (effect.trust_delta ?? 0)));
        advisor.agendaProgress = Math.min(AGENDA_MAX, (advisor.agendaProgress ?? 0) + (effect.betrayal_risk_delta ?? 0));
        // Layer 3: positive trust_delta means player acted in advisor's interest →
        //          counter their agenda (good decisions slow betrayal clock)
        if ((effect.trust_delta ?? 0) > 0) {
          advisor.agendaProgress = Math.max(0, advisor.agendaProgress - Math.floor(effect.trust_delta * 1.5));
        }

        // Check betrayal threshold
        if (!advisor.betrayed && advisor.agendaProgress >= BETRAYAL_THRESHOLD) {
          this.advisorSystem.triggerBetrayal(advisor);
        }
      }
    }

    // Unlock follow-up systems
    if (cons.unlocks_crisis_id) {
      s.pendingCrisis = cons.unlocks_crisis_id;
    }
    if (cons.unlocks_decision_id) {
      s.setFlag(`decision_${cons.unlocks_decision_id}`, true);
    }

    // Scandal check
    if (cons.scandal_risk && chance(cons.scandal_risk / 100)) {
      this.scandalSystem.trigger(meta.sourceId);
    }
  }
}
