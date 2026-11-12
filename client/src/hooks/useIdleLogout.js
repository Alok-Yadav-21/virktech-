import { useEffect, useRef } from 'react'

const EVENTS = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'scroll']
export const IDLE_MS = 10 * 60 * 1000

// Calls onIdle once after `ms` without any input. Pass enabled=false to switch it off (e.g. nobody signed in).
// ponytail: browser-side timer only; a copied cookie stays valid until its token expires. Add a server-side
// last-seen check if that ever matters.
export default function useIdleLogout(onIdle, enabled = true, ms = IDLE_MS) {
  const latest = useRef(onIdle)
  latest.current = onIdle // always call the newest callback without restarting the timer

  useEffect(() => {
    if (!enabled) return undefined
    let timer
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => latest.current(), ms) }
    EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => { clearTimeout(timer); EVENTS.forEach((e) => window.removeEventListener(e, reset)) }
  }, [enabled, ms])
}
