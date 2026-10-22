import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({ baseURL: '/api', withCredentials: true })

// Server always sends { message }; show it so no failure is silent.
export const errMsg = (e) => e.response?.data?.message || e.message
api.interceptors.response.use((r) => r, (e) => {
  if (!e.config?.quiet) toast.error(errMsg(e))
  return Promise.reject(e)
})

export default api
