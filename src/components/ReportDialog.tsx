import { useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X, ImagePlus, ClipboardList, Hammer, Wrench, Truck, Package, Users, Flag, Camera, MessageSquare, type LucideIcon } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import { errMsg } from '../lib/api'
import {
  createReport, getFilterData, getReport, getSuggestions,
  reportKeys, updateReport, uploadReportPhoto,
  type ReportDetail, type ReportInput, type RStatus,
} from '../services/reportsApi'

const cls = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20'
const small = 'rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20'
const GRAD = 'linear-gradient(145deg, #2fae9d 0%, #1c8578 52%, #0f4a43 100%)'
const rwf = (n: number) => new Intl.NumberFormat('en-US').format(n) + ' RWF'
const num = (s: string) => s.trim() === '' ? 0 : Number(s)

type Act = { description: string; quantity: string; location: string }
type Eq = {
  kind: 'Machine' | 'Truck' | 'Tool'
  name: string
  details: string
  hours: string
  sand: string
  stones: string
  received: string
  used: string
}
type Mat = { kind: 'received' | 'used'; name: string; qty: string; unit: string }
type Wk = { role: string; count: string; wage: string }
type Photo = { file: File; caption: string }

const workerCategories = [
  { role: 'Helpers', daily_wage: 3000 },
  { role: 'Aide topo', daily_wage: 3500 },
  { role: 'Masons', daily_wage: 7000 },
  { role: 'Joint Fillers', daily_wage: 4000 },
  { role: 'Operateur sauteuse & P.compacteur', daily_wage: 5000 },
  { role: 'Pointeur', daily_wage: 4000 },
  { role: 'Capita', daily_wage: 7000 },
  { role: 'Aide Labo', daily_wage: 8000 },
  { role: 'Aide comptable', daily_wage: 5500 },
  { role: 'Security', daily_wage: 250 },
]

const upd = <T,>(l: T[], set: (x: T[]) => void, i: number, p: Partial<T>) =>
  set(l.map((x, j) => j === i ? { ...x, ...p } : x))

const drop = <T,>(l: T[], set: (x: T[]) => void, i: number) =>
  set(l.filter((_, j) => j !== i))

const Shell = ({ title, onClose, children }: {
  title: string
  onClose: () => void
  children: ReactNode
}) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label={title}>
    <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-7">
        <div className="flex items-center gap-3">
          <span style={{ background: GRAD }} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white shadow-md shadow-brand/30 ring-2 ring-white">
            <ClipboardList size={19} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
            <p className="text-xs text-slate-500">Daily site report</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100" aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <div className="overflow-y-auto px-5 py-5 sm:px-7">{children}</div>
    </div>
  </div>
)

const Section = ({ title, subtitle, add, onAdd, icon: I = ClipboardList, children }: {
  title: string
  subtitle?: string
  add?: string
  onAdd?: () => void
  icon?: LucideIcon
  children: ReactNode
}) => (
  <section className="card-shadow overflow-hidden rounded-3xl border border-slate-200 bg-white">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-brand/[0.04] px-5 py-3.5">
      <div className="flex items-center gap-3">
        <span style={{ background: GRAD }} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white shadow-sm shadow-brand/30">
          <I size={16} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {add && onAdd && (
        <button type="button" onClick={onAdd} className="flex shrink-0 items-center gap-1 rounded-full border border-brand/25 bg-white px-3 py-1.5 text-xs font-medium text-brand transition hover:bg-brand/10">
          <Plus size={15} />{add}
        </button>
      )}
    </div>
    <div className="space-y-3 p-5">{children}</div>
  </section>
)

const Remove = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} aria-label="Remove item" className="rounded-full p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600">
    <X size={16} />
  </button>
)

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block text-sm font-medium text-slate-700">
    {label}
    {children}
  </label>
)

