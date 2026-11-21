import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import usePinSignIn from '../../hooks/usePinSignIn'
import AuthShell from '../../components/auth/AuthShell'
import BranchNote from '../../components/BranchNote'
import BranchPicker from '../../components/BranchPicker'
import PinPad from '../../components/PinPad'
import { landing } from './Login'

// Staff sign in with their 6-digit PIN alone, tapped on the keypad; it logs in as soon as the sixth digit is entered.
// The first time on a device they pick the branch they are working at; it is remembered, so after that it is just the PIN.
export default function StaffLogin() {
  const { user, pinLogin } = useAuth()
  const navigate = useNavigate()
  const { busy, picking, submit, pick, cancel, branch, change } = usePinSignIn(async (pin, branchId) => {
    navigate(landing(await pinLogin(pin, branchId)), { replace: true })
  })

  if (user) return <Navigate to={landing(user)} replace />

  return (
    <AuthShell title="Staff login" subtitle={picking ? 'PIN accepted.' : 'Type your 6-digit PIN.'} footer={<><Link to="/till" className="fw-semibold">Open the till</Link> · <Link to="/login">Customer login</Link></>}>
      {picking ? <BranchPicker onPick={pick} onCancel={cancel} busy={busy} /> : <><PinPad onComplete={submit} disabled={busy} /><BranchNote branch={branch} onChange={change} /></>}
    </AuthShell>
  )
}
