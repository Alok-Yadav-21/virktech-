export const gbp = (n) => (n == null ? '' : `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: n % 1 ? 2 : 0 })}`)
export const when = (d) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
export const hours = (minutes) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
// 3725000 ms -> "01:02:05" for the running shift clock.
export const clock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':')
}
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
