
import { api } from '../lib/api'

export type RStatus = 'Pending' | 'Approved' | 'Returned'

export const CATEGORIES = [
  ['expenses', 'Expenses'],
  ['material', 'Material'],
  ['equipment', 'Equipment'],
  ['labor', 'Labor'],
  ['subcontractor', 'Subcontractor'],
  ['other', 'Other'],
] as const

export const reportKeys = [
  'reports',
  'report',
  'report-history',
  'project-reports',
  'projects',
  'project',
  'sites',
  'supervisors',
  'supervisor',
  'management',
  'section',
  'finance',
  'finance-list',
  'dashboard',
  'analytics',
  'work-done',
  'progress',
  'boq',
  'boq-full',
]

export interface ReportRow {
  id: string
  date: string
  projectId: string
  projectName: string
  site: string
  supervisor: string | null
  activity: string
  status: RStatus
  returnNote: string | null
}

interface RawRow {
  id: string
  date: string
  project_id: string
  project_name: string
  site: string
  supervisor: string | null
  activity: string
  status: RStatus
  return_note: string | null
}

const row = (r: RawRow): ReportRow => ({
  id: r.id,
  date: r.date,
  projectId: r.project_id,
  projectName: r.project_name,
  site: r.site,
  supervisor: r.supervisor,
  activity: r.activity,
  status: r.status,
  returnNote: r.return_note,
})

export interface ReportQuery {
  project: string
  site: string
  from: string
  to: string
  status: string
  search: string
  sort?: 'asc' | 'desc'
}

const params = (q: ReportQuery) => ({
  project: q.project || undefined,
  site: q.site || undefined,
  date_from: q.from || undefined,
  date_to: q.to || undefined,
  status: q.status || undefined,
  search: q.search || undefined,
  sort: q.sort || undefined,
})

export const listReports = async (
  q: ReportQuery,
  page: number,
  size: number,
) => {
  const { data } = await api.get('/reports', {
    params: { ...params(q), page, size },
  })

  return {
    rows: (data.items as RawRow[]).map(row),
    total: data.total as number,
  }
}

export const fetchAllReports = async (q: ReportQuery) => {
  // For export: walks every page (the server allows 100 per page)
  const out: ReportRow[] = []

  for (let page = 1; ; page++) {
    const r = await listReports(q, page, 100)
    out.push(...r.rows)

    if (out.length >= r.total || !r.rows.length) return out
  }
}

export interface ActivityLine {
  description: string
  quantity: number
  location: string
}

export interface EquipmentLine {
  kind: 'Machine' | 'Truck' | 'Tool'
  name: string
  details: string
  hours: number
  tripsSand: number
  tripsStones: number
  fuelReceived: number
  fuelUsed: number
  fuelBalance: number
}

export interface MaterialLine {
  kind: 'received' | 'used'
  name: string
  quantity: number
  unit: string
}

export interface WorkerLine {
  role: string
  headcount: number
  dailyWage: number
}

export interface ReportDetail {
  id: string
  project: string
  projectName: string
  site: string
  supervisorId: number | null
  supervisor: string | null
  date: string
  status: RStatus
  returnNote: string | null
  photos: { url: string; caption: string | null }[]
  reviewedAt: string | null
  reviewedBy: string | null
  startTime: string
  endTime: string
  challenge: string
  notes: string

  activities: ActivityLine[]
  equipment: EquipmentLine[]
  materials: MaterialLine[]
  workers: WorkerLine[]

  work: {
    boqItemId: number
    itemNo: number
    description: string
    unit: string
    quantity: number
    amount: number
  }[]
}

