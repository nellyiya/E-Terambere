import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SupervisorDelete, SupervisorDialog } from '../components/SupervisorDialogs'
import { errMsg } from '../lib/api'
import { getSupervisor, setSupervisorActive } from '../services/supervisorsApi'
import { badge } from './Projects'
import type { Status } from '../services/projectsApi'
const tone: Record<string, string> = { Approved: 'bg-brand/10 text-brand', Pending: 'bg-amber-100 text-amber-700', Returned: 'bg-red-100 text-red-700' }
const th = (h: string) => <th key={h} className="px-4 py-3 font-medium">{h}</th>
export default function SupervisorDetail() {
  const { id = '' } = useParams(), qc = useQueryClient(), nav = useNavigate()
  const [page, setPage] = useState(1), [dlg, setDlg] = useState<'edit' | 'delete' | null>(null), size = 8
  const { data: s, isLoading, error, refetch } = useQuery({ queryKey: ['supervisor', id], queryFn: () => getSupervisor(id) })
  const toggle = useMutation({ mutationFn: (a: boolean) => setSupervisorActive(Number(id), a), onSuccess: () => ['supervisor', 'supervisors', 'supervisor-options'].forEach(k => qc.invalidateQueries({ queryKey: [k] })) })
  if (isLoading) return <p className="text-sm text-slate-500">Loading supervisor…</p>
  if (error || !s) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{errMsg(error)} <button onClick={() => refetch()} className="underline">Try again</button> · <Link to="/supervisors" className="underline">Back to supervisors</Link></div>
  const pages = Math.max(1, Math.ceil(s.reportList.length / size)), rows = s.reportList.slice((page - 1) * size, page * size)
  const stats: [string, string | number][] = [['Projects', s.projects], ['Reports submitted', s.reports], ['Last report', s.lastReport ?? 'None yet']]
  return (<div className="space-y-6">
    <div className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex items-start justify-between">
      <div><div className="flex items-center gap-3"><h1 className="text-2xl font-semibold">{s.name}</h1><span className={`rounded px-2 py-0.5 text-xs ${s.active ? 'bg-brand/10 text-brand' : 'bg-slate-100 text-slate-600'}`}>{s.active ? 'Active' : 'Inactive'}</span></div>
        <p className="mt-1 text-sm text-slate-500">{s.code} · {s.email} · {s.phone}</p>
        <div className="mt-3 flex gap-2"><button onClick={() => setDlg('edit')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">Edit</button>
          <button disabled={toggle.isPending} onClick={() => toggle.mutate(!s.active)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50">{toggle.isPending ? 'Saving…' : s.active ? 'Deactivate account' : 'Activate account'}</button>
          <button onClick={() => setDlg('delete')} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">Delete</button></div>
        {toggle.error && <p className="mt-2 text-sm text-red-700">{errMsg(toggle.error)}</p>}</div>
      <div className="flex gap-8 text-right">{stats.map(([l, v]) => <div key={l}><p className="text-xs text-slate-500">{l}</p><p className="text-xl font-semibold">{v}</p></div>)}</div></div></div>
    <section><h2 className="mb-2 font-semibold">Assigned projects</h2>{s.projectList.length ? <table className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Project', 'District', 'Status', 'Physical', 'Financial', 'Supervisors'].map(th)}</tr></thead>
      <tbody>{s.projectList.map(p => <tr key={p.id} className="border-t border-slate-100"><td className="px-4 py-3"><Link to={`/projects/${p.id}/overview`} className="font-medium text-brand">{p.name}</Link></td><td className="px-4 py-3">{p.district}</td><td className="px-4 py-3"><span className={`rounded px-2 py-0.5 text-xs ${badge[p.status as Status]}`}>{p.status}</span></td><td className="px-4 py-3">{p.progress}%</td><td className="px-4 py-3">{p.financial_progress}%</td><td className="px-4 py-3">{p.supervisors?.map((sv: {name: string}) => sv.name).join(', ') || '–'}</td></tr>)}</tbody></table>
      : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No projects assigned yet. Assign this supervisor when you create or edit a project.</div>}</section>
    <section><h2 className="mb-2 font-semibold">Reports submitted</h2>{rows.length ? <><table className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Report', 'Date', 'Project', 'Site', 'Activity', 'Status'].map(th)}</tr></thead>
      <tbody>{rows.map(r => <tr key={r.id} className="border-t border-slate-100"><td className="px-4 py-3">{r.id}</td><td className="px-4 py-3">{r.date}</td><td className="px-4 py-3">{r.project_name}</td><td className="px-4 py-3">{r.site}</td><td className="px-4 py-3">{r.activity}</td><td className="px-4 py-3"><span className={`rounded px-2 py-0.5 text-xs ${tone[r.status] ?? ''}`}>{r.status}</span></td></tr>)}</tbody></table>
      <div className="mt-3 flex items-center justify-end gap-2 text-sm text-slate-500"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button>Page {page} of {pages}<button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Next</button></div></>
      : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">This supervisor hasn't submitted any reports yet.</div>}</section>
    {dlg === 'edit' && <SupervisorDialog supervisor={s} onClose={() => setDlg(null)} />}
    {dlg === 'delete' && <SupervisorDelete supervisor={s} onClose={() => setDlg(null)} onDone={() => nav('/supervisors')} />}
  </div>)
}
