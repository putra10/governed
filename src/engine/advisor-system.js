// src/engine/advisor-system.js
import { randomPick, random } from '../utils/random.js';

// ── Crisis Secret Options (mirrored from crisis-screen for engine use) ────────
export const ADVISOR_SECRET_CRISIS_OPTIONS = {
  finance:          { approval_delta: 2,  budget_delta: -30 },
  military_liaison: { approval_delta: 6,  budget_delta: -20 },
  urban_planning:   { approval_delta: 8,  budget_delta: -25 },
  religious_affairs:{ approval_delta: 7,  budget_delta: -10 },
  transport:        { approval_delta: 4,  budget_delta: -15 },
};

// ── Emergency Powers ──────────────────────────────────────────────────────────
// One-time panic actions per advisor. Shown in messenger when conditions are met.
export const EMERGENCY_POWERS = {
  finance: {
    label: 'EMERGENCY LOAN',
    desc:  'Secure emergency bridge financing. Stabilises the budget but dents public confidence.',
    note:  '+80M budget, −5 approval',
    condition: (s, adv) => s.budget < -50 && (adv.trust ?? 50) >= 45,
    apply:     (s) => { s.shiftBudget(80); s.shiftApproval(-5); },
  },
  military_liaison: {
    label: 'MARSHAL FORCES',
    desc:  'Deploy military presence. Suppresses the active unrest event at zero political cost.',
    note:  'Clears riot/demo/strike instantly',
    condition: (s, adv) => !!s.pendingUnrest && (adv.trust ?? 50) >= 50,
    apply:     (s) => { s.pendingUnrest = null; },
  },
  urban_planning: {
    label: 'COMMUNITY INITIATIVE',
    desc:  'Launch emergency community outreach. Expensive but boosts morale quickly.',
    note:  '+10 approval, −20M budget',
    condition: (s, adv) => s.approval < 45 && (adv.trust ?? 50) >= 45,
    apply:     (s) => { s.shiftApproval(10); s.shiftBudget(-20); },
  },
  religious_affairs: {
    label: 'UNITY SERMON',
    desc:  'Call a city-wide day of reflection. Temporarily unites divided factions.',
    note:  '+7 approval',
    condition: (s, adv) => s.approval < 50 && (adv.trust ?? 50) >= 45,
    apply:     (s) => { s.shiftApproval(7); },
  },
  transport: {
    label: 'EMERGENCY RELIEF ROUTES',
    desc:  'Open priority supply corridors. Eases economic strain on the ground.',
    note:  '+15M budget, −3 approval',
    condition: (s, adv) => s.budget < 0 && (adv.trust ?? 50) >= 45,
    apply:     (s) => { s.shiftBudget(15); s.shiftApproval(-3); },
  },
};

const AGENDA_MAX = 100;
const AGENDA_TICK = 5;
const BETRAYAL_THRESHOLD = 80;

