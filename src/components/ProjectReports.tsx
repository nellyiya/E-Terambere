import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import ReportDialog from './ReportDialog'
import { ReportActions, StatusPill } from './ReportReview'
import { errMsg } from '../lib/api'
import { dmy } from '../lib/period'
import { getProgress } from '../services/managementApi'
import { deleteReport, listReports, reportKeys, type ReportRow } from '../services/reportsApi'
type Dlg = { kind: 'add' } | { kind: 'edit' | 'delete'; r: ReportRow } | null
// A project's own daily reports. Pending ones wait here for Admin to approve them or send them back for correction.
export default function ProjectReports({ id }: { id: string }) {
  const qc = useQueryClient(), [status, setStatus] = useState(''), [page, setPage] = useState(1), [dlg, setDlg] = useState<Dlg>(null), size = 10
  const q = useQuery({ queryKey: ['reports', 'project', id, status, page], queryFn: () => listReports({ project: id, site: '', from: '', to: '', status, search: '' }, page, size), placeholderData: keepPreviousData })
  const counts = useQuery({ queryKey: ['progress', id], queryFn: () => getProgress(id) }).data?.reports
  const del = useMutation({ mutationFn: (c: string) => deleteReport(c), onSuccess: () => { reportKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] })); setDlg(null) } })
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / size)) : 1
  return (<div className="space-y-5"><div className="flex items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{['', 'Pending', 'Approved', 'Returned'].map(s => <button key={s} onClick={() => { setStatus(s); setPage(1) }}
      className={`rounded-full border px-4 py-1.5 text-sm ${status === s ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brand'}`}>{s || 'All'}{s && counts ? ` (${counts[s] ?? 0})` : ''}</button>)}</div>
      <button onClick={() => setDlg({ kind: 'add' })} className="flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white"><Plus size={16} />Add Report</button></div>
    <p className="text-xs text-slate-500">Only approved reports count towards the project's progress, labour, equipment and material totals. A returned report does not count until it is corrected, resubmitted and approved.</p>
    {q.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{errMsg(q.error)} <button onClick={() => q.refetch()} className="underline">Try again</button></div> : q.isLoading ? <p className="text-sm text-slate-500">Loading reports…</p>
      : !q.data?.rows.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">{status ? `No ${status.toLowerCase()} reports.` : 'No reports yet. They appear here when supervisors submit them.'}</div>
      : <div className="overflow-x-auto rounded-2xl"><table className="card-shadow w-full min-w-[56rem] overflow-hidden rounded-2xl border border-slate-200 bg-white text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Report', 'Date', 'Site', 'Supervisor', 'Work', 'Status', ''].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{q.data.rows.map(r => <tr key={r.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50"><td className="px-4 py-3 font-medium tnum">{r.id}</td><td className="px-4 py-3">{dmy(r.date)}</td><td className="px-4 py-3">{r.site}</td><td className="px-4 py-3">{r.supervisor ?? '–'}</td><td className="px-4 py-3">{r.activity}</td>
          <td className="px-4 py-3"><StatusPill s={r.status} />{r.status === 'Returned' && r.returnNote && <span className="mt-1 block max-w-48 text-xs text-amber-700">{r.returnNote}</span>}</td>
          <td className="px-4 py-3 text-right align-top"><ReportActions r={r} onEdit={() => setDlg({ kind: 'edit', r })} onDelete={() => { del.reset(); setDlg({ kind: 'delete', r }) }} /></td></tr>)}</tbody></table></div>}
    <div className="flex items-center justify-between text-sm text-slate-500"><span>{q.data?.total ?? 0} reports</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button>Page {page} of {pages}<button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Next</button></div></div>
    {dlg?.kind === 'add' && <ReportDialog defaultProject={id} onClose={() => setDlg(null)} />}{dlg?.kind === 'edit' && <ReportDialog code={dlg.r.id} onClose={() => setDlg(null)} />}
    {dlg?.kind === 'delete' && <ConfirmDialog danger title={`Delete report ${dlg.r.id}?`} confirmLabel="Yes, delete report" busy={del.isPending} error={del.error ? errMsg(del.error) : undefined} onConfirm={() => del.mutate(dlg.r.id)} onCancel={() => setDlg(null)}>{dlg.r.site}, {dlg.r.date}. This also removes the workers, equipment and materials recorded in it and changes the project's figures. It cannot be undone.</ConfirmDialog>}</div>)
}
