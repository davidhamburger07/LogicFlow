# LOGICFLOW — GCSE Computer Science Spec Coverage Checklist

> Planning artifact. Maps the **union of all four exam-board specifications** (AQA 8525,
> OCR J277, Pearson Edexcel 1CP2, Eduqas/WJEC) against the game's content, so we can see
> exactly what's covered, thin, or missing — and build to full coverage deliberately.
>
> **The official spec PDFs are the source of truth** (links at the end). This checklist is a
> synthesised overview; verify board-specific fine detail (exact protocol lists, which
> compression algorithms, specific legislation) against the PDFs when building each phase.

**Legend:** ✓ covered well · ◐ partial / thin, needs expansion · ✗ missing entirely
**Boards:** "All" = required by all four. Exceptions called out.

---

## Recommended primary target: AQA 8525

Build the content spine to **AQA 8525** (new spec, first teaching Sept 2025), for three
reasons: it's the most-entered GCSE CS board in England; its 8-topic structure is the most
comprehensive (it's the only board that names **Databases & SQL** as a standalone topic, so
building to it naturally covers the others); and ~90% of content is shared across all four
boards anyway. Keep tagging each question by board (the game already does this) so students
can filter to theirs later, and treat the few board-specific items (flagged below) as tagged
extras rather than separate tracks.

---

## At-a-glance

| # | Topic area | Boards | Now | Build action |
|---|------------|--------|-----|--------------|
| A | Data representation | All | ✓ | **Full coverage** — binary, hex, two's comp, binary arithmetic, units, characters, images, sound, compression |
| B | Boolean logic | All | ✓ | **Built** — phase 2 (gates, NAND/NOR, truth-table completion, Boolean expressions, multi-gate circuits) |
| C | CPU / architecture | All | ✓ | **Full coverage** — components, von Neumann, FDE, performance, embedded systems |
| D | Memory & storage | All | ✓ | **Built** — phase 14 (MC, secondary storage) |
| E | Systems software / OS | All | ✓ | **Built** — phase 12 (MC) |
| F | Languages & translators / IDEs | All | ✓ | **Built** — phase 13 (MC) |
| G | Networks | All | ✓ | **Built** — phase 5 + phase 17 (MC) |
| H | Cyber security | All | ✓ | **Built** — phase 7 + phase 16 (MC) |
| I | Algorithms & computational thinking | All | ✓ | **Built** — phases 6, 23, 24 (computational thinking, linear+binary search, bubble/merge/insertion sort, Big-O); trace tables/flowcharts minor remaining |
| J | Programming fundamentals | All | ✓ | **Built** — phases 18–21 (Programming I–IV); computational traces now procedurally generated (6 gen slots) |
| K | Producing robust programs | All | ✓ | **Built** — phase 22 (CODE_BUG/MC) |
| L | Databases & SQL | AQA (others lighter) | ✓ | **Built** — phase 15 (MC) |
| M | Ethical / legal / environmental impacts | All | ✓ | **Built** — phase 11 (MC) |

**Headline (UPDATED):** the **programming strand (J + K)** — roughly *half* of every qualification and
the *whole* on-screen exam for Edexcel/Eduqas — is now **BUILT** as interactive phases 18–22
(PROGRAMMING I–IV + ROBUST PROGRAMS), with four bespoke code question types (trace / fill / build /
spot-the-bug) and **board-specific notation** (AQA pseudo-code / OCR ERL / Python). The
data-representation, hardware, networking, security and other knowledge topics are also covered.

---

## Detailed breakdown

### A — Data representation · ✓ (All boards)
- ✓ Binary ↔ denary, place values — *phase 1*
- ✓ Hexadecimal ↔ binary ↔ denary — *phase 3*
- ✓ Two's complement / negative numbers — *phase 9* (AQA, OCR, Edexcel; lighter in Eduqas)
- ✓ Binary arithmetic — addition, binary shifts (left/right), overflow — *phase 25 (BINARY ARITHMETIC; generated)*
- ✓ Units of data — bit, nibble, byte, kB, MB, GB + conversions (decimal/1000 convention) — *phase 1 (generated)*
- ✓ Characters — ASCII, Unicode — *phase 10*
- ✓ Images — pixels, resolution, colour depth, metadata, file-size calc — *phases 4, 10*
- ✓ Sound — sampling, sample rate, bit depth, file-size calc — *phase 10 (generated sound file-size + sampling/sample-rate/bit-depth concepts)*
- ✓ Compression — lossy vs lossless, RLE — *phase 10* (Huffman: Edexcel/some — verify)

