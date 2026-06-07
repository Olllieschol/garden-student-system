import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, ChevronLeft, CheckCircle, XCircle, Clock, Users } from 'lucide-react'
import { format, addDays, subDays, isToday, isTomorrow, isYesterday } from 'date-fns'
import { useData } from '../contexts/DataContext'
import { healthScore } from '../utils/riskScoring'
import Avatar from '../components/common/Avatar'
import clsx from 'clsx'

// Simulate class sessions based on membership_type
const CLASS_SCHEDULE = [
  { id: 'S1', time: '06:00 AM', name: 'HIIT',      coach: 'Alex Chen',     types: ['Founding Member', 'Premium Unlimited'], capacity: 12 },
  { id: 'S2', time: '09:00 AM', name: 'Pilates',   coach: 'Sarah Watts',   types: ['Monthly Unlimited', 'Student Membership'], capacity: 10 },
  { id: 'S3', time: '12:00 PM', name: 'CrossFit',  coach: 'Mike Torres',   types: ['Founding Member'], capacity: 8 },
  { id: 'S4', time: '05:30 PM', name: 'Boxing',    coach: 'Alex Chen',     types: ['10-Class Pack'], capacity: 10 },
  { id: 'S5', time: '06:00 PM', name: 'HIIT',      coach: 'Sarah Watts',   types: ['Premium Unlimited', 'Monthly Unlimited'], capacity: 14 },
  { id: 'S6', time: '07:00 PM', name: 'Yoga',      coach: 'Priya Nair',    types: ['Student Membership', 'Monthly Unlimited'], capacity: 12 },
]

// Seeded shuffle so the same members appear in the same sessions each day
function seededMembers(members, session, dateStr) {
  const seed = session.id + dateStr
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  const eligible = members.filter(m => session.types.includes(m.membership_type) && m.membership_status === 'active')
  const shuffled = [...eligible].sort((a, b) => {
    const ha = ((hash + a.member_id.charCodeAt(1)) | 0) % 100
    const hb = ((hash + b.member_id.charCodeAt(1)) | 0) % 100
    return ha - hb
  })
  return shuffled.slice(0, Math.min(session.capacity, shuffled.length))
}

function HealthDot({ score }) {
  return (
    <span className={clsx('inline-block w-2 h-2 rounded-full flex-shrink-0',
      score >= 61 ? 'bg-green-500' : score >= 30 ? 'bg-amber-500' : 'bg-red-500'
    )} />
  )
}

function dateLabel(date) {
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEEE d MMMM')
}

function AttendanceBtn({ status, label, icon: Icon, activeClass, onClick }) {
  return (
    <button onClick={onClick}
      className={clsx('flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
        status ? activeClass : 'border-slate-200 text-slate-400 hover:border-slate-300 bg-white')}>
      <Icon size={12} /> {label}
    </button>
  )
}

