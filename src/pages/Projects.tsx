import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, FolderKanban, LayoutGrid, List, Activity, CheckCircle2, Clock } from 'lucide-react'
import { useState } from 'react'
import AddProjectDialog from '../components/AddProjectDialog'
import StatStrip from '../components/StatStrip'
import { errMsg } from '../lib/api'
import { listProjects } from '../services/projectsApi'

export const badge: Record<string, string> = { Active: 'bg-brand/10 text-brand', Planning: 'bg-amber-100 text-amber-700', 'On Hold': 'bg-red-100 text-red-700', Completed: 'bg-slate-100 text-slate-600' }
export const dot: Record<string, string> = { Active: 'bg-brand', Planning: 'bg-amber-500', 'On Hold': 'bg-red-500', Completed: 'bg-slate-400' }

export const Ring = ({ v, size = 60, label }: { v: number; size?: number; label?: string }) => {
  const c = Math.min(100, v), r = size * 0.4, k = 2 * Math.PI * r, h = size / 2
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label={`${label ?? 'Progress'} ${v}%`}>
    <circle cx={h} cy={h} r={r} fill="none" stroke="var(--color-slate-100)" strokeWidth="6" /><circle cx={h} cy={h} r={r} fill="none" stroke={v > 100 ? '#dc2626' : 'var(--color-brand)'} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(c / 100) * k} ${k}`} transform={`rotate(-90 ${h} ${h})`} />
    <text x={h} y={h + 4} textAnchor="middle" fontSize={size * 0.21} fontWeight="600" fill="currentColor">{v}%</text></svg>
}

// Colours by status, matched loosely so "On Hold", "on_hold" or "ON HOLD" all come out red
const tone = (st: string) => {
  const k = (st ?? '').toLowerCase().replace(/[\s_-]/g, '')
  return k === 'onhold' ? { bar: 'bg-red-500', tag: 'bg-red-100 text-red-700' }
    : k === 'planning' ? { bar: 'bg-amber-500', tag: 'bg-amber-100 text-amber-700' }
    : k === 'completed' ? { bar: 'bg-slate-400', tag: 'bg-slate-100 text-slate-600' }
    : { bar: 'bg-brand', tag: 'bg-brand/10 text-brand' }
}

const PBar = ({ label, v }: { label: string; v: number }) => (
  <div>
    <div className="mb-1.5 flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className={`tnum font-semibold ${v > 100 ? 'text-red-700' : ''}`}>{v}%</span>
    </div>
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all duration-700 ${v > 100 ? 'bg-red-600' : 'bg-brand'}`} style={{ width: `${Math.min(100, v)}%` }} />
    </div>
  </div>
)

