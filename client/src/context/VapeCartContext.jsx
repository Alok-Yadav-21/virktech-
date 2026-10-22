import { createContext, useContext, useEffect, useState } from 'react'
import { MAX_QTY } from '../vapeConstants'

const VapeCartContext = createContext(null)
export const useVapeCart = () => useContext(VapeCartContext)

// A basket of its own: vapes are collection-only and 18+, so they never share a checkout with electronics.
const KEY = 'vape_cart'
const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] } // blocked/corrupt storage: start empty
}

export function VapeCartProvider({ children }) {
  const [items, setItems] = useState(read)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* storage blocked: basket still works this session */ }
  }, [items])

  const cap = (stock) => Math.max(1, Math.min(stock, MAX_QTY))
  const add = (p, qty = 1) => setItems((cur) => {
    const max = cap(p.stockTotal)
    const found = cur.find((i) => i.productId === p.id)
    if (found) return cur.map((i) => (i.productId === p.id ? { ...i, qty: Math.min(i.qty + qty, max), stock: max } : i))
    return [...cur, { productId: p.id, name: p.name, flavour: p.flavour, brand: p.brand, nicotineMg: p.nicotineMg, price: p.price, image: p.image, stock: max, qty: Math.min(qty, max) }]
  })
  const setQty = (productId, qty) => setItems((cur) => cur.map((i) => (i.productId === productId ? { ...i, qty: Math.max(1, Math.min(qty, i.stock)) } : i)))
  const remove = (productId) => setItems((cur) => cur.filter((i) => i.productId !== productId))
  const clear = () => setItems([])

  const count = items.reduce((n, i) => n + i.qty, 0)
  const total = items.reduce((n, i) => n + Math.round(i.price * 100) * i.qty, 0) / 100

  return <VapeCartContext.Provider value={{ items, add, setQty, remove, clear, count, total }}>{children}</VapeCartContext.Provider>
}
