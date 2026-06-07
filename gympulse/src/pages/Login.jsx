import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, Eye, EyeOff, Zap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'

export default function Login() {
  const { login, loginDemo } = useAuth()
  const { loadDemoData } = useData()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('owner')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const emailRef = useRef(null)
  const passwordRef = useRef(null)

  // Force-clear on mount so browser-restored values never persist
  useEffect(() => {
    setEmail('')
    setPassword('')
    if (emailRef.current)    emailRef.current.value = ''
    if (passwordRef.current) passwordRef.current.value = ''
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 400))
    const result = login(email, password)
    setLoading(false)
    if (!result.success) { setError(result.error); return }
    navigate('/dashboard')
  }

  const handleDemo = async () => {
    setDemoLoading(true)
    loginDemo()          // in-memory only — no localStorage session created
    loadDemoData()
    await new Promise(r => setTimeout(r, 200))
    navigate('/dashboard')
  }


  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-900/50">
            <Dumbbell size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">GymPulse</h1>
          <p className="text-slate-400 text-sm mt-1">Member Retention Platform</p>
        </div>

        {/* Demo CTA — above the card, most prominent */}
        <button
          onClick={handleDemo}
          disabled={demoLoading}
          className="w-full mb-4 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-70 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/40"
        >
          {demoLoading ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Loading demo...</>
          ) : (
            <><Zap size={16} className="fill-white" /> View Live Demo</>
          )}
        </button>
        <p className="text-center text-slate-500 text-xs mb-4">25 real members, full data — no sign-up needed</p>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-navy-700" />
          <span className="text-slate-600 text-xs">or sign in</span>
          <div className="flex-1 h-px bg-navy-700" />
        </div>

        {/* Card */}
        <div className="bg-navy-800 rounded-2xl p-7 shadow-xl border border-navy-700">
          <h2 className="text-lg font-semibold text-white mb-1">Welcome back</h2>
          <p className="text-slate-400 text-sm mb-6">Sign in to your dashboard</p>

          {/* Role pills — only select role, never fill credentials */}
          <div className="flex gap-2 mb-5">
            {['owner', 'coach'].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors capitalize ${role === r ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-navy-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'}`}
              >
                {r}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <input
                ref={emailRef}
                type="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                autoComplete="off"
                autoFocus={false}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="you@gym.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  ref={passwordRef}
                  type={showPw ? 'text' : 'password'} required
                  value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus={false}
                  className="w-full bg-navy-900 border border-navy-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors pr-10"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-4 py-2.5 bg-red-900/40 border border-red-700/50 rounded-lg text-sm text-red-400">{error}</div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-70 text-white font-semibold rounded-lg text-sm transition-colors mt-1 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in...</>
              ) : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Privacy notice */}
        <div className="mt-5 px-4 py-3 bg-navy-800/60 border border-navy-700/50 rounded-xl text-center">
          <p className="text-slate-400 text-xs leading-relaxed">
            🔒 All data is stored locally on your device. No data is transmitted to external servers.
          </p>
        </div>

        <p className="text-center text-slate-600 text-xs mt-4">
          GymPulse &copy; {new Date().getFullYear()} — Private access only
        </p>
      </div>
    </div>
  )
}
