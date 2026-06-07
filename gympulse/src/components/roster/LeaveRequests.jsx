import { useState, useEffect } from 'react'
import { Plus, X, CheckCircle, XCircle, Clock } from 'lucide-react'
import { format, differenceInCalendarDays, parseISO, addDays, startOfWeek } from 'date-fns'
import { useRoster } from '../../contexts/RosterContext'
import clsx from 'clsx'

const LEAVE_TYPES = ['Annual', 'Sick', 'Personal', 'Unpaid']

const STATUS_STYLES = {
  Pending:  'bg-amber-50 text-amber-700 border-amber-200',
  Approved: 'bg-green-50 text-green-700 border-green-200',
  Declined: 'bg-red-50 text-red-700 border-red-200',
}

const TYPE_STYLES = {
  Annual:   'bg-blue-50 text-blue-700 border-blue-200',
  Sick:     'bg-red-50 text-red-700 border-red-200',
  Personal: 'bg-violet-50 text-violet-700 border-violet-200',
  Unpaid:   'bg-slate-100 text-slate-600 border-slate-200',
}

function LeaveModal({ staff, onSave, onClose }) {
  const [form, setForm] = useState({
    staffId: staff[0]?.id || '',
    type: 'Annual',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate:   format(new Date(), 'yyyy-MM-dd'),
    reason: '',
  })

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const save = () => {
    if (!form.staffId || !form.startDate || !form.endDate) return
    onSave({
      id: `L${Date.now()}`,
      ...form,
      status: 'Pending',
      submittedAt: format(new Date(), 'yyyy-MM-dd'),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-slate-900">New Leave Request</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Staff Member</label>
            <select value={form.staffId} onChange={e => setForm({ ...form, staffId: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400">
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Leave Type</label>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400">
              {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
              <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
              <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Reason (optional)</label>
            <input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600">Cancel</button>
          <button onClick={save} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">Submit Request</button>
        </div>
      </div>
    </div>
  )
}

export default function LeaveRequests() {
  const { staff, leave, addLeave, updateLeaveStatus } = useRoster()
  const [filterStatus, setFilterStatus] = useState('All')
  const [showModal, setShowModal] = useState(false)

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekEnd = addDays(weekStart, 6)
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd')
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')

  const onLeaveThisWeek = leave.filter(l =>
    l.status === 'Approved' && l.startDate <= weekEndStr && l.endDate >= weekStartStr
  ).length

  const pending  = leave.filter(l => l.status === 'Pending').length
  const approved = leave.filter(l => l.status === 'Approved').length

  const filtered = filterStatus === 'All' ? leave : leave.filter(l => l.status === filterStatus)

  return (
    <div>
      {/* Summary */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-4">
          {[
            { label: 'Pending', value: pending, colour: 'text-amber-600' },
            { label: 'Approved', value: approved, colour: 'text-green-600' },
            { label: 'On Leave This Week', value: onLeaveThisWeek, colour: 'text-indigo-600' },
          ].map(({ label, value, colour }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 text-center min-w-28">
              <p className={clsx('text-lg font-bold', colour)}>{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus size={15} /> New Request
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-4">
        {['All', 'Pending', 'Approved', 'Declined'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors', filterStatus === s
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'border-slate-200 text-slate-600 hover:border-slate-300')}>
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Clock size={32} className="text-slate-200 mb-3" />
            <p className="font-medium text-slate-600">No leave requests</p>
            <p className="text-sm text-slate-400 mt-1">Leave requests will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Staff Member', 'Type', 'Dates', 'Duration', 'Reason', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(req => {
                  const member = staff.find(s => s.id === req.staffId)
                  const days = differenceInCalendarDays(parseISO(req.endDate), parseISO(req.startDate)) + 1
                  return (
                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        {member ? (
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: member.colour }}>
                              {member.avatar}
                            </div>
                            <p className="font-medium text-slate-900 text-sm">{member.name}</p>
                          </div>
                        ) : <span className="text-slate-400 text-sm">Unknown</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${TYPE_STYLES[req.type] || ''}`}>
                          {req.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {format(parseISO(req.startDate), 'd MMM')} – {format(parseISO(req.endDate), 'd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{days} day{days !== 1 ? 's' : ''}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 max-w-32 truncate">{req.reason || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_STYLES[req.status]}`}>
                          {req.status === 'Approved' && <CheckCircle size={11} />}
                          {req.status === 'Declined' && <XCircle size={11} />}
                          {req.status === 'Pending'  && <Clock size={11} />}
                          {req.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {req.status === 'Pending' ? (
                          <div className="flex gap-2">
                            <button onClick={() => updateLeaveStatus(req.id, 'Approved')}
                              className="px-2.5 py-1 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors">
                              Approve
                            </button>
                            <button onClick={() => updateLeaveStatus(req.id, 'Declined')}
                              className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors">
                              Decline
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => updateLeaveStatus(req.id, 'Pending')}
                            className="px-2.5 py-1 border border-slate-200 text-slate-500 text-xs font-medium rounded-lg hover:border-slate-300 transition-colors">
                            Revert
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && <LeaveModal staff={staff} onSave={addLeave} onClose={() => setShowModal(false)} />}
    </div>
  )
}
