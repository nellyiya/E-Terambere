import { api } from '../lib/api'
const SHORT: Record<string, string> = { equipment: 'Equipment', labour: 'Labour', materials: 'Materials', other: 'Other costs', subcontractors: 'Subcontractors' }
export const getDashboard = async () => {
  const { data } = await api.get('/dashboard')
  return {
    kpi: { projects: data.kpi.projects as number, active: data.kpi.active as number, completed: data.kpi.completed as number, avg: data.kpi.avg_progress as number, avgFinancial: data.kpi.avg_financial_progress as number, reports: data.kpi.reports as number, supervisors: data.kpi.supervisors as number, activeSupervisors: data.kpi.active_supervisors as number, pending: data.kpi.pending as number, cost: data.kpi.cost as number },
    reportsPerDay: (data.reports_per_day as { date: string; count: number }[]).map(r => ({ date: r.date.slice(5), reports: r.count })),
    costByCategory: (data.cost_by_category as { category: string; amount: number }[]).map(c => ({ name: SHORT[c.category] ?? c.category, amount: c.amount })),
  }
}
