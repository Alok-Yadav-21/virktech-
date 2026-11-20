// Brand artwork, transparent: the V-in-a-phone mark and the full "VIRKTECH Mobile & Vape Experts" lockup.
// The wordmark's "VIRK" is white in the original, which vanishes on a light page, so there are two
// files per piece: the default has it in ink for light surfaces, `inverted` keeps it white for dark ones
// (the footer). Same artwork either way; only that one colour changes.
const file = (name, inverted) => `/img/virktech-${name}${inverted ? '-on-dark' : ''}.png`

export function LogoMark({ size = 36, inverted = false }) {
  return (
    <img src={file('mark', inverted)} alt="" width={size} height={size} decoding="async"
      style={{ display: 'block', flex: 'none' }} />
  )
}

// `subtitle` is kept so existing callers need no change: the tagline is part of the lockup.
export default function Logo({ inverted = false, height = 48 }) {
  return (
    <img src={file('logo', inverted)} alt="Virktech - Mobile & Vape Experts"
      width={Math.round(height * (1460 / 351))} height={height} decoding="async"
      style={{ display: 'block', height, width: 'auto' }} />
  )
}
