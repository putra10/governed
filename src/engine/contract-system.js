// src/engine/contract-system.js — Budget contracts / side quests
import contracts from '../../Hardcoded things/contract_offers.json';
import { random, randomPick, shuffle } from '../utils/random.js';

const TIER_CHANCE   = { easy: 0.20, medium: 0.20, hard: 0.30, extreme: 0.30, war: 0.30 };
const COOLDOWN_TURNS = 2;
const COMPETE_CHANCE = 0.25;

export class ContractSystem {
  constructor(state) {
    this.state = state;
  }

  processActiveContracts() {
    const s = this.state;
    if (!s.activeContractDeals?.length) return;
    s.activeContractDeals = s.activeContractDeals.filter(deal => {
      s.shiftBudget(deal.installmentAmount);
      deal.turnsRemaining--;
      // Pay out any rounding remainder on the final installment so the
      // total always equals the contract's full reward_budget
      if (deal.turnsRemaining === 0 && deal.remainder) {
        s.shiftBudget(deal.remainder);
        console.log(`[Contract] Final remainder: "${deal.title}" +${deal.remainder}M`);
      }
      console.log(`[Contract] Installment: "${deal.title}" +${deal.installmentAmount}M (${deal.turnsRemaining} left)`);
      return deal.turnsRemaining > 0;
    });
  }

  rollContractOffer() {
    const s = this.state;
    if (s.pendingContractOffers?.length) return;
    const lastTurn = s.lastContractOfferTurn ?? 0;
    if (s.turn - lastTurn < COOLDOWN_TURNS) return;

    const tier         = s.city?.tier ?? 'medium';
    const base         = TIER_CHANCE[tier] ?? 0.25;
    const deficitBonus = (s.consecutiveDeficitTurns ?? 0) >= 2 ? 0.20 : 0;
    const chance       = Math.min(0.70, base + deficitBonus);
    if (deficitBonus > 0) console.log(`[Contract] Deficit streak bonus +20% (streak: ${s.consecutiveDeficitTurns})`);
    if (random() > chance) return;

    const pool = this._getEligibleContracts();
    if (!pool.length) return;

    const competingPool = pool.filter(c => c.can_compete);
    if (competingPool.length >= 2 && random() < COMPETE_CHANCE) {
      const [a, b] = this._pickTwo(competingPool);
      s.pendingContractOffers = [a, b];
      console.log(`[Contract] Competing: "${a.title}" vs "${b.title}"`);
      return;
    }

    const chosen = randomPick(pool);
    s.pendingContractOffers = [chosen];
    console.log(`[Contract] Offer: "${chosen.title}"`);
  }

  acceptContract(contractId) {
    const s      = this.state;
    const offers = s.pendingContractOffers ?? [];
    const c      = offers.find(x => x.id === contractId);
    if (!c) return;

    if (c.duration > 1) {
      const installment = Math.floor(c.reward_budget / c.duration);
      const remainder   = c.reward_budget - installment * c.duration;
      if (!s.activeContractDeals) s.activeContractDeals = [];
      s.activeContractDeals.push({
        id: c.id, title: c.title,
        installmentAmount: installment,
        turnsRemaining: c.duration,
        remainder,
      });
      console.log(`[Contract] Multi-turn: "${c.title}" +${installment}M x${c.duration}`);
    } else {
      s.shiftBudget(c.reward_budget);
      console.log(`[Contract] Accepted: "${c.title}" +${c.reward_budget}M`);
    }

    if (c.approval_delta) s.shiftApproval(c.approval_delta);
    if (c.scandal_risk && random() < c.scandal_risk) this._triggerContractScandal();

    (c.advisor_effects ?? []).forEach(eff => {
      const adv = s.getAdvisor(eff.advisor_id);
      if (adv) adv.trust = Math.max(0, Math.min(100, (adv.trust ?? 50) + (eff.trust_delta ?? 0)));
    });

    if (!s.acceptedContracts) s.acceptedContracts = [];
    s.acceptedContracts.push(c.id);
    // Mark losing competing offers as declined so they can't re-appear later
    if (!s.declinedContracts) s.declinedContracts = [];
    offers.filter(x => x.id !== c.id).forEach(x => s.declinedContracts.push(x.id));
    s.pendingContractOffers = [];
    s.lastContractOfferTurn = s.turn;
  }

  declineContract(contractId) {
    const s      = this.state;
    const offers = s.pendingContractOffers ?? [];
    const c      = offers.find(x => x.id === contractId);
    if (!c) return;

    if (offers.length === 1 && c.decline_penalty) {
      s.shiftApproval(c.decline_penalty);
      console.log(`[Contract] Declined "${c.title}" penalty ${c.decline_penalty}%`);
    }

    if (!s.declinedContracts) s.declinedContracts = [];
    s.declinedContracts.push(c.id);
    s.pendingContractOffers = offers.filter(x => x.id !== contractId);
    if (!s.pendingContractOffers.length) s.lastContractOfferTurn = s.turn;
  }

  declineAllContracts() {
    const s = this.state;
    const offers = s.pendingContractOffers ?? [];
    if (!s.declinedContracts) s.declinedContracts = [];
    offers.forEach(c => s.declinedContracts.push(c.id));
    s.pendingContractOffers = [];
    s.lastContractOfferTurn = s.turn;
    console.log('[Contract] Declined all competing offers');
  }

  _getEligibleContracts() {
    const s        = this.state;
    const tier     = s.city?.tier;
    const accepted = s.acceptedContracts ?? [];
    const declined = s.declinedContracts ?? [];
    const hasLegendary = accepted.some(id => contracts.find(x => x.id === id)?.rarity === 'legendary');

    return contracts.filter(c => {
      if (accepted.includes(c.id)) return false;
      if (declined.includes(c.id)) return false;
      if (c.tier_filter && !c.tier_filter.includes(tier)) return false;
      if (s.turn < (c.min_turn ?? 1)) return false;
      if (s.turn > (c.max_turn ?? 12)) return false;
      if (c.rarity === 'legendary' && hasLegendary) return false;
      if (c.requires && !this._checkRequires(c.requires)) return false;
      return true;
    });
  }

  _checkRequires(req) {
    if (!req) return true;
    const s = this.state;
    if (req.min_decisions_resolved !== undefined) {
      if ((s.pastDecisions?.length ?? 0) < req.min_decisions_resolved) return false;
    }
    if (req.advisor_active) {
      const adv = s.getAdvisor(req.advisor_active);
      if (!adv || adv.betrayed) return false;
      if (req.advisor_min_trust !== undefined && (adv.trust ?? 50) < req.advisor_min_trust) return false;
    }
    return true;
  }

  _pickTwo(arr) {
    const copy = shuffle(arr);
    return [copy[0], copy[1]];
  }

  _triggerContractScandal() {
    const s = this.state;
    if (s.pendingScandal) return;
    const available = (s.city?.scandals ?? []).filter(sc =>
      !s.activeScandals?.find(a => a.id === sc.id) &&
      !(s.resolvedScandals ?? []).includes(sc.id)
    );
    if (!available.length) return;
    const sc   = randomPick(available);
    const tier = sc.severity_tier ?? 'minor';
    const SUPPRESS_COSTS = { minor: 20, moderate: 40, major: 80, career_ending: 150 };
    s.pendingScandal = { ...sc, severity_tier: tier, suppress_cost: SUPPRESS_COSTS[tier] ?? 20 };
    console.warn('[Contract] Scandal triggered!');
  }
}
