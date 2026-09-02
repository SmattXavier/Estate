import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/context'
import type { Role } from './auth/context'
import SignIn from './routes/SignIn'
import { Overview } from './routes/Placeholders'
import MyIssues from './routes/my/MyIssues'
import Board from './routes/board/Board'
import ArtisanDirectory from './routes/board/ArtisanDirectory'

const HOME: Record<Role, string> = {
  resident: '/my',
  facility_manager: '/board',
  ceo: '/overview',
}

function Waiting() {
  return (
    <div className="min-h-dvh bg-bg px-6 py-16 text-center text-sm text-ink-soft">
      One moment…
    </div>
  )
}

/** Signed out lands on sign-in; the wrong role lands on its own screen. */
function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) return <Waiting />
  if (!profile) return <Navigate to="/" replace />
  if (profile.role !== role) return <Navigate to={HOME[profile.role]} replace />
  return children
}

function Landing() {
  const { profile, loading } = useAuth()

  if (loading) return <Waiting />
  if (profile) return <Navigate to={HOME[profile.role]} replace />
  return <SignIn />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/my"
        element={
          <RequireRole role="resident">
            <MyIssues />
          </RequireRole>
        }
      />
      <Route
        path="/board"
        element={
          <RequireRole role="facility_manager">
            <Board />
          </RequireRole>
        }
      />
      <Route
        path="/board/artisans/:issueId"
        element={
          <RequireRole role="facility_manager">
            <ArtisanDirectory />
          </RequireRole>
        }
      />
      <Route
        path="/overview"
        element={
          <RequireRole role="ceo">
            <Overview />
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
