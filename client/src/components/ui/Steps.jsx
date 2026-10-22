import Icon from './Icon'

// Vertical progress list. `current` is the index of the step the customer is on; steps before it are done.
export default function Steps({ steps, current, finished = false }) {
  return (
    <ol className="vt-steps">
      {steps.map((s, i) => {
        const done = i < current || (finished && i === current)
        const now = i === current && !done
        return (
          <li key={s.label} className={`vt-step ${done ? 'is-done' : ''} ${now ? 'is-current' : ''}`} aria-current={now ? 'step' : undefined}>
            <span className="vt-dot" aria-hidden="true">{done ? <Icon name="check" size={14} strokeWidth={3} /> : i + 1}</span>
            <span>{s.label}{now && s.hint && <span className="d-block small text-secondary fw-normal mt-1">{s.hint}</span>}</span>
          </li>
        )
      })}
    </ol>
  )
}
