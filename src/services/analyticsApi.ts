import { api } from '../lib/api'
import type { Filters } from './reports'
const SHORT: Record<string, string> = { equipment: 'Equipment', labour: 'Labour', materials: 'Materials', other: 'Other costs', subcontractors: 'Subcontractors' }
const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const day = (iso: string) => { const [, m, d] = iso.split('-'); return `${mon[Number(m) - 1]} ${Number(d)}` }
export const getAnalytics = async (f: Filters) => {
  const { data } = await api.get('/analytics', { params: { project: f.project || undefined, site: f.site || undefined, date_from: f.from || undefined, date_to: f.to || undefined } })
  return {
    kpi: data.kpi as { cost: number; reports: number; fuel_used: number },
    costPerDay: (data.cost_per_day as { date: string; amount: number }[]).map(r => ({ label: day(r.date), amount: r.amount })),
    costByCategory: (data.cost_by_category as { category: string; amount: number }[]).map(c => ({ name: SHORT[c.category] ?? c.category, amount: c.amount })),
    reportsByStatus: (data.reports_by_status as { status: string; count: number }[]).map(r => ({ name: r.status, count: r.count })),
    fuelByMachine: (data.fuel_by_machine as { name: string; fuel_used: number; hours: number }[]).map(r => ({ name: r.name, litres: r.fuel_used, hours: r.hours })),
    topProjects: data.top_projects as { id: string; name: string; amount: number }[],
  }
}
