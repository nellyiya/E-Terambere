import { Fragment } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { CountUp, EmptyState, TableSkeleton } from '../components/ui'
import CostTabs from '../components/CostTabs'
import ExportMenu from '../components/ExportMenu'
import FilterBar, { useFilters } from '../components/FilterBar'
import { errMsg } from '../lib/api'
import { rwf } from '../services/costs'
import { fetchAllWorkDone, getWorkDone } from '../services/boqApi'
const size = 15, fmt = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)
export default function WorkDone() {
  const { f, page, set } = useFilters()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['work-done', f, page], queryFn: () => getWorkDone(f, page, size), placeholderData: keepPreviousData })
  const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1
  const head = ['Item No', 'Item Description', 'Unit', 'Quantity', 'Rate (RWF)', 'Amount (RWF)']
  const num = (h: string) => ['Quantity', 'Rate (RWF)', 'Amount (RWF)'].includes(h) ? 'text-right' : ''
  return (<div className="space-y-6">
    <div className="flex items-center justify-end gap-3">
      <ExportMenu title="Work Done" file="work-done" f={f} columns={[...head, ...(f.project ? [] : ['Project No'])]}
        getRows={async () => (await fetchAllWorkDone(f)).map(r => [r.itemNo, r.description, r.unit, r.quantity, r.rate, r.amount, ...(f.project ? [] : [r.projectId])])} /></div>
    <CostTabs />
    <FilterBar real />
    <div className="flex items-end justify-between"><div className="grid grid-cols-2 gap-10"><div className="border-l-2 border-brand/40 py-1 pl-4"><p className="text-sm text-slate-500">Total value of work done</p><p className="mt-1 text-2xl font-semibold">{data ? <CountUp value={data.totalAmount} format={n => rwf(Math.round(n))} /> : '–'}</p></div>
      <div className="border-l-2 border-brand/40 py-1 pl-4"><p className="text-sm text-slate-500">Items</p><p className="mt-1 text-2xl font-semibold">{data ? <CountUp value={data.total} /> : '–'}</p></div></div>
      {f.project && <Link to={`/projects/${f.project}/boq`} className="text-sm text-brand hover:underline">Manage this project's bill of quantities →</Link>}</div>
    {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Could not load work done. {errMsg(error)} <button onClick={() => refetch()} className="underline">Try again</button></div>
      : isLoading ? <TableSkeleton rows={8} />
      : !data?.rows.length ? <EmptyState icon={ClipboardList} title={f.project || f.from || f.to ? 'No work done matches' : 'No work done yet'} text={f.project || f.from || f.to ? 'Widen the date range or choose another project.' : "Work appears here when reports record quantities against a project's bill of quantities."} />
      : <table className="rise card-shadow w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{head.map(h => <th key={h} className={`px-4 py-3 font-medium ${num(h)}`}>{h}</th>)}</tr></thead>
        <tbody>{data.rows.map((r, i) => <Fragment key={`${r.projectId}-${r.itemNo}`}>{!f.project && (i === 0 || data.rows[i - 1].projectId !== r.projectId) && <tr className="border-t border-slate-100 bg-slate-50"><td colSpan={head.length} className="px-4 py-2 text-xs font-medium text-slate-500">{r.projectId} · {r.projectName}</td></tr>}
          <tr className="border-t border-slate-100 transition-colors hover:bg-slate-50"><td className="px-4 py-3 font-medium tnum">{r.itemNo}</td><td className="px-4 py-3">{r.description}</td><td className="px-4 py-3">{r.unit}</td><td className="px-4 py-3 text-right">{fmt(r.quantity)}</td><td className="px-4 py-3 text-right">{fmt(r.rate)}</td><td className="px-4 py-3 text-right">{fmt(r.amount)}</td></tr></Fragment>)}</tbody>
        <tfoot><tr className="border-t border-slate-200 bg-slate-50 font-semibold"><td colSpan={head.length - 1} className="px-4 py-3 text-right">Total ({data.total} items)</td><td className="px-4 py-3 text-right">{fmt(data.totalAmount)}</td></tr></tfoot></table>}
    <div className="flex items-center justify-between text-sm text-slate-500"><span>{data?.total ?? 0} items</span>
      <div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => set({ page: String(page - 1) })} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button>Page {page} of {pages}<button disabled={page >= pages} onClick={() => set({ page: String(page + 1) })} className="rounded border px-3 py-1 disabled:opacity-40">Next</button></div></div>
  </div>)
}
