# GOVERNED — Project Structure & Mechanics
## Updated: June 2026 (v4.5 — personal-funds economy: off-books wallet (30% starter + odd-turn salary), skims to personal funds, donate-to-city bridge, corruption raids folded into SCRUTINY (no separate meter), multiple simultaneous pacts, launder, partner blackmail; v4.4 — light/dark themes + theme-aware map, city-select redesign, governor-name personalization, in-game resignation, scandal-cause in the final report)

---

## Folder Structure

```
governed/
├── public/
│   └── index.html              ← Single HTML shell; #app div is the only content
│
├── src/
│   ├── main.js                 ← App class + CITY_REGISTRY (25 cities) + window.GOVERNED
│   │
│   ├── data/
│   │   ├── cities/             ← 25 city JSON data files
│   │   ├── geo/                ← World map TopoJSON (D3 city select map)
│   │   ├── schema.json         ← City content schema reference
│   │   └── voice-bible.md      ← Tone rules per city (for AI city generation)
│   │
│   ├── engine/                 ← Pure game logic — no DOM touches
│   │   ├── game-state.js       ← Single source of truth + serialize/deserialize
│   │   ├── turn-manager.js     ← Turn flow orchestrator + player actions
│   │   ├── crisis-manager.js   ← Crisis pool/trigger (turns 4, 8, 12)
│   │   ├── advisor-system.js   ← Trust, agendas, back channel, lover arc
│   │   ├── consequence-sim.js  ← Decision/crisis outcome applier
│   │   ├── contract-system.js  ← Budget contracts (side quests)
│   │   ├── scandal-system.js   ← 4-tier scandals + responses + exposure
│   │   ├── heat-system.js      ← SCRUTINY: levels, sources, transitions
│   │   ├── market-system.js    ← Black market: selection, effects, risks
│   │   ├── actor-system.js     ← External actor meetings (summon/resolve, archetype match)
│   │   ├── newspaper.js        ← Builds the morning paper from yesterday's events
│   │   └── generic-problems.js ← Generic decision pool + follow-ups + text interpolation
│   │
│   ├── ui/
│   │   ├── renderer.js         ← Screen router + handlers object
│   │   ├── ui-helpers.js       ← Pure CSS class mapping + text formatting
│   │   ├── components/         ← Reusable HTML-string generators
│   │   └── screens/            ← Full-screen HTML-string generators
│   │
│   ├── utils/
│   │   ├── random.js           ← Seeded PRNG (Mulberry32) — ALL engine RNG goes through it
│   │   ├── validators.js       ← City JSON normalization (incl. scandal tier derivation)
│   │   ├── formatters.js       ← Number/label display helpers
│   │   ├── local-storage.js    ← Save/load game state (key: governed_save)
│   │   ├── settings-store.js   ← Settings persistence independent of saves (incl. theme)
│   │   ├── career-stats.js     ← Lifetime player stats + Past Administrations hall
│   │   ├── governor.js         ← Player name → newspaper/advisor/protest/report text + salutations
│   │   └── theme.js            ← Applies light/dark theme to <html data-theme>
│   │
│   └── styles/
│       ├── variables.css       ← Design tokens; light "Paper Ledger" :root + dark "Ink Slate" [data-theme="dark"] (incl. map/tier/newsprint tokens)
│       ├── base.css            ← Fluid root font scale + themed scrollbars + reset
│       ├── components.css      ← All card/component styles + mobile dispatch
│       ├── screens.css         ← Screen layouts + END-OF-FILE mobile override block
│       └── animations.css      ← Keyframe animations
│
├── tests/                      ← Vitest suite (npm test)
│   ├── fixtures.js             ← Minimal city fixture + localStorage stub
│   ├── game-state.test.js      ← Save/load round-trip, roster restore regression
│   ├── turn-manager.test.js    ← End conditions, scandal flows, back channel
│   ├── day-systems.test.js     ← Action points, meetings, consults, newspaper, follow-ups
│   ├── consequence-sim.test.js
│   ├── contract-system.test.js ← Installment math, competing offers
│   └── scandal-system.test.js  ← Authored penalties, reveal queue, responses
│
├── Hardcoded things/           ← Shared content pools
│   ├── budget_corruption.json        }
│   ├── environmental_climate.json    }
│   ├── infrastructure_failure.json   }  6 generic problem categories
│   ├── media_scandal.json            }
│   ├── political_pressure.json       }
│   ├── public_protest.json           }
│   ├── contract_offers.json    ← Contract side-quest pool
│   ├── black_market.json       ← 60 black market offers (6 types × 10)
│   ├── advisor_reactions.json  ← Advisor reaction lines ("told_you_so" pool, random pick)
│   ├── external_actors.json    ← Meeting archetypes (9) + offers, keyword-matched to actor names
│   ├── newspaper_templates.json← Morning paper: headlines, gossip, teasers, polls, fake ads
│   └── followup_problems.json  ← Hidden second-act problems (unlocked by parent options)
│
├── docs/                       ← Built output for GitHub Pages (DO NOT EDIT)
├── HOW_TO_PLAY.md              ← Full player-facing manual (kept current)
├── package.json                ← scripts: dev / build / preview / test
└── vite.config.js              ← base: '/governed/', outDir: 'docs'
```

