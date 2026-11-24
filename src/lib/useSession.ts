import { useEffect } from 'react'
import { refreshToken } from '../services/authApi'
const IDLE_MS = 30 * 60_000   // signed out after 30 minutes without activity
const RENEW_MS = 20 * 60_000  // while active, the sign-in is renewed every 20 minutes
export function useSession(onEnd: () => void) {
  useEffect(() => {
    let last = Date.now()
    const touch = () => { last = Date.now() }
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, touch, { passive: true }))
    const idle = setInterval(() => { if (Date.now() - last > IDLE_MS) onEnd() }, 30_000)
    const renew = setInterval(() => { if (Date.now() - last < IDLE_MS) refreshToken().catch(() => { /* a rejected token is handled by the api client */ }) }, RENEW_MS)
    return () => { events.forEach(e => window.removeEventListener(e, touch)); clearInterval(idle); clearInterval(renew) }
  }, [onEnd])
}
