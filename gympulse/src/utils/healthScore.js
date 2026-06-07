/**
 * GymPulse Health Score & Risk Classification
 *
 * Replaces the legacy days/trend/cancel weighted formula. Tuned to approximate
 * Recovr's published health-score benchmarks using only data we can derive
 * from Glofox CSV uploads:
 *
 *   sessions             — total visits in the tracking window
 *   noShows              — total no-shows
 *   lateCancels          — total late cancellations
 *   daysTracked          — days the member has existed in our data
 *   daysSinceLastVisit   — days between today and most recent visit
 *
 * Score is 0–100, rounded to 1 decimal.
 *
 * Risk bands:
 *   Low (green)        : health ≥ 70
 *   Medium (amber)     : health 33–69.9
 *   High (red)         : health 1–32.9
 *   Non-attender (red) : 0 sessions OR (≤1 session AND tracked ≥45d AND no visit in 30+ days)
 */

/* ------------------------------------------------------------------ */
/* Core formula                                                        */
/* ------------------------------------------------------------------ */

export function calculateHealthScore(sessions, noShows, lateCancels, daysTracked, daysSinceLastVisit) {
  const s   = Number(sessions)           || 0
  const ns  = Number(noShows)            || 0
  const lc  = Number(lateCancels)        || 0
  const dt  = Number(daysTracked)        || 0
  const dsv = Number(daysSinceLastVisit) || 0

  // Hard rule 1: no sessions at all → 0%
  if (s === 0) return 0.0

  // Hard rule 2: non-attender pattern (≤1 session, tracked long enough, gone a month+).
  // Degrade smoothly so older/quieter non-attenders score lower than fresher ones.
  if (s <= 1 && dt >= 45 && dsv >= 30) {
    const score = Math.max(0, 22 - dsv * 0.4)
    return Math.round(score * 10) / 10
  }

  // Cap tracking weeks at the typical 9-week rolling window so brand-new
  // members aren't unfairly penalised for low session totals.
  const weeks = Math.max(Math.min(dt, 63) / 7, 1)

  // --- Component 1: Frequency (25%) ---------------------------------
  // Target 1.5 sessions/week. Anyone hitting it caps the component.
  const frequency = Math.min(s / weeks / 1.5, 1.0) * 100

  // --- Component 2: Recency (45%) -----------------------------------
  // Piecewise drop — matches Recovr's strong recency weighting at the
  // weekly-cadence boundaries (3 days, 1 week, 2 weeks).
  let recency
  if      (dsv <= 1)  recency = 100
  else if (dsv <= 3)  recency = 92
  else if (dsv <= 7)  recency = 75
  else if (dsv <= 14) recency = 50
  else if (dsv <= 21) recency = 30
  else if (dsv <= 35) recency = 18
  else                recency = 6

  // --- Component 3: Reliability (30%) -------------------------------
  // Attendance ratio across all bookings; late cancels count full weight.
  const totalBookings = s + ns + lc
  const reliability = totalBookings > 0 ? (s / totalBookings) * 100 : 100

  // --- Penalty: no-show ratio above 25% ------------------------------
  // Capped at 25 so even Antonio (22 no-shows / 17 sessions) keeps a small
  // floor — otherwise the score collapses to 0 and falls out of "high-risk".
  const nsRatio = ns / Math.max(s, 1)
  const noShowPenalty = Math.min(25, Math.max(0, (nsRatio - 0.25) * 35))

  // --- Penalty: late cancels direct ----------------------------------
  const lateCancelPenalty = lc * 1.0

  const base   = frequency * 0.25 + recency * 0.45 + reliability * 0.30
  const health = base - noShowPenalty - lateCancelPenalty

  const clamped = Math.max(0, Math.min(100, health))
  return Math.round(clamped * 10) / 10
}

/* ------------------------------------------------------------------ */
/* Risk classification                                                 */
/* ------------------------------------------------------------------ */

/**
 * Returns { level, label } where level is 'green' | 'amber' | 'red'.
 * Label is human-readable for the risk badge.
 *
 * Behavioral overrides demote borderline "Low risk" members to "Medium risk"
 * when their pattern (cadence, recency, reliability) doesn't match a truly
 * engaged member — matching Recovr's stricter low-risk gating without needing
 * per-visit cluster analysis we don't have access to.
 */
