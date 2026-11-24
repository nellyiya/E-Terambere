import { api } from '../lib/api'
import type { Filters } from './reports'
export const boqKeys = ['boq', 'boq-full', 'work-done', 'finance', 'finance-list', 'management', 'progress', 'projects', 'project', 'project-reports']
export interface BoqItem { id: number; itemNo: number; description: string; unit: string; rate: number; quantity: number | null; quantityDone: number; amountDone: number; reports: number }
interface Raw { id: number; item_no: number; description: string; unit: string; rate: number; quantity: number | null; quantity_done: number; amount_done: number; reports: number }
export const listBoqItems = async (code: string): Promise<BoqItem[]> =>
  ((await api.get(`/projects/${code}/boq-items`)).data as Raw[]).map(r => ({ id: r.id, itemNo: r.item_no, description: r.description, unit: r.unit, rate: r.rate, quantity: r.quantity, quantityDone: r.quantity_done, amountDone: r.amount_done, reports: r.reports }))
export interface BoqInput { description: string; unit: string; rate: number; quantity: number | null }
export const createBoqItem = async (code: string, d: BoqInput) => (await api.post(`/projects/${code}/boq-items`, d)).data
export const updateBoqItem = async (id: number, d: BoqInput) => (await api.put(`/boq-items/${id}`, d)).data
export const deleteBoqItem = async (id: number) => { await api.delete(`/boq-items/${id}`) }
export interface WorkRow { projectId: string; projectName: string; itemNo: number; description: string; unit: string; quantity: number; rate: number; amount: number }
export const getWorkDone = async (f: Filters, page: number, size: number) => {
  const { data } = await api.get('/work-done', { params: { project: f.project || undefined, site: f.site || undefined, date_from: f.from || undefined, date_to: f.to || undefined, page, size } })
  const rows = (data.items as { project_id: string; project_name: string; item_no: number; description: string; unit: string; quantity: number; rate: number; amount: number }[])
    .map(r => ({ projectId: r.project_id, projectName: r.project_name, itemNo: r.item_no, description: r.description, unit: r.unit, quantity: r.quantity, rate: r.rate, amount: r.amount }) as WorkRow)
  return { rows, total: data.total as number, totalAmount: data.total_amount as number }
}
export const fetchAllWorkDone = async (f: Filters) => {  // for export: walks every page (the server allows 100 per page)
  const out: WorkRow[] = []
  for (let page = 1; ; page++) {
    const r = await getWorkDone(f, page, 100)
    out.push(...r.rows)
    if (out.length >= r.total || !r.rows.length) return out
  }
}
