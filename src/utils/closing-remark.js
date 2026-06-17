// src/utils/closing-remark.js — Picks the system's closing assessment of the
// player's term from a JSON pool. Comments can carry optional `when` match
// conditions (outcome / approval range / dirty hands); extend the JSON freely.

import remarks from '../../Hardcoded things/closing_remarks.json';
import { govName } from './governor.js';
import { randomPick } from './random.js';

function outcomeOf(state) {
  switch (state.endReason) {
    case 'term_complete': return 'term_complete';
    case 'career_ending_scandal': return 'disgrace';
    case 'resigned': return 'resigned';
    default: return 'recalled';
  }
}

export function pickClosingRemark(state) {
  const outcome = outcomeOf(state);
  const approval = state.approval ?? 0;
  const dd = state.dirtyDeeds ?? {};
  const dirty = ((dd.skimmed ?? 0) + (dd.threats ?? 0) + (dd.leaks ?? 0) + (dd.exposed ?? 0) + (dd.marketBuys ?? 0)) > 0;

  const pool = Array.isArray(remarks) ? remarks : [];
  const matches = pool.filter(r => {
    const w = r.when || {};
    if (w.outcome && w.outcome !== outcome) return false;
    if (w.minApproval != null && approval < w.minApproval) return false;
    if (w.maxApproval != null && approval > w.maxApproval) return false;
    if (w.dirty != null && w.dirty !== dirty) return false;
    return true;
  });

  const chosen = (matches.length ? randomPick(matches) : pool[0]) || { text: 'The assessment is complete, {governor}.' };
  return String(chosen.text || '')
    .replace(/\{governor\}/g, govName(state))
    .replace(/\{approval\}/g, String(approval))
    .replace(/\{budget\}/g, String(state.budget ?? 0))
    .replace(/\{city\}/g, state.city?.city_name ?? 'the city');
}
