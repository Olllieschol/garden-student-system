import { useState, useRef, useEffect } from 'react'
import { Send, MessageSquare, Clock, CheckCheck, Inbox, Archive } from 'lucide-react'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import { DEMO_CONVERSATIONS } from '../utils/demoData'
import { healthScore } from '../utils/riskScoring'
import Avatar from '../components/common/Avatar'
import RiskBadge from '../components/common/RiskBadge'
import clsx from 'clsx'

const TABS = [
  { id: 'all',      label: 'All',      icon: Inbox },
  { id: 'awaiting', label: 'Awaiting', icon: Clock },
  { id: 'unread',   label: 'Unread',   icon: MessageSquare },
  { id: 'archived', label: 'Archived', icon: Archive },
]

function statusLabel(status) {
  if (status === 'awaiting') return { label: 'Awaiting reply', color: 'text-amber-600 bg-amber-50 border-amber-200' }
  if (status === 'unread')   return { label: 'No reply yet',  color: 'text-blue-600 bg-blue-50 border-blue-200' }
  return                            { label: 'Archived',       color: 'text-slate-500 bg-slate-50 border-slate-200' }
}

function riskDot(level) {
  return level === 'red' ? 'bg-red-500' : level === 'amber' ? 'bg-amber-500' : 'bg-green-500'
}