---

## Architecture: Data → Engine → UI

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   DATA       │ →  │   ENGINE     │ →  │     UI       │
│  city JSON   │    │  pure logic  │    │  DOM/CSS     │
│  problem &   │    │  no DOM      │    │  read-only   │
│  market pools│    │  state only  │    │  from state  │
└──────────────┘    └──────────────┘    └──────────────┘
```

The engine never touches the DOM. UI never mutates state directly: **button click → `window.GOVERNED.method()` → engine mutates `state` → `app.render()` re-renders from scratch.** All engine randomness routes through the seeded PRNG (`utils/random.js`), so a seed-pinned game replays identically.

---

## Engine Modules

### `game-state.js` — Single source of truth

**Core fields:** `city`, `turn`, `approval`, `budget` (public treasury), `personalFunds` (off-books wallet — 30% of opening budget as the turn-1 paycheck; salary of max(1, 4% of budget) on turns 3/5/7/9/11; every back-channel move is paid from here and corrupt skims flow in), `pendingDonationNews` (queues the donation front page), `advisors[]`, `activeCrises[]`, `resolvedCrises[]`, `flags{}`. Helper `shiftPersonal(delta)` floors the wallet at 0.

**Pending-event queues (all serialized):** `pendingCrisis`, `pendingScandal`, `pendingScandalReveals[]` (surprise-scandal popups), `pendingHeatNotices[]` (SCRUTINY level-up popups), `pendingBetrayals[]`, `pendingBribes[]`, `pendingContractOffers[]`, `pendingUnrest`, `pendingMarketOffers[]`, `pendingLoverDemand`, `pendingPartnerDemand`.

**Strict Phase Flow:** The game now enforces a strict, blocking phase sequence for each turn: `phaseNewspaper` → `phaseProblem` → `phaseMeeting` → `phaseMarket` → `phaseRiot` → `phaseScandal`. You cannot skip or carry over problems. The END TURN button only becomes available once all phases are cleared. `lastPresentTurn` is used to ensure only one main generic problem is drawn per turn.

**SCRUTINY:** `heat` (points), `lastHeatGainTurn`, `siegeTurns`.

**Day structure:** `actionPoints`/`maxActionPoints` (3 "hours"/turn; meetings, consultations and back-channel moves each cost 1 — refilled in `processTurn`), `pendingMeeting`, `meetingUsedTurn` (one meeting/turn), `lastMeetingResult`, `decisionMods` (today's-decision modifiers bought in meetings: `scandalHalf`, `spin` — consumed by `resolveDecision`, expire at end of turn), `pendingNewspaper` (the morning paper object), `lastNewspaperApproval` (poll trend), `pendingRecMeta` (advisorId → `{scheming}` — the honest answer behind today's recommendations; consumed by consults and meeting intel).

**Black market:** `purchasedOffers[]` (once-per-game tracking), `marketEffects{}` (every active aura/shield/stream — see market-system).

**Bookkeeping:** `backChannelUsedTurn` (one dirty action per turn), `dirtyDeeds{skimmed, threats, leaks, exposed, marketBuys}`, `endReason` (`recalled | term_complete | career_ending_scandal | resigned`), `endScandal` (`{title, tier, description}` of the scandal that ended the term — drives the report's *Why You Resigned* box), `governorName`, `consecutiveDeficitTurns`.

**Per-advisor runtime fields:** `trust`, `agendaProgress`, `betrayed`, `sacrificed`, `romanceExposed`, `relationshipType`, `scorned`, `lastDemandTurn`, `emergencyPowerUsed`, `corruptPact`, `pactTurns` (cumulative — never resets on restart), `totalSkimmed`, `pactResidual`, `threatCount`, `leakUsed`, `pendingReaction` (queued "told you so" — `{type, title, turn}`), `pendingReactionMsg` (ready-to-read chat line; drives the unread badge until the messenger consumes it).

**`deserialize()`** rebuilds the advisor roster **from the save**, not from `loadCity()`'s shuffle (regression-tested — loading used to reshuffle advisors).

### `turn-manager.js` — Turn flow + player actions

**`processTurn()` sequence:**
```
0.   Auto-fire unhandled pendingScandal (full penalty)
0.5  _processHeatAndMarket():
       market offers expire · heat decay (−1 per clean turn)
       siege clock (3 turns UNDER SIEGE = recall)
       impeachment flag → major scandal
       fixer resurface · income streams · approval drips
       pension loan due · forced unrest (arms sale)
