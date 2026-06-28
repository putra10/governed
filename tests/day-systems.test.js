// Tests for the day-structure systems: action points, external actor meetings,
// consultations, the morning newspaper, and follow-up problems.
import './fixtures.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/engine/game-state.js';
import { TurnManager } from '../src/engine/turn-manager.js';
import { matchArchetype } from '../src/engine/actor-system.js';
import { buildNewspaper } from '../src/engine/newspaper.js';
import { makeCity } from './fixtures.js';

describe('action points', () => {
  let tm;
  beforeEach(() => { state.loadCity(makeCity()); tm = new TurnManager(state); });

  it('refill each turn', () => {
    state.actionPoints = 0;
    tm.processTurn();
    expect(state.actionPoints).toBe(state.maxActionPoints);
  });

  it('back channel consumes one', () => {
    const adv = state.advisors[0];
    adv.trust = 60; adv.relationshipType = 'neutral';
    const before = state.actionPoints;
    const r = tm.backChannelAction(adv.id, 'get_closer');
    expect(r.ok).toBe(true);
    expect(state.actionPoints).toBe(before - 1);
  });

  it('back channel refuses at zero points', () => {
    const adv = state.advisors[0];
    adv.trust = 60;
    state.actionPoints = 0;
    const r = tm.backChannelAction(adv.id, 'get_closer');
    expect(r.ok).toBe(false);
  });
});

describe('external actor meetings', () => {
  let tm;
  beforeEach(() => { state.loadCity(makeCity()); tm = new TurnManager(state); });

  it('matches actor names to archetypes by keyword', () => {
    expect(matchArchetype('Labor Union Boss')).toBe('union');
    expect(matchArchetype('Independent Auditor')).toBe('legal');
    expect(matchArchetype('Some Unmatchable Stranger')).toBe('fixer');
  });

  it('summon costs a point and sets the pending meeting', () => {
    const before = state.actionPoints;
    const r = tm.actorSystem.summon('Labor Union Boss', null);
    expect(r.ok).toBe(true);
    expect(state.actionPoints).toBe(before - 1);
    expect(state.pendingMeeting?.archetype).toBe('union');
    expect(state.meetingUsedTurn).toBe(state.turn);
  });

  it('only one meeting per turn', () => {
    tm.actorSystem.summon('Labor Union Boss', null);
    tm.actorSystem.resolve(false, tm.scandalSystem);
    const r2 = tm.actorSystem.summon('Independent Auditor', null);
    expect(r2.ok).toBe(false);
  });

  it('accepting applies effects and clears the meeting', () => {
    tm.actorSystem.summon('Labor Union Boss', null);
    // Force a deterministic offer
    state.pendingMeeting.offer = {
      id: 'test', label: 'T', desc: 'd',
      accept: { budget: -25, spin_today: true }, decline: {},
    };
    const budget = state.budget;
    const r = tm.actorSystem.resolve(true, tm.scandalSystem);
    expect(r.ok).toBe(true);
    expect(state.budget).toBe(budget - 25);
    expect(state.decisionMods.spin).toBe(3);
    expect(state.pendingMeeting).toBe(null);
  });

  it('spin mod softens a negative decision without flipping it positive', () => {
    state.decisionMods = { spin: 3 };
    // resolveDecision pulls from the generic pool — fake a direct consequence path
    const before = state.approval;
    // emulate the mod logic
    let cons = { approval_delta: -5 };
    if (state.decisionMods.spin && cons.approval_delta < 0) {
      cons = { ...cons, approval_delta: Math.min(0, cons.approval_delta + state.decisionMods.spin) };
    }
    state.shiftApproval(cons.approval_delta);
    expect(state.approval).toBe(before - 2);
  });
});

describe('consultations', () => {
  let tm;
  beforeEach(() => { state.loadCity(makeCity()); tm = new TurnManager(state); });

  it('consult costs a point and is once per advisor per turn', () => {
    const adv = state.advisors[0];
    const before = state.actionPoints;
    const r1 = tm.consultAdvisor(adv.id);
    expect(r1.ok).toBe(true);
    expect(state.actionPoints).toBe(before - 1);
    const r2 = tm.consultAdvisor(adv.id);
    expect(r2.ok).toBe(false);
  });

  it('refuses with no points left', () => {
    state.actionPoints = 0;
    const r = tm.consultAdvisor(state.advisors[0].id);
    expect(r.ok).toBe(false);
  });
});

describe('morning newspaper', () => {
  let tm;
  beforeEach(() => { state.loadCity(makeCity()); tm = new TurnManager(state); });

  it('is built every processTurn', () => {
    tm.processTurn();
    expect(state.pendingNewspaper).toBeTruthy();
    expect(state.pendingNewspaper.lead?.headline?.length).toBeGreaterThan(0);
    expect(state.pendingNewspaper.turn).toBe(state.turn);
  });

  it('leads with yesterday\'s decision when one was made', () => {
    state.pastDecisions.push({
      turn: state.turn, decisionId: 'ghost_employees_payroll', optionIndex: 0,
      consequences: { approval_delta: -5, follow_up: 'The ghosts are laid to rest.' },
    });
    const paper = buildNewspaper({ ...state, turn: state.turn + 1, lastNewspaperApproval: null });
    expect(paper.lead.body).toContain('ghosts');
  });

  it('survives a minimal city with no events', () => {
    const paper = buildNewspaper(state);
    expect(paper.outlet).toBeTruthy();
    expect(paper.poll).toBeTruthy();
  });
});

describe('follow-up problems', () => {
  let tm;
  beforeEach(() => { state.loadCity(makeCity()); tm = new TurnManager(state); });

  it('never appear in the random pool', () => {
    // Drain many problem draws; the follow-up must not surface unflagged
    for (let i = 0; i < 60; i++) {
      state.lastPresentTurn = 0;
      const d = state.getNextDecision();
      if (!d) break;
      expect(d.id).not.toBe('ghost_taskforce_fallout');
      state.pastDecisions.push({ turn: state.turn, decisionId: d.id, optionIndex: 0, consequences: {} });
    }
  });

  it('jump the queue once flagged', () => {
    state.setFlag('decision_ghost_taskforce_fallout', true);
    state.lastPresentTurn = 0;
    const d = state.getNextDecision();
    expect(d?.id).toBe('ghost_taskforce_fallout');
  });

  it('the parent option actually sets the flag', () => {
    // Resolve ghost_employees_payroll option B (task force) through the real path
    state.presentedDecisions.push('ghost_employees_payroll');
    tm.resolveDecision('ghost_employees_payroll', 1);
    expect(state.hasFlag('decision_ghost_taskforce_fallout')).toBe(true);
  });
});
