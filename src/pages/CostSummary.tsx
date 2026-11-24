import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Landmark, TrendingDown, TrendingUp } from 'lucide-react'
import { CountUp, EmptyState, TableSkeleton } from '../components/ui'
import CostTabs from '../components/CostTabs'
import { errMsg } from '../lib/api'
import { rwf } from '../services/costs'
import { listFinance } from '../services/financeApi'
const size = 12, tone = (n: number) => (n < 0 ? 'text-red-700' : 'text-brand')
export default function CostSummary() {
  const [sp, setSp] = useSearchParams()
  const q = { search: sp.get('q') ?? '', page: Number(sp.get('page') ?? 1), size }
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k !== 'page') n.delete('page'); setSp(n) }
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['finance-list', q], queryFn: () => listFinance(q), placeholderData: keepPreviousData })
  const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1
  const t = data?.totals
  const stats: [string, number, string][] = t ? [['Expected income', t.contract, ''], ['Spent so far', t.spent, ''], ['Value earned so far', t.earned, ''], [t.profit < 0 ? 'Loss so far' : 'Profit so far', Math.abs(t.profit), tone(t.profit)]] : []
  return (<div className="space-y-6">
    <CostTabs />
    <div className="grid grid-cols-4 gap-4">{stats.map(([l, v, c], i) => <div key={l} style={{ '--i': i } as React.CSSProperties} className="rise border-l-2 border-brand/40 py-1 pl-4"><p className="text-sm text-slate-500">{l}</p><p className={`mt-1 text-xl font-semibold ${c} tnum`}><CountUp value={v} format={n => rwf(Math.round(n))} /></p></div>)}</div>
    <p className="text-xs text-slate-500">Projects losing money are listed first. Value earned comes from work recorded against each project's bill of quantities, and spent is labor from reports plus the costs entered on each project.</p>
    <input defaultValue={q.search} onChange={e => set('q', e.target.value)} placeholder="Search by project name or ID…" className="w-full max-w-md rounded-full border border-slate-200 px-4 py-2 text-sm" />
    {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Could not load finances. {errMsg(error)} <button onClick={() => refetch()} className="underline">Try again</button></div>
      : isLoading ? <TableSkeleton rows={8} />
      : !data?.rows.length ? <EmptyState icon={Landmark} title={q.search ? 'No projects match' : 'No projects yet'} text={q.search ? 'Try a different name or project number.' : 'Add a project to see its finances here.'} />
      : <table className="rise card-shadow w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Project', 'Expected income', 'Spent', 'Value earned', 'Profit / loss', 'Forecast at completion'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{data.rows.map(r => <tr key={r.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50"><td className="px-4 py-3"><Link to={`/projects/${r.id}/finance`} className="font-medium text-brand">{r.name}</Link><p className="text-xs text-slate-500">{r.id}</p></td>
          <td className="px-4 py-3">{rwf(r.contractValue)}</td><td className="px-4 py-3">{rwf(r.spent)}</td><td className="px-4 py-3">{rwf(r.earned)}</td><td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${r.profit < 0 ? 'bg-red-100 text-red-700' : 'bg-brand/10 text-brand'}`}>{r.profit < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}{rwf(r.profit)}</span></td>
          <td className={`px-4 py-3 ${r.forecastProfit === null ? 'text-slate-500' : tone(r.forecastProfit)}`}>{r.forecastProfit === null ? 'Not enough progress' : rwf(r.forecastProfit)}</td></tr>)}</tbody></table>}
    <div className="flex items-center justify-between text-sm text-slate-500"><span>{data?.total ?? 0} projects</span>
      <div className="flex items-center gap-2"><button disabled={q.page <= 1} onClick={() => set('page', String(q.page - 1))} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button>Page {q.page} of {pages}<button disabled={q.page >= pages} onClick={() => set('page', String(q.page + 1))} className="rounded border px-3 py-1 disabled:opacity-40">Next</button></div></div>
  </div>)
}
