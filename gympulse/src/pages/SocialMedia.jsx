import { useState } from 'react'
import { Share2 as Instagram, TrendingUp, Users, Heart, MessageCircle, Calendar, Lightbulb, ExternalLink, Copy, Check, RefreshCw } from 'lucide-react'
import { useData } from '../contexts/DataContext'
import clsx from 'clsx'

const ALL_IDEAS = [
  'Member milestone post: 3 members hit their 50-session badge this week — tag them!',
  'Class spotlight: Feature your most popular Tuesday HIIT session with a behind-the-scenes clip',
  'Community poll: Morning vs evening sessions — which is your favourite?',
  'Throwback: Share a transformation story from one of your founding members',
  'Tip of the week: Share one piece of advice from your coaches',
  'Behind the scenes: Coach prep and planning — show the work behind the magic',
  'Member shoutout: Celebrate consistency — someone who has shown up every week this month',
  'Quick form tip reel: 30-second technique breakdown for your most popular class move',
  'Progress post: Before/after strength numbers from a long-term member (with permission)',
  'Q&A: Answer the most common question new members ask about your program',
]

function CopyIdeaButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="flex-shrink-0 p-1 rounded hover:bg-amber-100 text-amber-400 hover:text-amber-700 transition-colors" title="Copy to clipboard">
      {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
    </button>
  )
}

// Demo Instagram posts
const DEMO_POSTS = [
  { id: 1, caption: 'Tuesday morning HIIT — this crew is unstoppable 💪 #Fitness #GymLife', likes: 847, comments: 34, date: '2025-04-29', attendance_change: 12, type: 'video' },
  { id: 2, caption: 'Member milestone: Marcus just hit his 100th session! 🎉 So proud of this guy.', likes: 312, comments: 67, date: '2025-04-25', attendance_change: 4, type: 'image' },
  { id: 3, caption: 'New class schedule dropping Monday — 6am sessions are back by popular demand!', likes: 203, comments: 28, date: '2025-04-22', attendance_change: 8, type: 'image' },
  { id: 4, caption: 'Behind the scenes: coach prep 🎯', likes: 156, comments: 12, date: '2025-04-18', attendance_change: -2, type: 'story' },
  { id: 5, caption: 'Before & after — 6 months of consistency. This is what showing up looks like.', likes: 921, comments: 89, date: '2025-04-15', attendance_change: 18, type: 'image' },
  { id: 6, caption: 'Saturday morning crew — best energy of the week 🌅', likes: 445, comments: 41, date: '2025-04-12', attendance_change: 6, type: 'video' },
]

const CONTENT_IDEAS = [
  'Member milestone post: 3 members hit their 50-session badge this week — tag them!',
  'Class spotlight: Feature your most popular Tuesday HIIT session with a behind-the-scenes clip',
  'Community poll: Morning vs evening sessions — which is your favourite?',
  'Throwback: Share a transformation story from one of your founding members',
  'Tip of the week: Share one piece of advice from your coaches',
]

const WEEK_PLAN = [
  { day: 'Mon', content: '', type: '' },
  { day: 'Tue', content: 'HIIT class highlight reel', type: 'Video Reel' },
  { day: 'Wed', content: '', type: '' },
  { day: 'Thu', content: 'Member milestone celebration', type: 'Image Post' },
  { day: 'Fri', content: 'Weekend class tease', type: 'Story' },
  { day: 'Sat', content: 'Saturday energy check-in', type: 'Video Reel' },
  { day: 'Sun', content: '', type: '' },
]

