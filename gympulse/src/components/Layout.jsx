import { useNavigate } from 'react-router-dom'
import { Zap, LogIn } from 'lucide-react'
import Sidebar from './Sidebar'
import AIMessageModal from './AIMessageModal'
import { useComposer } from '../contexts/ComposerContext'
import { useAuth } from '../contexts/AuthContext'

function DemoBanner() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleSignIn = () => {
    // Clear demo state and go to login (logout wipes storage + redirects)
    logout()
  }

  return (
    <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between gap-4 flex-shrink-0">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Zap size={15} className="fill-white flex-shrink-0" />
        Demo Mode — You are viewing sample data. Sign in to access your gym data.
      </div>
      <button
        onClick={handleSignIn}
        className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
      >
        <LogIn size={13} /> Sign In
      </button>
    </div>
  )
}

export default function Layout({ children }) {
  const { composerMember, closeComposer } = useComposer()
  const { isDemo } = useAuth()
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {isDemo && <DemoBanner />}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
      {composerMember && (
        <AIMessageModal member={composerMember} onClose={closeComposer} />
      )}
    </div>
  )
}
