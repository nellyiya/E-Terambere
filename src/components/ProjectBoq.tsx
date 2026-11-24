import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { errMsg } from '../lib/api'
import { boqKeys, createBoqItem, deleteBoqItem, listBoqItems, updateBoqItem, type BoqItem } from '../services/boqApi'
const cls = 'mt-1 w-full rounded-lg border px-3 py-2 text-sm'
const fmt = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)
type Dlg = { kind: 'add' } | { kind: 'edit' | 'delete'; b: BoqItem } | null
function BoqDialog({ id, item, onClose }: { id: string; item?: BoqItem; onClose: () => void }) {
  const qc = useQueryClient()
  const [v, setV] = useState({ description: item?.description ?? '', unit: item?.unit ?? '', rate: item ? String(item.rate) : '', quantity: item?.quantity != null ? String(item.quantity) : '' }), [touched, setTouched] = useState(false)
  const rate = Number(v.rate), qty = v.quantity.trim() === '' ? null : Number(v.quantity), err: Record<string, string> = {}
  if (v.description.trim().length < 2) err.description = 'Describe the work item, for example "Concrete poured".'
  if (!v.unit.trim()) err.unit = 'Enter a unit, for example m³.'
  if (!Number.isInteger(rate) || rate <= 0) err.rate = 'Enter a whole rate above 0 (RWF per unit).'
  if (qty !== null && !(qty >= 0)) err.quantity = 'Quantity must be 0 or more, or empty.'
  const m = useMutation({ mutationFn: () => { const d = { description: v.description.trim(), unit: v.unit.trim(), rate, quantity: qty }; return item ? updateBoqItem(item.id, d) : createBoqItem(id, d) }, onSuccess: () => { boqKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] })); onClose() } })
  const b = (k: string) => (touched && err[k] ? 'border-red-400' : 'border-slate-200')
  const E = ({ k }: { k: string }) => touched && err[k] ? <p className="mt-1 text-xs text-red-600">{err[k]}</p> : null
  return (<div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40" role="dialog" aria-modal="true" aria-label={item ? 'Edit item' : 'Add item'}>
    <form noValidate onSubmit={e => { e.preventDefault(); setTouched(true); if (!Object.keys(err).length) m.mutate() }} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{item ? `Edit item ${item.itemNo}` : 'Add item'}</h2><button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100"><X size={18} /></button></div>
      <label className="block text-sm">Item description<input value={v.description} onChange={e => setV({ ...v, description: e.target.value })} autoFocus className={`${cls} ${b('description')}`} /><E k="description" /></label>
      <div className="grid grid-cols-3 gap-4">
        <label className="block text-sm">Unit<input value={v.unit} onChange={e => setV({ ...v, unit: e.target.value })} placeholder="m³, kg, m²" className={`${cls} ${b('unit')}`} /><E k="unit" /></label>
        <label className="block text-sm">Contract quantity<input type="number" min="0" step="any" value={v.quantity} onChange={e => setV({ ...v, quantity: e.target.value })} placeholder="optional" className={`${cls} ${b('quantity')}`} /><E k="quantity" /></label>
        <label className="block text-sm">Rate (RWF)<input type="number" min="0" value={v.rate} onChange={e => setV({ ...v, rate: e.target.value })} className={`${cls} ${b('rate')}`} /><E k="rate" /></label></div>
      {item && item.reports > 0 && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">This item is already used in {item.reports} report lines. Changing the rate changes the value of work already recorded.</p>}
      {m.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errMsg(m.error)}</p>}
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={m.isPending} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{m.isPending ? 'Saving…' : item ? 'Save changes' : 'Add item'}</button></div>
    </form></div>)
}
export default function ProjectBoq({ id }: { id: string }) {
  const qc = useQueryClient(), [dlg, setDlg] = useState<Dlg>(null)
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['boq-full', id], queryFn: () => listBoqItems(id) })
  const del = useMutation({ mutationFn: (bid: number) => deleteBoqItem(bid), onSuccess: () => { boqKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] })); setDlg(null) } })
  return (<div className="space-y-5">
    <div className="flex items-center justify-between gap-3"><p className="text-sm text-slate-500">The work items of this project. Supervisors' reports record quantities done against them, which fills the Work Done table and the project's progress.</p>
      <button onClick={() => setDlg({ kind: 'add' })} className="flex shrink-0 items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white"><Plus size={16} />Add Item</button></div>
    {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{errMsg(error)} <button onClick={() => refetch()} className="underline">Try again</button></div>
      : isLoading ? <p className="text-sm text-slate-500">Loading items…</p>
      : !data?.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">No items yet. Click Add Item to enter the first line of this project's bill of quantities.</div>
      : <table className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Item No', 'Item Description', 'Unit', 'Contract qty', 'Rate (RWF)', 'Done qty', 'Done (RWF)', 'Progress', ''].map(h => <th key={h} className={`px-4 py-3 font-medium ${['Contract qty', 'Rate (RWF)', 'Done qty', 'Done (RWF)'].includes(h) ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
        <tbody>{data.map(b => <tr key={b.id} className="border-t border-slate-100"><td className="px-4 py-3">{b.itemNo}</td><td className="px-4 py-3">{b.description}</td><td className="px-4 py-3">{b.unit}</td><td className="px-4 py-3 text-right">{b.quantity != null ? fmt(b.quantity) : '–'}</td><td className="px-4 py-3 text-right">{fmt(b.rate)}</td><td className="px-4 py-3 text-right">{fmt(b.quantityDone)}</td><td className="px-4 py-3 text-right">{fmt(b.amountDone)}</td>
          <td className="px-4 py-3">{b.quantity ? `${Math.min(100, Math.round((b.quantityDone / b.quantity) * 100))}%` : '–'}</td>
          <td className="space-x-3 px-4 py-3 text-right text-xs"><button onClick={() => setDlg({ kind: 'edit', b })} className="text-brand">Edit</button><button onClick={() => { del.reset(); setDlg({ kind: 'delete', b }) }} className="text-red-700">Delete</button></td></tr>)}</tbody></table>}
    {dlg?.kind === 'add' && <BoqDialog id={id} onClose={() => setDlg(null)} />}
    {dlg?.kind === 'edit' && <BoqDialog id={id} item={dlg.b} onClose={() => setDlg(null)} />}
    {dlg?.kind === 'delete' && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40" role="alertdialog" aria-modal="true" aria-label="Delete item"><div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
      <h2 className="text-lg font-semibold">Delete item {dlg.b.itemNo}?</h2><p className="text-sm text-slate-600">{dlg.b.description}. Items already used in reports can't be deleted. This cannot be undone.</p>
      {del.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errMsg(del.error)}</p>}
      <div className="flex justify-end gap-2"><button onClick={() => setDlg(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={del.isPending} onClick={() => del.mutate(dlg.b.id)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{del.isPending ? 'Deleting…' : 'Delete item'}</button></div></div></div>}
  </div>)
}
