import Papa from 'papaparse'

// ── Utilities ──────────────────────────────────────────────────────────────────

function stripBOM(str) {
  return typeof str === 'string' ? str.replace(/^\uFEFF/, '').trim() : String(str || '').trim()
}

// Normalize a member name for cross-file matching (case-insensitive, collapse whitespace)
export function normalizeKey(name) {
  return (name || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

// Parse date strings from Glofox export formats:
//   DD/MM/YYYY HH:mm  → "2026-05-08"
//   DD/MM/YYYY        → "2026-05-08"
//   YYYY-MM-DDTHH:... → "2026-04-26"  (ISO — used in Visit Details)
// Returns YYYY-MM-DD string, or '' if unparseable.
function parseGlofoxDate(str) {
  if (!str || !String(str).trim()) return ''
  const s = String(str).trim()

  // ISO format (Visit Details): 2026-04-26T07:40:00
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10)

  // DD/MM/YYYY [HH:mm] (Members CSV: Last visit, Commenced at)
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) {
    const [, d, mo, y] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  return ''
}

// Parse a file into raw header array + data rows as arrays (header: false mode).
// This avoids Papa's duplicate-header mangling and handles empty Glofox columns correctly.
function parseRawFile(file) {
  return new Promise(resolve => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: 'greedy',
      complete: results => {
        const rows = results.data || []
        if (rows.length < 2) return resolve({ rawHeaders: [], dataRows: [], parseError: 'Empty or header-only file.' })
        const rawHeaders = rows[0].map(h => stripBOM(h))
        resolve({ rawHeaders, dataRows: rows.slice(1), parseError: null })
      },
      error: err => resolve({ rawHeaders: [], dataRows: [], parseError: err.message }),
    })
  })
}

// Build { lowercaseColumnName → columnIndex } map, skipping empty-header columns.
function buildColMap(rawHeaders) {
  const map = {}
  rawHeaders.forEach((h, i) => {
    const clean = h.toLowerCase()
    if (clean) map[clean] = i
  })
  return map
}

// Get a cell value from a raw row by trying multiple column name candidates.
function getCol(row, colMap, ...names) {
  for (const n of names) {
    const idx = colMap[n.toLowerCase()]
    if (idx !== undefined && row[idx] !== undefined) return String(row[idx] || '').trim()
  }
  return ''
}

// ── File type detection ────────────────────────────────────────────────────────

/**
 * Detect which type of export this CSV is, based on column headers.
 * Exported so Dashboard can show labels in the upload status.
 *
 * Returns { type, label }
 * type: 'glofox_members' | 'glofox_visits' | 'glofox_noshows' | 'glofox_latecancels'
 *     | 'recovr' | 'members' | 'unknown'
 */
export function detectFileType(rawHeaders) {
  const lc = rawHeaders.map(h => (h || '').toLowerCase().trim()).filter(Boolean)
  const has = (...names) => names.some(n => lc.includes(n.toLowerCase()))

  // Glofox Current Members — unique columns: "commenced at", "price paid", "total visits"
  if (has('commenced at') || (has('total visits') && has('last visit'))) {
    return { type: 'glofox_members', label: 'Glofox Current Members' }
  }

  // Glofox Visit Details — unique columns: "visit time", "location visited"
  if (has('visit time')) {
    return { type: 'glofox_visits', label: 'Glofox Visit Details' }
  }

  // Glofox No Shows — unique column: "no shows"
  if (has('no shows')) {
    return { type: 'glofox_noshows', label: 'Glofox No Shows' }
  }

  // Glofox Late Cancellations — unique column: "late cancellations"
  if (has('late cancellations')) {
    return { type: 'glofox_latecancels', label: 'Glofox Late Cancellations' }
  }

  // Recovr — unique columns: "risk level" or "last session"
  if (has('risk level') || has('last session')) {
    return { type: 'recovr', label: 'Recovr Export' }
  }

  // Generic member CSV (our own format or other gym software)
  const hasName = has('member_name', 'name', 'full name', 'full_name', 'client name', 'client_name')
  const hasStatus = has('membership_status', 'status', 'membership status')
  if (hasName && hasStatus) {
    return { type: 'members', label: 'Member Export' }
  }

  return { type: 'unknown', label: 'Unrecognised format — skipped' }
}