### B — Boolean logic · ✓ (All boards)
- ✓ Gates: AND, OR, NOT, XOR — *phase 2*
- ✓ NAND / NOR — *phase 2* (definitions + behaviour)
- ✓ Truth tables as completion exercises — *phase 2 (generated `boolTable`)*
- ✓ Logic expressions / Boolean notation (e.g. `Q = A AND (NOT B)`) — *phase 2 (generated truth tables of expressions + authored expression reading)*
- ✓ Combining gates into multi-gate circuits — *phase 2 (2-gate CIRCUIT build)*

### C — CPU / architecture · ✓ (All boards)
- ✓ CPU components — ALU, CU, registers, cache — *phase 8*
- ✓ Von Neumann architecture — *phase 8 (explicit question: instructions + data in shared memory)*
- ✓ Fetch-decode-execute cycle — *phase 8* (interactive FDE trace mini-game)
- ✓ Performance factors — clock speed, cores, cache — *phase 8*
- ✓ Embedded systems — definition, examples, characteristics — *phase 8*

### D — Memory & storage · ✓ (All boards)
*Secondary storage + virtual memory built as MC content in **phase 14 (STORAGE)**, 8 questions.*
- ✓ RAM vs ROM, volatile / non-volatile — *phase 8 + phase 14*
- ◐ Virtual memory *(phase 14)*; cache role — *thin*
- ✓ **Secondary storage** — magnetic (HDD), optical, solid-state (SSD/flash) — *phase 14*
- ✓ Storage characteristics — capacity, speed, durability, portability, cost — and choosing storage — *phase 14*

### E — Systems software / operating systems · ✓ (All boards)
*Built as MC content in **phase 12 (SYSTEMS SOFTWARE)**, 8 questions.*
- ✓ OS functions — role of the OS, memory, peripheral/device (drivers), user and file management — *phase 12*
- ✓ Utility software — defragmentation, compression, backup, encryption — *phase 12*
- ◐ (OCR) drivers *(phase 12)*; interrupts — *not yet*

### F — Programming languages & translators / IDEs · ✓ (All boards)
*Built as MC content in **phase 13 (LANGUAGES & TRANSLATORS)**, 8 questions.*
- ✓ High-level vs low-level (machine code, assembly) languages — *phase 13*
- ✓ Translators — compiler, interpreter, assembler, and their differences — *phase 13*
- ✓ IDE features — editor, error diagnostics / debugging tools, run-time environment, translator — *phase 13*

### G — Networks · ✓ (All boards)
*Basics in phase 5; topologies / hardware / protocols / layers added as MC in **phase 17 (NETWORKING II)**.*
- ✓ LAN / WAN — *phase 5*
- ✓ Client-server vs peer-to-peer — *phase 17*
- ✓ Hardware — router *(phase 5)*; switch, WAP — *phase 17* (NIC mentioned)
- ✓ Topologies — star (mesh mentioned) — *phase 17*
- ◐ Wired vs wireless — Wi-Fi / WAP *(phase 17)*; Ethernet detail, frequency/channels — *thin*
- ✓ Addressing — DNS *(phase 5)*; IP vs MAC *(phase 17)*; DHCP — *not yet*
- ✓ Protocols — HTTP/HTTPS *(phase 5)*; SMTP, IMAP/POP, FTP *(phase 17)*; TCP/UDP mentioned
- ✓ Layers — the TCP/IP / layered model and why layering is used — *phase 17*
- ✓ Packet switching *(phase 5)*; bandwidth *(phase 17)*; latency mentioned

### H — Cyber security · ✓ (All boards)
*Encryption in phase 7; threat taxonomy + prevention added as MC in **phase 16 (CYBER SECURITY)**.*
- ✓ Encryption — Caesar cipher, symmetric vs asymmetric — *phase 7*
- ✓ Threats — phishing/DDoS/SQLi *(phase 7)*; malware taxonomy (virus, worm, trojan, ransomware, spyware) + social engineering (shouldering, blagging) + brute force — *phase 16*
- ✓ **Prevention** — firewalls, user access levels, penetration testing *(phase 16)*; anti-malware / policies / physical security mentioned
- ◐ Network forensics / MAC filtering — *not yet*

### I — Algorithms & computational thinking · ✓ (All boards)
*Unit 5 is now a 3-lesson unit: COMPUTATIONAL THINKING (phase 23), SEARCHING (phase 24), SORTING & EFFICIENCY (phase 6).*
- ✓ Computational thinking — abstraction, decomposition, algorithmic thinking, pattern recognition — *phase 23*
- ✓ Searching — **linear search** + binary search (mechanics, precondition, comparison counts) — *phase 24* (+ efficiency in phase 6)
- ✓ Sorting — bubble (interactive trace), **merge**, **insertion** — *phase 6*
- ✓ Efficiency / comparing algorithms — Big-O: O(n), O(log n), O(n²), O(n log n) — *phase 6*
- ◐ Pseudocode & flowcharts — programming notation covered in phases 18–22; a dedicated **flowchart-reading** type would round this out
- ◐ Trace tables — CODE_TRACE covers "what does this output"; a dedicated **trace-table fill** type still to add

