import { useState, useMemo } from 'react'
import { Save, CheckCircle, Eye, EyeOff, Download, Key, Sliders, User, Building, Sparkles, RefreshCw, Trash2 } from 'lucide-react'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-5">
        <Icon size={18} className="text-indigo-500" />
        <h2 className="font-semibold text-slate-800">{title}</h2>
      </div>
      {children}
    </div>
  )
}

const TONE_OPTIONS = [
  { value: 'friendly',      label: 'Friendly',      desc: 'Warm, casual and encouraging' },
  { value: 'professional',  label: 'Professional',  desc: 'Clear, polished and formal' },
  { value: 'motivational',  label: 'Motivational',  desc: 'Energetic and inspiring' },
  { value: 'urgent',        label: 'Urgent',        desc: 'Direct and action-focused' },
]

function buildSampleMessages(form) {
  const gym = form.gymName || 'GymPulse'
  const coach = form.coachName || 'Coach'
  const cn = form.customerName || 'member'
  const cn_cap = cn.charAt(0).toUpperCase() + cn.slice(1)
  const tone = form.aiTone || 'friendly'

  const openers = {
    friendly: ['Hey', 'Hi', 'Hey there'],
    professional: ['Hello', 'Hi', 'Good morning'],
    motivational: ['Hey champion', 'Hi legend', 'Hey'],
    urgent: ['Hi', 'Hello', 'Hi'],
  }
  const opener = openers[tone][0]

  const toneClosings = {
    friendly: `See you soon!\n${coach} @ ${gym}`,
    professional: `Please don't hesitate to reach out.\n${coach}, ${gym}`,
    motivational: `Let's go — your best session is ahead of you!\n${coach} @ ${gym}`,
    urgent: `Please book your next session today.\n${coach}, ${gym}`,
  }
  const closing = toneClosings[tone]

  return [
    {
      label: 'At-Risk Re-engagement',
      risk: 'red',
      text: `${opener} [Name], we noticed you haven't been in for a while and wanted to check in. Your ${gym} community misses you — is everything okay? We'd love to help get you back on track. ${closing}`,
    },
    {
      label: 'Attendance Drop',
      risk: 'amber',
      text: `${opener} [Name]! We've noticed your attendance has dipped a bit this month. Life gets busy, we get it. Just know your spot at ${gym} is always here — would love to see you back. ${closing}`,
    },
    {
      label: 'Booking Reminder',
      risk: 'green',
      text: `${opener} [Name]! Just a friendly reminder — your next session at ${gym} is coming up. Remember to book early as spots fill fast. See you on the floor! ${closing}`,
    },
    {
      label: 'Welcome New Member',
      risk: 'green',
      text: `Welcome to ${gym}, [Name]! We're so excited to have you as a new ${cn}. Your first session is booked and we can't wait to meet you. If you have any questions before you start, just reply to this message. ${closing}`,
    },
  ]
}

