import { useState, type ReactNode } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ConfirmDialog from './ConfirmDialog'
import { money, num } from './GroupTable'
import { errMsg } from '../lib/api'
import { PeriodFilter, dmy, usePeriod } from '../lib/period'
import { getSection, mgmtKeys, periodReady, removeRate, setRate, type EquipGroup, type EquipRec, type LabourGroup, type MatGroup, type Resolved } from '../services/managementApi'

function useSec<T>(id: string, section: string) {
  const p = usePeriod()
  return useQuery({ queryKey: ['section', id, section, p], queryFn: () => getSection<T>(id, section, p), enabled: periodReady(p), placeholderData: keepPreviousData })
}

function Frame({ loading, error, retry, resolved, stats, note, children }: { loading: boolean; error: unknown; retry: () => void; resolved?: Resolved; stats: [string, string][]; note?: string; children: ReactNode }) {
  return (
    <div className="space-y-5">
      <PeriodFilter resolved={resolved} />
      <div className="grid grid-cols-4 gap-4">
        {stats.map(([l, v]) => (
          <div key={l} className="border-l-2 border-brand/40 py-1 pl-4">
            <p className="text-sm text-slate-500">{l}</p>
            <p className="mt-1 text-xl font-semibold tnum">{v}</p>
          </div>
        ))}
      </div>
      {note && <p className="rounded-xl bg-amber-100 p-3 text-sm text-amber-700">{note}</p>}
      {error
        ? <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{errMsg(error)} <button onClick={retry} className="underline">Try again</button></div>
        : loading ? <p className="text-sm text-slate-500">Loading…</p>
        : children}
    </div>
  )
}

