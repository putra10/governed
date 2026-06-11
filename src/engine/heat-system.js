// src/engine/heat-system.js — SCRUTINY: the city's memory of your sins.
// Internal points, player-facing discrete levels (DEFCON-style).
// Sources: scandals fired, black market purchases, dirty actions.
// Decay: -1 per clean turn (no heat gained that turn).

export const HEAT_LEVELS = [
  { id: 'quiet',        label: 'QUIET',        min: 0  },
  { id: 'murmurs',      label: 'MURMURS',      min: 5  },
  { id: 'watched',      label: 'WATCHED',      min: 19 },
  { id: 'investigated', label: 'INVESTIGATED', min: 36 },
  { id: 'siege',        label: 'UNDER SIEGE',  min: 70 },
];

export const SCANDAL_HEAT = { minor: 1, moderate: 2, major: 3, career_ending: 5 };

export function heatLevel(points) {
  let lvl = HEAT_LEVELS[0], index = 0;
  HEAT_LEVELS.forEach((l, i) => { if ((points ?? 0) >= l.min) { lvl = l; index = i; } });
  return { ...lvl, index };
}

// Scandal-chance multiplier by level: quiet/murmurs ×1, watched ×1.25,
// investigated ×1.5, siege ×2
export function scandalChanceMult(points) {
  return [1, 1, 1.25, 1.5, 2][heatLevel(points).index];
}

const TRANSITION_NOTES = {
  murmurs:      'Rumors about your office are circulating. Nothing printable. Yet.',
  watched:      'An investigative team has been assigned to City Hall. Scandals will travel faster now.',
  investigated: 'A formal audit of your administration has been ordered. The street price of silence just went up.',
  siege:        'Impeachment proceedings are being prepared. Everything you touch is evidence.',
};

// Add (or remove) heat. Queues a level-transition notice popup and applies
// one-time entry effects (audit, impeachment).
export function addHeat(state, amount, why = '') {
  const before = heatLevel(state.heat ?? 0).index;
  state.heat = Math.max(0, (state.heat ?? 0) + amount);
  if (amount > 0) state.lastHeatGainTurn = state.turn;

  const lvl = heatLevel(state.heat);
  if (lvl.index > before) {
    if (!state.pendingHeatNotices) state.pendingHeatNotices = [];
    state.pendingHeatNotices.push({
      level: lvl.label,
      note: TRANSITION_NOTES[lvl.id] ?? '',
      why,
    });

    if (lvl.id === 'investigated' && !state.hasFlag('audit_fired')) {
      state.shiftBudget(-20);
      state.setFlag('audit_fired', true);
      state.pendingHeatNotices.push({
        level: 'CITY AUDIT ORDERED',
        note: 'Auditors freeze discretionary accounts while they work. -20M.',
        why: 'audit',
      });
    }

    if (lvl.id === 'siege' && !state.hasFlag('impeachment_opened')) {
      state.setFlag('impeachment_opened', true);
      // turn-manager converts this into a major scandal next chance it gets
      state.setFlag('impeachment_pending', true);
    }
  }
  return state.heat;
}
