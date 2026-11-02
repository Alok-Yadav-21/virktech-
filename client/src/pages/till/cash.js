// Cash helpers for the till. Everything is whole pence so adding notes and coins never drifts (0.1 + 0.2).
export const NOTES_AND_COINS = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5]

// Bill rounded UP to the next £5, £10, £20, £50 and £100: always strictly above the bill, no repeats, at most 5.
export function roundUps(billPence) {
  const steps = [500, 1000, 2000, 5000, 10000]
  return [...new Set(steps.map((s) => Math.floor(billPence / s) * s + s))].sort((a, b) => a - b).slice(0, 5)
}

// 500 -> "£5", 1250 -> "£12.50", 50 -> "50p"
export const label = (pence) => (pence < 100 ? `${pence}p` : `£${(pence / 100).toFixed(pence % 100 ? 2 : 0)}`)
