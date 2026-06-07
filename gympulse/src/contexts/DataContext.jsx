import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { scoreAllMembers } from '../utils/riskScoring'
import { verifyHealthScoreBenchmarks } from '../utils/healthScore'
import { normalizeKey } from '../utils/csvParser'
import { DEMO_MEMBERS, DEMO_LEADS, DEMO_OUTREACH } from '../utils/demoData'

const DataContext = createContext(null)

const MEMBERS_KEY      = 'gympulse_members'
const VISIT_LOG_KEY    = 'gympulse_visit_log'
const NOSHOWS_KEY      = 'gympulse_noshows'
const LATECANCELS_KEY  = 'gympulse_latecancels'
const OUTREACH_KEY     = 'gympulse_outreach'
const CONTACT_LOG_KEY  = 'gympulse_contact_log'
const LEADS_KEY        = 'gympulse_leads'
const THRESHOLDS_KEY   = 'gympulse_thresholds'
const SETTINGS_KEY     = 'gympulse_settings'

const DEFAULT_THRESHOLDS = { amberDays: 14, redDays: 21, amberDropPct: 30, redDropPct: 60 }
const DEFAULT_SETTINGS = {
  gymName: 'GymPulse', coachName: 'Coach Alex', apiKey: '',
  businessType: 'CrossFit Box',
  customerName: 'member',
  aiTone: 'friendly',
  aiGuidelines: '',
  businessDescription: '',
}

function loadLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback }
  catch { return fallback }
}
function saveLS(key, value) { localStorage.setItem(key, JSON.stringify(value)) }

// ── Pure helpers (module-level, no React deps) ────────────────────────────────

/**
 * Compute per-member stats from the full stored visit log.
 * Returns Map<normalizedName, { last30, prev30, last7, total, latestDate, earliestDate }>
 */
function computeAllVisitStats(visitLog) {
  const now  = Date.now()
  const MS30 = 30 * 86400000
  const MS60 = 60 * 86400000
  const MS7  =  7 * 86400000
  const map  = new Map()

  visitLog.forEach(({ key, date }) => {
    const ts = Date.parse(date)
    if (isNaN(ts)) return
    const age = now - ts
    if (!map.has(key)) map.set(key, { last30: 0, prev30: 0, last7: 0, total: 0, latestDate: '', earliestDate: '' })
    const c = map.get(key)
    c.total++
    if (!c.latestDate   || date > c.latestDate)   c.latestDate   = date
    if (!c.earliestDate || date < c.earliestDate) c.earliestDate = date
    if (age <= MS30) {
      c.last30++
      if (age <= MS7) c.last7++
    } else if (age <= MS60) {
      c.prev30++
    }
  })

  return map
}

/**
 * Merge an incoming member record (from a new CSV) into the existing stored record.
 * Newer CSV data wins for profile fields; notes and accumulated visit counts are preserved.
 */
function mergeExistingMember(existing, incoming) {
  const latestVisit = (() => {
    if (!existing.last_visit_date) return incoming.last_visit_date || ''
    if (!incoming.last_visit_date) return existing.last_visit_date
    return incoming.last_visit_date > existing.last_visit_date
      ? incoming.last_visit_date
      : existing.last_visit_date
  })()

  return {
    ...existing,
    membership_type:   incoming.membership_type   || existing.membership_type,
    membership_status: incoming.membership_status || existing.membership_status,
    last_visit_date:   latestVisit,
    total_visits:      Math.max(Number(existing.total_visits) || 0, Number(incoming.total_visits) || 0),
    email:      incoming.email      || existing.email,
    phone:      incoming.phone      || existing.phone,
    join_date:  existing.join_date  || incoming.join_date,
    price_paid: incoming.price_paid || existing.price_paid,
    // visit counts, no-shows, cancellations are always recomputed from stored data — not overwritten here
  }
}

