import { createContext, useContext, useState, useCallback } from 'react'
import { STAFF, INITIAL_SHIFTS, INITIAL_LEAVE } from '../utils/rosterDemoData'

const RosterContext = createContext(null)

const LS_SHIFTS = 'gympulse_shifts'
const LS_STAFF  = 'gympulse_staff'
const LS_LEAVE  = 'gympulse_leave'

function loadLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback }
  catch { return fallback }
}
function saveLS(key, value) { localStorage.setItem(key, JSON.stringify(value)) }

export function RosterProvider({ children }) {
  const [staff,   setStaff]   = useState(() => loadLS(LS_STAFF,  STAFF))
  const [shifts,  setShifts]  = useState(() => loadLS(LS_SHIFTS, INITIAL_SHIFTS))
  const [leave,   setLeave]   = useState(() => loadLS(LS_LEAVE,  INITIAL_LEAVE))

  const addShift = useCallback((shift) => {
    setShifts(prev => { const n = [...prev, shift]; saveLS(LS_SHIFTS, n); return n })
  }, [])

  const updateShift = useCallback((id, updates) => {
    setShifts(prev => { const n = prev.map(s => s.id === id ? { ...s, ...updates } : s); saveLS(LS_SHIFTS, n); return n })
  }, [])

  const deleteShift = useCallback((id) => {
    setShifts(prev => { const n = prev.filter(s => s.id !== id); saveLS(LS_SHIFTS, n); return n })
  }, [])

  const addStaff = useCallback((member) => {
    setStaff(prev => { const n = [...prev, member]; saveLS(LS_STAFF, n); return n })
  }, [])

  const updateStaff = useCallback((id, updates) => {
    setStaff(prev => { const n = prev.map(s => s.id === id ? { ...s, ...updates } : s); saveLS(LS_STAFF, n); return n })
  }, [])

  const addLeave = useCallback((request) => {
    setLeave(prev => { const n = [...prev, request]; saveLS(LS_LEAVE, n); return n })
  }, [])

  const updateLeaveStatus = useCallback((id, status) => {
    setLeave(prev => { const n = prev.map(l => l.id === id ? { ...l, status } : l); saveLS(LS_LEAVE, n); return n })
  }, [])

  return (
    <RosterContext.Provider value={{ staff, shifts, leave, addShift, updateShift, deleteShift, addStaff, updateStaff, addLeave, updateLeaveStatus }}>
      {children}
    </RosterContext.Provider>
  )
}

export const useRoster = () => useContext(RosterContext)
