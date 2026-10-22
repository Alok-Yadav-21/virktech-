// Small inline icon set (24px grid, 1.75 stroke). No icon package: only the glyphs the app uses.
const G = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  bag: <><path d="M5 8h14l-1 12H6z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  wrench: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />,
  cart: <><path d="M3 4h2.2l2.3 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2" /><circle cx="9.5" cy="20" r="1.2" /><circle cx="17" cy="20" r="1.2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  right: <path d="m9 6 6 6-6 6" />,
  left: <path d="m15 6-6 6 6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  up: <path d="m6 15 6-6 6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  pin: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
  laptop: <><rect x="4.5" y="5" width="15" height="10.5" rx="1.5" /><path d="M2.5 19h19" /></>,
  tablet: <><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M11 18h2" /></>,
  audio: <><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="14" width="4.5" height="7" rx="1.5" /><rect x="16.5" y="14" width="4.5" height="7" rx="1.5" /></>,
  watch: <><rect x="7" y="7" width="10" height="10" rx="3" /><path d="M9 7l.6-4h4.8l.6 4M9 17l.6 4h4.8l.6-4" /></>,
  bolt: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H13z" />,
  battery: <><rect x="3" y="7" width="16" height="10" rx="2.5" /><path d="M21 10.5v3M7 12h5" /></>,
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  camera: <><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13.5" r="3.5" /></>,
  crack: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="m13.5 5-2.5 5 3 2.5-2.5 5" /></>,
  box: <><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" /><path d="m3.5 7.5 8.5 4.5 8.5-4.5M12 12v9" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  tag: <><path d="M3 12.5V4h8.5l9 9-8.5 8.5z" /><circle cx="7.5" cy="8.5" r="1.2" /></>,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  sliders: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /><path d="M4 4l16 16" /></>,
  logout: <path d="M10 4H5v16h5M15 8l4 4-4 4M9 12h10" />,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M5 12v8h14v-8" /><path d="M12 8S10.5 3.5 8 4.5 9 8 12 8zm0 0s1.5-4.5 4-3.5S15 8 12 8z" /></>,
  swap: <><path d="M20 11a8 8 0 0 0-14.5-4M4 13a8 8 0 0 0 14.5 4" /><path d="M5.5 3v4h4M18.5 21v-4h-4" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  alert: <><path d="M12 3 2.5 20h19z" /><path d="M12 10v4.5M12 17.5h.01" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
  shield: <><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  chart: <path d="M5 20V10M12 20V4M19 20v-7" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" /><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.8c2 .6 3.5 2.2 3.5 5.2" /></>,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></>,
}

export default function Icon({ name, size = 24, className = '', title, ...rest }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title} focusable="false" {...rest}
    >
      {G[name]}
    </svg>
  )
}
