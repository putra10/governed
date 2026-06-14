import { pick } from '../ui-helpers.js';

// ─── City persona registries ──────────────────────────────────────────────────
const CITY_PERSONAS = {
  jakarta: {
    flag: '🇮🇩',
    platform: 'X / Twitter',
    media:    { handle: '@JakartaPost',    label: 'The Jakarta Post',      badge: 'mn', ck: 'ck-g' },
    politics: { handle: '@DPRWatch',       label: 'DPR Observer',          badge: 'pn', ck: 'ck-s' },
    activists:[
      { handle: '@WalHi_Jkt',  label: 'WALHI Jakarta'    },
      { handle: '@KRL_Mania',   label: 'KRL Commuters'    },
      { handle: '@Koalisi_Air', label: 'Water Coalition'  },
    ],
    citizens: [
      '@bantar_gebang', '@ojek_jaksel', '@warga_banjir',
      '@anak_menteng', '@kost_blok_m', '@supir_transj',
    ],
    ticker_prefix: 'Jakarta',
  },
  nyc: {
    flag: '🇺🇸',
    platform: 'X / Twitter',
    media:    { handle: '@NYPost',       label: 'New York Post',         badge: 'mn', ck: 'ck-g' },
    politics: { handle: '@CityHallNews', label: 'City Hall Bureau',      badge: 'pn', ck: 'ck-s' },
    activists:[
      { handle: '@HousingIsARight', label: 'Housing Advocates' },
      { handle: '@TransitRiders',   label: 'Transit Riders'    },
      { handle: '@BrooklynUnited',  label: 'Brooklyn United'   },
    ],
    citizens: [
      '@outer_borough_dad', '@bronx_resident_irl', '@hell_kitchen_apt',
      '@subway_survivor', '@crown_heights_mom', '@harlem_homeowner',
    ],
    ticker_prefix: 'NYC',
  },
  beijing: {
    flag: '🇨🇳',
    platform: 'Weibo',
    media:    { handle: '@BeijingDaily',     label: '北京日报 BJ Daily',   badge: 'mn', ck: 'ck-g' },
    politics: { handle: '@CentralBroadcast', label: 'CCTV Politics',       badge: 'pn', ck: 'ck-s' },
    activists:[
      { handle: '@Hutong_Saves',   label: 'Hutong Heritage'  },
      { handle: '@AirQualityBJ',   label: 'BJ Air Watch'     },
      { handle: '@MetroCommuters', label: 'Metro Riders'     },
    ],
    citizens: [
      '@beijing_civil_servant', '@haidian_parent', '@chaoyang_resident',
      '@fengtai_worker', '@dongcheng_elder', '@xicheng_local',
    ],
    ticker_prefix: 'BJ',
  },
  lagos: {
    flag: '🇳🇬',
    platform: 'X / Twitter',
    media:    { handle: '@PunchNewsPaper', label: 'Punch Newspapers',     badge: 'mn', ck: 'ck-g' },
    politics: { handle: '@LasgovWatch',    label: 'LASG Monitor',         badge: 'pn', ck: 'ck-s' },
    activists:[
      { handle: '@EndSARS_Keep',    label: 'Reform Coalition'  },
      { handle: '@MakokoVoice',     label: 'Makoko Community'  },
      { handle: '@LagosTechNaija',  label: 'Tech Hub Lagos'    },
    ],
    citizens: [
      '@mainland_hustler', '@banana_island_critic', '@vi_banker_life',
      '@ajegunle_rep', '@yaba_startup_bro', '@mushin_mechanic',
    ],
    ticker_prefix: 'Lagos',
  },
  singapore: {
    flag: '🇸🇬',
    platform: 'X / Threads',
    media:    { handle: '@STimes',       label: 'Straits Times',         badge: 'mn', ck: 'ck-g' },
    politics: { handle: '@ParliamentSG', label: 'Parliament Watch',      badge: 'pn', ck: 'ck-s' },
    activists:[
      { handle: '@BTO_5Years',      label: 'Housing Advocates'  },
      { handle: '@CyclistsSG',      label: 'Cyclists SG'        },
      { handle: '@WorkersPartyFan', label: 'Opposition Watch'   },
    ],
    citizens: [
      '@tampines_auntie', '@buona_vista_grad', '@jurong_kopitiam',
      '@amk_teacher', '@bedok_uncle', '@clementi_parent',
    ],
    ticker_prefix: 'SGP',
  },
  caracas: {
    flag: '🇻🇪',
    platform: 'X / Twitter',
    media:    { handle: '@ElNacionalWeb', label: 'El Nacional',          badge: 'mn', ck: 'ck-g' },
    politics: { handle: '@AsambleaWatch', label: 'Asamblea Monitor',     badge: 'pn', ck: 'ck-s' },
    activists:[
      { handle: '@BarrioAdentro_No', label: 'Community Voice'  },
      { handle: '@VenezuelaSOS',     label: 'Venezuela SOS'    },
      { handle: '@CaracasLuz',       label: 'Luz Caracas'      },
    ],
    citizens: [
      '@catia_sobrevive', '@baruta_familia', '@petare_watcher',
      '@la_castellana_ex', '@chacao_vecino', '@macarao_gente',
    ],
    ticker_prefix: 'CCS',
  },
  gaza: {
    flag: '🇵🇸',
    platform: 'X / Telegram',
    media:    { handle: '@AlJazeera',   label: 'Al Jazeera',           badge: 'mn', ck: 'ck-g' },
    politics: { handle: '@UNOCHANews', label: 'OCHA Reports',         badge: 'pn', ck: 'ck-s' },
    activists:[
      { handle: '@GazaAidNow',    label: 'Gaza Aid Coalition'  },
      { handle: '@MedicsGaza',    label: 'Medical Workers'     },
      { handle: '@UNRWA_Field',   label: 'UNRWA Field'         },
    ],
    citizens: [
      '@north_gaza_family', '@rafah_camp_voice', '@shujayya_resident',
      '@jabalia_survivor', '@khan_yunis_local', '@deir_balah_doc',
    ],
    ticker_prefix: 'GZA',
  },
  frankfurt: {
    flag: '🇩🇪',
    platform: 'X / Mastodon',
    media:    { handle: '@FAZ_Net',       label: 'Frankfurter Allgemeine', badge: 'mn', ck: 'ck-g' },
    politics: { handle: '@StadtratWatch', label: 'Stadtrat Monitor',       badge: 'pn', ck: 'ck-s' },
    activists:[
      { handle: '@FrankfurtMiete',  label: 'Mieterbund'        },
      { handle: '@GrueneSachsen',   label: 'Grüne Frankfurt'   },
      { handle: '@BUND_Frankfurt',  label: 'BUND Ortsgruppe'   },
    ],
    citizens: [
      '@sachsenhausen_mieter', '@bockenheim_student', '@bornheim_anwohner',
      '@gallus_pendler', '@nordend_eltern', '@west_end_banker',
    ],
    ticker_prefix: 'FRA',
  },
  tehran: {
    flag: '🇮🇷',
    platform: 'Telegram / X',
    media:    { handle: '@IranIntlFa',   label: 'Iran International',   badge: 'mn', ck: 'ck-g' },
    politics: { handle: '@MajlisWatch',  label: 'Majlis Observer',      badge: 'pn', ck: 'ck-s' },
    activists:[
      { handle: '@MahsaVoice',   label: 'Women Life Freedom' },
      { handle: '@TehranGreen',  label: 'Green Movement'     },
      { handle: '@IranLabour',   label: 'Workers Solidarity' },
    ],
    citizens: [
      '@shemiran_resident', '@tehranpars_local', '@yaft_abad_worker',
      '@jordan_st_family', '@vanak_sq_trader', '@navab_commuter',
    ],
    ticker_prefix: 'THR',
  },
  'tel-aviv': {
    flag: '🇮🇱',
    platform: 'X / Twitter',
    media:    { handle: '@Haaretz',       label: 'Haaretz',             badge: 'mn', ck: 'ck-g' },
    politics: { handle: '@KnessetWatch',  label: 'Knesset Monitor',     badge: 'pn', ck: 'ck-s' },
    activists:[
      { handle: '@DemocracyNow_IL',  label: 'Democracy Now IL'  },
      { handle: '@TLVAffordable',    label: 'Affordable Housing' },
      { handle: '@TelAvivProtest',   label: 'Protest Movement'  },
    ],
    citizens: [
      '@dizengoff_local', '@florentin_renter', '@jaffa_mixed_city',
      '@bnei_brak_commuter', '@petah_tikva_fam', '@herzliya_hi_tech',
    ],
    ticker_prefix: 'TLV',
  },
  toronto: {
    flag: '🇨🇦',
    platform: 'X / Bluesky',
    media:    { handle: '@TorontoStar',   label: 'Toronto Star',        badge: 'mn', ck: 'ck-g' },
    politics: { handle: '@CityCouncilTO', label: 'City Council Watch',  badge: 'pn', ck: 'ck-s' },
    activists:[
      { handle: '@ACORN_Toronto',   label: 'ACORN Tenants'     },
      { handle: '@TTC_Riders',      label: 'TTC Riders'        },
      { handle: '@ClimateTO',       label: 'Climate Action TO' },
    ],
    citizens: [
      '@scarborough_commuter', '@etobicoke_homeowner', '@north_york_parent',
      '@kensington_renter', '@parkdale_local', '@leslieville_condo',
    ],
    ticker_prefix: 'YYZ',
  },
  jeddah: {
    flag: '🇸🇦',
    platform: 'X / Snapchat',
    media:    { handle: '@SaudiGazette',  label: 'Saudi Gazette',       badge: 'mn', ck: 'ck-g' },
    politics: { handle: '@MunicipalityJD',label: 'JD Municipality',    badge: 'pn', ck: 'ck-s' },
    activists:[
      { handle: '@JeddahRoads',    label: 'Road Safety JED'   },
      { handle: '@Vision2030_Jed', label: 'Vision 2030'       },
      { handle: '@JeddahGreen',    label: 'Jeddah Green'      },
    ],
    citizens: [
      '@al_balad_resident', '@corniche_daily', '@north_jed_family',
      '@king_fahd_commuter', '@obhur_watcher', '@tahlia_st_local',
    ],
    ticker_prefix: 'JED',
  },
  sf: {
    flag: '🇺🇸',
    platform: 'X / Bluesky',
    media:    { handle: '@SFChronicle',  label: 'SF Chronicle',        badge: 'mn', ck: 'ck-g' },
    politics: { handle: '@BoardOfSuperv', label: 'Board of Supervisors', badge: 'pn', ck: 'ck-s' },
    activists:[
      { handle: '@TenderloinCare',  label: 'Tenderloin Advocates' },
      { handle: '@SF_YIMBY',        label: 'YIMBY Action'         },
      { handle: '@MissionLocal',    label: 'Mission District'     },
    ],
    citizens: [
      '@sunset_sf_local', '@soma_techie_tired', '@richmond_family',
      '@castro_longtime', '@bayview_resident', '@haight_renter',
    ],
    ticker_prefix: 'SFO',
  },
  shenzhen: {
    flag: '🇨🇳',
    platform: 'WeChat / Weibo',
    media:    { handle: '@SZDailyNews',  label: '深圳日报 SZ Daily',   badge: 'mn', ck: 'ck-g' },
    politics: { handle: '@SZCityHall',   label: '深圳市委宣传部',      badge: 'pn', ck: 'ck-s' },
    activists:[
      { handle: '@SZLabourVoice',  label: 'Labour Rights SZ'  },
      { handle: '@BayArea_Green',  label: 'Greater Bay Green' },
      { handle: '@SZ_TechWorkers', label: 'Tech Workers SZ'   },
    ],
    citizens: [
      '@nanshan_engineer', '@longhua_factory', '@futian_finance',
      '@luohu_commuter', '@bao_an_worker', '@longgang_migrant',
    ],
    ticker_prefix: 'SZX',
  },
  crimea: {
    flag: '🌐',
    platform: 'Telegram / VK',
    media:    { handle: '@CrimeaNews',   label: 'Crimea Dispatch',     badge: 'mn', ck: 'ck-g' },
    politics: { handle: '@RepublicWatch', label: 'Republic Monitor',   badge: 'pn', ck: 'ck-s' },
    activists:[
      { handle: '@CrimeanTatar_Voice', label: 'Tatar Community'  },
      { handle: '@Sevastopol_Civil',   label: 'Civil Society'    },
      { handle: '@BlackSea_Green',     label: 'Environment'      },
    ],
    citizens: [
      '@simferopol_local', '@yalta_resident', '@sevastopol_navy_fam',
      '@kerch_worker', '@evpatoria_pensioner', '@feodosia_villager',
    ],
    ticker_prefix: 'CRM',
  },
};

