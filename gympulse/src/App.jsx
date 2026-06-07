import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { DataProvider } from './contexts/DataContext'
import { ComposerProvider } from './contexts/ComposerContext'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import MemberHealth from './pages/MemberHealth'
import RetentionTracker from './pages/RetentionTracker'
import Settings from './pages/Settings'
import LeadPipeline from './pages/LeadPipeline'
import AutomatedCampaigns from './pages/AutomatedCampaigns'
import MemberPerformance from './pages/MemberPerformance'
import SocialMedia from './pages/SocialMedia'
import BusinessDashboard from './pages/BusinessDashboard'
import RosterPage from './pages/RosterPage'
import InboxPage from './pages/InboxPage'
import SessionReport from './pages/SessionReport'
import ReportsPage from './pages/ReportsPage'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return <ErrorBoundary>{children}</ErrorBoundary>
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route path="/dashboard" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
      <Route path="/members" element={<PrivateRoute><Layout><MemberHealth /></Layout></PrivateRoute>} />
      <Route path="/retention" element={<PrivateRoute><Layout><RetentionTracker /></Layout></PrivateRoute>} />
      <Route path="/leads" element={<PrivateRoute><Layout><LeadPipeline /></Layout></PrivateRoute>} />
      <Route path="/campaigns" element={<PrivateRoute><Layout><AutomatedCampaigns /></Layout></PrivateRoute>} />
      <Route path="/performance" element={<PrivateRoute><Layout><MemberPerformance /></Layout></PrivateRoute>} />
      <Route path="/social" element={<PrivateRoute><Layout><SocialMedia /></Layout></PrivateRoute>} />
      <Route path="/business" element={<PrivateRoute><Layout><BusinessDashboard /></Layout></PrivateRoute>} />
      <Route path="/roster"   element={<PrivateRoute><Layout><RosterPage /></Layout></PrivateRoute>} />
      <Route path="/inbox"    element={<PrivateRoute><Layout><InboxPage /></Layout></PrivateRoute>} />
      <Route path="/sessions" element={<PrivateRoute><Layout><SessionReport /></Layout></PrivateRoute>} />
      <Route path="/reports"  element={<PrivateRoute><Layout><ReportsPage /></Layout></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><Layout><Settings /></Layout></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <ComposerProvider>
            <AppRoutes />
          </ComposerProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
