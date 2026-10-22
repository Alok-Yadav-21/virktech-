import { useEffect, useState } from 'react'

// Waits until the value stops changing, so typing in a search box does not fire a request per key.
export default function useDebounce(value, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}
