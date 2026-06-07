import { useState } from 'react'
import { Download } from 'lucide-react'
import { format, addDays, differenceInMinutes } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useRoster } from '../../contexts/RosterContext'
import clsx from 'clsx'

function shiftHours(shifts) {
  return shifts.reduce((acc, s) => {
    return acc + differenceInMinutes(new Date(`2000-01-01T${s.endTime}`), new Date(`2000-01-01T${s.startTime}`)) / 60
  }, 0)
}

export default function TimesheetView({ weekStart }) {
  const { staff, shifts } = useRoster()
  const [revenueTarget, setRevenueTarget] = useState(8000)

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Hours per staff per day
  const hoursMatrix = staff.map(member => {
    const dayHours = days.map(day => {
      const d = format(day, 'yyyy-MM-dd')
      const dayShifts = shifts.filter(s => s.staffId === member.id && s.date === d)
      return shiftHours(dayShifts)
    })
    const totalHours = dayHours.reduce((a, b) => a + b, 0)
    const totalPay = totalHours * member.hourlyRate
    return { member, dayHours, totalHours, totalPay }
  })

  const colTotals = days.map((_, di) => hoursMatrix.reduce((a, row) => a + row.dayHours[di], 0))
  const colCosts  = days.map((_, di) => hoursMatrix.reduce((a, row) => a + row.dayHours[di] * row.member.hourlyRate, 0))
  const grandHours = hoursMatrix.reduce((a, r) => a + r.totalHours, 0)
  const grandCost  = hoursMatrix.reduce((a, r) => a + r.totalPay, 0)

  // Labour cost by role
  const roleCosts = {}
  hoursMatrix.forEach(({ member, totalPay }) => {
    roleCosts[member.role] = (roleCosts[member.role] || 0) + totalPay
  })
  const roleChart = Object.entries(roleCosts).map(([role, cost]) => ({ role, cost: Math.round(cost) }))

  const exportCSV = () => {
    const dayLabels = days.map(d => format(d, 'EEE'))
    const header = ['Staff Name', 'Role', ...dayLabels, 'Total Hours', 'Hourly Rate', 'Total Pay']
    const rows = hoursMatrix.map(({ member, dayHours, totalHours, totalPay }) => [
      member.name, member.role,
      ...dayHours.map(h => h.toFixed(1)),
      totalHours.toFixed(1), `$${member.hourlyRate}`, `$${totalPay.toFixed(2)}`
    ])
    const csv = [header, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `timesheet_${format(weekStart, 'yyyy-MM-dd')}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const ROLE_COLOURS_BAR = { Manager: '#6366f1', Coach: '#8b5cf6', PT: '#22c55e', Reception: '#f97316', Cleaner: '#ec4899' }

  return (
    <div className="space-y-5">
      {/* Timesheet table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Weekly Timesheet — {format(weekStart, 'd MMM yyyy')}</h3>
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:border-slate-300 hover:text-slate-800 transition-colors">
            <Download size={14} /> Export Payroll CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Staff</th>
                {days.map(d => (
                  <th key={d.toISOString()} className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {format(d, 'EEE d')}
                  </th>
                ))}
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Hrs</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Rate</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {hoursMatrix.map(({ member, dayHours, totalHours, totalPay }) => {
                const overHours = totalHours > member.contractedHours
                return (
                  <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: member.colour }}>
                          {member.avatar}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{member.name}</p>
                          <p className="text-xs text-slate-400">{member.role}</p>
                        </div>
                      </div>
                    </td>
                    {dayHours.map((hrs, di) => (
                      <td key={di} className="text-center px-2 py-3">
                        {hrs > 0
                          ? <span className="text-slate-700 font-medium">{hrs.toFixed(1)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                    ))}
                    <td className={clsx('text-center px-3 py-3 font-semibold', overHours ? 'text-amber-600' : 'text-slate-900')}>
                      {totalHours.toFixed(1)}
                      {overHours && <span className="text-xs ml-1">⚠</span>}
                    </td>
                    <td className="text-center px-3 py-3 text-slate-600">${member.hourlyRate}</td>
                    <td className="text-center px-3 py-3 font-semibold text-slate-900">${totalPay.toFixed(0)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                <td className="px-4 py-3 text-slate-700">Totals</td>
                {colTotals.map((hrs, i) => (
                  <td key={i} className="text-center px-2 py-3 text-slate-700">{hrs > 0 ? hrs.toFixed(1) : '—'}</td>
                ))}
                <td className="text-center px-3 py-3 text-slate-900">{grandHours.toFixed(1)}</td>
                <td className="text-center px-3 py-3 text-slate-400">—</td>
                <td className="text-center px-3 py-3 text-indigo-600">${grandCost.toFixed(0)}</td>
              </tr>
              <tr className="bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
                <td className="px-4 py-2">Daily cost</td>
                {colCosts.map((cost, i) => (
                  <td key={i} className="text-center px-2 py-2">{cost > 0 ? `$${cost.toFixed(0)}` : '—'}</td>
                ))}
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Labour cost calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Labour Cost Breakdown by Role</h3>
          <ResponsiveContainer width="100%" height={Math.max(120, roleChart.length * 44 + 20)}>
            <BarChart data={roleChart} barSize={20} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <YAxis type="category" dataKey="role" width={72} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={v => [`$${v}`, 'Labour Cost']} contentStyle={{ borderRadius: 8, fontSize: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="cost" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {roleChart.map((d) => <Cell key={d.role} fill={ROLE_COLOURS_BAR[d.role] || '#6366f1'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Labour Cost vs Revenue</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Weekly Revenue Target ($)</label>
              <input type="number" value={revenueTarget} onChange={e => setRevenueTarget(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            {[
              { label: 'Total Weekly Labour', value: `$${grandCost.toFixed(0)}`, sub: 'this week' },
              { label: 'Labour as % of Revenue', value: `${revenueTarget > 0 ? ((grandCost / revenueTarget) * 100).toFixed(1) : 0}%`, sub: revenueTarget > 0 && grandCost / revenueTarget > 0.4 ? '⚠ above 40% threshold' : 'within target', warn: revenueTarget > 0 && grandCost / revenueTarget > 0.4 },
              { label: 'vs Last Week', value: '-5%', sub: 'week-over-week', positive: true },
            ].map(({ label, value, sub, warn, positive }) => (
              <div key={label} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-700">{label}</p>
                  <p className={clsx('text-xs mt-0.5', warn ? 'text-amber-600' : positive ? 'text-green-600' : 'text-slate-400')}>{sub}</p>
                </div>
                <p className={clsx('text-lg font-bold', warn ? 'text-amber-600' : positive ? 'text-green-600' : 'text-slate-900')}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
