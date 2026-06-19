// src/engine/turn-manager.js — Turn flow controller
import { randomPick, random } from '../utils/random.js';
import { saveGame } from '../utils/local-storage.js';
import { CrisisManager } from './crisis-manager.js';
import { AdvisorSystem, EMERGENCY_POWERS, ADVISOR_SECRET_CRISIS_OPTIONS, domainOf } from './advisor-system.js';
import { ConsequenceSim } from './consequence-sim.js';
import { ScandalSystem } from './scandal-system.js';
import { ContractSystem } from './contract-system.js';
import { MarketSystem } from './market-system.js';
import { ActorSystem } from './actor-system.js';
import { buildNewspaper } from './newspaper.js';
import { getGenericProblemById } from './generic-problems.js';
import { heatLevel, scandalChanceMult, addHeat } from './heat-system.js';

export class TurnManager {
  constructor(state) {
    this.state = state;
    this.phase = 'idle'; // idle | briefing | decision | crisis | reaction | roast

    // Instantiate modular engine systems
    this.crisisManager  = new CrisisManager(state);
    this.advisorSystem  = new AdvisorSystem(state);
    this.scandalSystem  = new ScandalSystem(state);
    this.consequenceSim = new ConsequenceSim(state, this.advisorSystem, this.scandalSystem);
    this.contractSystem = new ContractSystem(state);
    this.marketSystem   = new MarketSystem(state);
    this.actorSystem    = new ActorSystem(state);
  }

  // ── Main turn loop ────────────────────────────────────────────────────

  processTurn() {
    const s = this.state;
    console.log(`[Turn ${s.turn}] Processing...`);

    // 0. Auto-fire any scandal the player left unhandled last turn
    if (s.pendingScandal) {
      this._fireScandal(s.pendingScandal);
      s.pendingScandal = null;
    }

    // 0.5 SCRUTINY decay/escalation + black market housekeeping
    this._processHeatAndMarket();

    // 1. Situation Update — tick agendas, relationships, then check for bribe offers
    this.advisorSystem.tickAgendas((betrayedAdvisor) => {
      // Store betrayal for the UI to display as a dramatic event
      if (!s.pendingBetrayals) s.pendingBetrayals = [];
      s.pendingBetrayals.push({
        advisorId:   betrayedAdvisor.id,
        advisorName: betrayedAdvisor.name,
        line:        betrayedAdvisor.dialogue?.betrayal ?? 'I can no longer serve you.',
        relationship: betrayedAdvisor.relationshipType ?? 'neutral',
      });
    });
    this.advisorSystem.tickRelationships(this.scandalSystem);
    this.advisorSystem.processCorruptPacts(this.scandalSystem);
    this.advisorSystem.processRaidRisk(this.scandalSystem);
    this.advisorSystem.generateBribeOffers();

    // 2. Push any queued crisis (from unlock_follow_up) to active
    if (s.pendingCrisis) {
      if (!s.activeCrises.includes(s.pendingCrisis) &&
          !s.resolvedCrises.includes(s.pendingCrisis)) {
        s.activeCrises.push(s.pendingCrisis);
      }
      s.pendingCrisis = null;
    }

    // 3. Check end conditions BEFORE incrementing turn
    const endResult = this._checkEndConditions();
    if (endResult) {
      this.saveState();
      return endResult;
    }

    // 4. Increment turn NOW — this is critical.
    //    Crisis trigger fires AFTER increment so the crisis screen
    //    lands on the new turn number, not the old one.
    s.turn++;

    // Governor's salary — lands on odd turns (3/5/7/9/11), 4% of the city
    // treasury, floor 1M, paid into personal funds. (Turn 1's pay was the 30%
    // opening grant seeded at loadCity.)
    if ([3, 5, 7, 9, 11].includes(s.turn)) {
      const pay = Math.max(1, Math.round(0.04 * s.budget));
      s.shiftPersonal(pay);
      s.recentComments = [`Salary cleared: +${pay}M to personal funds.`, ...(s.recentComments ?? [])].slice(0, 5);
    }

    // Reset per-turn decision quota (always 1 NEW generic problem per turn;
    // unresolved problems from previous turns carry over on top)
    s.decisionsThisTurn    = 0;
    s.maxDecisionsThisTurn = 1;

    // New day: action points refill, yesterday's unanswered visitor leaves,
    // unused decision modifiers expire
    s.actionPoints = s.maxActionPoints ?? 3;
    s.pendingMeeting = null;
    s.lastMeetingResult = null;
    s.decisionMods = {};

    // The morning paper lands on the desk (built from yesterday's events)
    s.pendingNewspaper = buildNewspaper(s);

    // Problems ignored for 3 turns disclose themselves — badly
    this._processOverdueProblems();

    // Economy: collect taxes then apply any budget pressure
    this._applyPassiveTax();
    this._applyBudgetPressure();
    this._applyTierPassiveDrain();

    // 20% chance: a scandal erupts this turn alongside the generic decision
    this._rollScandalEvent();

    // Civil unrest: rolls when budget < 0 and approval < 45
    this._rollUnrestEvent();

    // Pay installments on any active multi-turn contracts
    this.contractSystem.processActiveContracts();

    // Tier-based chance: a new contract offer appears (budget side quest)
    this.contractSystem.rollContractOffer();

    // 5. Advisor briefing + recommendations for next decision
    //    (reactions first: "I told you so" messages land the morning after)
    this.advisorSystem.deliverPendingReactions();
    this.advisorSystem.generateBriefings();
    const nextDecision = this.state.getNextDecision();
    if (nextDecision) this.advisorSystem.generateRecommendations(nextDecision);

    // Layer 2: advisors checked out (trust<30) silently hurt city stats
    this.advisorSystem.applyAbsenceEffects();

    // 6. Natural crisis trigger check — push to activeCrises
    if (this.crisisManager.shouldTriggerCrisis()) {
      // Friends in High Places: the next window is someone else's problem
      if (s.marketEffects?.skipNextCrisis) {
        s.marketEffects.skipNextCrisis = false;
        s.recentComments = ['A crisis brews — and is quietly handled before it reaches your desk.', ...(s.recentComments ?? [])].slice(0, 5);
        console.log('[Market] Crisis window skipped (friends in high places)');
      } else {
        const crisisId = this.crisisManager.triggerCrisis();
        if (crisisId) {
          this.saveState();
          return 'crisis_triggered';
        }
      }
    }

    // 7. Auto-save
    this.saveState();

    return null; // null = continue playing
  }

