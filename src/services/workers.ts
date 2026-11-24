// DEMO DATA: attendance and wages will come from supervisors' daily reports. E-terambere only records wages; it does not pay them.
import { _all } from './projects'
import type { Filters } from './reports'
const first = ['Jean Paul', 'Aline', 'Eric', 'Diane', 'Patrick', 'Claire', 'Olivier', 'Beatrice', 'Emmanuel', 'Vestine', 'Innocent', 'Solange']
const last = ['Mugabo', 'Uwimana', 'Niyonzima', 'Habimana', 'Ishimwe', 'Mukamana', 'Nsengiyumva', 'Uwase']
const roles: [string, number][] = [['Mason', 7000], ['Carpenter', 7500], ['Steel fixer', 8000], ['Operator', 10000], ['Laborer', 5000], ['Electrician', 9000]]
export interface Worker { id: string; name: string; role: string; rate: number; projectId: string; projectName: string; site: string; dates: string[] }
const days = Array.from({ length: 12 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`)
export const _workers: Worker[] = _all.flatMap((p, pi) => Array.from({ length: 6 }, (_, i) => {
  const k = pi * 6 + i, [role, rate] = roles[(i + pi) % 6]
  return { id: `WRK-${String(k + 1).padStart(4, '0')}`, name: `${first[k % 12]} ${last[(k * 3) % 8]}`, role, rate, projectId: p.id, projectName: p.name,
    site: `Site ${(i % p.sites) + 1}`, dates: days.filter((_, d) => (pi + i + d) % 3 !== 0) }
}))
export const tally = (w: Worker, f: Pick<Filters, 'from' | 'to'>) => {
  const n = w.dates.filter(d => (!f.from || d >= f.from) && (!f.to || d <= f.to)).length
  return { days: n, wages: n * w.rate }
}
export const listWorkers = async (f: Filters, search: string, page: number, size: number) => {
  await new Promise(r => setTimeout(r, 250))
  const s = search.toLowerCase()
  const all = _workers.filter(w => (!f.project || w.projectId === f.project) && (!f.site || w.site === f.site) && (!s || `${w.name} ${w.role} ${w.id}`.toLowerCase().includes(s))).map(w => ({ ...w, ...tally(w, f) }))
  return { rows: all.slice((page - 1) * size, page * size), total: all.length, days: all.reduce((a, w) => a + w.days, 0), wages: all.reduce((a, w) => a + w.wages, 0) }
}