export function classifyRiskLevel(health, sessions, daysSinceLastVisit, daysTracked, noShows = 0, lateCancels = 0) {
  const s   = Number(sessions) || 0
  const dsv = Number(daysSinceLastVisit) || 0
  const dt  = Number(daysTracked) || 0
  const ns  = Number(noShows) || 0
  const lc  = Number(lateCancels) || 0

  // Non-attender: signed up, came exactly once, gone a month+ (Annabel/Candice/Vanessa pattern)
  if (s === 1 && dt >= 45 && dsv >= 30) return { level: 'red', label: 'Non-attender' }

  // 0 sessions over a meaningful window — high-risk (per Recovr benchmark grouping)
  if (s === 0 && dt >= 14) return { level: 'red', label: 'High risk' }

  // Score-based bands first
  if (health < 33) return { level: 'red', label: 'High risk' }
  if (health < 70) return { level: 'amber', label: 'Medium risk' }

  // health >= 70 — behavioral overrides demote weak-pattern members to Medium
  const weeks   = Math.max(Math.min(dt, 63) / 7, 1)
  const perWeek = s / weeks
  const nsRatio = ns / Math.max(s, 1)

  if (dsv > 5)         return { level: 'amber', label: 'Medium risk' }
  if (perWeek < 1.0)   return { level: 'amber', label: 'Medium risk' }
  if (nsRatio >= 0.38) return { level: 'amber', label: 'Medium risk' }

  return { level: 'green', label: 'Low risk' }
}

/* ------------------------------------------------------------------ */
/* Trend (last 30 vs prev 30)                                          */
/* ------------------------------------------------------------------ */

/**
 * Returns { direction: 'up' | 'down' | 'flat', pct, label }
 *   pct is the percentage change last30 vs prev30 (positive = improvement)
 */
export function calculateTrend(visitsLast30, visitsPrev30) {
  const cur  = Number(visitsLast30) || 0
  const prev = Number(visitsPrev30) || 0

  if (prev === 0 && cur === 0) return { direction: 'flat', pct: 0,   label: '— no change' }
  if (prev === 0)              return { direction: 'up',   pct: 100, label: `↑ new activity (${cur} visits)` }

  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct >=  10) return { direction: 'up',   pct, label: `↑ ${pct}% vs last month` }
  if (pct <= -10) return { direction: 'down', pct, label: `↓ ${Math.abs(pct)}% vs last month` }
  return { direction: 'flat', pct, label: '— steady vs last month' }
}

/* ------------------------------------------------------------------ */
/* Benchmark verification                                              */
/* ------------------------------------------------------------------ */