// Fallback persona if city not found
const FALLBACK_PERSONA = {
  flag: '🌐',
  platform: 'X',
  media:    { handle: '@CityBreaking', label: 'City News',  badge: 'mn', ck: 'ck-g' },
  politics: { handle: '@GovWatch',     label: 'Gov Monitor', badge: 'pn', ck: 'ck-s' },
  activists:[ { handle: '@CitizenVoice', label: 'Civil Society' } ],
  citizens: ['@citizen_1', '@citizen_2', '@city_resident'],
  ticker_prefix: 'CITY',
};

// ─── Feed item builder ────────────────────────────────────────────────────────
function feedItem(handle, text, type = 'citizen', badge = '', ck = '') {
  let cls = '';
  let fnCls = '';
  let ftCls = '';
  if (type === 'media') { cls = 'press'; fnCls = 'mn'; ftCls = 'mt'; }
  if (type === 'politics') { cls = 'pol'; fnCls = 'pn'; ftCls = 'pt'; }
  if (type === 'activist') { cls = 'act'; fnCls = 'an'; ftCls = ''; }
  if (type === 'decision') { cls = 'react'; fnCls = ''; ftCls = 'rt'; }
  return { cls, fnCls, ftCls, handle, text, badge: badge || (type === 'media' ? 'ck-g' : type === 'politics' ? 'ck-s' : ''), ck };
}

