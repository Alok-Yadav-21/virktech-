import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CustomerDashboard from './customer/Dashboard'
import StaffDashboard from './StaffDashboard'
import WorkingNow from '../components/WorkingNow'

// Same route for every role; what each person sees at home is different.
export default function Dashboard() {
  const { user } = useAuth()
  if (user.role === 'customer') return <CustomerDashboard />
  return (
    <>
      {user.role === 'staff' && (
        // The till is the staff member's main job, so it is the first thing on their home page.
        <Link to="/till" className="btn btn-primary btn-lg w-100 mb-3">Open the till</Link>
      )}
      {user.role === 'admin' && <WorkingNow />}
      <StaffDashboard />
    </>
  )
}
