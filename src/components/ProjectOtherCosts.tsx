import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import CostFormDialog from './CostFormDialog'
import { money, num } from './GroupTable'
import { errMsg } from '../lib/api'
import { PeriodFilter, dmy, usePeriod } from '../lib/period'
import { createOtherCost, deleteOtherCost, getSection, mgmtKeys, periodReady, updateOtherCost, type OtherCost } from '../services/managementApi'
import { listSites } from '../services/projectsApi'
type Dlg = { kind: 'add' } | { kind: 'edit' | 'delete'; c: OtherCost } | null
export default function ProjectOtherCosts({ id }: { id: string }) {
  const p = usePeriod(), qc = useQueryClient(), [dlg, setDlg] = useState<Dlg>(null)
  const q = useQuery({ queryKey: ['section', id, 'other-costs', p], queryFn: () => getSection<{ records: OtherCost[]; groups: { category: string; count: number; amount: number }[]; total: number }>(id, 'other-costs', p), enabled: periodReady(p), placeholderData: keepPreviousData })
  const sites = useQuery({ queryKey: ['sites', id], queryFn: () => listSites(id) }), names = sites.data?.map(s => s.name) ?? []
  const del = useMutation({ mutationFn: (cid: number) => deleteOtherCost(cid), onSuccess: () => { mgmtKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] })); setDlg(null) } })
  const d = q.data
  return (<div className="space-y-5"><div className="flex items-start justify-between gap-4"><PeriodFilter resolved={d?.period} />
      <button onClick={() => setDlg({ kind: 'add' })} className="flex shrink-0 items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white"><Plus size={16} />Add Cost</button></div>
    <p className="text-xs text-slate-500">Costs the Admin enters by hand. They are never created from daily reports.</p>
    <div className="flex flex-wrap gap-6"><div className="border-l-2 border-brand/40 py-1 pl-4"><p className="text-sm text-slate-500">Total other costs</p><p className="mt-1 text-xl font-semibold tnum">{d ? money(d.total) : '–'}</p></div>
      {d?.groups.map(g => <div key={g.category} className="border-l-2 border-slate-200 py-1 pl-4"><p className="text-sm text-slate-500">{g.category} · {g.count}</p><p className="mt-1 font-semibold tnum">{money(g.amount)}</p></div>)}</div>
    {q.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{errMsg(q.error)} <button onClick={() => q.refetch()} className="underline">Try again</button></div> : q.isLoading ? <p className="text-sm text-slate-500">Loading…</p>
      : !d?.records.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">No other costs in this period. Click Add Cost to enter one.</div>
      : <table className="card-shadow w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Date', 'Category', 'Description', 'Quantity × rate', 'Amount', 'Site', ''].map(h => <th key={h} className={`px-4 py-3 font-medium ${h === 'Amount' ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
        <tbody>{d.records.map(c => <tr key={c.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50"><td className="px-4 py-3">{dmy(c.date)}</td><td className="px-4 py-3">{c.category}</td><td className="px-4 py-3">{c.description}{c.notes && <span className="block text-xs text-slate-500">{c.notes}</span>}</td>
          <td className="px-4 py-3 text-slate-500">{c.quantity !== null ? `${num(c.quantity)} ${c.unit ?? ''} × ${num(c.rate ?? 0)}` : '–'}</td><td className="px-4 py-3 text-right font-medium tnum">{num(c.amount)}</td><td className="px-4 py-3 text-slate-500">{c.site ?? 'Whole project'}</td>
          <td className="space-x-3 px-4 py-3 text-right text-xs"><button onClick={() => setDlg({ kind: 'edit', c })} className="text-brand">Edit</button><button onClick={() => { del.reset(); setDlg({ kind: 'delete', c }) }} className="text-red-700">Delete</button></td></tr>)}</tbody></table>}
    {dlg?.kind === 'add' && <CostFormDialog title="Add cost" noun="cost" withCategory sites={names} save={x => createOtherCost(id, x)} onClose={() => setDlg(null)} />}
    {dlg?.kind === 'edit' && <CostFormDialog title="Edit cost" noun="cost" withCategory sites={names} initial={{ category: dlg.c.category, description: dlg.c.description, costDate: dlg.c.date, quantity: dlg.c.quantity, unit: dlg.c.unit ?? '', rate: dlg.c.rate, amount: dlg.c.amount, notes: dlg.c.notes ?? '', site: dlg.c.site ?? '' }} save={x => updateOtherCost(dlg.c.id, x)} onClose={() => setDlg(null)} />}
    {dlg?.kind === 'delete' && <ConfirmDialog danger title="Delete this cost?" confirmLabel="Yes, delete it" busy={del.isPending} error={del.error ? errMsg(del.error) : undefined} onConfirm={() => del.mutate(dlg.c.id)} onCancel={() => setDlg(null)}>{dlg.c.description} · {num(dlg.c.amount)} RWF. The project's totals will drop by this amount. It cannot be undone.</ConfirmDialog>}</div>)
}
