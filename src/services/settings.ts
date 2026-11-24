import { api } from '../lib/api'
export interface Settings { name: string; email: string; org: string; notify: { flagged: boolean; newReport: boolean; weekly: boolean } }
interface Raw { name: string; email: string; org: string; notify_flagged: boolean; notify_new_report: boolean; notify_weekly: boolean }
const map = (r: Raw): Settings => ({ name: r.name, email: r.email, org: r.org, notify: { flagged: r.notify_flagged, newReport: r.notify_new_report, weekly: r.notify_weekly } })
export const getSettings = async () => map((await api.get('/settings')).data)
export const saveSettings = async (s: Settings) => map((await api.put('/settings', { name: s.name, org: s.org, notify_flagged: s.notify.flagged, notify_new_report: s.notify.newReport, notify_weekly: s.notify.weekly })).data)