### J — Programming fundamentals · ◐ (All boards) — **HIGHEST PRIORITY**
*≈ half of every spec; the entire on-screen Paper 2 for Edexcel & Eduqas.*
*Strand STARTED: **phase 18 (PROGRAMMING I)** introduces the new **CODE_TRACE** question type (read a program → TYPE its output, not multiple choice), covering variables, operators (incl. MOD/DIV), sequence, basic selection & iteration, and string concatenation. The code renders in the player's chosen board notation — **AQA pseudo-code / OCR reference language / Python (Eduqas)** — via a board switcher on the main menu (persisted); the trace answer is authored once. CODE_TRACE + CODE_FILL + CODE_BUILD (Parsons drag-to-order) types are built across **PROGRAMMING I–IV** (phases 18–21): I fundamentals (10 Qs), II selection & iteration (8), III subroutines & scope (8), IV arrays & strings (8). Remaining of J: file handling + random numbers (minor). Remaining of the strand: the CODE_BUG type + ROBUST PROGRAMS (K), and later a pseudocode evaluator for procedural generation.*
- ✗ Variables & constants
- ✗ Data types — integer, real/float, Boolean, character, string
- ✗ Operators — arithmetic (`+ - * / DIV MOD`), comparison, Boolean (AND/OR/NOT)
- ✗ Sequence
- ✗ Selection — `if / else if / else`, nested, `switch/case`
- ✗ Iteration — count-controlled (`for`), condition-controlled (`while`, `repeat-until`)
- ✗ Subroutines — procedures vs functions, parameters, return values, local vs global scope
- ✗ Arrays / lists — 1D and 2D; records
- ✗ String manipulation — length, substring, concatenation, case conversion, character position
- ✗ File handling — open, read, write, close
- ✗ Input / output
- ✗ Random number generation
- ✗ SQL within programs (see L)

### K — Producing robust programs · ✓ (All boards)
*Built as **phase 22 (ROBUST PROGRAMS)** using the new CODE_BUG (spot-the-bug) type + MC.*
- ◐ Defensive design — input sanitisation touched via validation — *phase 22*
- ✓ Input validation (range, type, presence, length, format) — *phase 22*
- ✗ Authentication — *not yet*
- ✓ Maintainability — comments, meaningful naming, indentation, sub-programs — *phase 22*
- ✓ Testing — normal, boundary, erroneous/invalid data — *phase 22* (iterative vs terminal: thin)
- ✓ Error types — syntax, logic, runtime — and finding them (CODE_BUG) — *phase 22*
- ◐ Trace tables for debugging — via CODE_TRACE / CODE_BUG — *phases 18–22*

### L — Databases & SQL · ✓ (AQA names this; Edexcel/Eduqas lighter; OCR embeds SQL minimally)
*Built as MC content in **phase 15 (DATABASES & SQL)**, 8 questions, tagged AQA · Eduqas.*
- ✓ Relational concepts — tables, records, fields, primary key, foreign key — *phase 15*
- ✓ Flat-file vs relational — *phase 15*
- ✓ SQL — `SELECT … FROM … WHERE`, `ORDER BY`, `INSERT INTO` — *phase 15* (wildcards / `AND` / `OR` mentioned, not yet a dedicated question)

### M — Ethical, legal, cultural & environmental impacts · ✓ (All boards)
*Pure-knowledge topic, examined on every paper — built as MC content in **phase 11 (ETHICS & IMPACTS)**, 8 questions.*
- ✓ Legislation — Data Protection Act 2018 / UK GDPR, Computer Misuse Act 1990, Copyright Designs and Patents Act 1988 — *phase 11* (Freedom of Information used as a distractor)
- ✓ Privacy & data collection — *phase 11*
- ✓ Environmental — e-waste *(phase 11)*; energy consumption / manufacturing covered in the lesson
- ✓ Cultural / social — digital divide, impact on employment — *phase 11*; accessibility in the lesson
- ✓ AI / machine learning, emerging tech (IoT), and AI ethics (bias, automation/jobs) — *phase 26 (AI & EMERGING TECH); a newer-spec emphasis, esp. WJEC 2025*
- ✓ Open-source vs proprietary software; licensing — *phase 11*

---

## Proposed phase roadmap (current 10 → full coverage)

Marked **KEEP** / **EXPAND** / **NEW**. This grows the game from 10 to ~19 phases — appropriate
for a complete revision tool, and not all need building at once (priority order below).

