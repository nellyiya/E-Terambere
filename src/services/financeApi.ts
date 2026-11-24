import { api } from '../lib/api'
export interface FinanceRow { id: string; name: string; contractValue: number; spent: number; earned: number; profit: number; progress: number; forecastProfit: number | null }
export const listFinance = async (q: { search: string; page: number; size: number }) => {
  const { data } = await api.get('/finance/projects', { params: { search: q.search || undefined, page: q.page, size: q.size } })
  const rows = (data.items as { id: string; name: string; contract_value: number; spent: number; earned: number; profit: number; progress: number; forecast_profit: number | null }[])
    .map(r => ({ id: r.id, name: r.name, contractValue: r.contract_value, spent: r.spent, earned: r.earned, profit: r.profit, progress: r.progress, forecastProfit: r.forecast_profit }) as FinanceRow)
  return { rows, total: data.total as number, totals: { contract: data.totals.contract_value as number, spent: data.totals.spent as number, earned: data.totals.earned as number, profit: data.totals.profit as number } }
}
