import Icon from '../ui/Icon'
import { CUSTOMER_STAGES } from '../../constants'

// Customer-facing progress. The server picks the stage; this only draws it.
export default function Timeline({ repair }) {
  const { stage } = repair
  if (stage.index < 0) {
    return (
      <div className="alert alert-danger mb-0 d-flex gap-2" role="status">
        <Icon name="x" size={22} className="flex-none" />
        <span><strong className="d-block">Cancelled</strong>{repair.cancelReason || 'This repair was cancelled.'}</span>
      </div>
    )
  }
  return (
    <ol className="vt-steps">
      {CUSTOMER_STAGES.map((label, i) => {
        const done = i < stage.index || (i === stage.index && stage.key === 'done')
        const current = i === stage.index && !done
        return (
          <li key={label} className={`vt-step ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`} aria-current={current ? 'step' : undefined}>
            <span className="vt-dot" aria-hidden="true">{done ? <Icon name="check" size={14} strokeWidth={3} /> : i + 1}</span>
            <span>
              {current ? stage.label : label}
              {current && stage.nextStep && <span className="d-block small text-secondary fw-normal mt-1">{stage.nextStep}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
