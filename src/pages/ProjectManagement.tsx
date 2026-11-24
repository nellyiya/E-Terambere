import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { errMsg } from '../lib/api'
import { listProjects } from '../services/projectsApi'
import { badge, dot } from './Projects'

export default function ProjectManagement() {
  const [sp, setSp] = useSearchParams()
  const q = { search: sp.get('q') ?? '', status: sp.get('status') ?? '', page: Number(sp.get('page') ?? 1), pageSize: 12 }
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k !== 'page') n.delete('page'); setSp(n) }
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['projects', q], queryFn: () => listProjects(q), placeholderData: keepPreviousData })
  const pages = data ? Math.max(1, Math.ceil(data.total / q.pageSize)) : 1
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {['', ...Object.keys(badge)].map(st => (
            <button key={st} onClick={() => set('status', st)} className={`rounded-full border px-4 py-1.5 text-sm ${q.status === st ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brand'}`}>{st || 'All'}</button>
          ))}
        </div>
        <input defaultValue={q.search} onChange={e => set('q', e.target.value)} placeholder="Search projects…" className="min-w-60 flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm" />
      </div>
      {error
        ? <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Could not load projects. {errMsg(error)} <button onClick={() => refetch()} className="underline">Try again</button></div>
        : isLoading ? <p className="text-sm text-slate-500">Loading projects…</p>
        : !data?.rows.length
          ? <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">No projects found.</div>
          : <div className="grid grid-cols-3 gap-5">
            {data.rows.map(p => (
              <Link key={p.id} to={`/project-management/${p.id}/overview`} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500"><i className={`h-2 w-2 rounded-full ${dot[p.status]}`} />{p.status}</span>
                    <h3 className="mt-2 font-semibold leading-snug">{p.name}</h3>
                    <p className="mt-0.5 text-sm text-slate-500">{p.location} · {p.id}</p>
                  </div>

                </div>
                <div className="mt-4 flex justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>{p.supervisor || 'No supervisor'}</span>
                  <span>{p.sites} sites · {p.reports} reports</span>
                </div>
              </Link>
            ))}
          </div>
      }
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{data?.total ?? 0} projects</span>
        <div className="flex items-center gap-2">
          <button disabled={q.page <= 1} onClick={() => set('page', String(q.page - 1))} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button>
          Page {q.page} of {pages}
          <button disabled={q.page >= pages} onClick={() => set('page', String(q.page + 1))} className="rounded border px-3 py-1 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  )
}
