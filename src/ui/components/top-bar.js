import { approvalSvClass, budgetSvClass } from '../ui-helpers.js';
import { heatLevel, HEAT_LEVELS } from '../../engine/heat-system.js';

function scrutinyHtml(state) {
  const lvl = heatLevel(state.heat ?? 0);
  if (lvl.index === 0) return ''; // QUIET: nobody's looking, show nothing
  const pips = HEAT_LEVELS.map((_, i) =>
    `<span class="scr-pip ${i <= lvl.index ? 'on' : ''}"></span>`).join('');
  const cls = lvl.index >= 4 ? 'r' : lvl.index >= 3 ? 'r' : 'a';
  return `
    <div class="stat">
      <span class="sl">SCRUTINY</span>
      <span class="sv ${cls} scr-level">${lvl.label} <span class="scr-pips">${pips}</span></span>
    </div>`;
}

export function renderTopBar(state) {
  const ac = approvalSvClass(state.approval);
  const bc = budgetSvClass(state.budget);
  const crises = state.activeCrises.length;
  return `
    <div class="tb">
      <div class="masthead">GOVERNED DISPATCH</div>
      <div class="stats">
        <div class="stat"><span class="sl">CITY</span><span class="sv w">${(state.city?.city_name ?? '—').toUpperCase()}</span></div>
        <div class="stat"><span class="sl">TURN</span><span class="sv a">${state.turn} / 12</span></div>
        <div class="stat"><span class="sl">APPROVAL</span><span class="sv ${ac}">${state.approval}%</span></div>
        <div class="stat"><span class="sl">BUDGET</span><span class="sv ${bc}">${state.budget}M</span></div>
        ${scrutinyHtml(state)}
        ${crises > 0 ? `<div class="stat"><span class="sl">ACTIVE</span><span class="sv r">${crises} CRISIS</span></div>` : ''}
      </div>
    </div>`;
}
