// src/engine/market-system.js — The Black Market.
// Appears after the day's decision. One offer from a random type; a second
// "linked" offer if the day's problem domain attracts a dealer type.
// Every purchase adds heat. Offers expire at end of turn.

import offers from '../../Hardcoded things/black_market.json';
import { random, randomPick } from '../utils/random.js';
import { addHeat } from './heat-system.js';

export const MARKET_TYPES = ['influence', 'intelligence', 'cleanup', 'insurance', 'sellside', 'dark'];

// Day's problem domain → the dealer type it attracts
const DOMAIN_LINK = {
  finance:           'sellside',
  urban_planning:    'insurance',
  transport:         'insurance',
  religious_affairs: 'intelligence',
  military_liaison:  'influence',
  null:              'cleanup',     // media scandals attract fixers
};

export class MarketSystem {
  constructor(state) {
    this.state = state;
  }

  // ── Eligibility ───────────────────────────────────────────────────────────
  _eligible(offer) {
    const s = this.state;
    if (!offer.repeatable && (s.purchasedOffers ?? []).includes(offer.id)) return false;
    if (offer.tier_filter && !offer.tier_filter.includes(s.city?.tier)) return false;
    if (offer.requires === 'pending_scandal' && !s.pendingScandal) return false;
    if (offer.requires === 'pending_unrest' && !s.pendingUnrest) return false;
    if (offer.requires === 'betrayed_advisor' && !s.advisors.some(a => a.betrayed)) return false;
    if (offer.requires === 'pact_active' && !s.advisors.some(a => a.corruptPact)) return false;
    if (offer.requires === 'pact_residual' && !s.advisors.some(a => (a.pactResidual ?? 0) > 0)) return false;
    if (offer.requires === 'heat' && (s.heat ?? 0) < 5) return false;
    return true;
  }

  _price(offer) {
    const s = this.state;
    if (offer.cost === 'half_suppress') {
      return Math.ceil((s.pendingScandal?.suppress_cost ?? 40) / 2);
    }
    let cost = offer.cost ?? 0;
    // INVESTIGATED+: dealers charge a risk premium of 25%
    if (cost > 0 && (s.heat ?? 0) >= 45) cost = Math.ceil(cost * 1.25);
    return cost;
  }

  // ── Per-turn roll (called after the day's decision resolves) ──────────────
  rollOffers(decisionDomain) {
    const s = this.state;
    if (s.pendingMarketOffers?.length) return;

    let chance = 0.30;
    if (s.budget < 0)    chance += 0.10;
    if (s.approval < 35) chance += 0.10;
    if (random() > Math.min(0.50, chance)) return;

    const byType = (t) => offers.filter(o => o.type === t && this._eligible(o));
    const liveTypes = MARKET_TYPES.filter(t => byType(t).length > 0);
    if (!liveTypes.length) return;

    const picked = [];
    const mainType = randomPick(liveTypes);
    picked.push(randomPick(byType(mainType)));

    // Linked second offer: the market read today's newspaper
    const linkedType = DOMAIN_LINK[decisionDomain ?? 'null'];
    if (linkedType && linkedType !== mainType && byType(linkedType).length) {
      const linked = randomPick(byType(linkedType).filter(o => o.id !== picked[0].id));
      if (linked) picked.push(linked);
    }

    s.pendingMarketOffers = picked.map(o => ({ ...o, askingPrice: this._price(o) }));
    console.log(`[Market] Open tonight: ${picked.map(o => o.title).join(' / ')}`);
  }

  clearOffers() {
    this.state.pendingMarketOffers = [];
  }

