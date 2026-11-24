import { useSearchParams } from 'react-router-dom'
import type { Period, PeriodKey, Resolved } from '../services/managementApi'
const KEYS: [PeriodKey, string][] = [['all', 'All Time'], ['this_week', 'This Week'], ['this_month', 'This Month'], ['last_month', 'Last Month'], ['last_2_months', 'Last 2 Months'], ['custom', 'Custom']]
export const dmy = (iso: string | null) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
// The chosen period lives in the address (period, from, to), so it stays when you move between the project's sections.
export function usePeriod(): Period {
  const [sp] = useSearchParams(), k = sp.get('period') as PeriodKey
  return { key: KEYS.some(([x]) => x === k) ? k : 'all', from: sp.get('from') ?? '', to: sp.get('to') ?? '' }
}
export function PeriodFilter({ resolved }: { resolved?: Resolved | null }) {
  const [sp, setSp] = useSearchParams(), p = usePeriod()
  const set = (patch: Record<string, string>) => { const n = new URLSearchParams(sp); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); setSp(n, { replace: true }) }
  const bad = p.key === 'custom' && p.from && p.to && p.from > p.to
  return (<div className="space-y-2"><div className="flex flex-wrap items-center gap-2">{KEYS.map(([k, l]) => <button key={k} onClick={() => set({ period: k === 'all' ? '' : k, ...(k === 'custom' ? {} : { from: '', to: '' }) })} aria-pressed={p.key === k}
      className={`rounded-full border px-4 py-1.5 text-sm transition ${p.key === k ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brand'}`}>{l}</button>)}
    {p.key === 'custom' && <><input type="date" aria-label="Start date" value={p.from} max={p.to || undefined} onChange={e => set({ from: e.target.value })} className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm" /><span className="text-sm text-slate-500">to</span>
      <input type="date" aria-label="End date" value={p.to} min={p.from || undefined} onChange={e => set({ to: e.target.value })} className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm" /></>}</div>
    <p className={`text-xs ${bad ? 'text-red-600' : 'text-slate-500'}`}>{bad ? 'The start date must not be after the end date.' : p.key === 'all' ? 'Showing everything recorded so far.' : p.key === 'custom' && !(p.from && p.to) ? 'Choose a start and an end date.' : resolved?.from ? `Showing records dated ${dmy(resolved.from)} to ${dmy(resolved.to)}.` : ''}</p></div>)
}
