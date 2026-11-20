import { createContext, useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api, { errMsg } from '../api'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // quiet: being logged out on first load is normal, not an error toast.
  useEffect(() => {
    api.get('/auth/me', { quiet: true })
      .then((r) => setUser(r.data))
      .catch((e) => { if (e.response?.status !== 401) toast.error(errMsg(e)) })
      .finally(() => setLoading(false))
  }, [])

  // Re-read the account so a points balance shown at checkout is current.
  const refresh = () => api.get('/auth/me').then((r) => setUser(r.data)).catch(() => { /* api.js already toasted */ })
  const login = (email, password) => api.post('/auth/login', { email, password }).then((r) => (setUser(r.data), r.data))
  // quiet: the caller decides what to show, because a 422 means "ask which branch", not an error.
  const pinLogin = (pin, branchId) => api.post('/auth/pin-login', { pin, branchId }, { quiet: true }).then((r) => (setUser(r.data), r.data))
  const register = (form) => api.post('/auth/register', form).then((r) => (setUser(r.data), r.data))
  const logout = () => api.post('/auth/logout').then(() => setUser(null))

  return <AuthContext.Provider value={{ user, loading, login, pinLogin, register, logout, refresh }}>{children}</AuthContext.Provider>
}
