# GOVERNED — How To Play

> Run the city. Hide the bodies. Smile for the cameras.

You are appointed governor of a city in crisis. Survive a **12-turn term**. Keep your **approval above 0**, keep the press off your back, and decide — every single turn — how dirty your hands are willing to get.

---

## 1. The Basics

### Core stats (top bar)

| Stat | What it is | Why you care |
|---|---|---|
| **APPROVAL** (0–100) | Public support | 0 = recalled. Game over. |
| **BUDGET** (M) | City treasury (public money) | Can go negative — deficits bleed approval every turn |
| **PERSONAL** (M) | Your off-books wallet | Pays for every dirty move; corrupt skims land here; donate it back for approval |
| **TURN** (1–12) | Your term | Survive to 12 to complete the term |
| **SCRUTINY** | How hard the press is digging | Hidden while QUIET. Once it appears, worry. |

### A turn, in practice

1. **Read the morning paper.** Yesterday's fallout, whispers about your cabinet, the polls, and the editor's mood. Then put it down and start the day.
2. **The Dispatch.** Face the day's problem and your options — usually **SAFE** (expensive, popular), **BOLD** (cheaper, riskier), **CHAOS** (cheap, unhinged).
3. **Spend your hours** (3 per day): take a meeting with one of the problem's named players, consult an advisor in private, or work the back channel. Each costs one hour — you can't do everything.
4. **Decide.** You must pick a response to the day's problem. You cannot skip or delay it.
5. **The Black Market.** Some nights after your decision, dealers knock. Buy, sell, or walk away.
6. **Urban Unrest.** If you're hated and broke, the city may boil over into strikes or riots.
7. **Scandals.** Breakings scandals hit your desk. Suppress them, accept the hit, or manage the story.
8. **End Turn.** Taxes collect, schemes advance, secrets rot, and tomorrow's paper goes to print.

### Hours (action points)

You get **3 hours a day** for discretionary politics. Each of these costs one:

- **A meeting** with one of today's external actors (one meeting per day, max)
- **A consultation** — an advisor's private read (once per advisor per day)
- **A back-channel move** (still limited to one per day on top)

Unspent hours vanish at midnight. Choose what today is for.

### End conditions

| How it ends | Why |
|---|---|
| **Term complete** | Reached turn 12 with no unresolved crisis |
| **Recalled** | Approval hit 0 — or 3 consecutive turns UNDER SIEGE — or 3 failed crises in a row while approval < 20 |
| **Resigned in disgrace** | A career-ending scandal forced you out (the final report names the scandal) |
| **Resigned** | You stepped down voluntarily — on your own terms, no scandal required |

**Stepping down.** Done with this city? You can quit any turn. Open your **most trusted advisor's** chat (your de-facto Chief of Staff) and choose **Step down from office**. A confirmation appears; confirm it and your term ends immediately, recorded as a voluntary resignation — no scandal, no disgrace, just the door.

---

## 2. Decisions & Crises

**One NEW problem per turn.** You must resolve it before the day ends. Decisions are final, and you cannot walk away from the day's problem.

**Some decisions have a second act.** Certain options set events in motion that come back as the next day's news — bigger, messier, and personally addressed to you. The task force you launched for show might actually find something. Choose like someone who'll still be here tomorrow.

**Crisis windows open on turns 4, 8, and 12.** Crises are bigger, forced events — you cannot end your term with one unresolved. If a trusted advisor (trust ≥ 60) owns the matching domain, a **secret option** appears: their personal connections, your way out.

### Meetings — the day's named players

Every problem names the people in it: the union boss, the auditor, the journalist. Spend an hour and **one of them comes to your office** with an offer — labor peace for a price, a PR firm's spin, a procedural blessing that halves today's scandal risk, or intel on whether your own advisor's recommendation is honest. Everything has a hook: money costs scrutiny, favors cost favors, and some deals carry printed odds of blowing up. You get one meeting a day. Pick your visitor like it matters, because it does.

### Consultations — the private read

In any advisor's chat, spend an hour for their private take. If today's recommendation came from a **different** advisor, they'll quietly verify it — *"the numbers are real but the framing is curated"* — and they're right about 80% of the time. Otherwise you get their domain forecast: deficit projections, crisis timing, unrest proximity. An advisor below 40 trust can't be bothered to dig. The newspaper, a meeting, and a consult all triangulating the same question is how you catch a scheming advisor before the knife goes in.

