import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import usePinSignIn from '../../hooks/usePinSignIn'
import AuthShell from '../../components/auth/AuthShell'
import BranchPicker from '../../components/BranchPicker'
import PinPad from '../../components/PinPad'
import { landing } from './Login'

// Staff sign in with their 6-digit PIN alone, tapped on the keypad; it logs in as soon as the sixth digit is entered.
// From an IP no branch has saved they then pick the branch they are working at.
export default function StaffLogin() {
  const { user, pinLogin } = useAuth()
  const navigate = useNavigate()
  const { busy, picking, submit, pick, cancel } = usePinSignIn(async (pin, branchId) => {
    navigate(landing(await pinLogin(pin, branchId)), { replace: true })
  })

  if (user) return <Navigate to={landing(user)} replace />

  return (
    <AuthShell title="Staff login" subtitle={picking ? 'PIN accepted.' : 'Type your 6-digit PIN.'} footer={<><Link to="/till" className="fw-semibold">Open the till</Link> · <Link to="/login">Customer login</Link></>}>
      {picking ? <BranchPicker onPick={pick} onCancel={cancel} busy={busy} /> : <PinPad onComplete={submit} disabled={busy} />}
    </AuthShell>
  )
}
