import { Fragment, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
export const num = (x: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(x)
export const money = (x: number | null) => (x === null ? 'Not recorded' : `${num(x)} RWF`)
export interface Col<T> { h: string; cell: (g: T) => ReactNode; right?: boolean }
// A table whose rows open to show how the figure was calculated and every record behind it.
export function GroupTable<T extends { calc: string; records: unknown[] }>({ groups, idOf, cols, recHead, recRow, actions, empty }: {
  groups: T[]; idOf: (g: T) => string | number; cols: Col<T>[]; recHead: string[]; recRow: (r: T['records'][number]) => ReactNode[]; actions?: (g: T) => ReactNode; empty: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  if (!groups.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">{empty}</div>
  return (<table className="card-shadow w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-10" />{cols.map(c => <th key={c.h} className={`px-4 py-3 font-medium ${c.right ? 'text-right' : ''}`}>{c.h}</th>)}{actions && <th />}</tr></thead>
    <tbody>{groups.map(g => { const id = String(idOf(g)), o = !!open[id]; return (<Fragment key={id}>
      <tr onClick={() => setOpen({ ...open, [id]: !o })} className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50">
        <td className="pl-3"><button aria-expanded={o} aria-label={o ? 'Hide records' : 'Show records'} className="text-slate-400">{o ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button></td>
        {cols.map(c => <td key={c.h} className={`px-4 py-3 ${c.right ? 'text-right tnum' : ''}`}>{c.cell(g)}</td>)}{actions && <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>{actions(g)}</td>}</tr>
      {o && <tr className="bg-slate-50"><td colSpan={cols.length + 2} className="px-6 py-4"><p className="mb-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-600"><b className="text-ink">How this was calculated: </b>{g.calc}</p>
        <table className="w-full text-xs"><thead className="text-slate-500"><tr>{recHead.map(h => <th key={h} className="py-1 pr-4 text-left font-medium">{h}</th>)}</tr></thead>
          <tbody>{g.records.map((r, i) => <tr key={i} className="border-t border-slate-200">{recRow(r).map((v, j) => <td key={j} className="py-1.5 pr-4">{v}</td>)}</tr>)}</tbody></table></td></tr>}</Fragment>) })}</tbody></table>)
}
