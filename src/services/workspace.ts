// DEMO DATA: one call per project. The backend equivalent would be GET /projects/{id}/workspace (scoped by project id).
import { _reports } from './reports'
import { _costs, categories } from './costs'
export const getWorkspaceData = async (pid: string) => {
  await new Promise(r => setTimeout(r, 200))
  const reports = _reports.filter(r => r.projectId === pid)
  const bySite: Record<string, { site: string; reports: number; workers: number; last: string }> = {}
  reports.forEach(r => { const s = (bySite[r.site] ??= { site: r.site, reports: 0, workers: 0, last: '' }); s.reports++; s.workers += r.workers; if (r.date > s.last) s.last = r.date })
  const costs = categories.map(([slug, label]) => { const rows = (_costs[slug] ?? []).filter(c => c.projectId === pid); return { slug, label, count: rows.length, total: rows.reduce((a, c) => a + c.amount, 0) } })
  return { reports, sites: Object.values(bySite).sort((a, b) => a.site.localeCompare(b.site)), costs }
}
