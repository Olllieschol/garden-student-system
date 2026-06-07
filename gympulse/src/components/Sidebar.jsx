import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, TrendingUp, Settings,
  UserPlus, Zap, Activity, Share2, BarChart3, LogOut, LogIn, Dumbbell, CalendarDays,
  MessageSquare, ClipboardList, FileText,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../contexts/AuthContext'

const NAV_OWNER = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/members',    icon: Users,           label: 'Member Health' },
  { to: '/inbox',      icon: MessageSquare,   label: 'Inbox' },
  { to: '/sessions',   icon: ClipboardList,   label: 'Session Report' },
  { to: '/reports',    icon: FileText,        label: 'Reports' },
  { to: '/retention',  icon: TrendingUp,      label: 'Retention' },
  { to: '/leads',      icon: UserPlus,        label: 'Lead Pipeline' },
  { to: '/campaigns',  icon: Zap,             label: 'Campaigns' },
  { to: '/performance',icon: Activity,        label: 'Performance' },
  { to: '/social',     icon: Share2,          label: 'Social' },
  { to: '/business',   icon: BarChart3,       label: 'Business' },
  { to: '/roster',     icon: CalendarDays,    label: 'Roster' },
  { to: '/settings',   icon: Settings,        label: 'Settings' },
]
const NAV_COACH = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/members',   icon: Users,           label: 'Member Health' },
  { to: '/inbox',     icon: MessageSquare,   label: 'Inbox' },
  { to: '/sessions',  icon: ClipboardList,   label: 'Session Report' },
  { to: '/retention', icon: TrendingUp,      label: 'Retention' },
]
// Demo sees most of the app (owner-only pages show their own restricted messages)
const NAV_DEMO = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/members',    icon: Users,           label: 'Member Health' },
  { to: '/inbox',      icon: MessageSquare,   label: 'Inbox' },
  { to: '/sessions',   icon: ClipboardList,   label: 'Session Report' },
  { to: '/reports',    icon: FileText,        label: 'Reports' },
  { to: '/retention',  icon: TrendingUp,      label: 'Retention' },
  { to: '/leads',      icon: UserPlus,        label: 'Lead Pipeline' },
  { to: '/campaigns',  icon: Zap,             label: 'Campaigns' },
  { to: '/performance',icon: Activity,        label: 'Performance' },
  { to: '/social',     icon: Share2,          label: 'Social' },
  { to: '/roster',     icon: CalendarDays,    label: 'Roster' },
]

export default function Sidebar() {
  const { user, isDemo, logout } = useAuth()

  const nav = isDemo ? NAV_DEMO : user?.role === 'owner' ? NAV_OWNER : NAV_COACH

  return (
    <aside className="w-60 min-h-screen bg-navy-900 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-navy-700">
        <div className="flex items-center gap-2.5">
          <div className={clsx('p-1.5 rounded-lg', isDemo ? 'bg-amber-500' : 'bg-indigo-600')}>
            <Dumbbell size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-none">GymPulse</p>
            <p className={clsx('text-xs mt-0.5', isDemo ? 'text-amber-400 font-semibold' : 'text-slate-400 capitalize')}>
              {isDemo ? 'Demo Mode' : `${user?.role} view`}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? isDemo ? 'bg-amber-500 text-white' : 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-navy-800'
            )}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User info + Logout / Exit Demo */}
      <div className="px-3 pb-5 pt-3 border-t border-navy-700">
        <div className="px-3 py-2 mb-1">
          <p className="text-white text-xs font-medium truncate">
            {isDemo ? 'Viewing demo data' : user?.email}
          </p>
          <p className={clsx('text-xs', isDemo ? 'text-amber-400' : 'text-slate-500 capitalize')}>
            {isDemo ? 'Not signed in' : user?.role}
          </p>
        </div>
        <button
          onClick={logout}
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            isDemo
              ? 'text-amber-400 hover:text-white hover:bg-amber-600'
              : 'text-slate-400 hover:text-white hover:bg-navy-800'
          )}
        >
          {isDemo ? <LogIn size={16} /> : <LogOut size={16} />}
          {isDemo ? 'Sign In' : 'Logout'}
        </button>
      </div>
    </aside>
  )
}
