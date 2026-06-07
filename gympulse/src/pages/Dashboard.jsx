import { useState } from 'react'
import { Users, AlertTriangle, AlertCircle, TrendingUp, Upload, Loader2, CheckCircle, X, FolderOpen, FileText, AlertCircle as AlertIcon } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useData } from '../contexts/DataContext'
import { useComposer } from '../contexts/ComposerContext'
import { parseCSV, parseMultipleCSVs } from '../utils/csvParser'
import StatCard from '../components/common/StatCard'
import RiskBadge from '../components/common/RiskBadge'
import Avatar from '../components/common/Avatar'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

const RISK_COLORS = { green: '#22c55e', amber: '#f59e0b', red: '#ef4444' }

const TYPE_STYLES = {
  recovr:            { dot: 'bg-indigo-500', text: 'text-indigo-700' },
  glofox_members:    { dot: 'bg-blue-500',   text: 'text-blue-700' },
  members:           { dot: 'bg-blue-400',   text: 'text-blue-600' },
  glofox_visits:     { dot: 'bg-green-500',  text: 'text-green-700' },
  glofox_noshows:    { dot: 'bg-amber-500',  text: 'text-amber-700' },
  glofox_latecancels:{ dot: 'bg-orange-500', text: 'text-orange-700' },
  unknown:           { dot: 'bg-slate-400',  text: 'text-slate-500' },
  error:             { dot: 'bg-red-500',    text: 'text-red-600' },
}

// Status chips showing what data is loaded across all uploads (persistent, not per-batch)
function DataStatusChips({ compact = false }) {
  const { rawMembers, visitLog, noShowData, lateCancelData } = useData()
  const memberCount     = rawMembers?.length || 0
  const visitCount      = visitLog?.length || 0
  const noShowCount     = noShowData ? Object.keys(noShowData).length : 0
  const lateCancelCount = lateCancelData ? Object.keys(lateCancelData).length : 0

  const chips = [
    { label: 'Members',      count: memberCount,     loaded: memberCount > 0 },
    { label: 'Visits',       count: visitCount,      loaded: visitCount > 0 },
    { label: 'No Shows',     count: noShowCount,     loaded: noShowCount > 0 },
    { label: 'Late Cancels', count: lateCancelCount, loaded: lateCancelCount > 0 },
  ]

  return (
    <div className={clsx(
      'flex flex-wrap gap-2',
      compact ? 'px-4 py-2.5 bg-slate-50 border-b border-slate-100' : ''
    )}>
      {chips.map(({ label, count, loaded }) => (
        <span key={label} className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
          loaded ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-100 border-slate-200 text-slate-400'
        )}>
          {loaded ? '✅' : '⬜'} {label}{loaded && <span className="opacity-75"> ({count.toLocaleString()})</span>}
        </span>
      ))}
    </div>
  )
}

function FileSummaryRow({ item }) {
  const style = TYPE_STYLES[item.type] || TYPE_STYLES.unknown
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className={clsx('mt-1.5 w-2 h-2 rounded-full flex-shrink-0', style.dot)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
        <p className={clsx('text-xs mt-0.5', style.text)}>{item.label}</p>
        {item.error && <p className="text-xs text-red-500 mt-0.5">{item.error}</p>}
        {item.type === 'unknown' && item.headers && (
          <p className="text-xs text-slate-400 mt-0.5">Columns found: {item.headers.slice(0, 6).join(', ')}{item.headers.length > 6 ? '…' : ''}</p>
        )}
      </div>
      {item.count > 0 && (
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-slate-800">{item.count}</p>
          <p className="text-xs text-slate-400">members</p>
          {item.removedCount > 0 && <p className="text-xs text-slate-400">{item.removedCount} removed</p>}
        </div>
      )}
    </div>
  )
}