export const getReport = async (code: string): Promise<ReportDetail> => {
  const { data: d } = await api.get(`/reports/${code}`)

  return {
    id: d.id,
    project: d.project,
    projectName: d.project_name,
    site: d.site,
    supervisorId: d.supervisor_id,
    supervisor: d.supervisor ?? null,
    date: d.report_date,
    status: d.status,
    returnNote: d.return_note,
    notes: d.notes ?? null,
    photos: d.photos ?? [],
    reviewedAt: d.reviewed_at,
    reviewedBy: d.reviewed_by,
    startTime: d.start_time ?? '',
    endTime: d.end_time ?? '',
    challenge: d.challenge ?? '',

    activities: (d.activity_details ?? []).map(
      (a: { description: string; quantity?: number; location?: string | null }) => ({
        description: a.description,
        quantity: Number(a.quantity ?? 0),
        location: a.location ?? '',
      }),
    ),

    work: d.work.map(
      (w: {
        boq_item_id: number
        item_no: number
        description: string
        unit: string
        quantity: number
        amount: number
      }) => ({
        boqItemId: w.boq_item_id,
        itemNo: w.item_no,
        description: w.description,
        unit: w.unit,
        quantity: w.quantity,
        amount: w.amount,
      }),
    ),

    equipment: d.equipment.map(
      (e: {
        name: string
        details: string | null
        hours: number
        fuel_received: number
        fuel_used: number
        fuel_balance: number
        kind?: 'Machine' | 'Truck' | 'Tool'
        trips_sand?: number
        trips_stones?: number
      }) => ({
        kind: e.kind ?? 'Machine',
        name: e.name,
        details: e.details ?? '',
        hours: e.hours,
        tripsSand: e.trips_sand ?? 0,
        tripsStones: e.trips_stones ?? 0,
        fuelReceived: e.fuel_received,
        fuelUsed: e.fuel_used,
        fuelBalance: e.fuel_balance,
      }),
    ),

    materials: d.materials,

    workers: d.workers.map(
      (w: {
        role: string
        headcount: number
        daily_wage: number
      }) => ({
        role: w.role,
        headcount: w.headcount,
        dailyWage: w.daily_wage,
      }),
    ),
  }
}

export interface ReportInput {
  project: string
  site: string
  supervisorId: number | null
  date: string
  activity: string
  status: RStatus
  startTime: string
  endTime: string
  challenge: string
  notes: string

  activities: ActivityLine[]
  equipment: EquipmentLine[]
  materials: MaterialLine[]
  workers: WorkerLine[]

  work: {
    boqItemId: number
    quantity: number
  }[]
}

const body = (d: ReportInput) => ({
  project: d.project,
  site: d.site,
  supervisor_id: d.supervisorId,
  report_date: d.date,
  activity: d.activity,
  status: d.status,
  start_time: d.startTime || null,
  end_time: d.endTime || null,
  challenge: d.challenge || null,
  notes: d.notes || null,

  activities: d.activities.map((a) => ({
    description: a.description,
    quantity: a.quantity,
    location: a.location || null,
  })),

  work: d.work.map((w) => ({
    boq_item_id: w.boqItemId,
    quantity: w.quantity,
  })),

  costs: [],

  equipment: d.equipment.map((e) => ({
    kind: e.kind,
    name: e.name,
    details: e.details || null,
    hours: e.hours,
    trips_sand: e.tripsSand,
    trips_stones: e.tripsStones,
    fuel_received: e.fuelReceived,
    fuel_used: e.fuelUsed,
  })),

  materials: d.materials,

  workers: d.workers.map((w) => ({
    role: w.role,
    headcount: w.headcount,
    daily_wage: w.dailyWage,
  })),
})

export interface ReportSaveResponse {
  id: string
  warnings: string[]
}

export const createReport = async (
  d: ReportInput,
): Promise<ReportSaveResponse> =>
  (await api.post('/reports', body(d))).data

export const updateReport = async (
  code: string,
  d: ReportInput,
): Promise<ReportSaveResponse> =>
  (await api.put(`/reports/${code}`, body(d))).data

export const getSuggestions = async () =>
  (await api.get('/suggestions')).data as {
    equipment: string[]
    materials: string[]
    roles: { role: string; daily_wage: number }[]
  }

export const approveReport = async (code: string) => {
  await api.post(`/reports/${code}/approve`)
}

export const returnReport = async (code: string, note: string) => {
  await api.post(`/reports/${code}/return`, { note })
}

export const resubmitReport = async (code: string) => {
  await api.post(`/reports/${code}/resubmit`)
}

export const getHistory = async (code: string) =>
  (await api.get(`/reports/${code}/history`)).data as {
    action: string
    note: string | null
    by: string | null
    at: string
  }[]

export const deleteReport = async (code: string) => {
  await api.delete(`/reports/${code}`)
}

export const getFilterData = async () =>
  (await api.get('/filters')).data as {
    projects: { id: string; name: string; sites: string[] }[]
    supervisors: { id: number; name: string }[]
  }

export const listBoq = async (code: string) =>
  (await api.get(`/projects/${code}/boq-items`)).data as {
    id: number
    item_no: number
    description: string
    unit: string
    rate: number
  }[]

export const uploadReportPhoto = async (
  code: string,
  file: File,
  caption: string = '',
) => {
  const form = new FormData()
  form.append('photo', file)
  form.append('caption', caption)
  return (await api.post(`/reports/${code}/photos`, form)).data
}
