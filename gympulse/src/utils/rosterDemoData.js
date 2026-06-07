import { format, addDays, startOfWeek } from 'date-fns'

export const STAFF = [
  { id: 'S1', name: 'Alex Thompson',  role: 'Manager',   email: 'alex@gympulse.com',   phone: '0411 001 001', hourlyRate: 65, colour: '#6366f1', avatar: 'AT', contractedHours: 38 },
  { id: 'S2', name: 'Sarah Mitchell', role: 'Coach',     email: 'sarah@gympulse.com',  phone: '0422 002 002', hourlyRate: 55, colour: '#8b5cf6', avatar: 'SM', contractedHours: 35 },
  { id: 'S3', name: "James O'Brien",  role: 'PT',        email: 'james@gympulse.com',  phone: '0433 003 003', hourlyRate: 48, colour: '#22c55e', avatar: 'JO', contractedHours: 30 },
  { id: 'S4', name: 'Mia Nguyen',     role: 'Reception', email: 'mia@gympulse.com',    phone: '0444 004 004', hourlyRate: 28, colour: '#f97316', avatar: 'MN', contractedHours: 25 },
  { id: 'S5', name: 'Carlos Rivera',  role: 'PT',        email: 'carlos@gympulse.com', phone: '0455 005 005', hourlyRate: 45, colour: '#14b8a6', avatar: 'CR', contractedHours: 30 },
  { id: 'S6', name: 'Lily Chen',      role: 'Cleaner',   email: 'lily@gympulse.com',   phone: '0466 006 006', hourlyRate: 25, colour: '#ec4899', avatar: 'LC', contractedHours: 20 },
]

// Build 3 weeks of shifts centred on the current week
function makeShifts() {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday
  const shifts = []
  let id = 1

  const templates = [
    // [staffId, dayOffset (0=Mon), start, end]
    ['S1', 0, '08:00', '16:00'], ['S1', 1, '08:00', '16:00'], ['S1', 2, '08:00', '16:00'], ['S1', 3, '08:00', '16:00'], ['S1', 4, '08:00', '14:00'],
    ['S2', 0, '06:00', '14:00'], ['S2', 1, '06:00', '14:00'], ['S2', 2, '06:00', '14:00'], ['S2', 4, '06:00', '14:00'], ['S2', 5, '07:00', '13:00'],
    ['S3', 1, '09:00', '17:00'], ['S3', 2, '09:00', '17:00'], ['S3', 3, '09:00', '17:00'], ['S3', 5, '08:00', '14:00'], ['S3', 6, '08:00', '12:00'],
    ['S4', 0, '07:00', '13:00'], ['S4', 1, '07:00', '13:00'], ['S4', 2, '07:00', '13:00'], ['S4', 3, '07:00', '13:00'], ['S4', 4, '07:00', '13:00'],
    ['S5', 0, '14:00', '20:00'], ['S5', 1, '14:00', '20:00'], ['S5', 3, '14:00', '20:00'], ['S5', 4, '14:00', '20:00'], ['S5', 6, '09:00', '15:00'],
    ['S6', 0, '05:00', '09:00'], ['S6', 2, '05:00', '09:00'], ['S6', 4, '05:00', '09:00'], ['S6', 5, '06:00', '10:00'],
  ]

  for (let week = -1; week <= 1; week++) {
    templates.forEach(([staffId, dayOff, start, end]) => {
      const date = addDays(weekStart, week * 7 + dayOff)
      shifts.push({
        id: `SH${id++}`,
        staffId,
        date: format(date, 'yyyy-MM-dd'),
        startTime: start,
        endTime: end,
        role: STAFF.find(s => s.id === staffId)?.role || 'Coach',
        notes: '',
      })
    })
  }
  return shifts
}

export const INITIAL_SHIFTS = makeShifts()

export const INITIAL_LEAVE = [
  { id: 'L1', staffId: 'S3', type: 'Annual',   startDate: format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 7),  'yyyy-MM-dd'), endDate: format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 11), 'yyyy-MM-dd'), status: 'Approved',  reason: 'Family holiday', submittedAt: '2025-04-20' },
  { id: 'L2', staffId: 'S4', type: 'Sick',     startDate: format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 1),  'yyyy-MM-dd'), endDate: format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 2),  'yyyy-MM-dd'), status: 'Approved',  reason: 'Flu',            submittedAt: '2025-05-01' },
  { id: 'L3', staffId: 'S2', type: 'Personal', startDate: format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 14), 'yyyy-MM-dd'), endDate: format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 14), 'yyyy-MM-dd'), status: 'Pending',   reason: 'Appointment',    submittedAt: '2025-05-02' },
  { id: 'L4', staffId: 'S5', type: 'Unpaid',   startDate: format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 10), 'yyyy-MM-dd'), endDate: format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 11), 'yyyy-MM-dd'), status: 'Declined',  reason: 'Personal event', submittedAt: '2025-04-28' },
]
