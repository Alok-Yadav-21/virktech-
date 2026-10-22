export const gbp = (n) => (n == null ? '' : `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: n % 1 ? 2 : 0 })}`)
export const when = (d) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