  // ── SCRUTINY + market per-turn processing ─────────────────────────────

  _processHeatAndMarket() {
    const s  = this.state;
    const me = s.marketEffects ?? (s.marketEffects = {});

    // Last night's market offers expired at dawn
    this.marketSystem.clearOffers();

    // Heat decay: -1 per clean turn (no heat gained during the previous turn)
    if ((s.heat ?? 0) > 0 && (s.lastHeatGainTurn ?? 0) < s.turn) {
      s.heat = Math.max(0, s.heat - 1);
    }

    // UNDER SIEGE clock: 3 consecutive turns at siege = recall vote
    if (heatLevel(s.heat).id === 'siege') {
      s.siegeTurns = (s.siegeTurns ?? 0) + 1;
    } else {
      s.siegeTurns = 0;
    }

    // Impeachment: entering siege queues a major scandal
    if (s.hasFlag('impeachment_pending')) {
      s.flags.impeachment_pending = false;
      this.scandalSystem._applyScandal({
        id: `impeachment_${s.turn}`,
        title: 'Impeachment Proceedings Opened',
        severity_tier: 'major',
      }, 'impeachment');
    }

    // The Fixer's failure: cleared scandal resurfaces one tier worse
    if (me.resurface) {
      const SUPPRESS_COSTS = { minor: 20, moderate: 40, major: 80, career_ending: 150 };
      s.pendingScandal = {
        ...me.resurface,
        title: `${me.resurface.title} — RESURFACED`,
        suppress_cost: SUPPRESS_COSTS[me.resurface.severity_tier] ?? 40,
      };
      me.resurface = null;
      console.warn('[Market] The Fixer failed — the story is back, and worse');
    }

    // Streamed incomes (ghost payroll, checkpoint tolls) with exposure rolls
    if (me.incomes?.length) {
      me.incomes = me.incomes.filter(inc => {
        s.shiftBudget(inc.amount);
        inc.turnsLeft--;
        if (inc.risk && random() < inc.risk) {
          this.scandalSystem._applyScandal({
            id: `income_exposed_${s.turn}`,
            title: `${inc.label ?? 'Off-Books Income'} Exposed`,
            severity_tier: inc.tier ?? 'moderate',
          }, 'black_market');
          return false; // the stream dies with the story
        }
        return inc.turnsLeft > 0;
      });
    }

    // Approval drips (documentary, checkpoint resentment)
    if (me.drips?.length) {
      me.drips = me.drips.filter(d => {
        s.shiftApproval(d.amount);
        d.turnsLeft--;
        return d.turnsLeft > 0;
      });
    }

    // Pension loan due
    if (me.loanDue && s.turn >= me.loanDue.dueTurn) {
      if (s.budget >= me.loanDue.amount) {
        s.shiftBudget(-me.loanDue.amount);
        s.recentComments = ['The pension fund "loan" is quietly repaid.', ...(s.recentComments ?? [])].slice(0, 5);
      } else {
        this.scandalSystem._applyScandal({
          id: `pension_default_${s.turn}`,
          title: 'Pension Fund Raid Exposed — Retirees Unpaid',
          severity_tier: 'major',
        }, 'black_market');
        addHeat(s, 3, 'loan_default');
      }
      me.loanDue = null;
    }

    // Arms sale blowback: armed populace
    if (me.forcedUnrestTurn && s.turn >= me.forcedUnrestTurn && !s.pendingUnrest) {
      s.pendingUnrest = { type: 'riot', turn: s.turn };
      me.forcedUnrestTurn = null;
      console.warn('[Market] Armed populace — riot erupts');
    }
  }

