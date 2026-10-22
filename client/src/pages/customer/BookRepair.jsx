import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../api'
import { useBranch } from '../../context/BranchContext'
import Icon from '../../components/ui/Icon'
import { Chip, Skeleton } from '../../components/ui/primitives'
import { ChoiceCards, DevicePicker, FormSection, SubmitBar } from '../../components/ui/FormBits'
import { DEVICE_CATEGORIES, REPAIR_ISSUES } from '../../constants'

const FULFIL = [
  ['in_store', 'I will bring it in', 'Drop it at your branch.'],
  ['collection', 'Collect it from me', 'We collect it from you.'],
  ['mail_in', 'I will post it', 'Send it to your branch.'],
]

export default function BookRepair() {
  const { branches, branch, setBranchId } = useBranch()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ branchId: branch?.id ? String(branch.id) : '', category: DEVICE_CATEGORIES[0], brand: '', model: '', problem: params.get('problem') || '', fulfilment: 'in_store' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  // Saved branch can arrive after first render.
  if (branch && !form.branchId) setForm((f) => ({ ...f, branchId: String(branch.id) }))

  const pick = (issue) => setForm((f) => ({ ...f, problem: issue.problem }))
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { branchId, category, brand, model, problem, fulfilment } = form
      const { data } = await api.post('/repairs', { branchId: Number(branchId), device: { category, brand, model }, problem, fulfilment })
      setBranchId(Number(branchId))
      toast.success(`Booked: ${data.reference}`)
      navigate(`/app/repairs/${data.reference}`)
    } catch { /* api.js already toasted the server message */ } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="mx-auto" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-1">Book a repair</h1>
      <p className="text-secondary mb-3">Tell us what is wrong. We will send you a price, and nothing starts until you approve it.</p>

      <FormSection title="What needs fixing?">
        <div className="vt-rail" role="group" aria-label="Common problems">
          {REPAIR_ISSUES.filter((i) => i.problem).map((i) => (
            <Chip key={i.label} active={form.problem === i.problem} onClick={() => pick(i)}><Icon name={i.icon} size={20} />{i.label}</Chip>
          ))}
        </div>
        <label className="form-label" htmlFor="problem">Describe the problem</label>
        <textarea id="problem" className="form-control" rows={3} required maxLength={2000} placeholder="What happened, and what does it do now?" value={form.problem} onChange={set('problem')} />
      </FormSection>

      <FormSection title="Your device">
        <DevicePicker value={form.category} onChange={(category) => setForm({ ...form, category })} />
        <div className="row g-3">
          <div className="col-6"><label className="form-label" htmlFor="brand">Brand</label><input id="brand" className="form-control" placeholder="e.g. Apple" autoComplete="off" value={form.brand} onChange={set('brand')} /></div>
          <div className="col-6"><label className="form-label" htmlFor="model">Model</label><input id="model" className="form-control" placeholder="e.g. iPhone 13" required autoComplete="off" value={form.model} onChange={set('model')} /></div>
        </div>
      </FormSection>

      <FormSection title="Where will it go?">
        <label className="form-label" htmlFor="branch">Branch</label>
        {!branches.length ? <Skeleton h="3rem" /> : (
          <select id="branch" className="form-select mb-3" required value={form.branchId} onChange={set('branchId')}>
            <option value="">Choose a branch…</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.area} · {b.address}</option>)}
          </select>
        )}
        <ChoiceCards name="fulfilment" value={form.fulfilment} onChange={(fulfilment) => setForm({ ...form, fulfilment })} options={FULFIL} />
      </FormSection>

      <SubmitBar busy={busy} label="Book repair" busyLabel="Booking…" note="You pay when you collect." />
    </form>
  )
}