// ─── Timestamps ───────────────────────────────────────────────────────────────
const TIMES = ['just now', '2m', '5m', '11m', '18m', '27m', '34m', '49m', '1h', '2h'];
function randTime() { return TIMES[Math.floor(Math.random() * TIMES.length)]; }

// ─── Main render function ─────────────────────────────────────────────────────

// ─── Variation pools ─────────────────────────────────────────────────────────
const INFLUENCER_PREFIXES = [
  'Thread 🧵', 'Hot take:', 'Unpopular opinion:', 'Let me explain:',
  'Actually important:', 'Okay but', 'Nobody talking about how',
];
const ANGRY_PREFIXES = [
  'This is unacceptable.', 'Bro what.', 'Every single time.',
  'I give up.', 'Seriously?', 'How is this okay?', "Can't believe this.",
];
const REPLY_TEMPLATES = [
  'This.', 'Exactly.', 'Been saying this for years.', 'Facts.',
  'Pinning this.', 'The audacity.', 'We deserve better.',
  'Not surprised tbh.', 'When will they learn?', 'Thank you for saying this.',
  'Share this everywhere.', 'Can confirm, same in my area.',
  'What can we even do??', 'Signed the petition.', 'Reposting this.',
  '👆 Read this.', 'This is wild.', 'Speechless honestly.',
  'Every single time.', 'Hold them accountable.',
  'Big if true.', 'Source on this?', 'I live here and this is accurate.',
  'Following for updates.', 'Tagged my rep.', 'Call your councillor.',
];

