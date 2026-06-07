import { useState, useEffect } from 'react'
import { Plus, X, Mail, Phone, Clock, DollarSign, Edit2 } from 'lucide-react'
import { useRoster } from '../../contexts/RosterContext'

const ROLES = ['Coach', 'Reception', 'Cleaner', 'Manager', 'PT']
const COLOURS = ['#6366f1','#8b5cf6','#22c55e','#f97316','#14b8a6','#ec4899','#f59e0b','#3b82f6']

function StaffModal({ member, onSave, onClose }) {
  const isNew = !member.id
  const [form, setForm] = useState({
    name:             member.name             || '',
    role:             member.role             || 'Coach',
    email:            member.email            || '',
    phone:            member.phone            || '',
    hourlyRate:       member.hourlyRate       || 35,
    contractedHours:  member.contractedHours  || 25,
    colour:           member.colour           || COLOURS[0],
    avatar:           member.avatar           || '',
  })

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const save = () => {
    if (!form.name) return
    const initials = form.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    onSave({ ...member, ...form, avatar: initials, id: member.id || `S${Date.now()}` })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-slate-900">{isNew ? 'Add Staff Member' : 'Edit Staff Member'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          {[['name','Name','text'],['email','Email','email'],['phone','Phone','tel']].map(([k,l,t]) => (
            <div key={k}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{l}</label>
              <input type={t} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400">
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Hourly Rate ($)</label>
              <input type="number" value={form.hourlyRate} onChange={e => setForm({ ...form, hourlyRate: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contracted Hrs/wk</label>
              <input type="number" value={form.contractedHours} onChange={e => setForm({ ...form, contractedHours: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Colour</label>
            <div className="flex gap-2 flex-wrap">
              {COLOURS.map(c => (
                <button key={c} onClick={() => setForm({ ...form, colour: c })}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{ backgroundColor: c, borderColor: form.colour === c ? '#1e293b' : 'transparent' }} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600">Cancel</button>
          <button onClick={save} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            {isNew ? 'Add Staff' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

const ROLE_COLOURS = {
  Manager: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Coach:   'bg-purple-50 text-purple-700 border-purple-200',
  PT:      'bg-green-50 text-green-700 border-green-200',
  Reception: 'bg-orange-50 text-orange-700 border-orange-200',
  Cleaner: 'bg-pink-50 text-pink-700 border-pink-200',
}

export default function StaffProfiles() {
  const { staff, addStaff, updateStaff } = useRoster()
  const [modal, setModal] = useState(null)

  const avgRate = staff.length ? (staff.reduce((s, m) => s + m.hourlyRate, 0) / staff.length).toFixed(0) : 0
  const totalHours = staff.reduce((s, m) => s + m.contractedHours, 0)

  return (
    <div>
      {/* Summary + Add */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-4">
          {[
            { label: 'Total Staff', value: staff.length },
            { label: 'Avg Rate', value: `$${avgRate}/hr` },
            { label: 'Contracted Hrs/wk', value: totalHours },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 text-center min-w-28">
              <p className="text-lg font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        <button onClick={() => setModal({ id: '', name: '', role: 'Coach', email: '', phone: '', hourlyRate: 35, contractedHours: 25, colour: COLOURS[0], avatar: '' })}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus size={15} /> Add Staff Member
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {staff.map(member => (
          <div key={member.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                style={{ backgroundColor: member.colour }}>
                {member.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 truncate">{member.name}</p>
                <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border mt-1 ${ROLE_COLOURS[member.role] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                  {member.role}
                </span>
              </div>
              <button onClick={() => setModal(member)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 flex-shrink-0">
                <Edit2 size={14} />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Mail size={13} className="text-slate-400 flex-shrink-0" />
                <span className="truncate">{member.email}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Phone size={13} className="text-slate-400 flex-shrink-0" />
                <span>{member.phone}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <DollarSign size={13} className="text-slate-400" />
                  <span className="font-semibold">${member.hourlyRate}/hr</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Clock size={13} className="text-slate-400" />
                  <span>{member.contractedHours}h/wk</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <StaffModal
          member={modal}
          onSave={modal.id ? updateStaff.bind(null, modal.id) : addStaff}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
