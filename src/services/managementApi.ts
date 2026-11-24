import { api } from '../lib/api'
export type PeriodKey = 'all' | 'this_week' | 'this_month' | 'last_month' | 'last_2_months' | 'custom'
export interface Period { key: PeriodKey; from: string; to: string }
export interface Resolved { key: PeriodKey; from: string | null; to: string | null }
export const periodReady = (p: Period) => p.key !== 'custom' || (!!p.from && !!p.to && p.from <= p.to)
const pq = (p: Period) => ({ period: p.key, date_from: p.key === 'custom' ? p.from : undefined, date_to: p.key === 'custom' ? p.to : undefined })
// everything that changes when a report is reviewed or a cost is entered
export const mgmtKeys = ['management', 'section', 'finance', 'finance-list', 'dashboard', 'analytics', 'work-done', 'progress', 'project', 'projects', 'boq-full']
export interface MRow { item_no: number; key: string; description: string; unit: string; quantity: number; rate: number | null; rate_varies: boolean; amount: number | null; note: string | null }
export const getManagement = async (code: string, p: Period) => (await api.get(`/projects/${code}/management`, { params: pq(p) })).data as { period: Resolved; rows: MRow[]; total: number; incomplete: boolean }
export const getSection = async <T,>(code: string, section: string, p: Period) => (await api.get(`/projects/${code}/management/${section}`, { params: pq(p) })).data as { period: Resolved } & T
export interface EquipRec { date: string; report: string; site: string; hours: number; trips: number; fuel_received: number; fuel_used: number; fuel_balance: number; details: string | null; amount: number | null }
export interface EquipGroup { key: string; name: string; days_used: number; reports: number; hours: number; trips: number; fuel_received: number; fuel_used: number; fuel_balance: number; rate: number | null; rate_id: number | null; amount: number | null; calc: string; records: EquipRec[] }
export interface LabourGroup { key: string; role: string; days: number; person_days: number; amount: number; rate: number | null; rates: { wage: number; person_days: number; amount: number }[]; calc: string; records: { date: string; report: string; site: string; headcount: number; wage: number; amount: number }[] }
export interface MatGroup { key: string; name: string; unit: string; received: number; used: number; balance: number; rate: number | null; rate_id: number | null; amount: number | null; calc: string; records: { date: string; report: string; site: string; kind: string; quantity: number; amount: number | null }[] }
export interface OtherCost { id: number; date: string; category: string; description: string; quantity: number | null; unit: string | null; rate: number | null; amount: number; notes: string | null; site: string | null }
export interface SubCost { id: number; date: string; description: string; quantity: number | null; unit: string | null; rate: number | null; amount: number; notes: string | null }
export interface SubGroup { id: number; name: string; scope: string; agreed_amount: number; start_date: string | null; end_date: string | null; status: string; notes: string | null; spent_in_period: number; spent_total: number; remaining: number; over_agreed: boolean; records: SubCost[]; calc: string }
export const setRate = async (code: string, d: { kind: 'equipment' | 'material'; name: string; unit?: string; rate: number }) => (await api.put(`/projects/${code}/rates`, d)).data
export const removeRate = async (id: number) => { await api.delete(`/rates/${id}`) }
export interface CostInput { category: string; description: string; costDate: string; quantity: number | null; unit: string; rate: number | null; amount: number | null; notes: string; site: string }
const costBody = (d: CostInput) => ({ category: d.category, description: d.description, cost_date: d.costDate, quantity: d.quantity, unit: d.unit || null, rate: d.rate, amount: d.quantity === null ? d.amount : null, notes: d.notes || null, site: d.site || null })
export const createOtherCost = async (code: string, d: CostInput) => (await api.post(`/projects/${code}/costs`, costBody(d))).data
export const updateOtherCost = async (id: number, d: CostInput) => (await api.put(`/costs/${id}`, costBody(d))).data
export const deleteOtherCost = async (id: number) => { await api.delete(`/costs/${id}`) }
export interface SubInput { name: string; scope: string; agreedAmount: number; startDate: string; endDate: string; status: string; notes: string }
const subBody = (d: SubInput) => ({ name: d.name, scope: d.scope, agreed_amount: d.agreedAmount, start_date: d.startDate || null, end_date: d.endDate || null, status: d.status, notes: d.notes || null })
export const createSub = async (code: string, d: SubInput) => (await api.post(`/projects/${code}/subcontractors`, subBody(d))).data
export const updateSub = async (id: number, d: SubInput) => (await api.put(`/subcontractors/${id}`, subBody(d))).data
export const deleteSub = async (id: number) => { await api.delete(`/subcontractors/${id}`) }
export interface SubCostInput { costDate: string; description: string; quantity: number | null; unit: string; rate: number | null; amount: number | null; notes: string }
const scBody = (d: SubCostInput) => ({ cost_date: d.costDate, description: d.description, quantity: d.quantity, unit: d.unit || null, rate: d.rate, amount: d.quantity === null ? d.amount : null, notes: d.notes || null })
export const createSubCost = async (sid: number, d: SubCostInput) => (await api.post(`/subcontractors/${sid}/costs`, scBody(d))).data
export const updateSubCost = async (id: number, d: SubCostInput) => (await api.put(`/subcontractor-costs/${id}`, scBody(d))).data
export const deleteSubCost = async (id: number) => { await api.delete(`/subcontractor-costs/${id}`) }
export const getProgress = async (code: string) => (await api.get(`/projects/${code}/progress`)).data as {
  contract_value: number
  timeline: { date: string; work_value: number; cumulative: number; progress: number; reports: number }[]
  reports: Record<string, number>
  financial: { total_costs: number; budget: number; remaining: number; pct: number }
  time: { start_date: string | null; end_date: string | null; total_days: number | null; elapsed: number | null; remaining: number | null; pct: number | null }
}
