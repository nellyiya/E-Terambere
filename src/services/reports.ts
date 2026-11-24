// DEMO DATA: swap for api.get(...) later. Filtering by project/site/date would be done by the backend query.
import { _all } from './projects'
export interface Filters { project: string; site: string; from: string; to: string }
export interface Report { id: string; projectId: string; projectName: string; site: string; date: string; supervisor: string; workers: number; status: 'Approved' | 'Pending' | 'Flagged'; activity: string }
const acts = ['Concrete pouring', 'Excavation', 'Steel fixing', 'Brickwork', 'Roofing', 'Plastering']
const stat: Report['status'][] = ['Approved', 'Approved', 'Pending', 'Flagged']
const reports: Report[] = Array.from({ length: 300 }, (_, i) => {
  const p = _all[i % 48], n = (i % p.sites) + 1
  return { id: `RPT-${String(i + 1).padStart(4, '0')}`, projectId: p.id, projectName: p.name, site: `Site ${n}`, date: `2026-11-${String((i % 12) + 1).padStart(2, '0')}`,
    supervisor: p.supervisor, workers: 5 + (i * 3) % 30, status: stat[i % 4], activity: acts[i % 6] }
})
export const siteOptions = (projectId: string, count: number) => projectId ? Array.from({ length: count }, (_, i) => `Site ${i + 1}`) : []
export const listReports = async (f: Filters, page: number, pageSize: number) => {
  await new Promise(r => setTimeout(r, 250))
  const rows = reports.filter(r => (!f.project || r.projectId === f.project) && (!f.site || r.site === f.site) && (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to))
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, workers: rows.reduce((a, r) => a + r.workers, 0) }
}
export const _reports = reports