// ── Back-channel actions (messenger) ─────────────────────────────────────────
// Player-initiated dirty politics. ONE action per turn across all advisors.
// Each action has a trigger condition (trust / approval / budget / leverage)
// that controls when it becomes operable — same pattern as EMERGENCY_POWERS.
export const BACK_CHANNEL_ACTIONS = {
  get_closer: {
    label: 'GET CLOSER',
    desc:  'Invest personal time in this advisor. Deepens the relationship one step.',
    note:  'Trigger: trust ≥ 50 · neutral → trust → romantic',
    condition: (s, adv) =>
      (adv.trust ?? 50) >= 50 &&
      (adv.relationshipType ?? 'neutral') !== 'romantic',
  },
  keep_distance: {
    label: 'KEEP YOUR DISTANCE',
    desc:  'Cool things off. Steps the relationship back one level — the only way out of a risky affair.',
    note:  'Romantic → trust → neutral → rivalry',
    condition: (s, adv) =>
      (adv.relationshipType ?? 'neutral') !== 'rivalry',
  },
  corrupt_pact: {
    label: 'PROPOSE CORRUPT PACT',
    desc:  'A quiet arrangement in their domain. Skims money into the budget every turn — discovery risk grows the longer it runs, and the paper trail never resets.',
    note:  'Trigger: trust ≥ 60 & budget < 150M · one active scheme at a time',
    condition: (s, adv) =>
      !adv.corruptPact &&
      (adv.trust ?? 50) >= 60 &&
      s.budget < 150 &&
      !s.advisors.some(a => a.corruptPact && !a.betrayed),
  },
  end_pact: {
    label: 'END THE SCHEME',
    desc:  'Wind down the arrangement. The paper trail lingers for two more turns.',
    note:  'Residual discovery risk: 2 turns',
    condition: (s, adv) => !!adv.corruptPact,
  },
  threaten: {
    label: 'THREATEN',
    desc:  'Use what you know about their agenda as leverage. Private and free — but it can backfire into the press, and repeated threats escalate.',
    note:  'Trigger: their agenda ≥ 40 & your approval ≥ 45 · third threat = they snap',
    condition: (s, adv) =>
      (adv.agendaProgress ?? 0) >= 40 &&
      s.approval >= 45 &&
      (adv.threatCount ?? 0) < 3,
  },
  leak: {
    label: 'LEAK DIRT',
    desc:  'Hand their file to a journalist. Their agenda collapses — but the story splashes on your office too.',
    note:  'Trigger: their agenda ≥ 50 & budget ≥ 30M (the journalist isn’t free) · once per advisor',
    condition: (s, adv) =>
      !adv.leakUsed &&
      (adv.agendaProgress ?? 0) >= 50 &&
      s.budget >= 30,
  },
};

// ── Relationship types ────────────────────────────────────────────────────────
// Advisors start at neutral. Relationship shifts over time based on player
// decisions, random events, and domain attention.
// romantic → extra loyalty each turn, but romance exposure is a scandal risk.
export const RELATIONSHIP_TYPES = ['neutral', 'trust', 'rivalry', 'romantic'];

// Per-turn bonuses by relationship type (applied in tickRelationships)
const RELATIONSHIP_BONUS = {
  trust:    { trustMod: +2 },           // High trust: decay slowed
  rivalry:  { trustMod: -4 },           // Active rivalry: decay accelerated
  neutral:  { trustMod: 0 },
  romantic: { trustMod: +4, scandalRisk: 0.05 }, // Loyalty spike, scandal risk
};

export class AdvisorSystem {
  constructor(state) {
    this.state = state;
  }

  tickAgendas(onBetrayal) {
    const s = this.state;
    for (const advisor of s.advisors) {
      if (advisor.betrayed) continue;

      advisor.agendaProgress = Math.min(AGENDA_MAX, (advisor.agendaProgress ?? 0) + AGENDA_TICK);

      // Layer 1: base trust decay — 2pts/turn regardless of relationship
      // Relationship modifier is applied on top in tickRelationships()
      advisor.trust = Math.max(0, (advisor.trust ?? 50) - 2);

      if (advisor.agendaProgress >= BETRAYAL_THRESHOLD) {
        this.triggerBetrayal(advisor, onBetrayal);
      }
    }
  }

  // ── Personal Layer: relationship evolution ────────────────────────────────────
  // Called once per turn after tickAgendas.
  // Applies relationship-based trust modifiers and checks romance exposure risk.
  tickRelationships(scandalSystem) {
    const s = this.state;
    for (const advisor of s.advisors) {
      if (advisor.betrayed) continue;
      const rel = advisor.relationshipType ?? 'neutral';
      const bonus = RELATIONSHIP_BONUS[rel] ?? RELATIONSHIP_BONUS.neutral;

      // Apply relationship trust modifier (stacks with base decay from tickAgendas)
      if (bonus.trustMod) {
        advisor.trust = Math.max(0, Math.min(100, (advisor.trust ?? 50) + bonus.trustMod));
      }

      // Romance exposure risk — 5% per turn if romantic and not yet exposed
      if (rel === 'romantic' && !advisor.romanceExposed && bonus.scandalRisk) {
        if (random() < bonus.scandalRisk && scandalSystem) {
          // triggerRomanceExposure RETURNS the severity string — capture it
          const severityAfterExposure =
            scandalSystem.triggerRomanceExposure(advisor.name) ?? 'moderate';
          if (['career_ending', 'major'].includes(severityAfterExposure)) {
            advisor.relationshipType = 'rivalry';
          }
        }
      }
    }
  }

