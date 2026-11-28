import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FolderKanban, Users, FileText, HardHat, Wallet, Settings, ChevronsLeft, LogOut } from 'lucide-react'
import { useCallback, useState, type CSSProperties } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clearToken } from '../lib/auth'
import { useSession } from '../lib/useSession'
import { getSettings } from '../services/settings'
import GlobalSearch from './GlobalSearch'
import Notifications from './Notifications'
import ThemeToggle from './ThemeToggle'
export const nav = [
  ['Dashboard','/dashboard',LayoutDashboard],['Projects','/projects',FolderKanban],['Supervisors','/supervisors',Users],['Daily Reports','/reports',FileText],
  ['Cost Management','/project-management',Wallet],['Settings','/settings',Settings]] as const
// Brand teal from the target design. Set here so the whole app picks it up without editing the CSS file.
const theme = { '--color-brand': '#1c8578' } as CSSProperties
export default function Layout() {
  const [open, setOpen] = useState(true), qc = useQueryClient(), go = useNavigate()
  const endSession = useCallback((expired = false) => { clearToken(); qc.clear(); go(expired ? '/login?expired=1' : '/login', { replace: true }) }, [qc, go])
  useSession(useCallback(() => endSession(true), [endSession]))
  const { data: me } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  return (
    <div className="flex h-screen" style={theme}>
      <aside className={`${open ? 'w-60' : 'w-16'} flex shrink-0 flex-col border-r border-slate-200 bg-white transition-all`}>
        <div className="flex h-15 shrink-0 items-center justify-between px-4">
          <span className="flex items-center gap-2 text-lg font-semibold tracking-tight text-brand"><HardHat size={22} />{open && (me?.org || 'E-Terambere')}</span>
          <button onClick={() => setOpen(!open)} aria-label="Collapse sidebar" className="rounded p-1 hover:bg-slate-100"><ChevronsLeft size={18} /></button>
        </div>
        <nav className="space-y-1 px-2">
          {nav.map(([l, to, I]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm focus:outline-2 focus:outline-offset-0 focus:outline-slate-950 ${isActive ? 'bg-brand font-medium text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              <I size={18} />{open && l}</NavLink>))}
        </nav>

        <div className="flex-1" />

        {/* Configuration: light/dark mode */}
        <div className={open ? 'mx-2 rounded-2xl border border-slate-200 bg-slate-50 p-3' : 'flex justify-center py-2'}>
          {open && <p className="mb-2 text-center text-xs text-slate-500">Configuration</p>}
          <div className={`flex items-center text-sm text-slate-600 ${open ? 'justify-between px-1' : 'justify-center'}`}>
            {open && <span>Light Mode</span>}
            <ThemeToggle />
          </div>
        </div>

        {/* Logout */}
        <div className="p-2 pb-5">
          <button onClick={() => endSession()} aria-label="Sign out" title="Sign out" className="flex w-full items-center justify-center gap-2 rounded-full bg-brand py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 focus:outline-2 focus:outline-offset-2 focus:outline-slate-950">
            <LogOut size={18} />{open && 'Logout'}
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-15 items-center gap-4 border-b border-slate-200 bg-white px-6">
          <GlobalSearch />
          <Notifications />
          <div className="flex items-center gap-2 text-sm"><span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-white">{(me?.name ?? 'A')[0].toUpperCase()}</span>{me?.name ?? 'Admin'}</div>
        </header>
        <main className="flex-1 overflow-auto px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>)
}
