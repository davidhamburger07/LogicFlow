# LOGICFLOW

**A browser-based revision game for GCSE Computer Science** — aligned to the **AQA**, **OCR**, and **Eduqas** specifications. Students learn each topic through short lessons and lock it in through active recall: answering questions, building circuits, turning cipher wheels, and tracing algorithms across ten topic "phases".

Built as an HTML5 title for release on **CrazyGames**. Clean, technical, circuit-diagram aesthetic — `Share Tech Mono`, a blue `#2563EB` "signal" colour, and a per-topic accent. Light and dark themes.

> **Every topic is free.** It's a revision tool first — gating core content would undermine the point.

---

## Features

- **10 topic phases** covering the core spec (see below), each with a taught lesson plus practice.
- **Eight question types through one extensible engine** — multiple choice and binary input as defaults, plus six bespoke, hands-on mini-games:
  - **CIRCUIT** — drag logic gates into a slot-based circuit and simulate it to hit a target output.
  - **CIPHER** — a rotatable two-ring Caesar wheel with live decoding.
  - **TRACE** — step through one pass of Bubble Sort, SWAP/KEEP per comparison.
  - **FDE** — an animated fetch–decode–execute CPU-cycle trace.
  - **PACKET** — route a packet across a network around downed links within a TTL hop budget.
  - **EXAM** — write an answer, reveal the mark scheme, and self-mark (Past Paper mode).
- **Procedurally generated questions** — every computational question (binary/hex/two's-complement conversions, logic-gate outputs, Caesar ciphers, bubble-sort traces, file-size calcs) generates a **fresh instance each load**, so there's no fixed answer to memorise. Factual/recall questions stay hand-authored.
- **Game modes:**
  - **Campaign** — a linear journey through all ten phases.
  - **Revision Hub** — jump to any topic, with mastery bars and needs-review flags.
  - **Arcade** — *Timed / Exam Rush* (per-question countdown), *Survival / Streak* (sudden-death cross-topic run), and *Past Paper* (self-marked exam papers on all ten topics).
- **Smart spaced repetition** — a Leitner-box scheduler grows review intervals for questions you miss (10 min → 1 day → 3 → 7 → 16 days) and graduates them once reliably recalled.
- **Question Bank** — a built-in review screen listing every question and answer across all topics (with rerollable samples for generated slots and full mark schemes) for content QA.
- **Light / Dark theme**, persisted and applied before first paint.

Grounded in learning science: **generative recall beats recognition**, **desirable difficulty** aids retention, and **spacing + retrieval** drive long-term memory — which is why the mini-games make you *produce* answers and why misses come back on a schedule.

### Topics

| # | Topic | Focus |
|---|-------|-------|
| 1 | Binary Basics | The language of all computers |
| 2 | Logic Gates | The decision-makers inside every CPU |
| 3 | Hexadecimal | Base 16 — the programmer's shorthand |
| 4 | Hex Colours | How screens mix red, green, and blue light |
| 5 | Networking | How computers communicate across the world |
| 6 | Algorithms | Sorting, searching, and computational thinking |
| 7 | Encryption | Keeping data safe in a connected world |
| 8 | CPU & Memory | Von Neumann architecture and the fetch–decode–execute cycle |
| 9 | Two's Complement | How computers represent negative numbers |
| 10 | Data Representation | ASCII, Unicode, images, sound, and compression |

---

## Tech stack

Plain **ES modules** — no framework, no bundler, no build step. The modular source is the source of truth; a single-file bundle is generated only when needed (e.g. for upload).

## Run locally

It's a multi-file ES-module project, so it **must be served over HTTP** — opening `index.html` as a `file://` URL makes browsers block the module scripts and every button goes dead.

```bash
# from the project root
node serve.mjs        # serves at http://localhost:3000
```

Or use any static server (e.g. `python3 -m http.server 8000`, or the VS Code **Live Server** extension), then open the served URL.

## Project structure

```
index.html         slim skeleton; loads js/main.js as a module
styles.css         all styles (CSS-variable theming, light + dark)
serve.mjs          tiny Node-core dev server
js/
  main.js          entry point: wires DOM, volume, theme; boots engine + screens
  engine.js        question flow + scoring + the question-type REGISTRY + launch contexts
  screens.js       navigation: main menu, campaign map, revision hub, arcade, question bank
  content.js       data: the 10 phases (lessons, questions, generator slots, exam papers)
  generators.js    procedural question generators (fresh instances)
  storage.js       persistence: per-topic mastery + Leitner spaced repetition + prefs
  visual.js        the read-only visual panel (circuit / swatch / sort)
  questions/       one module per question type (mc, binary, circuit, cipher, trace, fde, packet, exam)
```

**Extending the question types** is the key seam: add a module exporting `render(answerHost, question, ctx)`, register it in the engine's `REGISTRY`, and add questions of that `type` to `content.js` — the engine's flow code doesn't change.

---

## Status

All core gameplay is built and playable: the ten-phase campaign, the revision hub with spaced repetition, all three arcade modes, eight question types, procedurally generated practice, and past papers on every topic.

Deferred for later (the CrazyGames launch track): an energy/ads layer via the CrazyGames SDK, an optional depth-based premium tier (premium adds *depth*, never *access*), and Settings/Stats screens.