1. Binary Basics — **KEEP**
2. Boolean Logic — **EXPAND** (was Logic Gates: + truth tables, expressions, combining)
3. Hexadecimal — **KEEP**
4. Data Representation — **EXPAND/MERGE** (Hex Colours + phase 10 + units + binary arithmetic + sound)
5. Two's Complement — **KEEP**
6. CPU & Architecture — **EXPAND** (+ embedded systems, explicit von Neumann)
7. Memory & Storage — **NEW/EXPAND** · ✓ **BUILT** as phase id 14 (secondary storage + virtual memory; RAM/ROM already in phase 8)
8. Systems Software — **NEW** · ✓ **BUILT** as phase id 12 (MC) (OS functions, utility software)
9. Languages & Translators — **NEW** · ✓ **BUILT** as phase id 13 (MC) (high/low level, compiler/interpreter/assembler, IDEs)
10. Networks — **EXPAND** (topologies, full protocols, layers, wired/wireless, addressing) · ✓ **BUILT** as phase id 17 (NETWORKING II, MC)
11. Cyber Security — **EXPAND** (was Encryption: + threat taxonomy + prevention) · ✓ **BUILT** as phase id 16 (MC)
12. Algorithms & Computational Thinking — **EXPAND** (searching, sorting, trace tables, pseudocode/flowcharts, abstraction/decomposition)
13. Programming 1 — **NEW** · ◐ **STARTED** as phase id 18 (PROGRAMMING I — CODE_TRACE type, AQA notation)
14. Programming 2 — **NEW** (selection & iteration)
15. Programming 3 — **NEW** (subroutines, parameters, scope)
16. Programming 4 — **NEW** (arrays, records, strings, files)
17. Producing Robust Programs — **NEW** (validation, testing, errors, trace tables) · ✓ **BUILT** as phase id 22 (CODE_BUG + MC)
18. Databases & SQL — **NEW** (AQA-tagged) · ✓ **BUILT** as phase id 15 (MC)
19. Ethics, Law & Impacts — **NEW** · ✓ **BUILT** as phase id 11 (MC content, no mini-game)

### Suggested build priority (by exam weight + effort)
1. **Programming 1–4 + Producing Robust Programs** (13–17) — biggest exam weight, entire Paper 2 for two boards. The game's generative mini-game style fits this perfectly: drag code blocks to build a loop, trace a loop's output, spot-the-bug, complete the `if`.
2. **Algorithms & Computational Thinking** (12) — pairs naturally with programming; trace tables + the sort-trace mini-game already planned.
3. **Ethics, Law & Impacts** (19) — fast to author (pure knowledge), examined everywhere.
4. **Databases & SQL** (18) — discrete, AQA-weighted.
5. **Systems Software, Memory & Storage, Languages & Translators** (7–9) — discrete knowledge topics.
6. **Networks & Cyber Security expansion** (10–11) — round out what exists.
7. **Boolean / CPU / Data Rep top-ups** (2, 6, 4) — smaller gaps in already-strong areas.

---

## Coursework / NEA note (for any "coursework help" feature)

> **Update:** a **`CODE_WRITE`** question type now exists (`js/questions/codewrite.js`) — the
> student writes a full program in an editor, reveals a board-specific model answer + mark
> scheme, and self-marks against the rubric (no interpreter; the rubric/self-mark approach the
> on-screen exams + NEA use). Live across **every programming phase 18–22**: 18 (even/odd),
> 19 (loop sum), 20 (an `area` subroutine that returns), 21 (largest-in-array), 22 (input
> validation) — selection, iteration, subroutines, arrays and validation all covered.

- **England (AQA, OCR, Edexcel, Eduqas):** no graded coursework. Programming is assessed by exam
  — written (AQA, OCR) or **on-screen Python** (Edexcel Paper 2, Eduqas Component 2). So "coursework
  help" for these students = practical programming skills (covered by phases 13–17 above), with
  extra value in mimicking the on-screen Python exam style.
- **Wales (WJEC only):** the **one board with a graded NEA** — a programming project: analyse →
  design → implement → test strategy → test → evaluate / suggest improvements. A coursework-help
  feature would scaffold *that lifecycle* (how to write the analysis, design a test plan, document
  testing) rather than do the project. Keep it skills/guidance-based, never the project itself.

---

## Authoritative sources (the real material)
- **AQA 8525** — aqa.org.uk/8525 *(use the new spec, first teaching Sept 2025)*
- **OCR J277** — ocr.org.uk/j277
- **Pearson Edexcel 1CP2** — qualifications.pearson.com (Computer Science 2020)
- **Eduqas** — eduqas.co.uk/qualifications/computer-science-gcse
- **WJEC (Wales)** — wjec.co.uk

*Each board publishes the full subject-content list, sample assessment materials, and (crucially
for programming) its own pseudocode / programming-language-subset reference. Pull each board's
pseudocode guide before authoring programming and algorithm questions, since the exams present
code in that board's specific notation.*
