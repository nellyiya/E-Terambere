import axios, { type InternalAxiosRequestConfig } from 'axios'
import { clearToken, getToken } from './auth'
const ROOT = import.meta.env.VITE_API_ROOT ?? 'http://localhost:8000'
const attach = (c: InternalAxiosRequestConfig) => { const t = getToken(); if (t) c.headers.Authorization = `Bearer ${t}`; return c }
// An expired or rejected token sends the person back to the sign-in page. A wrong password on the sign-in form itself is handled there.
const onError = (e: unknown) => {
  if (axios.isAxiosError(e) && e.response?.status === 401 && getToken() && !e.config?.url?.endsWith('/login')) { clearToken(); window.location.assign('/login?expired=1') }
  return Promise.reject(e)
}
export const api = axios.create({ baseURL: import.meta.env.VITE_ADMIN_API_URL ?? `${ROOT}/api/admin` })
export const authClient = axios.create({ baseURL: `${ROOT}/api/auth` })
for (const c of [api, authClient]) { c.interceptors.request.use(attach); c.interceptors.response.use(r => r, onError) }
// Turns any request failure into one readable sentence for the screen.
export const errMsg = (e: unknown): string => {
  if (axios.isAxiosError(e)) {
    if (!e.response) return 'Cannot reach the server. Check that the backend is running on port 8000.'
    const d = e.response.data?.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) return d.map((x: { loc?: string[]; msg: string }) => `${x.loc?.slice(-1)[0] ?? 'Field'}: ${x.msg}`).join('; ')
  }
  return 'Something went wrong. Please try again.'
}
