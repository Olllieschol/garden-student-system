import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  Search, Eye, MessageSquare, Flag, Clock, LayoutGrid, List,
  ChevronUp, ChevronDown, X,
} from 'lucide-react'
import { useData } from '../contexts/DataContext'
import { useComposer } from '../contexts/ComposerContext'
import { healthScore } from '../utils/riskScoring'
import RiskBadge from '../components/common/RiskBadge'
import Avatar from '../components/common/Avatar'
import MemberDetailDrawer from '../components/MemberDetailDrawer'
import clsx from 'clsx'

const MEMBERSHIP_TYPES = ['All', 'Monthly Unlimited', '10-Class Pack', 'Founding Member', 'Student Membership', 'Premium Unlimited']

const SNOOZE_OPTIONS = [
  { label: '3 days', days: 3 },
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
]

function loadLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback }
  catch { return fallback }
}
function saveLS(key, value) { localStorage.setItem(key, JSON.stringify(value)) }

function HealthBadge({ score }) {
  const color = score >= 61
    ? 'text-green-700 bg-green-50 border-green-200'
    : score >= 30
    ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-red-700 bg-red-50 border-red-200'
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border tabular-nums', color)}>
      {score}%
    </span>
  )
}

function LastVisitCell({ daysAgo }) {
  const color = daysAgo >= 21 ? 'text-red-600' : daysAgo >= 14 ? 'text-amber-600' : 'text-slate-600'
  const label = daysAgo === 999 ? 'Never' : daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`
  return <span className={clsx('text-sm font-medium', color)}>{label}</span>
}

function TrendCell({ pct }) {
  if (pct === 0) return <span className="text-slate-400 text-sm">—</span>
  const up = pct < 0
  return (
    <span className={clsx('flex items-center gap-1 text-sm font-medium', up ? 'text-green-600' : 'text-red-600')}>
      {up ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      {Math.abs(pct)}%
    </span>
  )
}

function SnoozeMenu({ memberId, onSnooze, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-30 bg-white rounded-xl border border-slate-200 shadow-lg py-1 min-w-[130px]">
      {SNOOZE_OPTIONS.map(({ label, days }) => (
        <button key={days} onClick={() => onSnooze(memberId, days)}
          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
          <Clock size={13} className="text-slate-400" /> {label}
        </button>
      ))}
    </div>
  )
}

// ── Kanban card ─────────────────────────────────────────────────────────────
function KanbanCard({ m, score, flagged, onFlag, onOpen, onMessage }) {
  return (
    <div
      onClick={() => onOpen(m)}
      className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-2 mb-2">
        <Avatar name={m.member_name} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm truncate">{m.member_name}</p>
          <p className="text-xs text-slate-400 truncate">{m.membership_type}</p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onFlag(m.member_id) }}
          className={clsx('p-1 rounded transition-colors flex-shrink-0', flagged ? 'text-red-500' : 'text-slate-300 hover:text-red-400')}
        >
          <Flag size={12} fill={flagged ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="flex items-center justify-between mb-2">
        <HealthBadge score={score} />
        <span className="text-xs text-slate-400">
          {m.days_since_last_visit === 999 ? 'Never' : m.days_since_last_visit === 0 ? 'Today' : `${m.days_since_last_visit}d ago`}
        </span>
      </div>
      <p className="text-xs text-slate-500 line-clamp-2 mb-2">{m.risk_reason}</p>
      <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
        <button onClick={() => onOpen(m)} className="flex-1 py-1 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg border border-slate-100 transition-colors flex items-center justify-center gap-1">
          <Eye size={11} /> View
        </button>
        <button onClick={() => onMessage(m)} className="flex-1 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-100 transition-colors flex items-center justify-center gap-1">
          <MessageSquare size={11} /> Message
        </button>
      </div>
    </div>
  )
}

const KANBAN_COLS = [
  { id: 'green',        label: 'Low Risk',      headerColor: 'text-green-700',  barColor: 'bg-green-500' },
  { id: 'amber',        label: 'Medium Risk',   headerColor: 'text-amber-700',  barColor: 'bg-amber-500' },
  { id: 'red',          label: 'High Risk',     headerColor: 'text-red-700',    barColor: 'bg-red-500' },
  { id: 'non-attender', label: 'Non Attenders', headerColor: 'text-slate-700',  barColor: 'bg-slate-400' },
  { id: 'suspended',    label: 'Suspended',     headerColor: 'text-purple-700', barColor: 'bg-purple-400' },
]

function memberKanbanCol(m) {
  if ((m.membership_status || '').toLowerCase() === 'suspended') return 'suspended'
  if (m.csv_risk_level === 'non-attender' || (m.days_since_last_visit >= 30 && Number(m.visits_last_30_days) === 0)) return 'non-attender'
  return m.risk_level
}

export default function MemberHealth() {
  const { members, loadDemoData } = useData()
  const { openComposer } = useComposer()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [memberType, setMemberType] = useState('All')
  const [sortBy, setSortBy] = useState('risk')
  const [selected, setSelected] = useState(null)
  const [viewMode, setViewMode] = useState('list') // 'list' | 'kanban'
  const [snoozeOpen, setSnoozeOpen] = useState(null) // member_id with open snooze menu

  // Persistent flag/snooze state
  const [flagged, setFlagged] = useState(() => new Set(loadLS('gympulse_flagged', [])))
  const [snoozed, setSnoozed] = useState(() => loadLS('gympulse_snoozed', {}))

  const toggleFlag = (id) => {
    setFlagged(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      saveLS('gympulse_flagged', [...next])
      return next
    })
  }

  const snooze = (id, days) => {
    const expiry = new Date(Date.now() + days * 86400000).toISOString()
    setSnoozed(prev => { const n = { ...prev, [id]: expiry }; saveLS('gympulse_snoozed', n); return n })
    setSnoozeOpen(null)
  }

  const unsnooze = useCallback((id) => {
    setSnoozed(prev => { const n = { ...prev }; delete n[id]; saveLS('gympulse_snoozed', n); return n })
  }, [])

  // Pure read — no side effects during render
  const isSnoozed = useCallback((id) => {
    const exp = snoozed[id]
    if (!exp) return false
    return new Date(exp) > new Date()
  }, [snoozed])

  // Sweep expired snoozes in an effect, not during render
  useEffect(() => {
    const expired = Object.keys(snoozed).filter(id => snoozed[id] && new Date(snoozed[id]) <= new Date())
    if (expired.length > 0) {
      setSnoozed(prev => {
        const n = { ...prev }
        expired.forEach(id => delete n[id])
        saveLS('gympulse_snoozed', n)
        return n
      })
    }
  }, [snoozed])

  // useMemo must be called before any early return
  const { filtered, scores } = useMemo(() => {
    if (!members) return { filtered: [], scores: {} }
    let list = members.filter(m => m.membership_status === 'active' && !isSnoozed(m.member_id))
    if (filter !== 'all') list = list.filter(m => m.risk_level === filter)
    if (search) list = list.filter(m => m.member_name.toLowerCase().includes(search.toLowerCase()))
    if (memberType !== 'All') list = list.filter(m => m.membership_type === memberType)

    // Compute scores first so we can sort by them
    const scoreMap = {}
    members.forEach(m => { scoreMap[m.member_id] = healthScore(m) })

    const riskOrder = { red: 0, amber: 1, green: 2 }
    switch (sortBy) {
      case 'risk':       list = [...list].sort((a, b) => riskOrder[a.risk_level] - riskOrder[b.risk_level]); break
      case 'health':     list = [...list].sort((a, b) => scoreMap[a.member_id] - scoreMap[b.member_id]); break
      case 'last_visit': list = [...list].sort((a, b) => b.days_since_last_visit - a.days_since_last_visit); break
      case 'drop':       list = [...list].sort((a, b) => b.visit_change_pct - a.visit_change_pct); break
      case 'name':       list = [...list].sort((a, b) => a.member_name.localeCompare(b.member_name)); break
    }

    // Flagged members bubble to top (only in list view)
    if (viewMode === 'list') {
      list = [
        ...list.filter(m => flagged.has(m.member_id)),
        ...list.filter(m => !flagged.has(m.member_id)),
      ]
    }

    return { filtered: list, scores: scoreMap }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, filter, search, memberType, sortBy, flagged, snoozed, viewMode])

  // Kanban buckets
  const kanbanBuckets = useMemo(() => {
    if (!members) return {}
    const allActive = members.filter(m => m.membership_status === 'active' || (m.membership_status || '').toLowerCase() === 'suspended')
    const buckets = {}
    KANBAN_COLS.forEach(c => { buckets[c.id] = [] })
    const scoreMap = {}
    members.forEach(m => { scoreMap[m.member_id] = healthScore(m) })
    allActive.forEach(m => {
      const col = memberKanbanCol(m)
      if (buckets[col]) buckets[col].push(m)
    })
    // Sort each column by health score ascending (lowest first)
    KANBAN_COLS.forEach(c => {
      buckets[c.id].sort((a, b) => (scoreMap[a.member_id] || 0) - (scoreMap[b.member_id] || 0))
    })
    return buckets
  }, [members])

  if (!members) return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Member Health Portal</h1>
      <p className="text-slate-500 mb-6">No data loaded yet.</p>
      <button onClick={loadDemoData} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors">Load Demo Data</button>
    </div>
  )

  const snoozedCount = Object.keys(snoozed).filter(id => isSnoozed(id)).length

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Member Health Portal</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {members.length} active members
            {snoozedCount > 0 && <span className="ml-2 text-slate-400">· {snoozedCount} snoozed</span>}
          </p>
        </div>
        {/* View toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button onClick={() => setViewMode('list')}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              viewMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            <List size={15} /> List
          </button>
          <button onClick={() => setViewMode('kanban')}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              viewMode === 'kanban' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            <LayoutGrid size={15} /> Kanban
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-5 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1.5">
          {['all', 'green', 'amber', 'red'].map(r => (
            <button key={r} onClick={() => setFilter(r)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize',
                filter === r
                  ? r === 'green' ? 'bg-green-600 border-green-600 text-white'
                    : r === 'amber' ? 'bg-amber-500 border-amber-500 text-white'
                    : r === 'red' ? 'bg-red-500 border-red-500 text-white'
                    : 'bg-slate-800 border-slate-800 text-white'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              )}>
              {r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..."
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400" />
        </div>
        <select value={memberType} onChange={e => setMemberType(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 bg-white">
          {MEMBERSHIP_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 bg-white">
          <option value="risk">Sort: Risk Level</option>
          <option value="health">Sort: Health Score</option>
          <option value="last_visit">Sort: Last Visit</option>
          <option value="drop">Sort: Visit Drop %</option>
          <option value="name">Sort: Name</option>
        </select>
        <span className="ml-auto text-xs text-slate-400">{viewMode === 'list' ? `${filtered.length} members` : `${members.length} members`}</span>
      </div>

      {/* ── LIST VIEW ──────────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Member', 'Health', 'Status', 'Last Visit', 'This Month', 'Trend', 'Cancels', 'No-shows', 'Actions'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-400">No members match your filters.</td></tr>
                ) : filtered.map(m => {
                  const score = scores[m.member_id] ?? healthScore(m)
                  const isFlagged = flagged.has(m.member_id)
                  return (
                    <tr key={m.member_id}
                      onClick={() => setSelected(m)}
                      className={clsx('hover:bg-slate-50 transition-colors cursor-pointer', isFlagged && 'bg-red-50/30')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={m.member_name} size="sm" />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-slate-900 text-sm">{m.member_name}</p>
                              {isFlagged && <Flag size={11} className="text-red-500 fill-red-500 flex-shrink-0" />}
                            </div>
                            <p className="text-xs text-slate-400">{m.membership_type}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><HealthBadge score={score} /></td>
                      <td className="px-4 py-3"><RiskBadge level={m.risk_level} label={m.risk_label} /></td>
                      <td className="px-4 py-3"><LastVisitCell daysAgo={m.days_since_last_visit} /></td>
                      <td className="px-4 py-3"><span className="text-sm text-slate-700 font-medium">{m.visits_last_30_days}</span></td>
                      <td className="px-4 py-3"><TrendCell pct={m.visit_change_pct} /></td>
                      <td className="px-4 py-3">
                        <span className={clsx('text-sm font-medium', Number(m.cancellations_last_30_days) >= 3 ? 'text-red-600' : Number(m.cancellations_last_30_days) >= 2 ? 'text-amber-600' : 'text-slate-600')}>
                          {m.cancellations_last_30_days}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('text-sm font-medium', Number(m.no_shows_last_30_days) >= 2 ? 'text-red-600' : Number(m.no_shows_last_30_days) >= 1 ? 'text-amber-600' : 'text-slate-600')}>
                          {m.no_shows_last_30_days}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 items-center relative">
                          <button
                            aria-label={`View ${m.member_name}'s profile`}
                            onClick={() => setSelected(m)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
                            <Eye size={14} />
                          </button>
                          <button
                            aria-label={`Send message to ${m.member_name}`}
                            onClick={() => openComposer(m)}
                            className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors">
                            <MessageSquare size={14} />
                          </button>
                          <button
                            aria-label={isFlagged ? 'Remove flag' : `Flag ${m.member_name}`}
                            onClick={() => toggleFlag(m.member_id)}
                            className={clsx('p-1.5 rounded-lg transition-colors', isFlagged ? 'text-red-500 hover:bg-red-50' : 'text-slate-300 hover:text-red-400 hover:bg-slate-50')}>
                            <Flag size={14} fill={isFlagged ? 'currentColor' : 'none'} />
                          </button>
                          <div className="relative">
                            <button
                              aria-label={`Snooze ${m.member_name}`}
                              onClick={() => setSnoozeOpen(snoozeOpen === m.member_id ? null : m.member_id)}
                              className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-300 hover:text-amber-500 transition-colors">
                              <Clock size={14} />
                            </button>
                            {snoozeOpen === m.member_id && (
                              <SnoozeMenu memberId={m.member_id} onSnooze={snooze} onClose={() => setSnoozeOpen(null)} />
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── KANBAN VIEW ────────────────────────────────────────────── */}
      {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_COLS.map(col => {
            const colMembers = (kanbanBuckets[col.id] || []).filter(m => {
              if (search && !m.member_name.toLowerCase().includes(search.toLowerCase())) return false
              if (memberType !== 'All' && m.membership_type !== memberType) return false
              return true
            })
            return (
              <div key={col.id} className="flex-shrink-0 w-64">
                <div className="flex items-center gap-2 mb-3">
                  <div className={clsx('w-2.5 h-2.5 rounded-full', col.barColor)} />
                  <span className={clsx('text-sm font-semibold', col.headerColor)}>{col.label}</span>
                  <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">{colMembers.length}</span>
                </div>
                <div className="space-y-3">
                  {colMembers.length === 0 ? (
                    <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">No members</div>
                  ) : colMembers.map(m => (
                    <KanbanCard
                      key={m.member_id}
                      m={m}
                      score={scores[m.member_id] ?? healthScore(m)}
                      flagged={flagged.has(m.member_id)}
                      onFlag={toggleFlag}
                      onOpen={setSelected}
                      onMessage={openComposer}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Snoozed members restore strip */}
      {Object.keys(snoozed).some(id => isSnoozed(id)) && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Clock size={15} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            {Object.keys(snoozed).filter(id => isSnoozed(id)).length} member{Object.keys(snoozed).filter(id => isSnoozed(id)).length !== 1 ? 's are' : ' is'} snoozed and hidden from view.
          </p>
          <button onClick={() => { setSnoozed({}); saveLS('gympulse_snoozed', {}) }}
            className="ml-auto text-xs text-amber-700 hover:text-amber-900 flex items-center gap-1 font-medium">
            <X size={12} /> Clear all
          </button>
        </div>
      )}

      {selected && <MemberDetailDrawer member={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
