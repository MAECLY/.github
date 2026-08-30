<div align="center">

# MAECLY

### Developer tools that don't lie.

**Local-first software for real frictions in a senior developer's day.**
Your activity never leaves your machine. What a tool doesn't know, it says — it doesn't fill the gap with a zero.

[maecly.com](https://www.maecly.com/) · [hola@maecly.com](mailto:hola@maecly.com) · Quito, Ecuador

</div>

---

## What we build

Every product here starts as a friction the author hit while working — writing standups by hand, printing 300 files in batches of 15, not being able to send one browser tab's audio to two speakers, having no public proof of private work — and none of them hand that friction to somebody else's server.

**MAECLY** = `MAEC` (Miguel Angel Esparza Calero) + `-ly`. Not *what* gets built — *how*.

---

## Products

| Product | What it does | Stack | Status |
|---|---|---|---|
| **[autostand](https://github.com/MAECLY/autostand)** | Your standup, written from what you actually did — reads your commits, PRs, AI coding sessions and notes, and files a structured standup every working day. | Tauri v2 · Rust · React | **v1.2.0** · MIT · [autostand.maecly.com](https://autostand.maecly.com) |
| **[ID Bridge IA](https://github.com/MAECLY/id-bridge-ia)** | Surfaces a tab's identity — `tabId`, `windowId`, `groupId`, `sessionId` — so browser agents know where they're operating. | WXT · TypeScript · MV3 | **Published** · [Chrome Web Store](https://chromewebstore.google.com/detail/id-bridge-ia/knfgphmhijlbgdjhcciofodedgdifpij) · [site](https://id-bridge-ia.maecly.com/) |
| **[Xbox for Windows](https://github.com/MAECLY/stream-deck-windows-xbox-settings)** | Stream Deck plugin: toggle Windows 11 Game Mode and the Xbox Game Bar button. ES/EN, no admin rights. | TypeScript · C# · Stream Deck SDK | **v1.1.2** · MIT |
| **OpenDesign** | Open-source, local-first design tool. Native bundles for macOS, Windows and Linux, signed updates, stable and beta channels. | Tauri · Rust · React | In development · GPL-3.0 |
| **MaeclyPrint** | Batch printing for Windows and macOS. No 15-file limit, no Adobe required, no $149 license fee. | Tauri 2 · Rust · React | Pre-alpha · GPL-3.0 |
| **[WorklyReel](https://github.com/MAECLY/workly-reel-landing)** | Developer Proof-of-Work: turns private development activity into credible public proof, without handing the work to a service. | Tauri v2 · Rust · Next.js | Phase 0 · [workly-reel.maecly.com](https://workly-reel.maecly.com) |
| **Aurenly** | Sends the audio of *one* Chrome tab to the devices you actually listen on — not the whole system output. | Swift · CoreAudio · MV3 · Astro | Paused |

*Some repositories are private while the product is in development.*

---

## How we build

Five things are true of every product in this org.

**1 · Local-first, zero telemetry.** No application here makes a network request of its own. No cloud, no account, no analytics. `autostand`: *"Nothing leaves your machine unless you point it at a provider yourself."*

**2 · Honesty is a tested property, not a promise.** The marketing site for a product cannot claim what engineering hasn't proven — there is a CI check that fails the build if it tries. A value nobody reported reads *No data*, never `0%`. A source that failed is stored and displayed differently from a quiet day. Release state is modelled as a discriminated union, so linking to a download that doesn't exist is a type error rather than a broken link.

**3 · Docs-first, with ADRs.** Vision, requirements, architecture, decision records and a milestone roadmap live in `docs/` before the code does.

**4 · Design systems are versioned dependencies.** Tokens compile to CSS custom properties, JSON, typed TS — and to a Swift package for the native surfaces. Documented in Storybook, with contract tests that fail on drift.

**5 · One CI gate.** `pnpm verify` runs lint, typecheck, build and tests *in the order CI runs them*, so a local failure reads exactly like a remote one.

---

## Stack

`Rust` · `Tauri v2` · `TypeScript` · `React 19` · `Next.js 15/16` · `Astro` · `Swift` · `Tailwind v4` · `Radix` · `Storybook` · `WXT / MV3` · `pnpm` · `Vitest` · `Playwright` · `GitHub Actions`

Roughly half Rust, half TypeScript — desktop applications with web UIs, not websites.

---

## Contributing

Issues, translations, tests and fixes are welcome on the open-source products. Each repository carries its own `CONTRIBUTING.md`, `SECURITY.md` and `CODE_OF_CONDUCT.md`; read those first. Security reports go through the repository's `SECURITY.md`, never a public issue.

---

<div align="center">

**MAECLY** · Miguel Angel Esparza Calero
[maecly.com](https://www.maecly.com/) · [hola@maecly.com](mailto:hola@maecly.com)

</div>