// ─── Engagement numbers ───────────────────────────────────────────────────────
function randLikes(type) {
  const r = { media:[500,9000], politics:[200,4000], activist:[80,1500],
              influencer:[150,3500], citizen:[1,250], reply:[0,45], reaction:[5,130] };
  const [mn, mx] = r[type] ?? [0,100];
  return mn + Math.floor(Math.random() * (mx - mn));
}
function randReposts(type) { return Math.floor(randLikes(type) * (0.1 + Math.random() * 0.25)); }

// ─── Feed entry renderer ──────────────────────────────────────────────────────
function renderEntry(e) {
  const isMedia    = e.type === 'media';
  const isPol      = e.type === 'politics';
  const isAct      = e.type === 'activist';
  const isInf      = e.type === 'influencer';
  const isReply    = e.type === 'reply';
  const isReaction = e.type === 'reaction';

  const cls   = isMedia ? 'press' : isPol ? 'pol' : isAct ? 'act' : isInf ? 'inf' : isReply ? 'rep' : isReaction ? 'react' : '';
  const fnCls = isMedia ? 'mn' : isPol ? 'pn' : '';
  const ftCls = isMedia ? 'mt' : isPol ? 'pt' : isReaction ? 'rt' : '';

  const vBadge = e.verified  ? `<span class="ck ck-g">&#10003;</span>` : '';
  const gBadge = e.govtVerif ? `<span class="ck ck-s">&#10003;</span>` : '';
  const engLine = !isReply ? `<div class="fi-eng"><span class="fi-eng-i">&#9825; ${e.likes.toLocaleString()}</span><span class="fi-eng-i">&#8635; ${e.reposts.toLocaleString()}</span></div>` : '';

  return `<div class="fi ${cls}"><div class="fu"><div class="fu-left"><span class="fn ${fnCls}">${e.handle}</span>${vBadge}${gBadge}</div><span class="ft-time">${e.time}</span></div><div class="ft ${ftCls}">${e.text}</div>${engLine}</div>`;
}

