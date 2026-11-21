import api from '../../api'
import { Link } from 'react-router-dom'
import usePinSignIn from '../../hooks/usePinSignIn'
import AuthShell from '../../components/auth/AuthShell'
import BranchNote from '../../components/BranchNote'
import BranchPicker from '../../components/BranchPicker'
import PinPad from '../../components/PinPad'

// The till's own sign-in: whoever sits down taps their PIN on the keypad. It signs in to the till only, never to a dashboard,
// and starts their shift, so there is nothing more to confirm. The first time on a device they pick the branch it is at; it is remembered, so after that it is just the PIN.
export default function TillLogin({ onSignedIn }) {
  const { busy, picking, submit, pick, cancel, branch, change } = usePinSignIn(async (pin, branchId) => {
    await api.post('/till/login', { pin, branchId }, { quiet: true })
    onSignedIn()
  })

  return (
    <div className="container py-5">
      <AuthShell title="Till" subtitle={picking ? 'PIN accepted.' : 'Tap your 6-digit PIN to use the till.'} footer={<Link to="/login">Back to login</Link>}>
        {picking ? <BranchPicker onPick={pick} onCancel={cancel} busy={busy} /> : <><PinPad onComplete={submit} disabled={busy} /><BranchNote branch={branch} onChange={change} /></>}
      </AuthShell>
    </div>
  )
}
