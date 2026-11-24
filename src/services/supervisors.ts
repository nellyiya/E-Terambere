// DEMO DATA: replace with api calls. Supervisors who submit reports in the mobile app will come from the same backend users.
import { _all, supervisors as assignable } from './projects'
import { _reports } from './reports'
export interface Supervisor { id: string; name: string; email: string; phone: string; active: boolean }
const mail = (n: string) => n.toLowerCase().replace(/\s+/g, '.') + '@eterambere.demo'
const store: Supervisor[] = ['Eric Mugisha', 'Aline Uwase', 'Jean Bosco', 'Claudine Ineza', 'Samuel Habimana', 'Grace Mukamana'].map((name, i) => ({
  id: `SUP-${String(i + 1).padStart(3, '0')}`, name, email: mail(name), phone: `+25078800${String(100 + i)}`, active: true }))
assignable.push('Samuel Habimana', 'Grace Mukamana')
export interface SQuery { search: string; page: number; size: number }
export const listSupervisors = async (q: SQuery) => {
  await new Promise(r => setTimeout(r, 250))
  const s = q.search.toLowerCase()
  const rows = store.filter(x => !s || `${x.name} ${x.email} ${x.id}`.toLowerCase().includes(s)).map(x => {
    const rep = _reports.filter(r => r.supervisor === x.name)
    return { ...x, projects: _all.filter(p => p.supervisor === x.name).length, reports: rep.length, last: rep.reduce((a, r) => (r.date > a ? r.date : a), '') }
  })
  return { rows: rows.slice((q.page - 1) * q.size, q.page * q.size), total: rows.length }
}
export const createSupervisor = async (d: { name: string; email: string; phone: string }) => {
  await new Promise(r => setTimeout(r, 300))
  if (store.some(x => x.email.toLowerCase() === d.email.trim().toLowerCase())) throw new Error('A supervisor with this email already exists.')
  const s: Supervisor = { id: `SUP-${String(store.length + 1).padStart(3, '0')}`, name: d.name.trim(), email: d.email.trim(), phone: d.phone.trim(), active: true }
  store.push(s); assignable.push(s.name)
  return s
}
export const setSupervisorActive = async (id: string, active: boolean) => {
  await new Promise(r => setTimeout(r, 200))
  const s = store.find(x => x.id === id); if (!s) throw new Error('Supervisor not found.')
  s.active = active
  const i = assignable.indexOf(s.name)
  if (!active && i >= 0) assignable.splice(i, 1)
  if (active && i < 0) assignable.push(s.name)
}

// ---- Supervisor details
export const getSupervisor = async (id: string) => {
  await new Promise(r => setTimeout(r, 200))
  const s = store.find(x => x.id === id)
  if (!s) throw new Error('Supervisor not found.')
  const reports = _reports.filter(r => r.supervisor === s.name).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  return { ...s, projects: _all.filter(p => p.supervisor === s.name), reports }
}
