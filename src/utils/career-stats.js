// src/utils/career-stats.js — Lifetime player statistics, persisted across
// games and sessions. Recorded once per game via the 'career_recorded' flag.

const KEY = 'governed_career_stats';

const DEFAULTS = {
  gamesStarted: 0,
  termsCompleted: 0,
  recalled: 0,
  resigned: 0,
  bestApproval: 0,
  turnsGoverned: 0,
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
  if (state.endReason === 'term_complete') {
    s.termsCompleted++;
    s.bestApproval = Math.max(s.bestApproval, state.approval);
  } else if (state.endReason === 'career_ending_scandal' || state.endReason === 'resigned') {
    s.resigned++;
  } else {
    s.recalled++;
  }
  s.turnsGoverned += state.turn;
  save(s);
}
