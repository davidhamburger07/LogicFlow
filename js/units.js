// ============================================================
// units.js — the CAMPAIGN STRUCTURE layer (Duolingo-style).
//
// content.js stays the question source of truth (PHASES[] = the
// individual "lessons"). This file groups those phases into UNITS
// ordered easy -> hard, and marks where the cumulative MOCK exams sit.
//
// It is PURE TOPOLOGY + data (no progress, no DOM):
//   - which lessons (phase ids) belong to each unit, in order
//   - each unit ends with a Unit Test (implicit — every unit has one)
//   - some units are followed by a cumulative Mock exam
//
// storage.js turns this topology + the saved progress into lock/crown
// state (see getCampaignState); screens.js renders the path from that.
// Lessons reference phases by ID so this stays decoupled from the
// PHASES array order/indices (screens.js maps id -> index).
// ============================================================

export const UNITS = [
  { id: 1, name: 'DATA REPRESENTATION', color: '#2563EB',
    blurb: 'How computers store numbers, text, images and sound',
    lessons: [1, 25, 9, 3, 4, 10] },                   // Binary, Binary Arithmetic, Two's Comp, Hex, Hex Colours, Data Rep

  { id: 2, name: 'BOOLEAN LOGIC', color: '#7C3AED',
    blurb: 'The logic gates every CPU is built from',
    lessons: [2] },                                    // Logic Gates

  { id: 3, name: 'COMPUTER SYSTEMS', color: '#0891B2',
    blurb: 'The CPU, memory, storage and system software',
    lessons: [8, 14, 12, 13],                          // CPU & Memory, Storage, Systems SW, Languages
    mock: { id: 'mock1', name: 'MOCK EXAM 1' } },      // covers units 1–3

  { id: 4, name: 'NETWORKS & SECURITY', color: '#BE185D',
    blurb: 'How machines connect — and how data is kept safe',
    lessons: [5, 17, 7, 16] },                         // Networking, Networking II, Encryption, Cyber Sec

  { id: 5, name: 'ALGORITHMS', color: '#D97706',
    blurb: 'Computational thinking, searching and sorting',
    lessons: [23, 24, 6],                              // Computational Thinking, Searching, Sorting & Efficiency
    mock: { id: 'mock2', name: 'MOCK EXAM 2' } },      // covers units 1–5

  { id: 6, name: 'PROGRAMMING', color: '#15803D',
    blurb: 'Writing, tracing and debugging real code',
    lessons: [18, 19, 20, 21, 22] },                   // Programming I–IV, Robust Programs

  { id: 7, name: 'DATABASES & SQL', color: '#C026D3',
    blurb: 'Relational data and querying it with SQL',
    lessons: [15] },                                   // Databases & SQL

  { id: 8, name: 'IMPACTS OF TECHNOLOGY', color: '#475569',
    blurb: 'Ethics, law, the environment, and AI / emerging tech',
    lessons: [11, 26],                                 // Ethics & Impacts, AI & Emerging Tech
    mock: { id: 'mockFinal', name: 'FINAL MOCK EXAM' } }, // covers everything
];

// phase id -> the unit id it belongs to (null if unmapped)
const LESSON_UNIT = {};
UNITS.forEach(u => u.lessons.forEach(pid => { LESSON_UNIT[pid] = u.id; }));
export function unitIdOfLesson(phaseId) {
  return LESSON_UNIT[phaseId] != null ? LESSON_UNIT[phaseId] : null;
}

// the unit ids a mock-bearing unit's mock covers = every unit up to and
// including it (cumulative). Returns [] for a unit with no mock.
export function mockCovers(unitId) {
  const covered = [];
  for (const u of UNITS) {
    covered.push(u.id);
    if (u.id === unitId) break;
  }
  return covered;
}

// generic GCSE 9–1 grade from a percentage (motivational, not a real
// board boundary — those shift each series). Single source of truth so
// the mock results screen and storage agree.
export function gcseGrade(pct) {
  const p = Number(pct) || 0;
  if (p >= 90) return 9;
  if (p >= 80) return 8;
  if (p >= 70) return 7;
  if (p >= 60) return 6;
  if (p >= 50) return 5;
  if (p >= 40) return 4;
  if (p >= 30) return 3;
  if (p >= 20) return 2;
  return 1;
}