function AISection({ form, setForm }) {
  const samples = useMemo(() => buildSampleMessages(form), [form])

  const riskBadge = (risk) => risk === 'red'
    ? 'bg-red-50 text-red-700 border-red-200'
    : risk === 'amber'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-green-50 text-green-700 border-green-200'

  return (
    <Section title="GymPulse AI" icon={Sparkles}>
      <div className="space-y-5">
        {/* Business type + customer name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Business Type</label>
            <input value={form.businessType || ''} onChange={e => setForm({ ...form, businessType: e.target.value })}
              placeholder="e.g. CrossFit Box, Yoga Studio"
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Call Members</label>
            <select value={form.customerName || 'member'} onChange={e => setForm({ ...form, customerName: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 bg-white">
              {['member', 'client', 'athlete', 'student', 'customer'].map(v => (
                <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}s</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tone selector */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Message Tone</label>
          <div className="grid grid-cols-2 gap-2">
            {TONE_OPTIONS.map(t => (
              <button key={t.value} onClick={() => setForm({ ...form, aiTone: t.value })}
                className={`px-4 py-3 rounded-lg border text-left transition-colors ${
                  form.aiTone === t.value
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}>
                <p className="text-sm font-semibold">{t.label}</p>
                <p className="text-xs opacity-70 mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Business description */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Business Description</label>
          <textarea value={form.businessDescription || ''} onChange={e => setForm({ ...form, businessDescription: e.target.value })}
            placeholder="Briefly describe your gym, its community, specialties, and what makes it unique..."
            rows={3}
            className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
          <p className="text-xs text-slate-400 mt-1">AI uses this to personalise messages</p>
        </div>

        {/* AI guidelines */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">AI Guidelines</label>
          <textarea value={form.aiGuidelines || ''} onChange={e => setForm({ ...form, aiGuidelines: e.target.value })}
            placeholder="e.g. Never offer discounts in messages. Always mention our class schedule. Keep messages under 160 characters..."
            rows={3}
            className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
          <p className="text-xs text-slate-400 mt-1">Rules the AI will follow when drafting messages</p>
        </div>

        {/* Live sample messages */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-semibold text-slate-700">Live Message Previews</p>
            <span className="text-xs text-slate-400">— updates as you type</span>
          </div>
          <div className="space-y-3">
            {samples.map(s => (
              <div key={s.label} className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${riskBadge(s.risk)}`}>
                    {s.risk === 'red' ? 'High Risk' : s.risk === 'amber' ? 'At Risk' : 'General'}
                  </span>
                  <span className="text-xs text-slate-500">{s.label}</span>
                </div>
                <div className="px-4 py-3 bg-white">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}

export default function Settings() {
  const { settings, updateSettings, thresholds, updateThresholds, members, clearAllData } = useData()
  const { user } = useAuth()
  const isOwner = user?.role === 'owner'

  const [form, setForm] = useState({ ...settings })
  const [thresh, setThresh] = useState({ ...thresholds })
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [validationError, setValidationError] = useState('')

  const save = () => {
    if (thresh.amberDays >= thresh.redDays) {
      setValidationError('Amber "days without visit" must be lower than Red threshold.')
      return
    }
    if (thresh.amberDropPct >= thresh.redDropPct) {
      setValidationError('Amber "visit drop %" must be lower than Red threshold.')
      return
    }
    setValidationError('')
    updateSettings(form)
    updateThresholds(thresh)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const exportCSV = () => {
    if (!members) return
    const headers = Object.keys(members[0]).join(',')
    const rows = members.map(m => Object.values(m).map(v => `"${v}"`).join(','))
    const blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'members_export.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (!isOwner) return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Settings</h1>
      <p className="text-slate-500">Settings are only available to the gym owner.</p>
    </div>
  )

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Customise GymPulse for your gym</p>
      </div>

      <div className="space-y-5">
        {/* Gym info */}
        <Section title="Gym Information" icon={Building}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Gym Name</label>
              <input value={form.gymName} onChange={e => setForm({ ...form, gymName: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
              <p className="text-xs text-slate-400 mt-1">Used in AI-generated messages</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Coach Name</label>
              <input value={form.coachName} onChange={e => setForm({ ...form, coachName: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
              <p className="text-xs text-slate-400 mt-1">Used to sign off AI messages</p>
            </div>
          </div>
        </Section>

        {/* Risk thresholds */}
        <Section title="Risk Thresholds" icon={Sliders}>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'amberDays', label: 'Amber — days without visit', suffix: 'days', min: 1 },
              { key: 'redDays', label: 'Red — days without visit', suffix: 'days', min: 1 },
              { key: 'amberDropPct', label: 'Amber — visit drop %', suffix: '%', min: 1 },
              { key: 'redDropPct', label: 'Red — visit drop %', suffix: '%', min: 1 },
            ].map(({ key, label, suffix, min }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={min} value={thresh[key]}
                    onChange={e => setThresh({ ...thresh, [key]: Number(e.target.value) })}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
                  <span className="text-xs text-slate-500">{suffix}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">Changes take effect immediately on next data load</p>
        </Section>

        {/* OpenAI API key */}
        <Section title="OpenAI API Key" icon={Key}>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">API Key</label>
            <div className="relative">
              <input type={showKey ? 'text' : 'password'} value={form.apiKey}
                onChange={e => setForm({ ...form, apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 pr-10 font-mono" />
              <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">Stored locally — needed for AI message generation. GPT-4o is used.</p>
          </div>
        </Section>

        {/* GymPulse AI */}
        <AISection form={form} setForm={setForm} />

        {/* Data export */}
        <Section title="Data Export" icon={Download}>
          <button onClick={exportCSV} disabled={!members}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800 transition-colors disabled:opacity-40">
            <Download size={14} /> Export Member Data as CSV
          </button>
          {!members && <p className="text-xs text-slate-400 mt-2">Load member data first.</p>}
        </Section>

        {/* Danger Zone */}
        <Section title="Danger Zone" icon={Trash2}>
          <p className="text-sm text-slate-500 mb-4">
            Permanently remove all uploaded member data, visit history, no-show counts, and health scores.
            Use this to start fresh with a new dataset. Outreach history and leads are not affected.
          </p>
          <button
            onClick={() => {
              if (window.confirm('Clear all member data? This will remove all members, visit history, and health scores. This cannot be undone.')) {
                clearAllData()
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
          >
            <Trash2 size={14} /> Clear All Member Data
          </button>
        </Section>

        {/* Validation error */}
        {validationError && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{validationError}</div>
        )}

        {/* Save */}
        {saved && (
          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm font-medium">
            <CheckCircle size={16} className="text-green-600 flex-shrink-0" /> Settings saved successfully!
          </div>
        )}
        <button onClick={save}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${saved ? 'bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
          {saved ? <CheckCircle size={16} /> : <Save size={16} />} {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
