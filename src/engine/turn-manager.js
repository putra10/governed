// src/engine/turn-manager.js — Turn flow controller
import { randomPick, random } from '../utils/random.js';
import { saveGame } from '../utils/local-storage.js';
import { CrisisManager } from './crisis-manager.js';
import { AdvisorSystem, EMERGENCY_POWERS, ADVISOR_SECRET_CRISIS_OPTIONS } from './advisor-system.js';
import { ConsequenceSim } from './consequence-sim.js';
import { ScandalSystem } from './scandal-system.js';
import { ContractSystem } from './contract-system.js';
import { getGenericProblemById } from './generic-problems.js';

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

    // Reset per-turn decision quota (always 1 generic problem per turn)
    s.decisionsThisTurn    = 0;
    s.maxDecisionsThisTurn = 1;

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
    this.advisorSystem.generateBriefings();
    const nextDecision = this.state.getNextDecision();
    if (nextDecision) this.advisorSystem.generateRecommendations(nextDecision);

    // Layer 2: advisors checked out (trust<30) silently hurt city stats
    this.advisorSystem.applyAbsenceEffects();

    // 6. Natural crisis trigger check — push to activeCrises
    if (this.crisisManager.shouldTriggerCrisis()) {
      const crisisId = this.crisisManager.triggerCrisis();
      if (crisisId) {
        this.saveState();
        return 'crisis_triggered';
      }
    }

    // 7. Auto-save
    this.saveState();

    return null; // null = continue playing
  }

  // ── Decision resolution ───────────────────────────────────────────────

  resolveDecision(decisionId, optionIndex) {
    const s = this.state;
    const decision = getGenericProblemById(decisionId, s.city);
    if (!decision) { console.warn('Decision not found:', decisionId); return; }

    const option = decision.options[optionIndex];
    if (!option) { console.warn('Option not found:', optionIndex); return; }

    this.consequenceSim.apply(option.consequences, {
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
      }
    }
    s.pendingDecisionRecommendations = {};

    // Layer 1+3: if decision matches an advisor's domain, reward their trust
    //            and slow their betrayal clock (good governance = loyalty)
    const dom = decision._domain;
    if (dom) {
      const adv = s.advisors.find(a => a.id === dom && !a.betrayed);
      if (adv) {
        adv.trust          = Math.min(100, (adv.trust ?? 50) + 5);
        adv.agendaProgress = Math.max(0,   (adv.agendaProgress ?? 0) - 8);
        console.log(`[Domain] ${adv.name} +5 trust, -8 agenda (decision matched domain)`);
      }
    }

    this._generateReaction(option.consequences.approval_delta ?? 0);
    this.saveState();
  }

  resolveCrisis(crisisId, optionIndex, advisorSecretId = null) {
    const s = this.state;
    const crisis = s.city.crises.find(c => c.id === crisisId);
    if (!crisis) { console.warn('Crisis not found:', crisisId); return; }

    // Advisor secret option: virtual index beyond normal options
    let option;
    if (advisorSecretId) {
      const secretConseq = ADVISOR_SECRET_CRISIS_OPTIONS[advisorSecretId];
      if (secretConseq) {
        option = { consequences: secretConseq };
        // Reward the advisor who helped (+5 trust)
        const adv = s.getAdvisor(advisorSecretId);
        if (adv) {
          adv.trust = Math.min(100, (adv.trust ?? 50) + 5);
          console.log(`[Crisis Secret] ${adv.name} +5 trust for secret option`);
        }
      }
    } else {
      option = crisis.options[optionIndex];
    }

    if (!option) { console.warn('Crisis option not found:', optionIndex); return; }

    this.consequenceSim.apply(option.consequences, {
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
    if (context === 'crisis')    pool = lib.crisis;
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
    const finAdv = s.advisors?.find(a => a.id === 'finance' && !a.betrayed);
    if (finAdv && (finAdv.trust ?? 0) >= 75) {
      s.shiftBudget(10);
      console.log('[Advisor Passive] Finance bonus: +10M (trust ≥75)');
    }

    console.log(`[Tax] +${income}M (base ${rate}M, approval ${s.approval}%)`);
  }

  _applyBudgetPressure() {
    const s = this.state;
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

    const debtPressure  = Math.min(1, Math.abs(s.budget) / 300);
    const approvalPanic = Math.max(0, (37 - s.approval) / 37);
    let   chance        = 0.20 + debtPressure * 0.15 + approvalPanic * 0.20;

    const urbanAdv = s.advisors?.find(a => a.id === 'urban_planning' && !a.betrayed);
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
    const tier = s.city?.tier;
    if (tier === 'war') {
      s.shiftApproval(-2);
      console.log('[Tier] War zone instability: -2 approval');
    } else if (tier === 'extreme') {
      s.shiftApproval(-1);
      console.log('[Tier] Extreme pressure: -1 approval');
    }
  }

  // One-time panic button per advisor
  useEmergencyPower(advisorId) {
    const s       = this.state;
    const advisor = s.getAdvisor(advisorId);
    if (!advisor || advisor.betrayed || advisor.emergencyPowerUsed) return;

    const power = EMERGENCY_POWERS[advisorId];
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

  acceptBribe(advisorId) {
    const s     = this.state;
    const bribe = (s.pendingBribes ?? []).find(b => b.advisorId === advisorId);
    if (!bribe) return;

    s.pendingBribes = s.pendingBribes.filter(b => b.advisorId !== advisorId);

    // Guard: never pay a betrayed advisor (offer should already be purged
    // by triggerBetrayal, but a stale save could still contain one)
    const advisor = s.getAdvisor(advisorId);
    if (advisor?.betrayed) { this.saveState(); return; }

    s.shiftBudget(-bribe.cost);

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

    const milAdv = s.advisors?.find(a => a.id === 'military_liaison' && !a.betrayed);
    if (milAdv && (milAdv.trust ?? 0) >= 75) {
      chance *= 0.85;
      console.log('[Advisor Passive] Military reduces scandal chance by 15%');
    }

    if (random() >= chance) return;
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
    const result = this.scandalSystem.applyResponse(s.pendingScandal, responseId);
    if (!result.gameOver) s.resolvedScandals.push(s.pendingScandal.id);
    s.pendingScandal = null;
    // Early end-of-term via scandal: resignation/failed miracle, or the
    // scandal's approval hit dropping the governor to 0
    if (result.gameOver) {
      s.endReason = 'career_ending_scandal';
      // Distinguish "gambled on the miracle and lost" from a plain resignation
      if (responseId === 'miracle') s.setFlag('miracle_failed', true);
    } else if (s.approval <= 0) {
      s.endReason = 'recalled';
      result.gameOver = true;
    }
    this.saveState();
    return result;
  }

  shiftAdvisorRelationship(advisorId, delta) {
    this.advisorSystem.shiftRelationship(advisorId, delta);
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
