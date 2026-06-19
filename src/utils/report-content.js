// src/utils/report-content.js — Picks the legacy paragraph and the public-record
// newspaper clipping for the report, from extendable JSON pools. Entries may
// carry an optional `when.outcome`; tokens are filled from state.

import legacies from '../../Hardcoded things/legacy_paragraphs.json';
import clippings from '../../Hardcoded things/record_clippings.json';
import { govRaw, govLast } from './governor.js';
import { randomPick } from './random.js';

// recalled | disgrace | resigned | asset | term
export function outcomeKey(state) {
  if (state.endReason === 'career_ending_scandal') return 'disgrace';
  if (state.endReason === 'resigned') return 'resigned';
  if (state.endReason === 'recalled' || state.approval <= 0) return 'recalled';
  const unresolved = (state.presentedDecisions ?? []).filter(id => !state.pastDecisions.some(p => p.decisionId === id)).length;
  if (state.approval >= 65 && unresolved <= 1) return 'asset';
  return 'term';
}

function tokens(state) {
  const name = govRaw(state) ? govLast(state) : 'the Governor';
  const admin = govRaw(state) ? `The ${govLast(state)} administration` : 'This administration';
  return {
    '{governor}': name,
    '{gov}': name,
    '{GOV}': (govRaw(state) ? govLast(state) : 'THE GOVERNOR').toUpperCase(),
    '{gov_admin}': admin,
    '{city}': state.city?.city_name ?? 'the city',
    '{CITY}': (state.city?.city_name ?? 'THE CITY').toUpperCase(),
    '{approval}': String(state.approval ?? 0),
    '{budget}': String(state.budget ?? 0),
    '{crises}': String(state.pastCrises?.length ?? 0),
    '{weeks}': String((state.turn ?? 0) * 6),
    '{tier}': String(state.city?.tier ?? 'medium'),
  };
}

function fill(text, t) {
  let s = String(text ?? '');
  for (const k in t) s = s.split(k).join(t[k]);
  return s;
}

function choose(pool, key) {
  const arr = Array.isArray(pool) ? pool : [];
  const matches = arr.filter(x => !x.when || !x.when.outcome || x.when.outcome === key);
  return (matches.length ? randomPick(matches) : arr[0]) || null;
}

export function pickLegacy(state) {
  const t = tokens(state);
  const c = choose(legacies, outcomeKey(state)) || { text: '{gov_admin} governed {city}; the file is brief.' };
  return fill(c.text, t);
}

export function pickClipping(state) {
  const t = tokens(state);
  const c = choose(clippings, outcomeKey(state)) || { headline: '{GOV} TERM ENDS', deck: '', pull: '' };
  return { headline: fill(c.headline, t), deck: fill(c.deck, t), pull: fill(c.pull, t) };
}
