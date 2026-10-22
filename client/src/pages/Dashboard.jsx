import { useAuth } from '../context/AuthContext'
import CustomerDashboard from './customer/Dashboard'
import StaffDashboard from './StaffDashboard'

// Same route for every role; what each person sees at home is different.
export default function Dashboard() {
  const { user } = useAuth()
  return user.role === 'customer' ? <CustomerDashboard /> : <StaffDashboard />
}
