import { useState, useEffect, useCallback } from 'react'
import { X, Copy, RefreshCw, CheckCircle, Loader2, Bell } from 'lucide-react'
import RiskBadge from './common/RiskBadge'
import Avatar from './common/Avatar'
import { useData } from '../contexts/DataContext'
import { format } from 'date-fns'

const TONES = ['Casual', 'Warm', 'Motivational']

async function generateMessages(member, settings, tone, apiKey) {
  if (!apiKey) throw new Error('No API key')
  const prompt = `Generate two outreach messages for a gym member.
Member: ${member.member_name}
Membership: ${member.membership_type}
Days since last visit: ${member.days_since_last_visit}
Visits this month: ${member.visits_last_30_days}
Visits last month: ${member.visits_prev_30_days}
Visit trend: ${member.visit_change_pct < 0 ? 'down' : 'up'} ${Math.abs(member.visit_change_pct || 0)}%
Cancellations this month: ${member.cancellations_last_30_days}
Risk reason: ${member.risk_reason}
Gym name: ${settings.gymName}
Coach name: ${settings.coachName}
Tone: ${tone}

Return ONLY valid JSON in this exact format, no markdown:
{"sms":"<under 160 chars, warm, first name, signed from ${settings.coachName}>","email_subject":"<subject>","email_body":"<3-4 sentences, personalised, soft CTA, signed from ${settings.coachName}>"}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: `You are a warm, genuine fitness coach at a boutique group training gym. Write outreach messages to members whose attendance has recently dropped. Rules: Sound completely human — not automated or corporate. Be warm and caring, never pushy or salesy. Reference their specific situation naturally. For SMS: under 160 characters, casual, first name only. For email: include a subject line, 3-4 sentences, sign off with coach name. Never say "our system detected" or "our data shows". Make it feel like the coach personally noticed.` },
        { role: 'user', content: prompt },
      ],
      temperature: 0.85,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
  const data = await res.json()
  const text = data.choices[0].message.content.trim()
  return JSON.parse(text)
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors px-2 py-1 rounded hover:bg-slate-100">
      {copied ? <CheckCircle size={13} className="text-green-500" /> : <Copy size={13} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

export default function AIMessageModal({ member, onClose }) {
  const { settings, logOutreach, addContactLogEntry } = useData()
  const [tone, setTone] = useState('Warm')
  const [messages, setMessages] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [marked, setMarked] = useState(false)
  const [markedType, setMarkedType] = useState(null)

  const apiKey = settings.apiKey || localStorage.getItem('gympulse_settings') && JSON.parse(localStorage.getItem('gympulse_settings') || '{}').apiKey

  const generate = useCallback(async () => {
    setLoading(true)
    setError('')
    setMessages(null)
    try {
      const result = await generateMessages(member, settings, tone, settings.apiKey)
      setMessages(result)
    } catch (e) {
      if (e.message === 'No API key') {
        setError('Add your OpenAI API key in Settings to generate AI messages.')
      } else {
        setError('Failed to generate messages. Check your API key and try again.')
      }
      // Show demo messages anyway
      setMessages({
        sms: `Hey ${member.member_name.split(' ')[0]}! We've been missing you at ${settings.gymName}. Hope everything's good — would love to see you back soon. — ${settings.coachName}`,
        email_subject: `We miss you, ${member.member_name.split(' ')[0]}!`,
        email_body: `Hi ${member.member_name.split(' ')[0]},\n\nI wanted to reach out personally because we haven't seen you around lately, and honestly, the sessions aren't the same without you.\n\nIs everything okay? If there's anything we can do to make it easier for you to get back in — whether it's trying a different class time or just catching up over a coffee — I'd love to chat.\n\nWould love to see you back this week!\n\n${settings.coachName}\n${settings.gymName}`,
      })
    } finally {
      setLoading(false)
    }
  }, [member, settings, tone])

  useEffect(() => { generate() }, [tone])

  const markSent = (type) => {
    const entry = {
      id: Date.now().toString(),
      date: format(new Date(), 'yyyy-MM-dd HH:mm'),
      type,
      message: type === 'SMS' ? messages.sms : `Subject: ${messages.email_subject}\n\n${messages.email_body}`,
    }
    addContactLogEntry(member.member_id, entry)
    logOutreach({
      id: Date.now().toString(),
      member_id: member.member_id,
      member_name: member.member_name,
      date_contacted: format(new Date(), 'yyyy-MM-dd'),
      risk_level: member.risk_level,
      message_type: type,
      outcome: 'pending',
    })
    setMarked(true)
    setMarkedType(type)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">AI Message Composer</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* LEFT — member context */}
          <div className="w-64 border-r border-slate-100 p-5 flex-shrink-0 overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <Avatar name={member.member_name} size="lg" />
              <div>
                <p className="font-semibold text-slate-900 text-sm">{member.member_name}</p>
                <p className="text-xs text-slate-500">{member.membership_type}</p>
              </div>
            </div>
            <RiskBadge level={member.risk_level} label={member.risk_label} size="md" />
            <p className="text-xs text-slate-500 mt-3 mb-4 leading-relaxed">{member.risk_reason}</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Last visit</span>
                <span className="font-medium text-slate-700">{member.days_since_last_visit}d ago</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">This month</span>
                <span className="font-medium text-slate-700">{member.visits_last_30_days} visits</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last month</span>
                <span className="font-medium text-slate-700">{member.visits_prev_30_days} visits</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cancellations</span>
                <span className="font-medium text-slate-700">{member.cancellations_last_30_days}</span>
              </div>
            </div>

            {/* Data disclosure */}
            {settings.apiKey && (
              <div className="mt-5 p-2.5 bg-slate-100 rounded-lg border border-slate-200">
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  ⚠️ When generating messages, limited member data (name, visit stats, risk reason) is sent to OpenAI via your API key. No data is stored by OpenAI beyond their standard retention policy.
                </p>
              </div>
            )}

          {/* Tone selector */}
            <div className="mt-4">
              <p className="text-xs font-medium text-slate-600 mb-2">Tone</p>
              <div className="flex flex-col gap-1.5">
                {TONES.map(t => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${tone === t ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-slate-600 hover:border-indigo-400'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — messages */}
          <div className="flex-1 p-6 overflow-y-auto">
            {error && (
              <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                {error} Showing demo message instead.
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <Loader2 size={28} className="text-indigo-500 animate-spin" />
                <p className="text-sm text-slate-500">Drafting your message...</p>
              </div>
            ) : messages ? (
              <div className="space-y-5">
                {/* SMS */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">SMS</p>
                      <p className="text-xs text-slate-400">{messages.sms?.length || 0}/160 characters</p>
                    </div>
                    <CopyButton text={messages.sms} />
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{messages.sms}</p>
                </div>

                {/* Email */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">Email</p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Subject: {messages.email_subject}</p>
                    </div>
                    <CopyButton text={`Subject: ${messages.email_subject}\n\n${messages.email_body}`} />
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{messages.email_body}</p>
                </div>

                {/* Actions */}
                {!marked ? (
                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      onClick={generate}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800 transition-colors"
                    >
                      <RefreshCw size={14} /> Regenerate
                    </button>
                    <button onClick={() => markSent('SMS')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
                      <CheckCircle size={14} /> Mark SMS Sent
                    </button>
                    <button onClick={() => markSent('Email')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
                      <CheckCircle size={14} /> Mark Email Sent
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                    <p className="text-sm font-medium text-green-800 flex items-center gap-2">
                      <CheckCircle size={16} /> {markedType} marked as sent to {member.member_name}
                    </p>
                    <p className="text-xs text-green-600 mt-1">Logged in contact history and retention tracker.</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