function RateDialog({ code, kind, name, unit, current, rateId, onClose }: { code: string; kind: 'equipment' | 'material'; name: string; unit?: string; current: number | null; rateId: number | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [v, setV] = useState(current ? String(current) : '')
  const [ask, setAsk] = useState<'save' | 'remove' | null>(null)
  const [touched, setTouched] = useState(false)
  const rate = Number(v), bad = !Number.isInteger(rate) || rate <= 0
  const done = () => { mgmtKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] })); onClose() }
  const save = useMutation({ mutationFn: () => setRate(code, { kind, name, unit, rate }), onSuccess: done })
  const del = useMutation({ mutationFn: () => removeRate(rateId!), onSuccess: done })
  const per = kind === 'equipment' ? 'hour' : unit
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40" role="dialog" aria-modal="true">
      <form noValidate onSubmit={e => { e.preventDefault(); setTouched(true); if (!bad) setAsk('save') }} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">{current ? 'Change' : 'Set'} rate · {name}</h2>
        <label className="block text-sm">Rate per {per} (RWF)
          <input type="number" min="0" value={v} autoFocus onChange={e => setV(e.target.value)} className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${touched && bad ? 'border-red-400' : 'border-slate-200'}`} />
          {touched && bad && <span className="mt-1 block text-xs text-red-600">Enter a whole rate above 0.</span>}
        </label>
        <p className="text-xs text-slate-500">{kind === 'equipment' ? 'Operating hours are multiplied by this rate.' : 'Quantities received are multiplied by this rate.'}</p>
        <div className="flex justify-between">
          <span>{rateId && <button type="button" onClick={() => { del.reset(); setAsk('remove') }} className="text-sm text-red-700">Remove rate</button>}</span>
          <span className="space-x-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
            <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">Save rate</button>
          </span>
        </div>
        {ask === 'save' && <ConfirmDialog title="Apply this rate?" confirmLabel="Yes, apply it" busy={save.isPending} error={save.error ? errMsg(save.error) : undefined} onConfirm={() => save.mutate()} onCancel={() => setAsk(null)}>{name} will be valued at {num(rate)} RWF per {per}.</ConfirmDialog>}
        {ask === 'remove' && <ConfirmDialog danger title="Remove this rate?" confirmLabel="Yes, remove it" busy={del.isPending} error={del.error ? errMsg(del.error) : undefined} onConfirm={() => del.mutate()} onCancel={() => setAsk(null)}>The cost for {name} will be removed from totals.</ConfirmDialog>}
      </form>
    </div>
  )
}

// ── date-based tracking table ──────────────────────────────────────────────
// dates as columns, resources as rows, cells show daily values
function DateTable({ dates, rowLabel, rows, totalsRow, emptyMsg }: {
  dates: string[]
  rowLabel: string
  rows: { id: string; label: ReactNode; sublabel?: string; cells: Record<string, ReactNode>; totals: ReactNode[] }[]
  totalsRow?: ReactNode[]
  emptyMsg: string
}) {
  if (!rows.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">{emptyMsg}</div>
  const th = 'px-3 py-2 font-medium whitespace-nowrap'
  const td = 'px-3 py-2 text-right tnum whitespace-nowrap'
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className={`${th} sticky left-0 z-10 bg-slate-50 min-w-[180px]`}>{rowLabel}</th>
            {dates.map(d => <th key={d} className={`${th} text-right`}>{dmy(d)}</th>)}
            <th className={`${th} text-right bg-slate-100`}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="sticky left-0 z-10 bg-white px-3 py-2 hover:bg-slate-50">
                <div className="font-medium">{r.label}</div>
                {r.sublabel && <div className="text-xs text-slate-400">{r.sublabel}</div>}
              </td>
              {dates.map(d => <td key={d} className={td}>{r.cells[d] ?? '–'}</td>)}
              {r.totals.map((t, i) => <td key={i} className={`${td} bg-slate-50 font-medium`}>{t}</td>)}
            </tr>
          ))}
        </tbody>
        {totalsRow && (
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-100 font-semibold text-xs uppercase tracking-wide text-slate-600">
              <td className="sticky left-0 z-10 bg-slate-100 px-3 py-2">Total</td>
              {totalsRow.map((v, i) => <td key={i} className={td}>{v}</td>)}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

// ── Equipment ──────────────────────────────────────────────────────────────
export function ProjectEquipment({ id }: { id: string }) {
  const q = useSec<{ groups: EquipGroup[] }>(id, 'equipment')
  const [rate, setRateFor] = useState<EquipGroup | null>(null)
  const g = q.data?.groups ?? []
  const known = g.filter(x => x.amount !== null)
  const missing = g.length - known.length

  // collect all unique dates across all equipment records
  const allDates = [...new Set(g.flatMap(x => x.records.map((r: EquipRec) => r.date)))].sort()

  // build per-date hours map for each machine
  const rows = g.map(x => {
    const byDate: Record<string, EquipRec[]> = {}
    x.records.forEach((r: EquipRec) => { (byDate[r.date] ??= []).push(r) })
    const cells: Record<string, ReactNode> = {}
    allDates.forEach(d => {
      const recs = byDate[d]
      if (!recs) return
      const hrs = recs.reduce((a, r) => a + r.hours, 0)
      const fuel = recs.reduce((a, r) => a + r.fuel_used, 0)
      cells[d] = (
        <span title={`Fuel used: ${num(fuel)} L`}>
          {num(hrs)}h
          {fuel > 0 && <span className="ml-1 text-xs text-slate-400">{num(fuel)}L</span>}
        </span>
      )
    })
    return {
      id: x.key,
      label: <span className="font-medium">{x.name}</span>,
      sublabel: x.rate ? `${num(x.rate)} RWF/hr` : 'No rate set',
      cells,
      totals: [
        <span key="hrs">{num(x.hours)}h</span>,
      ],
    }
  })

  // footer: total hours per date
  const dateTotals = allDates.map(d => {
    const total = g.reduce((a, x) => {
      const recs = x.records.filter((r: EquipRec) => r.date === d)
      return a + recs.reduce((b, r) => b + r.hours, 0)
    }, 0)
    return total > 0 ? <span>{num(total)}h</span> : <span className="text-slate-300">–</span>
  })
  const grandTotal = <span>{num(g.reduce((a, x) => a + x.hours, 0))}h</span>

  return (
    <Frame
      loading={q.isLoading} error={q.error} retry={q.refetch} resolved={q.data?.period}
      note={missing ? `${missing} machine${missing > 1 ? 's have' : ' has'} no hire rate yet — cost not included. Click "Set rate" to add one.` : undefined}
      stats={[
        ['Machines', String(g.length)],
        ['Operating hours', num(g.reduce((a, x) => a + x.hours, 0))],
        ['Fuel used', `${num(g.reduce((a, x) => a + x.fuel_used, 0))} L`],
        ['Amount', known.length ? money(known.reduce((a, x) => a + (x.amount ?? 0), 0)) : 'Not recorded'],
      ]}
    >
      <DateTable
        dates={allDates}
        rowLabel="Equipment"
        rows={rows}
        totalsRow={[...dateTotals, grandTotal]}
        emptyMsg="No equipment in approved reports for this period."
      />
      {/* rate buttons below table */}
      {g.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {g.map(x => (
            <button key={x.key} onClick={() => setRateFor(x)} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-brand hover:border-brand">
              {x.name} · {x.rate ? `${num(x.rate)} RWF/hr` : 'Set rate'}
            </button>
          ))}
        </div>
      )}
      {rate && <RateDialog code={id} kind="equipment" name={rate.name} current={rate.rate} rateId={rate.rate_id} onClose={() => setRateFor(null)} />}
    </Frame>
  )
}

// ── Casual Labour ──────────────────────────────────────────────────────────
export function ProjectLabour({ id }: { id: string }) {
  const q = useSec<{ groups: LabourGroup[] }>(id, 'labour')
  const g = q.data?.groups ?? []

  const allDates = [...new Set(g.flatMap(x => x.records.map(r => r.date)))].sort()

  const rows = g.map(x => {
    const byDate: Record<string, typeof x.records> = {}
    x.records.forEach(r => { (byDate[r.date] ??= []).push(r) })
    const cells: Record<string, ReactNode> = {}
    allDates.forEach(d => {
      const recs = byDate[d]
      if (!recs) return
      const total = recs.reduce((a, r) => a + r.headcount, 0)
      const wages = [...new Set(recs.map(r => r.wage))]
      cells[d] = (
        <span title={wages.map(w => `${num(w)} RWF/day`).join(', ')}>
          {total}
        </span>
      )
    })
    return {
      id: x.key,
      label: <span className="font-medium">{x.role}</span>,
      sublabel: x.rate ? `${num(x.rate)} RWF/day` : x.rates.map(r => `${num(r.wage)} RWF`).join(' / '),
      cells,
      totals: [
        <span key="pd">{num(x.person_days)} person-days</span>,
        <span key="amt">{money(x.amount)}</span>,
      ],
    }
  })

  const dateTotals = allDates.map(d => {
    const total = g.reduce((a, x) => {
      return a + x.records.filter(r => r.date === d).reduce((b, r) => b + r.headcount, 0)
    }, 0)
    return total > 0 ? <span>{total}</span> : <span className="text-slate-300">–</span>
  })
  const totalPd = g.reduce((a, x) => a + x.person_days, 0)
  const totalAmt = g.reduce((a, x) => a + x.amount, 0)

  return (
    <Frame
      loading={q.isLoading} error={q.error} retry={q.refetch} resolved={q.data?.period}
      stats={[
        ['Worker categories', String(g.length)],
        ['Person-days', num(totalPd)],
        ['Labour cost', money(totalAmt)],
        ['Active dates', String(allDates.length)],
      ]}
    >
      <DateTable
        dates={allDates}
        rowLabel="Labour category"
        rows={rows}
        totalsRow={[...dateTotals, <span key="pd">{num(totalPd)}</span>, <span key="amt">{money(totalAmt)}</span>]}
        emptyMsg="No casual labour in approved reports for this period."
      />
      <p className="mt-2 text-xs text-slate-500">Cells show headcount per day. Hover a cell to see the wage rate. Person-days and cost are accumulated totals for the period.</p>
    </Frame>
  )
}

// ── Material Costs ─────────────────────────────────────────────────────────
export function ProjectMaterials({ id }: { id: string }) {
  const q = useSec<{ groups: MatGroup[] }>(id, 'materials')
  const [rate, setRateFor] = useState<MatGroup | null>(null)
  const g = q.data?.groups ?? []
  const missing = g.filter(x => x.received > 0 && x.rate === null).length
  const known = g.filter(x => x.amount !== null)

  const allDates = [...new Set(g.flatMap(x => x.records.map(r => r.date)))].sort()

  const rows = g.map(x => {
    const byDate: Record<string, typeof x.records> = {}
    x.records.forEach(r => { (byDate[r.date] ??= []).push(r) })
    const cells: Record<string, ReactNode> = {}
    allDates.forEach(d => {
      const recs = byDate[d]
      if (!recs) return
      const recv = recs.filter(r => r.kind === 'received').reduce((a, r) => a + r.quantity, 0)
      const used = recs.filter(r => r.kind === 'used').reduce((a, r) => a + r.quantity, 0)
      const parts: string[] = []
      if (recv > 0) parts.push(`+${num(recv)}`)
      if (used > 0) parts.push(`−${num(used)}`)
      cells[d] = <span title={`Received: ${num(recv)} ${x.unit} / Used: ${num(used)} ${x.unit}`}>{parts.join(' ')}</span>
    })
    return {
      id: x.key,
      label: <span className="font-medium">{x.name}</span>,
      sublabel: `${x.unit}${x.rate ? ` · ${num(x.rate)} RWF/${x.unit}` : ' · no rate'}`,
      cells,
      totals: [
        <span key="recv" className="text-brand">+{num(x.received)}</span>,
        <span key="used" className="text-slate-500">−{num(x.used)}</span>,
        <span key="bal">{num(x.balance)}</span>,
        <span key="amt">{money(x.amount)}</span>,
      ],
    }
  })

  const dateTotals = allDates.map(d => {
    const recv = g.reduce((a, x) => a + x.records.filter(r => r.date === d && r.kind === 'received').reduce((b, r) => b + r.quantity, 0), 0)
    const used = g.reduce((a, x) => a + x.records.filter(r => r.date === d && r.kind === 'used').reduce((b, r) => b + r.quantity, 0), 0)
    if (recv === 0 && used === 0) return <span className="text-slate-300">–</span>
    return <span>{recv > 0 ? `+${num(recv)}` : ''}{used > 0 ? ` −${num(used)}` : ''}</span>
  })

  return (
    <Frame
      loading={q.isLoading} error={q.error} retry={q.refetch} resolved={q.data?.period}
      note={missing ? `${missing} material${missing > 1 ? 's have' : ' has'} no unit rate — cost not included. Click "Set rate" to add one.` : undefined}
      stats={[
        ['Materials', String(g.length)],
        ['With a rate', String(known.length)],
        ['Total received', num(g.reduce((a, x) => a + x.received, 0))],
        ['Cost (received)', known.length ? money(known.reduce((a, x) => a + (x.amount ?? 0), 0)) : 'Not recorded'],
      ]}
    >
      <DateTable
        dates={allDates}
        rowLabel="Material"
        rows={rows}
        totalsRow={[...dateTotals,
          <span key="r" className="text-brand">+{num(g.reduce((a, x) => a + x.received, 0))}</span>,
          <span key="u" className="text-slate-500">−{num(g.reduce((a, x) => a + x.used, 0))}</span>,
          <span key="b">{num(g.reduce((a, x) => a + x.balance, 0))}</span>,
          <span key="a">{money(known.reduce((a, x) => a + (x.amount ?? 0), 0))}</span>,
        ]}
        emptyMsg="No materials in approved reports for this period."
      />
      <p className="mt-2 text-xs text-slate-500">+ = received, − = used. Hover a cell for the breakdown. Received and used are tracked separately.</p>
      {g.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {g.map(x => (
            <button key={x.key} onClick={() => setRateFor(x)} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-brand hover:border-brand">
              {x.name} ({x.unit}) · {x.rate ? `${num(x.rate)} RWF/${x.unit}` : 'Set rate'}
            </button>
          ))}
        </div>
      )}
      {rate && <RateDialog code={id} kind="material" name={rate.name} unit={rate.unit} current={rate.rate} rateId={rate.rate_id} onClose={() => setRateFor(null)} />}
    </Frame>
  )
}