// ── Glofox parsers ─────────────────────────────────────────────────────────────

const GLOFOX_CANCELLED = new Set(['cancelled', 'canceled', 'terminated', 'expired'])

function normalizeGlofoxStatus(raw) {
  const s = (raw || '').toUpperCase().trim()
  if (s === 'ACTIVE')   return 'active'
  if (s === 'OVERDUE')  return 'active'    // overdue payment — still a current member
  if (s === 'PAUSED' || s === 'SUSPENDED' || s === 'FREEZE') return 'paused'
  if (s === 'CANCELLED' || s === 'CANCELED' || s === 'TERMINATED' || s === 'EXPIRED') return 'cancelled'
  return 'active'
}

// Parse Current Members CSV → array of member objects
function parseGlofoxMembers(dataRows, colMap) {
  const members = []
  dataRows.forEach((row, i) => {
    const name = getCol(row, colMap, 'full name', 'name')
    if (!name) return

    const statusRaw = getCol(row, colMap, 'status')
    const status = normalizeGlofoxStatus(statusRaw)
    if (status === 'cancelled') return  // skip

    members.push({
      member_id: `GFX_${i}_${Math.random().toString(36).slice(2, 6)}`,
      member_name: name,
      email: getCol(row, colMap, 'email', 'email address') || '',
      phone: getCol(row, colMap, 'phone', 'phone number', 'mobile') || '',
      membership_type: getCol(row, colMap, 'membership name', 'plan name', 'membership') || 'Membership',
      membership_status: status,
      join_date: parseGlofoxDate(getCol(row, colMap, 'commenced at', 'start date', 'join date')),
      last_visit_date: parseGlofoxDate(getCol(row, colMap, 'last visit', 'last check in', 'last attended')),
      total_visits: parseInt(getCol(row, colMap, 'total visits'), 10) || 0,
      price_paid: getCol(row, colMap, 'price paid') || '',
      // Will be enriched by visit/no-show files if available
      visits_last_30_days: '0',
      visits_prev_30_days: '0',
      visits_last_7_days: '0',
      bookings_last_30_days: '0',
      cancellations_last_30_days: '0',
      no_shows_last_30_days: '0',
      notes: '',
    })
  })
  return members
}

// Parse Visit Details CSV → array of { key, date } individual visit records.
// Aggregation and deduplication happen in DataContext (upsertCSVData).
function parseGlofoxVisits(dataRows, colMap) {
  const records = []
  dataRows.forEach(row => {
    const name = getCol(row, colMap, 'full name', 'name')
    if (!name) return
    const dateStr = parseGlofoxDate(getCol(row, colMap, 'visit time', 'visit date', 'date'))
    if (!dateStr) return
    records.push({ key: normalizeKey(name), date: dateStr })
  })
  return records
}

// Parse No Shows CSV → Map<normalizedName, count>
function parseGlofoxNoShows(dataRows, colMap) {
  const map = new Map()
  dataRows.forEach(row => {
    const name = getCol(row, colMap, 'name', 'full name')
    if (!name) return
    const count = parseInt(getCol(row, colMap, 'no shows'), 10) || 0
    if (count > 0) map.set(normalizeKey(name), (map.get(normalizeKey(name)) || 0) + count)
  })
  return map
}

// Parse Late Cancellations CSV → Map<normalizedName, count>
function parseGlofoxLateCancels(dataRows, colMap) {
  const map = new Map()
  dataRows.forEach(row => {
    const name = getCol(row, colMap, 'name', 'full name')
    if (!name) return
    const count = parseInt(getCol(row, colMap, 'late cancellations'), 10) || 0
    if (count > 0) map.set(normalizeKey(name), (map.get(normalizeKey(name)) || 0) + count)
  })
  return map
}

// ── Generic / Recovr CSV normalisation (existing logic, unchanged) ─────────────