  // ── Overdue problems ───────────────────────────────────────────────────
  // A problem left undecided for 3 turns resolves ITSELF: 50% it becomes a
  // scandal ("Governor Ignored..."), 50% the public just turns on you.

  _processOverdueProblems() {
    const s = this.state;
    const unresolved = (s.presentedDecisions ?? []).filter(id =>
      !s.pastDecisions.some(p => p.decisionId === id));

    for (const id of unresolved) {
      const presented = s.problemDeadlines?.[id] ?? s.turn;
      if (s.turn - presented < 3) continue;

      // Close it permanently (counts as ignored, never re-offered)
      s.pastDecisions.push({ turn: s.turn, decisionId: id, optionIndex: -1, consequences: {}, ignored: true });
      if (s.problemDeadlines) delete s.problemDeadlines[id];
      s.ignoredProblems = (s.ignoredProblems ?? 0) + 1;

      const prob  = getGenericProblemById(id, s.city);
      const title = prob?.title ?? 'a city problem';

      if (random() < 0.5) {
        this.scandalSystem._applyScandal({
          id: `ignored_${id}`,
          title: `Governor Sat On It: ${title}`,
          severity_tier: 'moderate',
        }, 'ignored_problem');
      } else {
        s.shiftApproval(-5);
        s.recentComments = [
          `Three weeks. Nothing done about "${title}". They simply don't care.`,
          ...(s.recentComments ?? []),
        ].slice(0, 5);
        if (!s.pendingScandalReveals) s.pendingScandalReveals = [];
        s.pendingScandalReveals.push({
          title: `The City Gives Up On: ${title}`,
          severity_tier: 'minor',
          penalty: -5,
          source: 'ignored_problem',
          turn: s.turn,
        });
      }
      console.warn(`[Overdue] Problem "${id}" disclosed itself after 3 turns`);
    }
  }

  // ── Decision resolution ───────────────────────────────────────────────

  resolveDecision(decisionId, optionIndex) {
    const s = this.state;
    const decision = getGenericProblemById(decisionId, s.city);
    if (!decision) { console.warn('Decision not found:', decisionId); return; }

    const option = decision.options[optionIndex];
    if (!option) { console.warn('Option not found:', optionIndex); return; }

    // Meeting modifiers bought from today's visitor (spin / procedural blessing)
    let consequences = option.consequences;
    const mods = s.decisionMods ?? {};
    if (mods.scandalHalf && (consequences.scandal_risk ?? 0) > 0) {
      consequences = { ...consequences, scandal_risk: Math.round(consequences.scandal_risk / 2) };
      console.log('[Meeting] Scandal risk halved by procedural blessing');
    }
    if (mods.spin && (consequences.approval_delta ?? 0) < 0) {
      consequences = { ...consequences, approval_delta: Math.min(0, consequences.approval_delta + mods.spin) };
      console.log(`[Meeting] Backlash softened by spin (+${mods.spin})`);
    }
    s.decisionMods = {};

    // Buy the Front Page: this decision's approval loss is halved
    const me = s.marketEffects ?? {};
    if (me.halveNextDecisionLoss && (consequences.approval_delta ?? 0) < 0) {
      consequences = { ...consequences, approval_delta: Math.round(consequences.approval_delta / 2) };
      me.halveNextDecisionLoss = false;
      console.log('[Market] Front page bought — damage halved');
    } else if (me.halveNextDecisionLoss) {
      me.halveNextDecisionLoss = false; // consumed either way
    }

    this.consequenceSim.apply(consequences, {
      turn: s.turn,
      sourceId: decisionId,
      optionIndex
    });

    s.pastDecisions.push({
      turn: s.turn,
      decisionId,
      optionIndex,
      consequences: option.consequences
    });

    // Track how many generic problems resolved this turn (for quota cap)
    s.recordDecisionResolved?.();

    // Advisor recommendation: did player follow or ignore the domain advisor's advice?
    const recs = s.pendingDecisionRecommendations ?? {};
    for (const [advId, recIdx] of Object.entries(recs)) {
      const adv = s.advisors.find(a => a.id === advId && !a.betrayed);
      if (!adv) continue;
      if (optionIndex === recIdx) {
        adv.trust = Math.min(100, (adv.trust ?? 50) + 3);
        console.log(`[Advisor Rec] ${adv.name} +3 trust — player followed recommendation`);
      } else {
        adv.trust = Math.max(0, (adv.trust ?? 50) - 2);
        console.log(`[Advisor Rec] ${adv.name} -2 trust — player ignored recommendation`);

        // "I told you so": ignored advice AND the chosen option hurt approval
        // more than the advisor's pick would have → they gloat next turn
        const chosenDelta = option.consequences?.approval_delta ?? 0;
        const recDelta    = decision.options[recIdx]?.consequences?.approval_delta ?? 0;
        if (chosenDelta < 0 && chosenDelta < recDelta) {
          adv.pendingReaction = { type: 'told_you_so', title: decision.title, turn: s.turn };
          console.log(`[Advisor Rec] ${adv.name} will have words next turn`);
        }
      }
    }
    s.pendingDecisionRecommendations = {};
    s.pendingRecMeta = {};

    // Layer 1+3: if decision matches an advisor's domain, reward their trust
    //            and slow their betrayal clock (good governance = loyalty)
    const dom = decision._domain;
    if (dom) {
      const adv = s.advisors.find(a => domainOf(a) === dom && !a.betrayed);
      if (adv) {
        adv.trust          = Math.min(100, (adv.trust ?? 50) + 5);
        adv.agendaProgress = Math.max(0,   (adv.agendaProgress ?? 0) - 8);
        console.log(`[Domain] ${adv.name} +5 trust, -8 agenda (decision matched domain)`);
      }
    }

    this._generateReaction(option.consequences.approval_delta ?? 0);

    // The black market knocks AFTER the day's decision — and it read the paper
    this.marketSystem.rollOffers(decision._domain ?? null);

    this.saveState();
  }

