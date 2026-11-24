// DEMO DATA. Value earned = contract value x progress. Projected final cost = spent so far / progress. Estimates, not accounting.
import { _all, type Project } from './projects'
import { _costs, spendCategories } from './costs'
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
export const calc = (p: Project) => {
  const breakdown = spendCategories.map(([slug, label]) => ({ slug, label, total: (_costs[slug] ?? []).filter(c => c.projectId === p.id).reduce((a, c) => a + c.amount, 0) }))
  const spent = breakdown.reduce((a, b) => a + b.total, 0)
  const earned = Math.round((p.contractValue * p.progress) / 100)
  const forecastCost = p.progress > 0 ? Math.round((spent * 100) / p.progress) : null
  return { breakdown, spent, earned, profit: earned - spent, forecastCost, forecastProfit: forecastCost === null ? null : p.contractValue - forecastCost }
}
export const getFinance = async (pid: string) => {
  await wait(250)
  const p = _all.find(x => x.id === pid)
  if (!p) throw new Error('Project not found.')
  return { project: p, ...calc(p) }
}
export const listFinance = async (q: { search: string; page: number; size: number }) => {
  await wait(250)
  const s = q.search.toLowerCase()
  const all = _all.filter(p => !s || `${p.name} ${p.id}`.toLowerCase().includes(s)).map(p => ({ p, ...calc(p) })).sort((a, b) => a.profit - b.profit)
  const sum = (f: (x: (typeof all)[number]) => number) => all.reduce((a, x) => a + f(x), 0)
  return { rows: all.slice((q.page - 1) * q.size, q.page * q.size), total: all.length, totals: { contract: sum(x => x.p.contractValue), spent: sum(x => x.spent), earned: sum(x => x.earned), profit: sum(x => x.profit) } }
}