export default function InboxPage() {
  const { members, isDemo } = useData()
  const { isDemo: authDemo } = useAuth()
  const [tab, setTab] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [reply, setReply] = useState('')
  const [localConvos, setLocalConvos] = useState(DEMO_CONVERSATIONS)
  const bottomRef = useRef(null)

  // Use demo conversations always for now; real members enhance member stats
  const memberMap = {}
  if (members) members.forEach(m => { memberMap[m.member_id] = m })

  const filtered = localConvos.filter(c => {
    if (tab === 'all') return true
    if (tab === 'unread') return c.unread
    return c.status === tab
  })

  const selected = localConvos.find(c => c.id === selectedId) || filtered[0] || null

  useEffect(() => {
    if (selected) {
      setLocalConvos(prev => prev.map(c => c.id === selected.id ? { ...c, unread: false } : c))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selected?.id, selected?.messages?.length])

  const sendReply = () => {
    if (!reply.trim() || !selected) return
    const msg = {
      id: Date.now(),
      from: 'gym',
      text: reply.trim(),
      time: new Date().toLocaleString('en-AU', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
    }
    setLocalConvos(prev => prev.map(c =>
      c.id === selected.id
        ? { ...c, messages: [...c.messages, msg], status: 'awaiting', unread: false }
        : c
    ))
    setReply('')
  }

  const archiveConvo = (id) => {
    setLocalConvos(prev => prev.map(c => c.id === id ? { ...c, status: 'archived' } : c))
  }

  const unreadCount = localConvos.filter(c => c.unread).length
  const awaitingCount = localConvos.filter(c => c.status === 'awaiting').length

  return (
    <div className="flex h-full min-h-screen bg-slate-50">
      {/* ── Conversation list ────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <h1 className="text-lg font-bold text-slate-900">Inbox</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs font-bold rounded-full">{unreadCount}</span>
            )}
          </div>
          {/* Tabs */}
          <div className="flex gap-1">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={clsx('flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  tab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50')}>
                {t.label}
                {t.id === 'awaiting' && awaitingCount > 0 && (
                  <span className={clsx('ml-1 inline-block w-4 h-4 rounded-full text-[10px] font-bold leading-4 text-center',
                    tab === t.id ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700')}>{awaitingCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <Inbox size={28} className="text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No conversations in this view</p>
            </div>
          ) : filtered.map(c => {
            const lastMsg = c.messages[c.messages.length - 1]
            const isSelected = selected?.id === c.id
            return (
              <button key={c.id} onClick={() => setSelectedId(c.id)}
                className={clsx('w-full text-left px-4 py-3.5 border-b border-slate-50 hover:bg-slate-50 transition-colors',
                  isSelected && 'bg-indigo-50 border-l-2 border-l-indigo-500')}>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="relative flex-shrink-0">
                    <Avatar name={c.member_name} size="sm" />
                    <span className={clsx('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white', riskDot(c.risk_level))} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={clsx('text-sm truncate', c.unread ? 'font-bold text-slate-900' : 'font-medium text-slate-700')}>{c.member_name}</p>
                      <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">{lastMsg.time.split(',')[0]}</span>
                    </div>
                    <p className={clsx('text-xs truncate mt-0.5', c.unread ? 'text-slate-600 font-medium' : 'text-slate-400')}>
                      {lastMsg.from === 'gym' ? 'You: ' : ''}{lastMsg.text}
                    </p>
                  </div>
                  {c.unread && <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Thread view ──────────────────────────────────────── */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Thread header */}
          <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-4 flex-shrink-0">
            <Avatar name={selected.member_name} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-900">{selected.member_name}</h2>
                <RiskBadge level={selected.risk_level} label={selected.risk_label} />
                {(() => {
                  const mem = memberMap[selected.member_id]
                  if (!mem) return null
                  const hs = healthScore(mem)
                  return (
                    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border',
                      hs >= 61 ? 'text-green-700 bg-green-50 border-green-200' : hs >= 30 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200'
                    )}>{hs}%</span>
                  )
                })()}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{selected.preferred_class}</p>
            </div>
            <div className="flex items-center gap-3">
              {(() => { const s = statusLabel(selected.status); return <span className={clsx('text-xs font-medium px-2.5 py-1 rounded-full border', s.color)}>{s.label}</span> })()}
              {selected.status !== 'archived' && (
                <button onClick={() => archiveConvo(selected.id)}
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors">
                  <Archive size={13} /> Archive
                </button>
              )}
            </div>
          </div>

          {/* Main content: messages + stats panel */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Messages */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {selected.messages.map(msg => (
                  <div key={msg.id} className={clsx('flex gap-3', msg.from === 'gym' ? 'flex-row-reverse' : '')}>
                    {msg.from === 'member' && <Avatar name={selected.member_name} size="sm" />}
                    <div className={clsx('max-w-sm rounded-2xl px-4 py-3 text-sm',
                      msg.from === 'gym'
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm')}>
                      <p>{msg.text}</p>
                      <p className={clsx('text-[10px] mt-1.5', msg.from === 'gym' ? 'text-indigo-200' : 'text-slate-400')}>{msg.time}</p>
                    </div>
                    {msg.from === 'gym' && (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-indigo-600">G</span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Reply input */}
              <div className="bg-white border-t border-slate-100 px-6 py-4 flex-shrink-0">
                <div className="flex gap-3 items-end">
                  <div className="flex-1 relative">
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                      placeholder="Type an SMS message..."
                      rows={2}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 resize-none"
                    />
                    <span className={clsx('absolute bottom-2.5 right-3 text-[10px]', reply.length > 160 ? 'text-red-500' : 'text-slate-400')}>{reply.length}/160</span>
                  </div>
                  <button onClick={sendReply} disabled={!reply.trim()}
                    className="flex-shrink-0 p-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors">
                    <Send size={16} />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                  <CheckCheck size={12} /> Messages are sent as SMS · Press Enter to send
                </p>
              </div>
            </div>

            {/* Member stats panel */}
            <div className="w-64 flex-shrink-0 bg-white border-l border-slate-100 overflow-y-auto p-5 space-y-5">
              {(() => {
                const mem = memberMap[selected.member_id]
                if (!mem) return <p className="text-xs text-slate-400">Member stats unavailable</p>
                const hs = healthScore(mem)
                const totalSessions = (Number(mem.visits_last_30_days) || 0) + (Number(mem.visits_prev_30_days) || 0)
                const lastAttended = mem.last_visit_date || 'Unknown'
                return (
                  <>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Member Stats</p>
                      <div className="space-y-3">
                        {[
                          { label: 'Health Score', value: `${hs}%` },
                          { label: 'Sessions (60 days)', value: totalSessions },
                          { label: 'Visits this month', value: mem.visits_last_30_days },
                          { label: 'Last attended', value: mem.days_since_last_visit === 999 ? 'Never' : mem.days_since_last_visit === 0 ? 'Today' : `${mem.days_since_last_visit} days ago` },
                          { label: 'Cancellations', value: mem.cancellations_last_30_days },
                          { label: 'No-shows', value: mem.no_shows_last_30_days },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">{label}</span>
                            <span className="text-xs font-semibold text-slate-800">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border-t border-slate-100 pt-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Membership</p>
                      <p className="text-sm font-medium text-slate-800">{mem.membership_type}</p>
                      <p className="text-xs text-slate-400 mt-1">Member since {mem.join_date}</p>
                    </div>
                    <div className="border-t border-slate-100 pt-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Preferred Class</p>
                      <p className="text-sm text-slate-700">{selected.preferred_class}</p>
                    </div>
                    {mem.notes && (
                      <div className="border-t border-slate-100 pt-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notes</p>
                        <p className="text-xs text-slate-600">{mem.notes}</p>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-center p-12">
          <div>
            <MessageSquare size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Select a conversation</p>
            <p className="text-sm text-slate-400 mt-1">Choose a member conversation from the list</p>
          </div>
        </div>
      )}
    </div>
  )
}