  // ── Purchase ──────────────────────────────────────────────────────────────
  buy(offerId, scandalSystem) {
    const s = this.state;
    const offer = (s.pendingMarketOffers ?? []).find(o => o.id === offerId);
    if (!offer) return { ok: false, msg: 'The dealer is gone.' };

    const price = offer.askingPrice ?? this._price(offer);
    // Black-market dealings are off the books — paid from (and paid into) your
    // PERSONAL funds, never the public budget. Sell-side offers (negative price)
    // are you pocketing the proceeds of selling the city out from under it.
    if (price > 0 && (s.personalFunds ?? 0) < price) {
      s.recentComments = [`You can't cover the ${price}M asking price from personal funds.`, ...(s.recentComments ?? [])].slice(0, 5);
      return { ok: false, msg: 'Not enough personal funds for this deal.' };
    }
    s.shiftPersonal(-price); // negative price = sell-side gain into your pocket

    this._applyEffects(offer.effects ?? {}, scandalSystem);
    if (offer.heat) addHeat(s, offer.heat, 'black_market');

    if (!s.purchasedOffers) s.purchasedOffers = [];
    s.purchasedOffers.push(offer.id);
    if (!s.dirtyDeeds) s.dirtyDeeds = { skimmed: 0, threats: 0, leaks: 0, exposed: 0, marketBuys: 0 };
    s.dirtyDeeds.marketBuys = (s.dirtyDeeds.marketBuys ?? 0) + 1;
    if (price < 0) s.dirtyDeeds.sold = (s.dirtyDeeds.sold ?? 0) + (-price); // sell-side proceeds = corrupt income
    s.pendingMarketOffers = s.pendingMarketOffers.filter(o => o.id !== offerId);

    // Risk roll
    let busted = false;
    if (offer.risk && random() < offer.risk.chance) {
      busted = true;
      this._applyRisk(offer, scandalSystem);
    }
    console.log(`[Market] Bought "${offer.title}" (${price}M)${busted ? ' — IT WENT WRONG' : ''}`);
    return { ok: true, busted };
  }

  // ── Effects interpreter ───────────────────────────────────────────────────
  _topAgendaAdvisor() {
    const live = this.state.advisors.filter(a => !a.betrayed);
    return live.sort((a, b) => (b.agendaProgress ?? 0) - (a.agendaProgress ?? 0))[0] ?? null;
  }

  _applyEffects(fx, scandalSystem) {
    const s = this.state;
    const me = s.marketEffects ?? (s.marketEffects = {});
    const top = this._topAgendaAdvisor();

    if (fx.approval)          s.shiftApproval(fx.approval);
    if (fx.approval_low_boost) s.shiftApproval(s.approval < 40 ? fx.approval_low_boost : Math.ceil(fx.approval_low_boost / 2));
    if (fx.budget)            s.shiftBudget(fx.budget);
    if (fx.heat)              addHeat(s, fx.heat, 'laundry');
    if (fx.heat_zero)         s.heat = 0;

    if (fx.agenda_top && top)  top.agendaProgress = Math.max(0, Math.min(100, (top.agendaProgress ?? 0) + fx.agenda_top));
    if (fx.agenda_all)         s.advisors.forEach(a => { if (!a.betrayed) a.agendaProgress = Math.max(0, Math.min(100, (a.agendaProgress ?? 0) + fx.agenda_all)); });
    if (fx.trust_all)          s.advisors.forEach(a => { if (!a.betrayed) a.trust = Math.max(0, Math.min(100, (a.trust ?? 50) + fx.trust_all)); });
    if (fx.trust_top && top)   top.trust = Math.max(0, Math.min(100, (top.trust ?? 50) + fx.trust_top));
    if (fx.agenda_id) {
      const adv = s.findAdvisor(fx.agenda_id.id); // canonical domain reference
      if (adv && !adv.betrayed) adv.agendaProgress = Math.max(0, Math.min(100, (adv.agendaProgress ?? 0) + fx.agenda_id.n));
    }
    if (fx.trust_id) {
      const adv = s.findAdvisor(fx.trust_id.id);
      if (adv && !adv.betrayed) adv.trust = Math.max(0, Math.min(100, (adv.trust ?? 50) + fx.trust_id.n));
    }
    if (fx.threat_reset_all)   s.advisors.forEach(a => { a.threatCount = 0; });

    if (fx.clear_scandal && s.pendingScandal) {
      if (!s.resolvedScandals) s.resolvedScandals = [];
      s.resolvedScandals.push(s.pendingScandal.id);
      me.lastClearedScandal = { ...s.pendingScandal }; // for fixer resurface
      s.pendingScandal = null;
    }
    if (fx.clear_unrest)       s.pendingUnrest = null;
    if (fx.clear_reveals)      s.pendingScandalReveals = [];
    if (fx.pact_reset)         s.advisors.forEach(a => { a.pactTurns = 0; });
    if (fx.clear_residual)     s.advisors.forEach(a => { a.pactResidual = 0; });
    if (fx.restore_betrayed) {
      const dead = s.advisors.find(a => a.betrayed);
      if (dead) { dead.betrayed = false; dead.sacrificed = false; dead.trust = 30; dead.agendaProgress = 40; }
    }
    if (fx.deficit_reset)      s.consecutiveDeficitTurns = 0;

    // Timed auras (turn numbers are inclusive "active until")
    const until = (n) => s.turn + n;
    if (fx.unrest_immunity)    me.unrestImmunityUntil = until(fx.unrest_immunity);
    if (fx.unrest_damp)        me.unrestDampUntil = until(fx.unrest_damp);
    if (fx.unrest_boost)       me.unrestBoostUntil = until(fx.unrest_boost);
    if (fx.skip_crisis)        me.skipNextCrisis = true;
    if (fx.scandal_mult)       { me.scandalMult = fx.scandal_mult.value; me.scandalMultUntil = until(fx.scandal_mult.turns); }
    if (fx.feed_positive)      me.feedPositiveUntil = until(fx.feed_positive);
    if (fx.halve_drains)       me.halveDrainsTurn = s.turn + 1;
    if (fx.slush_fund)         me.slushFund = fx.slush_fund;
    if (fx.halve_next_loss)    me.halveNextDecisionLoss = true;
    if (fx.crisis_cost_half)   me.crisisCostHalf = true;
    if (fx.crisis_approval_half) me.crisisApprovalHalf = true;
    if (fx.crisis_approval_worsen) me.crisisApprovalWorsen = (me.crisisApprovalWorsen ?? 0) + fx.crisis_approval_worsen;
    if (fx.betrayal_half)      me.betrayalHalf = true;
    if (fx.deficit_pause)      me.deficitPauseUntil = until(fx.deficit_pause);
    if (fx.tier_drain_pause)   me.tierDrainPauseUntil = until(fx.tier_drain_pause);
    if (fx.skip_scandal_rolls) me.skipScandalRolls = (me.skipScandalRolls ?? 0) + fx.skip_scandal_rolls;
    if (fx.exposure_shield)    me.exposureShield = (me.exposureShield ?? 0) + fx.exposure_shield;
    if (fx.backfire_shield)    me.backfireShield = (me.backfireShield ?? 0) + fx.backfire_shield;
    if (fx.free_back_channel)  me.freeBackChannel = true;
    if (fx.agenda_freeze_top && top) me.agendaFreeze = { advisorId: top.id, until: until(fx.agenda_freeze_top) };
    if (fx.agenda_freeze_all)  me.allAgendaFreezeUntil = until(fx.agenda_freeze_all);
    if (fx.threat_unlock_top && top) me.threatUnlock = { advisorId: top.id, until: until(fx.threat_unlock_top) };
    if (fx.income)             { if (!me.incomes) me.incomes = []; me.incomes.push({ ...fx.income, turnsLeft: fx.income.turns }); }
    if (fx.approval_drip)      { if (!me.drips) me.drips = []; me.drips.push({ ...fx.approval_drip, turnsLeft: fx.approval_drip.turns }); }
    if (fx.loan)               me.loanDue = { amount: fx.loan.repay, dueTurn: Math.min(10, s.turn + fx.loan.turns) };
  }