---

## 3. Advisors

You get 3–5 advisors by city tier. Each has a **domain**, a **trust** score, and a **hidden agenda** filling slowly toward betrayal.

### Trust

- Decays **−2/turn** baseline. You earn it back through **real choices**, not clicking:
  - **Serve their domain.** Take the option the domain advisor recommends (it reflects their portfolio's interest) and they gain **+6 trust** and their betrayal clock slows. Overrule them and trust **erodes** — harder each time you do it in a row (a repeated-overrule streak bites).
  - **Fund their ministry.** Now and then an advisor asks the **city budget** for a project (digital tax system, transit line, security overtime…). Each request is a randomly drawn *case* (a cheap quick-win, a prestige megaproject, a vanity splurge that costs you approval, a dubious fund that might trigger a scandal…), so the price and payoff vary. Funding costs real money and buys real loyalty; declining stings. Cases live in `Hardcoded things/funding_requests.json` and are easy to extend. It's a favor, not a free click.
  - **Get closer** still works in the back channel, but with **diminishing returns** (+3, then +2, then +1…) so you can't click your way to devotion. **Consulting** an advisor is now purely informational, and **chatting (quick replies) is pure flavor** — neither moves trust. There is no click-to-loyalty path left.
- **≥ 60:** secret crisis options. **≥ 70:** real intel in briefings (deficit warnings, crisis timing, unrest proximity). **≥ 75:** passive bonuses — Finance +10M/turn, Military −15% scandal chance, Urban Planning −20% unrest chance.
- **< 30: CHECKED OUT.** They stop flagging their domain's problems and silently drain your stats every turn. Hard to recover.

### Agendas & betrayal

Agendas tick **+5/turn**. At **60+** the card shows GROWING RESTLESS and they may offer you a deal; at **80 they betray you** — gone permanently, −10 approval (−15 if they were your lover).

### Advice — read this twice

Advisors recommend options based on **their own values**, not your safety. Finance favors whatever's cheap. Military hates scandal risk. Urban Planning chases popularity. Open their **Messenger** and they'll make their case in chat — a reason for the pick, in their own voice. It's persuasion, not truth: an advisor whose **agenda is 60+ may deliberately recommend what hurts you**, with the same confident reasoning. The agenda bar is your only warning. Taking their pick builds trust; overruling erodes it (and erodes faster if you keep doing it). That's politics — and it's why trust is something you *provoke*, not farm.

**And they keep score.** Ignore an advisor's recommendation and have your choice blow up in your face, and the next morning there's a message waiting: *"I told you so."* You'll know it's there — their card shows a **red badge** and "new message", and on mobile the **ADVISORS tab gets a red dot** right from the dispatch.

### Bribes (they offer you)

At agenda 60+, advisors may offer a deal: pay their price (≈50–200M) for **−30 agenda, +15 trust** — with a 25% chance the payment leaks into a scandal. Declining adds +10 agenda, and if that crosses 80, they snap immediately.

### Emergency powers (one use each, −8 trust)

| Advisor | Power | Effect |
|---|---|---|
| Finance | Emergency Loan | +80M, −5% approval |
| Military | Marshal Forces | instantly clears unrest |
| Urban Planning | Community Initiative | +10% approval, −20M |
| Religious Affairs | Unity Sermon | +7% approval |
| Transport | Relief Routes | +15M, −3% approval |

---

## 4. The Back Channel (Messenger)

One action per turn, across all advisors. Each unlocks only when its trigger is met.

| Action | Trigger | What happens |
|---|---|---|
| **Get Closer** | their trust ≥ 50 | Relationship deepens: neutral → trust → romantic |
| **Keep Your Distance** | not rivals | Steps the relationship back — the only exit from an affair |
| **Corrupt Pact** | trust ≥ 60 | Skim money into your **personal funds** every turn. Discovery risk grows. The trail **never** resets. **Run several at once.** |
| **Launder the Trail** | active pact, personal ≥ 30M | −30M personal: roll the discovery clock back 3 turns and cool **scrutiny** |
| **Threaten** | their agenda ≥ 40, your approval ≥ 45 | Agenda −30 — or it backfires into the press. Third threat: they betray you on the spot |
| **Leak Dirt** | their agenda ≥ 50, personal ≥ 30M | Their agenda collapses (−40) — but the story splashes on you too. Journalist paid from personal funds |
| **Throw Under the Bus** | SCRUTINY ≥ 20 | They're finished; heat −10, +2% approval; your whole cabinet loses trust watching it |

### The lover arc

Going romantic pays **+4 trust/turn** and devoted lovers (trust ≥ 70) sometimes **tip you off**, killing a scandal before it prints. The price: a permanent **5%/turn exposure risk**, and love is *needy* — **~40% of turns they want something** (fund their project −30M, or a quiet favor +1 heat; refusing cools the relationship). **One lover only** — pursuing someone else turns the first into a scorned ex who may go public at worse severity. Breakups carry the same scorned risk. When exposure comes, the relationship's health decides the scene: a devoted lover stands beside you at the podium (penalty halved); a neglected one denies everything (full hit, instant rivalry). Sacrificing your lover to the press is the strongest heat purge in the game. The city will not forget that you did it.

### Crime partners are needy too

While a corrupt pact runs, your partner demands an answer **~40% of turns**: a **bigger cut** (pay 25M from personal funds, or refuse and the paper trail thickens) or **cold feet** (let the scheme lie low a turn — no skim, no risk — or push on and nervous hands get sloppy). A long, fat scheme (≥5 turns, ≥80M skimmed) can curdle into **blackmail of you**: pay their price for silence, or call their bluff — they betray you and the heat spikes (scrutiny +8). When a lover or partner is waiting on you, their advisor card shows a **red badge** and "needs an answer" — open the Messenger and deal with it. (The same badge marks an unread "I told you so" — pulsing red on the card, red dot on the mobile ADVISORS tab.)

### Personal funds — your off-books wallet

Separate from the city budget. It **starts at 30%** of the city's opening treasury (your turn-1 paycheck), and a **salary** of **4% of the city budget (minimum 1M)** lands on **turns 3, 5, 7, 9 and 11**. Every back-channel move — bribes, leaks, paying off a partner, laundering — is paid from this wallet, never the public budget. Corrupt **skims flow into it**. From the dispatch sidebar you can **donate** it back to the city treasury: **+1% approval** and a glowing front page next turn. The catch — money you pocket or burn on schemes is money that can't bail out the treasury when a crisis hits.

### Raids — corruption rides the SCRUTINY meter

There is **no separate watchdog meter**. Running schemes push your **SCRUTINY** up like every other dirty deed. Once the press is **INVESTIGATING** or you're **UNDER SIEGE**, investigators can **raid**: it blows open **every** active pact at once and **seizes half your slush**. The more pacts you run, the faster scrutiny climbs and the bigger the blast. Stay clean and scrutiny cools on its own; **Launder** or wind schemes down to keep it low.

---

## 5. Scandals

Scandals fire from bad luck (Settings: low 8% / normal 20% / high 38% per turn), from risky decisions, and from your own schemes. A pending scandal card offers:

- **SUPPRESS** — pay (20–150M by severity), it never runs
- **ACCEPT** — take the full approval hit
- **MANAGE THE STORY** — the base hit still lands, then your response shapes it: apologize, deny, fire someone, investigate...
- **Ignore it** — it auto-fires at full force next turn

**Career-ending scandals** cannot be suppressed or accepted: offer your resignation, or gamble 150M on a **Desperate Last Stand (25% survival)**. Surprise scandals (leaks, exposures, decision fallout) announce themselves with a popup explaining exactly why your approval just moved.

---

## 6. SCRUTINY (heat)

The city's memory of your sins. Every scandal raises it (minor +1 → career-ending +5); every black-market deal raises it; clean turns lower it by 1.

| Level | Effect |
|---|---|
| QUIET | Nothing. Not even shown. |
| MURMURS | Rumors in the feed |
| WATCHED | Scandal chance ×1.25 · **Address the Nation** unlocks |
| INVESTIGATED | ×1.5 · one-time audit (−20M) · black market prices +25% |
| UNDER SIEGE | ×2 · impeachment proceedings open · **3 turns here = recall** |

**Lowering it:** stay clean (−1/turn) · **Address the Nation** (once per term, from the dispatch: apologize −5% approval/−6 heat, go defiant +3%/+2 heat/15% scandal, or deflect onto "outside agitators") · **throw someone under the bus** · pay the black market's laundry services.

---

## 7. The Black Market

Some nights, **after you resolve the day's problem**, the market opens — more often when you're broke or hated, and it reads the news: the day's problem attracts the matching dealer. Offers expire at dawn.

Six dealer types: **Influence** (buy approval), **Intelligence** (control advisors), **Cleanup** (bury scandals, launder heat), **Insurance** (pre-pay for safety), **Sell-side** (sell the city for cash *into your own pocket*), and the **Dark Market** (war/extreme/hard cities only — the offers you shouldn't take, with payouts that explain why people do).

Every deal is **paid from (and paid into) your personal funds**, never the city budget — buying costs your own money, and **sell-side** offers pocket the proceeds of selling the city out from under it. Every deal adds heat, and every deal can go wrong at the printed odds. Everything is tallied for your final report.

---

## 8. Money, Unrest, Contracts

**Income:** tax each turn = city tax rate × approval%. Poor cities with hated governors starve.

**Deficit:** −3% approval per turn (−5% below −200M), and after 2 deficit turns, contract offers spike.

**Contracts:** business offers (lump sum or installments) with side effects and occasional scandal risk. Competing offers — pick one, the loser doesn't come back.

**Unrest:** brews when budget < 0 **and** approval < 37 — strikes, then demonstrations, then riots as approval falls. Pay them, face them down, or crack down (−18% approval and a real chance the violence becomes a scandal).

---

## 9. City Tiers

| Tier | Advisors | Tax base | Flavor |
|---|---|---|---|
| Easy | 5 | 80M | Stable. Your mistakes are your own. |
| Medium | 5 | 60M | Normal politics |
| Hard | 4 | 40M | Tight money, more dark-market access |
| Extreme | 3 | 25M | −1% approval/turn ambient decay |
| War | 3 | 15M | −2%/turn. The city is on fire before you arrive. |

Cities also differ in how they punish romance exposure, what scandals they carry, and how their public talks back.

---

## 10. The Report Card

At the end — however it ends — the report is headlined **"The [Your Name] Administration"** and shows your approval arc, domain grades, worst decision, **DIRTY HANDS** (everything you skimmed, threatened, leaked, and bought) or **CLEAN HANDS**, and **BACKROOM RELATIONS** — what really happened between you and each advisor. If a scandal forced you out (or crashed your approval to zero), a **WHY YOU RESIGNED** box names the exact scandal that ended you. History keeps receipts.

Every finished term is filed in **Settings → Stats → Past Administrations** — a running hall of your governors across every city, with each one's outcome and final approval.

---

## 11. Your Name & the Theme

**The city knows your name.** The name you enter at city select threads through the whole game: morning-paper headlines and gossip, the way advisors greet you (warmly, curtly, or coldly, depending on trust), the protest placards when the streets boil over, and the final report's title.

**Light or dark.** Settings → Display → **Theme** switches between the light "Paper Ledger" and the dark "Ink Slate" — both tuned for high contrast (readable in direct sunlight). Your choice is remembered between sessions, and the world map recolors to match.

---

## Tips

- **Read the paper.** The whisper column tells you who's plotting before the agenda bar does, and the editor's note tells you how close the press is to your throat.
- **Hours are your real currency.** A meeting that softens today's backlash is usually worth more than a third conversation with someone you already trust.
- **Never let your desk pile up.** Two undecided problems is a warning; three is a scandal generator and a lost invitation.
- Keep **one advisor above 70 trust** — intel warnings are the best early-warning system in the game.
- **Check the agenda bar before taking advice.** A restless advisor's recommendation may be a knife.
- Scandals are cheapest handled **immediately** — ignoring one fires it at full force.
- SCRUTINY is a debt. The black market lets you borrow against it; turn 10 is when the bill arrives.
- The corrupt pact's trail **never resets** (only fire can clean it). End schemes while they're still minor.
- A lover at high trust is the strongest passive defense in the game — and the single most expensive thing to lose.
- **Crackdown is almost never worth it.** Negotiate, or let Military marshal forces.
- On war tiers, money is oxygen: contracts and (if you dare) the dark market are how you breathe.
