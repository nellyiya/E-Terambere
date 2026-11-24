import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, FolderKanban, LayoutGrid, List, MapPin, User } from 'lucide-react'
import { useState } from 'react'
import AddProjectDialog from '../components/AddProjectDialog'
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
    : { bar: 'bg-green-500', tag: 'bg-brand/10 text-brand' }
}
const PBar = ({ label, v }: { label: string; v: number }) => <div>
  <div className="mb-1.5 flex items-center justify-between text-sm text-slate-500"><span>{label}</span><span className={`tnum ${v > 100 ? 'font-medium text-red-700' : 'text-slate-700'}`}>{v}%{v > 100 && ' · over budget'}</span></div>
  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}><div className={`h-full rounded-full transition-all duration-700 ${v > 100 ? 'bg-red-600' : 'bg-brand'}`} style={{ width: `${Math.min(100, v)}%` }} /></div></div>
export default function Projects() {
  const [sp, setSp] = useSearchParams()
  const [adding, setAdding] = useState(false)
  const q = { search: sp.get('q') ?? '', status: sp.get('status') ?? '', page: Number(sp.get('page') ?? 1), pageSize: 9 }
  const view = sp.get('view') ?? 'grid'
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k !== 'page') n.delete('page'); setSp(n) }
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['projects', q], queryFn: () => listProjects(q), placeholderData: keepPreviousData })
  const pages = data ? Math.max(1, Math.ceil(data.total / q.pageSize)) : 1
  return (<div className="space-y-6">
    <div className="flex justify-end">
      <button onClick={() => setAdding(true)} className="flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white"><Plus size={16} />Add Project</button>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-2">{['', ...Object.keys(badge)].map(st => <button key={st} onClick={() => set('status', st)} className={`rounded-full border px-4 py-1.5 text-sm ${q.status === st ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brand'}`}>{st || 'All'}</button>)}</div>
      <input defaultValue={q.search} onChange={e => set('q', e.target.value)} placeholder="Search by name, ID, client or location…" className="min-w-60 flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm" />
      <div className="flex rounded-lg bg-slate-100 p-1"><button onClick={() => set('view', 'grid')} aria-label="Grid view" className={`rounded px-3 py-1 ${view === 'grid' ? 'bg-white shadow-sm' : ''}`}><LayoutGrid size={16} /></button><button onClick={() => set('view', 'list')} aria-label="List view" className={`rounded px-3 py-1 ${view === 'list' ? 'bg-white shadow-sm' : ''}`}><List size={16} /></button></div>
    </div>
    {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Could not load projects. {errMsg(error)} <button onClick={() => refetch()} className="underline">Try again</button></div>
      : isLoading ? <p className="text-sm text-slate-500">Loading projects…</p>
      : !data?.rows.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">{!q.search && !q.status ? 'No projects yet. Click Add Project to create your first one.' : 'No projects match these filters. Clear the search or choose another status.'}</div>
      : view === 'grid' ? <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{data.rows.map(p => (
        <Link key={p.id} to={`/projects/${p.id}/overview`} className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 pt-7 transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <span className={`absolute inset-x-0 top-0 h-1 ${tone(p.status).bar}`} />
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand/10 text-brand"><FolderKanban size={22} /></span>
              <div className="min-w-0"><h3 className="line-clamp-2 text-[17px] font-semibold capitalize leading-snug tracking-tight text-slate-900" title={p.name}>{p.name.toLowerCase()}</h3><p className="mt-0.5 text-sm text-slate-500">{p.id}</p></div></div>
            <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap pt-1 text-sm text-slate-500"><i className={`h-2 w-2 rounded-full ${tone(p.status).bar}`} />{p.status}</span></div>
          <div className="mt-5 space-y-1 text-[15px] text-slate-500">
            <p className="flex items-center gap-2"><MapPin size={15} className="shrink-0" /><span className="truncate capitalize">{p.location.toLowerCase()}</span></p>
            <p className="flex items-center gap-2"><User size={15} className="shrink-0" /><span className="truncate capitalize">{p.supervisor ? p.supervisor.toLowerCase() : 'No supervisor yet'}</span></p></div>
          <div className="mb-5 mt-5 space-y-3"><PBar label="Physical progress" v={p.progress} /><PBar label="Financial progress" v={p.financialProgress} /></div>
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm"><span className="text-slate-500">{p.sites} {p.sites === 1 ? 'site' : 'sites'} · {p.reports} {p.reports === 1 ? 'report' : 'reports'}</span><span className="font-medium text-brand group-hover:underline">View project</span></div></Link>))}</div>
      : <table className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['ID', 'Project', 'Location', 'Status', 'Physical', 'Financial', 'Sites', 'Reports'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{data.rows.map(p => <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-4 py-3">{p.id}</td><td className="px-4 py-3 font-medium"><Link to={`/projects/${p.id}/overview`} className="text-brand">{p.name}</Link></td><td className="px-4 py-3">{p.location}</td><td className="px-4 py-3"><span className={`rounded px-2 py-0.5 text-xs ${badge[p.status]}`}>{p.status}</span></td><td className="px-4 py-3">{p.progress}%</td><td className={`px-4 py-3 ${p.financialProgress > 100 ? 'font-medium text-red-700' : ''}`}>{p.financialProgress}%</td><td className="px-4 py-3">{p.sites}</td><td className="px-4 py-3">{p.reports}</td></tr>)}</tbody></table>}
    <div className="flex items-center justify-between text-sm text-slate-500"><span>{data?.total ?? 0} {data?.total === 1 ? 'project' : 'projects'}</span>
      <div className="flex items-center gap-2"><button disabled={q.page <= 1} onClick={() => set('page', String(q.page - 1))} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button>Page {q.page} of {pages}<button disabled={q.page >= pages} onClick={() => set('page', String(q.page + 1))} className="rounded border px-3 py-1 disabled:opacity-40">Next</button></div></div>
    {adding && <AddProjectDialog onClose={() => setAdding(false)} />}
  </div>)
}