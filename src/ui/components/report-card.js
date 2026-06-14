import { govRaw, govLast } from '../../utils/governor.js';

export function renderReportCard(state) {
  const legacyBase = state.city?.opening_sequence?.intro_headline
    ?? `Your term in ${state.city?.city_name ?? 'the city'} concluded`;

  const admin = govRaw(state) ? `The ${govLast(state)} administration` : 'This administration';

  return `
    <div class="wiki-box">
      <div class="wiki-l">LEGACY PARAGRAPH</div>
      <div class="wiki-t">${legacyBase}. ${admin} closed the books at <em>${state.approval}%</em> approval, <em>${state.budget}M</em> in the treasury, and <em>${state.pastCrises.length}</em> crises survived. History will round the rest off.</div>
    </div>`;
}