  resolveCrisis(crisisId, optionIndex, advisorSecretId = null) {
    const s = this.state;
    const crisis = s.city.crises.find(c => c.id === crisisId);
    if (!crisis) { console.warn('Crisis not found:', crisisId); return; }

    // Advisor secret option: virtual index beyond normal options
    let option;
    if (advisorSecretId) {
      const secretAdv = s.findAdvisor(advisorSecretId);
      const secretConseq = ADVISOR_SECRET_CRISIS_OPTIONS[secretAdv ? domainOf(secretAdv) : advisorSecretId];
      if (secretConseq) {
        option = { consequences: secretConseq };
        // Reward the advisor who helped (+5 trust)
        const adv = secretAdv;
        if (adv) {
          adv.trust = Math.min(100, (adv.trust ?? 50) + 5);
          console.log(`[Crisis Secret] ${adv.name} +5 trust for secret option`);
        }
      }
    } else {
      option = crisis.options[optionIndex];
    }

    if (!option) { console.warn('Crisis option not found:', optionIndex); return; }

    // Black market crisis modifiers (broker / consultant / sold ambulances)
    let cons = option.consequences;
    const me = s.marketEffects ?? {};
    if (me.crisisCostHalf || me.crisisApprovalHalf || me.crisisApprovalWorsen) {
      cons = { ...cons };
      if (me.crisisCostHalf && (cons.budget_delta ?? 0) < 0) {
        cons.budget_delta = Math.round(cons.budget_delta / 2);
        me.crisisCostHalf = false;
      }
      if (me.crisisApprovalHalf && (cons.approval_delta ?? 0) < 0) {
        cons.approval_delta = Math.round(cons.approval_delta / 2);
        me.crisisApprovalHalf = false;
      }
      if (me.crisisApprovalWorsen && (cons.approval_delta ?? 0) < 0) {
        cons.approval_delta -= me.crisisApprovalWorsen;
        me.crisisApprovalWorsen = 0;
      }
    }

    this.consequenceSim.apply(cons, {
      turn: s.turn,
      sourceId: crisisId,
      optionIndex
    });

    // Mark as resolved
    s.activeCrises = s.activeCrises.filter(id => id !== crisisId);
    s.resolvedCrises.push(crisisId);

    s.pastCrises.push({
      turn: s.turn,
      crisisId,
      optionIndex,
      consequences: option.consequences
    });

    this._generateReaction(option.consequences.approval_delta ?? 0, 'crisis');
    this.saveState();
  }

  // ── Public reaction ──────────────────────────────────────────────────

  _generateReaction(approvalDelta, context = 'decision') {
    const s = this.state;
    const lib = s.city?.comment_library;
    if (!lib) return;

    let pool;
    // Troll farm: the feed loves you, regardless of reality
    if (s.turn <= (s.marketEffects?.feedPositiveUntil ?? 0)) pool = lib.positive;
    else if (context === 'crisis')    pool = lib.crisis;
    else if (approvalDelta > 5)  pool = lib.positive;
    else if (approvalDelta < -5) pool = lib.negative;
    else                         pool = lib.neutral;

    const comments = [];
    for (let i = 0; i < 3; i++) {
      const line = randomPick(pool);
      if (line) comments.push(line);
    }
    s.recentComments = [...comments];
  }

  // ── End conditions ────────────────────────────────────────────────────

