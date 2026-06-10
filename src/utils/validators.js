// src/utils/validators.js — Validate AI-generated city JSON

const REQUIRED_CITY_FIELDS = [
  'city_id', 'city_name', 'tier', 'problem_clusters',
  'advisors', 'comment_library', 'crises', 'city_personality',
  'decisions', 'scandals', 'opening_sequence'
];

const REQUIRED_ADVISOR_FIELDS = [
  'id', 'name', 'domain', 'archetype', 'hidden_agenda',
  'betrayal_trigger', 'competence_rating', 'dialogue', 'relationship_meter'
];

const REQUIRED_DIALOGUE_KEYS = [
  'briefing', 'agreement', 'disagreement', 'betrayal', 'roast', 'scandal_reaction'
];

const REQUIRED_COMMENT_CATEGORIES = ['positive', 'neutral', 'negative', 'crisis', 'scandal'];

/**
 * Normalize cities that use the alternate schema
 * (id/name/primary_problems/flavor_text/starting/advisor_trust_levels)
 * into the canonical schema the engine expects.
 */
const ADVISOR_DEFAULTS = {
  finance: {
    domain: "Finance & Budget",
    archetype: "Pragmatist",
    betrayal_trigger: "Low budget or contract cuts",
    competence_rating: 7,
    agreement: ["Sensible decision. This keeps our books in order.", "Excellent. We need fiscal discipline."],
    scandal_reaction: ["I have no comment on these transactions. Talk to my lawyer.", "We must audit the trail immediately."]
  },
  military_liaison: {
    domain: "Security & Order",
    archetype: "Hardliner",
    betrayal_trigger: "Unchecked civil unrest",
    competence_rating: 6,
    agreement: ["Order must be maintained. Good choice.", "A firm hand is what this city needs."],
    scandal_reaction: ["My department acts with complete integrity.", "This is a security distraction. We are ignoring the real threat."]
  },
  urban_planning: {
    domain: "Urban Planning & Environment",
    archetype: "Idealist",
    betrayal_trigger: "Environmental deregulation",
    competence_rating: 8,
    agreement: ["For a sustainable future, yes.", "A progressive step forward."],
    scandal_reaction: ["My designs and zoning approvals are fully public.", "We cannot let political noise derail the long-term plan."]
  },
  transport: {
    domain: "Transport & Infrastructure",
    archetype: "Fixer",
    betrayal_trigger: "Transit funding cancellation",
    competence_rating: 6,
    agreement: ["I will mobilize the transit crews.", "Finally, moving the city forward."],
    scandal_reaction: ["Contract procurement was handled externally.", "I'm focusing on the trains, not the rumors."]
  },
  religious_affairs: {
    domain: "Community & Religious Affairs",
    archetype: "Moralist",
    betrayal_trigger: "Zoning issues or community neglect",
    competence_rating: 5,
    agreement: ["The community will appreciate this.", "God favors the just and compassionate."],
    scandal_reaction: ["I am praying for guidance.", "This is a test of our collective faith. We must remain moral."]
  }
};