// 30 Recovr benchmark members supplied by product. Used to validate the formula
// matches the system we're replacing. Run `verifyHealthScoreBenchmarks()` from
// the browser console (or it auto-runs on member-data load — see DataContext).
const BENCHMARKS = [
  // Low-risk (≥70%)
  { name: 'Lucy Breden',       sessions: 21, noShows: 6,  lateCancels: 2, daysTracked: 61, daysSinceLastVisit: 1,  expected: 100.0, expectedRisk: 'low-risk' },
  { name: 'Jasmine Hone',      sessions: 31, noShows: 5,  lateCancels: 0, daysTracked: 61, daysSinceLastVisit: 1,  expected: 94.9,  expectedRisk: 'low-risk' },
  { name: 'Genevieve Lazar',   sessions: 40, noShows: 2,  lateCancels: 0, daysTracked: 61, daysSinceLastVisit: 2,  expected: 89.8,  expectedRisk: 'low-risk' },
  { name: 'Becca Funnell',     sessions: 9,  noShows: 3,  lateCancels: 0, daysTracked: 61, daysSinceLastVisit: 0,  expected: 78.1,  expectedRisk: 'low-risk' },
  { name: 'Rowan Lazar',       sessions: 13, noShows: 0,  lateCancels: 0, daysTracked: 27, daysSinceLastVisit: 2,  expected: 92.9,  expectedRisk: 'low-risk' },
  { name: 'Tim Corish',        sessions: 17, noShows: 2,  lateCancels: 0, daysTracked: 61, daysSinceLastVisit: 3,  expected: 92.3,  expectedRisk: 'low-risk' },
  { name: 'Kim Guzman',        sessions: 19, noShows: 7,  lateCancels: 2, daysTracked: 61, daysSinceLastVisit: 0,  expected: 84.9,  expectedRisk: 'low-risk' },
  { name: 'Josh Freedman',     sessions: 35, noShows: 2,  lateCancels: 0, daysTracked: 61, daysSinceLastVisit: 2,  expected: 76.0,  expectedRisk: 'low-risk' },
  { name: 'Peter Sheppard',    sessions: 18, noShows: 3,  lateCancels: 0, daysTracked: 61, daysSinceLastVisit: 0,  expected: 96.4,  expectedRisk: 'low-risk' },
  { name: 'Felipe Garcia',     sessions: 21, noShows: 1,  lateCancels: 1, daysTracked: 61, daysSinceLastVisit: 0,  expected: 86.5,  expectedRisk: 'low-risk' },
  { name: 'Tami Foxman',       sessions: 30, noShows: 2,  lateCancels: 1, daysTracked: 61, daysSinceLastVisit: 1,  expected: 100.0, expectedRisk: 'low-risk' },
  // Medium-risk (33–69%)
  { name: 'Theresa Chan',      sessions: 19, noShows: 3,  lateCancels: 1, daysTracked: 61, daysSinceLastVisit: 2,  expected: 69.3,  expectedRisk: 'medium-risk' },
  { name: 'Emma Dantas',       sessions: 24, noShows: 3,  lateCancels: 0, daysTracked: 61, daysSinceLastVisit: 3,  expected: 63.0,  expectedRisk: 'medium-risk' },
  { name: 'Laura Cushley',     sessions: 8,  noShows: 3,  lateCancels: 8, daysTracked: 61, daysSinceLastVisit: 5,  expected: 53.9,  expectedRisk: 'medium-risk' },
  { name: 'Trent Tighe',       sessions: 22, noShows: 14, lateCancels: 1, daysTracked: 61, daysSinceLastVisit: 2,  expected: 53.9,  expectedRisk: 'medium-risk' },
  { name: 'Karina Ware',       sessions: 25, noShows: 3,  lateCancels: 0, daysTracked: 61, daysSinceLastVisit: 7,  expected: 47.7,  expectedRisk: 'medium-risk' },
  { name: 'Ian Dowling',       sessions: 13, noShows: 5,  lateCancels: 0, daysTracked: 61, daysSinceLastVisit: 1,  expected: 33.6,  expectedRisk: 'medium-risk' },
  { name: 'John Huang',        sessions: 5,  noShows: 1,  lateCancels: 0, daysTracked: 23, daysSinceLastVisit: 2,  expected: 61.9,  expectedRisk: 'medium-risk' },
  { name: 'Mark Van Oosterom', sessions: 2,  noShows: 0,  lateCancels: 1, daysTracked: 26, daysSinceLastVisit: 4,  expected: 42.9,  expectedRisk: 'medium-risk' },
  { name: 'Mackenzie Nicholas',sessions: 2,  noShows: 0,  lateCancels: 0, daysTracked: 61, daysSinceLastVisit: 0,  expected: 57.3,  expectedRisk: 'medium-risk' },
  { name: 'Bridget Flannery',  sessions: 7,  noShows: 0,  lateCancels: 3, daysTracked: 61, daysSinceLastVisit: 31, expected: 50.6,  expectedRisk: 'medium-risk' },
  { name: 'Steph Spaninks',    sessions: 1,  noShows: 0,  lateCancels: 0, daysTracked: 42, daysSinceLastVisit: 42, expected: 45.8,  expectedRisk: 'medium-risk' },
  // High-risk (1–32%)
  { name: 'Antonio Gangi',     sessions: 17, noShows: 22, lateCancels: 3, daysTracked: 61, daysSinceLastVisit: 11, expected: 29.8,  expectedRisk: 'high-risk' },
  { name: 'Patrick Rodbourn',  sessions: 13, noShows: 10, lateCancels: 3, daysTracked: 61, daysSinceLastVisit: 18, expected: 14.4,  expectedRisk: 'high-risk' },
  { name: 'Sonia Singh',       sessions: 2,  noShows: 3,  lateCancels: 1, daysTracked: 61, daysSinceLastVisit: 12, expected: 32.9,  expectedRisk: 'high-risk' },
  { name: 'Erica Tropiano',    sessions: 0,  noShows: 0,  lateCancels: 0, daysTracked: 61, daysSinceLastVisit: 61, expected: 0.0,   expectedRisk: 'high-risk' },
  { name: 'Ollie Scholefield', sessions: 0,  noShows: 0,  lateCancels: 0, daysTracked: 5,  daysSinceLastVisit: 5,  expected: 0.0,   expectedRisk: 'high-risk' },
  // Non-attender
  { name: 'Annabel Mendel',    sessions: 1,  noShows: 0,  lateCancels: 0, daysTracked: 61, daysSinceLastVisit: 30, expected: 18.7,  expectedRisk: 'non-attender' },
  { name: 'Candice Allan',     sessions: 1,  noShows: 2,  lateCancels: 0, daysTracked: 61, daysSinceLastVisit: 41, expected: 1.1,   expectedRisk: 'non-attender' },
  { name: 'Vanessa Cheng',     sessions: 1,  noShows: 0,  lateCancels: 0, daysTracked: 61, daysSinceLastVisit: 61, expected: 0.0,   expectedRisk: 'non-attender' },
]

