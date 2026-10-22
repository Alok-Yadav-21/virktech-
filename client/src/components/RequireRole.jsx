import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { WORKSPACE } from '../constants'

// UX guard only; the server enforces the same roles on every route.
export default function RequireRole({ role }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (user.role !== role) return <Navigate to={WORKSPACE[user.role].home} replace />
  return <Outlet />
}
