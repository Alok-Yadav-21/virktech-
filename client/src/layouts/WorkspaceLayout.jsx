import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import useIdleLogout from '../hooks/useIdleLogout'
import CustomerShell from './workspace/CustomerShell'
import StaffShell from './workspace/StaffShell'

// One workspace layout; the shell depends on who is signed in (phone-first for customers, sidebar for staff and admin).
// Staff and admin are signed out after 10 minutes without input (customers are not).
export default function WorkspaceLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const customer = user.role === 'customer'
  useIdleLogout(async () => {
    try { await logout() } catch { return /* api.js already toasted; stay signed in rather than look signed out */ }
    toast('Logged out after 10 minutes of inactivity')
    navigate('/login')
  }, !customer)
  return customer ? <CustomerShell /> : <StaffShell />
}
