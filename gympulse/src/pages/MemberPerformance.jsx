import { useMemo } from 'react'
import { Trophy, Star, Flame, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { useData } from '../contexts/DataContext'
import { engagementScore } from '../utils/riskScoring'
import Avatar from '../components/common/Avatar'
import clsx from 'clsx'

const BADGES = [
  { id: 'sessions_10', label: '10 Sessions', icon: '🏋️', threshold: (v) => v >= 10 },
  { id: 'sessions_50', label: '50 Sessions', icon: '🔥', threshold: (v) => v >= 50 },
  { id: 'sessions_100', label: '100 Sessions', icon: '💯', threshold: (v) => v >= 100 },
  { id: 'member_6m', label: '6-Month Member', icon: '🌟', threshold: (_, joinDays) => joinDays >= 180 },
  { id: 'member_1y', label: '1-Year Member', icon: '👑', threshold: (_, joinDays) => joinDays >= 365 },
  { id: 'consistent', label: 'Consistent', icon: '📅', threshold: (v, _, visits7) => visits7 >= 3 },
]

function memberBadges(member) {
  const totalVisits = (Number(member.visits_last_30_days) + Number(member.visits_prev_30_days)) * 3 // rough estimate
  const joinDays = member.join_date ? Math.floor((Date.now() - new Date(member.join_date)) / 86400000) : 0
  return BADGES.filter(b => b.threshold(totalVisits, joinDays, Number(member.visits_last_7_days)))
}

function engagementColor(score) {
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

export default function MemberPerformance() {
  const { members, loadDemoData } = useData()

  const enriched = useMemo(() => {
    if (!members) return []
    return members
      .filter(m => m.membership_status === 'active')
      .map(m => ({ ...m, score: engagementScore(m), badges: memberBadges(m) }))
      .sort((a, b) => b.score - a.score)
  }, [members])

  if (!members) return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Member Performance</h1>
      <p className="text-slate-500 mb-4">No data loaded yet.</p>
      <button onClick={loadDemoData} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700">Load Demo Data</button>
    </div>
  )

  const top10 = enriched.slice(0, 10)
  const milestones = enriched.filter(m => m.badges.length > 0).slice(0, 5)
  const scoreDistData = [
    { range: '80–100', count: enriched.filter(m => m.score >= 80).length, color: '#22c55e' },
    { range: '60–79', count: enriched.filter(m => m.score >= 60 && m.score < 80).length, color: '#86efac' },
    { range: '40–59', count: enriched.filter(m => m.score >= 40 && m.score < 60).length, color: '#f59e0b' },
    { range: '20–39', count: enriched.filter(m => m.score >= 20 && m.score < 40).length, color: '#f97316' },
    { range: '0–19', count: enriched.filter(m => m.score < 20).length, color: '#ef4444' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Member Performance</h1>
        <p className="text-slate-500 text-sm mt-0.5">Engagement scores, streaks, and milestone recognition</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={18} className="text-amber-500" />
            <h2 className="font-semibold text-slate-800">Engagement Leaderboard</h2>
          </div>
          <div className="space-y-2">
            {top10.map((m, i) => (
              <div key={m.member_id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                <span className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                  i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-500')}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </span>
                <Avatar name={m.member_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm">{m.member_name}</p>
                  <p className="text-xs text-slate-400">{m.membership_type}</p>
                </div>
                <div className="flex items-center gap-2">
                  {m.badges.slice(0, 2).map(b => (
                    <span key={b.id} title={b.label} className="text-base">{b.icon}</span>
                  ))}
                </div>
                {/* Score bar */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-20 bg-slate-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${m.score}%`, backgroundColor: engagementColor(m.score) }} />
                  </div>
                  <span className="text-xs font-bold text-slate-700 w-8 text-right">{m.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          {/* Score distribution */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 mb-4">Score Distribution</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={scoreDistData} barSize={28} margin={{ left: -10 }}>
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} domain={[0, 'dataMax + 1']} />
                <Tooltip formatter={(v) => [`${v} members`, 'Count']} contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} minPointSize={5} isAnimationActive={false}>
                  {scoreDistData.map((d, i) => <Cell key={i} fill={d.count === 0 ? '#e2e8f0' : d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Milestones this week */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Star size={16} className="text-amber-500" />
              <h2 className="font-semibold text-slate-800">Milestone Members</h2>
            </div>
            {milestones.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No milestones yet.</p>
            ) : (
              <div className="space-y-3">
                {milestones.map(m => (
                  <div key={m.member_id} className="flex items-center gap-3">
                    <Avatar name={m.member_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{m.member_name}</p>
                      <div className="flex gap-1 mt-0.5">
                        {m.badges.map(b => (
                          <span key={b.id} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                            {b.icon} {b.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full table */}
      <div className="mt-6 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">All Members — Engagement Scores</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Rank', 'Member', 'Visits / Month', 'This Week', 'Cancellations', 'Badges', 'Score'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {enriched.map((m, i) => (
                <tr key={m.member_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-500">#{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={m.member_name} size="sm" />
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{m.member_name}</p>
                        <p className="text-xs text-slate-400">{m.membership_type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 font-medium">{m.visits_last_30_days}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{m.visits_last_7_days}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{m.cancellations_last_30_days}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {m.badges.map(b => <span key={b.id} title={b.label} className="text-base">{b.icon}</span>)}
                      {m.badges.length === 0 && <span className="text-xs text-slate-300">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${m.score}%`, backgroundColor: engagementColor(m.score) }} />
                      </div>
                      <span className="text-sm font-bold text-slate-700">{m.score}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
