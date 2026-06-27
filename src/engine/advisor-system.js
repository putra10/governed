// src/engine/advisor-system.js
import { randomPick, random } from '../utils/random.js';
import { addHeat, heatLevel } from './heat-system.js';
import advisorReactions from '../../Hardcoded things/advisor_reactions.json';
import FUNDING_REQUESTS from '../../Hardcoded things/funding_requests.json';

// Canonical domain of an advisor. Candidate-pool advisors carry a unique `id`
// (e.g. "finance_siti") plus a `domain_id` ("finance"); legacy advisors use
// their id AS the domain. All domain-bound systems key off this.
export function domainOf(advisor) {
  return advisor?.domain_id ?? advisor?.id;
}

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
    desc:  'A quiet arrangement in their domain. Skims money into YOUR personal wallet every turn — discovery risk grows the longer it runs, and the paper trail never resets. You can run several schemes at once for compounding income (and compounding risk).',
    note:  'Trigger: trust ≥ 60 · skims to personal funds · multiple schemes allowed',
    condition: (s, adv) =>
      !adv.corruptPact &&
      (adv.trust ?? 50) >= 60,
  },
  end_pact: {
    label: 'END THE SCHEME',
    desc:  'Wind down the arrangement. The paper trail lingers for two more turns.',
    note:  'Residual discovery risk: 2 turns',
    condition: (s, adv) => !!adv.corruptPact,
  },
  launder: {
    label: 'LAUNDER THE TRAIL',
    desc:  'Pay a fixer to scrub the paper trail on this scheme. Rolls the discovery clock back and cools the watchdog — out of your personal funds.',
    note:  'Trigger: active pact & personal funds ≥ 30M · -30M · -3 pact-turns · cools scrutiny',
    condition: (s, adv) => !!adv.corruptPact && (s.personalFunds ?? 0) >= 30,
  },
  threaten: {
    label: 'THREATEN',
    desc:  'Use what you know about their agenda as leverage. Private and free — but it can backfire into the press, and repeated threats escalate.',
    note:  'Trigger: their agenda ≥ 40 & your approval ≥ 45 · third threat = they snap',
    condition: (s, adv) => {
      const unlocked = s.marketEffects?.threatUnlock &&
        s.marketEffects.threatUnlock.advisorId === adv.id &&
        s.turn <= s.marketEffects.threatUnlock.until;
      return ((adv.agendaProgress ?? 0) >= 40 || unlocked) &&
        s.approval >= 45 &&
        (adv.threatCount ?? 0) < 3;
    },
  },
  sacrifice: {
    label: 'THROW UNDER THE BUS',
    desc:  'Blame them for everything, publicly. They are finished — and the press moves on to fresher meat.',
    note:  'Trigger: SCRUTINY ≥ 20 · heat -10 · +2% approval · remaining advisors -8 trust (worse if they are your lover)',
    condition: (s, adv) => (s.heat ?? 0) >= 20 && !adv.betrayed,
  },
  leak: {
    label: 'LEAK DIRT',
    desc:  'Hand their file to a journalist. Their agenda collapses — but the story splashes on your office too. The journalist is paid from YOUR personal funds.',
    note:  'Trigger: their agenda ≥ 50 & personal funds ≥ 30M · once per advisor',
    condition: (s, adv) =>
      !adv.leakUsed &&
      (adv.agendaProgress ?? 0) >= 50 &&
      (s.personalFunds ?? 0) >= 30,
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
    const me = s.marketEffects ?? {};
    for (const advisor of s.advisors) {
      if (advisor.betrayed) continue;

      // Black market: frozen agendas (mole / shadow cabinet) don't advance
      const frozen =
        (me.agendaFreeze && me.agendaFreeze.advisorId === advisor.id && s.turn <= me.agendaFreeze.until) ||
        (s.turn <= (me.allAgendaFreezeUntil ?? 0));
      if (!frozen) {
        advisor.agendaProgress = Math.min(AGENDA_MAX, (advisor.agendaProgress ?? 0) + AGENDA_TICK);
      }

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
          // triggerRomanceExposure RETURNS the severity string (null = shielded)
          const severityAfterExposure = scandalSystem.triggerRomanceExposure(advisor.name);
          if (severityAfterExposure && ['career_ending', 'major'].includes(severityAfterExposure)
              && (advisor.trust ?? 50) < 70) {
            advisor.relationshipType = 'rivalry';
          }
        }
      }

      // Scorned ex-lover: 2 turns of 10%/turn risk they go public themselves,
      // one severity tier worse (a breakup is never a clean exit)
      if ((advisor.scorned ?? 0) > 0 && !advisor.romanceExposed) {
        advisor.scorned--;
        if (random() < 0.10 && scandalSystem) {
          scandalSystem.triggerRomanceExposure(advisor.name, 1);
          advisor.relationshipType = 'rivalry';
          console.warn(`[Scorned] ${advisor.name} went to the press about the affair`);
        }
      }

      // Lover demands: 40% chance EVERY turn — love is needy by design
      if (rel === 'romantic' && !advisor.betrayed &&
          (advisor.lastDemandTurn ?? 0) < s.turn && !s.pendingLoverDemand &&
          random() < 0.40) {
        advisor.lastDemandTurn = s.turn;
        const type = random() < 0.5 ? 'fund' : 'pardon';
        s.pendingLoverDemand = { advisorId: advisor.id, advisorName: advisor.name, type };
        console.log(`[Lover] ${advisor.name} has a request (${type})`);
      }
    }
  }

  // Lover demand resolution: fund their pet project / pardon a relative —
  // or refuse and watch the relationship cool
  resolveLoverDemand(accept) {
    const s = this.state;
    const demand = s.pendingLoverDemand;
    if (!demand) return { ok: false, msg: 'No request pending.' };
    const advisor = s.getAdvisor(demand.advisorId);
    s.pendingLoverDemand = null;
    if (!advisor || advisor.betrayed) return { ok: false, msg: 'They are gone.' };

    if (accept) {
      if (demand.type === 'fund') {
        s.shiftBudget(-30);
        advisor.trust = Math.min(100, (advisor.trust ?? 50) + 5);
        return { ok: true, msg: `You funded ${advisor.name}'s district project. (-30M, +5 trust) Love is expensive.` };
      }
      addHeat(s, 1, 'lover_pardon');
      advisor.trust = Math.min(100, (advisor.trust ?? 50) + 5);
      return { ok: true, msg: `You made a relative's case quietly disappear. (+1 heat, +5 trust) Love keeps receipts.` };
    }

    this.shiftRelationship(advisor.id, -1);
    return { ok: true, msg: `You said no. ${advisor.name} heard something else. (relationship cools)` };
  }

  // Crime partner demand resolution: pay them off / calm them down — or
  // refuse and watch the scheme get riskier
  resolvePartnerDemand(accept) {
    const s = this.state;
    const demand = s.pendingPartnerDemand;
    if (!demand) return { ok: false, msg: 'No demand pending.' };
    const advisor = s.getAdvisor(demand.advisorId);
    s.pendingPartnerDemand = null;
    if (!advisor || advisor.betrayed || !advisor.corruptPact) {
      return { ok: false, msg: 'The arrangement is already over.' };
    }

    if (demand.type === 'bigger_cut') {
      if (accept) {
        s.shiftPersonal(-25);
        advisor.trust = Math.min(100, (advisor.trust ?? 50) + 5);
        return { ok: true, msg: `You paid ${advisor.name}'s bigger cut. (-25M, +5 trust) Partners stay loyal when fed.` };
      }
      advisor.trust = Math.max(0, (advisor.trust ?? 50) - 8);
      advisor.pactTurns = (advisor.pactTurns ?? 0) + 1;
      return { ok: true, msg: `You refused. ${advisor.name} takes it personally — and gets sloppy. (trail thickens, -8 trust)` };
    }

    if (demand.type === 'blackmail') {
      const pay = demand.demand ?? 50;
      if (accept) {
        s.shiftPersonal(-pay);
        advisor.trust = Math.min(100, (advisor.trust ?? 50) + 4);
        return { ok: true, msg: `You paid ${advisor.name}'s price for silence. (-${pay}M personal) They keep your secret — for now.` };
      }
      // Refuse: they walk, and they tip off the watchdog on the way out
      advisor.corruptPact = false;
      advisor.pactResidual = 0;
      addHeat(s, 8, 'blackmail_refuse');
      this.triggerBetrayal(advisor, null);
      return { ok: true, msg: `You called ${advisor.name}'s bluff. They walk straight to the investigators. (betrayed · scrutiny spikes)` };
    }

    // cold_feet
    if (accept) {
      advisor.pactPaused = 1;
      return { ok: true, msg: `You let the scheme go quiet for a turn. ${advisor.name} breathes again. (no skim, no risk next turn)` };
    }
    advisor.trust = Math.max(0, (advisor.trust ?? 50) - 5);
    advisor.pactTurns = (advisor.pactTurns ?? 0) + 1;
    return { ok: true, msg: `You pushed on. Nervous partners make mistakes. (trail thickens, -5 trust)` };
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
    let betrayalPenalty = advisor.relationshipType === 'romantic' ? -15 : -10;
    // Bodyguard detail: the cameras see less of it
    if (this.state.marketEffects?.betrayalHalf) {
      betrayalPenalty = Math.round(betrayalPenalty / 2);
      this.state.marketEffects.betrayalHalf = false;
    }
    this.state.shiftApproval(betrayalPenalty);

    console.warn(`[BETRAYAL] ${advisor.name} (relationship: ${advisor.relationshipType ?? 'neutral'})`);
    if (onBetrayal) onBetrayal(advisor);
  }

  // ── Advisor Recommendations ───────────────────────────────────────────────────
  // Called in processTurn after decision is loaded. Domain-matched advisors
  // recommend by PERSONALITY, SELF-INTEREST and (if plotting) SABOTAGE —
  // not by what's objectively safest for you.

  generateRecommendations(decision) {
    const s = this.state;
    s.pendingDecisionRecommendations = {};
    s.pendingRecMeta = {};
    if (!decision) return;

    // What each advisor actually values (budget scaled /20 so money doesn't
    // always dominate; scandal_risk in %):
    const PERSONALITY = {
      finance:           { budget: 1.5, approval: 0.5, scandal: -0.2 }, // cold bottom line
      military_liaison:  { budget: 0.3, approval: 0.8, scandal: -1.0 }, // hates exposure
      urban_planning:    { budget: 0.4, approval: 1.2, scandal: -0.3 }, // loves the public
      religious_affairs: { budget: 0.2, approval: 1.0, scandal: -0.8 }, // morality optics
      transport:         { budget: 1.0, approval: 0.7, scandal: -0.3 }, // pragmatist
    };

    for (const advisor of s.advisors) {
      if (advisor.betrayed) continue;
      if (domainOf(advisor) !== decision._domain) continue;

      const w = PERSONALITY[domainOf(advisor)] ?? { budget: 0.5, approval: 1.0, scandal: -0.5 };
      const agenda = advisor.agendaProgress ?? 0;
      // A plotting advisor (agenda >= 60) has a 50% chance of giving advice
      // designed to WEAKEN you. The agenda bar is your only warning.
      const scheming = agenda >= 60 && random() < 0.5;

      let best = 0, bestScore = -Infinity;
      decision.options.forEach((opt, i) => {
        const c = opt.consequences ?? {};
        let score =
          (c.approval_delta ?? 0) * w.approval +
          ((c.budget_delta ?? 0) / 20) * w.budget +
          ((c.scandal_risk ?? 0) / 10) * w.scandal;

        // Self-interest: how does this option treat THEM?
        const self = (c.advisor_effects ?? []).find(e =>
          e.advisor_id === advisor.id || e.advisor_id === domainOf(advisor));
        if (self) score += (self.trust_delta ?? 0) * 1.5 - (self.betrayal_risk_delta ?? 0);

        // Sabotage: invert the approval term, twice over
        if (scheming) score -= (c.approval_delta ?? 0) * 2;

        // Human noise — nobody's judgement is a spreadsheet
        score += (random() - 0.5) * 4;

        if (score > bestScore) { bestScore = score; best = i; }
      });

      s.pendingDecisionRecommendations[advisor.id] = best;
      // Honest-or-not metadata: consumed by consults and actor-meeting intel
      s.pendingRecMeta[advisor.id] = { scheming };
      console.log(`[Advisor] ${advisor.name} recommends option ${best} for "${decision.id}"${scheming ? ' (SCHEMING)' : ''}`);
    }
  }

  // ── Advisor Reactions ("I told you so") ──────────────────────────────────
  // resolveDecision stores advisor.pendingReaction when the player ignored a
  // recommendation AND the chosen option went badly. One turn later this
  // converts it into a chat message (advisor.pendingReactionMsg) — the
  // messenger pushes it into the log, and dispatch shows an unread badge.

  deliverPendingReactions() {
    const s = this.state;
    for (const advisor of s.advisors) {
      if (advisor.betrayed || !advisor.pendingReaction) continue;
      // Deliver only on a LATER turn — "the morning after"
      if ((advisor.pendingReaction.turn ?? 0) >= s.turn) continue;

      const pool = advisorReactions[advisor.pendingReaction.type] ?? advisorReactions.told_you_so ?? [];
      const line = randomPick(pool);
      if (line) {
        advisor.pendingReactionMsg = line.replace(/{title}/g, advisor.pendingReaction.title ?? 'that matter');
        console.log(`[Advisor Reaction] ${advisor.name}: ${advisor.pendingReaction.type} queued`);
      }
      advisor.pendingReaction = null;
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
    switch (domainOf(advisor)) {
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

  // ── Domain funding requests (point 3) ─────────────────────────────────────
  // An advisor asks for budget for their ministry. PAYING costs real money and
  // buys real trust — loyalty you earn, not farm. One request at a time.
  generateFundingRequest() {
    const s = this.state;
    if (s.pendingFundingRequest) return;
    if (random() > 0.22) return;
    const eligible = s.advisors.filter(a =>
      !a.betrayed && !a.corruptPact && (a.lastFundTurn ?? -99) <= s.turn - 3);
    if (!eligible.length) return;
    const adv = randomPick(eligible);
    const dom = domainOf(adv);
    // Pull a random case from the pool — domain-specific or 'any' (extend the
    // JSON to add more combinations; this picks among all that fit).
    const pool = FUNDING_REQUESTS.filter(r => r.domain === dom || r.domain === 'any');
    const entry = randomPick(pool.length ? pool : FUNDING_REQUESTS);
    if (!entry) return;
    adv.lastFundTurn = s.turn;
    const fill = (t) => String(t ?? '')
      .split('{amount}').join(entry.amount)
      .split('{name}').join(adv.name)
      .split('{project}').join(entry.project ?? 'their department')
      .split('{city}').join(s.city?.city_name ?? 'the city');
    s.pendingFundingRequest = {
      advisorId: adv.id, advisorName: adv.name, amount: entry.amount,
      project: entry.project, ask: fill(entry.ask),
      accept:  { ...(entry.accept  ?? {}), msg: fill(entry.accept?.msg) },
      decline: { ...(entry.decline ?? {}), msg: fill(entry.decline?.msg) },
    };
    console.log(`[Funding] ${adv.name} requests ${entry.amount}M (${entry.id})`);
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

  // ── Consultations (messenger, 1 action point) ───────────────────────────────
  // Ask advisor A for a private read. If today's recommendation came from a
  // DIFFERENT advisor, A verifies it (counter-intelligence, 80% accurate —
  // less if A has checked out). Otherwise A gives their domain forecast.
  // Once per advisor per turn. Returns { ok, msg }.

  consult(advisorId) {
    const s = this.state;
    const advisor = s.advisors.find(a => a.id === advisorId && !a.betrayed);
    if (!advisor) return { ok: false, msg: 'They are not available.' };
    if (advisor.consultedTurn === s.turn) return { ok: false, msg: `${advisor.name} has already given you their read today.` };
    if ((s.actionPoints ?? 0) <= 0) return { ok: false, msg: 'No hours left in the day.' };

    s.actionPoints--;
    advisor.consultedTurn = s.turn;

    // Counter-intelligence: verify another advisor's recommendation
    const recIds = Object.keys(s.pendingDecisionRecommendations ?? {});
    const targetId = recIds.find(id => id !== advisorId);
    if (targetId) {
      const target = s.advisors.find(a => a.id === targetId);
      const meta = s.pendingRecMeta?.[targetId];
      if (target && meta) {
        // Checked-out advisors can't be bothered to dig
        if ((advisor.trust ?? 50) < 40) {
          return { ok: true, msg: `${advisor.name} shrugs: "Ask someone who still gets invited to the meetings."` };
        }
        const accurate = random() < 0.8;
        const verdictScheming = accurate ? meta.scheming : !meta.scheming;
        const msg = verdictScheming
          ? `${advisor.name}, quietly: "I looked into ${target.name}'s advice. The numbers are real but the framing is... curated. If I were you, I'd think twice today."`
          : `${advisor.name}: "I checked ${target.name}'s reasoning. It holds. Whatever game they're playing long-term, today's advice is straight."`;
        console.log(`[Consult] ${advisor.name} on ${target.name}: scheming=${meta.scheming}, reported=${verdictScheming}`);
        return { ok: true, msg };
      }
    }

    // Their own domain forecast (no trust gate — you're paying with time)
    const intel = this._generateIntel(advisor, s);
    if (intel) return { ok: true, msg: `${advisor.name}: "${intel}"` };

    const fallbacks = [
      `${advisor.name}: "Honestly? Nothing on my desk screams yet. Enjoy it — it never lasts."`,
      `${advisor.name}: "My read: the city is holding its breath. What it exhales depends on you."`,
    ];
    return { ok: true, msg: randomPick(fallbacks) };
  }

  // ── Back-channel execution ──────────────────────────────────────────────────
  // Returns { ok, msg } — msg is shown in the messenger log.

  executeBackChannel(advisorId, actionId, scandalSystem, onBetrayal) {
    const s = this.state;
    if (!s.dirtyDeeds) s.dirtyDeeds = { skimmed: 0, threats: 0, leaks: 0, exposed: 0 };

    const advisor = s.advisors.find(a => a.id === advisorId && !a.betrayed);
    if (!advisor) return { ok: false, msg: 'This advisor is no longer available.' };
    let free = false;
    if (s.backChannelUsedTurn === s.turn) {
      // Burner phones: one extra back-channel action this turn (no AP either)
      if (s.marketEffects?.freeBackChannel) {
        s.marketEffects.freeBackChannel = false;
        free = true;
      } else {
        return { ok: false, msg: 'You have already used the back channel this turn.' };
      }
    }
    // Dirty politics takes time: 1 action point (unless the burner phones paid)
    if (!free && (s.actionPoints ?? Infinity) <= 0) {
      return { ok: false, msg: 'No hours left in the day for this kind of work.' };
    }

    const action = BACK_CHANNEL_ACTIONS[actionId];
    if (!action || !action.condition(s, advisor))
      return { ok: false, msg: 'Conditions are not met for that move.' };

    if (!free && s.actionPoints !== undefined) s.actionPoints--;
    s.backChannelUsedTurn = s.turn;
    switch (actionId) {
      case 'get_closer':    return this._bcGetCloser(advisor);
      case 'keep_distance': return this._bcKeepDistance(advisor);
      case 'corrupt_pact':  return this._bcStartPact(advisor);
      case 'end_pact':      return this._bcEndPact(advisor);
      case 'launder':       return this._bcLaunder(advisor);
      case 'threaten':      return this._bcThreaten(advisor, scandalSystem, onBetrayal);
      case 'leak':          return this._bcLeak(advisor, scandalSystem);
      case 'sacrifice':     return this._bcSacrifice(advisor);
      default:              return { ok: false, msg: 'Unknown move.' };
    }
  }

  _bcGetCloser(advisor) {
    const s = this.state;
    // ONE lover only — pursuing someone new means the current lover finds out
    const currentLover = s.advisors.find(a =>
      a.relationshipType === 'romantic' && !a.betrayed && a.id !== advisor.id);

    this.shiftRelationship(advisor.id, +1);
    // Diminishing returns: you can't click your way to loyalty. Each successive
    // get-closer on the same advisor pays less trust (3 -> 2 -> 1 -> 1 ...).
    advisor.getCloserCount = (advisor.getCloserCount ?? 0) + 1;
    advisor.trust = Math.min(100, (advisor.trust ?? 50) + Math.max(1, 4 - advisor.getCloserCount));

    let jealousy = '';
    if (currentLover) {
      currentLover.relationshipType = 'rivalry';
      currentLover.scorned = 2; // a scorned lover may go public
      jealousy = ` ${currentLover.name} found out. They are not taking it well.`;
    }

    const rel = advisor.relationshipType;
    const msg = rel === 'romantic'
      ? `Things with ${advisor.name} have become... personal. (+4 trust/turn, 5%/turn exposure risk — permanent while it lasts)${jealousy}`
      : `You spent the evening with ${advisor.name}. The relationship deepens. (${rel})${jealousy}`;
    return { ok: true, msg };
  }

  _bcKeepDistance(advisor) {
    const wasRomantic = advisor.relationshipType === 'romantic';
    this.shiftRelationship(advisor.id, -1);
    if (wasRomantic) {
      // Breakups are dangerous, not safe: 2 turns of scorned-leak risk
      advisor.scorned = 2;
    }
    const msg = wasRomantic
      ? `You ended it with ${advisor.name}. No more loyalty bonus — and they know everything. Pray they stay quiet.`
      : `You put some distance between yourself and ${advisor.name}. (${advisor.relationshipType})`;
    return { ok: true, msg };
  }

  _bcSacrifice(advisor) {
    const s = this.state;
    const wasLover = advisor.relationshipType === 'romantic';

    // Mark them gone — same exclusions as betrayal, plus the sacrifice flag
    advisor.betrayed = true;
    advisor.sacrificed = true;
    advisor.corruptPact = false;
    if (s.pendingBribes?.length) {
      s.pendingBribes = s.pendingBribes.filter(b => b.advisorId !== advisor.id);
    }

    if (wasLover) {
      // The press FEASTS — but the public finds it cruel
      addHeat(s, -12, 'sacrifice_lover');
      s.shiftApproval(-4);
      s.advisors.forEach(a => { if (!a.betrayed) a.trust = Math.max(0, (a.trust ?? 50) - 12); });
    } else {
      addHeat(s, -10, 'sacrifice');
      s.shiftApproval(2);
      s.advisors.forEach(a => { if (!a.betrayed) a.trust = Math.max(0, (a.trust ?? 50) - 8); });
    }

    if (!s.pendingBetrayals) s.pendingBetrayals = [];
    s.pendingBetrayals.push({
      advisorId:    advisor.id,
      advisorName:  advisor.name,
      line:         wasLover
        ? 'After everything... you fed me to them. I hope it was worth it.'
        : 'You needed a body, and mine was closest. I understand. I will not forgive.',
      relationship: advisor.relationshipType ?? 'neutral',
      sacrificed:   true,
    });

    console.warn(`[Sacrifice] ${advisor.name} thrown under the bus${wasLover ? ' (LOVER)' : ''}`);
    return {
      ok: true,
      msg: wasLover
        ? `You blamed ${advisor.name} for everything. The press devours the story (heat -12) — but the city saw what you did to someone you loved. (-4% approval, cabinet shaken)`
        : `You blamed ${advisor.name} for everything. The press moves on (heat -10, +2% approval) — but your cabinet just watched a colleague burn. (-8 trust all)`,
    };
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

  _bcLaunder(advisor) {
    const s = this.state;
    s.shiftPersonal(-30);
    advisor.pactTurns = Math.max(0, (advisor.pactTurns ?? 0) - 3);
    addHeat(s, -6, 'launder');
    return { ok: true, msg: `A fixer scrubs ${advisor.name}'s trail. (-30M personal · discovery clock rolled back · scrutiny cools)` };
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
    s.shiftPersonal(-30);
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
        // Lay low: a calmed partner skips this turn's skim AND risk roll
        if ((advisor.pactPaused ?? 0) > 0) {
          advisor.pactPaused--;
          console.log(`[Pact] ${advisor.name}: scheme lying low this turn`);
          continue;
        }

        // Crime partners are needy too: 40%/turn they demand an answer. A
        // long, fat scheme can curdle into outright blackmail of YOU.
        if (!s.pendingPartnerDemand && random() < 0.40) {
          let type;
          if ((advisor.pactTurns ?? 0) >= 5 && (advisor.totalSkimmed ?? 0) >= 80 && random() < 0.5) {
            type = 'blackmail';
          } else {
            type = random() < 0.5 ? 'bigger_cut' : 'cold_feet';
          }
          s.pendingPartnerDemand = {
            advisorId: advisor.id, advisorName: advisor.name, type,
            demand: Math.max(20, Math.round((advisor.totalSkimmed ?? 0) * 0.5)),
          };
          console.log(`[Pact] ${advisor.name} needs an answer (${type})`);
        }

        const skim = this._pactSkim();
        s.shiftPersonal(skim);
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

  // ── Corruption raid (driven by SCRUTINY) ──────────────────────────────────
  // No separate watchdog meter: running schemes raise SCRUTINY like everything
  // else, and once the press is INVESTIGATING (or you're UNDER SIEGE) the
  // investigators can raid — exposing every active pact at once and seizing half
  // your slush. Risk scales with how hot you are and how many schemes run.
  processRaidRisk(scandalSystem) {
    const s = this.state;
    const active = s.advisors.filter(a => a.corruptPact && !a.betrayed);
    if (!active.length) return;

    // Active schemes generate rumors — they keep the heat on (and block decay).
    addHeat(s, active.length, 'corrupt_pacts');

    const idx = heatLevel(s.heat ?? 0).index;
    if (idx < 3) return; // below INVESTIGATED, the books stay closed

    const chance = (idx - 2) * 0.12 + active.length * 0.05;
    if (random() < chance) this._corruptionRaid(scandalSystem, active);
  }

  _corruptionRaid(scandalSystem, active = null) {
    const s = this.state;
    active = active ?? s.advisors.filter(a => a.corruptPact && !a.betrayed);
    for (const adv of active) this._exposePact(adv, scandalSystem);
    const seized = Math.round((s.personalFunds ?? 0) * 0.5);
    s.shiftPersonal(-seized);
    if (scandalSystem) {
      scandalSystem._applyScandal({
        id: `corruption_raid_${s.turn}`,
        title: `Investigators Raid City Hall — ${seized}M Seized`,
        severity_tier: active.length ? 'career_ending' : 'major',
      }, 'corruption_raid');
    }
    s.recentComments = [`⚠ RAID: investigators seized ${seized}M from your personal accounts.`, ...(s.recentComments ?? [])].slice(0, 5);
    console.warn(`[Raid] ${active.length} pact(s) exposed, ${seized}M seized`);
  }

  // Severity escalates with how long the scheme ran — the trail never resets
  _exposePact(advisor, scandalSystem) {
    const me = this.state.marketEffects ?? {};
    if ((me.exposureShield ?? 0) > 0) {
      me.exposureShield--;
      this.state.recentComments = ['Leaked ledgers are dismissed as forgeries within the hour.', ...(this.state.recentComments ?? [])].slice(0, 5);
      console.log('[Pact] Exposure shielded by deepfake insurance');
      return;
    }
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
      const penalty = ABSENCE_PENALTY[domainOf(advisor)];
      if (!penalty) continue;
      if (penalty.budget)   s.shiftBudget(penalty.budget);
      if (penalty.approval) s.shiftApproval(penalty.approval);
      console.log(`[Absence] ${advisor.name} trust<30 — silent penalty`);
    }
  }
}