  _checkEndConditions() {
    const s = this.state;

    if (s.approval <= 0) { s.endReason = 'recalled'; return 'recalled'; }

    // 3 consecutive turns UNDER SIEGE = recall vote passes
    if ((s.siegeTurns ?? 0) >= 3) { s.endReason = 'recalled'; return 'recalled'; }

    // Term completes at turn 12 — but NOT while a crisis is still unresolved.
    // Otherwise a crisis triggered on turn 12 could be ignored with no consequence.
    if (s.turn >= 12 && s.activeCrises.length === 0) {
      s.endReason = 'term_complete';
      return 'term_complete';
    }

    // 3+ consecutive failed crises
    if (s.pastCrises.length >= 3) {
      const lastThree = s.pastCrises.slice(-3);
      const allFailed = lastThree.every(c => (c.consequences?.approval_delta ?? 0) < -5);
      if (allFailed && s.approval < 20) { s.endReason = 'recalled'; return 'recalled'; }
    }

    return null;
  }

  // ── Persistence ──────────────────────────────────────────────────────

  saveState() {
    saveGame(this.state);
  }

  // ── Economy ──────────────────────────────────────────────────────────────

  _applyPassiveTax() {
    const s      = this.state;
    const rate   = s.getTaxRate ? s.getTaxRate() : 50;
    const income = Math.round(rate * (s.approval / 100));
    s.shiftBudget(income);

    // Trust-gated passive: finance advisor at ≥75 trust provides +10M/turn bonus
    const finAdv = s.advisors?.find(a => domainOf(a) === 'finance' && !a.betrayed);
    if (finAdv && (finAdv.trust ?? 0) >= 75) {
      s.shiftBudget(10);
      console.log('[Advisor Passive] Finance bonus: +10M (trust ≥75)');
    }

    console.log(`[Tax] +${income}M (base ${rate}M, approval ${s.approval}%)`);
  }

  _applyBudgetPressure() {
    const s = this.state;
    const me = s.marketEffects ?? {};

    // Emergency slush fund: auto-injects when the budget first dips below 0
    if (s.budget < 0 && me.slushFund) {
      s.shiftBudget(me.slushFund);
      s.recentComments = ['An account nobody knew existed quietly covers the gap.', ...(s.recentComments ?? [])].slice(0, 5);
      me.slushFund = null;
    }

    // Quiet Austerity: deficit penalties paused
    if (s.budget < 0 && s.turn <= (me.deficitPauseUntil ?? 0)) {
      console.log('[Market] Deficit penalty suppressed (quiet austerity)');
      return;
    }

    if (s.budget < 0) {
      s.consecutiveDeficitTurns = (s.consecutiveDeficitTurns ?? 0) + 1;
      if (s.budget < -200) {
        s.shiftApproval(-5);
        console.log(`[Budget] Fiscal crisis: -5 approval (streak: ${s.consecutiveDeficitTurns})`);
      } else {
        s.shiftApproval(-3);
        console.log(`[Budget] Austerity: -3 approval (streak: ${s.consecutiveDeficitTurns})`);
      }
    } else {
      s.consecutiveDeficitTurns = 0;
    }
  }

  // ── Unrest system ─────────────────────────────────────────────────────────
  // Triggers when budget is negative AND approval is low.
  // Type: strike (mild) → demonstration → riot (severe).
  _rollUnrestEvent() {
    const s = this.state;
    if (s.pendingUnrest) return;
    if (s.turn < 3) return;
    if (s.budget >= 0 || s.approval >= 37) return;

    // Black market auras
    const me = s.marketEffects ?? {};
    if (s.turn <= (me.unrestImmunityUntil ?? 0)) {
      console.log('[Market] Unrest suppressed (militia/mercenary payoff)');
      return;
    }

    const debtPressure  = Math.min(1, Math.abs(s.budget) / 300);
    const approvalPanic = Math.max(0, (37 - s.approval) / 37);
    let   chance        = 0.20 + debtPressure * 0.15 + approvalPanic * 0.20;

    if (s.turn <= (me.unrestDampUntil ?? 0))  chance *= 0.5;
    if (s.turn <= (me.unrestBoostUntil ?? 0)) chance *= 1.25;

    const urbanAdv = s.advisors?.find(a => domainOf(a) === 'urban_planning' && !a.betrayed);
    if (urbanAdv && (urbanAdv.trust ?? 0) >= 75) {
      chance *= 0.80;
      console.log('[Advisor Passive] Urban Planning reduces unrest chance by 20%');
    }

    if (random() >= chance) return;

    const type = s.approval < 18 ? 'riot'
               : s.approval < 28 ? 'demonstration'
               :                   'strike';

    s.pendingUnrest = { type, turn: s.turn };
    console.log(`[Unrest] ${type} erupts — approval ${s.approval}%, budget ${s.budget}M`);
  }

