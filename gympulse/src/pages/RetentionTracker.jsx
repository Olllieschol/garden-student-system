import { useState } from 'react'
import { MessageSquare, CheckCircle, Clock, TrendingUp, Users } from 'lucide-react'
import { useData } from '../contexts/DataContext'
import { useComposer } from '../contexts/ComposerContext'
import RiskBadge from '../components/common/RiskBadge'
import StatCard from '../components/common/StatCard'
import Avatar from '../components/common/Avatar'
import clsx from 'clsx'

export default function RetentionTracker() {
  const { outreach, updateOutcomeStatus, members, loadDemoData } = useData()
  const { openComposer } = useComposer()

  if (!members) return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Retention Tracker</h1>
      <p className="text-slate-500 mb-4">No data loaded yet.</p>
      <button onClick={loadDemoData} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700">Load Demo Data</button>
    </div>
  )

  const thisWeek = outreach.filter(o => {
    const d = new Date(o.date_contacted)
    const now = new Date()
    return (now - d) / 86400000 <= 7
  })

  const contacted = thisWeek.length
  const returned = outreach.filter(o => o.outcome === 'returned').length
  const pending = outreach.filter(o => o.outcome === 'pending').length
  const successRate = contacted > 0 ? Math.round((returned / contacted) * 100) : 0

  const riskColor = { red: 'text-red-600', amber: 'text-amber-600', green: 'text-green-600' }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Retention Tracker</h1>
        <p className="text-slate-500 text-sm mt-0.5">Track whether your outreach is working</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Contacted This Week" value={contacted} subtitle="messages sent" icon={MessageSquare} />
        <StatCard title="Members Returned" value={returned} subtitle="after outreach" icon={CheckCircle} accent="bg-green-500" />
        <StatCard title="Success Rate" value={`${successRate}%`} subtitle="return rate" icon={TrendingUp} />
        <StatCard title="Still At Risk" value={pending} subtitle="awaiting response" icon={Clock} />
      </div>

      {/* Outreach log */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Outreach Log</h2>
          <span className="text-xs text-slate-400">{outreach.length} total contacts</span>
        </div>
        {outreach.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare size={32} className="text-slate-200 mb-3" />
            <p className="font-medium text-slate-600">No outreach logged yet</p>
            <p className="text-sm text-slate-400 mt-1">Send AI messages from the Member Health page to track them here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Member', 'Date Contacted', 'Risk Level', 'Message Type', 'Outcome', 'Action'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {outreach.map(o => {
                  const member = members?.find(m => m.member_id === o.member_id)
                  return (
                    <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={o.member_name} size="sm" />
                          <div>
                            <p className="font-medium text-slate-900 text-sm">{o.member_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600">{o.date_contacted}</td>
                      <td className="px-5 py-3"><RiskBadge level={o.risk_level} /></td>
                      <td className="px-5 py-3">
                        <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                          o.message_type === 'SMS' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-purple-50 border-purple-200 text-purple-700'
                        )}>
                          {o.message_type}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {o.outcome === 'returned' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                            <CheckCircle size={11} /> Returned ✓
                          </span>
                        ) : o.outcome === 'still_at_risk' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                            Still At Risk
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                            <Clock size={11} /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          {o.outcome === 'pending' && (
                            <>
                              <button
                                onClick={() => updateOutcomeStatus(o.id, 'returned')}
                                className="px-2.5 py-1 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
                              >
                                Mark Returned
                              </button>
                              <button
                                onClick={() => updateOutcomeStatus(o.id, 'still_at_risk')}
                                className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors"
                              >
                                Still At Risk
                              </button>
                            </>
                          )}
                              <button
                              onClick={() => openComposer(member || { member_id: o.member_id, member_name: o.member_name, risk_level: o.risk_level, membership_type: '', risk_reason: 'Follow-up from previous outreach' })}
                              className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-xs font-medium rounded-lg hover:bg-indigo-100 transition-colors"
                            >
                              Follow-up
                            </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
