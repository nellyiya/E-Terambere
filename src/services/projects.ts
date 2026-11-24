// DEMO DATA: replace the bodies below with api.get(...) calls once the backend contract is confirmed.
export type Status = 'Active' | 'Planning' | 'On Hold' | 'Completed'
export interface Project { id: string; name: string; district: string; status: Status; progress: number; sites: number; reports: number; supervisor: string; contractValue: number }
const names = ['Nyabarongo Dam','Kigali Bypass Road','Musanze Water Plant','Rubavu Bridge','Huye Market Hall','Rwamagana School Block','Nyagatare Irrigation','Muhanga Health Centre']
const dist = ['Muhanga','Gasabo','Musanze','Rubavu','Huye','Rwamagana','Nyagatare','Muhanga']
const st: Status[] = ['Active','Active','Planning','Active','On Hold','Completed','Active','Planning']
const sup = ['Eric Mugisha','Aline Uwase','Jean Bosco','Claudine Ineza']
const all: Project[] = Array.from({ length: 48 }, (_, i) => ({
  id: `PRJ-${String(i + 1).padStart(3, '0')}`, name: i < 8 ? names[i] : `${names[i % 8]} Phase ${Math.floor(i / 8) + 1}`,
  district: dist[i % 8], status: st[i % 8], progress: st[i % 8] === 'Completed' ? 100 : (i * 13 + 20) % 95,
  sites: (i % 5) + 1, reports: (i * 7) % 120 + 3, supervisor: sup[i % 4], contractValue: 6_000_000 + ((i * 7) % 15) * 1_000_000 }))
export interface Query { search: string; status: string; page: number; pageSize: number }
export const listProjects = async (q: Query) => {
  await new Promise(r => setTimeout(r, 250))
  const s = q.search.toLowerCase()
  const rows = all.filter(p => (!q.status || p.status === q.status) && (!s || `${p.name} ${p.id} ${p.district}`.toLowerCase().includes(s)))
  return { rows: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: rows.length,
    kpi: { total: all.length, active: all.filter(p => p.status === 'Active').length, completed: all.filter(p => p.status === 'Completed').length,
      avg: Math.round(all.reduce((a, p) => a + p.progress, 0) / all.length) } }
}
export const getProject = async (id: string) => { await new Promise(r => setTimeout(r, 150)); const p = all.find(x => x.id === id); if (!p) throw new Error('Project not found'); return p }
export const _all = all
export const projectOptions = async () => all.map(p => ({ id: p.id, name: p.name, sites: p.sites }))
export const supervisors = sup
export const districts = ['Bugesera','Burera','Gakenke','Gasabo','Gatsibo','Gicumbi','Gisagara','Huye','Kamonyi','Karongi','Kayonza','Kicukiro','Kirehe','Muhanga','Musanze','Ngoma','Ngororero','Nyabihu','Nyagatare','Nyamagabe','Nyamasheke','Nyanza','Nyarugenge','Nyaruguru','Rubavu','Ruhango','Rulindo','Rusizi','Rutsiro','Rwamagana']
export interface NewProject { name: string; district: string; supervisor: string; status: Status; sites: number; contractValue: number }
// DEMO: replace with api.post('/projects', data). The backend must enforce the same rules.
export const createProject = async (d: NewProject) => {
  await new Promise(r => setTimeout(r, 300))
  if (all.some(p => p.name.toLowerCase() === d.name.trim().toLowerCase())) throw new Error('A project with this name already exists.')
  const p: Project = { id: `PRJ-${String(all.length + 1).padStart(3, '0')}`, name: d.name.trim(), district: d.district, status: d.status, progress: 0, sites: d.sites, reports: 0, supervisor: d.supervisor, contractValue: d.contractValue }
  all.push(p)
  return p
}