export default function ReportDialog({
  onClose,
  code,
  defaultProject,
}: {
  onClose: () => void
  code?: string
  defaultProject?: string
}) {
  const detail = useQuery({
    queryKey: ['report', code],
    queryFn: () => getReport(code!),
    enabled: !!code,
  })

  const title = code ? `Edit report ${code}` : 'Add daily report'

  if (code && detail.isLoading) {
    return <Shell title={title} onClose={onClose}>
      <p className="text-sm text-slate-500">Loading report...</p>
    </Shell>
  }

  if (code && (detail.error || !detail.data)) {
    return <Shell title={title} onClose={onClose}>
      <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errMsg(detail.error)}</p>
    </Shell>
  }

  return (
    <Form
      title={title}
      onClose={onClose}
      initial={detail.data}
      code={code}
      defaultProject={defaultProject}
    />
  )
}

function Form({
  title,
  onClose,
  initial,
  code,
  defaultProject,
}: {
  title: string
  onClose: () => void
  initial?: ReportDetail
  code?: string
  defaultProject?: string
}) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const n = (x: number) => String(x)

  const [v, setV] = useState({
    project: initial?.project ?? defaultProject ?? '',
    site: initial?.site ?? '',
    supervisor: initial?.supervisorId ? n(initial.supervisorId) : '',
    date: initial?.date ?? today,
    start: initial?.startTime ?? '',
    end: initial?.endTime ?? '',
    status: (initial?.status ?? 'Pending') as RStatus,
    challenge: initial?.challenge ?? '',
    notes: initial?.notes ?? '',
  })

  const [acts, setActs] = useState<Act[]>(
    initial?.activities?.map(a => ({
      description: a.description,
      quantity: n(a.quantity),
      location: a.location ?? '',
    })) ?? [{ description: '', quantity: '', location: '' }]
  )

  const [eq, setEq] = useState<Eq[]>(
    initial?.equipment?.map(e => ({
      kind: e.kind ?? 'Machine',
      name: e.name,
      details: e.details,
      hours: n(e.hours),
      sand: n(e.tripsSand ?? 0),
      stones: n(e.tripsStones ?? 0),
      received: n(e.fuelReceived),
      used: n(e.fuelUsed),
    })) ?? []
  )

  const [mats, setMats] = useState<Mat[]>(
    initial?.materials?.map(m => ({
      kind: m.kind,
      name: m.name,
      qty: n(m.quantity),
      unit: m.unit || (m.kind === 'received' ? 'm³' : ''),
    })) ?? []
  )

  const [wk, setWk] = useState<Wk[]>(
    initial?.workers?.map(w => ({
      role: w.role,
      count: n(w.headcount),
      wage: n(w.dailyWage),
    })) ?? []
  )

  const [photos, setPhotos] = useState<Photo[]>([])
  const [touched, setTouched] = useState(false)
  const [warn, setWarn] = useState<string[] | null>(null)
  const [ask, setAsk] = useState<'save' | 'discard' | null>(null)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const snap = JSON.stringify([
    v,
    acts,
    eq,
    mats,
    wk,
    photos.map(p => [p.file.name, p.caption]),
  ])

  const base = useRef(snap)
  const dirty = snap !== base.current

  const { data: fd } = useQuery({
    queryKey: ['filter-data'],
    queryFn: getFilterData,
  })

  const { data: sg } = useQuery({
    queryKey: ['suggestions'],
    queryFn: getSuggestions,
  })

  const sites = fd?.projects.find(p => p.id === v.project)?.sites ?? []

  // Include standard categories and previously used custom categories.
  const workerOptions = [
    ...workerCategories,
    ...(sg?.roles ?? [])
      .filter(r => !workerCategories.some(
        c => c.role.toLowerCase() === r.role.toLowerCase()
      ))
      .map(r => ({
        role: r.role,
        daily_wage: r.daily_wage,
      })),
  ]

  const e: Record<string, string> = {}

  if (!v.project) e.project = 'Choose a project.'
  if (!v.site) e.site = 'Choose a site.'
  if (!v.supervisor) e.supervisor = 'Choose a supervisor.'
  if (!v.date || v.date > new Date(Date.now() + 864e5).toISOString().slice(0, 10)) {
    e.date = 'Enter a valid report date.'
  }
  if (v.start && v.end && v.end <= v.start) {
    e.end = 'Work end must be after work started.'
  }
  if (!acts.some(a => a.description.trim().length >= 2)) {
    e.acts = 'Describe at least one piece of work done.'
  }
  if (acts.some(a => a.quantity.trim() && !(num(a.quantity) >= 0))) {
    e.acts = 'Activity quantities must be 0 or more.'
  }
  if (eq.some(x =>
    x.name.trim().length < 2 ||
    [x.hours, x.received, x.used, x.sand, x.stones].some(t => !(num(t) >= 0))
  )) {
    e.eq = 'Equipment names and valid non-negative numbers are required.'
  }
  if (mats.some(m =>
    m.name.trim().length < 2 ||
    !m.unit.trim() ||
    !(num(m.qty) >= 0)
  )) {
    e.mats = 'Each material needs a name, quantity and unit.'
  }
  if (wk.some(w =>
    w.role.trim().length < 2 ||
    !Number.isInteger(num(w.count)) ||
    num(w.count) < 0 ||
    !Number.isInteger(num(w.wage)) ||
    num(w.wage) < 0
  )) {
    e.wk = 'Each worker line needs a role, whole number of people and wage.'
  }

  const labor = wk.reduce(
    (a, w) => a + num(w.count) * num(w.wage),
    0
  )

  const m = useMutation({
    mutationFn: async (d: ReportInput) => {
      const r = code
        ? await updateReport(code, d)
        : await createReport(d)

      const reportCode = code ?? r.id

      if (photos.length && reportCode) {
        setUploadError('')
        for (const p of photos) {
          await uploadReportPhoto(reportCode, p.file, p.caption)
        }
      }

      return r
    },

    onSuccess: r => {
      reportKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] }))
      ;['suggestions', 'report'].forEach(k =>
        qc.invalidateQueries({ queryKey: [k] })
      )
      setAsk(null)
      r.warnings?.length ? setWarn(r.warnings) : onClose()
    },
  })

  const build = (): ReportInput => {
    const list = acts.map(x => x.description.trim()).filter(Boolean)

    return {
      project: v.project,
      site: v.site,
      supervisorId: v.supervisor ? Number(v.supervisor) : null,
      date: v.date,
      activity: list[0]?.slice(0, 120) ?? '',
      status: v.status,
      startTime: v.start,
      endTime: v.end,
      challenge: v.challenge.trim(),
      notes: v.notes.trim(),

      activities: acts
        .filter(a => a.description.trim())
        .map(a => ({
          description: a.description.trim(),
          quantity: num(a.quantity),
          location: a.location.trim(),
        })),

      equipment: eq.map(x => ({
        kind: x.kind,
        name: x.name.trim(),
        details: x.details.trim(),
        hours: num(x.hours),
        tripsSand: num(x.sand),
        tripsStones: num(x.stones),
        fuelReceived: num(x.received),
        fuelUsed: num(x.used),
        fuelBalance: num(x.received) - num(x.used),
      })),

      materials: mats.map(x => ({
        kind: x.kind,
        name: x.name.trim(),
        quantity: num(x.qty),
        unit: x.unit.trim(),
      })),

      workers: wk.map(w => ({
        role: w.role.trim(),
        headcount: num(w.count),
        dailyWage: num(w.wage),
      })),

      // BOQ is managed from Project Management, not the Daily Report form.
      work: [],
    }
  }

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault()
    setTouched(true)

    if (Object.keys(e).length) return

    m.reset()
    setAsk('save')
  }

  const tryClose = () => dirty && !m.isPending
    ? setAsk('discard')
    : onClose()

  const set = (k: keyof typeof v, val: string) =>
    setV(p => ({
      ...p,
      [k]: val,
      ...(k === 'project' ? { site: '' } : {}),
    }))

  const Err = ({ k }: { k: string }) =>
    touched && e[k]
      ? <p className="mt-1 text-xs text-red-600">{e[k]}</p>
      : null

  const inputError = (k: string) =>
    touched && e[k] ? 'border-red-400' : 'border-slate-200'

  if (warn) {
    return (
      <Shell title="Report saved" onClose={onClose}>
        <p className="mb-2 text-sm">
          The report was saved. Please check these fuel balances:
        </p>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-amber-700">
          {warn.map(w => <li key={w}>{w}</li>)}
        </ul>
        <div className="flex justify-end">
          <button onClick={onClose} className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white transition hover:opacity-90">
            Close
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <>
      <Shell title={title} onClose={tryClose}>
        <form onSubmit={submit} noValidate className="space-y-5">

          <datalist id="eq-names">
            {sg?.equipment.map(x => <option key={x} value={x} />)}
          </datalist>

          <datalist id="mat-names">
            {sg?.materials.map(x => <option key={x} value={x} />)}
          </datalist>

          <Section title="General Information" subtitle="Project, site, supervisor and working hours">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

              <Field label="Project">
                <select
                  disabled={!!code}
                  value={v.project}
                  onChange={ev => set('project', ev.target.value)}
                  className={`${cls} disabled:bg-slate-50 ${inputError('project')}`}
                >
                  <option value="">Select project...</option>
                  {fd?.projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.id} · {p.name}
                    </option>
                  ))}
                </select>
                <Err k="project" />
              </Field>

              <Field label="Site">
                <select
                  value={v.site}
                  disabled={!v.project}
                  onChange={ev => set('site', ev.target.value)}
                  className={`${cls} ${inputError('site')}`}
                >
                  <option value="">Select site...</option>
                  {sites.map(s => <option key={s}>{s}</option>)}
                </select>
                <Err k="site" />
              </Field>

              <Field label="Supervisor">
                <select
                  value={v.supervisor}
                  onChange={ev => set('supervisor', ev.target.value)}
                  className={`${cls} ${inputError('supervisor')}`}
                >
                  <option value="">Select supervisor...</option>
                  {fd?.supervisors.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <Err k="supervisor" />
              </Field>

              <Field label="Report date">
                <input
                  type="date"
                  value={v.date}
                  onChange={ev => set('date', ev.target.value)}
                  className={`${cls} ${inputError('date')}`}
                />
                <Err k="date" />
              </Field>

              <Field label="Work started">
                <input
                  type="time"
                  value={v.start}
                  onChange={ev => set('start', ev.target.value)}
                  className={cls}
                />
              </Field>

              <Field label="Work ended">
                <input
                  type="time"
                  value={v.end}
                  onChange={ev => set('end', ev.target.value)}
                  className={`${cls} ${inputError('end')}`}
                />
                <Err k="end" />
              </Field>
            </div>

            {v.start && v.end && v.end > v.start && (
              <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                Working duration: {(() => {
                  const mins =
                    (Number(v.end.slice(0, 2)) * 60 + Number(v.end.slice(3))) -
                    (Number(v.start.slice(0, 2)) * 60 + Number(v.start.slice(3)))
                  return `${Math.floor(mins / 60)} hours ${mins % 60} minutes`
                })()}
              </p>
            )}
          </Section>

          <Section
            title="Work Done" icon={Hammer}
            subtitle="Describe activities, quantities and their locations"
            add="Add activity"
            onAdd={() => setActs([...acts, { description: '', quantity: '', location: '' }])}
          >
            {acts.map((a, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Activity {i + 1}</span>
                  {acts.length > 1 && <Remove onClick={() => drop(acts, setActs, i)} />}
                </div>

                <Field label="Description">
                  <textarea
                    rows={2}
                    value={a.description}
                    onChange={ev => upd(acts, setActs, i, { description: ev.target.value })}
                    placeholder="Describe the work performed..."
                    className={cls}
                  />
                </Field>

                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Field label="Quantity">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={a.quantity}
                      onChange={ev => upd(acts, setActs, i, { quantity: ev.target.value })}
                      placeholder="Quantity completed"
                      className={small}
                    />
                  </Field>

                  <Field label="Location / Chainage">
                    <input
                      value={a.location}
                      onChange={ev => upd(acts, setActs, i, { location: ev.target.value })}
                      placeholder="e.g. CH 14+120"
                      className={small}
                    />
                  </Field>
                </div>
              </div>
            ))}
            <Err k="acts" />
          </Section>

          <Section
            title="Equipment Used" icon={Wrench}
            subtitle="Machines, trucks and tools"
            add="Add equipment"
            onAdd={() => setEq([...eq, {
              kind: 'Machine',
              name: '',
              details: '',
              hours: '',
              sand: '0',
              stones: '0',
              received: '0',
              used: '0',
            }])}
          >
            {eq.map((x, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Equipment {i + 1}</span>
                  <Remove onClick={() => drop(eq, setEq, i)} />
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Field label="Type">
                    <select
                      value={x.kind}
                      onChange={ev => upd(eq, setEq, i, { kind: ev.target.value as Eq['kind'] })}
                      className={cls}
                    >
                      <option>Machine</option>
                      <option>Truck</option>
                      <option>Tool</option>
                    </select>
                  </Field>

                  <Field label="Name / Registration">
                    <input
                      list="eq-names"
                      value={x.name}
                      onChange={ev => upd(eq, setEq, i, { name: ev.target.value })}
                      placeholder="e.g. Excavator / RAH993U"
                      className={cls}
                    />
                  </Field>

                  <Field label="Activity / Details">
                    <input
                      value={x.details}
                      onChange={ev => upd(eq, setEq, i, { details: ev.target.value })}
                      placeholder="What was it used for?"
                      className={cls}
                    />
                  </Field>

                  <Field label="Hours used">
                    <input
                      type="number"
                      min="0"
                      max="24"
                      step="any"
                      value={x.hours}
                      onChange={ev => upd(eq, setEq, i, { hours: ev.target.value })}
                      className={cls}
                    />
                  </Field>
                </div>

                {x.kind === 'Truck' && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Field label="Trips (sand)">
                      <input
                        type="number"
                        min="0"
                        value={x.sand}
                        onChange={ev => upd(eq, setEq, i, { sand: ev.target.value })}
                        className={cls}
                      />
                    </Field>

                    <Field label="Trips (stones)">
                      <input
                        type="number"
                        min="0"
                        value={x.stones}
                        onChange={ev => upd(eq, setEq, i, { stones: ev.target.value })}
                        className={cls}
                      />
                    </Field>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Field label="Fuel received (L)">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={x.received}
                      onChange={ev => upd(eq, setEq, i, { received: ev.target.value })}
                      className={cls}
                    />
                  </Field>

                  <Field label="Fuel used (L)">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={x.used}
                      onChange={ev => upd(eq, setEq, i, { used: ev.target.value })}
                      className={cls}
                    />
                  </Field>

                  <div className="rounded-2xl bg-brand/5 p-3">
                    <p className="text-xs font-medium text-brand">Fuel balance</p>
                    <p className="mt-1 text-sm font-semibold text-brand">
                      {num(x.received) - num(x.used)} L
                    </p>
                    <p className="mt-1 text-xs text-brand">
                      Received − Used
                    </p>
                  </div>
                </div>
              </div>
            ))}
            <Err k="eq" />
          </Section>

          <Section
            title="Materials Received" icon={Truck}
            subtitle="Materials delivered to the site"
            add="Add received"
            onAdd={() => setMats([...mats, {
              kind: 'received',
              name: '',
              qty: '',
              unit: 'm³',
            }])}
          >
            {mats.filter(x => x.kind === 'received').length === 0 && (
              <p className="text-xs text-slate-400">No materials received added.</p>
            )}

            {mats.map((x, i) => x.kind === 'received' && (
              <div key={i} className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="min-w-36 flex-1">
                  <Field label="Material">
                    <input
                      list="mat-names"
                      value={x.name}
                      onChange={ev => upd(mats, setMats, i, { name: ev.target.value })}
                      className={cls}
                      placeholder="Material name"
                    />
                  </Field>
                </div>

                <Field label="Quantity">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={x.qty}
                    onChange={ev => upd(mats, setMats, i, { qty: ev.target.value })}
                    className={`${small} w-28`}
                  />
                </Field>

                <Field label="Unit">
                  <input
                    value={x.unit}
                    onChange={ev => upd(mats, setMats, i, { unit: ev.target.value })}
                    className={`${small} w-24`}
                    placeholder="e.g. m³"
                  />
                </Field>

                <Remove onClick={() => drop(mats, setMats, i)} />
              </div>
            ))}
            <Err k="mats" />
          </Section>

          <Section
            title="Materials Used" icon={Package}
            subtitle="Materials consumed during work"
            add="Add used"
            onAdd={() => setMats([...mats, {
              kind: 'used',
              name: '',
              qty: '',
              unit: '',
            }])}
          >
            {mats.filter(x => x.kind === 'used').length === 0 && (
              <p className="text-xs text-slate-400">No materials used added.</p>
            )}

            {mats.map((x, i) => x.kind === 'used' && (
              <div key={i} className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="min-w-36 flex-1">
                  <Field label="Material">
                    <input
                      list="mat-names"
                      value={x.name}
                      onChange={ev => upd(mats, setMats, i, { name: ev.target.value })}
                      className={cls}
                      placeholder="Material name"
                    />
                  </Field>
                </div>

                <Field label="Quantity">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={x.qty}
                    onChange={ev => upd(mats, setMats, i, { qty: ev.target.value })}
                    className={`${small} w-28`}
                  />
                </Field>

                <Field label="Unit">
                  <input
                    value={x.unit}
                    onChange={ev => upd(mats, setMats, i, { unit: ev.target.value })}
                    className={`${small} w-24`}
                    placeholder="e.g. m³"
                  />
                </Field>

                <Remove onClick={() => drop(mats, setMats, i)} />
              </div>
            ))}
            <Err k="mats" />
          </Section>

          <Section
            title="Casual Workers" icon={Users}
            subtitle="Daily headcount and wage costs"
            add="Add workers"
            onAdd={() => setWk([...wk, { role: '', count: '', wage: '' }])}
          >
            {wk.map((w, i) => {
              const selectedRole = workerOptions.find(c => c.role === w.role)

              return (
                <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Worker category {i + 1}
                    </span>
                    <Remove onClick={() => drop(wk, setWk, i)} />
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                    <Field label="Worker category">
                      <select
                        value={selectedRole ? w.role : w.role ? '__custom__' : ''}
                        onChange={ev => {
                          const selected = workerOptions.find(c => c.role === ev.target.value)

                          if (selected) {
                            upd(wk, setWk, i, {
                              role: selected.role,
                              wage: n(selected.daily_wage),
                            })
                          } else {
                            upd(wk, setWk, i, {
                              role: '',
                              wage: '',
                            })
                          }
                        }}
                        className={cls}
                      >
                        <option value="">Select category...</option>
                        {workerOptions.map(c => (
                          <option key={c.role} value={c.role}>
                            {c.role} — {rwf(c.daily_wage)}
                          </option>
                        ))}
                        <option value="__custom__">Other / Add new category</option>
                      </select>
                    </Field>

                    {!selectedRole && (
                      <Field label="New category name">
                        <input
                          value={w.role}
                          onChange={ev => upd(wk, setWk, i, { role: ev.target.value })}
                          placeholder="Enter category"
                          className={cls}
                        />
                      </Field>
                    )}

                    <Field label="Number of people">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={w.count}
                        onChange={ev => upd(wk, setWk, i, { count: ev.target.value })}
                        className={cls}
                      />
                    </Field>

                    <Field label="Daily wage (RWF)">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={w.wage}
                        onChange={ev => upd(wk, setWk, i, { wage: ev.target.value })}
                        className={cls}
                      />
                    </Field>
                  </div>

                  <p className="mt-2 text-right text-xs text-slate-500">
                    Line cost:{' '}
                    <span className="font-semibold text-slate-700">
                      {rwf(num(w.count) * num(w.wage))}
                    </span>
                  </p>
                </div>
              )
            })}

            {wk.length > 0 && (
              <div className="rounded-2xl bg-brand/5 p-3.5 text-right text-sm font-semibold text-brand">
                Total labor cost: {rwf(labor)} · Total people: {wk.reduce((a, w) => a + num(w.count), 0)}
              </div>
            )}

            <Err k="wk" />
          </Section>

          <Section
            title="Challenges" icon={Flag}
            subtitle="Site issues, delays or difficulties"
            add="Add challenge"
            onAdd={() => set('challenge', v.challenge ? v.challenge + '\n' : '')}
          >
            <textarea
              rows={4}
              value={v.challenge}
              onChange={ev => set('challenge', ev.target.value)}
              className={cls}
              placeholder="Record challenges encountered during the work..."
            />
            <p className="text-xs text-slate-500">
              You can record multiple challenges on separate lines.
            </p>
          </Section>

          <Section title="Site Progress Pictures" icon={Camera} subtitle="Attach site photos and optional captions">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={ev => {
                const files = Array.from(ev.target.files ?? [])
                setPhotos(prev => [
                  ...prev,
                  ...files.map(file => ({ file, caption: '' })),
                ])
                ev.target.value = ''
              }}
            />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/30 bg-brand/5 p-5 text-sm font-medium text-brand hover:bg-brand/10"
            >
              <ImagePlus size={18} />Add site photos
            </button>

            <p className="text-xs text-slate-500">
              JPG, PNG or WEBP. Maximum 15 MB per image.
            </p>

            {photos.map((p, i) => (
              <div key={`${p.file.name}-${i}`} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <img
                  src={URL.createObjectURL(p.file)}
                  alt="Site preview"
                  className="h-20 w-20 rounded-lg object-cover"
                />

                <div className="flex-1">
                  <Field label="Caption">
                    <input
                      value={p.caption}
                      onChange={ev => upd(photos, setPhotos, i, { caption: ev.target.value })}
                      placeholder="Describe this photo"
                      className={cls}
                    />
                  </Field>
                  <p className="mt-1 truncate text-xs text-slate-500">{p.file.name}</p>
                </div>

                <Remove onClick={() => drop(photos, setPhotos, i)} />
              </div>
            ))}

            {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
          </Section>

          <Section title="Additional Comments" icon={MessageSquare} subtitle="Other observations or notes">
            <textarea
              rows={4}
              value={v.notes}
              onChange={ev => set('notes', ev.target.value)}
              className={cls}
              placeholder="Any additional comments..."
            />
          </Section>

          {code && (
            <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              Saving changes sends this report back to Pending. It must be approved again before it counts towards project totals.
            </p>
          )}

          {m.error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {errMsg(m.error)}
            </p>
          )}

          {touched && Object.keys(e).length > 0 && (
            <p className="text-sm text-red-600">
              Please fix the highlighted problems above.
            </p>
          )}

          <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:-mx-7 sm:px-7">
            <button
              type="button"
              onClick={tryClose}
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm transition hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              disabled={m.isPending}
              className="rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
            >
              {m.isPending ? 'Saving...' : code ? 'Save changes' : 'Add report'}
            </button>
          </div>
        </form>
      </Shell>

      {ask === 'save' && (
        <ConfirmDialog
          title={code ? `Save changes to report ${code}?` : 'Add this report?'}
          confirmLabel={code ? 'Yes, save changes' : 'Yes, add report'}
          busy={m.isPending}
          error={m.error ? errMsg(m.error) : undefined}
          onConfirm={() => m.mutate(build())}
          onCancel={() => {
            m.reset()
            setAsk(null)
          }}
        >
          {code
            ? 'Your changes replace the saved report. The report will be sent back for approval.'
            : `This adds a report for ${fd?.projects.find(p => p.id === v.project)?.name ?? v.project} (${v.site}, ${v.date}).`}
        </ConfirmDialog>
      )}

      {ask === 'discard' && (
        <ConfirmDialog
          danger
          title="Discard your changes?"
          confirmLabel="Yes, discard"
          cancelLabel="Keep editing"
          onConfirm={onClose}
          onCancel={() => setAsk(null)}
        >
          Everything you typed in this report will be lost.
        </ConfirmDialog>
      )}
    </>
  )
}