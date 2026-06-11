// src/engine/game-state.js — Single source of truth
import { getNextGenericProblem } from './generic-problems.js';
import { seed, shuffle, randomPick } from '../utils/random.js';

export const state = {
  settings: {
    sound:       false,
    feedSpeed:   'normal',
    scandalFreq: 'normal',
    language:    'english',
  },

  city: null,
  turn: 1,
  approval: 50,
  budget: 0,

  activeCrises: [],
  resolvedCrises: [],
  pendingCrisis: null,

  advisors: [],

  pastDecisions: [],
  pastCrises: [],

  activeScandals: [],
  resolvedScandals: [],

  flags: {},
  pendingBetrayals: [],
  pendingBribes: [],
  pendingScandal: null,

  pendingContractOffers: [],
  activeContractDeals: [],
  acceptedContracts: [],
  declinedContracts: [],
  lastContractOfferTurn: 0,

  consecutiveDeficitTurns: 0,
  pendingUnrest: null,
  pendingDecisionRecommendations: {},

  presentedDecisions: [],
  decisionsThisTurn: 0,
  maxDecisionsThisTurn: 1,
  // Problem backlog: id → turn it was presented. Unresolved problems carry
  // over; after 3 turns they disclose themselves (scandal or public anger).
  problemDeadlines: {},
  lastPresentTurn: 0,
  ignoredProblems: 0,

  recentComments: [],

  // Why the game ended:
  // null | 'recalled' | 'term_complete' | 'career_ending_scandal' | 'resigned'
  endReason: null,

  // Surprise scandals waiting for a reveal popup (decision fallout, leaks...)
  pendingScandalReveals: [],

  // Back channel: one action per turn (stores the turn it was used)
  backChannelUsedTurn: 0,
  // Tally of dirty politics for the end-of-term report
  dirtyDeeds: { skimmed: 0, threats: 0, leaks: 0, exposed: 0, marketBuys: 0 },

  // SCRUTINY (heat) system
  heat: 0,
  lastHeatGainTurn: 0,
  siegeTurns: 0,
  pendingHeatNotices: [],

  // Black market
  pendingMarketOffers: [],
  purchasedOffers: [],
  marketEffects: {},

  // Lover arc + crime partner demands
  pendingLoverDemand: null,
  pendingPartnerDemand: null,

  // ── Lifecycle ─────────────────────────────────────────────────────────

  loadCity(cityData) {
    seed((Date.now() ^ (Math.random() * 0xFFFFFF | 0)) >>> 0);
    this.city = cityData;
    this.turn = 1;
    this.approval = cityData.opening_sequence.starting_stats.approval_rating;
    this.budget = cityData.opening_sequence.starting_stats.budget;
    this.activeCrises = [];
    this.resolvedCrises = [];
    this.pendingCrisis = null;
    const TIER_ADVISOR_COUNTS = { easy: 5, medium: 5, hard: 4, extreme: 3, war: 3 };
    const targetCount = cityData.advisor_count ?? TIER_ADVISOR_COUNTS[cityData.tier] ?? 5;

    // Candidate pools: group by canonical domain (domain_id ?? id), pick ONE
    // candidate per domain — NEVER two advisors of the same domain — then
    // randomly choose which domains are present (tier count).
    const byDomain = {};
    for (const a of cityData.advisors) {
      const d = a.domain_id ?? a.id;
      if (!byDomain[d]) byDomain[d] = [];
      byDomain[d].push(a);
    }
    const domains = shuffle(Object.keys(byDomain));
    const selectedAdvisors = domains
      .slice(0, Math.min(targetCount, domains.length))
      .map(d => randomPick(byDomain[d]));

    const trustLevels = cityData.opening_sequence.starting_stats.advisor_trust_levels ?? {};
    this.advisors = selectedAdvisors.map(a => ({
      ...a,
      trust: trustLevels[a.id] ?? trustLevels[a.domain_id ?? a.id] ?? 50,
      agendaProgress: a.agenda_progress ?? 0,
      betrayed: false,
      romanceExposed: false,
      relationshipType: 'neutral',
      emergencyPowerUsed: false,
      corruptPact: false,
      pactTurns: 0,
      totalSkimmed: 0,
      pactResidual: 0,
      threatCount: 0,
      leakUsed: false,
      scorned: 0,
      sacrificed: false,
      lastDemandTurn: 0,
      pactPaused: 0,
    }));
    this.pastDecisions = [];
    this.pastCrises = [];
    this.activeScandals = [];
    this.resolvedScandals = [];
    this.flags = {};
    this.presentedDecisions = [];
    this.recentComments = [];
    this.decisionsThisTurn = 0;
    this.maxDecisionsThisTurn = 1;
    this.problemDeadlines = {};
    this.lastPresentTurn = 0;
    this.ignoredProblems = 0;
    this.pendingBribes = [];
    this.pendingScandal = null;
    this.pendingBetrayals = [];
    this.pendingContractOffers = [];
    this.activeContractDeals = [];
    this.acceptedContracts = [];
    this.declinedContracts = [];
    this.lastContractOfferTurn = 0;
    this.consecutiveDeficitTurns = 0;
    this.pendingUnrest = null;
    this.pendingDecisionRecommendations = {};
    this.endReason = null;
    this.pendingScandalReveals = [];
    this.backChannelUsedTurn = 0;
    this.dirtyDeeds = { skimmed: 0, threats: 0, leaks: 0, exposed: 0, marketBuys: 0 };
    this.heat = 0;
    this.lastHeatGainTurn = 0;
    this.siegeTurns = 0;
    this.pendingHeatNotices = [];
    this.pendingMarketOffers = [];
    this.purchasedOffers = [];
    this.marketEffects = {};
    this.pendingLoverDemand = null;
    this.pendingPartnerDemand = null;
  },

  // ── Decision pacing ───────────────────────────────────────────────────

  getNextDecision() {
    const CRISIS_ONLY_TURNS = [4, 8, 12];
    if (CRISIS_ONLY_TURNS.includes(this.turn) && this.activeCrises.length > 0) return null;
    return getNextGenericProblem(this);
  },

  recordDecisionResolved() {
    this.decisionsThisTurn++;
  },

  decisionCapReached() {
    return this.decisionsThisTurn >= this.maxDecisionsThisTurn;
  },

  // ── Economy ───────────────────────────────────────────────────────────

  getTaxRate() {
    if (this.city?.tax_rate !== undefined) return this.city.tax_rate;
    const TIER_RATES = { easy: 80, medium: 60, hard: 40, extreme: 25, war: 15 };
    return TIER_RATES[this.city?.tier] ?? 50;
  },

  // ── Advisors ─────────────────────────────────────────────────────────

  getBriefingAdvisors() {
    return this.advisors.filter(a => !a.betrayed);
  },

  getAdvisor(id) {
    return this.advisors.find(a => a.id === id);
  },

  // Find by canonical domain (candidate pools: unique id ≠ domain)
  getAdvisorByDomain(domainId) {
    return this.advisors.find(a => (a.domain_id ?? a.id) === domainId);
  },

  // Content references advisors by canonical domain ('finance'); runtime code
  // references them by unique id. This resolves either.
  findAdvisor(key) {
    return this.getAdvisor(key) ?? this.getAdvisorByDomain(key);
  },

  // ── Crises ────────────────────────────────────────────────────────────

  getAvailableCrises() {
    if (!this.city) return [];
    return this.city.crises.filter(c =>
      !this.resolvedCrises.includes(c.id) &&
      !this.activeCrises.includes(c.id) &&
      this.turn >= (c.turn_min ?? 1) &&
      this.turn <= (c.turn_max ?? 12)
    );
  },

  selectCrisisPool() {
    const available = this.city.crises.filter(c => !c.war_mode);
    const shuffled = shuffle(available);
    return shuffled.slice(0, Math.min(3, shuffled.length)).map(c => c.id);
  },

  shouldTriggerCrisis() {
    const CRISIS_TURNS = [4, 8, 12];
    return CRISIS_TURNS.includes(this.turn) && this.getAvailableCrises().length > 0;
  },

  // ── Stats ─────────────────────────────────────────────────────────────

  shiftApproval(delta) {
    this.approval = Math.max(0, Math.min(100, this.approval + delta));
  },

  shiftBudget(delta) {
    this.budget += delta;
  },

  // ── Flags ─────────────────────────────────────────────────────────────

  setFlag(key, value = true) {
    this.flags[key] = value;
  },

  hasFlag(key) {
    return !!this.flags[key];
  },

  // ── Persistence ──────────────────────────────────────────────────────

  serialize() {
    return JSON.stringify({
      version: '0.1.0',
      settings: this.settings,
      cityId: this.city?.city_id,
      turn: this.turn,
      approval: this.approval,
      budget: this.budget,
      activeCrises: this.activeCrises,
      resolvedCrises: this.resolvedCrises,
      pendingCrisis: this.pendingCrisis,
      advisors: this.advisors.map(a => ({
        id: a.id,
        trust: a.trust,
        agendaProgress: a.agendaProgress,
        betrayed: a.betrayed,
        romanceExposed: a.romanceExposed,
        relationshipType: a.relationshipType ?? 'neutral',
        emergencyPowerUsed: a.emergencyPowerUsed ?? false,
        corruptPact: a.corruptPact ?? false,
        pactTurns: a.pactTurns ?? 0,
        totalSkimmed: a.totalSkimmed ?? 0,
        pactResidual: a.pactResidual ?? 0,
        threatCount: a.threatCount ?? 0,
        leakUsed: a.leakUsed ?? false,
        scorned: a.scorned ?? 0,
        sacrificed: a.sacrificed ?? false,
        lastDemandTurn: a.lastDemandTurn ?? 0,
        pactPaused: a.pactPaused ?? 0,
      })),
      pastDecisions: this.pastDecisions,
      pastCrises: this.pastCrises,
      activeScandals: this.activeScandals,
      resolvedScandals: this.resolvedScandals,
      presentedDecisions: this.presentedDecisions,
      decisionsThisTurn: this.decisionsThisTurn,
      maxDecisionsThisTurn: this.maxDecisionsThisTurn,
      problemDeadlines: this.problemDeadlines,
      lastPresentTurn: this.lastPresentTurn,
      ignoredProblems: this.ignoredProblems,
      pendingBribes: this.pendingBribes,
      pendingScandal: this.pendingScandal,
      pendingContractOffers: this.pendingContractOffers,
      activeContractDeals: this.activeContractDeals,
      acceptedContracts: this.acceptedContracts,
      declinedContracts: this.declinedContracts,
      lastContractOfferTurn: this.lastContractOfferTurn,
      consecutiveDeficitTurns: this.consecutiveDeficitTurns,
      pendingUnrest: this.pendingUnrest,
      pendingBetrayals: this.pendingBetrayals,
      recentComments: this.recentComments,
      endReason: this.endReason,
      pendingScandalReveals: this.pendingScandalReveals,
      backChannelUsedTurn: this.backChannelUsedTurn,
      dirtyDeeds: this.dirtyDeeds,
      heat: this.heat,
      lastHeatGainTurn: this.lastHeatGainTurn,
      siegeTurns: this.siegeTurns,
      pendingHeatNotices: this.pendingHeatNotices,
      pendingMarketOffers: this.pendingMarketOffers,
      purchasedOffers: this.purchasedOffers,
      marketEffects: this.marketEffects,
      pendingLoverDemand: this.pendingLoverDemand,
      pendingPartnerDemand: this.pendingPartnerDemand,
      flags: this.flags,
    });
  },

  deserialize(data, cityData) {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    this.loadCity(cityData);
    if (parsed.settings) Object.assign(this.settings, parsed.settings);
    this.turn                 = parsed.turn;
    this.approval             = parsed.approval;
    this.budget               = parsed.budget;
    this.activeCrises         = parsed.activeCrises ?? [];
    this.resolvedCrises       = parsed.resolvedCrises ?? [];
    this.pendingCrisis        = parsed.pendingCrisis ?? null;
    this.pastDecisions        = parsed.pastDecisions ?? [];
    this.pastCrises           = parsed.pastCrises ?? [];
    this.activeScandals       = parsed.activeScandals ?? [];
    this.resolvedScandals     = parsed.resolvedScandals ?? [];
    this.presentedDecisions   = parsed.presentedDecisions ?? [];
    this.decisionsThisTurn    = parsed.decisionsThisTurn ?? 0;
    this.maxDecisionsThisTurn = parsed.maxDecisionsThisTurn ?? 1;
    this.problemDeadlines     = parsed.problemDeadlines ?? {};
    this.lastPresentTurn      = parsed.lastPresentTurn ?? 0;
    this.ignoredProblems      = parsed.ignoredProblems ?? 0;
    this.pendingBribes        = parsed.pendingBribes ?? [];
    this.pendingScandal       = parsed.pendingScandal ?? null;
    this.pendingContractOffers  = parsed.pendingContractOffers ?? [];
    this.activeContractDeals    = parsed.activeContractDeals ?? [];
    this.acceptedContracts      = parsed.acceptedContracts ?? [];
    this.declinedContracts      = parsed.declinedContracts ?? [];
    this.lastContractOfferTurn  = parsed.lastContractOfferTurn ?? 0;
    this.consecutiveDeficitTurns = parsed.consecutiveDeficitTurns ?? 0;
    this.pendingUnrest           = parsed.pendingUnrest ?? null;
    this.pendingBetrayals        = parsed.pendingBetrayals ?? [];
    this.recentComments          = parsed.recentComments ?? [];
    this.endReason               = parsed.endReason ?? null;
    this.pendingScandalReveals   = parsed.pendingScandalReveals ?? [];
    this.backChannelUsedTurn     = parsed.backChannelUsedTurn ?? 0;
    this.dirtyDeeds              = parsed.dirtyDeeds ?? { skimmed: 0, threats: 0, leaks: 0, exposed: 0, marketBuys: 0 };
    this.heat                    = parsed.heat ?? 0;
    this.lastHeatGainTurn        = parsed.lastHeatGainTurn ?? 0;
    this.siegeTurns              = parsed.siegeTurns ?? 0;
    this.pendingHeatNotices      = parsed.pendingHeatNotices ?? [];
    this.pendingMarketOffers     = parsed.pendingMarketOffers ?? [];
    this.purchasedOffers         = parsed.purchasedOffers ?? [];
    this.marketEffects           = parsed.marketEffects ?? {};
    this.pendingLoverDemand      = parsed.pendingLoverDemand ?? null;
    this.pendingPartnerDemand    = parsed.pendingPartnerDemand ?? null;
    this.flags                   = parsed.flags ?? {};

    // Rebuild the advisor roster from the SAVE, not from loadCity's random
    // shuffle — otherwise loading a save reshuffles which advisors are in play
    // and saved trust/agenda state is silently lost.
    if (parsed.advisors?.length) {
      this.advisors = parsed.advisors.map(saved => {
        const base = cityData.advisors.find(a => a.id === saved.id) ?? { id: saved.id };
        return {
          ...base,
          trust:              saved.trust,
          agendaProgress:     saved.agendaProgress,
          betrayed:           saved.betrayed ?? false,
          romanceExposed:     saved.romanceExposed ?? false,
          relationshipType:   saved.relationshipType ?? 'neutral',
          emergencyPowerUsed: saved.emergencyPowerUsed ?? false,
          corruptPact:        saved.corruptPact ?? false,
          pactTurns:          saved.pactTurns ?? 0,
          totalSkimmed:       saved.totalSkimmed ?? 0,
          pactResidual:       saved.pactResidual ?? 0,
          threatCount:        saved.threatCount ?? 0,
          leakUsed:           saved.leakUsed ?? false,
          scorned:            saved.scorned ?? 0,
          sacrificed:         saved.sacrificed ?? false,
          lastDemandTurn:     saved.lastDemandTurn ?? 0,
          pactPaused:         saved.pactPaused ?? 0,
        };
      });
    }
  },
};