  resolveUnrest(action) {
    const s = this.state;
    if (!s.pendingUnrest) return;
    switch (action) {
      case 'meet_demands': s.shiftBudget(-20);
        console.log('[Unrest] Strike: met demands (−20M)'); break;
      case 'stand_firm':   s.shiftApproval(-5);
        console.log('[Unrest] Strike: stood firm (−5 approval)'); break;
      case 'engage':       s.shiftBudget(-25); s.shiftApproval(2);
        console.log('[Unrest] Demo: engaged (−25M, +2 approval)'); break;
      case 'disperse':     s.shiftApproval(-10);
        console.log('[Unrest] Demo: dispersed (−10 approval)'); break;
      case 'negotiate':    s.shiftBudget(-40);
        console.log('[Unrest] Riot: negotiated (−40M)'); break;
      case 'crackdown':
        s.shiftApproval(-18);
        // 30% flat scandal chance — bypasses _rollScandalEvent's own gate so
        // the effective probability matches the design (was ~6% before)
        if (random() < 0.30) this._createPendingScandal();
        console.log('[Unrest] Riot: crackdown (−18 approval, 30% scandal)'); break;
    }
    s.pendingUnrest = null;
    this.saveState();
  }

  // War/extreme cities bleed approval every turn
  _applyTierPassiveDrain() {
    const s    = this.state;
    const me   = s.marketEffects ?? {};
    const tier = s.city?.tier;

    if (s.turn <= (me.tierDrainPauseUntil ?? 0)) {
      console.log('[Market] Tier drain paused (warlord truce)');
      return;
    }
    const half = me.halveDrainsTurn === s.turn;

    if (tier === 'war') {
      s.shiftApproval(half ? -1 : -2);
      console.log('[Tier] War zone instability');
    } else if (tier === 'extreme' && !half) {
      s.shiftApproval(-1);
      console.log('[Tier] Extreme pressure: -1 approval');
    }
  }

  // One-time panic button per advisor
  useEmergencyPower(advisorId) {
    const s       = this.state;
    const advisor = s.getAdvisor(advisorId);
    if (!advisor || advisor.betrayed || advisor.emergencyPowerUsed) return;

    const power = EMERGENCY_POWERS[domainOf(advisor)];
    if (!power) return;
    if (!power.condition(s, advisor)) return;

    power.apply(s);
    advisor.emergencyPowerUsed = true;
    advisor.trust = Math.max(0, (advisor.trust ?? 50) - 8);
    console.log(`[Emergency] ${advisor.name} used "${power.label}" — power exhausted`);
    this.saveState();
  }

  acceptContract(contractId) {
    this.contractSystem.acceptContract(contractId);
    this.saveState();
  }

  declineContract(contractId) {
    this.contractSystem.declineContract(contractId);
    this.saveState();
  }

  declineAllContracts() {
    this.contractSystem.declineAllContracts();
    this.saveState();
  }

  // Pour personal money into the public treasury. Public, popular, and printed
  // in tomorrow's paper. +1% approval; the bridge between your wallet and the city.
  donateToCity(amount) {
    const s = this.state;
    const amt = Math.max(0, Math.min(Math.round(amount), s.personalFunds ?? 0));
    if (amt <= 0) return { ok: false, msg: 'You have nothing to donate.' };
    s.shiftPersonal(-amt);
    s.shiftBudget(amt);
    s.shiftApproval(1);
    s.pendingDonationNews = { amount: amt };
    s.recentComments = [`You donated ${amt}M of your own money to the city. (+1% approval)`, ...(s.recentComments ?? [])].slice(0, 5);
    this.saveState();
    return { ok: true, msg: `Donated ${amt}M to the treasury. The press will notice tomorrow.` };
  }

  acceptBribe(advisorId) {
    const s     = this.state;
    const bribe = (s.pendingBribes ?? []).find(b => b.advisorId === advisorId);
    if (!bribe) return;

    // Guard: never pay a betrayed advisor — purge the stale offer, no payment.
    const advisor = s.getAdvisor(advisorId);
    if (advisor?.betrayed) {
      s.pendingBribes = s.pendingBribes.filter(b => b.advisorId !== advisorId);
      this.saveState();
      return;
    }
    // Hush money is paid from your personal wallet, never the public budget.
    if ((s.personalFunds ?? 0) < bribe.cost) {
      s.recentComments = [`You can't cover that price (${bribe.cost}M from personal funds). The offer stands.`, ...(s.recentComments ?? [])].slice(0, 5);
      this.saveState();
      return;
    }
    s.pendingBribes = s.pendingBribes.filter(b => b.advisorId !== advisorId);
    s.shiftPersonal(-bribe.cost);

    if (advisor) {
      advisor.agendaProgress = Math.max(0, advisor.agendaProgress - bribe.agendaReduction);
      advisor.trust          = Math.min(100, (advisor.trust ?? 50) + bribe.trustGain);
    }

    if (random() < bribe.scandalRisk) {
      this.scandalSystem.trigger('bribe_' + advisorId);
      console.warn(`[Bribe] Accepted from ${advisorId} — scandal triggered!`);
    } else {
      console.log(`[Bribe] Accepted from ${advisorId}: -${bribe.cost}M`);
    }
    this.saveState();
  }

