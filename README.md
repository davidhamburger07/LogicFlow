# LogicFlow

A revision game for GCSE Computer Science. Ten topics — binary, logic gates, hex,
hex colours, networking, algorithms, encryption, CPU & memory, two's complement and
data representation — each taught with a short lesson, then drilled with questions
that make you *do* the thing rather than pick from a list: build the circuit, trace
the code, route the packet, crack the cipher, mark your own past-paper answer.

Play it here: https://logic-flow-plum.vercel.app

Pick your exam board (AQA, OCR, Eduqas, WJEC or Edexcel) and the content adjusts to
match — the pseudo-code notation, which logic gates you're expected to know, and so on.

## Running it locally

    node serve.mjs

then open http://localhost:3000. Any static server works; the one thing that doesn't
is opening index.html as a file:// URL, because the browser will block the ES modules.

No dependencies, no build step — plain ES modules throughout.

## How it's put together

- js/engine.js runs a question session. It looks up each question's type in a registry
  and hands rendering to that type's module in js/questions/ — there are 60+ of these
  now, from a slot-based logic-circuit builder to SQL building to a CPU
  fetch–decode–execute simulator. A new type is one module with a render() function
  plus a registry entry; the engine itself doesn't change.
- js/generators.js creates the computational questions fresh on every load (binary
  conversions, logic-gate outputs, file-size calculations...) so there's no fixed
  answer to memorise. Factual questions are hand-written in js/content.js.
- js/storage.js tracks mastery per topic and re-schedules missed questions at growing
  intervals (10 minutes, a day, 3 days...) — the revision hub is built on this.
- Campaign, the revision hub and the arcade modes (timed, survival, past papers) all
  run through the same engine with a different launch context.
- Accounts and cloud save run on Supabase. The key in js/config.js is the public anon
  key; the data behind it is protected by row-level security.

## Status

All ten topics are playable with lessons, questions, generated practice and past
papers, in light and dark themes. Built and maintained solo.
