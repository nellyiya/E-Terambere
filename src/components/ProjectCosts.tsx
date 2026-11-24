import { useQuery } from '@tanstack/react-query'
import { errMsg } from '../lib/api'
import { rwf } from '../services/costs'
import { LABELS, getProjectFinance } from '../services/costsApi'
export function ProjectFinance({ id }: { id: string }) {
  const { data: d, isLoading, error, refetch } = useQuery({ queryKey: ['finance', id], queryFn: () => getProjectFinance(id) })
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{errMsg(error)} <button onClick={() => refetch()} className="underline">Try again</button></div>
  if (isLoading || !d) return <p className="text-sm text-slate-500">Loading finances…</p>
  const tone = (n: number) => (n < 0 ? 'text-red-700' : 'text-brand'), fp = d.forecast_profit
  const stats: [string, string, string, string][] = [['Expected income', rwf(d.contract_value), 'Contract value', ''], ['Spent so far', rwf(d.spent), 'The Project costs total', ''], ['Value earned so far', rwf(d.earned), `${d.progress}% of the contract`, ''],
    [d.profit < 0 ? 'Loss so far' : 'Profit so far', rwf(Math.abs(d.profit)), 'Value earned minus spent', tone(d.profit)],
    fp === null ? ['At completion', 'Not enough progress', 'A forecast needs approved work', 'text-slate-500'] : [fp < 0 ? 'Expected loss at completion' : 'Expected profit at completion', rwf(Math.abs(fp)), `Projected final cost ${rwf(d.forecast_cost ?? 0)}`, tone(fp)]]
  return (<div className="space-y-6">
    <div className="grid grid-cols-5 gap-4">{stats.map(([l, v, s, c]) => <div key={l} className="border-l-2 border-brand/40 py-1 pl-4"><p className="text-sm text-slate-500">{l}</p><p className={`mt-1 text-lg font-semibold ${c}`}>{v}</p><p className="mt-1 text-xs text-slate-500">{s}</p></div>)}</div>
    {d.earned === 0 && <p className="rounded-xl bg-amber-100 p-3 text-sm text-amber-700">Value earned stays at 0 until approved reports record work against this project's BOQ, so the profit shown is not meaningful yet.</p>}
    <section><h2 className="mb-2 font-semibold">What we spent it on</h2><table className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Category', 'Amount', 'Share of spending'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
      <tbody>{d.breakdown.map(b => { const pct = d.spent ? Math.round((b.amount / d.spent) * 100) : 0; return <tr key={b.category} className="border-t border-slate-100"><td className="px-4 py-3">{LABELS[b.category] ?? b.category}</td><td className="px-4 py-3">{rwf(b.amount)}</td><td className="px-4 py-3"><div className="flex items-center gap-3"><div className="h-2 w-40 rounded bg-slate-100"><div className="h-2 rounded bg-brand" style={{ width: `${pct}%` }} /></div>{pct}%</div></td></tr> })}</tbody></table></section>
    <p className="text-xs text-slate-500">Value earned = value of work recorded against the BOQ in approved reports. Projected final cost = spent so far ÷ progress. These are estimates for monitoring, not accounting figures. E-terambere records amounts and does not process payments.</p></div>)
}