  // ── Relationship shift ─────────────────────────────────────────────────────────
  // Called from consequence-sim or explicit player action (messenger screen).
  // delta: positive = warmer, negative = colder/worse
  shiftRelationship(advisorId, delta) {
    const s = this.state;
    const advisor = s.advisors.find(a => a.id === advisorId);
    if (!advisor || advisor.betrayed) return;

    const order = ['rivalry', 'neutral', 'trust', 'romantic'];
    const current = order.indexOf(advisor.relationshipType ?? 'neutral');
    if (current === -1) return;

    const next = Math.max(0, Math.min(order.length - 1, current + delta));
    advisor.relationshipType = order[next];

    // Romance can only develop from trust, not from neutral directly
    // (prevent instant romantic jumps)
    if (advisor.relationshipType === 'romantic' && order[current] !== 'trust') {
      advisor.relationshipType = 'trust';
    }

    console.log(`[Relationship] ${advisor.name}: ${order[current]} → ${advisor.relationshipType}`);
  }

  triggerBetrayal(advisor, onBetrayal) {
    advisor.betrayed = true;
    advisor.agendaProgress = AGENDA_MAX;

    // A betrayed advisor's back-channel offer is void — remove it so the
    // player can't pay for loyalty that no longer exists
    const s = this.state;
    if (s.pendingBribes?.length) {
      s.pendingBribes = s.pendingBribes.filter(b => b.advisorId !== advisor.id);
    }

    const line = advisor.dialogue?.betrayal ?? 'I can no longer serve you, Governor.';
    this.state.recentComments = [`⚠ BETRAYAL — ${advisor.name}: "${line}"`];

    // Betrayal costs approval; worse if relationship was romantic (public optics)
    const betrayalPenalty = advisor.relationshipType === 'romantic' ? -15 : -10;
    this.state.shiftApproval(betrayalPenalty);

    console.warn(`[BETRAYAL] ${advisor.name} (relationship: ${advisor.relationshipType ?? 'neutral'})`);
    if (onBetrayal) onBetrayal(advisor);
  }

  // ── Advisor Recommendations ───────────────────────────────────────────────────
  // Called in processTurn after decision is loaded. Domain-matched advisors
  // suggest the option with the best approval outcome.

  generateRecommendations(decision) {
    const s = this.state;
    s.pendingDecisionRecommendations = {};
    if (!decision) return;

    for (const advisor of s.advisors) {
      if (advisor.betrayed) continue;
      if (advisor.id !== decision._domain) continue;

      let best = 0;
      let bestDelta = -Infinity;
      decision.options.forEach((opt, i) => {
        const aD = opt.consequences?.approval_delta ?? 0;
        if (aD > bestDelta) { bestDelta = aD; best = i; }
      });
      s.pendingDecisionRecommendations[advisor.id] = best;
      console.log(`[Advisor] ${advisor.name} recommends option ${best} for "${decision.id}"`);
    }
  }

