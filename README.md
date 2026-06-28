# GOVERNED

> *Run the city. Hide the bodies. Smile for the cameras.*

**GOVERNED** is a browser-based political governance simulator. You are appointed governor of a city in crisis. Survive a 12-turn term — keep your approval above zero, manage scandals, balance the public budget and your own off-books wallet, and decide every turn how dirty your hands are willing to get.

Play it live → **[putra10.github.io/governed](https://putra10.github.io/governed/)**

---

## What It Is

A single-player strategy game where every decision has a cost. You govern one of **25 real cities** — from Singapore to Mogadishu, Guatemala City to Gaza — each with its own political culture, economic pressures, a cast of advisors with hidden agendas, and a public that has heard every promise before.

There are no right answers. SAFE is expensive, BOLD is risky, CHAOS is cheap and unhinged. The city remembers everything.

---

## Features

- **25 cities** across five difficulty tiers — Easy to War — each with unique crises, scandals, and advisor dynamics
- **Advisor back channel** — build trust, start affairs, run corrupt pacts, threaten, or sacrifice colleagues to save yourself
- **Personal funds** — an off-books wallet (30% starter + a salary on odd turns) that pays for every dirty move; corrupt skims flow in, and you can donate it back to the city for approval
- **Corrupt pacts & Civic Oversight** — run several skimming schemes at once for compounding income; an Oversight watchdog's suspicion climbs toward a raid that exposes them all, while partners can blackmail you and a fixer can launder the trail
- **SCRUTINY system** — a rolling heat meter that remembers every dirty deal; five levels from QUIET to UNDER SIEGE
- **Black market** — six dealer types offer influence, cleanup, intelligence, and things you probably shouldn't buy
- **Problem backlog** — ignore decisions and they pile up; ignore them too long and the press writes the story for you
- **Scandal management** — suppress, accept, or manage the story; career-ending scandals offer only resignation or a 25% last stand
- **Step down on your terms** — resign voluntarily any turn through your most trusted advisor, not a menu
- **The city knows your name** — your chosen name runs through headlines, advisor greetings, protest placards, and a final report titled *"The [You] Administration"*
- **Career hall** — every finished term is filed under Settings → Past Administrations, with its outcome and final approval
- **Light & dark themes** — a light "Paper Ledger" and a dark "Ink Slate," both high-contrast for sunlight, toggled in Settings; the world map recolors to match
- **Full end-of-term report** — dirty hands, clean hands, backroom relations, the scandal that ended you, and everything the city remembers

---

## Playable Cities

Currently, you can govern 25 diverse cities from around the world, each with tailored challenges and political landscapes:

- **North America:** New York City, San Francisco, Toronto
- **Central America:** Guatemala City, Cayman Islands
- **South America:** Caracas
- **Europe:** Frankfurt, Crimea
- **West Asia:** Erbil, Tehran
- **Arabian Peninsula:** Gaza, Tel Aviv, Jeddah
- **Africa:** Lagos, Johannesburg, Mogadishu
- **East Asia :** Beijing, Shenzhen, Tokyo, Vladivostok
- **South Asia :** Karachi
- **Nusantara Peninsula :** Singapore, Jakarta, Labuan Bajo
- **Oceania :** Brisbane

---

## Documentation

| Document | What's in it |
|---|---|
| [HOW TO PLAY](HOW_TO_PLAY.md) | Full player manual — mechanics, systems, tips |
| [Project Structure](GOVERNED_Project_Structure.md) | Architecture, engine modules, city JSON schema, public API |

---

## Project Structure (Short)

```
governed/
├── src/
│   ├── data/cities/        ← 25 city JSON files
│   ├── engine/             ← Pure game logic (no DOM)
│   ├── ui/                 ← Screens and components
│   └── styles/             ← Vanilla CSS design system
├── Hardcoded things/       ← Generic problem pools, black market offers
├── tests/                  ← Vitest engine suite
└── docs/                   ← Built output (GitHub Pages)
```

The engine never touches the DOM. All state lives in `game-state.js`; all rendering reads from it. See [GOVERNED_Project_Structure.md](GOVERNED_Project_Structure.md) for the full breakdown.

---

## Credits

**Game Design & Direction:** Hunt  
**Narrative & World Design:** Hunt  
**Interface Design:** Claude Opus 4.8  
**Engine Development:** Claude Sonnet 4.6, Kimi K2.6  

Development Assistance — AI Systems:
- Claude Fable 5, Claude Opus 4.8, Claude Opus 4.7, Claude Sonnet 4.6 (Anthropic)
- Gemini 3.1 Pro, Gemini 3.5 Flash (Google)
- GPT-5.5 (OpenAI)
- DeepSeek-V3 (DeepSeek)
- Kimi K2.6 (Moonshot AI)
- Qwen 3.7 Pro, Qwen 3.6 27B (Alibaba Cloud)

Built with Vite and vanilla JavaScript.

---

© 2026 Hunt. All rights reserved.