const COLUMN_ALIASES = {
  id: 'member_id', 'member id': 'member_id', memberid: 'member_id', client_id: 'member_id', clientid: 'member_id',
  name: 'member_name', full_name: 'member_name', fullname: 'member_name', 'full name': 'member_name',
  client_name: 'member_name', 'client name': 'member_name', contact: 'member_name',
  status: 'membership_status', 'membership status': 'membership_status', active: 'membership_status',
  'membership type': 'membership_type', plan: 'membership_type', 'membership plan': 'membership_type', product: 'membership_type',
  last_visit: 'last_visit_date', 'last visit': 'last_visit_date', 'last visit date': 'last_visit_date',
  last_attended: 'last_visit_date', last_session: 'last_visit_date', 'last session': 'last_visit_date',
  last_check_in: 'last_visit_date', 'last check in': 'last_visit_date', last_checkin: 'last_visit_date',
  visits_this_month: 'visits_last_30_days', visits_30_days: 'visits_last_30_days',
  'visits (30 days)': 'visits_last_30_days', monthly_visits: 'visits_last_30_days',
  visits_last_month: 'visits_prev_30_days', prev_visits: 'visits_prev_30_days',
  'join date': 'join_date', joined: 'join_date', start_date: 'join_date', 'start date': 'join_date', signup_date: 'join_date',
  risk_level: 'csv_risk_level', 'risk level': 'csv_risk_level', risk: 'csv_risk_level',
}