  generateBriefings() {
    const s = this.state;
    const advisors = s.advisors.filter(a => !a.betrayed);
    const comments = [];

    for (const advisor of advisors) {
      const dialogue = advisor.dialogue;
      if (!dialogue) continue;

      const rel   = advisor.relationshipType ?? 'neutral';
      const trust = advisor.trust ?? 50;
      let pool;
      if (rel === 'rivalry')       pool = dialogue.threat ?? dialogue.disagreement;
      else if (rel === 'romantic') pool = dialogue.briefing;
      else if (s.approval < 30)   pool = dialogue.roast;
      else if (trust < 40)        pool = dialogue.threat ?? dialogue.disagreement;
      else                        pool = dialogue.briefing;

      let line = randomPick(Array.isArray(pool) ? pool : [pool]);

      if (trust > 70) {
        const intel = this._generateIntel(advisor, s);
        if (intel) line = `[INTEL] ${intel}`;
      }

      if (line) {
        const prefix = rel === 'romantic' ? '💬' : rel === 'rivalry' ? '⚔' : '';
        comments.push(`${prefix}${advisor.name}: "${line}"`);
      }
    }

    if (comments.length) {
      s.recentComments = comments.slice(0, 3);
    }
  }

  _generateIntel(advisor, s) {
    const rate       = s.getTaxRate ? s.getTaxRate() : 50;
    const nextIncome = Math.round(rate * (s.approval / 100));
    switch (advisor.id) {
      case 'finance':
        if (s.budget + nextIncome < 0)
          return `Next turn budget projection: ${s.budget + nextIncome}M. Deficit likely — act now.`;
        if (s.consecutiveDeficitTurns >= 1)
          return `Deficit streak at ${s.consecutiveDeficitTurns} turn(s). Contract demand will spike soon.`;
        return null;
      case 'military_liaison':
        if (s.getAvailableCrises?.().length > 0 && [4, 8, 12].includes(s.turn + 1))
          return `Crisis window opens next turn. ${s.getAvailableCrises().length} threat(s) eligible.`;
        if (s.pendingUnrest)
          return `Civil unrest is active. Military intervention available via emergency power.`;
        return null;
      case 'urban_planning':
        if (s.budget < 0 && s.approval < 42)
          return `Unrest threshold approaching. Approval at ${s.approval}% with budget deficit.`;
        if (s.approval < 50)
          return `Public sentiment fragile at ${s.approval}%. Community programs recommended.`;
        return null;
      default:
        return null;
    }
  }

  generateBribeOffers() {
    const s = this.state;
    const BRIBE_THRESHOLD = 60;
    const BRIBE_CHANCE    = 0.30;

    for (const advisor of s.advisors) {
      if (advisor.betrayed) continue;
      if (advisor.agendaProgress < BRIBE_THRESHOLD) continue;
      if ((s.pendingBribes ?? []).some(b => b.advisorId === advisor.id)) continue;
      if (random() > BRIBE_CHANCE) continue;

      const cost = 50 + (advisor.competence_rating ?? 6) * 15;
      if (!s.pendingBribes) s.pendingBribes = [];
      s.pendingBribes.push({
        advisorId:       advisor.id,
        advisorName:     advisor.name,
        cost,
        agendaReduction: 30,
        trustGain:       15,
        scandalRisk:     0.25,
      });
      console.log(`[Bribe] ${advisor.name} offering deal (${cost}M)`);
    }
  }

  // ── Back-channel execution ──────────────────────────────────────────────────
  // Returns { ok, msg } — msg is shown in the messenger log.

  executeBackChannel(advisorId, actionId, scandalSystem, onBetrayal) {
    const s = this.state;
    if (!s.dirtyDeeds) s.dirtyDeeds = { skimmed: 0, threats: 0, leaks: 0, exposed: 0 };

    const advisor = s.advisors.find(a => a.id === advisorId && !a.betrayed);
    if (!advisor) return { ok: false, msg: 'This advisor is no longer available.' };
    if (s.backChannelUsedTurn === s.turn)
      return { ok: false, msg: 'You have already used the back channel this turn.' };

    const action = BACK_CHANNEL_ACTIONS[actionId];
    if (!action || !action.condition(s, advisor))
      return { ok: false, msg: 'Conditions are not met for that move.' };

    s.backChannelUsedTurn = s.turn;
    switch (actionId) {
      case 'get_closer':    return this._bcGetCloser(advisor);
      case 'keep_distance': return this._bcKeepDistance(advisor);
      case 'corrupt_pact':  return this._bcStartPact(advisor);
      case 'end_pact':      return this._bcEndPact(advisor);
      case 'threaten':      return this._bcThreaten(advisor, scandalSystem, onBetrayal);
      case 'leak':          return this._bcLeak(advisor, scandalSystem);
      default:              return { ok: false, msg: 'Unknown move.' };
    }
  }

