import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getToken } from '../lib/auth'
export default function RequireAuth({ children }: { children: ReactNode }) {
  const loc = useLocation()
  return getToken() ? <>{children}</> : <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
}
