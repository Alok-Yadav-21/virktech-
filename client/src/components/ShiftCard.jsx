import { useEffect, useState } from 'react'
import useFetch from '../hooks/useFetch'
import { clock } from '../format'
import { ErrorState, Skeleton } from './ui/primitives'

// Shows the signed-in staff member's shift. Shifts are started and ended only at the till, never here. The clock
// counts from the server start time, measured against the server's "now", so a wrong tablet clock cannot change it.
export default function ShiftCard() {
  const { data, error, reload } = useFetch('/shifts/current')
  const [skew, setSkew] = useState(0) // server time minus this device's time
  const [now, setNow] = useState(Date.now())
  const shift = data?.shift

  useEffect(() => { if (data) setSkew(new Date(data.serverNow) - Date.now()) }, [data])
  useEffect(() => {
    if (!shift) return undefined
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [shift])

  if (error) return <ErrorState onRetry={reload}>We could not load your shift.</ErrorState>
  if (!data) return <Skeleton h="5rem" className="mb-3" />

  return (
    <div className="vt-card p-3 mb-3">
      {shift ? (
        <>
          <span className="text-secondary small d-block">Shift running since {new Date(shift.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="fw-bold lh-1" style={{ fontSize: '2rem', fontVariantNumeric: 'tabular-nums' }}>{clock(now + skew - new Date(shift.startedAt))}</span>
          <span className="text-secondary small d-block mt-1">End your shift at the till.</span>
        </>
      ) : (
        <>
          <strong className="d-block">No shift running</strong>
          <span className="text-secondary small">Start your shift at the till.</span>
        </>
      )}
    </div>
  )
}
