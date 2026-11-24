// DEMO: replace with api.put('/projects/{id}') and api.delete('/projects/{id}'). The backend must enforce these same rules.
import { _all, type NewProject } from './projects'
import { _reports } from './reports'
import { _costs } from './costs'
import { _workers } from './workers'
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const find = (id: string) => { const p = _all.find(x => x.id === id); if (!p) throw new Error('Project not found.'); return p }
export const updateProject = async (id: string, d: NewProject) => {
  await wait(300)
  const p = find(id)
  if (_all.some(x => x.id !== id && x.name.toLowerCase() === d.name.trim().toLowerCase())) throw new Error('A project with this name already exists.')
  const maxSite = Math.max(0, ...p.id ? _reports.filter(r => r.projectId === id).map(r => Number(r.site.replace('Site ', ''))) : [])
  if (d.sites < maxSite) throw new Error(`Reports already exist for Site ${maxSite}. Keep at least ${maxSite} sites.`)
  Object.assign(p, { name: d.name.trim(), district: d.district, supervisor: d.supervisor, status: d.status, sites: d.sites, contractValue: d.contractValue })
  return p
}
export const deleteProject = async (id: string) => {
  await wait(300)
  const p = find(id)
  const n = _reports.filter(r => r.projectId === id).length
  if (n > 0) throw new Error(`This project has ${n} daily reports, so it can't be deleted. Set its status to Completed or On Hold instead.`)
  for (let i = _workers.length - 1; i >= 0; i--) if (_workers[i].projectId === id) _workers.splice(i, 1)
  Object.values(_costs).forEach(rows => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].projectId === id) rows.splice(i, 1) })
  _all.splice(_all.indexOf(p), 1)
}
