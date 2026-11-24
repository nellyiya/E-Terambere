import { useQuery } from '@tanstack/react-query'
import { rwf } from '../services/costs'
import { getFinance } from '../services/finance'
const tone = (n: number) => (n < 0 ? 'text-red-700' : 'text-brand')
export default function FinanceTab({ pid }: { pid: string }) {
  const { data: d, isLoading, error, refetch } = useQuery({ queryKey: ['finance', pid], queryFn: () => getFinance(pid) })
  if (isLoading) return <p className="text-sm text-slate-500">Loading finances…</p>
  if (error || !d) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Could not load finances. <button onClick={() => refetch()} className="underline">Try again</button></div>
  const stats: [string, string, string, string][] = [
    ['Expected income', rwf(d.project.contractValue), 'Contract value', ''],
    ['Spent so far', rwf(d.spent), 'All cost categories', ''],
    ['Value earned so far', rwf(d.earned), `${d.project.progress}% of the contract`, ''],
    [d.profit < 0 ? 'Loss so far' : 'Profit so far', rwf(Math.abs(d.profit)), 'Value earned minus spent', tone(d.profit)],
    d.forecastProfit === null ? ['At completion', 'Not enough progress', 'A forecast needs some completed work', 'text-slate-500']
      : [d.forecastProfit < 0 ? 'Expected loss at completion' : 'Expected profit at completion', rwf(Math.abs(d.forecastProfit)), `Projected final cost ${rwf(d.forecastCost ?? 0)}`, tone(d.forecastProfit)]]
  return (<div className="space-y-6">
    <div className="grid grid-cols-5 gap-4">{stats.map(([l, v, s, c]) => <div key={l} className="border-l-2 border-brand/40 py-1 pl-4"><p className="text-sm text-slate-500">{l}</p><p className={`mt-1 text-lg font-semibold ${c}`}>{v}</p><p className="mt-1 text-xs text-slate-500">{s}</p></div>)}</div>
    <section><h2 className="mb-2 font-semibold">What we spent it on</h2>
      <table className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Category', 'Amount', 'Share of spending'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{d.breakdown.map(b => { const pct = d.spent ? Math.round((b.total / d.spent) * 100) : 0; return <tr key={b.slug} className="border-t border-slate-100"><td className="px-4 py-3">{b.label}</td><td className="px-4 py-3">{rwf(b.total)}</td>
          <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="h-2 w-40 rounded bg-slate-100"><div className="h-2 rounded bg-brand" style={{ width: `${pct}%` }} /></div>{pct}%</div></td></tr> })}</tbody></table></section>
    <p className="text-xs text-slate-500">Value earned = contract value × project progress. Projected final cost = spent so far ÷ progress. These are estimates for monitoring, not accounting figures. E-terambere records amounts and does not process payments.</p>
  </div>)
}
