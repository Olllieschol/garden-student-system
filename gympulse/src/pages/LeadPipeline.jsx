import { useState, useEffect } from 'react'
import { Plus, X, Share2 as Instagram, Globe, Users, MapPin, ChevronRight, Clock, MessageSquare } from 'lucide-react'
import { useData } from '../contexts/DataContext'
import { useComposer } from '../contexts/ComposerContext'
import { differenceInDays, parseISO } from 'date-fns'
import { format } from 'date-fns'
import Avatar from '../components/common/Avatar'
import clsx from 'clsx'

const STAGES = [
  { id: 'enquiry', label: 'Enquiry Received', color: 'border-slate-300' },
  { id: 'trial_booked', label: 'Trial Booked', color: 'border-blue-400' },
  { id: 'trial_completed', label: 'Trial Completed', color: 'border-violet-400' },
  { id: 'follow_up_sent', label: 'Follow-up Sent', color: 'border-amber-400' },
  { id: 'converted', label: 'Converted ✅', color: 'border-green-400' },
]

const SOURCE_ICONS = { Instagram: Instagram, Google: Globe, Referral: Users, 'Walk-in': MapPin }

function LeadCard({ lead, onMove, onSelect, onDelete }) {
  const daysInStage = differenceInDays(new Date(), parseISO(lead.added))
  const stale = daysInStage >= 3 && lead.stage !== 'converted'

  return (
    <div
      onClick={() => onSelect(lead)}
      className={clsx(
        'group bg-white rounded-xl border-l-4 p-3 shadow-sm cursor-pointer hover:shadow-md transition-all relative',
        stale ? 'border-amber-400' : 'border-slate-200'
      )}
    >
      {/* Delete button — visible on hover */}
      <button
        aria-label={`Remove ${lead.name} from pipeline`}
        onClick={e => { e.stopPropagation(); if (window.confirm(`Remove ${lead.name} from pipeline?`)) onDelete(lead.id) }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"
      >
        <X size={12} />
      </button>
      <div className="flex items-start gap-2.5 mb-2">
        <Avatar name={lead.name} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm truncate">{lead.name}</p>
          <p className="text-xs text-slate-400">{lead.source}</p>
        </div>
        {stale && <Clock size={13} className="text-amber-500 flex-shrink-0 mt-0.5 mr-4" />}
      </div>
      {lead.notes && <p className="text-xs text-slate-500 mb-2 line-clamp-2">{lead.notes}</p>}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{daysInStage}d ago</span>
        {lead.stage !== 'converted' && (
          <button
            onClick={e => { e.stopPropagation(); const idx = STAGES.findIndex(s => s.id === lead.stage); if (idx < STAGES.length - 1) onMove(lead.id, STAGES[idx + 1].id) }}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Move <ChevronRight size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

function AddLeadModal({ onAdd, onClose }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', source: 'Instagram', notes: '' })
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])
  const submit = (e) => {
    e.preventDefault()
    onAdd({ ...form, id: `L${Date.now()}`, stage: 'enquiry', added: format(new Date(), 'yyyy-MM-dd') })
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-slate-900">Add New Lead</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {[['name','Name','text',true],['phone','Phone','tel',false],['email','Email','email',false]].map(([k,l,t,req]) => (
            <div key={k}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{l}</label>
              <input type={t} required={req} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Source</label>
            <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400">
              {['Instagram', 'Google', 'Referral', 'Walk-in'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Add Lead</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LeadDetailPanel({ lead, onClose, onMove }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-80 bg-white h-full overflow-y-auto shadow-2xl p-5 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-slate-900">Lead Details</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <Avatar name={lead.name} size="lg" />
          <div>
            <p className="font-bold text-slate-900">{lead.name}</p>
            <p className="text-sm text-slate-500">{lead.source}</p>
          </div>
        </div>
        <div className="space-y-2 text-sm mb-5">
          {lead.phone && <p className="text-slate-600">{lead.phone}</p>}
          {lead.email && <p className="text-slate-600">{lead.email}</p>}
          <p className="text-slate-500">Added {lead.added}</p>
        </div>
        {lead.notes && <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 mb-5">{lead.notes}</div>}
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">Move to Stage</p>
          <div className="space-y-1.5">
            {STAGES.map(s => (
              <button key={s.id} onClick={() => { onMove(lead.id, s.id); onClose() }}
                className={clsx('w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors', lead.stage === s.id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:border-indigo-300')}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LeadPipeline() {
  const { leads, addLead, moveLead, deleteLead } = useData()
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState(null)

  const total = leads.length
  const trialsBooked = leads.filter(l => ['trial_booked','trial_completed','follow_up_sent','converted'].includes(l.stage)).length
  const converted = leads.filter(l => l.stage === 'converted').length
  const convRate = total ? Math.round(converted / total * 100) : 0
  const trialRate = total ? Math.round(trialsBooked / total * 100) : 0

  return (
    <div className="p-6 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lead Pipeline</h1>
          <p className="text-slate-500 text-sm mt-0.5">Track prospects from enquiry to membership</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus size={16} /> Add Lead
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{total}</p>
          <p className="text-xs text-slate-500 mt-1">Total Leads This Month</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{trialRate}%</p>
          <p className="text-xs text-slate-500 mt-1">Trial Booked Rate</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{convRate}%</p>
          <p className="text-xs text-slate-500 mt-1">Conversion Rate</p>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const stageLeads = leads.filter(l => l.stage === stage.id)
          return (
            <div key={stage.id} className="flex-shrink-0 w-56">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{stage.label}</h3>
                <span className="bg-slate-100 text-slate-500 text-xs font-medium px-2 py-0.5 rounded-full">{stageLeads.length}</span>
              </div>
              <div className="space-y-2.5 min-h-24">
                {stageLeads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} onMove={moveLead} onSelect={setSelected} onDelete={deleteLead} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {showAdd && <AddLeadModal onAdd={addLead} onClose={() => setShowAdd(false)} />}
      {selected && <LeadDetailPanel lead={selected} onClose={() => setSelected(null)} onMove={moveLead} />}
    </div>
  )
}
