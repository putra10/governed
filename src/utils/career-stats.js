// src/utils/career-stats.js — Lifetime player statistics, persisted across
// games and sessions. Recorded once per game via the 'career_recorded' flag.

import { govRaw } from './governor.js';

const KEY = 'governed_career_stats';

const DEFAULTS = {
  gamesStarted: 0,
  termsCompleted: 0,
  recalled: 0,
  resigned: 0,
  bestApproval: 0,
  turnsGoverned: 0,
  governors: [], // Hall of administrations: newest first, capped at 12
};

export function loadCareerStats() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(stats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch (e) {
    console.warn('[GOVERNED] Career stats save failed:', e);
  }
}

export function recordGameStart() {
  const s = loadCareerStats();
  s.gamesStarted++;
  save(s);
}

export function recordGameEnd(state) {
  const s = loadCareerStats();
  let outcome;
  if (state.endReason === 'term_complete') {
    s.termsCompleted++;
    s.bestApproval = Math.max(s.bestApproval, state.approval);
    outcome = 'Completed term';
  } else if (state.endReason === 'career_ending_scandal') {
    s.resigned++;
    outcome = 'Disgraced';
  } else if (state.endReason === 'resigned') {
    s.resigned++;
    outcome = 'Resigned';
  } else {
    s.recalled++;
    outcome = 'Recalled';
  }
  s.turnsGoverned += state.turn;

  // Hall of administrations — newest first, capped at 12
  if (!Array.isArray(s.governors)) s.governors = [];
  s.governors.unshift({
    name: govRaw(state) || 'Acting Governor',
    city: state.city?.city_name ?? 'Unknown',
    outcome,
    approval: state.approval,
    turn: state.turn,
  });
  s.governors = s.governors.slice(0, 12);

  save(s);
}
