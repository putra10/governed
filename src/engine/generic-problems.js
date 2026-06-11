import budgetCorruption from '../../Hardcoded things/budget_corruption.json';
import environmentalClimate from '../../Hardcoded things/environmental_climate.json';
import infrastructureFailure from '../../Hardcoded things/infrastructure_failure.json';
import mediaScandal from '../../Hardcoded things/media_scandal.json';
import politicalPressure from '../../Hardcoded things/political_pressure.json';
import publicProtest from '../../Hardcoded things/public_protest.json';
import { randomPick } from '../utils/random.js';

// _domain maps a problem to the advisor whose trust gates it (null = always visible)
const ALL_GENERIC_PROBLEMS = [
  ...budgetCorruption.map(p    => ({ ...p, _domain: 'finance' })),
  ...environmentalClimate.map(p=> ({ ...p, _domain: 'urban_planning' })),
  ...infrastructureFailure.map(p=>({ ...p, _domain: 'transport' })),
  ...mediaScandal.map(p        => ({ ...p, _domain: null })),
  ...politicalPressure.map(p   => ({ ...p, _domain: 'religious_affairs' })),
  ...publicProtest.map(p       => ({ ...p, _domain: 'military_liaison' })),
];

export function interpolateText(text, city) {
  if (!text) return '';
  return text
    .replace(/{city\.name}/g, city?.city_name || '')
    .replace(/{city\.media_outlet}/g, city?.city_personality?.media_outlet || '')
    .replace(/{city\.government_body}/g, city?.city_personality?.government_body || '')
    .replace(/{city\.landmark}/g, city?.city_personality?.landmark || '')
    .replace(/{city\.primary_industry_workers}/g, city?.city_personality?.primary_industry_workers || '')
    .replace(/{city\.slang_reaction}/g, city?.city_personality?.slang_reaction || '');
}

export function normalizeProblem(prob, city) {
  if (!prob) return null;
  const bodyText = prob.body ?? prob.description ?? '';

  const normalized = {
    ...prob,
    body: interpolateText(bodyText, city),
    title: interpolateText(prob.title, city),
    trigger: interpolateText(prob.trigger, city),
    description: interpolateText(prob.description, city),
    options: (prob.options ?? []).map((opt, i) => {
      const tagDefaults = ['SAFE', 'BOLD', 'CHAOS'];
      const cons = opt.consequences ?? {};
      const followUp = interpolateText(cons.follow_up, city);
      const reactionText = interpolateText(cons.city_reaction ?? cons.public_reaction, city);

      return {
        ...opt,
        label: interpolateText(opt.label, city),
        tag: opt.tag ?? tagDefaults[i] ?? 'OPTION',
        consequences: {
          ...cons,
          approval_delta: cons.approval_delta ?? 0,
          budget_delta: cons.budget_delta ?? 0,
          scandal_risk: cons.scandal_risk ?? 0,
          follow_up: followUp,
          city_reaction: reactionText,
          public_reaction: reactionText,
          advisor_effects: (cons.advisor_effects ?? []).map(eff => ({
            advisor_id: eff.advisor_id,
            trust_delta: eff.trust_delta ?? 0,
            betrayal_risk_delta: eff.betrayal_risk_delta ?? 0
          }))
        }
      };
    })
  };

  return normalized;
}

export function getGenericProblemById(id, city) {
  const prob = ALL_GENERIC_PROBLEMS.find(p => p.id === id);
  if (!prob) return null;
  return normalizeProblem(prob, city);
}

export function getNextGenericProblem(state) {
  if (!state.city) return null;

  // Keep showing any unresolved presented decision until player resolves it.
  // Unresolved problems CARRY OVER between turns (oldest first) — and after
  // 3 turns the turn-manager discloses them with consequences.
  const unresolvedId = state.presentedDecisions.find(id =>
    !state.pastDecisions.some(p => p.decisionId === id)
  );
  if (unresolvedId) {
    const unresolvedProb = getGenericProblemById(unresolvedId, state.city);
    if (unresolvedProb) return unresolvedProb;
  }

  // Only ONE NEW problem is presented per turn (carryover resolutions don't
  // consume the day's new problem — that used to eat a content day)
  if (state.lastPresentTurn === state.turn) return null;

  // Surface a new eligible problem
  const eligible = ALL_GENERIC_PROBLEMS.filter(p => {
    if (state.pastDecisions.some(past => past.decisionId === p.id)) return false;
    if (state.presentedDecisions.includes(p.id)) return false;
    // Layer 2: advisor with trust < 30 stops flagging their domain's problems
    if (p._domain && state.advisors?.length) {
      const adv = state.advisors.find(a => (a.domain_id ?? a.id) === p._domain && !a.betrayed);
      if (adv && (adv.trust ?? 50) < 30) return false;
    }
    const turnMin = p.turn_min ?? 1;
    const turnMax = p.turn_max ?? 12;
    return state.turn >= turnMin && state.turn <= turnMax;
  });

  // Fallback: if nothing is eligible within turn window, ignore turn_min/max
  // so the player always has at least one decision on non-crisis turns
  let pool = eligible;
  if (pool.length === 0) {
    pool = ALL_GENERIC_PROBLEMS.filter(p => {
      if (state.pastDecisions.some(past => past.decisionId === p.id)) return false;
      if (state.presentedDecisions.includes(p.id)) return false;
      return true;
    });
  }
  // Last resort: allow replaying already-presented problems (but not resolved ones)
  if (pool.length === 0) {
    pool = ALL_GENERIC_PROBLEMS.filter(p =>
      !state.pastDecisions.some(past => past.decisionId === p.id)
    );
    // Reset presentedDecisions so replayed problems show fresh
    if (pool.length > 0) {
      state.presentedDecisions = [];
      state.problemDeadlines = {};
    }
  }

  if (pool.length === 0) return null;

  const chosen = randomPick(pool);
  if (chosen) {
    state.presentedDecisions.push(chosen.id);
    if (!state.problemDeadlines) state.problemDeadlines = {};
    state.problemDeadlines[chosen.id] = state.turn; // 3-turn clock starts
    state.lastPresentTurn = state.turn;
    return normalizeProblem(chosen, state.city);
  }

  return null;
}