function UploadPrompt({ onDone, onDemo, upsertCSVData }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.csv'))
    if (!files.length) { setUploadError('No CSV files found.'); return }
    setUploading(true)
    setUploadError('')
    const { parsedMembers, visitRecords, noShowMap, lateCancelMap, summary } = await parseMultipleCSVs(files)
    const hasData = (parsedMembers && parsedMembers.length) || visitRecords.length ||
                    (noShowMap && noShowMap.size) || (lateCancelMap && lateCancelMap.size)
    if (!hasData) {
      const unknowns = summary.filter(r => r.type === 'unknown')
      const hint = unknowns.length ? ` Columns found: ${unknowns[0].headers?.slice(0, 4).join(', ')}` : ''
      setUploadError(`No member data could be extracted.${hint}`)
      setUploading(false)
      return
    }
    const upsertResult = upsertCSVData({ parsedMembers, visitRecords, noShowMap, lateCancelMap })
    setUploading(false)
    onDone(summary, upsertResult)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div className="w-full max-w-xl mb-4">
        <p className="text-xs font-medium text-slate-500 mb-2">Upload status</p>
        <DataStatusChips />
      </div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        className={`w-full max-w-xl border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'}`}
      >
        <Upload size={36} className="mx-auto mb-4 text-slate-300" />
        <p className="text-lg font-semibold text-slate-700 mb-1">Drop CSV files here</p>
        <p className="text-sm text-slate-400 mb-2">Single file or multiple files at once</p>
        <p className="text-xs text-slate-400 mb-6">
          Glofox: Current Members + Visit Details + No Shows + Late Cancellations · Recovr export · Generic CSV
        </p>
        <div className="flex items-center justify-center gap-3">
          <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? 'Processing…' : 'Choose files'}
            <input type="file" accept=".csv" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
          </label>
          <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:border-slate-300 hover:text-slate-800 transition-colors bg-white">
            <FolderOpen size={16} />
            Upload folder
            {/* webkitdirectory lets users select an entire folder; browser provides all files inside */}
            <input type="file" accept=".csv" multiple
              {...{ webkitdirectory: '', directory: '' }}
              className="hidden"
              onChange={e => handleFiles(e.target.files)} />
          </label>
        </div>
        {uploadError && <p className="mt-4 text-sm text-red-500">{uploadError}</p>}
      </div>
      <p className="mt-4 text-slate-400 text-sm">— or —</p>
      <button
        onClick={onDemo}
        className="mt-4 px-6 py-3 bg-slate-800 text-white rounded-xl font-semibold text-sm hover:bg-slate-700 transition-colors shadow-lg"
      >
        Load Demo Data (25 members)
      </button>
    </div>
  )
}

