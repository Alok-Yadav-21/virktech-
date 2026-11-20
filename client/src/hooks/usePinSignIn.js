import { useState } from 'react'
import toast from 'react-hot-toast'
import { errMsg } from '../api'

// PIN sign-in that asks which branch they are at when the server cannot tell from the IP (it answers 422), then sends the
// same PIN again with the choice. `send(pin, branchId)` must post with { quiet: true } so the 422 is not shown as an error.
export default function usePinSignIn(send) {
  const [busy, setBusy] = useState(false)
  const [waiting, setWaiting] = useState(null) // the PIN held while they pick a branch

  const attempt = async (pin, branchId) => {
    setBusy(true)
    try {
      await send(pin, branchId)
      setWaiting(null)
    } catch (e) {
      if (e.response?.status === 422) setWaiting(pin)
      else toast.error(errMsg(e))
    } finally { setBusy(false) }
  }

  return { busy, picking: waiting != null, submit: (pin) => attempt(pin), pick: (branchId) => attempt(waiting, branchId), cancel: () => setWaiting(null) }
}
