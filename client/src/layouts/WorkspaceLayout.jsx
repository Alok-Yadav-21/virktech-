import { useAuth } from '../context/AuthContext'
import CustomerShell from './workspace/CustomerShell'
import StaffShell from './workspace/StaffShell'

// One workspace layout; the shell depends on who is signed in (phone-first for customers, sidebar for staff and admin).
export default function WorkspaceLayout() {
  const { user } = useAuth()
  return user.role === 'customer' ? <CustomerShell /> : <StaffShell />
}
