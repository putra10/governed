// Content-validation suite: guards generated/edited JSON in "Hardcoded things"
// against the failure modes that silently break the UI (trailing spaces in
// keywords, missing archetypes, unwired follow-ups, renamed template keys).
import './fixtures.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/engine/game-state.js';
import { TurnManager } from '../src/engine/turn-manager.js';
import { matchArchetype } from '../src/engine/actor-system.js';
import { makeCity } from './fixtures.js';

import actorData from '../Hardcoded things/external_actors.json';
import templates from '../Hardcoded things/newspaper_templates.json';
import followups from '../Hardcoded things/followup_problems.json';
import budgetCorruption from '../Hardcoded things/budget_corruption.json';
import environmentalClimate from '../Hardcoded things/environmental_climate.json';
import infrastructureFailure from '../Hardcoded things/infrastructure_failure.json';
import mediaScandal from '../Hardcoded things/media_scandal.json';
import politicalPressure from '../Hardcoded things/political_pressure.json';
import publicProtest from '../Hardcoded things/public_protest.json';

const ALL_PROBLEM_FILES = [
  budgetCorruption, environmentalClimate, infrastructureFailure,
  mediaScandal, politicalPressure, publicProtest,
];

const ALL_ACTOR_NAMES = [...new Set(
  ALL_PROBLEM_FILES.flat().concat(followups)
    .flatMap(p => p.external_actors ?? [])
)];

describe('external_actors.json content', () => {
  it('every actor name in every problem resolves to a real archetype', () => {
    const archKeys = Object.keys(actorData.archetypes).map(k => k.trim());
    for (const name of ALL_ACTOR_NAMES) {
      const key = matchArchetype(name);
      expect(archKeys, `actor "${name}" matched "${key}" which doesn't exist`).toContain(key);
    }
  });

  it('every actor name can actually be summoned (no dead clicks)', () => {
    for (const name of ALL_ACTOR_NAMES) {
      state.loadCity(makeCity());
      const tm = new TurnManager(state);
      const r = tm.summonActor(name);
      expect(r.ok, `summoning "${name}" failed: ${r.msg}`).toBe(true);
    }
  });

  it('every offer of every archetype resolves on accept AND decline without throwing', () => {
    for (const [archKey, arch] of Object.entries(actorData.archetypes)) {
      for (const offer of arch.offers ?? []) {
        for (const accept of [true, false]) {
          state.loadCity(makeCity());
          const tm = new TurnManager(state);
          state.pendingMeeting = {
            actorName: 'Validator', archetype: archKey.trim(),
            label: 'TEST', greeting: '', offer, decisionId: null,
          };
          const r = tm.resolveMeeting(accept);
          expect(r.ok, `${archKey}/${String(offer.id).trim()} ${accept ? 'accept' : 'decline'} failed`).toBe(true);
        }
      }
    }
  });
});

describe('newspaper_templates.json content', () => {
  it('has every bucket the builder reads, non-empty', () => {
    for (const k of ['decision_good', 'decision_bad', 'decision_neutral', 'ignored', 'crisis', 'scandal', 'quiet']) {
      expect(templates.headlines?.[k]?.length, `headlines.${k}`).toBeGreaterThan(0);
    }
    for (const k of ['agenda_high', 'romance', 'pact', 'low_trust', 'quiet']) {
      expect(templates.gossip?.[k]?.length, `gossip.${k}`).toBeGreaterThan(0);
    }
    for (const k of ['murmurs', 'watched', 'investigated', 'siege', 'crisis_window', 'deficit']) {
      expect(templates.teasers?.[k]?.length, `teasers.${k}`).toBeGreaterThan(0);
    }
    for (const k of ['rising', 'falling', 'flat']) {
      expect(templates.polls?.[k]?.length, `polls.${k}`).toBeGreaterThan(0);
    }
    expect(templates.mastheads?.length).toBeGreaterThan(0);
    expect(templates.ads?.length).toBeGreaterThan(0);
  });

  it('newspapers never leak unreplaced placeholders', () => {
    state.loadCity(makeCity());
    const tm = new TurnManager(state);
    for (let i = 0; i < 8; i++) {
      while (state.activeCrises.length) tm.resolveCrisis(state.activeCrises[0], 0);
      if (state.pendingScandal) tm.acceptScandal();
      const d = state.getNextDecision();
      if (d) tm.resolveDecision(d.id, i % 3);
      const end = tm.processTurn();
      const paper = state.pendingNewspaper;
      const text = JSON.stringify(paper ?? {});
      const leaks = text.match(/\{[a-z_.]+\}/g) ?? [];
      expect(leaks, `unreplaced placeholders in turn ${state.turn} paper`).toEqual([]);
      if (end && end !== 'crisis_triggered') break;
    }
  });
});

describe('followup_problems.json content', () => {
  it('every follow-up has the required shape', () => {
    for (const f of followups) {
      expect(f.id, 'followup missing id').toBeTruthy();
      expect(f.followup, `${f.id}: followup flag`).toBe(true);
      expect(f.options?.length, `${f.id}: options`).toBe(3);
      expect(f.turn_min, `${f.id}: follow-ups must not have turn windows`).toBeUndefined();
    }
  });

  it('every follow-up is reachable from some parent option (wired)', () => {
    const wired = new Set(
      ALL_PROBLEM_FILES.flat()
        .flatMap(p => p.options ?? [])
        .map(o => o.consequences?.unlocks_decision_id)
        .filter(Boolean)
    );
    for (const f of followups) {
      expect(wired.has(f.id), `follow-up "${f.id}" is never unlocked by any parent option`).toBe(true);
    }
  });

  it('every wired unlocks_decision_id points at a real follow-up', () => {
    const ids = new Set(followups.map(f => f.id));
    for (const file of ALL_PROBLEM_FILES) {
      for (const p of file) {
        for (const o of p.options ?? []) {
          const u = o.consequences?.unlocks_decision_id;
          if (u) expect(ids.has(u), `${p.id}/${o.id} unlocks unknown "${u}"`).toBe(true);
        }
      }
    }
  });
});
