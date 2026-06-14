// src/utils/governor.js — Everything that makes the player's chosen name
// surface across the game: the newspaper, advisors, protests, the final
// report, and the career hall. One source of truth for how the name reads.

// Raw, sanitized name — '' when the player never set one (the placeholder
// "Governor" counts as unset).
export function govRaw(state) {
  const n = (state?.governorName || '').trim();
  return (n && n.toLowerCase() !== 'governor') ? n : '';
}

// "Hunt" → "Hunt"; unset → "the Governor"
export function govName(state) {
  return govRaw(state) || 'the Governor';
}

// "Hunt" → "Governor Hunt"; unset → "the Governor"
export function govTitle(state) {
  const n = govRaw(state);
  return n ? `Governor ${n}` : 'the Governor';
}

// Last token, for chants/headlines: "Maria Hunt" → "Hunt"
export function govLast(state) {
  const n = govRaw(state);
  if (!n) return 'the Governor';
  const parts = n.split(/\s+/);
  return parts[parts.length - 1];
}

// Replace {governor}, {governor_title}, {gov} tokens in any string.
export function personalize(text, state) {
  if (!text) return text;
  return String(text)
    .replace(/\{governor_title\}/g, govTitle(state))
    .replace(/\{governor\}/g, govName(state))
    .replace(/\{gov\}/g, govRaw(state) || 'the Governor');
}

// A salutation an advisor uses to open a message, keyed to how they feel
// about you. Returns '' when no custom name is set (keeps generic dialogue
// clean).
export function advisorAddress(advisor, state) {
  const n = govRaw(state);
  if (!n) return '';
  const t = advisor?.trust ?? 50;
  const rel = advisor?.relationshipType;
  if (advisor?.betrayed) return `${n}. `;
  if (rel === 'romantic' && t >= 50) return `${n} — `;
  if (rel === 'rivalry' || t < 35) return `Listen, ${n}. `;
  if (t >= 70) return `Governor ${n}, `;
  return `Governor ${n} — `;
}

// Protest placards/chants that name the player. Deterministic per turn+type
// so the banner doesn't flicker between re-renders of the same dispatch.
const CHANTS = {
  strike: ["{U}, PAY US WHAT WE'RE OWED", "NO CONTRACT, NO PEACE — {U}", "WHERE'S OUR MONEY, {U}?"],
  demonstration: ["{U} MUST GO", "WHOSE CITY? NOT {U}'S", "SHAME ON {U}", "{U} OUT NOW"],
  riot: ["{U}'S CITY IS BURNING", "{U} LIT THIS FIRE", "NO JUSTICE, NO {U}"],
};

export function protestChant(state, type) {
  const pool = CHANTS[type] || CHANTS.demonstration;
  const idx = ((state?.turn ?? 0) + (type ? type.length : 0)) % pool.length;
  const u = govLast(state).toUpperCase();
  return pool[idx].replace(/\{U\}/g, u);
}
