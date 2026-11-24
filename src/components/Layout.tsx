import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FolderKanban, Users, FileText, HardHat, Wallet, Settings, Search, Bell, ChevronsLeft, LogOut } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clearToken } from '../lib/auth'
import { useSession } from '../lib/useSession'
import { getSettings } from '../services/settings'
import GlobalSearch from './GlobalSearch'
import Notifications from './Notifications'
import ThemeToggle from './ThemeToggle'
export const nav = [
  ['Dashboard','/dashboard',LayoutDashboard],['Projects','/projects',FolderKanban],['Supervisors','/supervisors',Users],['Reports','/reports',FileText],
  ['Project Management','/project-management',Wallet],['Settings','/settings',Settings]] as const
export default function Layout() {
  const [open, setOpen] = useState(true), qc = useQueryClient(), go = useNavigate()
  const endSession = useCallback((expired = false) => { clearToken(); qc.clear(); go(expired ? '/login?expired=1' : '/login', { replace: true }) }, [qc, go])
  useSession(useCallback(() => endSession(true), [endSession]))
  const { data: me } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  return (
    <div className="flex h-screen">
      <aside className={`${open ? 'w-60' : 'w-16'} shrink-0 bg-side text-white transition-all`}>
        <div className="flex h-16 items-center justify-between px-4">
          <span className="flex items-center gap-2 font-semibold tracking-wide text-white"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/20"><HardHat size={18} /></span>{open && (me?.org || 'E-terambere')}</span>
          <button onClick={() => setOpen(!open)} aria-label="Collapse sidebar" className="rounded p-1 text-white/70 hover:bg-white/10"><ChevronsLeft size={18} /></button>
        </div>
        <nav className="space-y-1 px-2">
          {nav.map(([l, to, I]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ${isActive ? 'bg-white/15 text-white shadow-[inset_3px_0_0_#fff]' : 'text-white/85 hover:bg-white/10 hover:text-white'}`}>
              <I size={18} />{open && l}</NavLink>))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-4 border-b border-slate-200 bg-white px-6">
          <GlobalSearch />
          <ThemeToggle />
          <Notifications />
          <div className="flex items-center gap-2 text-sm"><span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-white">{(me?.name ?? 'A')[0].toUpperCase()}</span>{me?.name ?? 'Admin'}</div>
          <button onClick={() => endSession()} aria-label="Sign out" title="Sign out" className="rounded p-2 hover:bg-slate-100"><LogOut size={18} /></button>
        </header>
        <main className="flex-1 overflow-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>)
}
