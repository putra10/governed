// Full-game simulation: every turn, mimic the dispatch UI's render conditions
// for the REQUEST A MEETING row and click it. Any case where the UI would show
// an enabled button but the engine refuses is a dead click — the bug class
// this guards against.
import './fixtures.js';
import { describe, it, expect } from 'vitest';
import { state } from '../src/engine/game-state.js';
import { TurnManager } from '../src/engine/turn-manager.js';
import { seed } from '../src/utils/random.js';
import { makeCity, makeAdvisor, ADVISOR_IDS } from './fixtures.js';

function simCity() {
  return makeCity({
    crises: [{ id: 'c1', name: 'Sim Crisis', options: [{ label: 'x', consequences: { approval_delta: -2 } }], turn_min: 1, turn_max: 12 }],
    scandals: [{ id: 's1', title: 'Sim Scandal', description: 'd', approval_penalty: -6, severity_tier: 'minor' }],
  });
}

describe('meeting wire — full term simulation', () => {
  it('never produces a dead click across a 12-turn game', () => {
    state.loadCity(simCity());
    seed(20240617); // deterministic run: the dead-click guard must hold regardless,
                    // and a fixed seed keeps the meeting-count assertion stable.
    const tm = new TurnManager(state);
    const deadClicks = [];
    const summons = [];

    for (let safety = 0; safety < 20; safety++) {
      while (state.activeCrises.length) tm.resolveCrisis(state.activeCrises[0], 0);
      if (state.pendingScandal) tm.acceptScandal();

      const decision = state.getNextDecision();

      // Exactly the dispatch render conditions
      const rowVisible = !!(decision?.external_actors?.length) &&
        !state.pendingMeeting && state.meetingUsedTurn !== state.turn;
      const enabled = rowVisible && (state.actionPoints ?? 0) > 0;

      if (enabled) {
        const r = tm.summonActor(decision.external_actors[0]);
        if (!r.ok) deadClicks.push(`turn ${state.turn}: ${r.msg}`);
        else {
          summons.push(state.turn);
          expect(state.pendingMeeting).toBeTruthy();
          const rr = tm.resolveMeeting(state.turn % 2 === 0);
          expect(rr.ok).toBe(true);
        }
      }

      if (decision) tm.resolveDecision(decision.id, state.turn % 3);
      const end = tm.processTurn();
      if (end && end !== 'crisis_triggered') break;
    }

    expect(deadClicks).toEqual([]);
    expect(summons.length).toBeGreaterThan(0); // the meeting wire actually fires
  });

  it('summon works on a problem that carried over from a previous turn', () => {
    state.loadCity(simCity());
    const tm = new TurnManager(state);
    const d1 = state.getNextDecision();
    expect(d1).toBeTruthy();
    tm.processTurn(); // don't resolve — carry it over
    const d2 = state.getNextDecision();
    expect(d2.id).toBe(d1.id); // same problem, still on the desk
    const r = tm.summonActor(d2.external_actors?.[0] ?? 'Independent Auditor');
    expect(r.ok).toBe(true);
  });

  it('summon survives a save/load round-trip mid-turn', () => {
    state.loadCity(simCity());
    const tm = new TurnManager(state);
    state.getNextDecision();
    const saved = state.serialize();
    state.deserialize(saved, simCity());
    const tm2 = new TurnManager(state);
    const d = state.getNextDecision();
    const r = tm2.summonActor(d?.external_actors?.[0] ?? 'Independent Auditor');
    expect(r.ok).toBe(true);
  });
});
