import { describe, it, expect, beforeEach } from 'vitest';
import { makeCity } from './fixtures.js';
import { state } from '../src/engine/game-state.js';
import { TurnManager } from '../src/engine/turn-manager.js';

function freshGame(cityOverrides = {}) {
  state.loadCity(makeCity(cityOverrides));
  return new TurnManager(state);
}

describe('end conditions', () => {
  let tm;
  beforeEach(() => { tm = freshGame(); });

  it('recalls the governor at 0 approval', () => {
    state.approval = 0;
    expect(tm._checkEndConditions()).toBe('recalled');
    expect(state.endReason).toBe('recalled');
  });

  it('completes the term at turn 12 with no active crises', () => {
    state.turn = 12;
    expect(tm._checkEndConditions()).toBe('term_complete');
    expect(state.endReason).toBe('term_complete');
  });

  it('does NOT complete the term while a crisis is unresolved', () => {
    state.turn = 12;
    state.activeCrises = ['some_crisis'];
    expect(tm._checkEndConditions()).toBe(null);
  });
});

describe('scandal responses (career-ending flow)', () => {
  let tm;
  beforeEach(() => { tm = freshGame(); });

  it('resign_now ends the game with career_ending_scandal reason', () => {
    state.pendingScandal = { id: 'big_one', severity_tier: 'career_ending', suppress_cost: 150 };
    const result = tm.respondToScandal('resign_now');
    expect(result.gameOver).toBe(true);
    expect(state.endReason).toBe('career_ending_scandal');
    expect(state.pendingScandal).toBe(null);
  });

  it('a non-career response applies base penalty plus response modifiers', () => {
    state.approval = 50;
    state.pendingScandal = { id: 'mid', severity_tier: 'moderate', approval_penalty: -12, suppress_cost: 40 };
    const result = tm.respondToScandal('apologize'); // +5 approval, agendas -10
    expect(result.gameOver).toBe(false);
    expect(state.approval).toBe(50 - 12 + 5);
    expect(state.resolvedScandals).toContain('mid');
  });

  it('ends the game (recalled) when a scandal response zeroes approval', () => {
    state.approval = 5;
    state.pendingScandal = { id: 'mid2', severity_tier: 'moderate', approval_penalty: -12, suppress_cost: 40 };
    const result = tm.respondToScandal('investigate'); // +3 approval, -30M
    expect(result.gameOver).toBe(true);
    expect(state.endReason).toBe('recalled');
  });
});

describe('bribes', () => {
  let tm;
  beforeEach(() => { tm = freshGame(); });

  it('never pays a betrayed advisor (stale offer guard)', () => {
    const adv = state.getAdvisor('finance');
    adv.betrayed = true;
    state.pendingBribes = [{ advisorId: 'finance', advisorName: 'FINANCE', cost: 140, agendaReduction: 30, trustGain: 15, scandalRisk: 0 }];

    const budgetBefore = state.budget;
    tm.acceptBribe('finance');

    expect(state.budget).toBe(budgetBefore);   // no payment
    expect(state.pendingBribes.length).toBe(0); // offer purged
  });

  it('betrayal purges that advisor pending bribe offer', () => {
    const adv = state.getAdvisor('transport');
    state.pendingBribes = [{ advisorId: 'transport', advisorName: 'T', cost: 100, agendaReduction: 30, trustGain: 15, scandalRisk: 0 }];
    tm.advisorSystem.triggerBetrayal(adv);
    expect(state.pendingBribes.length).toBe(0);
  });
});

describe('back channel', () => {
  let tm;
  beforeEach(() => { tm = freshGame(); });

  it('enforces one action per turn', () => {
    const adv = state.getAdvisor('finance');
    adv.trust = 60;
    const first = tm.backChannelAction('finance', 'get_closer');
    expect(first.ok).toBe(true);
    const second = tm.backChannelAction('finance', 'get_closer');
    expect(second.ok).toBe(false);
  });

  it('rejects actions whose trigger conditions are not met', () => {
    const adv = state.getAdvisor('finance');
    adv.trust = 10; // below get_closer threshold (50)
    const result = tm.backChannelAction('finance', 'get_closer');
    expect(result.ok).toBe(false);
  });

  it('corrupt pact needs trust >= 60; wealth no longer blocks it', () => {
    const adv = state.getAdvisor('finance');
    adv.trust = 50; // too cold
    expect(tm.backChannelAction('finance', 'corrupt_pact').ok).toBe(false);
    adv.trust = 80;
    state.budget = 500; // being rich does NOT block a pact anymore
    expect(tm.backChannelAction('finance', 'corrupt_pact').ok).toBe(true);
    expect(adv.corruptPact).toBe(true);
  });

  it('skim flows into personal funds, not the city budget', () => {
    const adv = state.getAdvisor('finance');
    adv.trust = 80;
    tm.backChannelAction('finance', 'corrupt_pact');
    const budgetBefore = state.budget;
    const personalBefore = state.personalFunds;
    tm.advisorSystem.processCorruptPacts(tm.scandalSystem);
    expect(state.budget).toBe(budgetBefore);            // public budget untouched
    expect(state.personalFunds).toBeGreaterThan(personalBefore); // wallet grew
  });
});
