// DEMO DATA: derived from reports. Backend equivalent = GET /notifications plus POST /notifications/read (read state should be stored server-side).
import { _reports } from './reports'
import type { Settings } from './settings'
export interface Notice { id: string; title: string; text: string; date: string; to: string; tone: 'red' | 'amber' }
const KEY = 'worksync.readNotices'
export const readIds = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] } }
export const markRead = (ids: string[]) => { try { localStorage.setItem(KEY, JSON.stringify([...new Set([...readIds(), ...ids])])) } catch { /* storage unavailable: stays unread */ } }
export const getNotices = async (n?: Settings['notify']): Promise<Notice[]> => {
  await new Promise(r => setTimeout(r, 150))
  const rows = _reports.filter(r => (r.status === 'Flagged' && (n?.flagged ?? true)) || (r.status === 'Pending' && (n?.newReport ?? false)))
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 15).map(r => ({
    id: r.id, tone: r.status === 'Flagged' ? 'red' : 'amber', title: r.status === 'Flagged' ? 'Report flagged' : 'Report awaiting review',
    text: `${r.id} · ${r.projectName}, ${r.site}`, date: r.date, to: `/projects/${r.projectId}/reports` }))
}
