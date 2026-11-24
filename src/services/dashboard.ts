// DEMO DATA: backend equivalent would be one aggregate endpoint (SQL totals), never client-side math over full lists.
import { _all } from './projects'
import { _reports } from './reports'
import { _costs, spendCategories } from './costs'
export const getDashboard = async () => {
  await new Promise(r => setTimeout(r, 250))
  const perDay: Record<string, number> = {}
  _reports.forEach(r => (perDay[r.date] = (perDay[r.date] ?? 0) + 1))
  const costByCategory = spendCategories.map(([s, l]) => ({ name: l.replace(' Cost', ''), amount: (_costs[s] ?? []).reduce((a, c) => a + c.amount, 0) }))
  const flagged: Record<string, { name: string; id: string; n: number }> = {}
  _reports.filter(r => r.status === 'Flagged').forEach(r => { const f = (flagged[r.projectId] ??= { name: r.projectName, id: r.projectId, n: 0 }); f.n++ })
  const statuses = ['Active', 'Planning', 'On Hold', 'Completed'].map(s => ({ status: s, count: _all.filter(p => p.status === s).length }))
  return {
    kpi: { projects: _all.length, active: _all.filter(p => p.status === 'Active').length, completed: _all.filter(p => p.status === 'Completed').length, avg: Math.round(_all.reduce((a, p) => a + p.progress, 0) / _all.length), reports: _reports.length, pending: _reports.filter(r => r.status === 'Pending').length,
      workers: _reports.reduce((a, r) => a + r.workers, 0), cost: costByCategory.reduce((a, c) => a + c.amount, 0) },
    reportsPerDay: Object.entries(perDay).sort().map(([d, n]) => ({ date: d.slice(5), reports: n })), costByCategory, statuses,
    active: _all.filter(p => p.status === 'Active').slice(0, 4),
    attention: Object.values(flagged).sort((a, b) => b.n - a.n).slice(0, 5),
    recent: [..._reports].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 6) }
}
