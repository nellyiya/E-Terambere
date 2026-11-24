import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { money, num } from './GroupTable'
import { errMsg } from '../lib/api'
import { PeriodFilter, usePeriod } from '../lib/period'
import { getManagement, getSection, periodReady } from '../services/managementApi'
const PATH: Record<string, [string, string]> = { equipment: ['equipment', 'equipment'], labour: ['labour', 'casual-labour'], materials: ['materials', 'material-costs'], other: ['other-costs', 'other-costs'], subcontractors: ['subcontractors', 'subcontractors'] }
type Lite = { name?: string; role?: string; unit?: string; calc?: string; category?: string; count?: number; amount?: number | null }
const line = (key: string, g: Lite) => (key === 'other' ? `${g.category}: ${g.count} record${g.count === 1 ? '' : 's'} = ${money(g.amount ?? 0)}` : `${g.name ?? g.role}${g.unit ? ` (${g.unit})` : ''}: ${g.calc}`)
function Detail({ id, k }: { id: string; k: string }) {
  const p = usePeriod(), { search } = useLocation(), [section, tab] = PATH[k]
  const q = useQuery({ queryKey: ['section', id, section, p], queryFn: () => getSection<{ groups: Lite[] }>(id, section, p) })
  const g = q.data?.groups ?? []
  return (<div className="space-y-1.5 text-xs text-slate-600">{q.isLoading ? <p>Loading…</p> : q.error ? <p className="text-red-600">{errMsg(q.error)}</p> : !g.length ? <p>Nothing recorded in this period.</p> : g.map((x, i) => <p key={i}>{line(k, x)}</p>)}
    <Link to={`/projects/${id}/${tab}${search}`} className="inline-block pt-1 text-brand hover:underline">Open full details →</Link></div>)
}
// The project's cost table: five categories, each opening to the records behind it, for whichever period is chosen.
export default function ManagementTable({ id }: { id: string }) {
  const p = usePeriod(), [open, setOpen] = useState<Record<string, boolean>>({})
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['management', id, p], queryFn: () => getManagement(id, p), enabled: periodReady(p), placeholderData: keepPreviousData })
  const th = 'px-4 py-3 font-medium'
  return (<section className="space-y-4"><div><h2 className="font-semibold">Project costs</h2><p className="mt-0.5 text-xs text-slate-500">Built from approved daily reports and the costs entered by Admin. Click a row to see how it was calculated.</p></div>
    <PeriodFilter resolved={data?.period} />
    {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{errMsg(error)} <button onClick={() => refetch()} className="underline">Try again</button></div> : isLoading || !data ? <p className="text-sm text-slate-500">Loading…</p> :
      <table className="card-shadow w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-10" /><th className={th}>Item No.</th><th className={th}>Description</th><th className={th}>Unit</th><th className={`${th} text-right`}>Quantity</th><th className={`${th} text-right`}>Rate</th><th className={`${th} text-right`}>Amount</th></tr></thead>
        <tbody>{data.rows.map(r => { const o = !!open[r.key]; return (<>
          <tr key={r.key} onClick={() => setOpen({ ...open, [r.key]: !o })} className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50"><td className="pl-3"><button aria-expanded={o} aria-label={o ? 'Hide records' : 'Show records'} className="text-slate-400">{o ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button></td>
            <td className="px-4 py-3 tnum">{r.item_no}</td><td className="px-4 py-3 font-medium">{r.description}{r.note && <span className="mt-0.5 block text-xs font-normal text-amber-700">{r.note}</span>}</td><td className="px-4 py-3 text-slate-500">{r.unit}</td>
            <td className="px-4 py-3 text-right tnum">{num(r.quantity)}</td><td className="px-4 py-3 text-right tnum">{r.rate_varies ? 'Varies' : r.rate !== null ? num(r.rate) : '–'}</td><td className="px-4 py-3 text-right font-medium tnum">{money(r.amount)}</td></tr>
          {o && <tr key={r.key + 'd'} className="bg-slate-50"><td /><td colSpan={6} className="px-4 py-4"><Detail id={id} k={r.key} /></td></tr>}</>) })}</tbody>
        <tfoot><tr className="border-t border-slate-200 bg-slate-50 font-semibold"><td colSpan={6} className="px-4 py-3 text-right">Total{data.incomplete ? ' (excludes items without a rate)' : ''}</td><td className="px-4 py-3 text-right tnum">{num(data.total)} RWF</td></tr></tfoot></table>}</section>)
}
