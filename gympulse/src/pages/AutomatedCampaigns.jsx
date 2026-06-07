import { useState } from 'react'
import { Zap, ToggleLeft, ToggleRight, Eye, Edit3, Users, Send, Mail, MessageSquare } from 'lucide-react'
import clsx from 'clsx'

const INITIAL_CAMPAIGNS = [
  {
    id: 'welcome', name: 'Welcome Sequence', trigger: 'New member joins', enabled: true,
    messages: [
      { day: 1, type: 'SMS', preview: 'Hey [Name]! Welcome to the family 🙌 So pumped to have you. See you at your first session — [Coach]' },
      { day: 3, type: 'Email', preview: 'Subject: Your first week at [Gym] — How\'s it going?\n\nHey [Name], just checking in after your first few sessions...' },
      { day: 7, type: 'Email', preview: 'Subject: One week in — you\'re crushing it!\n\nHey [Name], one week down and you\'re already...' },
    ],
    active_count: 3, sent: 47, response_rate: 68,
  },
  {
    id: 'trial_follow', name: 'Trial Follow-up', trigger: 'Trial completed, no conversion', enabled: true,
    messages: [
      { day: 1, type: 'SMS', preview: 'Hey [Name]! Loved having you in for a trial. What did you think? [Coach]' },
      { day: 3, type: 'Email', preview: 'Subject: Your trial at [Gym] — ready to make it official?\n\nHi [Name], it was so great...' },
      { day: 7, type: 'Email', preview: 'Subject: Last chance — special offer for trial members\n\nHey [Name], we wanted to...' },
    ],
    active_count: 2, sent: 31, response_rate: 45,
  },
  {
    id: 'reengagement', name: 'Re-engagement', trigger: 'No visit in 14 days', enabled: true,
    messages: [
      { day: 0, type: 'SMS', preview: 'Hey [Name], we\'ve been missing you! Hope everything\'s good. — [Coach]' },
    ],
    active_count: 8, sent: 124, response_rate: 38,
  },
  {
    id: 'winback', name: 'Win-back', trigger: 'No visit in 30 days', enabled: false,
    messages: [
      { day: 0, type: 'Email', preview: 'Subject: We miss you, [Name] — come back anytime\n\nHey [Name], it\'s been a while...' },
    ],
    active_count: 0, sent: 18, response_rate: 22,
  },
  {
    id: 'milestone', name: 'Milestone Celebration', trigger: 'Member hits 50 sessions', enabled: true,
    messages: [
      { day: 0, type: 'SMS', preview: '50 sessions, [Name]! 🎉 That\'s absolutely massive. So proud of you. — [Coach]' },
    ],
    active_count: 1, sent: 9, response_rate: 100,
  },
  {
    id: 'birthday', name: 'Birthday Message', trigger: "Member's birthday", enabled: true,
    messages: [
      { day: 0, type: 'SMS', preview: 'Happy birthday [Name]! 🎂 Hope you\'re celebrating — you deserve it. See you soon! — [Coach]' },
    ],
    active_count: 0, sent: 14, response_rate: 100,
  },
  {
    id: 'cancellation', name: 'Cancellation Save', trigger: 'Member requests cancellation', enabled: true,
    messages: [
      { day: 0, type: 'Email', preview: 'Subject: Before you go — we\'d love to help\n\nHi [Name], we heard you\'re thinking about pausing...' },
    ],
    active_count: 1, sent: 7, response_rate: 57,
  },
]

function CampaignCard({ campaign, onToggle }) {
  const [preview, setPreview] = useState(false)
  return (
    <div className={clsx('bg-white rounded-xl border shadow-sm p-5 transition-all', campaign.enabled ? 'border-slate-100' : 'border-slate-100 opacity-60')}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className={clsx('p-2 rounded-lg flex-shrink-0', campaign.enabled ? 'bg-indigo-50' : 'bg-slate-100')}>
            <Zap size={16} className={campaign.enabled ? 'text-indigo-600' : 'text-slate-400'} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">{campaign.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{campaign.trigger}</p>
          </div>
        </div>
        <button onClick={() => onToggle(campaign.id)} className="flex-shrink-0">
          {campaign.enabled
            ? <ToggleRight size={24} className="text-indigo-600" />
            : <ToggleLeft size={24} className="text-slate-300" />}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center bg-slate-50 rounded-lg py-2">
          <p className="text-sm font-bold text-slate-900">{campaign.active_count}</p>
          <p className="text-xs text-slate-400">Active</p>
        </div>
        <div className="text-center bg-slate-50 rounded-lg py-2">
          <p className="text-sm font-bold text-slate-900">{campaign.sent}</p>
          <p className="text-xs text-slate-400">Sent</p>
        </div>
        <div className="text-center bg-slate-50 rounded-lg py-2">
          <p className="text-sm font-bold text-green-600">{campaign.response_rate}%</p>
          <p className="text-xs text-slate-400">Response</p>
        </div>
      </div>

      {/* Messages summary */}
      <div className="flex items-center gap-2 mb-3">
        {campaign.messages.map((msg, i) => (
          <span key={i} className={clsx('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium',
            msg.type === 'SMS' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-purple-50 border-purple-200 text-purple-700')}>
            {msg.type === 'SMS' ? <MessageSquare size={10} /> : <Mail size={10} />}
            Day {msg.day} — {msg.type}
          </span>
        ))}
      </div>

      <button onClick={() => setPreview(!preview)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
        <Eye size={12} /> {preview ? 'Hide' : 'Preview'} Messages
      </button>

      {preview && (
        <div className="mt-3 space-y-2">
          {campaign.messages.map((msg, i) => (
            <div key={i} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <p className="text-xs font-semibold text-slate-500 mb-1">Day {msg.day} — {msg.type}</p>
              <p className="text-xs text-slate-600 whitespace-pre-line line-clamp-3">{msg.preview}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const CAMPAIGNS_KEY = 'gympulse_campaigns'

function loadCampaigns() {
  try {
    const saved = localStorage.getItem(CAMPAIGNS_KEY)
    if (!saved) return INITIAL_CAMPAIGNS
    const enabledMap = JSON.parse(saved)
    return INITIAL_CAMPAIGNS.map(c => ({ ...c, enabled: enabledMap[c.id] ?? c.enabled }))
  } catch { return INITIAL_CAMPAIGNS }
}

export default function AutomatedCampaigns() {
  const [campaigns, setCampaigns] = useState(loadCampaigns)

  const toggleCampaign = (id) => {
    setCampaigns(prev => {
      const next = prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c)
      const enabledMap = Object.fromEntries(next.map(c => [c.id, c.enabled]))
      localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(enabledMap))
      return next
    })
  }

  const enabled = campaigns.filter(c => c.enabled).length
  const totalActive = campaigns.reduce((s, c) => s + c.active_count, 0)
  const totalSent = campaigns.reduce((s, c) => s + c.sent, 0)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Automated Campaigns</h1>
        <p className="text-slate-500 text-sm mt-0.5">Turn on once — runs automatically based on member behaviour</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-indigo-600">{enabled}</p>
          <p className="text-xs text-slate-500 mt-1">Active Campaigns</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{totalActive}</p>
          <p className="text-xs text-slate-500 mt-1">Members In Sequences</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{totalSent}</p>
          <p className="text-xs text-slate-500 mt-1">Total Messages Sent</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {campaigns.map(c => <CampaignCard key={c.id} campaign={c} onToggle={toggleCampaign} />)}
      </div>
    </div>
  )
}