  _bcGetCloser(advisor) {
    this.shiftRelationship(advisor.id, +1);
    advisor.trust = Math.min(100, (advisor.trust ?? 50) + 3);
    const rel = advisor.relationshipType;
    const msg = rel === 'romantic'
      ? `Things with ${advisor.name} have become... personal. (+4 trust/turn, 5%/turn exposure risk — permanent while it lasts)`
      : `You spent the evening with ${advisor.name}. The relationship deepens. (${rel})`;
    return { ok: true, msg };
  }

  _bcKeepDistance(advisor) {
    const wasRomantic = advisor.relationshipType === 'romantic';
    this.shiftRelationship(advisor.id, -1);
    const msg = wasRomantic
      ? `You ended it with ${advisor.name}. No more loyalty bonus — and what happened still happened.`
      : `You put some distance between yourself and ${advisor.name}. (${advisor.relationshipType})`;
    return { ok: true, msg };
  }

  _pactSkim() {
    const rate = this.state.getTaxRate ? this.state.getTaxRate() : 50;
    return Math.max(10, Math.round(rate * 0.25));
  }

  _bcStartPact(advisor) {
    advisor.corruptPact = true;
    // NOTE: pactTurns is cumulative across restarts — the trail never resets
    const skim = this._pactSkim();
    console.log(`[Back Channel] Corrupt pact with ${advisor.name}: ~+${skim}M/turn`);
    return { ok: true, msg: `${advisor.name} agrees. The arrangement starts next turn: ~+${skim}M per turn. Discovery risk grows every turn it runs.` };
  }

  _bcEndPact(advisor) {
    advisor.corruptPact = false;
    advisor.pactResidual = 2;
    return { ok: true, msg: `The scheme with ${advisor.name} is wound down. The paper trail lingers for 2 more turns.` };
  }

  _bcThreaten(advisor, scandalSystem, onBetrayal) {
    const s = this.state;
    const leverage = advisor.agendaProgress ?? 0;
    advisor.threatCount = (advisor.threatCount ?? 0) + 1;
    s.dirtyDeeds.threats++;

    // Third threat: they snap — immediate betrayal, no roll
    if (advisor.threatCount >= 3) {
      this.triggerBetrayal(advisor, onBetrayal);
      return { ok: true, msg: `${advisor.name} has had enough of your threats. They're gone — and they're talking.` };
    }

    // Backfire chance: scales down with leverage, doubles on the second threat
    const base     = Math.max(0.10, Math.min(0.35, 0.5 - leverage / 200));
    const backfire = base * advisor.threatCount;

    if (random() < backfire) {
      advisor.agendaProgress = Math.min(100, leverage + 20);
      s.dirtyDeeds.exposed++;
      if (scandalSystem) {
        scandalSystem._applyScandal({
          id: `threat_backfire_${advisor.id}_${s.turn}`,
          title: `Governor's Intimidation Tactics Exposed`,
          severity_tier: 'moderate',
        }, 'threat_backfire');
      }
      return { ok: true, msg: `${advisor.name} went straight to the press. The story is out — and they're angrier than ever. (agenda +20)` };
    }

    advisor.agendaProgress = Math.max(0, leverage - 30);
    advisor.trust = Math.max(0, (advisor.trust ?? 50) - 15);
    this.shiftRelationship(advisor.id, -1);
    return { ok: true, msg: `${advisor.name} backs down — for now. (agenda -30, trust -15, relationship worsens)` };
  }

