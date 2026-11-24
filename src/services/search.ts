// DEMO DATA: backend equivalent = GET /search?q= returning a few matches per type, scoped to what Admin may see.
import { _all } from './projects'
import { _reports } from './reports'
import { listSupervisors } from './supervisors'
export interface Hit { key: string; group: string; title: string; sub: string; to: string }
export const globalSearch = async (term: string): Promise<Hit[]> => {
  await new Promise(r => setTimeout(r, 150))
  const t = term.trim().toLowerCase(), has = (s: string) => s.toLowerCase().includes(t)
  const projects = _all.filter(p => has(`${p.name} ${p.id} ${p.district}`)).slice(0, 4).map(p => ({ key: p.id, group: 'Projects', title: p.name, sub: `${p.id} · ${p.district}`, to: `/projects/${p.id}/overview` }))
  const sups = (await listSupervisors({ search: term, page: 1, size: 4 })).rows.map(s => ({ key: s.id, group: 'Supervisors', title: s.name, sub: s.email, to: `/supervisors?q=${encodeURIComponent(s.name)}` }))
  const reports = _reports.filter(r => has(`${r.id} ${r.projectName} ${r.activity} ${r.supervisor}`)).slice(0, 4).map(r => ({ key: r.id, group: 'Reports', title: `${r.id} · ${r.activity}`, sub: `${r.projectName} · ${r.date}`, to: `/projects/${r.projectId}/reports` }))
  return [...projects, ...sups, ...reports]
}
