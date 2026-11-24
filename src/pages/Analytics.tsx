import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import FilterBar, { useFilters } from '../components/FilterBar'
import { CountUp, Skeleton, tip } from '../components/ui'
import { errMsg } from '../lib/api'
import { rwf } from '../services/costs'
import { getAnalytics } from '../services/analyticsApi'
const Box = ({ t, sub, children, wide }: { t: string; sub: string; children: ReactNode; wide?: boolean }) => <div className={`rise card-shadow rounded-2xl border border-slate-200 bg-white p-5 transition duration-300 hover:-translate-y-0.5 ${wide ? 'col-span-2' : ''}`}><h2 className="text-sm font-semibold">{t}</h2><p className="mb-3 mt-0.5 text-xs text-slate-500">{sub}</p>{children}</div>
const Empty = () => <p className="grid h-52 place-items-center text-sm text-slate-500">No data for these filters.</p>
const grid = <CartesianGrid stroke="#e2e8f0" vertical={false} />
const M = (v: number) => `${(v / 1e6).toFixed(1)}M`
export default function Analytics() {
  const { f } = useFilters()
  const { data: d, isLoading, error, refetch } = useQuery({ queryKey: ['analytics', f], queryFn: () => getAnalytics(f) })
  const chart = (rows: unknown[], el: React.ReactElement) => rows.length ? <div className="h-52"><ResponsiveContainer>{el}</ResponsiveContainer></div> : <Empty />
  const cards: [string, number, (n: number) => string][] = d ? [['Recorded cost', d.kpi.cost, n => rwf(Math.round(n))], ['Reports', d.kpi.reports, n => String(Math.round(n))], ['Fuel used', d.kpi.fuel_used, n => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n))} L`]] : []
  return (<div className="space-y-6">
    <FilterBar real />
    <svg width="0" height="0" className="absolute" aria-hidden="true"><defs><linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#034337" stopOpacity={1} /><stop offset="100%" stopColor="#034337" stopOpacity={0.55} /></linearGradient></defs></svg>
    {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Could not load analytics. {errMsg(error)} <button onClick={() => refetch()} className="underline">Try again</button></div>
      : isLoading || !d ? <div className="space-y-6"><div className="grid grid-cols-3 gap-4"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div><div className="grid grid-cols-2 gap-4"><Skeleton className="col-span-2 h-72" /><Skeleton className="h-72" /><Skeleton className="h-72" /></div></div> : <>
      <div className="grid grid-cols-3 gap-4">{cards.map(([l, v, fm], i) => <div key={l} style={{ '--i': i } as React.CSSProperties} className="rise border-l-2 border-brand/40 py-1 pl-4"><p className="text-sm text-slate-500">{l}</p><p className="mt-1 text-3xl font-semibold tnum"><CountUp value={v} format={fm} /></p></div>)}</div>
      <div className="grid grid-cols-2 gap-4">
        <Box wide t="Recorded cost per day" sub="Labor from reports plus costs entered on that day, in RWF">{chart(d.costPerDay, <LineChart data={d.costPerDay}>{grid}<XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} width={52} tickFormatter={M} /><Tooltip {...tip} formatter={(v: number) => [rwf(v), 'Cost']} /><Line dataKey="amount" stroke="#034337" strokeWidth={3} dot={false} activeDot={{ r: 5 }} /></LineChart>)}</Box>
        <Box t="Cost by category" sub="Where the money went, in RWF">{chart(d.costByCategory.filter(c => c.amount > 0), <BarChart data={d.costByCategory}>{grid}<XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} width={52} tickFormatter={M} /><Tooltip {...tip} formatter={(v: number) => [rwf(v), 'Cost']} /><Bar dataKey="amount" fill="url(#barFill)" radius={[8, 8, 0, 0]} maxBarSize={48} /></BarChart>)}</Box>
        <Box t="Reports by status" sub="How many reports are waiting, approved or flagged">{chart(d.reportsByStatus.filter(r => r.count > 0), <BarChart data={d.reportsByStatus}>{grid}<XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip {...tip} formatter={(v: number) => [`${v} reports`, 'Reports']} /><Bar dataKey="count" fill="url(#barFill)" radius={[8, 8, 0, 0]} maxBarSize={48} /></BarChart>)}</Box>
        <Box wide t="Fuel used by machine" sub="Litres of fuel used, from the equipment lists in reports">{chart(d.fuelByMachine, <BarChart data={d.fuelByMachine} layout="vertical" margin={{ left: 40 }}><XAxis type="number" fontSize={11} /><YAxis type="category" dataKey="name" fontSize={11} width={170} /><Tooltip {...tip} formatter={(v: number, _n, p) => [`${v} L over ${p.payload.hours} h`, 'Fuel used']} /><Bar dataKey="litres" fill="#034337" radius={[0, 6, 6, 0]} /></BarChart>)}</Box></div>
      {!f.project && <Box t="Projects with the highest recorded cost" sub="The five projects that cost the most in this period">{d.topProjects.length ? <ul className="space-y-2 text-sm">{d.topProjects.map((p, i) => <li key={p.id} className="flex items-center justify-between"><Link to={`/projects/${p.id}/finance`} className="flex items-center gap-3 text-brand"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-semibold">{i + 1}</span><span>{p.name} <span className="text-slate-400">{p.id}</span></span></Link><b>{rwf(p.amount)}</b></li>)}</ul> : <Empty />}</Box>}</>}
  </div>)
}