  _bcLeak(advisor, scandalSystem) {
    const s = this.state;
    s.shiftBudget(-30);
    advisor.agendaProgress  = Math.max(0, (advisor.agendaProgress ?? 0) - 40);
    advisor.trust           = Math.max(0, (advisor.trust ?? 50) - 20);
    advisor.relationshipType = 'rivalry';
    advisor.leakUsed = true;
    s.dirtyDeeds.leaks++;

    // The story splashes on your office: moderate, 30% chance it goes major
    const tier = random() < 0.30 ? 'major' : 'moderate';
    if (scandalSystem) {
      scandalSystem._applyScandal({
        id: `leak_${advisor.id}_${s.turn}`,
        title: `City Hall Leak War — ${advisor.name} Smeared, Governor's Office Implicated`,
        severity_tier: tier,
      }, 'leak');
    }
    return { ok: true, msg: `The story runs tomorrow. ${advisor.name}'s agenda is in ruins (-40) — but everyone knows where the leak came from. (${tier} scandal)` };
  }

  // Called once per turn from processTurn — pays out active pacts and rolls discovery
  processCorruptPacts(scandalSystem) {
    const s = this.state;
    if (!s.dirtyDeeds) s.dirtyDeeds = { skimmed: 0, threats: 0, leaks: 0, exposed: 0 };

    for (const advisor of s.advisors) {
      if (advisor.betrayed) continue;

      if (advisor.corruptPact) {
        const skim = this._pactSkim();
        s.shiftBudget(skim);
        advisor.pactTurns    = (advisor.pactTurns ?? 0) + 1;
        advisor.totalSkimmed = (advisor.totalSkimmed ?? 0) + skim;
        s.dirtyDeeds.skimmed += skim;
        // Complicity reads as loyalty
        advisor.trust = Math.min(100, (advisor.trust ?? 50) + 2);
        console.log(`[Pact] ${advisor.name}: +${skim}M (turn ${advisor.pactTurns}, total ${advisor.totalSkimmed}M)`);

        const risk = 0.05 + 0.01 * advisor.pactTurns;
        if (random() < risk) this._exposePact(advisor, scandalSystem);
      } else if ((advisor.pactResidual ?? 0) > 0) {
        advisor.pactResidual--;
        if (random() < 0.04) this._exposePact(advisor, scandalSystem);
      }
    }
  }

  // Severity escalates with how long the scheme ran — the trail never resets
  _exposePact(advisor, scandalSystem) {
    const turns = advisor.pactTurns ?? 0;
    const tier  = turns <= 2 ? 'minor'
                : turns <= 5 ? 'moderate'
                : turns <= 8 ? 'major'
                :              'career_ending';
    if (scandalSystem) {
      scandalSystem._applyScandal({
        id: `pact_exposed_${advisor.id}`,
        title: `${advisor.name} Corruption Scheme Exposed — ${advisor.totalSkimmed ?? 0}M Missing`,
        severity_tier: tier,
      }, 'corrupt_pact');
    }
    advisor.corruptPact  = false;
    advisor.pactResidual = 0;
    advisor.trust = Math.max(0, (advisor.trust ?? 50) - 10);
    this.state.dirtyDeeds.exposed++;
    console.warn(`[Pact EXPOSED] ${advisor.name} — ${tier} scandal after ${turns} turn(s)`);
  }

  applyAbsenceEffects() {
    const s = this.state;
    const ABSENCE_PENALTY = {
      finance:          { budget: -5 },
      urban_planning:   { approval: -1 },
      transport:        { approval: -1 },
      military_liaison: { approval: -1 },
      religious_affairs:{ approval: -1 },
    };
    for (const advisor of s.advisors) {
      if (advisor.betrayed) continue;
      if ((advisor.trust ?? 50) >= 30) continue;
      const penalty = ABSENCE_PENALTY[advisor.id];
      if (!penalty) continue;
      if (penalty.budget)   s.shiftBudget(penalty.budget);
      if (penalty.approval) s.shiftApproval(penalty.approval);
      console.log(`[Absence] ${advisor.name} trust<30 — silent penalty`);
    }
  }
}
