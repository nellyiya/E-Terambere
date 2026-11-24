import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { LayoutGrid, List, Plus } from 'lucide-react'
import { SupervisorDelete, SupervisorDialog } from '../components/SupervisorDialogs'
import { errMsg } from '../lib/api'
import { listSupervisors, setSupervisorActive, type Supervisor } from '../services/supervisorsApi'
const size = 12
type Dlg = { kind: 'add' } | { kind: 'edit' | 'delete'; s: Supervisor } | null
export default function Supervisors() {
  const [sp, setSp] = useSearchParams(), qc = useQueryClient(), [dlg, setDlg] = useState<Dlg>(null)
  const q = { search: sp.get('q') ?? '', page: Number(sp.get('page') ?? 1), size }
  const view = sp.get('view') ?? 'grid'
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k !== 'page') n.delete('page'); setSp(n) }
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['supervisors', q], queryFn: () => listSupervisors(q), placeholderData: keepPreviousData })
  const toggle = useMutation({ mutationFn: (a: { id: number; active: boolean }) => setSupervisorActive(a.id, a.active), onSuccess: () => ['supervisors', 'supervisor', 'supervisor-options'].forEach(k => qc.invalidateQueries({ queryKey: [k] })) })
  const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1
  const Actions = ({ s }: { s: Supervisor }) => (<span className="space-x-3 text-xs">
    <button onClick={() => setDlg({ kind: 'edit', s })} className="text-brand">Edit</button>
    <button disabled={toggle.isPending} onClick={() => toggle.mutate({ id: s.id, active: !s.active })} className="text-brand disabled:opacity-50">{s.active ? 'Deactivate' : 'Activate'}</button>
    <button onClick={() => setDlg({ kind: 'delete', s })} className="text-red-700">Delete</button></span>)
  return (<div className="space-y-6">
    <div className="flex justify-end"><button onClick={() => setDlg({ kind: 'add' })} className="flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white"><Plus size={16} />Add Supervisor</button></div>
    <div className="flex items-center gap-3"><input defaultValue={q.search} onChange={e => set('q', e.target.value)} placeholder="Search by name, email or phone…" className="min-w-60 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm" />
      <div className="flex rounded-lg bg-slate-100 p-1"><button onClick={() => set('view', 'grid')} aria-label="Grid view" className={`rounded px-3 py-1 ${view === 'grid' ? 'bg-white shadow-sm' : ''}`}><LayoutGrid size={16} /></button><button onClick={() => set('view', 'list')} aria-label="List view" className={`rounded px-3 py-1 ${view === 'list' ? 'bg-white shadow-sm' : ''}`}><List size={16} /></button></div></div>
    {toggle.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errMsg(toggle.error)}</p>}
    {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Could not load supervisors. {errMsg(error)} <button onClick={() => refetch()} className="underline">Try again</button></div>
      : isLoading ? <p className="text-sm text-slate-500">Loading supervisors…</p>
      : !data?.rows.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">{q.search ? 'No supervisors match this search.' : 'No supervisors yet. Click Add Supervisor to create the first account.'}</div>
      : view === 'grid' ? <div className="grid grid-cols-3 gap-5">{data.rows.map(s => (
        <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand/10 text-sm font-semibold text-brand">{s.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
            <div className="min-w-0"><Link to={`/supervisors/${s.id}`} className="block truncate font-semibold hover:text-brand">{s.name}</Link><p className="truncate text-xs text-slate-500">{s.code}</p></div></div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500"><i className={`h-2 w-2 rounded-full ${s.active ? 'bg-brand' : 'bg-slate-400'}`} />{s.active ? 'Active' : 'Inactive'}</span></div>
          <div className="mt-4 space-y-0.5 text-sm text-slate-500"><p className="truncate">{s.email}</p><p>{s.phone}</p></div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500"><span>{s.projects} projects · {s.reports} reports</span><Actions s={s} /></div></div>))}</div>
      : <table className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Supervisor', 'Contact', 'Projects', 'Reports', 'Last report', 'Status', ''].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{data.rows.map(s => <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-4 py-3"><Link to={`/supervisors/${s.id}`} className="font-medium text-brand">{s.name}</Link><p className="text-xs text-slate-500">{s.code}</p></td><td className="px-4 py-3"><p>{s.email}</p><p className="text-xs text-slate-500">{s.phone}</p></td><td className="px-4 py-3">{s.projects}</td><td className="px-4 py-3">{s.reports}</td><td className="px-4 py-3">{s.lastReport ?? 'None yet'}</td>
          <td className="px-4 py-3"><span className={`rounded px-2 py-0.5 text-xs ${s.active ? 'bg-brand/10 text-brand' : 'bg-slate-100 text-slate-600'}`}>{s.active ? 'Active' : 'Inactive'}</span></td><td className="px-4 py-3 text-right"><Actions s={s} /></td></tr>)}</tbody></table>}
    <div className="flex items-center justify-between text-sm text-slate-500"><span>{data?.total ?? 0} supervisors</span>
      <div className="flex items-center gap-2"><button disabled={q.page <= 1} onClick={() => set('page', String(q.page - 1))} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button>Page {q.page} of {pages}<button disabled={q.page >= pages} onClick={() => set('page', String(q.page + 1))} className="rounded border px-3 py-1 disabled:opacity-40">Next</button></div></div>
    {dlg?.kind === 'add' && <SupervisorDialog onClose={() => setDlg(null)} />}
    {dlg?.kind === 'edit' && <SupervisorDialog supervisor={dlg.s} onClose={() => setDlg(null)} />}
    {dlg?.kind === 'delete' && <SupervisorDelete supervisor={dlg.s} onClose={() => setDlg(null)} />}
  </div>)
}
