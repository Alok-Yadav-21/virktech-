import { createContext, useContext, useEffect, useState } from 'react'

const CartContext = createContext(null)
export const useCart = () => useContext(CartContext)

const KEY = 'cart'
// Cart lives in the browser only; checkout sends ids + quantities and the server prices them.
const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] } // blocked/corrupt storage: start empty
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(read)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* storage blocked: cart still works this session */ }
  }, [items])

  // Soft limit: the total across branches. Checkout checks the branch the customer actually picks.
  const add = (p, qty = 1) => setItems((cur) => {
    const max = p.stockTotal
    const found = cur.find((i) => i.productId === p.id)
    if (found) return cur.map((i) => (i.productId === p.id ? { ...i, qty: Math.min(i.qty + qty, max), stock: max } : i))
    return [...cur, { productId: p.id, name: p.name, price: p.price, image: p.image, stock: max, qty: Math.min(qty, max) }]
  })
  const setQty = (productId, qty) => setItems((cur) =>
    cur.map((i) => (i.productId === productId ? { ...i, qty: Math.max(1, Math.min(qty, i.stock)) } : i)))
  const remove = (productId) => setItems((cur) => cur.filter((i) => i.productId !== productId))
  const clear = () => setItems([])

  const count = items.reduce((n, i) => n + i.qty, 0)
  const total = items.reduce((n, i) => n + Math.round(i.price * 100) * i.qty, 0) / 100

  return <CartContext.Provider value={{ items, add, setQty, remove, clear, count, total }}>{children}</CartContext.Provider>
}
