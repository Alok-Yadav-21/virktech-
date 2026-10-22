import { Link } from 'react-router-dom'
import { StatusPill } from '../ui/primitives'
import Icon from '../ui/Icon'
import { CUSTOMER_STAGES, STAGE_TONE } from '../../constants'
import { gbp } from '../../format'

// A repair on the customer's home screen: what it is, where it is, what to do next.
export default function RepairProgress({ repair: r, to }) {
  const { stage } = r
  const pct = stage.index < 0 ? 0 : Math.round(((stage.index + 1) / CUSTOMER_STAGES.length) * 100)
  return (
    <Link to={to} className="vt-card d-block p-3">
      <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
        <div className="min-w-0">
          <strong className="d-block text-truncate">{[r.device.brand, r.device.model].filter(Boolean).join(' ')}</strong>
          <span className="text-secondary small">{r.reference} · {r.branch.area}</span>
        </div>
        <StatusPill tone={STAGE_TONE[stage.key]}>{stage.label}</StatusPill>
      </div>
      <div className="progress mb-2" role="progressbar" aria-label="Repair progress" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"><div className="progress-bar" style={{ width: `${pct}%` }} /></div>
      <p className="small mb-0 d-flex align-items-center justify-content-between gap-2">
        <span className={stage.nextStep ? 'fw-semibold' : 'text-secondary'}>
          {stage.key === 'approval' && r.quote != null ? `Quote ${gbp(r.quote)}. ${stage.nextStep}` : stage.nextStep || `Step ${Math.max(stage.index + 1, 1)} of ${CUSTOMER_STAGES.length}`}
        </span>
        <Icon name="right" size={18} className="flex-none text-secondary" />
      </p>
    </Link>
  )
}