export default function Dashboard() {
  const { members, loadDemoData, upsertCSVData } = useData()
  const { openComposer } = useComposer()
  const [banner, setBanner] = useState(false)
  const [headerError, setHeaderError] = useState('')
  const [multiSummary, setMultiSummary] = useState(null)
  const [upsertStats, setUpsertStats] = useState(null)

  const showBanner = (summary, stats) => {
    setMultiSummary(summary || null)
    setUpsertStats(stats || null)
    setBanner(true)
    setTimeout(() => { setBanner(false); setMultiSummary(null) }, 12000)
  }

  const handleDemo = () => {
    loadDemoData()
    setMultiSummary(null)
    setUpsertStats(null)
    setBanner(true)
    setTimeout(() => setBanner(false), 4000)
  }

  const handleHeaderUpload = async (e) => {
    const files = Array.from(e.target.files).filter(f => f.name.toLowerCase().endsWith('.csv'))
    if (!files.length) return
    setHeaderError('')
    const { parsedMembers, visitRecords, noShowMap, lateCancelMap, summary } = await parseMultipleCSVs(files)
    const hasData = (parsedMembers && parsedMembers.length) || visitRecords.length ||
                    (noShowMap && noShowMap.size) || (lateCancelMap && lateCancelMap.size)
    if (!hasData) { setHeaderError('Could not extract member data — check the file format.'); return }
    const stats = upsertCSVData({ parsedMembers, visitRecords, noShowMap, lateCancelMap })
    showBanner(summary, stats)
    e.target.value = ''
  }

  if (!members) return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Dashboard</h1>
      <p className="text-slate-500 mb-8">Upload your member data or load the demo to get started.</p>
      <UploadPrompt onDone={showBanner} onDemo={handleDemo} upsertCSVData={upsertCSVData} />
    </div>
  )

  const active = members.filter(m => m.membership_status === 'active')
  const green = active.filter(m => m.risk_level === 'green')
  const amber = active.filter(m => m.risk_level === 'amber')
  const red = active.filter(m => m.risk_level === 'red')
  const atRisk = amber.length + red.length
  const avgVisits = active.length ? (active.reduce((s, m) => s + Number(m.visits_last_30_days || 0), 0) / active.length).toFixed(1) : 0

  const pieData = [
    { name: 'Green', value: green.length, color: '#22c55e' },
    { name: 'Amber', value: amber.length, color: '#f59e0b' },
    { name: 'Red', value: red.length, color: '#ef4444' },
  ].filter(d => d.value > 0)

  // Today's priority: red first (by days), then amber
  const priority = [
    ...red.sort((a, b) => b.days_since_last_visit - a.days_since_last_visit),
    ...amber.sort((a, b) => b.visit_change_pct - a.visit_change_pct),
  ].slice(0, 5)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Success banner — demo / single-file loads */}
      {banner && !multiSummary && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm font-medium">
          <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
          <span>
            Upload complete — <strong>{members.length} members</strong>
            {upsertStats?.added   > 0 && <span className="text-green-700"> · {upsertStats.added} new</span>}
            {upsertStats?.updated > 0 && <span className="text-green-700"> · {upsertStats.updated} updated</span>}
            {upsertStats?.newVisitsAdded > 0 && <span className="text-green-700"> · {upsertStats.newVisitsAdded} new visit records</span>}
          </span>
          <button className="ml-auto" onClick={() => setBanner(false)}><X size={14} /></button>
        </div>
      )}

      {/* Multi-file processing summary */}
      {banner && multiSummary && (
        <div className="mb-5 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border-b border-green-100">
            <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
            <span className="text-sm font-semibold text-green-800">
              {multiSummary.filter(r => r.type !== 'unknown' && r.type !== 'error').length} file{multiSummary.length !== 1 ? 's' : ''} processed — <strong>{members.length} members</strong>
              {upsertStats?.added   > 0 && <span className="font-normal text-green-700"> · {upsertStats.added} new</span>}
              {upsertStats?.updated > 0 && <span className="font-normal text-green-700"> · {upsertStats.updated} updated</span>}
              {upsertStats?.newVisitsAdded > 0 && <span className="font-normal text-green-700"> · {upsertStats.newVisitsAdded} new visit records</span>}
            </span>
            <button className="ml-auto text-green-600 hover:text-green-800" onClick={() => { setBanner(false); setMultiSummary(null) }}>
              <X size={14} />
            </button>
          </div>
          <DataStatusChips compact />
          <div className="px-4 py-1 divide-y divide-slate-50">
            {multiSummary.map((item, i) => <FileSummaryRow key={i} item={item} />)}
          </div>
        </div>
      )}
      {/* Upload error banner */}
      {headerError && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm font-medium">
          <X size={16} className="text-red-500 flex-shrink-0" />
          {headerError}
          <button className="ml-auto" onClick={() => setHeaderError('')}><X size={14} /></button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Member retention health — {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-600 transition-colors">
          <Upload size={14} /> Upload CSV
          <input type="file" accept=".csv" multiple className="hidden" onChange={handleHeaderUpload} />
        </label>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Active Members" value={active.length} subtitle="as of today" icon={Users} />
        <StatCard title="At Risk" value={atRisk} subtitle="Amber + Red" icon={AlertTriangle} accent="bg-amber-500" />
        <StatCard title="Critical" value={red.length} subtitle="Need action today" icon={AlertCircle} accent="bg-red-500" />
        <StatCard title="Avg. Visits / Month" value={avgVisits} subtitle="across all active members" icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traffic light chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h2 className="font-semibold text-slate-800 mb-1">Member Health Overview</h2>
          <p className="text-xs text-slate-400 mb-3">{active.length} active members</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v} members`, n]} contentStyle={{ borderRadius: 8, fontSize: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[{ label: 'Green', count: green.length, color: 'text-risk-green' }, { label: 'Amber', count: amber.length, color: 'text-risk-amber' }, { label: 'Red', count: red.length, color: 'text-risk-red' }].map(({ label, count, color }) => (
              <div key={label} className="text-center">
                <p className={`text-xl font-bold ${color}`}>{count}</p>
                <p className="text-xs text-slate-400">{label}</p>
                <p className="text-xs text-slate-400">{active.length ? Math.round(count / active.length * 100) : 0}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* Priority actions */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={16} className="text-red-500" />
            <h2 className="font-semibold text-slate-800">Today's Priority Actions</h2>
            <span className="ml-auto text-xs text-slate-400">{priority.length} members</span>
          </div>
          {priority.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle size={32} className="text-green-400 mb-2" />
              <p className="font-medium text-slate-700">All members are healthy!</p>
              <p className="text-sm text-slate-400 mt-1">No urgent actions needed today.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {priority.map(m => (
                <div key={m.member_id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors border border-slate-50 hover:border-slate-100">
                  <Avatar name={m.member_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 text-sm">{m.member_name}</p>
                      <RiskBadge level={m.risk_level} label={m.risk_label} />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{m.risk_reason}</p>
                  </div>
                  <button
                    onClick={() => openComposer(m)}
                    className="flex-shrink-0 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Message
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity feed */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Recent Activity</h2>
        <div className="space-y-2">
          {red.slice(0, 2).map(m => (
            <div key={m.member_id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
              <span className="w-2 h-2 rounded-full bg-risk-red flex-shrink-0" />
              <p className="text-sm text-slate-600"><span className="font-medium text-slate-900">{m.member_name}</span> moved to <span className="text-red-600 font-medium">Red</span> — {m.risk_reason}</p>
            </div>
          ))}
          {amber.slice(0, 2).map(m => (
            <div key={m.member_id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
              <span className="w-2 h-2 rounded-full bg-risk-amber flex-shrink-0" />
              <p className="text-sm text-slate-600"><span className="font-medium text-slate-900">{m.member_name}</span> moved to <span className="text-amber-600 font-medium">Amber</span> — {m.risk_reason}</p>
            </div>
          ))}
          {green.slice(0, 1).map(m => (
            <div key={m.member_id} className="flex items-center gap-3 py-2">
              <span className="w-2 h-2 rounded-full bg-risk-green flex-shrink-0" />
              <p className="text-sm text-slate-600"><span className="font-medium text-slate-900">{m.member_name}</span> — <span className="text-green-600 font-medium">Retained ✓</span> visiting consistently</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
