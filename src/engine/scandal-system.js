// src/engine/scandal-system.js
// GDD Section 3.5 -- Four severity tiers with city-specific reactions
import { randomPick, random } from '../utils/random.js';

// Validate a severity key from city JSON; fall back safely on typos
function safeTier(key, fallback = 'minor') {
  return SCANDAL_SEVERITY[key] ? key : fallback;
}

export const SCANDAL_SEVERITY = {
  minor: {
    label: 'Minor Scandal',
    approvalPenalty: -5,
    responses: [
      { id: 'deny',        label: 'Deny Everything',       budgetCost: 0,  approvalMod: -2, agendaMod: 0 },
      { id: 'deflect',     label: 'Deflect to Opposition', budgetCost: 0,  approvalMod: 0,  agendaMod: 0 },
      { id: 'blame_staff', label: 'Blame a Staff Member',  budgetCost: 10, approvalMod: 3,  agendaMod: -5 },
    ],
  },
  moderate: {
    label: 'Moderate Scandal',
    approvalPenalty: -12,
    responses: [
      { id: 'apologize',    label: 'Public Apology',       budgetCost: 0,  approvalMod: 5,  agendaMod: -10 },
      { id: 'fire_advisor', label: 'Fire the Advisor',     budgetCost: 20, approvalMod: 8,  agendaMod: -15 },
      { id: 'investigate',  label: 'Launch Investigation', budgetCost: 30, approvalMod: 3,  agendaMod: 0 },
    ],
  },
  major: {
    label: 'Major Scandal',
    approvalPenalty: -22,
    responses: [
      { id: 'resign_offer', label: 'Offer Conditional Resignation', budgetCost: 0,  approvalMod: 10, agendaMod: -30 },
      { id: 'fight_legal',  label: 'Fight the Legal Threat',        budgetCost: 80, approvalMod: -5, agendaMod: 5 },
      { id: 'coalition',    label: 'Shore Up Coalition Support',    budgetCost: 60, approvalMod: 6,  agendaMod: -20 },
    ],
  },
  career_ending: {
    label: 'Career-Ending Scandal',
    approvalPenalty: -40,
    responses: [
      { id: 'miracle',    label: 'Desperate Last Stand', budgetCost: 150, approvalMod: 15, agendaMod: -50, miracleRoll: true },
      { id: 'resign_now', label: 'Resign Immediately',   budgetCost: 0,   approvalMod: 0,  agendaMod: 0,   gameOver: true },
    ],
  }
};

// Generic fallback reactions used when city JSON has no scandal_reactions field
const FALLBACK_REACTIONS = {
  minor:        'An incident has been reported. The situation is being reviewed.',
  moderate:     'Growing public pressure on the governor to address the allegations.',
  major:        'Widespread calls for accountability. Approval dropping fast.',
  career_ending:'This cannot be walked back. The public is demanding resignation.',
};

export class ScandalSystem {
  constructor(state) {
    this.state = state;
  }

  // Legacy trigger (called by bribe acceptance and crisis consequences)
  trigger(sourceId) {
    const s = this.state;
    if (!s.city?.scandals?.length) {
      this._synthesizeScandal('minor', sourceId);
      return;
    }

    const available = s.city.scandals.filter(sc =>
      !s.activeScandals?.find(a => a.id === sc.id) &&
      !s.resolvedScandals?.includes(sc.id)
    );

    if (!available.length) {
      this._synthesizeScandal('minor', sourceId);
      return;
    }

    this._applyScandal(randomPick(available), sourceId);
  }

  // Apply a scandal object to game state
  _applyScandal(scandal, sourceId = 'unknown') {
    const s = this.state;
    const tierKey = safeTier(scandal.severity_tier ?? 'minor');
    const tier = SCANDAL_SEVERITY[tierKey];

    // Respect the city-authored approval_penalty when present; only fall
    // back to the generic tier penalty. (Previously the authored value was
    // ignored entirely, so most scandals hit a flat -5 'minor' penalty.)
    const penalty = scandal.approval_penalty ?? tier.approvalPenalty;
    s.shiftApproval(penalty);

    // Surprise scandals (decision fallout, bribes, leaks, exposures...) get a
    // reveal popup so the player knows WHY approval just moved. Scandals the
    // player explicitly accepted (sourceId 'accepted') skip it — they chose.
    if (sourceId !== 'accepted') {
      if (!s.pendingScandalReveals) s.pendingScandalReveals = [];
      s.pendingScandalReveals.push({
        title: scandal.title ?? 'Political Scandal',
        severity_tier: tierKey,
        penalty,
        source: sourceId,
        turn: s.turn,
      });
    }

    if (!s.activeScandals) s.activeScandals = [];
    s.activeScandals.push({
      ...scandal,
      sourceTurn: s.turn,
      sourceId,
      severity_tier: tierKey
    });

    // Read reaction from city JSON; fall back to generic pool
    const cityReaction = s.city?.scandal_reactions?.[tierKey] ?? FALLBACK_REACTIONS[tierKey];
    if (cityReaction) {
      s.recentComments = [cityReaction, ...(s.recentComments ?? [])].slice(0, 5);
    }

    console.log('[Scandal]', scandal.title ?? scandal.id, '-- tier:', tierKey, '(' + penalty + ' approval)');
  }

