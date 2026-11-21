import { useState } from 'react'
import toast from 'react-hot-toast'
import { errMsg } from '../api'
import { getDeviceBranch, saveDeviceBranch, clearDeviceBranch } from '../deviceBranch'

// PIN sign-in that sends the branch this device is used at, and only asks which branch when it does not know yet (the server
// answers 422), or when the remembered one is no longer valid (400). The answer is remembered on this device, so the question
// comes once, not at every PIN. `send(pin, branchId)` must post with { quiet: true } so those answers are not shown as errors.
export default function usePinSignIn(send) {
  const [busy, setBusy] = useState(false)
  const [waiting, setWaiting] = useState(null) // the PIN held while they pick a branch
  const [branch, setBranch] = useState(getDeviceBranch) // { id, name } remembered for this device, or null

  const attempt = async (pin, picked) => {
    const use = picked ?? branch
    setBusy(true)
    try {
      await send(pin, use?.id)
      if (picked) { saveDeviceBranch(picked); setBranch(picked) }
      setWaiting(null)
    } catch (e) {
      const status = e.response?.status
      if (status === 422 || (status === 400 && use)) {
        if (use) { clearDeviceBranch(); setBranch(null) } // it no longer exists: forget it and ask again
        setWaiting(pin)
      } else toast.error(errMsg(e))
    } finally { setBusy(false) }
  }

  return {
    busy, branch, picking: waiting != null,
    submit: (pin) => attempt(pin),
    pick: (id, name) => attempt(waiting, { id, name }),
    cancel: () => setWaiting(null),
    change: () => { clearDeviceBranch(); setBranch(null) }, // asked again after the next PIN
  }
}