function normalizeCity(data) {
  const city_id = data.city_id ?? data.id;
  const city_name = data.city_name ?? data.name;
  const problem_clusters = data.problem_clusters ?? data.primary_problems ?? [];
  
  let city_personality = data.city_personality;
  if (!city_personality || typeof city_personality === 'string') {
    const textVal = typeof city_personality === 'string' ? city_personality : (data.flavor_text ?? '');
    city_personality = {
      voice: data.city_personality?.voice ?? "cynical-satirical",
      humor_style: data.city_personality?.humor_style ?? "dry_political",
      media_outlet: data.city_personality?.media_outlet ?? "The Local Chronicle",
      government_body: data.city_personality?.government_body ?? "City Council",
      landmark: data.city_personality?.landmark ?? "City Hall",
      primary_industry_workers: data.city_personality?.primary_industry_workers ?? "civil servants",
      slang_reaction: data.city_personality?.slang_reaction ?? "Typical."
    };
  }

  const trustLevels = data.advisor_trust_levels ?? {};
  const starting    = data.starting ?? {};

  const title = data.opening_sequence?.title ?? data.opening_sequence?.intro_headline ?? `Welcome to ${city_name}`;
  const intro = data.opening_sequence?.intro ?? data.opening_sequence?.intro_body ?? data.flavor_text ?? `Welcome to ${city_name}. Good luck.`;
  const intro_headline = data.opening_sequence?.intro_headline ?? title;
  const intro_body = data.opening_sequence?.intro_body ?? intro;
  const intro_text = data.opening_sequence?.intro_text ?? intro;

  const opening_sequence = {
    title,
    intro,
    intro_headline,
    intro_body,
    intro_text,
    starting_stats: {
      approval_rating: starting.approval ?? data.opening_sequence?.starting_stats?.approval_rating ?? 50,
      budget:          starting.budget   ?? data.opening_sequence?.starting_stats?.budget          ?? 500,
      advisor_trust_levels: {
        finance: 50,
        military_liaison: 50,
        urban_planning: 50,
        transport: 50,
        religious_affairs: 50,
        ...trustLevels,
        ...(data.opening_sequence?.starting_stats?.advisor_trust_levels ?? {})
      }
    }
  };

  const advisors = (data.advisors ?? []).map(adv => {
    const defaults = ADVISOR_DEFAULTS[adv.id] ?? {
      domain: "Municipal Advisory",
      archetype: "Advisor",
      betrayal_trigger: "Low trust",
      competence_rating: 6,
      agreement: ["Understood.", "Sounds reasonable."],
      scandal_reaction: ["No comment."]
    };

    const dialogue = adv.dialogue ?? {};
    return {
      ...adv,
      domain:            adv.domain            ?? adv.role               ?? defaults.domain,
      archetype:         adv.archetype         ?? defaults.archetype,
      hidden_agenda:     adv.hidden_agenda     ?? adv.agenda             ?? "Serve the city.",
      betrayal_trigger:  adv.betrayal_trigger  ?? defaults.betrayal_trigger,
      competence_rating: adv.competence_rating ?? defaults.competence_rating,
      relationship_meter: adv.relationship_meter ?? trustLevels[adv.id]   ?? 50,
      dialogue: {
        briefing:         dialogue.briefing         ?? ["System status normal."],
        agreement:        dialogue.agreement        ?? defaults.agreement,
        disagreement:     dialogue.disagreement     ?? ["I advise against this."],
        betrayal:         dialogue.betrayal         ?? "I can no longer support your administration.",
        roast:            dialogue.roast            ?? ["This is not good."],
        scandal_reaction: dialogue.scandal_reaction ?? defaults.scandal_reaction
      }
    };
  });

  const TAG_DEFAULTS = ['SAFE', 'BOLD', 'CHAOS'];
  const decisions = (data.decisions ?? []).map(dec => {
    return {
      ...dec,
      body: dec.body ?? dec.description ?? '',
      options: (dec.options ?? []).map((opt, i) => {
        const cons = opt.consequences ?? {};
        const advisor_effects = (cons.advisor_effects ?? []).map(eff => ({
          advisor_id: eff.advisor_id,
          trust_delta: eff.trust_delta ?? 0,
          betrayal_risk_delta: eff.betrayal_risk_delta ?? 0
        }));
        return {
          ...opt,
          tag: opt.tag ?? TAG_DEFAULTS[i] ?? 'OPTION',
          consequences: {
            ...cons,
            approval_delta: cons.approval_delta ?? 0,
            budget_delta:   cons.budget_delta   ?? 0,
            scandal_risk:   cons.scandal_risk   ?? 0,
            advisor_effects
          }
        };
      })
    };
  });

  const crises = (data.crises ?? []).map(crisis => {
    const name = crisis.name ?? crisis.title ?? crisis.id;
    const trigger = crisis.trigger ?? crisis.description ?? "An emergency has occurred.";
    const options = (crisis.options ?? []).map((opt, i) => {
      const letter = String.fromCharCode(65 + i);
      const cons = opt.consequences ?? {};
      const advisor_effects = (cons.advisor_effects ?? []).map(eff => ({
        advisor_id: eff.advisor_id,
        trust_delta: eff.trust_delta ?? 0,
        betrayal_risk_delta: eff.betrayal_risk_delta ?? 0
      }));
      return {
        id: opt.id ?? letter,
        label: opt.label ?? opt.description ?? `Option ${letter}`,
        description: opt.description ?? '',
        tag: opt.tag ?? TAG_DEFAULTS[i] ?? 'OPTION',
        consequences: {
          ...cons,
          approval_delta: cons.approval_delta ?? 0,
          budget_delta:   cons.budget_delta   ?? 0,
          scandal_risk:   cons.scandal_risk   ?? 0,
          advisor_effects
        }
      };
    });
    return {
      ...crisis,
      name,
      trigger,
      description: crisis.description ?? trigger,
      turn_min: crisis.turn_min ?? 1,
      turn_max: crisis.turn_max ?? 12,
      war_mode: crisis.war_mode ?? false,
      options
    };
  });

  // Derive severity_tier from the authored penalty when the city JSON
  // doesn't specify one. Previously every untiered scandal defaulted to
  // 'minor' — wrong response options, wrong suppress cost, and (before the
  // engine fix) a flat -5 hit regardless of the authored approval_penalty.
  const tierFromPenalty = (p) =>
    p <= -30 ? 'career_ending' :
    p <= -18 ? 'major'         :
    p <= -8  ? 'moderate'      : 'minor';

  const scandals = (data.scandals ?? []).map(scan => {
    const approval_penalty = scan.approval_penalty ?? -10;
    return {
      ...scan,
      description: scan.description ?? scan.title ?? 'A minor political scandal.',
      severity: scan.severity ?? 2,
      approval_penalty,
      severity_tier: scan.severity_tier ?? tierFromPenalty(approval_penalty),
    };
  });

  // Preserve all comment_library sub-categories (media, politician, activist, street, etc.)
  const comment_library = {
    ...(data.comment_library ?? {}),
    positive: data.comment_library?.positive ?? ["Everything is fine.", "A good step forward."],
    neutral:  data.comment_library?.neutral  ?? ["Things are okay.", "We wait and see."],
    negative: data.comment_library?.negative ?? ["Not happy with this.", "Another failure."],
    crisis:   data.comment_library?.crisis   ?? ["We are in trouble.", "Emergency response needed."],
    scandal:  data.comment_library?.scandal  ?? ["Unbelievable corruption.", "Resign now!"]
  };

  return {
    ...data,
    city_id,
    city_name,
    tier: data.tier ?? "medium",
    problem_clusters,
    city_personality,
    opening_sequence,
    advisors,
    decisions,
    crises,
    scandals,
    comment_library
  };
}