  _synthesizeScandal(tierKey, sourceId) {
    const synth = {
      id: `synth_${sourceId}_${Date.now()}`,
      title: 'Alleged Misconduct',
      severity_tier: tierKey,
      approval_penalty: SCANDAL_SEVERITY[tierKey].approvalPenalty,
    };
    this._applyScandal(synth, sourceId);
  }

  // Romance-exposure scandal -- triggered by advisor system
  triggerRomanceExposure(advisorName) {
    const s = this.state;
    const culture  = s.city?.romance_exposure ?? { severity: 'moderate', flavour: null };
    const severity = safeTier(culture.severity, 'moderate');

    const scandal = {
      id: `romance_exposure_${advisorName.toLowerCase().replace(/\s+/g, '_')}`,
      title: `Governor's Relationship with ${advisorName} Exposed`,
      severity_tier: severity,
      approval_penalty: SCANDAL_SEVERITY[severity].approvalPenalty,
    };

    this._applyScandal(scandal, 'romance');

    if (culture.flavour) {
      s.recentComments = [culture.flavour, ...(s.recentComments ?? [])].slice(0, 5);
    }

    const advisor = s.advisors.find(a => a.name === advisorName);
    if (advisor) advisor.romanceExposed = true;

    console.log('[Romance Exposed]', advisorName, '-- severity:', severity);
    return severity;
  }

  getCityReaction(tierKey) {
    if (!SCANDAL_SEVERITY[tierKey]) return '';
    return this.state.city?.scandal_reactions?.[tierKey] ?? FALLBACK_REACTIONS[tierKey] ?? '';
  }

  getResponseOptions(scandalObj) {
    const tier = SCANDAL_SEVERITY[safeTier(scandalObj?.severity_tier ?? 'minor')];
    return tier.responses;
  }

  // Apply player response to a scandal
  // Returns: { gameOver: bool, miracleSaved: bool }
  applyResponse(scandalObj, responseId) {
    const s = this.state;
    const tier = SCANDAL_SEVERITY[safeTier(scandalObj?.severity_tier ?? 'minor')];
    const response = tier.responses.find(r => r.id === responseId);
    if (!response) return { gameOver: false, miracleSaved: false };

    if (response.gameOver) {
      return { gameOver: true, miracleSaved: false };
    }

    if (response.miracleRoll) {
      const saved = random() < 0.25;
      if (!saved) {
        return { gameOver: true, miracleSaved: false };
      }
      // BUGFIX: surviving the miracle previously applied NO scandal penalty —
      // a career-ending scandal netted +15 approval. The scandal still
      // happened: apply its penalty first, then the response modifiers.
      s.shiftApproval(scandalObj?.approval_penalty ?? tier.approvalPenalty);
      console.log('[Miracle] The governor survived a career-ending scandal!');
    }

    // Non-career responses (deny / apologize / investigate...): the scandal
    // still lands — the response only shapes the damage. Without this, a
    // "Public Apology" would be a free +5 and strictly dominate accepting.
    if (!response.miracleRoll) {
      s.shiftApproval(scandalObj?.approval_penalty ?? tier.approvalPenalty);
    }

    if (response.budgetCost) s.shiftBudget(-response.budgetCost);
    if (response.approvalMod) s.shiftApproval(response.approvalMod);

    if (response.agendaMod) {
      for (const adv of s.advisors) {
        if (!adv.betrayed) {
          adv.agendaProgress = Math.max(0, Math.min(100, (adv.agendaProgress ?? 0) + response.agendaMod));
        }
      }
    }

    return { gameOver: false, miracleSaved: !!response.miracleRoll };
  }
}
