import { api } from '../lib/api'
export const LABELS: Record<string, string> = { equipment: 'Equipment', labour: 'Casual Labour', materials: 'Material Costs', other: 'Other Costs', subcontractors: 'Subcontractors' }
export interface ProjectFinanceData { id: string; contract_value: number; spent: number; earned: number; profit: number; progress: number; forecast_cost: number | null; forecast_profit: number | null; breakdown: { category: string; amount: number }[] }
export const getProjectFinance = async (code: string) => (await api.get(`/finance/projects/${code}`)).data as ProjectFinanceData
