import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import {
  FileText, UserX, AlertTriangle, CalendarX, TrendingDown,
  UserPlus, Activity, ClipboardList, Download,
} from 'lucide-react'
import { format, subDays, differenceInDays, parseISO } from 'date-fns'
import { useData } from '../contexts/DataContext'
import { healthScore } from '../utils/riskScoring'
import Avatar from '../components/common/Avatar'
import RiskBadge from '../components/common/RiskBadge'
import clsx from 'clsx'

const REPORTS = [
  { id: 'summary',      label: 'Summary',             icon: FileText },
  { id: 'absent',       label: 'Absent Clients',      icon: UserX },
  { id: 'high_risk',    label: 'High Risk Clients',   icon: AlertTriangle },
  { id: 'cancellation', label: 'Cancellation Summary', icon: CalendarX },
  { id: 'dropoff',      label: 'Drop Off Report',     icon: TrendingDown },
  { id: 'new_clients',  label: 'New Clients',         icon: UserPlus },
  { id: 'visits',       label: 'Client Visits',       icon: Activity },
  { id: 'actions',      label: 'Actions Report',      icon: ClipboardList },
]

function StatBox({ label, value, sub, color = 'text-slate-900' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <p className={clsx('text-3xl font-bold', color)}>{value}</p>
      <p className="text-sm font-medium text-slate-700 mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function TableHeader({ cols }) {
  return (
    <div className="grid gap-4 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide rounded-t-xl"
      style={{ gridTemplateColumns: cols.map(c => c.width || '1fr').join(' ') }}>
      {cols.map(c => <div key={c.key} className={c.align === 'right' ? 'text-right' : ''}>{c.label}</div>)}
    </div>
  )
}

function MemberRow({ m, cols }) {
  const score = healthScore(m)
  return (
    <div className="grid gap-4 px-4 py-3.5 border-b border-slate-50 last:border-0 items-center hover:bg-slate-50/50 transition-colors"
      style={{ gridTemplateColumns: cols.map(c => c.width || '1fr').join(' ') }}>
      {cols.map(c => {
        const align = c.align === 'right' ? 'text-right' : ''
        if (c.key === 'name') return (
          <div key={c.key} className="flex items-center gap-2.5">
            <Avatar name={m.member_name} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{m.member_name}</p>
              <p className="text-xs text-slate-400 truncate">{m.membership_type}</p>
            </div>
          </div>
        )
        if (c.key === 'risk')    return <div key={c.key}><RiskBadge level={m.risk_level} label={m.risk_label} /></div>
        if (c.key === 'health')  return <div key={c.key}><span className={clsx('text-sm font-bold', score >= 61 ? 'text-green-600' : score >= 30 ? 'text-amber-600' : 'text-red-600')}>{score}%</span></div>
        if (c.key === 'days')    return <div key={c.key} className={clsx('text-sm font-medium', align, m.days_since_last_visit >= 21 ? 'text-red-600' : m.days_since_last_visit >= 14 ? 'text-amber-600' : 'text-slate-600')}>{m.days_since_last_visit === 999 ? 'Never' : `${m.days_since_last_visit}d ago`}</div>
        if (c.key === 'visits')  return <div key={c.key} className={clsx('text-sm text-slate-700 font-medium', align)}>{m.visits_last_30_days}</div>
        if (c.key === 'prevVisits') return <div key={c.key} className={clsx('text-sm text-slate-500', align)}>{m.visits_prev_30_days}</div>
        if (c.key === 'drop')    return <div key={c.key} className={clsx('text-sm font-medium', align, m.visit_change_pct > 0 ? 'text-red-600' : 'text-slate-400')}>{m.visit_change_pct > 0 ? `↓${m.visit_change_pct}%` : '—'}</div>
        if (c.key === 'cancels') return <div key={c.key} className={clsx('text-sm font-medium', align, Number(m.cancellations_last_30_days) >= 3 ? 'text-red-600' : Number(m.cancellations_last_30_days) >= 2 ? 'text-amber-600' : 'text-slate-600')}>{m.cancellations_last_30_days}</div>
        if (c.key === 'noShows') return <div key={c.key} className={clsx('text-sm font-medium', align, Number(m.no_shows_last_30_days) >= 2 ? 'text-red-600' : 'text-slate-600')}>{m.no_shows_last_30_days}</div>
        if (c.key === 'joined')  return <div key={c.key} className={clsx('text-sm text-slate-500', align)}>{m.join_date}</div>
        if (c.key === 'reason')  return <div key={c.key} className="text-xs text-slate-500 truncate">{m.risk_reason}</div>
        return <div key={c.key} className={align}>{m[c.key]}</div>
      })}
    </div>
  )
}

// ── Sub-report components ────────────────────────────────────────────────────

function SummaryReport({ members }) {
  const active = members.filter(m => m.membership_status === 'active')
  const red = active.filter(m => m.risk_level === 'red')
  const amber = active.filter(m => m.risk_level === 'amber')
  const green = active.filter(m => m.risk_level === 'green')
  const avgScore = Math.round(active.reduce((s, m) => s + healthScore(m), 0) / (active.length || 1))
  const avgVisits = (active.reduce((s, m) => s + Number(m.visits_last_30_days || 0), 0) / (active.length || 1)).toFixed(1)
  const atRiskPct = Math.round((red.length + amber.length) / (active.length || 1) * 100)

  const riskData = [
    { name: 'Green', value: green.length, color: '#22c55e' },
    { name: 'Amber', value: amber.length, color: '#f59e0b' },
    { name: 'Red',   value: red.length,   color: '#ef4444' },
  ]

  // Simulated monthly trend (last 6 months)
  const trendData = Array.from({ length: 6 }, (_, i) => {
    const base = active.length
    const month = format(subDays(new Date(), (5 - i) * 30), 'MMM')
    return { month, members: Math.round(base * (0.88 + i * 0.024)), atRisk: Math.round((red.length + amber.length) * (0.7 + i * 0.06)) }
  })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label="Total Active Members" value={active.length} sub="as of today" />
        <StatBox label="Avg. Health Score" value={`${avgScore}%`} color={avgScore >= 61 ? 'text-green-600' : avgScore >= 30 ? 'text-amber-600' : 'text-red-600'} />
        <StatBox label="At Risk" value={`${atRiskPct}%`} sub={`${red.length + amber.length} members`} color="text-amber-600" />
        <StatBox label="Avg. Visits / Month" value={avgVisits} sub="per active member" color="text-indigo-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Risk Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={riskData} isAnimationActive={false}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {riskData.map(d => <Cell key={d.name} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Member Trend (6 Months)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData} isAnimationActive={false}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Line type="monotone" dataKey="members" stroke="#6366f1" strokeWidth={2} dot={false} name="Total" />
              <Line type="monotone" dataKey="atRisk" stroke="#ef4444" strokeWidth={2} dot={false} name="At Risk" strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function AbsentReport({ members }) {
  const absent = members
    .filter(m => m.membership_status === 'active' && m.days_since_last_visit >= 14)
    .sort((a, b) => b.days_since_last_visit - a.days_since_last_visit)

  const cols = [
    { key: 'name',   label: 'Member',    width: '2fr' },
    { key: 'risk',   label: 'Risk',      width: '1fr' },
    { key: 'health', label: 'Health',    width: '1fr' },
    { key: 'days',   label: 'Last Visit', width: '1fr' },
    { key: 'visits', label: 'Visits/mo', width: '1fr', align: 'right' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{absent.length} members absent 14+ days</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <TableHeader cols={cols} />
        {absent.length === 0
          ? <p className="text-center py-10 text-slate-400 text-sm">No absent members — great retention!</p>
          : absent.map(m => <MemberRow key={m.member_id} m={m} cols={cols} />)}
      </div>
    </div>
  )
}

function HighRiskReport({ members }) {
  const highRisk = members
    .filter(m => m.membership_status === 'active' && m.risk_level === 'red')
    .sort((a, b) => healthScore(a) - healthScore(b))

  const cols = [
    { key: 'name',   label: 'Member',     width: '2fr' },
    { key: 'health', label: 'Health',     width: '80px' },
    { key: 'days',   label: 'Last Visit', width: '1fr' },
    { key: 'reason', label: 'Reason',     width: '2fr' },
    { key: 'visits', label: 'Visits',     width: '80px', align: 'right' },
    { key: 'drop',   label: 'Drop',       width: '80px', align: 'right' },
  ]

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
          {highRisk.length} high-risk members require immediate attention
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <TableHeader cols={cols} />
        {highRisk.length === 0
          ? <p className="text-center py-10 text-slate-400 text-sm">No high-risk members right now</p>
          : highRisk.map(m => <MemberRow key={m.member_id} m={m} cols={cols} />)}
      </div>
    </div>
  )
}

function CancellationReport({ members }) {
  const withCancels = members
    .filter(m => m.membership_status === 'active' && Number(m.cancellations_last_30_days) > 0)
    .sort((a, b) => Number(b.cancellations_last_30_days) - Number(a.cancellations_last_30_days))

  const totalCancels = withCancels.reduce((s, m) => s + Number(m.cancellations_last_30_days), 0)
  const totalNoShows = members.filter(m => m.membership_status === 'active').reduce((s, m) => s + Number(m.no_shows_last_30_days || 0), 0)

  const cols = [
    { key: 'name',    label: 'Member',        width: '2fr' },
    { key: 'risk',    label: 'Risk',          width: '1fr' },
    { key: 'cancels', label: 'Cancellations', width: '1fr', align: 'right' },
    { key: 'noShows', label: 'No Shows',      width: '1fr', align: 'right' },
    { key: 'visits',  label: 'Visits',        width: '1fr', align: 'right' },
    { key: 'drop',    label: 'Drop',          width: '80px', align: 'right' },
  ]

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatBox label="Members w/ Cancellations" value={withCancels.length} />
        <StatBox label="Total Cancellations" value={totalCancels} color="text-amber-600" />
        <StatBox label="Total No-Shows" value={totalNoShows} color="text-red-600" />
      </div>
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <TableHeader cols={cols} />
        {withCancels.length === 0
          ? <p className="text-center py-10 text-slate-400 text-sm">No cancellations this month</p>
          : withCancels.map(m => <MemberRow key={m.member_id} m={m} cols={cols} />)}
      </div>
    </div>
  )
}

function DropOffReport({ members }) {
  const dropped = members
    .filter(m => m.membership_status === 'active' && m.visit_change_pct >= 20)
    .sort((a, b) => b.visit_change_pct - a.visit_change_pct)

  const cols = [
    { key: 'name',       label: 'Member',      width: '2fr' },
    { key: 'risk',       label: 'Risk',        width: '1fr' },
    { key: 'health',     label: 'Health',      width: '80px' },
    { key: 'visits',     label: 'This Month',  width: '1fr', align: 'right' },
    { key: 'prevVisits', label: 'Last Month',  width: '1fr', align: 'right' },
    { key: 'drop',       label: 'Drop %',      width: '90px', align: 'right' },
  ]

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">{dropped.length} members with 20%+ visit drop this month</p>
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <TableHeader cols={cols} />
        {dropped.length === 0
          ? <p className="text-center py-10 text-slate-400 text-sm">No significant drop-off detected</p>
          : dropped.map(m => <MemberRow key={m.member_id} m={m} cols={cols} />)}
      </div>
    </div>
  )
}

