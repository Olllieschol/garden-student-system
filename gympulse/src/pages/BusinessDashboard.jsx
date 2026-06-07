import { useState } from 'react'
import { DollarSign, TrendingDown, UserPlus, Users, AlertCircle, BarChart3 } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { useData } from '../contexts/DataContext'
import { useComposer } from '../contexts/ComposerContext'
import StatCard from '../components/common/StatCard'
import clsx from 'clsx'
import { useAuth } from '../contexts/AuthContext'

const MONTHLY_DATA = [
  { month: 'Nov', members: 38, new: 4, churned: 2 },
  { month: 'Dec', members: 40, new: 5, churned: 3 },
  { month: 'Jan', members: 43, new: 6, churned: 3 },
  { month: 'Feb', members: 45, new: 4, churned: 2 },
  { month: 'Mar', members: 44, new: 3, churned: 4 },
  { month: 'Apr', members: 45, new: 5, churned: 4 },
]

const MEMBERSHIP_FEES = {
  'Monthly Unlimited': 89,
  '10-Class Pack': 150,
  'Founding Member': 69,
  'Student Membership': 59,
  'Premium Unlimited': 129,
}

export default function BusinessDashboard() {
  const { members, loadDemoData } = useData()
  const { openComposer } = useComposer()
  const { user } = useAuth()
  const isOwner = user?.role === 'owner'

  const [mrr, setMrr] = useState(4005)

  if (!isOwner) return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Business Dashboard</h1>
      <p className="text-slate-500">Business metrics are only visible to the gym owner.</p>
    </div>
  )

  if (!members) return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Business Dashboard</h1>
      <p className="text-slate-500 mb-4">No data loaded yet.</p>
      <button onClick={loadDemoData} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700">Load Demo Data</button>
    </div>
  )

  const active = members.filter(m => m.membership_status === 'active')
  const red = active.filter(m => m.risk_level === 'red')
  const amber = active.filter(m => m.risk_level === 'amber')

  const revenueAtRisk = red.reduce((s, m) => s + (MEMBERSHIP_FEES[m.membership_type] || 89), 0)
  const newThisMonth = 5 // from demo trend
  const churned = 4
  const netChange = newThisMonth - churned
  const churnRate = Math.round((churned / active.length) * 100)
  const avgTenure = 8.3

  const trialConversion = 45
  const projectedMRR = Math.round(mrr * (1 - churnRate / 100 * 0.5))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Business Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Monday morning health check for the gym</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">MRR $</label>
          <input type="number" value={mrr} onChange={e => setMrr(Number(e.target.value))}
            className="w-28 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
        </div>
      </div>

      {/* Revenue at risk callout */}
      {revenueAtRisk > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-800">Revenue at Risk</p>
            <p className="text-sm text-red-700 mt-0.5">
              You have <strong>{red.length} red members</strong>. If they all cancel, that's <strong>${revenueAtRisk.toLocaleString()}/month</strong> lost. Here's who to call today:
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {red.slice(0, 4).map(m => (
                <button key={m.member_id} onClick={() => openComposer(m)}
                  className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors">
                  Message {m.member_name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold text-red-600">${revenueAtRisk.toLocaleString()}</p>
            <p className="text-xs text-red-500">monthly risk</p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {[
          { title: 'MRR', value: `$${mrr.toLocaleString()}`, subtitle: 'monthly recurring', icon: DollarSign },
          { title: 'Churn Rate', value: `${churnRate}%`, subtitle: 'this month', icon: TrendingDown, accent: churnRate > 10 ? 'bg-red-500' : 'bg-slate-400' },
          { title: 'New Members', value: newThisMonth, subtitle: 'this month', icon: UserPlus, accent: 'bg-green-500' },
          { title: 'Net Change', value: `${netChange > 0 ? '+' : ''}${netChange}`, subtitle: 'new minus churned', icon: Users },
          { title: 'Trial Conv.', value: `${trialConversion}%`, subtitle: 'conversion rate', icon: BarChart3 },
          { title: 'Avg Tenure', value: `${avgTenure}m`, subtitle: 'months avg', icon: Users },
        ].map(({ title, value, subtitle, icon, accent }) => (
          <StatCard key={title} title={title} value={value} subtitle={subtitle} icon={icon} accent={accent} />
        ))}
      </div>

      {/* Projected MRR */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl p-5 mb-6 flex items-center justify-between">
        <div>
          <p className="text-white/70 text-sm">Projected MRR Next Month</p>
          <p className="text-3xl font-bold text-white mt-1">${projectedMRR.toLocaleString()}</p>
          <p className="text-white/60 text-xs mt-1">Based on current churn trend</p>
        </div>
        <div className="text-right">
          <p className="text-white/70 text-sm">Revenue at Risk</p>
          <p className={clsx('text-2xl font-bold mt-1', revenueAtRisk > 500 ? 'text-red-300' : 'text-white')}>${revenueAtRisk.toLocaleString()}</p>
          <p className="text-white/60 text-xs mt-1">{red.length} red members</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Member count trend */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Member Count — Last 6 Months</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={MONTHLY_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Line type="monotone" dataKey="members" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366f1' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* New vs churned */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-800 mb-4">New vs Churned — per Month</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={MONTHLY_DATA} barSize={14} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="new" name="New" fill="#22c55e" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="churned" name="Churned" fill="#ef4444" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
