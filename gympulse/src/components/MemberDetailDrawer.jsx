import { X, MessageSquare, Phone, Mail, Calendar, Clock, Star } from 'lucide-react'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { format, subWeeks, startOfWeek } from 'date-fns'
import RiskBadge from './common/RiskBadge'
import Avatar from './common/Avatar'
import { useData } from '../contexts/DataContext'
import { useComposer } from '../contexts/ComposerContext'
import { engagementScore, healthScore } from '../utils/riskScoring'

function buildWeeklyChart(member) {
  const perWeek = Math.max(1, Math.round((member.visits_last_30_days || 0) / 4))
  return Array.from({ length: 8 }, (_, i) => {
    const weekStart = startOfWeek(subWeeks(new Date(), 7 - i))
    const label = format(weekStart, 'MMM d')
    // Simulate realistic weekly distribution
    const recency = i / 7
    const visits = i >= 5
      ? Math.max(0, Math.round(perWeek * (0.5 + Math.random() * 0.5)))
      : Math.round((member.visits_prev_30_days / 4) * (0.7 + Math.random() * 0.6))
    return { label, visits }
  })
}

export default function MemberDetailDrawer({ member, onClose }) {
  const { getContactLog } = useData()
  const { openComposer } = useComposer()
  const log = getContactLog(member.member_id)
  const weeklyData = buildWeeklyChart(member)
  const score = engagementScore(member)
  const hScore = healthScore(member)

  const flags = []
  if (member.cancellations_last_30_days >= 2) flags.push(`${member.cancellations_last_30_days} cancellations this month`)
  const noShowRate = member.bookings_last_30_days > 0
    ? Math.round((member.no_shows_last_30_days / member.bookings_last_30_days) * 100) : 0
  if (noShowRate >= 30) flags.push(`No-show rate ${noShowRate}%`)
  if (member.visit_change_pct >= 40) flags.push(`Attendance down ${member.visit_change_pct}%`)
  if (member.days_since_last_visit >= 14) flags.push(`Last visit ${member.days_since_last_visit} days ago`)

  const riskColors = { green: '#22c55e', amber: '#f59e0b', red: '#ef4444' }
  const barColor = riskColors[member.risk_level] || '#6366f1'

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="font-bold text-slate-900">Member Profile</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Identity */}
          <div className="flex items-start gap-4">
            <Avatar name={member.member_name} size="lg" />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-900 text-lg">{member.member_name}</h3>
              <p className="text-sm text-slate-500">{member.membership_type}</p>
              <div className="mt-2 flex items-center gap-2">
            <RiskBadge level={member.risk_level} label={member.risk_label} />
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border tabular-nums ${
              hScore >= 61 ? 'text-green-700 bg-green-50 border-green-200'
              : hScore >= 30 ? 'text-amber-700 bg-amber-50 border-amber-200'
              : 'text-red-700 bg-red-50 border-red-200'
            }`}>{hScore}%</span>
          </div>
            </div>
          </div>

          {/* Risk reason */}
          <div className={`px-4 py-3 rounded-xl text-sm font-medium border ${
            member.risk_level === 'red' ? 'bg-red-50 border-red-200 text-red-700'
            : member.risk_level === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-700'
            : 'bg-green-50 border-green-200 text-green-700'
          }`}>
            {member.risk_reason}
          </div>

          {/* Contact info */}
          <div className="space-y-2">
            {member.email && (
              <a href={`mailto:${member.email}`} className="flex items-center gap-3 text-sm text-slate-600 hover:text-slate-900">
                <Mail size={14} className="text-slate-400" /> {member.email}
              </a>
            )}
            {member.phone && (
              <a href={`tel:${member.phone}`} className="flex items-center gap-3 text-sm text-slate-600 hover:text-slate-900">
                <Phone size={14} className="text-slate-400" /> {member.phone}
              </a>
            )}
            <p className="flex items-center gap-3 text-sm text-slate-600">
              <Calendar size={14} className="text-slate-400" /> Member since {member.join_date}
            </p>
          </div>

          {/* Key stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Visits this month', value: member.visits_last_30_days },
              { label: 'Visits last month', value: member.visits_prev_30_days },
              { label: 'This week', value: member.visits_last_7_days },
              { label: 'Cancellations', value: member.cancellations_last_30_days },
              { label: 'No-shows', value: member.no_shows_last_30_days },
              { label: 'Health Score', value: `${hScore}%` },
              { label: 'Engagement', value: `${score}/100` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Weekly attendance chart */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3">Attendance — last 8 weeks</p>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={weeklyData} barSize={20}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="visits" radius={[4, 4, 0, 0]}>
                  {weeklyData.map((_, i) => (
                    <Cell key={i} fill={i >= 5 ? barColor : '#e2e8f0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Flags */}
          {flags.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Flags</p>
              <div className="space-y-1.5">
                {flags.map(f => (
                  <div key={f} className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <Star size={12} className="fill-amber-500 text-amber-500 flex-shrink-0" /> {f}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact history */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Contact History</p>
            {log.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No outreach logged yet.</p>
            ) : (
              <div className="space-y-2">
                {log.map(entry => (
                  <div key={entry.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600">{entry.type}</span>
                      <span className="text-xs text-slate-400">{entry.date}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{entry.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer action */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-5">
          <button
            onClick={() => { onClose(); openComposer(member) }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors"
          >
            <MessageSquare size={16} /> Draft AI Message
          </button>
        </div>
      </div>
    </div>
  )
}