  declineBribe(advisorId) {
    const s     = this.state;
    const bribe = (s.pendingBribes ?? []).find(b => b.advisorId === advisorId);
    if (!bribe) return;

    s.pendingBribes = s.pendingBribes.filter(b => b.advisorId !== advisorId);
    const advisor = s.getAdvisor(advisorId);
    if (advisor && !advisor.betrayed) {
      advisor.agendaProgress = Math.min(100, (advisor.agendaProgress ?? 0) + 10);
      // The snub can push the agenda past the betrayal threshold — fire it
      // now instead of silently waiting for next turn's tick
      if (advisor.agendaProgress >= 80) {
        this.advisorSystem.triggerBetrayal(advisor, (b) => {
          if (!s.pendingBetrayals) s.pendingBetrayals = [];
          s.pendingBetrayals.push({
            advisorId:    b.id,
            advisorName:  b.name,
            line:         b.dialogue?.betrayal ?? 'I can no longer serve you.',
            relationship: b.relationshipType ?? 'neutral',
          });
        });
      }
    }
    console.log(`[Bribe] Declined from ${advisorId}`);
    this.saveState();
  }

  _rollScandalEvent() {
    const s = this.state;
    const SCANDAL_CHANCE = { low: 0.08, normal: 0.20, high: 0.38 };
    let chance = SCANDAL_CHANCE[s.settings?.scandalFreq ?? 'normal'];

    const milAdv = s.advisors?.find(a => domainOf(a) === 'military_liaison' && !a.betrayed);
    if (milAdv && (milAdv.trust ?? 0) >= 75) {
      chance *= 0.85;
      console.log('[Advisor Passive] Military reduces scandal chance by 15%');
    }

    // SCRUTINY multiplier: the press smells blood at higher heat levels
    chance *= scandalChanceMult(s.heat);
    // Market effects: media settlement / silenced journalist dampers
    const me = s.marketEffects ?? {};
    if (me.scandalMult && s.turn <= (me.scandalMultUntil ?? 0)) chance *= me.scandalMult;

    if (random() >= chance) return;

    // Bug the Newsroom: you saw the story coming — consume one skip
    if ((me.skipScandalRolls ?? 0) > 0) {
      me.skipScandalRolls--;
      s.recentComments = ['Your newsroom source kills a story before it runs.', ...(s.recentComments ?? [])].slice(0, 5);
      return;
    }

    // Lover tip-off: a devoted lover (romantic, trust ≥ 70) warns you — 35%
    const lover = s.advisors?.find(a => a.relationshipType === 'romantic' && !a.betrayed && (a.trust ?? 0) >= 70);
    if (lover && random() < 0.35) {
      s.recentComments = [`${lover.name}, quietly: "Don't be near the docks tomorrow. Trust me."`, ...(s.recentComments ?? [])].slice(0, 5);
      console.log(`[Lover] ${lover.name} tipped off the governor — scandal averted`);
      return;
    }

    this._createPendingScandal();
  }

  // Creates a pending scandal unconditionally (no probability gate).
  // Used by _rollScandalEvent (after its roll) and crackdown (flat 30%).
  _createPendingScandal() {
    const s = this.state;
    if (s.pendingScandal) return;

    const available = (s.city?.scandals ?? []).filter(sc =>
      !s.activeScandals?.find(a => a.id === sc.id) &&
      !(s.resolvedScandals ?? []).includes(sc.id)
    );
    if (!available.length) return;

    const scandal = randomPick(available);
    const tier = scandal.severity_tier ?? 'minor';
    const SUPPRESS_COSTS = { minor: 20, moderate: 40, major: 80, career_ending: 150 };
    s.pendingScandal = {
      ...scandal,
      severity_tier: tier,
      suppress_cost: SUPPRESS_COSTS[tier] ?? 20,
    };
    console.log(`[Scandal] "${scandal.title ?? scandal.id}" (${tier}) erupts`);
  }

  _fireScandal(scandal, sourceId = 'auto_fired') {
    this.scandalSystem._applyScandal(scandal, sourceId);
    console.log(`[Scandal fired] ${scandal.title ?? scandal.id} (${sourceId})`);
  }

  acceptScandal() {
    const s = this.state;
    if (!s.pendingScandal) return;
    // 'accepted' = player chose this — no surprise reveal popup
    this._fireScandal(s.pendingScandal, 'accepted');
    s.pendingScandal = null;
    this.saveState();
  }

  suppressScandal() {
    const s = this.state;
    if (!s.pendingScandal) return;
    s.shiftBudget(-s.pendingScandal.suppress_cost);
    if (!s.resolvedScandals) s.resolvedScandals = [];
    s.resolvedScandals.push(s.pendingScandal.id);
    s.pendingScandal = null;
    console.log('[Scandal suppressed]');
    this.saveState();
  }

