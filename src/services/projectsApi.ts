import { api } from '../lib/api'
export { districts } from './projects'
// Everything a change to a project (dates, contract value, name, supervisors, deletion) can affect. Used to refresh every screen after the change.
export const projectChangedKeys = ['projects', 'project', 'project-options', 'supervisor-options', 'filter-data', 'sites', 'supervisors', 'supervisor', 'reports', 'report', 'project-reports',
  'management', 'section', 'finance', 'finance-list', 'dashboard', 'analytics', 'work-done', 'progress', 'boq-full']
export type Status = 'Planning' | 'Active' | 'On Hold' | 'Completed'
export interface Project { id: string; name: string; projectType: string; client: string; consultant: string; location: string; startDate: string | null; endDate: string | null; durationDays: number | null; status: Status; progress: number; financialProgress: number; spent: number; sites: number; reports: number; supervisor: string; supervisorId: number | null; supervisors: { id: number; name: string }[]; contractValue: number }
interface Raw { id: string; name: string; project_type: string | null; client: string | null; consultant: string | null; location: string; start_date: string | null; end_date: string | null; duration_days: number | null; financial_progress: number; spent: number; status: Status; contract_value: number; progress: number; sites: number; reports: number; supervisor: { id: number; name: string } | null; supervisors: { id: number; name: string }[] }
const map = (r: Raw): Project => ({ id: r.id, name: r.name, projectType: r.project_type ?? '', client: r.client ?? '', consultant: r.consultant ?? '', location: r.location, startDate: r.start_date, endDate: r.end_date, durationDays: r.duration_days, financialProgress: r.financial_progress, spent: r.spent, status: r.status, progress: r.progress, sites: r.sites, reports: r.reports, supervisor: r.supervisor?.name ?? '', supervisorId: r.supervisor?.id ?? null, supervisors: r.supervisors ?? [], contractValue: r.contract_value })
export interface Query { search: string; status: string; page: number; pageSize: number }
export const listProjects = async (q: Query) => {
  const { data } = await api.get('/projects', { params: { search: q.search || undefined, status: q.status || undefined, page: q.page, size: q.pageSize } })
  return { rows: (data.items as Raw[]).map(map), total: data.total as number }
}
export const getProject = async (code: string) => map((await api.get(`/projects/${code}`)).data)
export interface ProjectInput { name: string; projectType: string; client: string; consultant: string; location: string; startDate: string; endDate: string; status: Status; supervisorIds: number[]; sites: number; contractValue: number }
const body = (d: ProjectInput) => ({ name: d.name, project_type: d.projectType, client: d.client, consultant: d.consultant || null, location: d.location, start_date: d.startDate, end_date: d.endDate, status: d.status, supervisor_ids: d.supervisorIds, sites: d.sites, contract_value: d.contractValue })
export const createProject = async (d: ProjectInput) => map((await api.post('/projects', body(d))).data)
export const updateProject = async (code: string, d: ProjectInput) => map((await api.put(`/projects/${code}`, body(d))).data)
export const deleteProject = async (code: string) => { await api.delete(`/projects/${code}`) }
export const getSupervisorOptions = async () => (await api.get('/filters')).data.supervisors as { id: number; name: string }[]
export const listSites = async (code: string) => (await api.get(`/projects/${code}/sites`)).data as { name: string; reports: number; last_report: string | null }[]
export interface ReportRow { id: string; date: string; site: string; supervisor: string | null; activity: string; status: string }
export const listProjectReports = async (code: string, page: number, size: number) => {
  const { data } = await api.get('/reports', { params: { project: code, page, size } })
  return { rows: data.items as ReportRow[], total: data.total as number }
}
// Duration is always calculated from the two dates; nobody types it.
export const daysBetween = (start: string, end: string) => Math.round((Date.parse(end) - Date.parse(start)) / 864e5)
export const durationText = (days: number | null) => (days === null || !(days > 0) ? '–' : `${new Intl.NumberFormat('en-US').format(days)} days (about ${(days / 30.44).toFixed(1)} months)`)
export const dateText = (iso: string | null) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '–')
