// DEMO DATA: in production, Material/Equipment/Labor/Work Done are derived from supervisor daily reports on the backend.
import { _all } from './projects'
import type { Filters } from './reports'
export const categories = [['work-done', 'Work Done'], ['expenses', 'Expenses'], ['material', 'Material Cost'], ['equipment', 'Equipment Cost'], ['labor', 'Labor Cost'], ['subcontractor', 'Subcontractor'], ['other', 'Other Costs']] as const
const items: Record<string, [string, string][]> = {
  'work-done': [['Concrete poured', 'm³'], ['Excavation', 'm³'], ['Brickwork', 'm²']], expenses: [['Site transport', 'trip'], ['Permits', 'item'], ['Site office', 'item']],
  material: [['Cement', 'bags'], ['Steel bars', 'kg'], ['Sand', 'tons'], ['Bricks', 'pcs']], equipment: [['Excavator hire', 'hrs'], ['Fuel', 'litres'], ['Concrete mixer', 'hrs']],
  labor: [['Skilled labor wages', 'workers'], ['Casual labor wages', 'workers']], subcontractor: [['Electrical works', 'job'], ['Plumbing works', 'job']], other: [['Safety gear', 'item'], ['Miscellaneous', 'item']] }
export interface Cost { id: string; date: string; projectId: string; projectName: string; site: string; item: string; qty: number; unit: string; itemNo: number; rate: number; amount: number }
const data: Record<string, Cost[]> = {}
categories.forEach(([slug], c) => {
  data[slug] = Array.from({ length: 240 }, (_, i) => {
    const p = _all[(i * 5 + c) % 48], [item, unit] = items[slug][i % items[slug].length], qty = 3 + (i * 7 + c) % 40, rate = 4000 + ((i * 37 + c * 11) % 30) * 1500
    return { id: `${slug.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(4, '0')}`, date: `2026-11-${String((i % 12) + 1).padStart(2, '0')}`, projectId: p.id, projectName: p.name,
      site: `Site ${(i % p.sites) + 1}`, item, qty, unit, itemNo: 0, rate, amount: qty * rate }
  })
})
export const listCosts = async (slug: string, f: Filters, page: number, size: number) => {
  await new Promise(r => setTimeout(r, 250))
  const rows = (data[slug] ?? []).filter(r => (!f.project || r.projectId === f.project) && (!f.site || r.site === f.site) && (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to)).sort((a, b) => a.projectId.localeCompare(b.projectId) || a.itemNo - b.itemNo)
  const byDay: Record<string, number> = {}
  rows.forEach(r => (byDay[r.date] = (byDay[r.date] ?? 0) + r.amount))
  return { rows: rows.slice((page - 1) * size, page * size), total: rows.length, sum: rows.reduce((a, r) => a + r.amount, 0),
    byDay: Object.entries(byDay).sort().map(([date, amount]) => ({ date: date.slice(5), amount })) }
}
export const rwf = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n) + ' RWF'
export const _costs = data
// Money going out. "Work Done" is excluded so it is never added to spending.
export const spendCategories = categories.filter(([s]) => s !== 'work-done')
// Item numbers run 1, 2, 3... within each project, like a bill of quantities.
Object.values(data).forEach(rows => { const seen: Record<string, number> = {}; rows.forEach(r => { r.itemNo = seen[r.projectId] = (seen[r.projectId] ?? 0) + 1 }) })
