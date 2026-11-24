import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { num } from './GroupTable'
import { tip } from './ui'
import { errMsg } from '../lib/api'
import { dmy } from '../lib/period'
import { rwf } from '../services/costs'
import { listBoqItems } from '../services/boqApi'
import { getProgress } from '../services/managementApi'

function ProgressBar({ pct, over }: { pct: number; over?: boolean }) {
  return (
    <div className="mt-2 h-3 w-full rounded-full bg-slate-100">
      <div className="h-3 rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: over ? '#dc2626' : 'var(--color-brand)' }} />
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-l-2 border-brand/40 py-1 pl-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tnum">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

export default function ProjectProgress({ id }: { id: string }) {
  const q = useQuery({ queryKey: ['progress', id], queryFn: () => getProgress(id) })
  const boq = useQuery({ queryKey: ['boq-full', id], queryFn: () => listBoqItems(id) })

  if (q.error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{errMsg(q.error)} <button onClick={() => q.refetch()} className="underline">Try again</button></div>
  if (q.isLoading || !q.data) return <p className="text-sm text-slate-500">Loading progress…</p>

  const d = q.data
  const t = d.timeline
  const last = t[t.length - 1]
  const chartData = t.map(x => ({ label: dmy(x.date), progress: x.progress }))
  const fin = d.financial
  const time = d.time

  return (
    <div className="space-y-8">

      {/* ── Financial Progress ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Financial Progress</h2>
            <p className="mt-0.5 text-xs text-slate-500">(Total Recorded Costs ÷ Total Project Budget) × 100</p>
          </div>
          <span className={`text-3xl font-bold tnum ${fin.pct > 100 ? 'text-red-600' : 'text-brand'}`}>{fin.pct}%</span>
        </div>
        <ProgressBar pct={fin.pct} over={fin.pct > 100} />
        <div className="grid grid-cols-3 gap-4 pt-2">
          <StatCard label="Total project budget" value={rwf(fin.budget)} />
          <StatCard label="Total recorded costs" value={rwf(fin.total_costs)} sub="Equipment + Labour + Materials + Other + Subcontractors" />
          <StatCard label={fin.remaining < 0 ? 'Over budget by' : 'Remaining budget'} value={rwf(Math.abs(fin.remaining))} />
        </div>
        {fin.pct > 100 && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Recorded costs exceed the project budget by {rwf(Math.abs(fin.remaining))}.</p>}
        {fin.pct > 80 && fin.pct <= 100 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">Over 80% of the budget has been consumed.</p>}
      </section>

      {/* ── Time Progress ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Time Progress</h2>
            <p className="mt-0.5 text-xs text-slate-500">(Days Elapsed ÷ Total Planned Days) × 100</p>
          </div>
          {time.pct !== null
            ? <span className={`text-3xl font-bold tnum ${time.pct > 100 ? 'text-red-600' : 'text-brand'}`}>{time.pct}%</span>
            : <span className="text-sm text-slate-400">No dates set</span>}
        </div>
        {time.pct !== null && <ProgressBar pct={time.pct} over={time.pct > 100} />}
        {time.start_date && time.end_date
          ? <div className="grid grid-cols-4 gap-4 pt-2">
              <StatCard label="Start date" value={dmy(time.start_date)} />
              <StatCard label="End date" value={dmy(time.end_date)} />
              <StatCard label="Total planned days" value={`${num(time.total_days!)} days`} />
              <StatCard label="Days elapsed" value={`${num(time.elapsed!)} days`} />
              <div /><div />
              <StatCard label="Days remaining" value={`${num(time.remaining!)} days`} />
              <StatCard label="Time elapsed" value={`${time.pct}%`} />
            </div>
          : <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">Set a start date and end date on the project to enable time progress tracking.</p>}
        {time.pct !== null && time.pct >= 100 && time.remaining === 0 && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">The planned end date has passed.</p>}
      </section>

      {/* ── Physical Progress ── */}
      <section className="space-y-4">
        <div>
          <h2 className="font-semibold">Physical Progress</h2>
          <p className="mt-0.5 text-xs text-slate-500">Work completed in approved reports, valued at BOQ rates, as a share of the contract value ({rwf(d.contract_value)}).</p>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {([['Physical progress', `${last?.progress ?? 0}%`], ['Approved reports', String(d.reports.Approved)], ['Waiting for review', String(d.reports.Pending)], ['Returned for correction', String(d.reports.Returned)]] as [string, string][]).map(([l, v]) => (
            <StatCard key={l} label={l} value={v} />
          ))}
        </div>
        {!t.length
          ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">No approved work yet. Progress appears here once approved reports record quantities against the BOQ.</div>
          : <>
            <div className="card-shadow rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold">Progress over time</h3>
              <div className="h-64">
                <ResponsiveContainer>
                  <AreaChart data={chartData}>
                    <defs><linearGradient id="fillProg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#034337" stopOpacity={0.35} /><stop offset="95%" stopColor="#034337" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} />
                    <Tooltip {...tip} formatter={(v: number) => [`${v}%`, 'Progress']} />
                    <Area dataKey="progress" stroke="#034337" strokeWidth={3} fill="url(#fillProg)" activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <table className="card-shadow w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>{['Date', 'Reports', 'Work done that day', 'Total so far', 'Progress'].map(h => <th key={h} className={`px-4 py-3 font-medium ${h === 'Date' || h === 'Reports' ? '' : 'text-right'}`}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {[...t].reverse().map(x => (
                  <tr key={x.date} className="border-t border-slate-100">
                    <td className="px-4 py-3">{dmy(x.date)}</td>
                    <td className="px-4 py-3">{x.reports}</td>
                    <td className="px-4 py-3 text-right tnum">{num(x.work_value)} RWF</td>
                    <td className="px-4 py-3 text-right tnum">{num(x.cumulative)} RWF</td>
                    <td className="px-4 py-3 text-right font-medium tnum">{x.progress}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>}
      </section>

      {/* ── Work by BOQ item ── */}
      {boq.data && boq.data.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Work completed by BOQ item</h2>
          <table className="card-shadow w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>{['Item No', 'Description', 'Unit', 'Contract qty', 'Done qty', 'Progress'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {boq.data.map(b => (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{b.itemNo}</td>
                  <td className="px-4 py-3">{b.description}</td>
                  <td className="px-4 py-3">{b.unit}</td>
                  <td className="px-4 py-3">{b.quantity != null ? num(b.quantity) : '–'}</td>
                  <td className="px-4 py-3 tnum">{num(b.quantityDone)}</td>
                  <td className="px-4 py-3">
                    {b.quantity
                      ? <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded bg-slate-100"><div className="h-2 rounded bg-brand" style={{ width: `${Math.min(100, (b.quantityDone / b.quantity) * 100)}%` }} /></div>
                          {Math.min(100, Math.round((b.quantityDone / b.quantity) * 100))}%
                        </div>
                      : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