function NewClientsReport({ members }) {
  const [window, setWindow] = useState(30)
  const cutoff = subDays(new Date(), window)

  const newClients = members
    .filter(m => {
      if (!m.join_date) return false
      try { return parseISO(m.join_date) >= cutoff } catch { return false }
    })
    .sort((a, b) => (b.join_date || '').localeCompare(a.join_date || ''))

  const cols = [
    { key: 'name',   label: 'Member',      width: '2fr' },
    { key: 'joined', label: 'Joined',      width: '1fr' },
    { key: 'risk',   label: 'Risk',        width: '1fr' },
    { key: 'health', label: 'Health',      width: '80px' },
    { key: 'visits', label: 'Visits',      width: '80px', align: 'right' },
  ]

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <p className="text-sm text-slate-500">{newClients.length} new members joined in the last</p>
        {[30, 60, 90].map(d => (
          <button key={d} onClick={() => setWindow(d)}
            className={clsx('px-3 py-1 rounded-lg text-xs font-medium border transition-colors',
              window === d ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300')}>
            {d} days
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <TableHeader cols={cols} />
        {newClients.length === 0
          ? <p className="text-center py-10 text-slate-400 text-sm">No new clients in this period</p>
          : newClients.map(m => <MemberRow key={m.member_id} m={m} cols={cols} />)}
      </div>
    </div>
  )
}

function ClientVisitsReport({ members }) {
  const active = members.filter(m => m.membership_status === 'active')
  const buckets = [
    { label: '0', min: 0, max: 0 },
    { label: '1–3', min: 1, max: 3 },
    { label: '4–7', min: 4, max: 7 },
    { label: '8–12', min: 8, max: 12 },
    { label: '13–17', min: 13, max: 17 },
    { label: '18+', min: 18, max: 999 },
  ].map(b => ({ ...b, count: active.filter(m => { const v = Number(m.visits_last_30_days || 0); return v >= b.min && v <= b.max }).length }))

  const byType = [...new Set(active.map(m => m.membership_type))].map(type => ({
    type,
    avg: (active.filter(m => m.membership_type === type).reduce((s, m) => s + Number(m.visits_last_30_days || 0), 0) / active.filter(m => m.membership_type === type).length).toFixed(1),
    count: active.filter(m => m.membership_type === type).length,
  })).sort((a, b) => Number(b.avg) - Number(a.avg))

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Visit Frequency Distribution (this month)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={buckets} isAnimationActive={false}>
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
            <Bar dataKey="count" name="Members" radius={[6, 6, 0, 0]} fill="#6366f1" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-sm font-semibold text-slate-700">Average Visits by Membership Type</p>
        </div>
        {byType.map(t => (
          <div key={t.type} className="flex items-center gap-4 px-5 py-3 border-b border-slate-50 last:border-0">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">{t.type}</p>
              <p className="text-xs text-slate-400">{t.count} members</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-32 bg-slate-100 rounded-full h-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${Math.min(100, Number(t.avg) / 20 * 100)}%` }} />
              </div>
              <span className="text-sm font-bold text-slate-700 w-8 text-right">{t.avg}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActionsReport({ members, outreach }) {
  const active = members.filter(m => m.membership_status === 'active')
  const needsAction = active
    .filter(m => m.risk_level !== 'green')
    .sort((a, b) => healthScore(a) - healthScore(b))

  const contacted = new Set(outreach.map(o => o.member_id))
  const notContacted = needsAction.filter(m => !contacted.has(m.member_id))
  const alreadyContacted = needsAction.filter(m => contacted.has(m.member_id))

  const cols = [
    { key: 'name',   label: 'Member',     width: '2fr' },
    { key: 'risk',   label: 'Risk',       width: '1fr' },
    { key: 'health', label: 'Health',     width: '80px' },
    { key: 'days',   label: 'Last Visit', width: '1fr' },
    { key: 'reason', label: 'Reason',     width: '2fr' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatBox label="Need Action" value={needsAction.length} color="text-amber-600" />
        <StatBox label="Not Yet Contacted" value={notContacted.length} color="text-red-600" sub="No outreach logged" />
        <StatBox label="Contacted" value={alreadyContacted.length} color="text-green-600" sub="Outreach logged" />
      </div>

      {notContacted.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Not yet contacted ({notContacted.length})
          </h3>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <TableHeader cols={cols} />
            {notContacted.map(m => <MemberRow key={m.member_id} m={m} cols={cols} />)}
          </div>
        </div>
      )}

      {alreadyContacted.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Outreach logged ({alreadyContacted.length})
          </h3>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <TableHeader cols={cols} />
            {alreadyContacted.map(m => <MemberRow key={m.member_id} m={m} cols={cols} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { members, outreach, loadDemoData } = useData()
  const [active, setActive] = useState('summary')

  if (!members) return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Reports</h1>
      <p className="text-slate-500 mb-6">No data loaded yet.</p>
      <button onClick={loadDemoData} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors">Load Demo Data</button>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar nav */}
      <div className="w-56 flex-shrink-0 bg-white border-r border-slate-100 p-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-3 mb-3">Reports</p>
        <nav className="space-y-0.5">
          {REPORTS.map(r => (
            <button key={r.id} onClick={() => setActive(r.id)}
              className={clsx('w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
                active === r.id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50')}>
              <r.icon size={15} /> {r.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto min-w-0">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{REPORTS.find(r => r.id === active)?.label}</h1>
              <p className="text-slate-500 text-sm mt-0.5">{format(new Date(), 'EEEE d MMMM yyyy')}</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800 transition-colors bg-white">
              <Download size={14} /> Export
            </button>
          </div>

          {active === 'summary'      && <SummaryReport members={members} />}
          {active === 'absent'       && <AbsentReport members={members} />}
          {active === 'high_risk'    && <HighRiskReport members={members} />}
          {active === 'cancellation' && <CancellationReport members={members} />}
          {active === 'dropoff'      && <DropOffReport members={members} />}
          {active === 'new_clients'  && <NewClientsReport members={members} />}
          {active === 'visits'       && <ClientVisitsReport members={members} />}
          {active === 'actions'      && <ActionsReport members={members} outreach={outreach} />}
        </div>
      </div>
    </div>
  )
}
