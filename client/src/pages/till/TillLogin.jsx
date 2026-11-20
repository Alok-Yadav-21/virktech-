import api from '../../api'
import { Link } from 'react-router-dom'
import usePinSignIn from '../../hooks/usePinSignIn'
import AuthShell from '../../components/auth/AuthShell'
import BranchPicker from '../../components/BranchPicker'
import PinPad from '../../components/PinPad'

// The till's own sign-in: whoever sits down taps their PIN on the keypad. It signs in to the till only, never to a dashboard,
// and starts their shift, so there is nothing more to confirm. From an IP no branch has saved they pick the branch they are at.
export default function TillLogin({ onSignedIn }) {
  const { busy, picking, submit, pick, cancel } = usePinSignIn(async (pin, branchId) => {
    await api.post('/till/login', { pin, branchId }, { quiet: true })
    onSignedIn()
  })

  return (
    <div className="container py-5">
      <AuthShell title="Till" subtitle={picking ? 'PIN accepted.' : 'Tap your 6-digit PIN to use the till.'} footer={<Link to="/login">Back to login</Link>}>
        {picking ? <BranchPicker onPick={pick} onCancel={cancel} busy={busy} /> : <PinPad onComplete={submit} disabled={busy} />}
      </AuthShell>
    </div>
  )
}