const COLUMN_DEFAULTS = {
  member_id:                   () => `M${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  email:                       () => '',
  phone:                       () => '',
  membership_type:             () => 'Membership',
  join_date:                   () => '',
  last_visit_date:             () => '',
  visits_last_30_days:         () => '0',
  visits_prev_30_days:         () => '0',
  visits_last_7_days:          () => '0',
  bookings_last_30_days:       () => '0',
  cancellations_last_30_days:  () => '0',
  no_shows_last_30_days:       () => '0',
  notes:                       () => '',
}

const REQUIRED_COLUMNS   = ['member_name', 'membership_status']
const CANCELLED_STATUSES = new Set(['cancelled', 'canceled', 'cancel', 'terminated', 'inactive', 'churned'])

function normaliseGenericRows(rawRows) {
  return rawRows.map((row, rowIndex) => {
    const normalised = {}
    Object.entries(row).forEach(([k, v]) => {
      const key = k.trim().toLowerCase().replace(/\s+/g, '_')
      const canonical = COLUMN_ALIASES[key] || COLUMN_ALIASES[k.trim().toLowerCase()] || key
      normalised[canonical] = typeof v === 'string' ? v.trim() : v
    })
    Object.entries(COLUMN_DEFAULTS).forEach(([col, defaultFn]) => {
      if (normalised[col] === undefined || normalised[col] === '') normalised[col] = defaultFn()
    })
    if (!normalised.member_id) normalised.member_id = `M${rowIndex + 1}`
    if (normalised.membership_status) {
      normalised.membership_status = normalised.membership_status.toLowerCase().trim()
      if (['yes', '1', 'true', 'y'].includes(normalised.membership_status)) normalised.membership_status = 'active'
    }
    if (normalised.last_visit_date && normalised.last_visit_date.includes('T')) {
      normalised.last_visit_date = normalised.last_visit_date.split('T')[0]
    }
    if (normalised.csv_risk_level) normalised.csv_risk_level = normalised.csv_risk_level.toLowerCase().trim()
    return normalised
  })
}

// ── Public: single-file legacy API ────────────────────────────────────────────

/**
 * Parse a single CSV (Recovr or generic internal format).
 * Returns { data, errors, removedCount }.
 * Kept for backward-compat — Dashboard now routes through parseMultipleCSVs for all uploads.
 */
export function parseCSV(file) {
  return new Promise(resolve => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: results => {
        if (!results.data.length) return resolve({ data: null, errors: ['CSV file is empty.'] })
        const data = normaliseGenericRows(results.data)
        const missing = REQUIRED_COLUMNS.filter(r => !Object.keys(data[0] || {}).includes(r))
        if (missing.length) return resolve({ data: null, errors: [`Missing columns: ${missing.join(', ')}.`] })
        const filtered = data.filter(row => !CANCELLED_STATUSES.has((row.membership_status || '').toLowerCase().trim()))
        resolve({ data: filtered, errors: [], removedCount: data.length - filtered.length })
      },
      error: err => resolve({ data: null, errors: [err.message] }),
    })
  })
}

// ── Public: multi-file smart parser ───────────────────────────────────────────

/**
 * Parse one or more CSV files. Returns raw typed data — no merging.
 * Merging/UPSERT against existing stored data is done by DataContext.upsertCSVData().
 *
 * Returns:
 *   parsedMembers  — array of member objects from Members CSVs (or null if none)
 *   visitRecords   — flat array of { key, date } from Visit Details CSVs
 *   noShowMap      — Map<normalizedName, count> from No Shows CSVs (or null)
 *   lateCancelMap  — Map<normalizedName, count> from Late Cancellations CSVs (or null)
 *   summary        — [{ name, type, label, count, removedCount?, error?, headers? }]
 */
export async function parseMultipleCSVs(files) {
  const summary = []
  let parsedMembers = null   // member objects (from Members CSVs)
  let visitRecords  = []     // flat { key, date } array from Visit Details
  let noShowMap     = null   // Map<key, count>
  let lateCancelMap = null   // Map<key, count>

  console.groupCollapsed(`[GymPulse] Parsing ${files.length} CSV file${files.length !== 1 ? 's' : ''}`)

  for (const file of files) {
    const { rawHeaders, dataRows, parseError } = await parseRawFile(file)

    if (parseError || !dataRows.length) {
      console.warn(`✗ ${file.name} — ${parseError || 'no data rows'}`)
      summary.push({ name: file.name, type: 'error', label: 'Parse error', count: 0, error: parseError || 'File has no data rows.' })
      continue
    }

    const { type, label } = detectFileType(rawHeaders)
    const colMap = buildColMap(rawHeaders)
    console.info(`📄 ${file.name} → ${label} (${dataRows.length} row${dataRows.length !== 1 ? 's' : ''})`)

    if (type === 'glofox_members') {
      const parsed = parseGlofoxMembers(dataRows, colMap)
      const skipped = dataRows.length - parsed.length
      if (skipped > 0) console.warn(`  ↳ skipped ${skipped} row${skipped !== 1 ? 's' : ''} (missing name or cancelled status)`)
      parsedMembers = parsedMembers ? [...parsedMembers, ...parsed] : parsed
      summary.push({ name: file.name, type, label, count: parsed.length, skippedCount: skipped })

    } else if (type === 'glofox_visits') {
      const records = parseGlofoxVisits(dataRows, colMap)
      const skipped = dataRows.length - records.length
      if (skipped > 0) console.warn(`  ↳ skipped ${skipped} row${skipped !== 1 ? 's' : ''} (missing name or invalid date)`)
      visitRecords = [...visitRecords, ...records]
      summary.push({ name: file.name, type, label, count: new Set(records.map(r => r.key)).size, skippedCount: skipped })

    } else if (type === 'glofox_noshows') {
      noShowMap = parseGlofoxNoShows(dataRows, colMap)
      summary.push({ name: file.name, type, label, count: noShowMap.size })

    } else if (type === 'glofox_latecancels') {
      lateCancelMap = parseGlofoxLateCancels(dataRows, colMap)
      summary.push({ name: file.name, type, label, count: lateCancelMap.size })

    } else if (type === 'recovr' || type === 'members') {
      const result = await parseCSV(file)
      if (result.errors.length) {
        summary.push({ name: file.name, type: 'error', label, count: 0, error: result.errors[0] })
      } else {
        parsedMembers = parsedMembers ? [...parsedMembers, ...(result.data || [])] : (result.data || [])
        summary.push({ name: file.name, type, label, count: result.data?.length || 0, removedCount: result.removedCount })
      }

    } else {
      console.warn(`  ↳ unrecognised format — columns: ${rawHeaders.filter(Boolean).slice(0, 8).join(', ')}`)
      summary.push({ name: file.name, type: 'unknown', label, count: 0, headers: rawHeaders.filter(Boolean) })
    }
  }

  console.groupEnd()
  return { parsedMembers, visitRecords, noShowMap, lateCancelMap, summary }
}
