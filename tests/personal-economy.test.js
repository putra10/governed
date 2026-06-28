import { describe, it, expect, beforeEach } from 'vitest';
import { makeCity } from './fixtures.js';
import { state } from '../src/engine/game-state.js';
import { TurnManager } from '../src/engine/turn-manager.js';

function freshGame(o = {}) {
  state.loadCity(makeCity(o));
  return new TurnManager(state);
}

describe('personal funds economy', () => {
  let tm;
  beforeEach(() => { tm = freshGame(); });

  it('seeds personal funds at 30% of the opening budget', () => {
    expect(state.personalFunds).toBe(Math.max(0, Math.round(0.30 * state.budget)));
  });

  it('skim flows to personal funds, leaving the public budget untouched', () => {
    const adv = state.getAdvisor('finance');
    adv.trust = 90;
    tm.backChannelAction('finance', 'corrupt_pact');
    const pBefore = state.personalFunds, bBefore = state.budget;
    tm.advisorSystem.processCorruptPacts(tm.scandalSystem);
    expect(state.personalFunds).toBeGreaterThan(pBefore);
    expect(state.budget).toBe(bBefore);
  });

  it('allows multiple simultaneous pacts', () => {
    const a = state.advisors[0], b = state.advisors[1];
    a.trust = 90; b.trust = 90;
    expect(tm.backChannelAction(a.id, 'corrupt_pact').ok).toBe(true);
    // second pact same turn is blocked only by the once-per-turn rule, so advance the flag
    state.backChannelUsedTurn = 0;
    expect(tm.backChannelAction(b.id, 'corrupt_pact').ok).toBe(true);
    expect(state.advisors.filter(x => x.corruptPact).length).toBe(2);
  });

  it('donation moves money to the city, lifts approval, and queues news', () => {
    state.personalFunds = 100;
    const appr = state.approval, budg = state.budget;
    const r = tm.donateToCity(40);
    expect(r.ok).toBe(true);
    expect(state.personalFunds).toBe(60);
    expect(state.budget).toBe(budg + 40);
    expect(state.approval).toBe(Math.min(100, appr + 1));
    expect(state.pendingDonationNews?.amount).toBe(40);
  });

  it('launder rolls back the trail and cools scrutiny from personal funds', () => {
    const adv = state.getAdvisor('finance');
    adv.trust = 90;
    tm.backChannelAction('finance', 'corrupt_pact');
    adv.pactTurns = 6;
    state.heat = 20;
    state.personalFunds = 100;
    state.backChannelUsedTurn = 0;
    tm.backChannelAction('finance', 'launder');
    expect(adv.pactTurns).toBe(3);
    expect(state.heat).toBe(14);        // -6 scrutiny
    expect(state.personalFunds).toBe(70);
  });

  it('corruption raid exposes every pact and seizes slush', () => {
    const adv = state.getAdvisor('finance');
    adv.corruptPact = true;
    state.personalFunds = 200;
    tm.advisorSystem._corruptionRaid(tm.scandalSystem);
    expect(adv.corruptPact).toBe(false);
    expect(state.personalFunds).toBe(100);   // half seized
    expect(state.activeScandals.length).toBeGreaterThan(0);
  });

  it('active pacts raise SCRUTINY each turn (no separate meter)', () => {
    const adv = state.getAdvisor('finance');
    adv.corruptPact = true;
    state.heat = 0;
    tm.advisorSystem.processRaidRisk(tm.scandalSystem);
    expect(state.heat).toBeGreaterThan(0);
    expect(state.oversight).toBeUndefined();
  });

  it('black market buys are paid from personal funds, not the city budget', () => {
    state.personalFunds = 100;
    const b = state.budget;
    state.pendingMarketOffers = [{ id: 'x', title: 'T', type: 'influence', cost: 40, askingPrice: 40, effects: {}, heat: 0 }];
    tm.marketSystem.buy('x', tm.scandalSystem);
    expect(state.budget).toBe(b);
    expect(state.personalFunds).toBe(60);
  });

  it('sell-side offers pay proceeds into personal funds', () => {
    state.personalFunds = 10;
    const b = state.budget;
    state.pendingMarketOffers = [{ id: 's', title: 'Sell', type: 'sellside', cost: -50, askingPrice: -50, effects: {}, heat: 0 }];
    tm.marketSystem.buy('s', tm.scandalSystem);
    expect(state.budget).toBe(b);
    expect(state.personalFunds).toBe(60);
  });

  it('black market buy is blocked when personal funds fall short', () => {
    state.personalFunds = 20;
    state.pendingMarketOffers = [{ id: 'p', title: 'Pricey', type: 'influence', cost: 90, askingPrice: 90, effects: {}, heat: 0 }];
    const r = tm.marketSystem.buy('p', tm.scandalSystem);
    expect(r.ok).toBe(false);
    expect(state.personalFunds).toBe(20);
  });
});