// ─── Main feed generator ──────────────────────────────────────────────────────
export function renderPublicFeed(state, decision) {
  const lib = state.city?.comment_library;
  const cityId = state.city?.city_id ?? state.city?.id ?? '';
  if (!lib) return '<div class="fi"><div class="ft">Feed loading...</div></div>';

  const p = CITY_PERSONAS[cityId] || FALLBACK_PERSONA;
  const entries = [];
  const used = new Set();

  function dedup(t) {
    if (!used.has(t)) { used.add(t); return t; }
    return t; // allow repeats rather than blank entries
  }

  function add(handle, text, type, opts = {}) {
    entries.push({
      handle, text: dedup(text), type,
      verified:  opts.verified  ?? false,
      govtVerif: opts.govtVerif ?? false,
      time:      TIMES[Math.floor(Math.random() * TIMES.length)],
      likes:     randLikes(type),
      reposts:   randReposts(type),
    });
  }

  const citizens  = p.citizens  || ['@resident'];
  const activists = p.activists || [{ handle: '@community' }];
  const rndCit = () => citizens[Math.floor(Math.random() * citizens.length)];

  // ── Media outlet (all lib.media entries) ─────────────────────────────────
  (lib.media || []).forEach(t => add(p.media.handle, t, 'media', { verified: true }));

  // ── Short replies to media posts ─────────────────────────────────────────
  REPLY_TEMPLATES.slice(0, 4).forEach((t, i) => add(citizens[i % citizens.length], t, 'reply'));

  // ── Politician / gov watcher ──────────────────────────────────────────────
  (lib.politician || []).forEach(t => add(p.politics.handle, t, 'politics', { govtVerif: true }));

  // ── Activist / NGO accounts ───────────────────────────────────────────────
  (lib.activist || lib.civil_society || []).forEach((t, i) => {
    const act = activists[i % activists.length];
    add(act?.handle ?? '@activist', t, 'activist');
  });

  // ── Street voices ─────────────────────────────────────────────────────────
  (lib.street || lib.ordinary || []).forEach(t => add(rndCit(), t, 'citizen'));

  // ── Positive pool → citizens + occasional influencer framing ─────────────
  (lib.positive || []).forEach((t, i) => {
    if (i % 3 === 0) {
      const act = activists[i % activists.length];
      add(act?.handle ?? rndCit(), INFLUENCER_PREFIXES[i % INFLUENCER_PREFIXES.length] + ' ' + t, 'influencer');
    } else {
      add(citizens[i % citizens.length], t, 'citizen');
    }
  });

  // ── Neutral pool → citizens ───────────────────────────────────────────────
  (lib.neutral || []).forEach((t, i) => add(citizens[i % citizens.length], t, 'citizen'));

  // ── Negative pool → angry citizens + influencer threads ──────────────────
  (lib.negative || []).forEach((t, i) => {
    if (i % 4 === 0) {
      const act = activists[(i + 1) % activists.length];
      add(act?.handle ?? rndCit(), '🧵 ' + t, 'influencer');
    } else {
      const prefix = i % 3 === 0 ? ANGRY_PREFIXES[i % ANGRY_PREFIXES.length] + ' ' : '';
      add(citizens[i % citizens.length], prefix + t, 'citizen');
    }
  });

  // ── Crisis feed — only when a crisis is active ────────────────────────────
  if (state.activeCrises?.length > 0) {
    (lib.crisis || []).forEach((t, i) => {
      if (i === 0) add(p.media.handle, '🚨 BREAKING: ' + t, 'media', { verified: true });
      else         add(citizens[i % citizens.length], t, 'citizen');
    });
    REPLY_TEMPLATES.slice(4, 7).forEach((t, i) => add(citizens[i % citizens.length], t, 'reply'));
  }

  // ── Scandal feed — only when scandal is brewing ───────────────────────────
  if (state.pendingScandal || state.activeScandals?.length > 0) {
    (lib.scandal || []).forEach((t, i) => {
      if (i % 2 === 0) add(p.politics.handle, t, 'politics', { govtVerif: true });
      else             add(citizens[i % citizens.length], t, 'citizen');
    });
  }

  // ── Decision-reactive posts ───────────────────────────────────────────────
  if (decision) {
    (decision.options || []).forEach((opt, i) => {
      const rx = opt.consequences?.public_reaction || opt.consequences?.city_reaction;
      if (rx) add(citizens[i % citizens.length], `"${rx}"`, 'reaction');
    });
    if (decision.body) {
      const sentence = decision.body.split(/[.!?]/)[0]?.trim();
      if (sentence && sentence.length > 20)
        add(p.media.handle, 'UPDATE: ' + sentence + '.', 'media', { verified: true });
    }
  }

  // ── Last decision reaction ────────────────────────────────────────────────
  if (state.pastDecisions?.length > 0) {
    const last = state.pastDecisions[state.pastDecisions.length - 1];
    const rx = last?.consequences?.public_reaction;
    if (rx) add(rndCit(), `"${rx}"`, 'reaction');
  }

  // ── Pad to 50 with reply threads ─────────────────────────────────────────
  const needed = Math.max(0, 50 - entries.length);
  for (let i = 0; i < needed; i++) {
    add(citizens[i % citizens.length], REPLY_TEMPLATES[(i + 8) % REPLY_TEMPLATES.length], 'reply');
  }

  // Light shuffle: pin first 2 (media/politics) at top, shuffle the rest
  const pinned = entries.filter(e => e.type === 'media' || e.type === 'politics').slice(0, 2);
  const rest   = entries.filter(e => !pinned.includes(e));
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  return [...pinned, ...rest].map(renderEntry).join('');
}
