import { useState } from 'react'

// The list a person is building on the stock screens (stock to add, or a delivery). Scanning an item already on the list adds one more.
// Nothing is saved until they press the save button, and it lives in memory only.
export default function useLines() {
  const [lines, setLines] = useState([])
  const add = (item) => setLines((ls) => (ls.some((l) => l.id === item.id)
    ? ls.map((l) => (l.id === item.id ? { ...l, qty: l.qty + 1 } : l))
    : [{ ...item, qty: 1, cost: item.lastCost ?? '' }, ...ls]))
  const patch = (id, change) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...change } : l)))
  const remove = (id) => setLines((ls) => ls.filter((l) => l.id !== id))
  return { lines, add, patch, remove, clear: () => setLines([]) }
}