function SessionCard({ session, members }) {
  const [expanded, setExpanded] = useState(false)
  const [attendance, setAttendance] = useState({}) // member_id → 'attended' | 'no_show' | null

  const scores = useMemo(() => {
    const m = {}; members.forEach(mem => { m[mem.member_id] = healthScore(mem) }); return m
  }, [members])

  // Sort by health score ascending (lowest = most at risk, shown first)
  const sorted = useMemo(() =>
    [...members].sort((a, b) => (scores[a.member_id] || 0) - (scores[b.member_id] || 0))
  , [members, scores])

  const attendedCount = Object.values(attendance).filter(v => v === 'attended').length
  const noShowCount = Object.values(attendance).filter(v => v === 'no_show').length
  const pendingCount = members.length - attendedCount - noShowCount

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Session header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex-shrink-0 text-center">
          <p className="text-sm font-bold text-slate-900">{session.time}</p>
        </div>
        <div className="w-px h-8 bg-slate-100 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-slate-900">{session.name}</p>
            <span className="text-xs text-slate-400">· {session.coach}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="flex items-center gap-1 text-xs text-slate-500"><Users size={11} /> {members.length} booked</span>
            {attendedCount > 0 && <span className="text-xs text-green-600 font-medium">{attendedCount} attended</span>}
            {noShowCount > 0 && <span className="text-xs text-red-500 font-medium">{noShowCount} no-show</span>}
            {pendingCount > 0 && <span className="text-xs text-slate-400">{pendingCount} pending</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Mini health bar */}
          <div className="flex gap-0.5">
            {sorted.slice(0, 6).map(m => (
              <HealthDot key={m.member_id} score={scores[m.member_id]} />
            ))}
            {sorted.length > 6 && <span className="text-[10px] text-slate-400 ml-1">+{sorted.length - 6}</span>}
          </div>
          {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        </div>
      </button>

      {/* Member list */}
      {expanded && (
        <div className="border-t border-slate-100">
          <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <div className="col-span-4">Member</div>
            <div className="col-span-2 text-center">Health</div>
            <div className="col-span-2 text-center">Last Visit</div>
            <div className="col-span-4 text-right">Attendance</div>
          </div>
          {sorted.map(m => {
            const score = scores[m.member_id]
            const att = attendance[m.member_id]
            return (
              <div key={m.member_id} className="grid grid-cols-12 gap-2 items-center px-5 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                <div className="col-span-4 flex items-center gap-2.5">
                  <Avatar name={m.member_name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{m.member_name}</p>
                    <p className="text-xs text-slate-400 truncate">{m.membership_type}</p>
                  </div>
                </div>
                <div className="col-span-2 flex justify-center">
                  <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border',
                    score >= 61 ? 'text-green-700 bg-green-50 border-green-200'
                    : score >= 30 ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-red-700 bg-red-50 border-red-200')}>
                    <HealthDot score={score} />
                    {score}%
                  </span>
                </div>
                <div className="col-span-2 text-center text-xs text-slate-500">
                  {m.days_since_last_visit === 999 ? 'Never'
                    : m.days_since_last_visit === 0 ? 'Today'
                    : `${m.days_since_last_visit}d ago`}
                </div>
                <div className="col-span-4 flex justify-end gap-1.5">
                  <AttendanceBtn
                    status={att === 'attended'} label="Attended" icon={CheckCircle}
                    activeClass="bg-green-50 border-green-300 text-green-700"
                    onClick={() => setAttendance(prev => ({ ...prev, [m.member_id]: att === 'attended' ? null : 'attended' }))}
                  />
                  <AttendanceBtn
                    status={att === 'no_show'} label="No Show" icon={XCircle}
                    activeClass="bg-red-50 border-red-300 text-red-600"
                    onClick={() => setAttendance(prev => ({ ...prev, [m.member_id]: att === 'no_show' ? null : 'no_show' }))}
                  />
                </div>
              </div>
            )
          })}
          {sorted.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">No members booked for this session</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function SessionReport() {
  const { members, loadDemoData } = useData()
  const [date, setDate] = useState(new Date())

  const dateStr = format(date, 'yyyy-MM-dd')
  const dayOfWeek = date.getDay() // 0=Sun, 6=Sat

  // Filter out weekend sessions for simplicity (some classes are weekday-only)
  const sessions = CLASS_SCHEDULE.filter(s => {
    if (dayOfWeek === 0) return ['S2', 'S6'].includes(s.id) // Sunday: Pilates + Yoga only
    if (dayOfWeek === 6) return ['S2', 'S5', 'S6'].includes(s.id) // Saturday
    return true // all sessions on weekdays
  })

  const sessionData = useMemo(() => {
    if (!members) return {}
    const active = members.filter(m => m.membership_status === 'active')
    const data = {}
    sessions.forEach(s => { data[s.id] = seededMembers(active, s, dateStr) })
    return data
  }, [members, dateStr, sessions])

  const totalBooked = Object.values(sessionData).reduce((s, arr) => s + arr.length, 0)

  if (!members) return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Session Report</h1>
      <p className="text-slate-500 mb-6">No data loaded yet.</p>
      <button onClick={loadDemoData} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors">Load Demo Data</button>
    </div>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Session Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {sessions.length} sessions · {totalBooked} members booked
          </p>
        </div>
        {/* Date navigation */}
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
          <button onClick={() => setDate(d => subDays(d, 1))}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
            <ChevronLeft size={16} />
          </button>
          <div className="text-center min-w-[140px]">
            <p className="text-sm font-bold text-slate-900">{dateLabel(date)}</p>
            <p className="text-xs text-slate-400">{format(date, 'EEEE d MMMM yyyy')}</p>
          </div>
          <button onClick={() => setDate(d => addDays(d, 1))}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Session summary bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Sessions', value: sessions.length, color: 'text-slate-900' },
          { label: 'Members Booked', value: totalBooked, color: 'text-indigo-700' },
          { label: 'At-Risk Attending', value: Object.values(sessionData).flat().filter(m => m.risk_level !== 'green').length, color: 'text-amber-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
            <p className={clsx('text-2xl font-bold', color)}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Sessions */}
      <div className="space-y-4">
        {sessions.map(s => (
          <SessionCard key={s.id + dateStr} session={s} members={sessionData[s.id] || []} />
        ))}
      </div>

      <p className="text-xs text-slate-400 text-center mt-8">
        <Clock size={11} className="inline mr-1" />
        Session data is simulated from member booking patterns
      </p>
    </div>
  )
}
