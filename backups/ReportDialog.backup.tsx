import { useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import { errMsg } from '../lib/api'
import { createReport, getFilterData, getReport, getSuggestions, listBoq, reportKeys, updateReport, type ReportDetail, type ReportInput, type RStatus } from '../services/reportsApi'
const cls = 'mt-1 w-full rounded-lg border px-3 py-2 text-sm'
const small = 'rounded-lg border border-slate-200 px-2 py-1.5 text-sm'
const rwf = (n: number) => new Intl.NumberFormat('en-US').format(n) + ' RWF'
type Eq = { name: string; details: string; hours: string; received: string; used: string; balance: string }
type Mat = { kind: 'received' | 'used'; name: string; qty: string; unit: string }
type Wk = { role: string; count: string; wage: string }
type Bq = { boq: string; qty: string }
const Shell = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
    <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100"><X size={18} /></button></div>{children}</div></div>)
const Sec = ({ n, title, add, onAdd, disabled, children }: { n: number; title: string; add: string; onAdd: () => void; disabled?: boolean; children: ReactNode }) => (
  <section><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">{n}. {title}</h3>
    <button type="button" disabled={disabled} onClick={onAdd} className="flex items-center gap-1 text-sm text-brand disabled:text-slate-400"><Plus size={14} />{add}</button></div>{children}</section>)
const upd = <T,>(l: T[], set: (x: T[]) => void, i: number, p: Partial<T>) => set(l.map((x, j) => (j === i ? { ...x, ...p } : x)))
const drop = <T,>(l: T[], set: (x: T[]) => void, i: number) => set(l.filter((_, j) => j !== i))
const X_ = ({ onClick, label }: { onClick: () => void; label: string }) => <button type="button" onClick={onClick} aria-label={label} className="rounded p-1.5 hover:bg-slate-100"><X size={16} /></button>
export default function ReportDialog({ onClose, code, defaultProject }: { onClose: () => void; code?: string; defaultProject?: string }) {
  const detail = useQuery({ queryKey: ['report', code], queryFn: () => getReport(code!), enabled: !!code })
  const title = code ? `Edit report ${code}` : 'Add report'
  if (code && detail.isLoading) return <Shell title={title} onClose={onClose}><p className="text-sm text-slate-500">Loading report…</p></Shell>
  if (code && (detail.error || !detail.data)) return <Shell title={title} onClose={onClose}><p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errMsg(detail.error)}</p></Shell>
  return <Form title={title} onClose={onClose} initial={detail.data} code={code} defaultProject={defaultProject} />
}
function Form({ title, onClose, initial, code, defaultProject }: { title: string; onClose: () => void; initial?: ReportDetail; code?: string; defaultProject?: string }) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10), n = (x: number) => String(x)
  const [v, setV] = useState({ project: initial?.project ?? defaultProject ?? '', site: initial?.site ?? '', supervisor: initial?.supervisorId ? n(initial.supervisorId) : '', date: initial?.date ?? today, start: initial?.startTime ?? '', end: initial?.endTime ?? '', status: (initial?.status ?? 'Pending') as RStatus, challenge: initial?.challenge ?? '' })
  const [acts, setActs] = useState<string[]>(initial?.activities ?? [''])
  const [eq, setEq] = useState<Eq[]>(initial?.equipment.map(e => ({ name: e.name, details: e.details, hours: n(e.hours), received: n(e.fuelReceived), used: n(e.fuelUsed), balance: n(e.fuelBalance) })) ?? [])
  const [mats, setMats] = useState<Mat[]>(initial?.materials.map(m => ({ kind: m.kind, name: m.name, qty: n(m.quantity), unit: m.unit })) ?? [])
  const [wk, setWk] = useState<Wk[]>(initial?.workers.map(w => ({ role: w.role, count: n(w.headcount), wage: n(w.dailyWage) })) ?? [])
  const [bq, setBq] = useState<Bq[]>(initial?.work.map(w => ({ boq: n(w.boqItemId), qty: n(w.quantity) })) ?? [])
  const [touched, setTouched] = useState(false), [warn, setWarn] = useState<string[] | null>(null), [ask, setAsk] = useState<'save' | 'discard' | null>(null)
  const snap = JSON.stringify([v, acts, eq, mats, wk, bq]), base = useRef(snap), dirty = snap !== base.current  // has anything been typed?
  const { data: fd } = useQuery({ queryKey: ['filter-data'], queryFn: getFilterData })
  const { data: sg } = useQuery({ queryKey: ['suggestions'], queryFn: getSuggestions })
  const { data: boq = [] } = useQuery({ queryKey: ['boq', v.project], queryFn: () => listBoq(v.project), enabled: !!v.project })
  const sites = fd?.projects.find(p => p.id === v.project)?.sites ?? []
  const num = (s: string) => (s.trim() === '' ? 0 : Number(s))
  const e: Record<string, string> = {}
  if (!v.project) e.project = 'Choose a project.'
  if (!v.site) e.site = 'Choose a site.'
  if (!v.date || v.date > new Date(Date.now() + 864e5).toISOString().slice(0, 10)) e.date = 'Enter a date that is not in the future.'
  if (v.start && v.end && v.end <= v.start) e.end = 'Work end must be after work started.'
  if (!acts.some(a => a.trim().length >= 2)) e.acts = 'Describe at least one piece of work done.'
  if (eq.some(x => x.name.trim().length < 2 || [x.hours, x.received, x.used, x.balance].some(t => !(num(t) >= 0)))) e.eq = 'Each equipment line needs a name, and hours and fuel must be 0 or more.'
  if (mats.some(m => m.name.trim().length < 2 || !m.unit.trim() || !(num(m.qty) >= 0))) e.mats = 'Each material needs a name, a quantity (0 or more) and a unit.'
  if (wk.some(w => w.role.trim().length < 2 || !Number.isInteger(num(w.count)) || num(w.count) < 0 || !Number.isInteger(num(w.wage)) || num(w.wage) < 0)) e.wk = 'Each worker line needs a role, a whole number of people and a wage per day.'
  if (bq.some(b => !b.boq || !(Number(b.qty) > 0))) e.bq = 'Each line needs an item and a quantity above 0.'
  else if (new Set(bq.map(b => b.boq)).size !== bq.length) e.bq = 'Each item can be used only once per report.'
  const labor = wk.reduce((a, w) => a + num(w.count) * num(w.wage), 0)
  const m = useMutation({
    mutationFn: (d: ReportInput) => (code ? updateReport(code, d) : createReport(d)),
    onSuccess: r => { reportKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] })); ['suggestions', 'boq'].forEach(k => qc.invalidateQueries({ queryKey: [k] })); setAsk(null); r.warnings?.length ? setWarn(r.warnings) : onClose() } })
  const build = (): ReportInput => { const list = acts.map(x => x.trim()).filter(Boolean)
    return { project: v.project, site: v.site, supervisorId: v.supervisor ? Number(v.supervisor) : null, date: v.date, activity: list[0].slice(0, 120), status: v.status, startTime: v.start, endTime: v.end, challenge: v.challenge.trim(), activities: list,
      equipment: eq.map(x => ({ name: x.name.trim(), details: x.details.trim(), hours: num(x.hours), fuelReceived: num(x.received), fuelUsed: num(x.used), fuelBalance: num(x.balance) })),
      materials: mats.map(x => ({ kind: x.kind, name: x.name.trim(), quantity: num(x.qty), unit: x.unit.trim() })), workers: wk.map(w => ({ role: w.role.trim(), headcount: num(w.count), dailyWage: num(w.wage) })),
      work: bq.map(x => ({ boqItemId: Number(x.boq), quantity: Number(x.qty) })) } }
  const submit = (ev: React.FormEvent) => { ev.preventDefault(); setTouched(true); if (Object.keys(e).length) return; m.reset(); setAsk('save') }
  const tryClose = () => (dirty && !m.isPending ? setAsk('discard') : onClose())
  const set = (k: keyof typeof v, val: string) => setV(p => ({ ...p, [k]: val, ...(k === 'project' ? { site: '' } : {}) }))
  const Err = ({ k }: { k: string }) => touched && e[k] ? <p className="mt-1 text-xs text-red-600">{e[k]}</p> : null
  const b = (k: string) => (touched && e[k] ? 'border-red-400' : 'border-slate-200')
  if (warn) return <Shell title="Report saved" onClose={onClose}><p className="mb-2 text-sm">The report was saved. Please check these fuel balances:</p><ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-amber-700">{warn.map(w => <li key={w}>{w}</li>)}</ul><div className="flex justify-end"><button onClick={onClose} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">Close</button></div></Shell>
  return (<><Shell title={title} onClose={tryClose}><form onSubmit={submit} noValidate className="space-y-6">
    <datalist id="eq-names">{sg?.equipment.map(x => <option key={x} value={x} />)}</datalist><datalist id="mat-names">{sg?.materials.map(x => <option key={x} value={x} />)}</datalist><datalist id="roles">{sg?.roles.map(x => <option key={x.role} value={x.role} />)}</datalist>
    <div className="grid grid-cols-3 gap-4">
      <label className="block text-sm">Project<select disabled={!!code} value={v.project} onChange={ev => { set('project', ev.target.value); setBq([]) }} className={`${cls} ${b('project')} disabled:bg-slate-50`}><option value="">Select…</option>{fd?.projects.map(p => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}</select><Err k="project" /></label>
      <label className="block text-sm">Site<select value={v.site} disabled={!v.project} onChange={ev => set('site', ev.target.value)} className={`${cls} ${b('site')}`}><option value="">Select…</option>{sites.map(s => <option key={s}>{s}</option>)}</select><Err k="site" /></label>
      <label className="block text-sm">Date<input type="date" value={v.date} onChange={ev => set('date', ev.target.value)} className={`${cls} ${b('date')}`} /><Err k="date" /></label>
      <label className="block text-sm">Work started<input type="time" value={v.start} onChange={ev => set('start', ev.target.value)} className={`${cls} border-slate-200`} /></label>
      <label className="block text-sm">Work end<input type="time" value={v.end} onChange={ev => set('end', ev.target.value)} className={`${cls} ${b('end')}`} /><Err k="end" /></label>
      <label className="block text-sm">Supervisor<select value={v.supervisor} onChange={ev => set('supervisor', ev.target.value)} className={`${cls} border-slate-200`}><option value="">None</option>{fd?.supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
    <Sec n={1} title="Work done (including quantities and location)" add="Add line" onAdd={() => setActs([...acts, ''])}>
      {acts.map((a, i) => <div key={i} className="mb-2 flex gap-2"><span className="w-5 pt-2 text-sm text-slate-500">{i + 1}.</span><input value={a} onChange={ev => setActs(acts.map((x, j) => (j === i ? ev.target.value : x)))} placeholder="e.g. Retaining wall construction at CH 14+120" className={`${small} flex-1`} />{acts.length > 1 && <X_ onClick={() => drop(acts, setActs, i)} label="Remove line" />}</div>)}<Err k="acts" /></Sec>
    <Sec n={2} title="Equipment used" add="Add equipment" onAdd={() => setEq([...eq, { name: '', details: '', hours: '', received: '', used: '', balance: '' }])}>
      {eq.map((x, i) => <div key={i} className="mb-2 space-y-2 rounded-xl border border-slate-200 p-3"><div className="flex gap-2"><input list="eq-names" value={x.name} onChange={ev => upd(eq, setEq, i, { name: ev.target.value })} placeholder="Machine and plate, e.g. Excavator 320 (RAH993U)" className={`${small} flex-1`} /><input value={x.details} onChange={ev => upd(eq, setEq, i, { details: ev.target.value })} placeholder="Work, e.g. Loading trucks, 2 trips of sand" className={`${small} flex-1`} /><X_ onClick={() => drop(eq, setEq, i)} label="Remove equipment" /></div>
        <div className="grid grid-cols-4 gap-2">{([['hours', 'Time (hours)'], ['received', 'Fuel received (L)'], ['used', 'Fuel used (L)'], ['balance', 'Balance (L)']] as const).map(([k, l]) => <input key={k} type="number" min="0" step="any" aria-label={l} placeholder={l} value={x[k]} onChange={ev => upd(eq, setEq, i, { [k]: ev.target.value })} className={small} />)}</div></div>)}<Err k="eq" /></Sec>
    <Sec n={3} title="Materials received and used" add="Add material" onAdd={() => setMats([...mats, { kind: 'received', name: '', qty: '', unit: '' }])}>
      {mats.map((x, i) => <div key={i} className="mb-2 flex gap-2"><select value={x.kind} onChange={ev => upd(mats, setMats, i, { kind: ev.target.value as 'received' | 'used' })} className={`${small} w-28`}><option value="received">Received</option><option value="used">Used</option></select>
        <input list="mat-names" value={x.name} onChange={ev => upd(mats, setMats, i, { name: ev.target.value })} placeholder="Material, e.g. Sand" className={`${small} flex-1`} /><input type="number" min="0" step="any" value={x.qty} onChange={ev => upd(mats, setMats, i, { qty: ev.target.value })} placeholder="Quantity" className={`${small} w-28`} /><input value={x.unit} onChange={ev => upd(mats, setMats, i, { unit: ev.target.value })} placeholder="Unit, e.g. m³" className={`${small} w-24`} /><X_ onClick={() => drop(mats, setMats, i)} label="Remove material" /></div>)}<Err k="mats" /></Sec>
    <Sec n={4} title="Casual workers (number of people and wage per day)" add="Add workers" onAdd={() => setWk([...wk, { role: '', count: '', wage: '' }])}>
      {wk.map((w, i) => <div key={i} className="mb-2 flex items-center gap-2"><input list="roles" value={w.role} onChange={ev => { const known = sg?.roles.find(r => r.role === ev.target.value); upd(wk, setWk, i, { role: ev.target.value, ...(known && !w.wage ? { wage: n(known.daily_wage) } : {}) }) }} placeholder="Role, e.g. Masons" className={`${small} flex-1`} />
        <input type="number" min="0" value={w.count} onChange={ev => upd(wk, setWk, i, { count: ev.target.value })} placeholder="People" className={`${small} w-24`} /><input type="number" min="0" value={w.wage} onChange={ev => upd(wk, setWk, i, { wage: ev.target.value })} placeholder="Wage per day (RWF)" className={`${small} w-44`} />
        <span className="w-28 text-right text-xs text-slate-500">{rwf(num(w.count) * num(w.wage))}</span><X_ onClick={() => drop(wk, setWk, i)} label="Remove workers" /></div>)}
      {wk.length > 0 && <p className="text-right text-sm font-medium">Labor cost for this day: {rwf(labor)}</p>}<Err k="wk" /></Sec>
    <Sec n={5} title="Progress against bill of quantities (optional)" add="Add item" disabled={!boq.length} onAdd={() => setBq([...bq, { boq: '', qty: '' }])}>
      {!v.project ? <p className="text-xs text-slate-500">Choose a project first.</p> : !boq.length && <p className="text-xs text-slate-500">This project has no bill of quantities items yet. They are added on the Work Done page.</p>}
      {bq.map((x, i) => <div key={i} className="mb-2 flex gap-2"><select value={x.boq} onChange={ev => upd(bq, setBq, i, { boq: ev.target.value })} className={`${small} flex-1`}><option value="">Select item…</option>{boq.map(o => <option key={o.id} value={o.id}>{o.item_no}. {o.description} ({o.unit})</option>)}</select>
        <input type="number" step="any" min="0" placeholder="Quantity done" value={x.qty} onChange={ev => upd(bq, setBq, i, { qty: ev.target.value })} className={`${small} w-36`} /><X_ onClick={() => drop(bq, setBq, i)} label="Remove item" /></div>)}<Err k="bq" /></Sec>
    <label className="block text-sm font-semibold">Challenge<textarea value={v.challenge} onChange={ev => set('challenge', ev.target.value)} rows={2} className={`${cls} border-slate-200 font-normal`} /></label>
    {code && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Saving a change sends this report back to Pending, so it has to be approved again before it counts towards the project totals.</p>}
    {m.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errMsg(m.error)}</p>}
    {touched && Object.keys(e).length > 0 && <p className="text-sm text-red-600">Please fix the highlighted problems above.</p>}
    <div className="flex justify-end gap-2"><button type="button" onClick={tryClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
      <button disabled={m.isPending} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{m.isPending ? 'Saving…' : code ? 'Save changes' : 'Add report'}</button></div>
  </form></Shell>
    {ask === 'save' && <ConfirmDialog title={code ? `Save changes to report ${code}?` : 'Add this report?'} confirmLabel={code ? 'Yes, save changes' : 'Yes, add report'} busy={m.isPending} error={m.error ? errMsg(m.error) : undefined} onConfirm={() => m.mutate(build())} onCancel={() => { m.reset(); setAsk(null) }}>
      {code ? "Your changes replace what is saved now. They update this project's progress, labor cost and fuel figures." : `This adds a report for ${fd?.projects.find(p => p.id === v.project)?.name ?? v.project} (${v.site}, ${v.date}). It will count towards the project's progress and costs.`}</ConfirmDialog>}
    {ask === 'discard' && <ConfirmDialog danger title="Discard your changes?" confirmLabel="Yes, discard" cancelLabel="Keep editing" onConfirm={onClose} onCancel={() => setAsk(null)}>Everything you typed in this report will be lost.</ConfirmDialog>}
  </>)
}