  respondToScandal(responseId) {
    const s = this.state;
    if (!s.pendingScandal) return { gameOver: false };
    const scandal = s.pendingScandal;
    const result = this.scandalSystem.applyResponse(scandal, responseId);
    if (!result.gameOver) s.resolvedScandals.push(scandal.id);
    s.pendingScandal = null;
    // Early end-of-term via scandal: resignation/failed miracle, or the
    // scandal's approval hit dropping the governor to 0. Record which scandal
    // ended the term so the final report can name it.
    if (result.gameOver) {
      s.endReason = 'career_ending_scandal';
      s.endScandal = { title: scandal.title ?? 'an unnamed scandal', tier: scandal.severity_tier ?? 'major', description: scandal.description ?? '' };
      // Distinguish "gambled on the miracle and lost" from a plain resignation
      if (responseId === 'miracle') s.setFlag('miracle_failed', true);
    } else if (s.approval <= 0 || result.hitZero) {
      // hitZero: the scandal's base penalty zeroed approval — the recall
      // happened before the response's recovery could paper over it
      s.endReason = 'recalled';
      s.endScandal = { title: scandal.title ?? 'an unnamed scandal', tier: scandal.severity_tier ?? 'major', description: scandal.description ?? '' };
      result.gameOver = true;
    }
    this.saveState();
    return result;
  }

  shiftAdvisorRelationship(advisorId, delta) {
    this.advisorSystem.shiftRelationship(advisorId, delta);
    this.saveState();
  }

  resolveLoverDemand(accept) {
    const result = this.advisorSystem.resolveLoverDemand(accept);
    this.saveState();
    return result;
  }

  resolvePartnerDemand(accept) {
    const result = this.advisorSystem.resolvePartnerDemand(accept);
    this.saveState();
    return result;
  }

  // ── Black market actions ───────────────────────────────────────────────

  buyMarketOffer(offerId) {
    const result = this.marketSystem.buy(offerId, this.scandalSystem);
    this.saveState();
    return result;
  }

  passMarket() {
    this.marketSystem.clearOffers();
    this.saveState();
  }

  // ── Address the Nation (heat defuse, once per term) ───────────────────
  // Fixed mechanics across cities; flavor text comes from city JSON.

  addressNation(optionId) {
    const s = this.state;
    if (s.hasFlag('address_used')) return;
    if ((s.heat ?? 0) < 25) return;
    s.setFlag('address_used', true);

    switch (optionId) {
      case 'own_it':
        s.shiftApproval(-5);
        addHeat(s, -6, 'address');
        console.log('[Address] Full apology: -5 approval, heat -6');
        break;
      case 'defiant':
        s.shiftApproval(3);
        addHeat(s, 2, 'address');
        if (random() < 0.15) this._createPendingScandal();
        console.log('[Address] Defiant: +3 approval, heat +2, 15% scandal');
        break;
      case 'deflect': {
        s.shiftApproval(-2);
        addHeat(s, -3, 'address');
        const live = s.advisors.filter(a => !a.betrayed);
        const fallGuy = randomPick(live);
        if (fallGuy) {
          fallGuy.agendaProgress = Math.min(100, (fallGuy.agendaProgress ?? 0) + 10);
          console.log(`[Address] Deflected — ${fallGuy.name} noticed the implication (+10 agenda)`);
        }
        break;
      }
    }
    this.saveState();
  }

  // ── External actor meetings + consultations (action-point spends) ─────

  summonActor(actorName) {
    const s = this.state;
    const decision = s.getNextDecision();
    const result = this.actorSystem.summon(actorName, decision);
    this.saveState();
    return result;
  }

  skipMeeting() {
    const s = this.state;
    s.meetingSkippedTurn = s.turn;
    console.log('[Meeting] Skipped by player');
    this.saveState();
  }

  resolveMeeting(accept) {
    const result = this.actorSystem.resolve(accept, this.scandalSystem);
    this.saveState();
    return result;
  }

  consultAdvisor(advisorId) {
    const result = this.advisorSystem.consult(advisorId);
    this.saveState();
    return result;
  }

  dismissNewspaper() {
    this.state.pendingNewspaper = null;
    this.saveState();
  }

  // ── Back channel (messenger actions) ──────────────────────────────────
  backChannelAction(advisorId, actionId) {
    const s = this.state;
    const result = this.advisorSystem.executeBackChannel(
      advisorId, actionId, this.scandalSystem,
      (b) => {
        if (!s.pendingBetrayals) s.pendingBetrayals = [];
        s.pendingBetrayals.push({
          advisorId:    b.id,
          advisorName:  b.name,
          line:         b.dialogue?.betrayal ?? 'I can no longer serve you.',
          relationship: b.relationshipType ?? 'neutral',
        });
      }
    );
    this.saveState();
    return result;
  }
}