  // ── Risk outcomes ─────────────────────────────────────────────────────────
  _applyRisk(offer, scandalSystem) {
    const s = this.state;
    const me = s.marketEffects ?? (s.marketEffects = {});
    const r = offer.risk;
    if (!s.dirtyDeeds) s.dirtyDeeds = { skimmed: 0, threats: 0, leaks: 0, exposed: 0, marketBuys: 0 };

    switch (r.outcome) {
      case 'scandal':
        s.dirtyDeeds.exposed++;
        if (offer.id === 'total_whitewash') addHeat(s, 6, 'whitewash_caught');
        scandalSystem?._applyScandal({
          id: `market_${offer.id}_${s.turn}`,
          title: r.title ?? `${offer.title} Exposed`,
          severity_tier: r.tier ?? 'moderate',
        }, 'black_market');
        break;
      case 'resurface': {
        // The Fixer failed: the cleared scandal returns one tier worse next turn
        const ladder = ['minor', 'moderate', 'major', 'career_ending'];
        const old = me.lastClearedScandal;
        if (old) {
          const worse = ladder[Math.min(3, ladder.indexOf(old.severity_tier ?? 'minor') + 1)];
          me.resurface = { ...old, severity_tier: worse, id: `${old.id}_resurfaced` };
        }
        break;
      }
      case 'rivalry_top': {
        const top = this._topAgendaAdvisor();
        if (top) { top.relationshipType = 'rivalry'; top.trust = Math.max(0, (top.trust ?? 50) - 15); }
        break;
      }
      case 'forced_unrest':
        me.forcedUnrestTurn = s.turn + 1;
        break;
    }
  }
}
