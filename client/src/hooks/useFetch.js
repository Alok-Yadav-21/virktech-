import { useEffect, useState, useCallback, useRef } from 'react'
import api from '../api'

// Pass null to skip the request. total: the full match count the server reports for paged lists (X-Total-Count), else null.
export default function useFetch(url) {
  const [data, setData] = useState(null)
  const [total, setTotal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const latest = useRef(0)

  const load = useCallback(() => {
    if (!url) { setData(null); setLoading(false); return Promise.resolve() }
    const mine = ++latest.current // a slow older response must not overwrite a newer one (fast typing in search)
    setLoading(true)
    return api.get(url)
      .then((r) => {
        if (mine !== latest.current) return
        setData(r.data)
        setTotal(r.headers['x-total-count'] != null ? Number(r.headers['x-total-count']) : null)
        setError(null)
      })
      .catch((e) => { if (mine === latest.current) setError(e) })
      .finally(() => { if (mine === latest.current) setLoading(false) })
  }, [url])

  useEffect(() => { load() }, [load])
  return { data, total, loading, error, reload: load }
}
