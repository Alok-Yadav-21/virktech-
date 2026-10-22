// Brand mark: a green rounded square with a V and a lime dot (the phone's camera).
export function LogoMark({ size = 36, inverted = false }) {
  const bg = inverted ? '#fff' : 'var(--vt-green-600)'
  const fg = inverted ? 'var(--vt-green-700)' : '#fff'
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <rect width="36" height="36" rx="11" fill={bg} />
      <path d="M9.5 11.5 18 26l8.5-14.5" fill="none" stroke={fg} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="26.5" cy="9.5" r="2.6" fill="var(--vt-lime)" />
    </svg>
  )
}

export default function Logo({ inverted = false, subtitle = false }) {
  return (
    <>
      <LogoMark inverted={inverted} />
      <span style={{ lineHeight: 1.05, color: inverted ? '#fff' : undefined }}>
        Virktech
        {subtitle && <small style={{ color: inverted ? 'rgb(255 255 255 / 0.85)' : undefined }}>Smart Phones Repair</small>}
      </span>
    </>
  )
}
