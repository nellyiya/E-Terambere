import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { projectOptions } from '../services/projects'
import type { Filters } from '../services/reports'
import { getFilterData } from '../services/reportsApi'
import { useOutside } from './useOutside'
type Cell = string | number
interface Props { title: string; file: string; f: Filters; columns: string[]; getRows: () => Promise<Cell[][]> }
// Quote cells; prefix risky text so Excel never runs it as a formula.
const cell = (v: Cell) => { let s = String(v); if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const save = (blob: Blob, name: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) }
export default function ExportMenu({ title, file, f, columns, getRows }: Props) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(''), [err, setErr] = useState('')
  const ref = useOutside<HTMLDivElement>(() => setOpen(false))
  const { data: projects = [] } = useQuery({ queryKey: ['project-options'], queryFn: projectOptions })
  const { data: realProjects } = useQuery({ queryKey: ['filter-data'], queryFn: getFilterData, retry: false })
  const run = async (kind: 'csv' | 'pdf') => {
    setBusy(kind); setErr('')
    try {
      const rows = await getRows()
      if (!rows.length) { setErr('Nothing to export for these filters.'); return }
      const day = new Date().toISOString().slice(0, 10), name = `${file}-${day}`
      if (kind === 'csv') { save(new Blob(['\ufeff' + [columns, ...rows].map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${name}.csv`) }
      else {
        const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
        const proj = [...(realProjects?.projects ?? []), ...projects].find(p => p.id === f.project)
        const summary = [`Project: ${proj ? `${proj.id} ${proj.name}` : 'All projects'}`, `Site: ${f.site || 'All sites'}`, `Dates: ${f.from || 'start'} to ${f.to || 'latest'}`, `${rows.length} records`, `Generated ${day}`].join('   |   ')
        doc.setFontSize(16); doc.text(title, 40, 40); doc.setFontSize(9); doc.setTextColor(110); doc.text(summary, 40, 58)
        autoTable(doc, { head: [columns], body: rows.map(r => r.map(String)), startY: 72, margin: { left: 40, right: 40 }, styles: { fontSize: 8 }, headStyles: { fillColor: [3, 67, 55] } })
        const n = doc.getNumberOfPages()
        for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.text(`E-terambere Admin  -  Page ${i} of ${n}`, 40, doc.internal.pageSize.getHeight() - 20) }
        doc.save(`${name}.pdf`)
      }
      setOpen(false)
    } catch { setErr('Export failed. Please try again.') } finally { setBusy('') }
  }
  return (<div ref={ref} className="relative">
    <button onClick={() => { setOpen(!open); setErr('') }} aria-expanded={open} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm transition hover:border-brand hover:shadow-md"><Download size={16} />Export</button>
    {open && <div className="absolute right-0 top-11 z-30 w-56 rounded-2xl border border-slate-200 bg-white p-1 shadow-lg">
      {(['csv', 'pdf'] as const).map(k => <button key={k} disabled={!!busy} onClick={() => run(k)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 disabled:opacity-50">{busy === k ? 'Preparing…' : k === 'csv' ? 'Excel / CSV (.csv)' : 'PDF document (.pdf)'}</button>)}
      <p className="px-3 pb-2 pt-1 text-xs text-slate-500">Exports every record matching your current filters.</p>
      {err && <p className="px-3 pb-2 text-xs text-red-700">{err}</p>}</div>}
  </div>)
}