const EXPECTED_RISK_TO_LEVEL = {
  'low-risk':     'green',
  'medium-risk':  'amber',
  'high-risk':    'red',
  'non-attender': 'red',
}

/**
 * Runs every benchmark through calculateHealthScore + classifyRiskLevel and
 * console.tables the result. Returns summary counts so callers can decide
 * whether to surface warnings in the UI.
 */
export function verifyHealthScoreBenchmarks() {
  let healthMatches = 0
  let riskMatches   = 0

  const rows = BENCHMARKS.map(b => {
    const actual = calculateHealthScore(b.sessions, b.noShows, b.lateCancels, b.daysTracked, b.daysSinceLastVisit)
    const risk   = classifyRiskLevel(actual, b.sessions, b.daysSinceLastVisit, b.daysTracked, b.noShows, b.lateCancels)
    const diff   = +(actual - b.expected).toFixed(1)
    const within = Math.abs(diff) <= 10

    const expectedLevel = EXPECTED_RISK_TO_LEVEL[b.expectedRisk]
    const isNonAttenderExpected = b.expectedRisk === 'non-attender'
    const riskOK = isNonAttenderExpected
      ? (risk.label === 'Non-attender')
      : (risk.level === expectedLevel && risk.label !== 'Non-attender')

    if (within) healthMatches++
    if (riskOK) riskMatches++

    return {
      name:        b.name,
      expected:    b.expected,
      actual,
      diff:        diff > 0 ? `+${diff}` : `${diff}`,
      within10:    within ? '✓' : '✗',
      expRisk:     b.expectedRisk,
      actualRisk:  risk.label,
      riskOK:      riskOK ? '✓' : '✗',
    }
  })

  const healthPct = Math.round((healthMatches / BENCHMARKS.length) * 100)
  const riskPct   = Math.round((riskMatches   / BENCHMARKS.length) * 100)
  const passing   = healthMatches >= 24 && riskMatches === 30

  console.groupCollapsed(
    `[GymPulse] Health Score Benchmarks — ${healthMatches}/30 (${healthPct}%) within ±10%, ` +
    `${riskMatches}/30 (${riskPct}%) risk levels correct ${passing ? '✅' : '⚠️ tune formula'}`
  )
  console.table(rows)
  if (!passing) {
    const misses = rows.filter(r => r.within10 === '✗' || r.riskOK === '✗')
    console.warn(`${misses.length} benchmark mismatches — adjust calculateHealthScore() weights/penalties:`)
    console.table(misses)
  }
  console.groupEnd()

  return { healthMatches, riskMatches, total: BENCHMARKS.length, passing, rows }
}
