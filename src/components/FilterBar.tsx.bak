import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { projectOptions } from '../services/projects'
import { getFilterData } from '../services/reportsApi'
import { siteOptions, type Filters } from '../services/reports'
// Filters live in the URL so views can be bookmarked and shared.
export function useFilters() {
  const [sp, setSp] = useSearchParams()
  const f: Filters = { project: sp.get('project') ?? '', site: sp.get('site') ?? '', from: sp.get('from') ?? '', to: sp.get('to') ?? '' }
  const page = Number(sp.get('page') ?? 1)
  const set = (patch: Record<string, string>) => {
    const n = new URLSearchParams(sp)
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)))
    if (!('page' in patch)) n.delete('page')
    setSp(n)
  }
  return { f, page, set, clear: () => setSp(new URLSearchParams()) }
}
const cls = 'rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition hover:border-brand focus:border-brand focus:ring-2 focus:ring-brand/20'
export default function FilterBar({ real = false }: { real?: boolean }) {
  const { f, set, clear } = useFilters()
  const { data: projects = [] } = useQuery({ queryKey: ['project-options', real], queryFn: real ? async () => (await getFilterData()).projects.map(p => ({ id: p.id, name: p.name, sites: p.sites.length })) : projectOptions })
  const sel = projects.find(p => p.id === f.project)
  const active = f.project || f.site || f.from || f.to
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-xs text-slate-500">Project<select value={f.project} onChange={e => set({ project: e.target.value, site: '' })} className={`${cls} mt-1 block w-60`}>
        <option value="">All Projects</option>{projects.map(p => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}</select></label>
      <label className="text-xs text-slate-500">Site<select value={f.site} disabled={!sel} onChange={e => set({ site: e.target.value })} className={`${cls} mt-1 block w-36 disabled:bg-slate-50`}>
        <option value="">All Sites</option>{siteOptions(f.project, sel?.sites ?? 0).map(s => <option key={s}>{s}</option>)}</select></label>
      <label className="text-xs text-slate-500">From<input type="date" value={f.from} max={f.to || undefined} onChange={e => set({ from: e.target.value })} className={`${cls} mt-1 block`} /></label>
      <label className="text-xs text-slate-500">To<input type="date" value={f.to} min={f.from || undefined} onChange={e => set({ to: e.target.value })} className={`${cls} mt-1 block`} /></label>
      {active && <button onClick={clear} className="pb-2 text-sm text-brand underline">Clear filters</button>}
    </div>)
}