export default function Projects() {
  const [sp, setSp] = useSearchParams()
  const [adding, setAdding] = useState(false)
  const q = { search: sp.get('q') ?? '', status: sp.get('status') ?? '', page: Number(sp.get('page') ?? 1), pageSize: 9 }
  const view = sp.get('view') ?? 'grid'
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k !== 'page') n.delete('page'); setSp(n) }
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['projects', q], queryFn: () => listProjects(q), placeholderData: keepPreviousData })
  const pages = data ? Math.max(1, Math.ceil(data.total / q.pageSize)) : 1

  // Summary numbers for the top cards. Built from the existing list call (all projects, in pages of 50),
 
  
  // Summary numbers for the top cards.
  const stats = useQuery({
    queryKey: ['projects', 'stats'],
    staleTime: 60_000,
    queryFn: async () => {
      const size = 50
      const first = await listProjects({ search: '', status: '', page: 1, pageSize: size })
      let rows = first.rows

      for (let pg = 2; rows.length < first.total && pg <= 40; pg++) {
        const next = await listProjects({ search: '', status: '', page: pg, pageSize: size })
        if (!next.rows.length) break
        rows = rows.concat(next.rows)
      }

      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      return {
        total: first.total,
        active: rows.filter(p => p.status === 'Active').length,
        completed: rows.filter(p => p.status === 'Completed').length,
        delayed: rows.filter(
          p => p.status !== 'Completed' && !!p.endDate && p.endDate < today
        ).length,
      }
    },
  })

  const s = stats.data

  const cards = [
    { label: 'Total Projects', value: s?.total ?? '–', icon: FolderKanban },
    { label: 'Active Projects', value: s?.active ?? '–', icon: Activity },
    { label: 'Completed Projects', value: s?.completed ?? '–', icon: CheckCircle2 },
    { label: 'Delayed Projects', value: s?.delayed ?? '–', icon: Clock },
  ]


  return (<div className="space-y-6">
    <p className="mb-4 text-sm text-slate-500">Projects</p>

    {/* Page header */}
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand text-white"><FolderKanban size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-slate-500">All construction projects in one place</p>
        </div>
      </div>
      <button onClick={() => setAdding(true)} className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"><Plus size={16} />Add Project</button>
    </div>

    {/* Summary cards */}
    <StatStrip items={cards} />

    {/* Filters */}
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <select value={q.status} onChange={e => set('status', e.target.value)} aria-label="Filter by status" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
        <option value="">All Statuses</option>
        {Object.keys(badge).map(st => <option key={st} value={st}>{st}</option>)}
      </select>
      <input value={q.search} onChange={e => set('q', e.target.value)} placeholder="Search by name, ID or district…" className="min-w-60 flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
      <div className="flex rounded-lg bg-slate-100 p-1">
        <button onClick={() => set('view', 'grid')} aria-label="Grid view" className={`rounded-md px-3 py-1.5 ${view === 'grid' ? 'bg-white shadow-sm' : 'text-slate-500'}`}><LayoutGrid size={16} /></button>
        <button onClick={() => set('view', 'list')} aria-label="List view" className={`rounded-md px-3 py-1.5 ${view === 'list' ? 'bg-white shadow-sm' : 'text-slate-500'}`}><List size={16} /></button>
      </div>
    </div>

    {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Could not load projects. {errMsg(error)} <button onClick={() => refetch()} className="underline">Try again</button></div>
      : isLoading ? <p className="text-sm text-slate-500">Loading projects…</p>
      : !data?.rows.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">{!q.search && !q.status ? 'No projects yet. Click Add Project to create your first one.' : 'No projects match these filters. Clear the search or choose another status.'}</div>
      : view === 'grid' ? <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{data.rows.map(p => (
        <Link key={p.id} to={`/projects/${p.id}/overview`} className="group card-shadow flex flex-col rounded-3xl border border-slate-200 bg-white p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg">
          <div className="flex items-start gap-3">
            <span style={{ background: 'linear-gradient(145deg, #2fae9d 0%, #1c8578 52%, #0f4a43 100%)' }} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white shadow-md shadow-brand/30 ring-2 ring-white transition duration-300 group-hover:scale-105"><FolderKanban size={19} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 truncate text-base font-semibold capitalize leading-7" title={p.name}>{p.name.toLowerCase()}</h3>
                <span className={`shrink-0 whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-medium ${tone(p.status).tag}`}>{p.status}</span>
              </div>
              <p className="mt-0.5 text-sm text-slate-500"><span className="capitalize">{p.location.toLowerCase()}</span> · {p.id}</p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <PBar label="Progress" v={p.progress} />
            {p.financialProgress > 100 && <p className="text-xs font-medium text-red-700">Over budget · {p.financialProgress}% of contract spent</p>}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span className="flex min-w-0 items-center gap-2">
              {p.supervisor && <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/10 text-[10px] font-semibold text-brand">{p.supervisor.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>}
              <span className="truncate capitalize">{p.supervisor ? p.supervisor.toLowerCase() : 'No supervisor yet'}</span>
            </span>
            <span className="shrink-0">{p.sites} {p.sites === 1 ? 'site' : 'sites'} · {p.reports} {p.reports === 1 ? 'report' : 'reports'}</span>
          </div>
        </Link>))}</div>
      : <div className="card-shadow overflow-x-auto rounded-3xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['ID', 'Project', 'Location', 'Status', 'Physical', 'Financial', 'Sites', 'Reports'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{data.rows.map(p => <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-4 py-3">{p.id}</td><td className="px-4 py-3 font-medium"><Link to={`/projects/${p.id}/overview`} className="text-brand">{p.name}</Link></td><td className="px-4 py-3">{p.location}</td><td className="px-4 py-3"><span className={`rounded px-2 py-0.5 text-xs ${badge[p.status]}`}>{p.status}</span></td><td className="px-4 py-3">{p.progress}%</td><td className={`px-4 py-3 ${p.financialProgress > 100 ? 'font-medium text-red-700' : ''}`}>{p.financialProgress}%</td><td className="px-4 py-3">{p.sites}</td><td className="px-4 py-3">{p.reports}</td></tr>)}</tbody></table></div>}

    <div className="flex items-center justify-between text-sm text-slate-500"><span>{data?.total ?? 0} {data?.total === 1 ? 'project' : 'projects'}</span>
      <div className="flex items-center gap-2"><button disabled={q.page <= 1} onClick={() => set('page', String(q.page - 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 disabled:opacity-40">Previous</button>Page {q.page} of {pages}<button disabled={q.page >= pages} onClick={() => set('page', String(q.page + 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 disabled:opacity-40">Next</button></div></div>
    {adding && <AddProjectDialog onClose={() => setAdding(false)} />}
  </div>)
}

