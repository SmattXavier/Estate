import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/context'
import type { Role } from './auth/context'
import Shell from './shell/Shell'
import SignIn from './routes/SignIn'
import NewReport from './routes/my/NewReport'
import MyReports from './routes/my/MyReports'
import MyCharges from './routes/my/MyCharges'
import Board from './routes/board/Board'
import ArtisanDirectory from './routes/board/ArtisanDirectory'
import BoardCharges from './routes/board/BoardCharges'
import Overview from './routes/overview/Overview'
import Charges from './routes/charges/Charges'
import Visitors from './routes/my/Visitors'
import Holding from './routes/Holding'

const HOME: Record<Role, string> = {
  resident: '/my/reports',
  facility_manager: '/board',
  ceo: '/overview',
  security: '/gate',
  artisan: '/shifts',
}

function Waiting() {
  return (
    <div className="min-h-dvh bg-background px-6 py-16 text-center text-sm text-foreground-muted">
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
  return <Shell>{children}</Shell>
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

      <Route path="/my" element={<Navigate to="/my/reports" replace />} />
      <Route
        path="/my/new"
        element={
          <RequireRole role="resident">
            <NewReport />
          </RequireRole>
        }
      />
      <Route
        path="/my/reports"
        element={
          <RequireRole role="resident">
            <MyReports />
          </RequireRole>
        }
      />

      <Route
        path="/my/charges"
        element={
          <RequireRole role="resident">
            <MyCharges />
          </RequireRole>
        }
      />

      <Route
        path="/my/visitors"
        element={
          <RequireRole role="resident">
            <Visitors />
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
        path="/board/artisans"
        element={
          <RequireRole role="facility_manager">
            <ArtisanDirectory />
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
        path="/board/charges"
        element={
          <RequireRole role="facility_manager">
            <BoardCharges />
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

      <Route
        path="/charges"
        element={
          <RequireRole role="ceo">
            <Charges />
          </RequireRole>
        }
      />

      {/* Both HOME targets must resolve to a real route. Without these the
          catch-all sends them back to "/", which sends them here again —
          an endless redirect rather than a screen. Stage 2 replaces /gate. */}
      <Route
        path="/gate"
        element={
          <RequireRole role="security">
            <Holding what="The gate screen is being built. It will let you check a visitor's code and log them in and out." />
          </RequireRole>
        }
      />
      <Route
        path="/shifts"
        element={
          <RequireRole role="artisan">
            <Holding what="Your shift screen is coming. For now the facility manager will call you when a job is yours." />
          </RequireRole>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