export default function SocialMedia() {
  const { members } = useData()
  const [weekPlan, setWeekPlan] = useState(WEEK_PLAN)
  const [ideaOffset, setIdeaOffset] = useState(0)
  const ideas = ALL_IDEAS.slice(ideaOffset, ideaOffset + 5)
  const regenerateIdeas = () => setIdeaOffset(o => (o + 5) % ALL_IDEAS.length)

  const totalLikes = DEMO_POSTS.reduce((s, p) => s + p.likes, 0)
  const avgLikes = Math.round(totalLikes / DEMO_POSTS.length)
  const bestPost = DEMO_POSTS.reduce((a, b) => a.likes > b.likes ? a : b)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Social Media</h1>
        <p className="text-slate-500 text-sm mt-0.5">Connect engagement with attendance data — nobody else does this</p>
      </div>

      {/* Connect banner */}
      <div className="bg-gradient-to-r from-violet-600 to-pink-500 rounded-xl p-5 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Instagram size={32} className="text-white" />
          <div>
            <p className="text-white font-semibold">Instagram Business Connected</p>
            <p className="text-white/70 text-sm">@gympulse_studio · 2,841 followers</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors">
          <ExternalLink size={14} /> View Profile
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{avgLikes}</p>
          <p className="text-xs text-slate-500 mt-1">Avg. Likes per Post</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-violet-600">{bestPost.attendance_change}%</p>
          <p className="text-xs text-slate-500 mt-1">Attendance Lift — Best Post</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-pink-600">{DEMO_POSTS.filter(p => p.attendance_change > 0).length}/6</p>
          <p className="text-xs text-slate-500 mt-1">Posts with Attendance Lift</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Post performance */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-800 mb-1">Recent Posts + Attendance Impact</h2>
          <p className="text-xs text-slate-400 mb-4">Attendance change in the week after each post</p>
          <div className="space-y-3">
            {DEMO_POSTS.map(post => (
              <div key={post.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-sm text-slate-700 line-clamp-1 mb-2">{post.caption}</p>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Heart size={11} className="text-pink-400" /> {post.likes}</span>
                  <span className="flex items-center gap-1"><MessageCircle size={11} className="text-blue-400" /> {post.comments}</span>
                  <span className="text-slate-400">{post.date}</span>
                  <span className={clsx('ml-auto font-semibold', post.attendance_change > 0 ? 'text-green-600' : 'text-red-500')}>
                    {post.attendance_change > 0 ? `+${post.attendance_change}%` : `${post.attendance_change}%`} attendance
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content ideas + calendar */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb size={16} className="text-amber-500" />
              <h2 className="font-semibold text-slate-800">AI Content Ideas</h2>
              <button onClick={regenerateIdeas} className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100 transition-colors">
                <RefreshCw size={11} /> Regenerate
              </button>
            </div>
            <div className="space-y-2">
              {ideas.map((idea, i) => (
                <div key={ideaOffset + i} className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                  <span className="text-amber-500 font-bold text-xs mt-0.5 flex-shrink-0">{i + 1}.</span>
                  <p className="text-xs text-slate-700 flex-1">{idea}</p>
                  <CopyIdeaButton text={idea} />
                </div>
              ))}
            </div>
          </div>

          {/* Week calendar */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={16} className="text-indigo-500" />
              <h2 className="font-semibold text-slate-800">Content Calendar — This Week</h2>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weekPlan.map((day) => (
                <div key={day.day} className={clsx('rounded-lg p-2 text-center text-xs', day.content ? 'bg-indigo-50 border border-indigo-200' : 'bg-slate-50 border border-slate-100')}>
                  <p className="font-semibold text-slate-700">{day.day}</p>
                  {day.content
                    ? <p className="text-indigo-600 mt-1 leading-tight text-[10px]">{day.type}</p>
                    : <p className="text-slate-300 mt-1">—</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Referral tracker */}
          {members && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-green-500" />
                <h2 className="font-semibold text-slate-800">Top Referrers</h2>
              </div>
              <div className="space-y-2">
                {members.slice(0, 4).map((m, i) => (
                  <div key={m.member_id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{m.member_name}</span>
                    <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">{i === 0 ? '3 referrals' : i === 1 ? '2 referrals' : '1 referral'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
