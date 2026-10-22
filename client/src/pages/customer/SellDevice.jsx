import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../api'
import { useBranch } from '../../context/BranchContext'
import { Skeleton } from '../../components/ui/primitives'
import { ChoiceCards, DevicePicker, FormSection, SubmitBar } from '../../components/ui/FormBits'
import { DEVICE_CATEGORIES } from '../../constants'

const CONDITIONS = [
  ['Like new', 'Like new', 'No marks, works perfectly.'],
  ['Good', 'Good', 'Light marks, works perfectly.'],
  ['Fair', 'Fair', 'Visible wear or small faults.'],
  ['Poor', 'Poor', 'Heavy wear, cracks or faults.'],
]

export default function SellDevice() {
  const { branches, branch, setBranchId } = useBranch()
  const navigate = useNavigate()
  const [form, setForm] = useState({ branchId: branch?.id ? String(branch.id) : '', category: DEVICE_CATEGORIES[0], brand: '', model: '', condition: 'Good', details: '', photos: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  // Saved branch can arrive after first render.
  if (branch && !form.branchId) setForm((f) => ({ ...f, branchId: String(branch.id) }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { branchId, category, brand, model, condition, details, photos } = form
      const { data } = await api.post('/tradeins', {
        branchId: Number(branchId), device: { category, brand, model }, condition, details,
        photos: photos.split('\n').map((l) => l.trim()).filter(Boolean),
      })
      setBranchId(Number(branchId))
      toast.success(`Request sent: ${data.reference}`)
      navigate(`/app/tradeins/${data.reference}`)
    } catch { /* api.js already toasted the server message */ } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="mx-auto" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-1">Sell your device</h1>
      <p className="text-secondary mb-3">Tell us what you have and we will send you an offer. You choose whether to accept it. The offer is confirmed after an in-branch check.</p>

      <FormSection title="Your device">
        <DevicePicker value={form.category} onChange={(category) => setForm({ ...form, category })} />
        <div className="row g-3">
          <div className="col-6"><label className="form-label" htmlFor="brand">Brand</label><input id="brand" className="form-control" placeholder="e.g. Apple" autoComplete="off" value={form.brand} onChange={set('brand')} /></div>
          <div className="col-6"><label className="form-label" htmlFor="model">Model</label><input id="model" className="form-control" placeholder="e.g. iPhone 12" required autoComplete="off" value={form.model} onChange={set('model')} /></div>
        </div>
      </FormSection>

      <FormSection title="What condition is it in?">
        <ChoiceCards name="condition" value={form.condition} onChange={(condition) => setForm({ ...form, condition })} options={CONDITIONS} />
        <label className="form-label mt-3" htmlFor="details">Anything else? <span className="text-secondary fw-normal">(storage, faults, accessories)</span></label>
        <textarea id="details" className="form-control" rows={3} maxLength={2000} value={form.details} onChange={set('details')} />
      </FormSection>

      <FormSection title="Where will you bring it?">
        <label className="form-label" htmlFor="branch">Branch</label>
        {!branches.length ? <Skeleton h="3rem" /> : (
          <select id="branch" className="form-select" required value={form.branchId} onChange={set('branchId')}>
            <option value="">Choose a branch…</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.area} · {b.address}</option>)}
          </select>
        )}
        <details className="mt-3">
          <summary className="vt-sum">Add photo links (optional)</summary>
          <label className="form-label visually-hidden" htmlFor="photos">Photo links, one per line</label>
          <textarea id="photos" className="form-control" rows={2} placeholder="https://… (one per line, up to 5)" value={form.photos} onChange={set('photos')} />
        </details>
      </FormSection>

      <SubmitBar busy={busy} label="Request an offer" busyLabel="Sending…" />
    </form>
  )
}
