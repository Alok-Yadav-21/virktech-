import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import { Sheet } from '../components/ui/primitives'
import Icon from '../components/ui/Icon'

// "Collecting from: Belvedere". The customer's preferred branch, remembered on this phone and used to
// prefill booking, selling and checkout. It is a convenience only: the server still validates every branch.
const BranchContext = createContext(null)
export const useBranch = () => useContext(BranchContext)

const KEY = 'vt_branch'
const read = () => {
  try { return Number(localStorage.getItem(KEY)) || null } catch { return null } // storage blocked: no saved branch
}

export function BranchProvider({ children }) {
  const [branches, setBranches] = useState([])
  const [branchId, setId] = useState(read)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // quiet: the picker is an extra; pages work without it, so a failed load should not toast.
    api.get('/branches', { quiet: true }).then((r) => setBranches(r.data)).catch(() => setBranches([])) // no list: picker shows empty
  }, [])

  const value = useMemo(() => ({
    branches,
    branch: branches.find((b) => b.id === branchId) || null,
    setBranchId: (id) => {
      setId(id)
      try { localStorage.setItem(KEY, String(id)) } catch { /* storage blocked: the choice lasts this visit only */ }
    },
    openPicker: () => setOpen(true),
  }), [branches, branchId])

  return (
    <BranchContext.Provider value={value}>
      {children}
      <BranchPicker open={open} onClose={() => setOpen(false)} value={value} />
    </BranchContext.Provider>
  )
}

function BranchPicker({ open, onClose, value }) {
  const { branches, branch, setBranchId } = value
  return (
    <Sheet
      show={open}
      onHide={onClose}
      title="Where will you collect from?"
      footer={<Link to="/branches" onClick={onClose} className="btn btn-outline-secondary w-100"><Icon name="pin" size={18} />Find the nearest by postcode</Link>}
    >
      {!branches.length && <p className="text-secondary">Branches could not be loaded. Try again in a moment.</p>}
      <div className="d-grid gap-2">
        {branches.map((b) => (
          <label key={b.id} className="vt-choice">
            <input type="radio" name="branch" className="form-check-input mt-0" checked={branch?.id === b.id} onChange={() => { setBranchId(b.id); onClose() }} />
            <span>
              <strong className="d-block">{b.area}</strong>
              <span className="text-secondary small">{b.address}, {b.postcode}</span>
            </span>
          </label>
        ))}
      </div>
    </Sheet>
  )
}
