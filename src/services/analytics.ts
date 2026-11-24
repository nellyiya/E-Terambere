// DEMO DATA: backend equivalent = aggregate endpoints taking project/site/date filters, computed in SQL.
import { _reports, type Filters } from './reports'
import { _costs, spendCategories } from './costs'
import { _workers } from './workers'
const inRange = (d: string, f: Filters) => (!f.from || d >= f.from) && (!f.to || d <= f.to)
const match = (r: { projectId: string; site: string }, f: Filters) => (!f.project || r.projectId === f.project) && (!f.site || r.site === f.site)
export const getAnalytics = async (f: Filters) => {
  await new Promise(r => setTimeout(r, 300))
  const reports = _reports.filter(r => match(r, f) && inRange(r.date, f))
  const costRows = spendCategories.flatMap(([s, l]) => (_costs[s] ?? []).filter(c => match(c, f) && inRange(c.date, f)).map(c => ({ ...c, cat: l })))
  const sumBy = <T,>(rows: T[], key: (r: T) => string, val: (r: T) => number) => { const m: Record<string, number> = {}; rows.forEach(r => (m[key(r)] = (m[key(r)] ?? 0) + val(r))); return m }
  const perDay = sumBy(costRows, c => c.date, c => c.amount)
  const attend: Record<string, number> = {}
  _workers.filter(w => match(w, f)).forEach(w => w.dates.filter(d => inRange(d, f)).forEach(d => (attend[d] = (attend[d] ?? 0) + 1)))
  const byProject: Record<string, { name: string; amount: number }> = {}
  costRows.forEach(c => { (byProject[c.projectId] ??= { name: c.projectName, amount: 0 }).amount += c.amount })
  const total = costRows.reduce((a, c) => a + c.amount, 0)
  return {
    kpi: { total, reports: reports.length, workerDays: Object.values(attend).reduce((a, n) => a + n, 0), avgPerReport: reports.length ? Math.round(reports.reduce((a, r) => a + r.workers, 0) / reports.length) : 0 },
    costPerDay: Object.entries(perDay).sort().map(([d, amount]) => ({ date: d.slice(5), amount })),
    costByCategory: Object.entries(sumBy(costRows, c => c.cat, c => c.amount)).map(([name, amount]) => ({ name: name.replace(' Cost', ''), amount })),
    attendance: Object.entries(attend).sort().map(([d, workers]) => ({ date: d.slice(5), workers })),
    activities: Object.entries(sumBy(reports, r => r.activity, () => 1)).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    topProjects: Object.entries(byProject).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.amount - a.amount).slice(0, 5) }
}
