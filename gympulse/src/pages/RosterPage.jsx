import { useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Users, Clock, FileText } from 'lucide-react'
import { addWeeks, startOfWeek, format } from 'date-fns'
import { RosterProvider } from '../contexts/RosterContext'
import WeeklyCalendar from '../components/roster/WeeklyCalendar'
import StaffProfiles from '../components/roster/StaffProfiles'
import TimesheetView from '../components/roster/TimesheetView'
import LeaveRequests from '../components/roster/LeaveRequests'
import clsx from 'clsx'

const TABS = [
  { id: 'roster',    label: 'Weekly Roster',  icon: CalendarDays },
  { id: 'staff',     label: 'Staff Profiles', icon: Users },
  { id: 'timesheet', label: 'Timesheets',     icon: Clock },
  { id: 'leave',     label: 'Leave Requests', icon: FileText },
]

function RosterContent() {
  const [tab, setTab] = useState('roster')
  const [weekOffset, setWeekOffset] = useState(0)

  const weekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff Roster</h1>
          <p className="text-slate-500 text-sm mt-0.5">Replace Deputy — schedule, track, and pay your team</p>
        </div>

        {/* Week navigator (shown for roster + timesheet tabs) */}
        {(tab === 'roster' || tab === 'timesheet') && (
          <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-100 shadow-sm px-3 py-2">
            <button onClick={() => setWeekOffset(o => o - 1)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-800">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-slate-700 min-w-36 text-center">
              {weekOffset === 0 ? 'This week' : weekOffset === 1 ? 'Next week' : weekOffset === -1 ? 'Last week' : `Week of ${format(weekStart, 'd MMM')}`}
            </span>
            <button onClick={() => setWeekOffset(o => o + 1)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-800">
              <ChevronRight size={16} />
            </button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="ml-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                Today
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}>
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'roster'    && <WeeklyCalendar weekStart={weekStart} />}
      {tab === 'staff'     && <StaffProfiles />}
      {tab === 'timesheet' && <TimesheetView weekStart={weekStart} />}
      {tab === 'leave'     && <LeaveRequests />}
    </div>
  )
}

export default function RosterPage() {
  return (
    <RosterProvider>
      <RosterContent />
    </RosterProvider>
  )
}