/**
 * Apply accumulated visit log, no-show counts, and late-cancel counts onto every member.
 * Also computes derived fields used by health scoring (Part 2):
 *   - total_sessions       — count from visit log, fall back to CSV `total_visits`
 *   - no_shows             — int from No Shows CSV (default 0)
 *   - late_cancels         — int from Late Cancels CSV (default 0)
 *   - days_tracked         — days since earliest of (join_date, earliest visit, first_seen_date)
 *   - days_since_last_visit — days between today and most recent visit (or days_tracked if never visited)
 */
function enrichMembers(members, visitLog, noShowData, lateCancelData) {
  const visitStats = computeAllVisitStats(visitLog)
  const now        = Date.now()
  const MS_DAY     = 86400000

  return members.map(m => {
    const key             = normalizeKey(m.member_name)
    const vs              = visitStats.get(key)
    const noShowCount     = noShowData[key]     || 0
    const lateCancelCount = lateCancelData[key] || 0

    // last_visit_date: prefer most recent from visit log, fall back to CSV value
    let lastVisit = m.last_visit_date
    if (vs && vs.latestDate && (!lastVisit || vs.latestDate > lastVisit)) {
      lastVisit = vs.latestDate
    }

    // total_sessions: visit log is authoritative if it has any records, else fall back to CSV
    const totalSessions = vs && vs.total > 0
      ? vs.total
      : (Number(m.total_visits) || 0)

    // days_tracked: earliest of join_date, earliest visit, first_seen_date
    const trackingCandidates = [m.join_date, vs?.earliestDate, m.first_seen_date]
      .filter(Boolean)
      .map(d => Date.parse(d))
      .filter(t => !isNaN(t))
    const daysTracked = trackingCandidates.length
      ? Math.max(0, Math.floor((now - Math.min(...trackingCandidates)) / MS_DAY))
      : 0

    // days_since_last_visit: from most recent visit (or days_tracked if never visited)
    let daysSinceLastVisit = daysTracked
    if (lastVisit) {
      const ts = Date.parse(lastVisit)
      if (!isNaN(ts)) daysSinceLastVisit = Math.max(0, Math.floor((now - ts) / MS_DAY))
    }

    return {
      ...m,
      total_sessions:         totalSessions,
      no_shows:               noShowCount,
      late_cancels:           lateCancelCount,
      days_tracked:           daysTracked,
      days_since_last_visit:  daysSinceLastVisit,
      // Keep legacy fields populated for backwards compatibility with existing scoring
      no_shows_last_30_days:       String(noShowCount),
      cancellations_last_30_days:  String(lateCancelCount),
      ...(vs ? {
        visits_last_30_days:   String(vs.last30),
        visits_prev_30_days:   String(vs.prev30),
        visits_last_7_days:    String(vs.last7),
        bookings_last_30_days: String(vs.last30),
        last_visit_date:       lastVisit,
      } : {}),
    }
  })
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function DataProvider({ children }) {
  const [rawMembers,     setRawMembers]     = useState(() => loadLS(MEMBERS_KEY,     null))
  const [visitLog,       setVisitLog]       = useState(() => loadLS(VISIT_LOG_KEY,   []))
  const [noShowData,     setNoShowData]     = useState(() => loadLS(NOSHOWS_KEY,     {}))
  const [lateCancelData, setLateCancelData] = useState(() => loadLS(LATECANCELS_KEY, {}))
  const [outreach,       setOutreach]       = useState(() => loadLS(OUTREACH_KEY,    DEMO_OUTREACH))
  const [contactLog,     setContactLog]     = useState(() => loadLS(CONTACT_LOG_KEY, {}))
  const [leads,          setLeads]          = useState(() => loadLS(LEADS_KEY,       DEMO_LEADS))
  const [thresholds,     setThresholds]     = useState(() => loadLS(THRESHOLDS_KEY,  DEFAULT_THRESHOLDS))
  const [settings,       setSettings]       = useState(() => loadLS(SETTINGS_KEY,    DEFAULT_SETTINGS))

  const members = rawMembers ? scoreAllMembers(rawMembers, thresholds) : null

  // Verify health-score formula against Recovr benchmarks on first mount.
  // Logs a console.table — passes when ≥24/30 within ±10% AND all 30 risk levels correct.
  useEffect(() => { verifyHealthScoreBenchmarks() }, [])

  // ── CSV UPSERT ──────────────────────────────────────────────────────────────
  /**
   * Merge parsed CSV data into existing stored data.
   *
   * Members CSV  → UPSERT by normalized name (update existing, add new)
   * Visit Details → append new { key, date } records (dedup by key+date)
   * No Shows     → replace count per member (Glofox gives running totals)
   * Late Cancels → replace count per member
   *
   * After merging, ALL members are re-enriched with computed visit counts,
   * no-show counts, and late-cancel counts from the full accumulated data.
   *
   * Returns { added, updated, newVisitsAdded, totalMembers }
   */
  const upsertCSVData = useCallback(({ parsedMembers, visitRecords, noShowMap, lateCancelMap }) => {
    let members        = rawMembers     ? [...rawMembers]     : []
    let newVisitLog    = visitLog       ? [...visitLog]       : []
    let newNoShows     = { ...noShowData }
    let newLateCancels = { ...lateCancelData }
    let added = 0, updated = 0, newVisitsAdded = 0

    // 1. UPSERT member records (Members CSV or Recovr/generic)
    const todayISO = new Date().toISOString().substring(0, 10)
    if (parsedMembers && parsedMembers.length) {
      const idxByKey = new Map()
      members.forEach((m, i) => idxByKey.set(normalizeKey(m.member_name), i))

      parsedMembers.forEach(incoming => {
        const key = normalizeKey(incoming.member_name)
        if (idxByKey.has(key)) {
          const idx = idxByKey.get(key)
          members[idx] = mergeExistingMember(members[idx], incoming)
          updated++
        } else {
          idxByKey.set(key, members.length)
          // Stamp first_seen_date once on initial add — never overwritten
          members.push({ ...incoming, first_seen_date: incoming.first_seen_date || todayISO })
          added++
        }
      })
    }

    // 2. Append new visit records — deduplicated by member key + date
    if (visitRecords && visitRecords.length) {
      const seen = new Set(newVisitLog.map(r => `${r.key}|${r.date}`))
      const newOnes = visitRecords.filter(r => !seen.has(`${r.key}|${r.date}`))
      newVisitLog    = [...newVisitLog, ...newOnes]
      newVisitsAdded = newOnes.length
    }

    // 3. Replace no-show counts per member (Glofox provides running totals — not additive)
    if (noShowMap && noShowMap.size) {
      noShowMap.forEach((count, key) => { newNoShows[key] = count })
    }

    // 4. Replace late-cancel counts per member
    if (lateCancelMap && lateCancelMap.size) {
      lateCancelMap.forEach((count, key) => { newLateCancels[key] = count })
    }

    // 5. Re-enrich ALL members from accumulated data so health scores are consistent
    members = enrichMembers(members, newVisitLog, newNoShows, newLateCancels)

    // Persist everything
    setRawMembers(members)
    setVisitLog(newVisitLog)
    setNoShowData(newNoShows)
    setLateCancelData(newLateCancels)
    saveLS(MEMBERS_KEY,     members)
    saveLS(VISIT_LOG_KEY,   newVisitLog)
    saveLS(NOSHOWS_KEY,     newNoShows)
    saveLS(LATECANCELS_KEY, newLateCancels)

    // ── Diagnostics ──────────────────────────────────────────────────────────
    console.groupCollapsed('[GymPulse] CSV Upload — UPSERT complete')
    console.log('Members:       %d added, %d updated, %d total', added, updated, members.length)
    console.log('Visit records: %d new, %d total in log', newVisitsAdded, newVisitLog.length)
    console.log('No-shows:      %d members updated, %d members tracked total', noShowMap?.size || 0, Object.keys(newNoShows).length)
    console.log('Late cancels:  %d members updated, %d members tracked total', lateCancelMap?.size || 0, Object.keys(newLateCancels).length)
    if (members.length) {
      const sample = members.slice(0, 5).map(m => ({
        name:                    m.member_name,
        total_sessions:          m.total_sessions,
        no_shows:                m.no_shows,
        late_cancels:            m.late_cancels,
        days_tracked:            m.days_tracked,
        days_since_last_visit:   m.days_since_last_visit,
        visits_last_30_days:     m.visits_last_30_days,
        visits_prev_30_days:     m.visits_prev_30_days,
      }))
      console.table(sample)
    }
    console.groupEnd()

    return { added, updated, newVisitsAdded, totalMembers: members.length }
  }, [rawMembers, visitLog, noShowData, lateCancelData])

  // Direct member load — used by demo and any code that bypasses UPSERT
  const loadMembers = useCallback((data) => {
    setRawMembers(data)
    saveLS(MEMBERS_KEY, data)
  }, [])

  const loadDemoData = useCallback(() => {
    const data = DEMO_MEMBERS.map(m => ({ ...m }))
    setRawMembers(data)
    setVisitLog([])
    setNoShowData({})
    setLateCancelData({})
    saveLS(MEMBERS_KEY,     data)
    saveLS(VISIT_LOG_KEY,   [])
    saveLS(NOSHOWS_KEY,     {})
    saveLS(LATECANCELS_KEY, {})
  }, [])

  /**
   * Wipe all uploaded member data, visit history, no-shows, late-cancels,
   * and any per-member flags/snoozes. Returns the app to the empty upload state.
   */
  const clearAllData = useCallback(() => {
    setRawMembers(null)
    setVisitLog([])
    setNoShowData({})
    setLateCancelData({})
    localStorage.removeItem(MEMBERS_KEY)
    localStorage.removeItem(VISIT_LOG_KEY)
    localStorage.removeItem(NOSHOWS_KEY)
    localStorage.removeItem(LATECANCELS_KEY)
    // Clear per-member UI state managed outside this context
    localStorage.removeItem('gympulse_flags')
    localStorage.removeItem('gympulse_snoozed')
  }, [])

  // ── Other data mutations (unchanged) ────────────────────────────────────────

  const updateSettings   = useCallback((s) => { setSettings(s);   saveLS(SETTINGS_KEY,   s) }, [])
  const updateThresholds = useCallback((t) => { setThresholds(t); saveLS(THRESHOLDS_KEY, t) }, [])

  const logOutreach = useCallback((entry) => {
    setOutreach(prev => { const next = [entry, ...prev]; saveLS(OUTREACH_KEY, next); return next })
  }, [])

  const updateOutcomeStatus = useCallback((id, outcome) => {
    setOutreach(prev => {
      const next = prev.map(o => o.id === id ? { ...o, outcome } : o)
      saveLS(OUTREACH_KEY, next)
      return next
    })
  }, [])

  const addContactLogEntry = useCallback((memberId, entry) => {
    setContactLog(prev => {
      const memberLog = prev[memberId] || []
      const next = { ...prev, [memberId]: [entry, ...memberLog] }
      saveLS(CONTACT_LOG_KEY, next)
      return next
    })
  }, [])

  const getContactLog = useCallback((memberId) => contactLog[memberId] || [], [contactLog])

  const addLead    = useCallback((lead)        => { setLeads(prev => { const n = [lead, ...prev];                                    saveLS(LEADS_KEY, n); return n }) }, [])
  const updateLead = useCallback((id, updates) => { setLeads(prev => { const n = prev.map(l => l.id === id ? { ...l, ...updates } : l); saveLS(LEADS_KEY, n); return n }) }, [])
  const moveLead   = useCallback((id, stage)   => { setLeads(prev => { const n = prev.map(l => l.id === id ? { ...l, stage } : l);    saveLS(LEADS_KEY, n); return n }) }, [])
  const deleteLead = useCallback((id)          => { setLeads(prev => { const n = prev.filter(l => l.id !== id);                        saveLS(LEADS_KEY, n); return n }) }, [])

  return (
    <DataContext.Provider value={{
      members, rawMembers, loadMembers, loadDemoData,
      visitLog, noShowData, lateCancelData,
      upsertCSVData, clearAllData,
      outreach, logOutreach, updateOutcomeStatus,
      contactLog, addContactLogEntry, getContactLog,
      leads, addLead, updateLead, moveLead, deleteLead,
      thresholds, updateThresholds,
      settings, updateSettings,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export const useData = () => useContext(DataContext)
