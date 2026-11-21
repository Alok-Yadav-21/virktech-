// Under a PIN keypad: the branch this device signs in at, with a way to change it (staff are asked again after their next PIN).
export default function BranchNote({ branch, onChange }) {
  if (!branch) return null
  return (
    <p className="text-center small text-secondary mt-3 mb-0">
      Branch: <strong>{branch.name}</strong> · <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={onChange}>Change</button>
    </p>
  )
}
