import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import { num } from './GroupTable'
import { errMsg } from '../lib/api'
import { mgmtKeys, type CostInput } from '../services/managementApi'
const cls = 'mt-1 w-full rounded-lg border px-3 py-2 text-sm'
const CATS = ['Transport', 'Fuel', 'Permits and fees', 'Safety', 'Site office', 'Other']
// One form for a dated cost, used for Other Costs and for a subcontractor's cost records. Amount = quantity x rate when both are given.
export default function CostFormDialog({ title, noun, initial, withCategory, sites, save, onClose }: { title: string; noun: string; initial?: Partial<CostInput>; withCategory?: boolean; sites?: string[]; save: (d: CostInput) => Promise<unknown>; onClose: () => void }) {
  const qc = useQueryClient()
  const [v, setV] = useState({ category: initial?.category ?? '', description: initial?.description ?? '', date: initial?.costDate ?? new Date().toISOString().slice(0, 10), qty: initial?.quantity != null ? String(initial.quantity) : '', unit: initial?.unit ?? '',
    rate: initial?.rate != null ? String(initial.rate) : '', amount: initial?.amount != null ? String(initial.amount) : '', notes: initial?.notes ?? '', site: initial?.site ?? '' })
  const [touched, setTouched] = useState(false), [ask, setAsk] = useState(false)
  const hasQ = v.qty.trim() !== '', hasR = v.rate.trim() !== '', q = Number(v.qty), r = Number(v.rate), a = Number(v.amount), calc = hasQ && hasR && q > 0 && r > 0 ? Math.round(q * r) : null
  const err: Record<string, string> = {}
  if (withCategory && v.category.trim().length < 2) err.category = 'Enter or choose a category.'
  if (v.description.trim().length < 2) err.description = 'Describe the cost.'
  if (!v.date || v.date > new Date(Date.now() + 864e5).toISOString().slice(0, 10)) err.date = 'Enter a date that is not in the future.'
  if (hasQ !== hasR) err.qty = 'Enter both a quantity and a rate, or neither.'
  else if (hasQ && (!(q > 0) || !(r > 0) || !Number.isInteger(r))) err.qty = 'Quantity and rate must be above 0 (rate in whole RWF).'
  else if (hasQ && !v.unit.trim()) err.unit = 'Enter the unit, for example m³ or trips.'
  if (!hasQ && !hasR && (!Number.isInteger(a) || a <= 0)) err.amount = 'Enter the amount (whole RWF), or a quantity and a rate.'
  const build = (): CostInput => ({ category: v.category.trim(), description: v.description.trim(), costDate: v.date, quantity: hasQ ? q : null, unit: v.unit.trim(), rate: hasR ? r : null, amount: hasQ ? null : a, notes: v.notes.trim(), site: v.site })
  const m = useMutation({ mutationFn: () => save(build()), onSuccess: () => { mgmtKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] })); onClose() } })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value })
  const b = (k: string) => (touched && err[k] ? 'border-red-400' : 'border-slate-200'), E = ({ k }: { k: string }) => (touched && err[k] ? <p className="mt-1 text-xs text-red-600">{err[k]}</p> : null)
  return (<div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
    <form noValidate onSubmit={e => { e.preventDefault(); setTouched(true); if (!Object.keys(err).length) { m.reset(); setAsk(true) } }} className="max-h-[92vh] w-full max-w-xl space-y-4 overflow-auto rounded-2xl bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100"><X size={18} /></button></div>
      <datalist id="cost-cats">{CATS.map(c => <option key={c} value={c} />)}</datalist>
      <div className="grid grid-cols-2 gap-4">
        {withCategory && <label className="block text-sm">Category<input list="cost-cats" value={v.category} onChange={set('category')} placeholder="Choose or type" className={`${cls} ${b('category')}`} /><E k="category" /></label>}
        <label className={`block text-sm ${withCategory ? '' : 'col-span-2'}`}>Date<input type="date" value={v.date} onChange={set('date')} className={`${cls} ${b('date')}`} /><E k="date" /></label>
        <label className="col-span-2 block text-sm">Description<input value={v.description} onChange={set('description')} className={`${cls} ${b('description')}`} /><E k="description" /></label>
        <label className="block text-sm">Quantity (optional)<input type="number" min="0" step="any" value={v.qty} onChange={set('qty')} className={`${cls} ${b('qty')}`} /><E k="qty" /></label>
        <label className="block text-sm">Unit<input value={v.unit} onChange={set('unit')} placeholder="m³, trips, days…" className={`${cls} ${b('unit')}`} /><E k="unit" /></label>
        <label className="block text-sm">Rate (RWF, optional)<input type="number" min="0" value={v.rate} onChange={set('rate')} className={`${cls} border-slate-200`} /></label>
        <label className="block text-sm">Amount (RWF)<input type="number" min="0" value={calc !== null ? String(calc) : v.amount} disabled={hasQ || hasR} onChange={set('amount')} className={`${cls} ${b('amount')} disabled:opacity-60`} /><E k="amount" />{calc !== null && <span className="mt-1 block text-xs text-slate-500">{num(q)} × {num(r)} = {num(calc)} RWF, calculated for you.</span>}</label>
        {sites && <label className="block text-sm">Site (optional)<select value={v.site} onChange={set('site')} className={`${cls} border-slate-200`}><option value="">Whole project</option>{sites.map(s => <option key={s}>{s}</option>)}</select></label>}
        <label className="col-span-2 block text-sm">Notes (optional)<textarea value={v.notes} onChange={set('notes')} rows={2} className={`${cls} border-slate-200`} /></label></div>
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">{initial ? 'Save changes' : `Add ${noun}`}</button></div>
      {ask && <ConfirmDialog title={initial ? `Save changes to this ${noun}?` : `Add this ${noun}?`} confirmLabel={initial ? 'Yes, save changes' : `Yes, add ${noun}`} busy={m.isPending} error={m.error ? errMsg(m.error) : undefined} onConfirm={() => m.mutate()} onCancel={() => { m.reset(); setAsk(false) }}>
        {v.description.trim()}: {num(calc ?? a)} RWF on {v.date}. It changes the project's totals.</ConfirmDialog>}
    </form></div>)
}