export function loadCity(raw) {
  const data   = normalizeCity(raw);
  const errors = validateCity(data);
  if (errors.length > 0) {
    console.error('City validation failed:', errors);
    throw new Error('Invalid city data:\n' + errors.map(e => '• ' + e).join('\n'));
  }
  return data;
}

export function validateCity(data) {
  const errors = [];

  for (const field of REQUIRED_CITY_FIELDS) {
    if (data[field] === undefined || data[field] === null) {
      errors.push('Missing required field: ' + field);
    }
  }

  if (Array.isArray(data.advisors)) {
    if (data.advisors.length < 2 || data.advisors.length > 6) {
      errors.push('Advisor count must be 2-6, got ' + data.advisors.length);
    }
    for (const advisor of data.advisors) {
      for (const field of REQUIRED_ADVISOR_FIELDS) {
        if (advisor[field] === undefined || advisor[field] === null) {
          errors.push('Advisor "' + (advisor.id ?? '?') + '" missing: ' + field);
        }
      }
      if (advisor.dialogue) {
        for (const key of REQUIRED_DIALOGUE_KEYS) {
          if (advisor.dialogue[key] === undefined || advisor.dialogue[key] === null) {
            errors.push('Advisor "' + advisor.id + '" missing dialogue: ' + key);
          }
        }
      }
      if (typeof advisor.competence_rating === 'number' &&
          (advisor.competence_rating < 1 || advisor.competence_rating > 10)) {
        errors.push('Advisor "' + advisor.id + '" competence_rating must be 1-10');
      }
    }
  }

  if (data.comment_library) {
    for (const cat of REQUIRED_COMMENT_CATEGORIES) {
      if (!Array.isArray(data.comment_library[cat]) || data.comment_library[cat].length < 2) {
        errors.push('comment_library.' + cat + ' needs at least 2 entries');
      }
    }
  }

  if (Array.isArray(data.crises)) {
    for (const crisis of data.crises) {
      if (!crisis.id || !crisis.name || !crisis.trigger || !crisis.description) {
        errors.push('Crisis "' + (crisis.id ?? '?') + '" missing required fields (id/name/trigger/description)');
      }
      if (!Array.isArray(crisis.options) || crisis.options.length !== 3) {
        errors.push('Crisis "' + crisis.id + '" must have exactly 3 options (got ' + (crisis.options?.length ?? 0) + ')');
      }
      for (const option of (crisis.options ?? [])) {
        if (!option.id || !option.label || !option.consequences) {
          errors.push('Crisis "' + crisis.id + '" option "' + (option.id ?? '?') + '" missing id/label/consequences');
        }
        const cons = option.consequences ?? {};
        if (cons.approval_delta === undefined) errors.push('Crisis "' + crisis.id + '" option "' + option.id + '" missing approval_delta');
        if (cons.budget_delta   === undefined) errors.push('Crisis "' + crisis.id + '" option "' + option.id + '" missing budget_delta');
      }
    }
  }

  if (data.opening_sequence) {
    if (!data.opening_sequence.starting_stats) {
      errors.push('opening_sequence missing starting_stats');
    } else {
      const ss = data.opening_sequence.starting_stats;
      if (ss.approval_rating === undefined) errors.push('starting_stats missing approval_rating');
      if (ss.budget          === undefined) errors.push('starting_stats missing budget');
    }
  }

  return errors;
}

export function validateAllCities(cities) {
  const results = {};
  for (const [name, data] of Object.entries(cities)) {
    const errors = validateCity(data);
    results[name] = { valid: errors.length === 0, errors };
  }
  return results;
}
