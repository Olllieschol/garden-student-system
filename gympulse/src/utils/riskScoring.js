import { differenceInDays, parseISO } from 'date-fns'
import {
  calculateHealthScore,
  classifyRiskLevel,
  calculateTrend,
} from './healthScore'

/**
 * Risk + health scoring entry point.
 *
 * Health is computed by the tuned formula in healthScore.js, which is
 * validated against 30 Recovr benchmark members. The risk band is derived
 * directly from the health score (with special-case non-attender handling).
 *
 * Returns an enriched member object with:
 *   risk_level, risk_label, risk_reason
 *   health_score
 *   trend  : { direction, pct, label }
 *   days_since_last_visit, visit_change_pct
 */

// CSV-supplied risk levels (e.g. Recovr export) still take precedence over the calculation.
const CSV_RISK_MAP = {
  'high-risk':    { level: 'red',   label: 'High risk' },
  'non-attender': { level: 'red',   label: 'Non-attender' },
  'medium-risk':  { level: 'amber', label: 'Medium risk' },
  'low-risk':     { level: 'green', label: 'Low risk' },
  'at-risk':      { level: 'red',   label: 'At risk' },
  'at risk':      { level: 'red',   label: 'At risk' },
  high:           { level: 'red',   label: 'High risk' },
  medium:         { level: 'amber', label: 'Medium risk' },
  low:            { level: 'green', label: 'Low risk' },
}

function daysSince(dateStr) {
  if (!dateStr) return 999
  try {
    const d = parseISO(dateStr)
    return differenceInDays(new Date(), d)
  } catch {
    return 999
  }
}

/**
 * Score a single member. Computes health, risk, and trend.
 */
export function scoreMember(member /*, thresholds — kept for back-compat, unused */) {
  const sessions    = Number(member.total_sessions)        || Number(member.total_visits) || 0
  const noShows     = Number(member.no_shows)              || Number(member.no_shows_last_30_days) || 0
  const lateCancels = Number(member.late_cancels)          || Number(member.cancellations_last_30_days) || 0

  // days_since_last_visit: prefer the enriched value, else derive from last_visit_date
  const dsv = member.days_since_last_visit != null
    ? Number(member.days_since_last_visit)
    : daysSince(member.last_visit_date)

  // days_tracked: prefer enriched value, else derive from join_date / first_seen_date
  const dt = member.days_tracked != null
    ? Number(member.days_tracked)
    : Math.max(daysSince(member.join_date), daysSince(member.first_seen_date))

  const visitsNow  = Number(member.visits_last_30_days) || 0
  const visitsPrev = Number(member.visits_prev_30_days) || 0
  const trend      = calculateTrend(visitsNow, visitsPrev)
  const visitChangePct = visitsPrev > 0
    ? Math.round(((visitsPrev - visitsNow) / visitsPrev) * 100)
    : 0

  // CSV-provided risk wins (e.g. straight from Recovr export)
  if (member.csv_risk_level) {
    const mapped = CSV_RISK_MAP[member.csv_risk_level]
    if (mapped) {
      const health = calculateHealthScore(sessions, noShows, lateCancels, dt, dsv)
      return {
        risk_level:            mapped.level,
        risk_label:            mapped.label,
        risk_reason:           buildReason(mapped.label, dsv, sessions, noShows, lateCancels, trend),
        health_score:          health,
        trend,
        days_since_last_visit: dsv,
        visit_change_pct:      visitChangePct,
      }
    }
  }

  const health = calculateHealthScore(sessions, noShows, lateCancels, dt, dsv)
  const risk   = classifyRiskLevel(health, sessions, dsv, dt, noShows, lateCancels)

  return {
    risk_level:            risk.level,
    risk_label:            risk.label,
    risk_reason:           buildReason(risk.label, dsv, sessions, noShows, lateCancels, trend),
    health_score:          health,
    trend,
    days_since_last_visit: dsv,
    visit_change_pct:      visitChangePct,
  }
}

function buildReason(label, dsv, sessions, noShows, lateCancels, trend) {
  if (label === 'Non-attender') {
    if (sessions === 0) return 'Has never attended a session'
    return `Only ${sessions} session${sessions === 1 ? '' : 's'} in tracking period`
  }

  const parts = []
  if (dsv >= 21)      parts.push(`Hasn't visited in ${dsv} days`)
  else if (dsv >= 14) parts.push(`Last visited ${dsv} days ago`)
  else if (dsv === 0) parts.push('Visited today')
  else                parts.push(`Last visited ${dsv} day${dsv === 1 ? '' : 's'} ago`)

  if (noShows >= 5)        parts.push(`${noShows} no-shows`)
  else if (lateCancels >= 3) parts.push(`${lateCancels} late cancellations`)

  if (trend.direction === 'down' && trend.pct <= -30) parts.push(trend.label)

  return parts.join(' · ')
}

/**
 * Score every member in the array. Returns enriched copies.
 */
export function scoreAllMembers(members /*, thresholds */) {
  if (!members) return members
  return members.map(m => ({ ...m, ...scoreMember(m) }))
}

/**
 * Public alias for back-compat — components import `healthScore` from this file.
 */
export function healthScore(member) {
  if (member.health_score != null) return member.health_score
  const result = scoreMember(member)
  return result.health_score
}

/**
 * Engagement score (kept for back-compat). Bias toward visits, hurt by no-shows / cancels / drop.
 */
export function engagementScore(member) {
  const visits  = Number(member.visits_last_30_days)        || 0
  const cancels = Number(member.cancellations_last_30_days) || Number(member.late_cancels) || 0
  const noShows = Number(member.no_shows_last_30_days)      || Number(member.no_shows)     || 0
  const drop    = member.visit_change_pct || 0

  let score = Math.min(100, visits * 5)
  score -= cancels * 8
  score -= noShows * 10
  score -= Math.max(0, drop) * 0.5
  return Math.max(0, Math.round(score))
}
