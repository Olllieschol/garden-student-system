import { useState, useEffect } from 'react'
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addDays, parseISO, differenceInMinutes } from 'date-fns'
import { useRoster } from '../../contexts/RosterContext'
import clsx from 'clsx'

const HOUR_START = 5   // 05:00
const HOUR_END   = 22  // 22:00
const TOTAL_HOURS = HOUR_END - HOUR_START
const ROW_HEIGHT = 56  // px per hour

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToPx(minutes) {
  return (minutes / 60) * ROW_HEIGHT
}

function shiftTop(startTime) {
  return minutesToPx(timeToMinutes(startTime) - HOUR_START * 60)
}

function shiftHeight(startTime, endTime) {
  return minutesToPx(differenceInMinutes(
    new Date(`2000-01-01T${endTime}`),
    new Date(`2000-01-01T${startTime}`)
  ))
}

const ROLES = ['Coach', 'Reception', 'Cleaner', 'Manager', 'PT']

function ShiftModal({ shift, staff, onSave, onDelete, onClose }) {
  const isNew = !shift.id
  const [form, setForm] = useState({
    staffId:   shift.staffId   || staff[0]?.id || '',
    date:      shift.date      || format(new Date(), 'yyyy-MM-dd'),
    startTime: shift.startTime || '09:00',
    endTime:   shift.endTime   || '17:00',
    role:      shift.role      || 'Coach',
    notes:     shift.notes     || '',
  })

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const save = () => {
    if (!form.staffId || !form.date || !form.startTime || !form.endTime) return
    onSave({ ...shift, ...form })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-slate-900">{isNew ? 'Add Shift' : 'Edit Shift'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Staff Member</label>
            <select value={form.staffId} onChange={e => setForm({ ...form, staffId: e.target.value, role: staff.find(s => s.id === e.target.value)?.role || form.role })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400">
              {staff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start</label>
              <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">End</label>
              <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400">
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          {!isNew && (
            <button onClick={() => { onDelete(shift.id); onClose() }}
              className="px-4 py-2.5 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors">
              Delete
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={save} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            {isNew ? 'Add Shift' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function WeeklyCalendar({ weekStart }) {
  const { staff, shifts, leave, addShift, updateShift, deleteShift } = useRoster()
  const [modal, setModal] = useState(null) // null | shift object (with id='' for new)
  const [dragging, setDragging] = useState(null)

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => HOUR_START + i)

  // Approved leave for this week
  const approvedLeave = leave.filter(l => l.status === 'Approved')
  const isOnLeave = (staffId, date) => {
    const d = format(date, 'yyyy-MM-dd')
    return approvedLeave.some(l => l.staffId === staffId && l.startDate <= d && l.endDate >= d)
  }

  // Shifts for a given day
  const dayShifts = (date) => {
    const d = format(date, 'yyyy-MM-dd')
    return shifts.filter(s => s.date === d)
  }

  // Day totals
  const dayHours = (date) => {
    const mins = dayShifts(date).reduce((acc, s) => {
      return acc + differenceInMinutes(new Date(`2000-01-01T${s.endTime}`), new Date(`2000-01-01T${s.startTime}`))
    }, 0)
    return (mins / 60).toFixed(1)
  }

  const dayCost = (date) => {
    return dayShifts(date).reduce((acc, s) => {
      const member = staff.find(m => m.id === s.staffId)
      if (!member) return acc
      const hrs = differenceInMinutes(new Date(`2000-01-01T${s.endTime}`), new Date(`2000-01-01T${s.startTime}`)) / 60
      return acc + hrs * member.hourlyRate
    }, 0)
  }

  // Drag handlers (HTML5 native — @dnd-kit is overkill for date-swap use case)
  const handleDragStart = (shiftId) => setDragging(shiftId)
  const handleDrop = (date) => {
    if (!dragging) return
    updateShift(dragging, { date: format(date, 'yyyy-MM-dd') })
    setDragging(null)
  }

  const openNew = (date) => {
    setModal({ id: '', date: format(date, 'yyyy-MM-dd'), staffId: staff[0]?.id || '', startTime: '09:00', endTime: '17:00', role: 'Coach', notes: '' })
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="flex border-b border-slate-100">
        {/* Time gutter */}
        <div className="w-14 flex-shrink-0 bg-slate-50 border-r border-slate-100 px-2 py-3">
          <span className="text-xs text-slate-400">Time</span>
        </div>
        {days.map((day) => (
          <div key={day.toISOString()} className="flex-1 min-w-0 border-r border-slate-100 last:border-r-0 px-2 py-3 bg-slate-50">
            <p className="text-xs font-semibold text-slate-700 truncate">{format(day, 'EEE')}</p>
            <p className={clsx('text-sm font-bold', format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'text-indigo-600' : 'text-slate-900')}>
              {format(day, 'd MMM')}
            </p>
            <button onClick={() => openNew(day)}
              className="mt-1 flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition-colors">
              <Plus size={11} /> Add
            </button>
          </div>
        ))}
      </div>

      {/* Calendar body */}
      <div className="flex overflow-auto" style={{ maxHeight: 480 }}>
        {/* Hour labels */}
        <div className="w-14 flex-shrink-0 border-r border-slate-100 bg-slate-50">
          {hours.map(h => (
            <div key={h} className="border-b border-slate-100 flex items-start justify-end pr-2 pt-1" style={{ height: ROW_HEIGHT }}>
              <span className="text-xs text-slate-400">{String(h).padStart(2, '0')}:00</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day) => {
          const ds = dayShifts(day)
          return (
            <div key={day.toISOString()} className="flex-1 min-w-0 border-r border-slate-100 last:border-r-0 relative"
              style={{ height: TOTAL_HOURS * ROW_HEIGHT }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(day)}>
              {/* Hour grid lines */}
              {hours.map(h => (
                <div key={h} className="absolute w-full border-b border-slate-50" style={{ top: (h - HOUR_START) * ROW_HEIGHT, height: ROW_HEIGHT }} />
              ))}

              {/* Leave indicator */}
              {staff.map(member => isOnLeave(member.id, day) && (
                <div key={member.id} className="absolute left-0 right-0 mx-1 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center"
                  style={{ top: 2, height: 18 }}>
                  <span className="text-xs text-slate-400 truncate px-1">{member.name.split(' ')[0]} — leave</span>
                </div>
              ))}

              {/* Shift blocks */}
              {ds.map(shift => {
                const member = staff.find(m => m.id === shift.staffId)
                if (!member) return null
                const top = shiftTop(shift.startTime)
                const height = shiftHeight(shift.startTime, shift.endTime)
                const hrs = (differenceInMinutes(new Date(`2000-01-01T${shift.endTime}`), new Date(`2000-01-01T${shift.startTime}`)) / 60).toFixed(1)
                return (
                  <div key={shift.id}
                    draggable
                    onDragStart={() => handleDragStart(shift.id)}
                    onClick={() => setModal(shift)}
                    className="absolute left-1 right-1 rounded-lg cursor-grab active:cursor-grabbing px-2 py-1 overflow-hidden hover:brightness-110 transition-all shadow-sm"
                    style={{ top: top + 2, height: height - 4, backgroundColor: member.colour }}>
                    <p className="text-white text-xs font-semibold leading-tight truncate">{member.name.split(' ')[0]}</p>
                    <p className="text-white/80 text-xs leading-tight truncate">{shift.startTime}–{shift.endTime}</p>
                    {height > 50 && <p className="text-white/70 text-xs">{hrs}h · {shift.role}</p>}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Footer totals */}
      <div className="flex border-t border-slate-100">
        <div className="w-14 flex-shrink-0 border-r border-slate-100 bg-slate-50 px-1 py-2">
          <span className="text-xs text-slate-400">Total</span>
        </div>
        {days.map(day => (
          <div key={day.toISOString()} className="flex-1 min-w-0 border-r border-slate-100 last:border-r-0 px-2 py-2 bg-slate-50">
            <p className="text-xs font-semibold text-slate-700">{dayHours(day)}h</p>
            <p className="text-xs text-slate-500">${dayCost(day).toFixed(0)}</p>
          </div>
        ))}
      </div>

      {modal && (
        <ShiftModal
          shift={modal}
          staff={staff}
          onSave={modal.id ? (s) => updateShift(s.id, s) : addShift}
          onDelete={deleteShift}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
