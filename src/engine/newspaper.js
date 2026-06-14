// src/engine/newspaper.js — The morning paper.
// Built at the top of every processTurn (turn 2+) from what happened the
// previous day. Pure function of state + templates; the UI renders it as a
// front-page overlay the player dismisses to start the day.

import templates from '../../Hardcoded things/newspaper_templates.json';
import { randomPick } from '../utils/random.js';
import { getGenericProblemById } from './generic-problems.js';
import { heatLevel } from './heat-system.js';
import { govName, govTitle } from '../utils/governor.js';

// Safe template pick: a regenerated templates file with a missing or renamed
// key must degrade to empty text, never crash the turn.
function pickT(pool) {
  return Array.isArray(pool) && pool.length ? randomPick(pool) : '';
}

function fill(text, ctx) {
  if (!text) return '';
  const city = ctx.city ?? {};
  return text
    .replace(/{city\.name}/g, city.city_name ?? 'the city')
    .replace(/{city\.media_outlet}/g, city.city_personality?.media_outlet ?? 'The City Dispatch')
    .replace(/{city\.government_body}/g, city.city_personality?.government_body ?? 'city council')
    .replace(/{city\.landmark}/g, city.city_personality?.landmark ?? 'city hall')
    .replace(/{governor_title}/g, ctx.governorTitle ?? 'the Governor')
    .replace(/{governor}/g, ctx.governor ?? 'the Governor')
    .replace(/{title}/g, ctx.title ?? 'the matter')
    .replace(/{advisor}/g, ctx.advisor ?? 'a senior advisor')
    .replace(/{approval}/g, String(ctx.approval ?? ''))
    .replace(/{scandal_title}/g, ctx.scandalTitle ?? 'City Hall Scandal')
    .replace(/{days}/g, String(ctx.days ?? ''))
    .replace(/{turn}/g, String(ctx.turn ?? ''));
}

// prevTurn = the turn that just ended (state.turn has already incremented)
export function buildNewspaper(s) {
  const prevTurn = s.turn - 1;
  const ctx = { city: s.city, governor: govName(s), governorTitle: govTitle(s), approval: s.approval, turn: s.turn };

  // ── Lead story: yesterday's decision / crisis / scandal ───────────────────
  let lead = null;
  const yesterdayScandal = (s.activeScandals ?? []).filter(sc => sc.sourceTurn === prevTurn).pop();
  const yesterdayCrisis = (s.pastCrises ?? []).filter(c => c.turn === prevTurn).pop();
  const yesterdayDecision = (s.pastDecisions ?? []).filter(d => d.turn === prevTurn && !d.ignored).pop();

  if (yesterdayScandal) {
    lead = {
      headline: fill(pickT(templates.headlines?.scandal), { ...ctx, scandalTitle: yesterdayScandal.title ?? 'City Hall Scandal' }),
      body: yesterdayScandal.description ?? 'Details are still emerging. None of them are flattering.',
    };
  } else if (yesterdayCrisis) {
    const crisis = s.city?.crises?.find(c => c.id === yesterdayCrisis.crisisId);
    lead = {
      headline: fill(pickT(templates.headlines?.crisis), ctx),
      body: crisis?.name ? `The ${crisis.name} has been contained — at a cost the ledgers will remember.` : 'The emergency has passed. The questions have not.',
    };
  } else if (yesterdayDecision) {
    const prob = getGenericProblemById(yesterdayDecision.decisionId, s.city);
    const title = prob?.title ?? 'a city matter';
    const delta = yesterdayDecision.consequences?.approval_delta ?? 0;
    const bucket = delta > 3 ? 'decision_good' : delta < -3 ? 'decision_bad' : 'decision_neutral';
    lead = {
      headline: fill(pickT(templates.headlines[bucket]), { ...ctx, title }),
      body: yesterdayDecision.consequences?.follow_up
        || yesterdayDecision.consequences?.city_reaction
        || 'City hall declined to elaborate. Repeatedly.',
    };
  } else {
    lead = {
      headline: fill(pickT(templates.headlines?.quiet), ctx),
      body: 'Sources inside city hall describe the mood as "tense, but in a boring way."',
    };
  }

  // ── Second story: an aging unresolved problem, if any ─────────────────────
  let second = null;
  const unresolvedId = (s.presentedDecisions ?? []).find(id =>
    !s.pastDecisions.some(p => p.decisionId === id));
  if (unresolvedId) {
    const prob = getGenericProblemById(unresolvedId, s.city);
    const days = prevTurn - (s.problemDeadlines?.[unresolvedId] ?? prevTurn) + 1;
    if (prob && days >= 2) {
      second = {
        headline: fill(pickT(templates.headlines?.ignored), { ...ctx, title: prob.title, days }),
        body: prob.trigger ?? '',
      };
    }
  }

  // ── Gossip column ─────────────────────────────────────────────────────────
  let gossip = null;
  const live = (s.advisors ?? []).filter(a => !a.betrayed);
  const plotter = live.filter(a => (a.agendaProgress ?? 0) >= 50)
    .sort((a, b) => (b.agendaProgress ?? 0) - (a.agendaProgress ?? 0))[0];
  const lover = live.find(a => a.relationshipType === 'romantic' && !a.romanceExposed);
  const pactAdv = live.find(a => a.corruptPact);
  const sulker = live.find(a => (a.trust ?? 50) < 35);
  if (lover) {
    // Romance teases are the juiciest — they take priority when one exists
    gossip = fill(pickT(templates.gossip?.romance), ctx);
  } else if (plotter) {
    gossip = fill(pickT(templates.gossip?.agenda_high), { ...ctx, advisor: plotter.name });
  } else if (pactAdv) {
    gossip = fill(pickT(templates.gossip?.pact), ctx);
  } else if (sulker) {
    gossip = fill(pickT(templates.gossip?.low_trust), { ...ctx, advisor: sulker.name });
  } else {
    gossip = fill(pickT(templates.gossip?.quiet), ctx);
  }

  // ── Poll box ──────────────────────────────────────────────────────────────
  const prevApproval = s.lastNewspaperApproval ?? s.approval;
  const trend = s.approval > prevApproval + 1 ? 'rising'
    : s.approval < prevApproval - 1 ? 'falling' : 'flat';
  const poll = fill(pickT(templates.polls?.[trend]), ctx);
  s.lastNewspaperApproval = s.approval;

  // ── Editor's teaser ───────────────────────────────────────────────────────
  const teasers = [];
  const hl = heatLevel(s.heat ?? 0).id;
  if (templates.teasers?.[hl]) teasers.push(fill(pickT(templates.teasers[hl]), ctx));
  if ([4, 8, 12].includes(s.turn)) teasers.push(fill(pickT(templates.teasers?.crisis_window), ctx));
  if (s.budget < 0) teasers.push(fill(pickT(templates.teasers?.deficit), ctx));

  return {
    outlet: s.city?.city_personality?.media_outlet ?? pickT(templates.media_outlet) ?? 'THE CITY DISPATCH',
    masthead: fill(pickT(templates.mastheads), ctx),
    turn: s.turn,
    lead,
    second,
    gossip,
    poll,
    teasers: teasers.slice(0, 2),
    ad: fill(pickT(templates.ads), ctx),
  };
}