1.   tickAgendas (agenda +5*, trust −2; betray at 80)   *frozen by market FX
2.   tickRelationships (rel modifiers, romance roll, scorned, lover demands)
3.   processCorruptPacts (skim → **personalFunds**, +2 trust, discovery roll 5%+1%/turn) · processRaidRisk (pacts add scrutiny; raid at high heat) · salary on odd turns (4%/min 1M → personalFunds)
4.   generateBribeOffers (agenda ≥ 60, 30%)
5.   pendingCrisis → activeCrises
6.   _checkEndConditions (approval 0 / siege / turn ≥ 12 & no crisis / 3 failed crises)
7.   turn++ · decision quota reset · action points refill ·
        unanswered visitor leaves · decisionMods expire · morning paper built
8.   Economy: passive tax → budget pressure (slush fund, deficit pause)
        → tier drain (truce pause, halved drains)
9.   _rollScandalEvent (settings freq × military passive × SCRUTINY mult
        × market dampers; newsroom-bug skip; lover tip-off 35%)
10.  _rollUnrestEvent (budget<0 & approval<37; immunity/damp/boost FX)
11.  Contracts: installments (+ remainder on final) → offer roll
12.  Reactions ("I told you so" delivery) → briefings → recommendations → absence effects
13.  Crisis trigger on 4/8/12 (skip-crisis FX consumes the window)
14.  saveGame
```

**Player actions:** `resolveDecision` (applies meeting decisionMods then halve-next-loss FX, rec trust ±, queues a told-you-so reaction when ignored advice goes badly, domain trust +5/agenda −8, then **rolls the black market**), `resolveCrisis` (crisis cost/approval FX), `resolveUnrest`, `acceptScandal/suppressScandal/respondToScandal`, `accept/declineBribe`, contracts, `useEmergencyPower`, `backChannelAction`, `buyMarketOffer/passMarket`, `addressNation`, `resolveLoverDemand`, `summonActor/resolveMeeting` (actor meetings), `consultAdvisor`, `dismissNewspaper`.

### `actor-system.js` — External actor meetings

The day's problem lists `external_actors`; once per turn (1 action point) the player summons one. The name is keyword-matched to one of 9 archetypes in `external_actors.json` (union, business, media, legal, religious, criminal, political, community, fixer fallback). One eligible offer is presented: ACCEPT applies effect ops (`budget/approval/heat`, `trust_domain/agenda_domain`, `scandal_shield_today` → decisionMods.scandalHalf, `spin_today` → decisionMods.spin, `reveal_scheming` → honest verdict on today's recommendation from `pendingRecMeta`, optional `risk` roll → scandal); DECLINE applies the (usually mild) decline effects. Unanswered visitors leave at end of turn.

### `newspaper.js` — The morning paper

`buildNewspaper(state)` runs in `processTurn` after turn++ and assembles a front page from yesterday: lead story (scandal > crisis > decision with authored `follow_up` text > quiet-day filler), second story (an unresolved problem aging ≥ 2 days), whisper column (romance tease > plotter > pact smell > checked-out advisor > society filler), poll box with trend vs `lastNewspaperApproval`, editor's teasers (scrutiny level, crisis window on 4/8/12, deficit), and a fake ad. Templates in `newspaper_templates.json`. The UI shows it as a dismissible overlay before the day begins.

### Consultations (`advisor-system.consult`)

1 action point, once per advisor per turn. If today's recommendation came from a *different* advisor, the consulted advisor verifies it: 80% accurate read on the `pendingRecMeta.scheming` flag (a trust < 40 advisor just shrugs). Otherwise they give their domain forecast (`_generateIntel` without the trust ≥ 70 gate).

### `heat-system.js` — SCRUTINY

Points internal, levels public: QUIET 0 · MURMURS 10 · WATCHED 25 · INVESTIGATED 45 · UNDER SIEGE 70. Scandal heat: minor +1, moderate +2, major +3, career +5. `addHeat()` queues level-transition notices and entry effects (audit −20M at INVESTIGATED, impeachment at SIEGE). `scandalChanceMult()`: ×1 / ×1 / ×1.25 / ×1.5 / ×2. Defuses: clean-turn decay, Address the Nation (once per term, heat ≥ 25), sacrifice (back channel), market laundry offers.

### `market-system.js` — Black market

Pool: `Hardcoded things/black_market.json`, 6 types × 10 offers. **`rollOffers(domain)`** fires after the day's decision: 30% base +10% deficit +10% approval<35 (cap 50%). One offer from a random type + one *linked* offer (problem domain → dealer type: finance→sellside, urban/transport→insurance, religious→intelligence, military→influence, media→cleanup). Offers expire at next `processTurn`. INVESTIGATED+ adds 25% price premium. **`buy()`** charges the price to **personalFunds** (off the public budget; sell-side negative prices pay into your pocket, with an affordability guard on buys), applies effects (interpreter with ~30 ops: stat deltas, advisor ops, clears, timed auras, shields, income streams, the pension loan), heat, then rolls the risk (scandal / resurface-worse / rivalry / forced unrest). Everything lands in `state.marketEffects` and is consumed by the relevant engine hook.

### `advisor-system.js` — Advisors, back channel, lover arc

**`BACK_CHANNEL_ACTIONS`** (one per turn; conditions on trust/approval/budget/agenda/heat):
get_closer · keep_distance · corrupt_pact (trust ≥ 60; skims to **personal funds**; **multiple pacts allowed**) · end_pact · launder (active pact, personal ≥ 30M: −30M, pactTurns −3, scrutiny −6) · threaten (agenda ≥ 40 or PI-unlock, approval ≥ 45; backfire scales with leverage, doubles on reuse, 3rd = instant betrayal) · leak (agenda ≥ 50, personal ≥ 30M, once per advisor; journalist paid from personal funds) · **sacrifice** (heat ≥ 20: heat −10, +2% approval, cabinet −8 trust; lover variant −12/−4%/−12). All paid spends come from `personalFunds`, never `budget`.

**Lover arc:** one lover only (cheating → scorned ex, may go public at +1 severity for 2 turns; breakups same). Devoted lover (trust ≥ 70): 35% tip-off cancels a rolled scandal. **Demands: 40%/turn** (`pendingLoverDemand`, max one pending): fund −30M or pardon +1 heat; refusal cools the relationship. Exposure stance by trust: ≥ 70 penalty halved +10 trust; < 40 full penalty + rivalry.

**Partner demands:** active corrupt pact partner demands an answer **40%/turn** (`pendingPartnerDemand`): `bigger_cut` (pay −25M personal/+5 trust, or refuse → trust −8) · `cold_feet` (accept → `pactPaused`: next turn no skim/no risk; refuse → trust −5) · `blackmail` (only when pactTurns ≥ 5 & totalSkimmed ≥ 80M: pay `demand` = 50% of skimmed from personal funds for silence, or refuse → they betray you and tip Oversight, suspicion +30). Resolved via `resolvePartnerDemand(accept)`.

**Corruption raids (`processRaidRisk`):** no separate meter — active pacts add `+activePacts` SCRUTINY heat each turn (also blocking decay). At heat level ≥ INVESTIGATED, a raid rolls at `(idx−2)×0.12 + activePacts×0.05`; on hit, `_corruptionRaid` exposes every active pact via `_exposePact`, seizes 50% of personal funds, and fires a career-ending scandal. Launder −6 heat; blackmail-refuse +8 heat. `donateToCity(amount)` (turn-manager) moves personal → budget, +1% approval, queues `pendingDonationNews`.

**Unread badges:** advisor cards show a pulsing red badge — "needs an answer" when that advisor's lover/partner demand is pending, "new message" when a told-you-so reaction waits unread; the mobile ADVISORS tab gets a red dot when any demand, bribe, or unread reaction waits.

**Recommendations are personality-driven**, not safety-driven: per-advisor weights (finance=budget, military=anti-scandal, urban=approval...), self-interest from `advisor_effects`, ±noise — and at agenda ≥ 60 a **50% chance of deliberate sabotage** (approval term inverted). Console logs `(SCHEMING)`. In the messenger the rec renders as a **chat bubble** with the option's authored `advisor_reason` — the advisor makes their case before naming their pick.

**Reactions ("I told you so"):** when the player **ignores a recommendation** and the chosen option's `approval_delta` is negative AND worse than the recommended option's, `resolveDecision` queues `advisor.pendingReaction`. Next `processTurn`, `deliverPendingReactions()` converts it to `pendingReactionMsg` — a random line from `Hardcoded things/advisor_reactions.json` (`told_you_so` pool, `{title}` interpolated). Opening that advisor's messenger pushes it into the chat log and clears the badge. The file is extensible: add new pools keyed by reaction type.

**Pacts:** skim = max(10, 25% of tax rate)/turn, +2 trust (complicity), discovery 5% +1%/turn; exposure severity by cumulative `pactTurns` (≤2 minor → 9+ career_ending); residual 4% × 2 turns after ending.

### `scandal-system.js`

4 tiers (−5/−12/−22/−40 default; **city-authored `approval_penalty` takes precedence**). `safeTier()` guards bad JSON. `_applyScandal()` adds heat + queues a reveal popup for every *surprise* scandal (sourceId ≠ 'accepted') with a human explanation of the source. Pending-card paths: suppress (20/40/80/150M) / accept / **manage the story** (tier responses; base penalty applies first, response shapes it). Career-ending: resign (game over) or Desperate Last Stand (150M, 25% — survival still applies the scandal penalty). `triggerRomanceExposure(name, severityBoost)` handles stance variants and the Deepfake Insurance shield.

### `crisis-manager.js` / `consequence-sim.js` / `contract-system.js` / `generic-problems.js`

Largely as before: crisis windows 4/8/12 with turn-12 fallback; consequence applier (positive trust_delta counters agenda ×1.5, scandal_risk roll, crisis/decision unlocks); contracts (tier chance + deficit bonus, installments **pay the rounding remainder on the final payment**, accepting one competing offer marks the other declined); generic problems (domain-tagged pools, `{city.*}` interpolation — including per-option `advisor_reason`, trust < 30 hides the domain's problems). Scandal responses now report `hitZero`: if the base penalty zeroes approval, the recall fires even when the response's recovery modifier would lift it back above 0. Problem options carry an optional `advisor_reason` (the advisor's authored argument for that option — generate with `ADVISOR_REASON_PROMPT.md`).

**Follow-up problems:** entries in `followup_problems.json` carry `followup: true` and never enter the random pool. A parent option's `unlocks_decision_id` (applied by consequence-sim as flag `decision_<id>`) makes the follow-up **jump the queue** as the next day's new problem — second acts with higher stakes. Generate more with `CONTENT_PROMPTS.md` (Prompt 3).

---

## UI

**`renderer.js`** — router; `handlers` object delegates everything to `window.GOVERNED`.

**`dispatch-screen.js`** — main game screen (grid `30% 1fr 20%`). Opens under the **morning paper overlay** (`newspaper-screen.js`, dismiss to start the day). Story column: pips, story card, **black market card** (after the day's decision, when open). Decision column: **HOURS pips** (action points), decision cards, **REQUEST A MEETING row** (the problem's external actors; 1 hour, one per day), **meeting card** (accept/decline the visitor's offer) and after-meeting result, **Address the Nation card** (heat ≥ 25, once), scandal card (with manage-the-story responses), unrest card, END TURN (sticky on desktop). Right: advisor cards (badges: BETRAYED / PLOTTING / OFFERING A DEAL (real offers only) / CHECKED OUT / GROWING RESTLESS), bribe + contract cards, crisis window (synced to engine's 4/8/12), live ticker. Full-screen popup queues: **heat notices → scandal reveals → betrayals** (sacrifice variant labeled SACRIFICED).

**`messenger-screen.js`** — advisor chat: quick replies, **recommendation chat bubble** (authored `advisor_reason` + pick + trust note), delivered **"I told you so" messages** (consumed from `pendingReactionMsg` on open), **consult button** (VERIFY TODAY'S ADVICE / ASK FOR A FORECAST — 1 hour, once per advisor per turn), emergency power, **lover demand box**, **BACK CHANNEL section** (only actions whose triggers pass — each costs 1 hour; pact status line with live risk; one-per-turn notice).

**`settings-screen.js`** — tabs: Gameplay (scandal freq — wired to engine; language placeholder), Display (feed speed — wired), Audio (sound toggle — persists, no audio engine yet), Stats (**CAREER** lifetime stats + CURRENT SESSION), Data (**Resign Early** during a game + Reset Save). All changes persist via `settings-store.js` immediately (independent of game saves).

**`report-screen.js`** — endings: term complete / RECALLED / RESIGNED (scandal: "resigned in disgrace" or "the last stand failed") / RESIGNED (voluntary). Crises survived counted **out of 3** (windows, not city crisis count). Boxes: worst decision, **DIRTY HANDS / CLEAN HANDS**, **BACKROOM RELATIONS** (per-advisor epitaphs: lover, pact partner + skim total, threats, leaks, sacrificed...).

**`menu-screen.js`** — PLAY / SETTINGS, HOW TO PLAY modal (current systems), formal CREDITS modal.

**`cityselect-screen.js`** — D3 world map, 25 pins + planned-city dots, terminal-style posting board.

**`top-bar.js`** — city/turn/approval/budget + **SCRUTINY level with pips** (hidden while QUIET).

---

## Styles — important rules

- **`base.css`** — fluid root font: `clamp(14px, 100vw/60, 64px)` — whole UI (rem-based) keeps the same proportions at any desktop width. Tablet 150% / phone 125% fixed. **Themed scrollbars globally** (6px dark thumb).
- **`screens.css`** — ⚠ has a mobile media block near the TOP that **loses the cascade** to desktop rules below it. The authoritative mobile overrides live in the **"MOBILE STICKY FIX" block at the END of the file** (settings tab strip, messenger grid, main-body). Add new mobile overrides THERE.
- **`components.css`** — desktop: `.story` scrolls, `.dec` capped at 72% with internal scroll + sticky END TURN. Mobile: `.dec` flows normally (sticky removed — taller-than-viewport sticky panels bury the story).

---

## City JSON Schema (key fields)

As before (city_id, tier, tax_rate, advisors, decisions, crises, scandals, comment_library, scandal_reactions, romance_exposure), plus:

```json
"advisors": [
  {
    "id": "finance_Jane",
    "domain_id": "finance",       ← New: explicitly defines the advisor's domain
    "name": "Jane Doe",
    "role": "Director of Budget",
    "portrait": "📋",
    "agenda": "Maintain fiscal solvency...",
    "dialogue": { ... }
  }
],
"scandals": [
  { "id": "...", "title": "...", "description": "...",
    "approval_penalty": -14,
    "severity_tier": "moderate"   ← optional; derived from penalty if absent
  }                                  (≤−30 career, ≤−18 major, ≤−8 moderate)
],
"address_the_nation": {            ← optional; generic fallback exists
  "title": "Steps of Balai Kota",
  "body": "Two hundred journalists. One podium...",
  "option_flavor": { "own_it": "...", "defiant": "...", "deflect": "..." }
}
```

---

## Economy Reference

`income/turn = round(taxRate × approval/100)` · tier defaults 80/60/40/25/15 (city `tax_rate` overrides). Deficit: −3%/turn (−5% below −200M). Corrupt pact skim: max(10, 25% of tax rate). Black market prices 20–150M (+25% at INVESTIGATED). Suppress costs 20/40/80/150M.

---

## Public API (window.GOVERNED)

```javascript
goToMenu(), goToCitySelect(), goToSettings(),
startGame(cityKey, governorName),          // async
switchCity(cityId),                        // async
nextTurn(),
handleDecision(decisionId, optionIndex),
handleCrisisDecision(crisisId, optionIndex, advisorSecretId?),
acceptScandal(), suppressScandal(), respondToScandal(responseId),
openMessenger(advisorId), backToDispatch(),
dismissBetrayal(), dismissScandalReveal(), dismissHeatNotice(),
acceptBribe(id), declineBribe(id),
acceptContract(id), declineContract(id), declineAllContracts(),
resolveUnrest(action), useEmergencyPower(id),
shiftAdvisorRelationship(id, delta),
backChannelAction(advisorId, actionId),    // get_closer/keep_distance/corrupt_pact/
                                           // end_pact/threaten/leak/sacrifice
buyMarketOffer(offerId), passMarket(),
addressNation(optionId),                   // own_it/defiant/deflect
loverDemand(accept), partnerDemand(accept),
summonActor(actorName), meetingResponse(accept),
consultAdvisor(advisorId), dismissNewspaper(),
resignEarly()
```

All game-over paths route through `app._endGame()` → records career stats exactly once (`career_recorded` flag).

---

## Persistence

| Key | Contents |
|---|---|
| `governed_save` | Full game state (versioned 0.1.0; mismatch clears) |
| `governed_settings` | Settings — written on every change, loaded at boot (incl. `theme`: light/dark) |
| `governed_career_stats` | Lifetime stats + `governors[]` Past Administrations hall (name, city, outcome, approval, turn) |

---

GitHub Pages serves `docs/` at `https://putra10.github.io/governed/` (`base: '/governed/'`).

---

*Created by Kimi K2.6 - June 2026*
*Updated by Claude — June 2026*
