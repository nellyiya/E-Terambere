import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { rwf } from '../services/costs'
import type { getWorkspaceData } from '../services/workspace'
type D = Awaited<ReturnType<typeof getWorkspaceData>>
const tone: Record<string, string> = { Approved: 'bg-brand/10 text-brand', Pending: 'bg-amber-100 text-amber-700', Flagged: 'bg-red-100 text-red-700' }
const Card = ({ l, v }: { l: string; v: ReactNode }) => <div className="border-l-2 border-brand/40 py-1 pl-4"><p className="text-sm text-slate-500">{l}</p><p className="mt-1 text-2xl font-semibold">{v}</p></div>
const Table = ({ head, rows }: { head: string[]; rows: ReactNode[][] }) => rows.length ? (
  <table className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{head.map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-slate-100">{r.map((c, j) => <td key={j} className="px-4 py-3">{c}</td>)}</tr>)}</tbody></table>
) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">No records for this project yet.</div>
export function Overview({ d }: { d: D }) {
  const total = d.costs.filter(c => c.slug !== 'work-done').reduce((a, c) => a + c.total, 0)
  return <div className="grid grid-cols-3 gap-4"><Card l="Reports" v={d.reports.length} /><Card l="Sites with reports" v={d.sites.length} /><Card l="Total recorded cost" v={rwf(total)} /></div>
}
export const Sites = ({ d }: { d: D }) => <Table head={['Site', 'Reports', 'Last report']} rows={d.sites.map(s => [s.site, s.reports, s.last])} />
export function Costs({ d, pid }: { d: D; pid: string }) {
  return <Table head={['Category', 'Records', 'Total recorded', '']} rows={d.costs.map(c => [c.label, c.count, rwf(c.total), c.slug === 'work-done' ? <Link to={`/project-management/work-done?project=${pid}`} className="text-brand">View details</Link> : ''])} />
}
export function Reports({ d }: { d: D }) {
  const [page, setPage] = useState(1), size = 8, pages = Math.max(1, Math.ceil(d.reports.length / size))
  const rows = d.reports.slice((page - 1) * size, page * size)
  return <div className="space-y-3"><Table head={['Report', 'Date', 'Site', 'Supervisor', 'Activity', 'Status']} rows={rows.map(r => [r.id, r.date, r.site, r.supervisor, r.activity, <span className={`rounded px-2 py-0.5 text-xs ${tone[r.status]}`}>{r.status}</span>])} />
    <div className="flex items-center justify-end gap-2 text-sm text-slate-500"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button>Page {page} of {pages}<button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Next</button></div></div>
}
export const Photos = () => <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">No photos yet. Photos attached to supervisors' daily reports will appear here once the backend is connected.</div>
