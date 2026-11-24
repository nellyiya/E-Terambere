import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import CostFormDialog from './CostFormDialog'
import { money, num } from './GroupTable'
import { errMsg } from '../lib/api'
import { PeriodFilter, dmy, usePeriod } from '../lib/period'
import { createSub, createSubCost, deleteSub, deleteSubCost, getSection, mgmtKeys, periodReady, updateSub, updateSubCost, type SubCost, type SubGroup, type SubInput } from '../services/managementApi'
const cls = 'mt-1 w-full rounded-lg border px-3 py-2 text-sm', STATUS = ['Planned', 'Active', 'Completed', 'Terminated']
type Dlg = { k: 'sub'; s?: SubGroup } | { k: 'delsub'; s: SubGroup } | { k: 'cost'; s: SubGroup; c?: SubCost } | { k: 'delcost'; c: SubCost } | null
function SubDialog({ id, sub, onClose }: { id: string; sub?: SubGroup; onClose: () => void }) {
  const qc = useQueryClient(), [t, setT] = useState(false), [ask, setAsk] = useState(false)
  const [v, setV] = useState({ name: sub?.name ?? '', scope: sub?.scope ?? '', amount: sub ? String(sub.agreed_amount) : '', start: sub?.start_date ?? '', end: sub?.end_date ?? '', status: sub?.status ?? 'Active', notes: sub?.notes ?? '' })
  const amount = Number(v.amount), err: Record<string, string> = {}
  if (v.name.trim().length < 2) err.name = 'Enter the subcontractor or company name.'
  if (v.scope.trim().length < 2) err.scope = 'Describe the scope of work.'
  if (!Number.isInteger(amount) || amount <= 0) err.amount = 'Enter the agreed amount (whole RWF).'
  if (v.start && v.end && v.end < v.start) err.end = 'The end date must not be before the start date.'
  const input = (): SubInput => ({ name: v.name.trim(), scope: v.scope.trim(), agreedAmount: amount, startDate: v.start, endDate: v.end, status: v.status, notes: v.notes.trim() })
  const m = useMutation({ mutationFn: () => (sub ? updateSub(sub.id, input()) : createSub(id, input())), onSuccess: () => { mgmtKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] })); onClose() } })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value })
  const b = (k: string) => (t && err[k] ? 'border-red-400' : 'border-slate-200'), E = ({ k }: { k: string }) => (t && err[k] ? <p className="mt-1 text-xs text-red-600">{err[k]}</p> : null)
  return (<div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label={sub ? 'Edit subcontractor' : 'Add subcontractor'}>
    <form noValidate onSubmit={e => { e.preventDefault(); setT(true); if (!Object.keys(err).length) { m.reset(); setAsk(true) } }} className="max-h-[92vh] w-full max-w-xl space-y-4 overflow-auto rounded-2xl bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{sub ? 'Edit subcontractor' : 'Add subcontractor'}</h2><button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100"><X size={18} /></button></div>
      <div className="grid grid-cols-2 gap-4">
        <label className="col-span-2 block text-sm">Subcontractor / company<input value={v.name} onChange={set('name')} autoFocus className={`${cls} ${b('name')}`} /><E k="name" /></label>
        <label className="col-span-2 block text-sm">Scope of work<input value={v.scope} onChange={set('scope')} className={`${cls} ${b('scope')}`} /><E k="scope" /></label>
        <label className="block text-sm">Agreed amount (RWF)<input type="number" min="0" value={v.amount} onChange={set('amount')} className={`${cls} ${b('amount')}`} /><E k="amount" /></label>
        <label className="block text-sm">Status<select value={v.status} onChange={set('status')} className={`${cls} border-slate-200`}>{STATUS.map(s => <option key={s}>{s}</option>)}</select></label>
        <label className="block text-sm">Start date (optional)<input type="date" value={v.start} onChange={set('start')} className={`${cls} border-slate-200`} /></label>
        <label className="block text-sm">End date (optional)<input type="date" value={v.end} min={v.start || undefined} onChange={set('end')} className={`${cls} ${b('end')}`} /><E k="end" /></label>
        <label className="col-span-2 block text-sm">Notes (optional)<textarea value={v.notes} onChange={set('notes')} rows={2} className={`${cls} border-slate-200`} /></label></div>
      <p className="text-xs text-slate-500">The agreed amount is not counted as spending. Spending is the dated cost records you add under each subcontractor.</p>
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">{sub ? 'Save changes' : 'Add subcontractor'}</button></div>
      {ask && <ConfirmDialog title={sub ? `Save changes to ${sub.name}?` : 'Add this subcontractor?'} confirmLabel={sub ? 'Yes, save changes' : 'Yes, add subcontractor'} busy={m.isPending} error={m.error ? errMsg(m.error) : undefined} onConfirm={() => m.mutate()} onCancel={() => { m.reset(); setAsk(false) }}>{v.name.trim()} · agreed {num(amount)} RWF.</ConfirmDialog>}
    </form></div>)
}
export default function ProjectSubcontractors({ id }: { id: string }) {
  const p = usePeriod(), qc = useQueryClient(), [dlg, setDlg] = useState<Dlg>(null)
  const q = useQuery({ queryKey: ['section', id, 'subcontractors', p], queryFn: () => getSection<{ groups: SubGroup[] }>(id, 'subcontractors', p), enabled: periodReady(p), placeholderData: keepPreviousData })
  const after = () => { mgmtKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] })); setDlg(null) }
  const delSub = useMutation({ mutationFn: (sid: number) => deleteSub(sid), onSuccess: after }), delCost = useMutation({ mutationFn: (cid: number) => deleteSubCost(cid), onSuccess: after })
  const g = q.data?.groups ?? [], sum = (f: (s: SubGroup) => number) => g.reduce((a, s) => a + f(s), 0)
  return (<div className="space-y-5"><div className="flex items-start justify-between gap-4"><PeriodFilter resolved={q.data?.period} />
      <button onClick={() => setDlg({ k: 'sub' })} className="flex shrink-0 items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white"><Plus size={16} />Add Subcontractor</button></div>
    <p className="text-xs text-slate-500">Added and managed by the Admin only. Only the dated cost records count as spending, never the whole agreed amount.</p>
    <div className="grid grid-cols-4 gap-4">{([['Subcontractors', String(g.length)], ['Agreed in total', money(sum(s => s.agreed_amount))], ['Spent in this period', money(sum(s => s.spent_in_period))], ['Spent in total', money(sum(s => s.spent_total))]] as [string, string][]).map(([l, v]) =>
      <div key={l} className="border-l-2 border-brand/40 py-1 pl-4"><p className="text-sm text-slate-500">{l}</p><p className="mt-1 text-xl font-semibold tnum">{v}</p></div>)}</div>
    {q.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{errMsg(q.error)} <button onClick={() => q.refetch()} className="underline">Try again</button></div> : q.isLoading ? <p className="text-sm text-slate-500">Loading…</p>
      : !g.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">No subcontractors yet. Click Add Subcontractor to add the first one.</div>
      : <div className="space-y-4">{g.map(s => <div key={s.id} className="card-shadow rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-3"><h3 className="font-semibold">{s.name}</h3><span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs text-slate-600">{s.status}</span></div>
          <p className="mt-1 text-sm text-slate-500">{s.scope}{(s.start_date || s.end_date) && ` · ${dmy(s.start_date) || '…'} to ${dmy(s.end_date) || '…'}`}</p>{s.notes && <p className="mt-1 text-xs text-slate-500">{s.notes}</p>}</div>
          <div className="space-x-3 text-xs"><button onClick={() => setDlg({ k: 'cost', s })} className="text-brand">Add cost record</button><button onClick={() => setDlg({ k: 'sub', s })} className="text-brand">Edit</button><button onClick={() => { delSub.reset(); setDlg({ k: 'delsub', s }) }} className="text-red-700">Delete</button></div></div>
        <div className="mt-4 grid grid-cols-4 gap-4 text-sm">{([['Agreed', money(s.agreed_amount), ''], ['Spent in this period', money(s.spent_in_period), ''], ['Spent in total', money(s.spent_total), ''], [s.over_agreed ? 'Over the agreed amount by' : 'Remaining', money(Math.abs(s.remaining)), s.over_agreed ? 'text-red-700' : '']] as [string, string, string][]).map(([l, v, c]) =>
          <div key={l}><p className="text-xs text-slate-500">{l}</p><p className={`font-medium tnum ${c}`}>{v}</p></div>)}</div>
        {s.records.length > 0 ? <table className="mt-4 w-full text-xs"><thead className="text-slate-500"><tr>{['Date', 'Description', 'Quantity × rate', 'Amount', ''].map(h => <th key={h} className={`py-1 pr-4 font-medium ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr></thead>
          <tbody>{s.records.map(c => <tr key={c.id} className="border-t border-slate-100"><td className="py-1.5 pr-4">{dmy(c.date)}</td><td className="pr-4">{c.description}{c.notes && <span className="block text-slate-500">{c.notes}</span>}</td><td className="pr-4 text-slate-500">{c.quantity !== null ? `${num(c.quantity)} ${c.unit ?? ''} × ${num(c.rate ?? 0)}` : '–'}</td><td className="pr-4 text-right tnum">{num(c.amount)}</td>
            <td className="space-x-3 text-right"><button onClick={() => setDlg({ k: 'cost', s, c })} className="text-brand">Edit</button><button onClick={() => { delCost.reset(); setDlg({ k: 'delcost', c }) }} className="text-red-700">Delete</button></td></tr>)}</tbody></table>
          : <p className="mt-4 text-xs text-slate-500">No cost records in this period.</p>}</div>)}</div>}
    {dlg?.k === 'sub' && <SubDialog id={id} sub={dlg.s} onClose={() => setDlg(null)} />}
    {dlg?.k === 'cost' && <CostFormDialog title={dlg.c ? 'Edit cost record' : `Add cost record · ${dlg.s.name}`} noun="cost record" save={x => (dlg.c ? updateSubCost(dlg.c.id, { costDate: x.costDate, description: x.description, quantity: x.quantity, unit: x.unit, rate: x.rate, amount: x.amount, notes: x.notes }) : createSubCost(dlg.s.id, { costDate: x.costDate, description: x.description, quantity: x.quantity, unit: x.unit, rate: x.rate, amount: x.amount, notes: x.notes }))}
      initial={dlg.c ? { description: dlg.c.description, costDate: dlg.c.date, quantity: dlg.c.quantity, unit: dlg.c.unit ?? '', rate: dlg.c.rate, amount: dlg.c.amount, notes: dlg.c.notes ?? '' } : undefined} onClose={() => setDlg(null)} />}
    {dlg?.k === 'delsub' && <ConfirmDialog danger title={`Delete ${dlg.s.name}?`} confirmLabel="Yes, delete it" busy={delSub.isPending} error={delSub.error ? errMsg(delSub.error) : undefined} onConfirm={() => delSub.mutate(dlg.s.id)} onCancel={() => setDlg(null)}>This also deletes its cost records ({money(dlg.s.spent_total)} in total), so the project's totals will drop. It cannot be undone.</ConfirmDialog>}
    {dlg?.k === 'delcost' && <ConfirmDialog danger title="Delete this cost record?" confirmLabel="Yes, delete it" busy={delCost.isPending} error={delCost.error ? errMsg(delCost.error) : undefined} onConfirm={() => delCost.mutate(dlg.c.id)} onCancel={() => setDlg(null)}>{dlg.c.description} · {num(dlg.c.amount)} RWF. The project's totals will drop by this amount.</ConfirmDialog>}</div>)
}
