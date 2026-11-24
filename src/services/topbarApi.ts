import { api } from '../lib/api'
export interface Hit { key: string; group: string; title: string; sub: string; to: string }
export const globalSearch = async (term: string): Promise<Hit[]> => {
  const { data } = await api.get('/search', { params: { q: term.trim() } })
  return [
    ...(data.projects as { id: string; name: string; district: string }[]).map(p => ({ key: p.id, group: 'Projects', title: p.name, sub: `${p.id} · ${p.district}`, to: `/projects/${p.id}/overview` })),
    ...(data.supervisors as { id: number; name: string; email: string }[]).map(s => ({ key: String(s.id), group: 'Supervisors', title: s.name, sub: s.email, to: `/supervisors/${s.id}` })),
    ...(data.reports as { id: string; activity: string; project_id: string; project_name: string; date: string }[]).map(r => ({ key: r.id, group: 'Reports', title: `${r.id} · ${r.activity}`, sub: `${r.project_name} · ${r.date}`, to: `/projects/${r.project_id}/daily-reports` })),
  ]
}
export interface Notice { id: string; title: string; text: string; date: string; to: string; tone: 'red' | 'amber' }
const KEY = 'worksync.readNotices'
export const readIds = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] } }
export const markRead = (ids: string[]) => { try { localStorage.setItem(KEY, JSON.stringify([...new Set([...readIds(), ...ids])])) } catch { /* storage unavailable: stays unread */ } }
export const getNotices = async (n?: { flagged: boolean; newReport: boolean }): Promise<Notice[]> => {
  const { data } = await api.get('/notifications', { params: { flagged: n?.flagged ?? true, pending: n?.newReport ?? false } })
  return (data as { id: string; kind: string; title: string; text: string; date: string; project_id: string }[]).map(x => ({ id: x.id, title: x.title, text: x.text, date: x.date, to: `/projects/${x.project_id}/daily-reports`, tone: x.kind === 'returned' ? 'red' : 'amber' }))
}