describe('advisor trust redesign', () => {
  let tm;
  beforeEach(() => { tm = freshGame(); });

  function fundReq(adv, over = {}) {
    return {
      advisorId: adv.id, advisorName: adv.name, amount: 30, project: 'p', ask: 'q',
      accept: { trust: 12, agenda: -10, approval: 0, scandalRisk: 0, msg: 'ok' },
      decline: { trust: -3, agenda: 0, approval: 0, msg: 'no' },
      ...over,
    };
  }

  it('funding (accept) applies the case effects from the pool, paid from city budget', () => {
    const adv = state.advisors[0];
    state.pendingFundingRequest = fundReq(adv, { accept: { trust: 14, agenda: -12, approval: 3, msg: 'm' } });
    state.budget = 100;
    const t0 = adv.trust ?? 50, a0 = state.approval;
    const r = tm.resolveFundingRequest(true);
    expect(r.ok).toBe(true);
    expect(state.budget).toBe(70);
    expect(adv.trust).toBe(Math.min(100, t0 + 14));
    expect(state.approval).toBe(Math.min(100, a0 + 3));
    expect(state.pendingFundingRequest).toBe(null);
  });

  it('declining applies the decline effects', () => {
    const adv = state.advisors[0];
    adv.trust = 50;
    state.pendingFundingRequest = fundReq(adv, { decline: { trust: -6, agenda: 8, msg: 'n' } });
    tm.resolveFundingRequest(false);
    expect(adv.trust).toBe(44);
    expect(state.pendingFundingRequest).toBe(null);
  });

  it('can not fund beyond the treasury', () => {
    const adv = state.advisors[0];
    state.pendingFundingRequest = fundReq(adv, { amount: 80 });
    state.budget = 20;
    const r = tm.resolveFundingRequest(true);
    expect(r.ok).toBe(false);
    expect(state.budget).toBe(20);
    expect(state.pendingFundingRequest).not.toBe(null);
  });

  it('a risky funding case can fire a scandal on accept', () => {
    const adv = state.advisors[0];
    state.budget = 200;
    state.pendingFundingRequest = fundReq(adv, { accept: { trust: 10, scandalRisk: 1, scandalTier: 'moderate', scandalTitle: 'Dirty Contracts', msg: 'm' } });
    const r = tm.resolveFundingRequest(true);
    expect(r.busted).toBe(true);
    expect(state.activeScandals.length).toBeGreaterThan(0);
  });

  it('get_closer gives diminishing trust (no clicking your way to loyalty)', () => {
    const adv = state.advisors[0];
    adv.trust = 50; adv.relationshipType = 'neutral'; adv.getCloserCount = 0;
    tm.advisorSystem._bcGetCloser(adv);
    expect(adv.trust).toBe(53);          // +3
    const before = adv.trust;
    tm.advisorSystem._bcGetCloser(adv);
    expect(adv.trust - before).toBe(2);  // +2, diminishing
  });
});
