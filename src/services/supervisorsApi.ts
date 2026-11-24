import { api } from '../lib/api'
export interface Supervisor { id: number; code: string; name: string; email: string; phone: string; active: boolean; projects: number; reports: number; lastReport: string | null }
interface Raw { id: number; code: string; name: string; email: string; phone: string; active: boolean; projects: number; reports: number; last_report: string | null }
const map = (r: Raw): Supervisor => ({ id: r.id, code: r.code, name: r.name, email: r.email, phone: r.phone, active: r.active, projects: r.projects, reports: r.reports, lastReport: r.last_report })
export const listSupervisors = async (q: { search: string; page: number; size: number }) => {
  const { data } = await api.get('/supervisors', { params: { search: q.search || undefined, page: q.page, size: q.size } })
  return { rows: (data.items as Raw[]).map(map), total: data.total as number }
}
export interface SupervisorDetail extends Supervisor {
  projectList: { id: string; name: string; district: string; status: string; progress: number; financial_progress: number }[]
  reportList: { id: string; date: string; project_name: string; site: string; activity: string; status: string }[]
}
export const getSupervisor = async (id: string | number): Promise<SupervisorDetail> => {
  const { data } = await api.get(`/supervisors/${id}`)
  return { ...map(data), projectList: data.project_list, reportList: data.report_list }
}
export interface SupervisorInput { name: string; email: string; phone: string; password?: string }
export const createSupervisor = async (d: SupervisorInput) => map((await api.post('/supervisors', d)).data)
export const updateSupervisor = async (id: number, d: SupervisorInput) => map((await api.put(`/supervisors/${id}`, d)).data)
export const setSupervisorActive = async (id: number, active: boolean) => map((await api.patch(`/supervisors/${id}/active`, { active })).data)
export const deleteSupervisor = async (id: number) => { await api.delete(`/supervisors/${id}`) }
