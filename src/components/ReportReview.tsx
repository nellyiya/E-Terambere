import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarDays, Check, ClipboardList, Clock, Download, Eye, FileText, HardHat, History as HistoryIcon, Image as ImageIcon, MapPin, MessageSquare, MoreVertical, Package, Pencil, Receipt, RefreshCw, RotateCcw, Timer, Trash2, UserRound, Users, Wallet, Wrench, X, type LucideIcon } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import { num } from './GroupTable'
import { errMsg } from '../lib/api'
import { dmy } from '../lib/period'
import { approveReport, getHistory, getReport, reportKeys, resubmitReport, returnReport } from '../services/reportsApi'
const PILL: Record<string, string> = { Pending: 'bg-amber-100 text-amber-700', Approved: 'bg-green-100 text-green-700', Returned: 'bg-red-100 text-red-700' }
export const StatusPill = ({ s }: { s: string }) => <span className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${PILL[s] ?? 'bg-slate-100 text-slate-600'}`}>{s}</span>
const when = (at: string) => new Date(at.endsWith('Z') ? at : at + 'Z').toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const LABEL: Record<string, string> = { submitted: 'Submitted', approved: 'Approved', returned: 'Returned for correction', resubmitted: 'Corrected and resubmitted', edited: 'Edited' }

// Fields the report API sends beyond the basic ones. All optional, so the view still works if one is missing.
type Extra = {
  supervisor?: string | null; notes?: string | null; reviewedAt?: string | null; reviewedBy?: string | null
  activityDetails?: { description: string; quantity?: string | null; location?: string | null }[]
  photos?: { url: string; caption?: string | null }[]
  work?: { itemNo: number; description: string; unit: string; quantity: number; amount: number }[]
  costs?: { category: string; description: string; amount: number }[]
}
type EquipExtra = { kind?: string | null; tripsSand?: number | null; tripsStones?: number | null; fuelOpening?: number | null }

const th = 'whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-slate-500', td = 'px-3 py-3 align-top'
const GRAD = 'linear-gradient(145deg, #2fae9d 0%, #1c8578 52%, #0f4a43 100%)'
const Sec = ({ t, icon: I, aside, children }: { t: string; icon: LucideIcon; aside?: React.ReactNode; children: React.ReactNode }) =>
  <section className="card-shadow rounded-3xl border border-slate-200 bg-white p-6"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span style={{ background: GRAD }} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-md shadow-brand/30 ring-2 ring-white"><I size={18} /></span><h3 className="font-semibold text-slate-900">{t}</h3></div>{aside}</div>{children}</section>
const None = ({ t = 'None recorded' }: { t?: string }) => <p className="text-sm text-slate-400">{t}</p>
const Tile = ({ k, v, icon: I }: { k: string; v: React.ReactNode; icon: LucideIcon }) =>
  <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5"><span style={{ background: GRAD }} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white shadow-md shadow-brand/30 ring-2 ring-white"><I size={18} /></span><div className="min-w-0"><div className="text-xs font-semibold text-slate-600">{k}</div><div className="mt-0.5 truncate font-bold text-slate-900">{v}</div></div></div>
const Stat = ({ k, v, unit, icon: I }: { k: string; v: React.ReactNode; unit?: string; icon: LucideIcon }) =>
  <div className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-4"><span style={{ background: GRAD }} className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-white shadow-md shadow-brand/30 ring-2 ring-white"><I size={20} /></span><div className="min-w-0"><div className="text-xs font-semibold text-slate-600">{k}</div><div className="tnum mt-0.5 truncate text-2xl font-bold leading-tight text-brand">{v}{unit && <span className="ml-1 text-sm font-medium text-slate-500">{unit}</span>}</div></div></div>
const Scroll = ({ children }: { children: React.ReactNode }) => <div className="-mx-1 overflow-x-auto px-1">{children}</div>
const Sub = ({ t }: { t: string }) => <h4 className="mb-2 text-xs font-medium text-slate-500">{t}</h4>
// Dialogs are drawn on <body>, not inside the table row, so they never inherit the row's text size, alignment or clipping.
const Portal = ({ children }: { children: React.ReactNode }) => createPortal(children, document.body)
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const row = 'border-t border-slate-100', foot = 'border-t border-slate-200 bg-slate-50 font-semibold'

function ReportView({ code, onClose }: { code: string; onClose: () => void }) {
  const rep = useQuery({ queryKey: ['report', code], queryFn: () => getReport(code) }), hist = useQuery({ queryKey: ['report-history', code], queryFn: () => getHistory(code) })
  useEffect(() => { // lock the page behind the dialog and let Escape close it
    const prev = document.body.style.overflow, key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.body.style.overflow = 'hidden'; window.addEventListener('keydown', key)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', key) }
  }, [onClose])
  const d = rep.data as (typeof rep.data & Extra) | undefined
  const eq = d ? (d.equipment as (typeof d.equipment[number] & EquipExtra)[]) : []
  const acts: { description: string; quantity?: string | null; location?: string | null }[] =
  d
    ? (d.activityDetails?.length
        ? d.activityDetails
        : d.activities.map(a => ({
            description: a.description,
            quantity: String(a.quantity),
            location: a.location,
          })))
    : []
  const received = d ? d.materials.filter(m => m.kind === 'received') : [], used = d ? d.materials.filter(m => m.kind === 'used') : []
  const headcount = d ? sum(d.workers.map(w => w.headcount)) : 0
const labour = d ? sum(d.workers.map(w => w.headcount * w.dailyWage)) : 0
const machineHrs = sum(eq.filter(e => (e.kind || 'Machine') === 'Machine').map(e => e.hours))
  const matTable = (rows: typeof received) => rows.length === 0 ? <None /> : <Scroll><table className="w-full min-w-[14rem] text-sm"><thead><tr><th className={th}>Material</th><th className={th}>Quantity</th></tr></thead>
    <tbody>{rows.map((m, i) => <tr key={i} className={row}><td className={td}>{m.name}</td><td className={`${td} tnum font-medium`}>{num(m.quantity)} {m.unit}</td></tr>)}</tbody></table></Scroll>
  return (<Portal><div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Report ${code}`} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white text-left text-sm shadow-2xl sm:max-h-[92dvh] sm:max-w-6xl sm:rounded-3xl">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3"><span style={{ background: GRAD }} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-md shadow-brand/30 ring-2 ring-white"><FileText size={18} /></span><h2 className="text-xl font-semibold tracking-tight text-slate-900">Report {code}</h2>{d && <StatusPill s={d.status} />}</div>
          {d && <p className="mt-1 line-clamp-2 break-words text-sm font-medium capitalize text-slate-500">{d.projectName.toLowerCase()}</p>}</div>
        <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:text-slate-900"><X size={16} /></button></div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-6 py-6">
        {rep.isLoading ? <p className="text-slate-500">Loading report…</p> : rep.error || !d ? <p className="rounded-xl bg-red-50 p-4 text-red-700">{errMsg(rep.error)}</p> : <div className="space-y-5">
          {d.status === 'Returned' && d.returnNote && <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800"><p><b>Returned for correction</b><span className="mt-0.5 block">{d.returnNote}</span></p></div>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile icon={CalendarDays} k="Date" v={dmy(d.date)} />
            <Tile icon={Clock} k="Working hours" v={d.startTime ? `${d.startTime} – ${d.endTime || '…'}` : '–'} />
            <Tile icon={MapPin} k="Site" v={d.site} />
            <Tile icon={UserRound} k="Supervisor" v={<span className="capitalize">{d.supervisor?.toLowerCase() || '–'}</span>} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat icon={Users} k="Workers on site" v={headcount} />
            <Stat icon={Wallet} k="Labour cost" v={num(labour)} unit="RWF" />
            <Stat icon={Timer} k="Machine hours" v={num(machineHrs)} unit="h" />
          </div>
          {d.reviewedBy && <p className="px-1 text-xs text-slate-500">Reviewed by <b className="font-medium text-slate-700">{d.reviewedBy}</b>{d.reviewedAt && ` · ${when(d.reviewedAt)}`}</p>}

          <Sec t="Work done" icon={ClipboardList}>{acts.length === 0 ? <None /> :
            <ol className="space-y-3">{acts.map((a, i) => <li key={i} className="flex gap-3"><span className="tnum mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">{i + 1}</span>
              <span className="min-w-0"><span className="break-words text-slate-800">{a.description}</span>
                {(a.quantity || a.location) && <span className="mt-0.5 block text-xs text-slate-500">{[a.quantity && `Quantity: ${a.quantity}`, a.location && `Location: ${a.location}`].filter(Boolean).join(' · ')}</span>}</span></li>)}</ol>}
            {!!d.work?.length && <div className="mt-5"><Sub t="Bill of quantities items completed" /><Scroll><table className="w-full min-w-[28rem] text-sm"><thead><tr><th className={th}>Item</th><th className={th}>Description</th><th className={th}>Quantity</th><th className={th}>Amount</th></tr></thead>
              <tbody>{d.work.map((w, i) => <tr key={i} className={row}><td className={td}>{w.itemNo}</td><td className={td}>{w.description}</td><td className={`${td} tnum`}>{num(w.quantity)} {w.unit}</td><td className={`${td} tnum font-medium`}>{num(w.amount)} RWF</td></tr>)}</tbody></table></Scroll></div>}</Sec>

          <Sec t="Equipment used" icon={Wrench}>{eq.length === 0 ? <None /> : <Scroll><table className="w-full min-w-[40rem] text-sm"><thead><tr><th className={th}>Equipment</th><th className={th}>Hours / trips</th><th className={th}>Opening</th><th className={th}>Received</th><th className={th}>Used</th><th className={th}>Balance</th></tr></thead>
            <tbody>{eq.map((e, i) => { const kind = e.kind || 'Machine'
const tool = kind === 'Tool'
const truck = kind === 'Truck'
              return <tr key={i} className={row}><td className={td}><div className="font-semibold capitalize text-slate-900">{e.name.toLowerCase()}</div><div className="text-xs capitalize text-slate-500">{kind}{e.details ? ` · ${e.details}` : ''}</div></td>
                <td className={`${td} tnum`}>{tool ? '–' : truck ? `Sand ${e.tripsSand ?? 0} · Stones ${e.tripsStones ?? 0}` : `${num(e.hours)} h`}</td>
                <td className={`${td} tnum`}>{tool || e.fuelOpening == null ? '–' : `${num(e.fuelOpening)} L`}</td><td className={`${td} tnum`}>{tool ? '–' : `${num(e.fuelReceived)} L`}</td><td className={`${td} tnum`}>{num(e.fuelUsed)} L</td><td className={`${td} tnum`}>{tool ? '–' : `${num(e.fuelBalance)} L`}</td></tr> })}</tbody>
            <tfoot><tr className={foot}><td className={td}>Total</td><td className={`${td} tnum`}>{num(machineHrs)} h</td><td className={td} /><td className={`${td} tnum`}>{num(sum(eq.map(e => e.fuelReceived)))} L</td><td className={`${td} tnum`}>{num(sum(eq.map(e => e.fuelUsed)))} L</td><td className={td} /></tr></tfoot></table></Scroll>}</Sec>

          <Sec t="Materials" icon={Package}><div className="grid gap-6 md:grid-cols-2"><div><Sub t="Received" />{matTable(received)}</div><div><Sub t="Used" />{matTable(used)}</div></div></Sec>

          <Sec t="Casual workers" icon={HardHat}>{d.workers.length === 0 ? <None /> : <Scroll><table className="w-full min-w-[26rem] text-sm"><thead><tr><th className={th}>Category</th><th className={th}>People</th><th className={th}>Wage per day</th><th className={th}>Line total</th></tr></thead>
            <tbody>{d.workers.map((w, i) => <tr key={i} className={row}><td className={td}>{w.role}</td><td className={`${td} tnum`}>{w.headcount}</td><td className={`${td} tnum`}>{num(w.dailyWage)} RWF</td><td className={`${td} tnum font-medium`}>{num(w.headcount * w.dailyWage)} RWF</td></tr>)}</tbody>
            <tfoot><tr className={foot}><td className={td}>Total</td><td className={`${td} tnum`}>{headcount}</td><td className={td} /><td className={`${td} tnum`}>{num(labour)} RWF</td></tr></tfoot></table></Scroll>}</Sec>

          {!!d.costs?.length && <Sec t="Costs recorded" icon={Receipt}><Scroll><table className="w-full min-w-[24rem] text-sm"><thead><tr><th className={th}>Category</th><th className={th}>Description</th><th className={th}>Amount</th></tr></thead>
            <tbody>{d.costs.map((c, i) => <tr key={i} className={row}><td className={`${td} capitalize`}>{c.category}</td><td className={td}>{c.description}</td><td className={`${td} tnum font-medium`}>{num(c.amount)} RWF</td></tr>)}</tbody></table></Scroll></Sec>}

          <Sec t="Challenges" icon={AlertTriangle}>{d.challenge?.trim() ? <ol className="space-y-2">{d.challenge.split('\n').filter(l => l.trim()).map((l, i) => <li key={i} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" /><span className="break-words text-slate-800">{l}</span></li>)}</ol> : <None />}</Sec>

          <Sec t="Site progress photos" icon={ImageIcon}>{d.photos?.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{d.photos.map((p, i) => <figure key={i} className="min-w-0"><a href={p.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-slate-200"><img src={p.url} alt={p.caption || `Site photo ${i + 1}`} loading="lazy" className="h-36 w-full object-cover transition duration-300 hover:scale-105" /></a>
            {p.caption && <figcaption className="mt-1.5 break-words text-xs text-slate-500">{p.caption}</figcaption>}</figure>)}</div> : <None t="No photos" />}</Sec>

          <Sec t="Comments" icon={MessageSquare}>{d.notes?.trim() ? <p className="whitespace-pre-wrap break-words text-slate-800">{d.notes}</p> : <None />}</Sec>

          <Sec t="History" icon={HistoryIcon}>{hist.isLoading ? <p className="text-slate-500">Loading…</p> : <ul className="relative space-y-4 border-l-2 border-slate-100 pl-5">{hist.data?.map((e, i) => <li key={i} className="relative"><span className="absolute -left-[1.62rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand ring-2 ring-brand/20" />
            <div className="font-medium text-slate-900">{LABEL[e.action] ?? e.action}</div><div className="text-xs text-slate-500">{e.by ?? 'unknown'} · {when(e.at)}</div>{e.note && <p className="mt-1 break-words rounded-lg bg-slate-50 px-3 py-2 text-slate-600">{e.note}</p>}</li>)}</ul>}</Sec>
        </div>}
      </div>
      <div className="flex shrink-0 justify-end border-t border-slate-200 bg-white px-6 py-3"><button onClick={onClose} className="rounded-full border border-slate-200 px-5 py-2 text-sm text-slate-700 transition hover:bg-slate-50">Close</button></div>
    </div></div></Portal>)
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c])
const tbl = (heads: string[], rows: unknown[][]) => rows.length ? `<table><thead><tr>${heads.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p class="none">None recorded</p>'

// "Download" opens a clean printable copy of the report: choose "Save as PDF" in the print window.
async function downloadReport(code: string) {
  const w = window.open('', '_blank')
  if (!w) throw new Error('Your browser blocked the download window. Allow pop-ups for this site and try again.')
  w.document.write(`<title>Report ${esc(code)}</title><p style="font-family:sans-serif;padding:24px">Preparing report…</p>`)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = await getReport(code)
    const acts: string[] = d.activityDetails?.length ? d.activityDetails.map((a: { description: string }) => a.description) : d.activities ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mats = (k: string) => (d.materials ?? []).filter((m: any) => m.kind === k).map((m: any) => [m.name, `${num(m.quantity)} ${m.unit}`])
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Report ${esc(code)}</title><style>
      body{font-family:Poppins,Arial,sans-serif;color:#0f172a;margin:32px;font-size:13px;line-height:1.5}
      h1{font-size:22px;margin:0}h2{font-size:14px;margin:26px 0 8px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
      .sub{color:#64748b;margin:4px 0 0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:18px}
      .grid div{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px}.grid small{display:block;color:#64748b;font-size:11px}
      table{width:100%;border-collapse:collapse}th{text-align:left;color:#64748b;font-weight:500;font-size:11px;padding:6px 8px;border-bottom:1px solid #e2e8f0}
      td{padding:7px 8px;border-bottom:1px solid #f1f5f9}.none{color:#94a3b8}ol{margin:0;padding-left:20px}
      @media print{body{margin:14mm}}</style></head><body>
      <h1>Report ${esc(code)}</h1><p class="sub">${esc(d.projectName)} · ${esc(d.status)}</p>
      <div class="grid"><div><small>Date</small>${esc(dmy(d.date))}</div><div><small>Working hours</small>${esc(d.startTime ? `${d.startTime} – ${d.endTime ?? ''}` : '–')}</div><div><small>Site</small>${esc(d.site)}</div>
      <div><small>Supervisor</small>${esc(d.supervisor || '–')}</div><div><small>Reviewed by</small>${esc(d.reviewedBy || '–')}</div></div>
      <h2>Work done</h2>${acts.length ? `<ol>${acts.map(a => `<li>${esc(a)}</li>`).join('')}</ol>` : '<p class="none">None recorded</p>'}
      <h2>Equipment used</h2>${tbl(['Equipment', 'Hours', 'Fuel received', 'Fuel used', 'Balance'], (d.equipment ?? []).map((e: { name: string; hours: number; fuelReceived: number; fuelUsed: number; fuelBalance: number }) => [e.name, `${num(e.hours)} h`, `${num(e.fuelReceived)} L`, `${num(e.fuelUsed)} L`, `${num(e.fuelBalance)} L`]))}
      <h2>Materials received</h2>${tbl(['Material', 'Quantity'], mats('received'))}
      <h2>Materials used</h2>${tbl(['Material', 'Quantity'], mats('used'))}
      <h2>Casual workers</h2>${tbl(['Category', 'People', 'Wage per day', 'Line total'], (d.workers ?? []).map((x: { role: string; headcount: number; dailyWage: number }) => [x.role, x.headcount, `${num(x.dailyWage)} RWF`, `${num(x.headcount * x.dailyWage)} RWF`]))}
      <h2>Challenges</h2><p>${d.challenge?.trim() ? esc(d.challenge).replace(/\n/g, '<br>') : '<span class="none">None recorded</span>'}</p>
      <h2>Comments</h2><p>${d.notes?.trim() ? esc(d.notes).replace(/\n/g, '<br>') : '<span class="none">None recorded</span>'}</p></body></html>`
    w.document.open(); w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 400)
  } catch (e) { w.close(); throw e }
}

const IconBtn = ({ icon: Icon, label, on, busy }: { icon: LucideIcon; label: string; on: (e: React.MouseEvent<HTMLButtonElement>) => void; busy?: boolean }) =>
  <button type="button" onClick={on} disabled={busy} aria-label={label} title={label} className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40"><Icon size={17} /></button>
const Item = ({ icon: Icon, t, on, tone }: { icon: LucideIcon; t: string; on: () => void; tone?: 'brand' | 'red' }) =>
  <button type="button" role="menuitem" onClick={on} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${tone === 'red' ? 'text-red-600 hover:bg-red-50' : tone === 'brand' ? 'font-medium text-brand hover:bg-brand/5' : 'text-slate-700 hover:bg-slate-50'}`}><Icon size={15} />{t}</button>
type Pos = { top?: number; bottom?: number; right: number }

// Row actions: View and Download stay visible, everything else (approve, return, edit, delete) lives in the ⋮ menu.
export function ReportActions({ r, onEdit, onDelete }: { r: { id: string; status: string; projectName: string }; onEdit?: () => void; onDelete?: () => void }) {
  const qc = useQueryClient(), [dlg, setDlg] = useState<'view' | 'approve' | 'return' | 'resubmit' | null>(null), [note, setNote] = useState(''), [menu, setMenu] = useState<Pos | null>(null), [dl, setDl] = useState(false)
  const done = () => { reportKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] })); setDlg(null); setNote('') }
  const approve = useMutation({ mutationFn: () => approveReport(r.id), onSuccess: done }), ret = useMutation({ mutationFn: () => returnReport(r.id, note.trim()), onSuccess: done }), resub = useMutation({ mutationFn: () => resubmitReport(r.id), onSuccess: done })
  const open = (d: typeof dlg) => { approve.reset(); ret.reset(); resub.reset(); setMenu(null); setDlg(d) }
  useEffect(() => { // close the menu on Escape, scroll or resize
    if (!menu) return
    const close = () => setMenu(null), key = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', key); window.addEventListener('scroll', close, true); window.addEventListener('resize', close)
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close) }
  }, [menu])
  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (menu) return setMenu(null)
    const b = e.currentTarget.getBoundingClientRect(), right = window.innerWidth - b.right
    setMenu(b.bottom + 260 > window.innerHeight ? { bottom: window.innerHeight - b.top + 6, right } : { top: b.bottom + 6, right })
  }
  const download = async () => { setDl(true); try { await downloadReport(r.id) } catch (e) { window.alert(errMsg(e)) } finally { setDl(false) } }
  return (<span className="inline-flex items-center justify-end gap-1 text-left">
    <IconBtn icon={Eye} label="View report" on={() => open('view')} />
    <IconBtn icon={Download} label="Download report" on={download} busy={dl} />
    <IconBtn icon={MoreVertical} label="More actions" on={toggle} />
    {menu && <Portal><div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
      <div role="menu" style={{ position: 'fixed', ...menu }} className="z-50 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
        {r.status === 'Pending' && <Item tone="brand" icon={Check} t="Approve" on={() => open('approve')} />}
        {r.status === 'Returned' && <Item tone="brand" icon={RefreshCw} t="Resubmit" on={() => open('resubmit')} />}
        {r.status !== 'Returned' && <Item icon={RotateCcw} t="Return for correction" on={() => open('return')} />}
        {onEdit && <Item icon={Pencil} t="Edit report" on={() => { setMenu(null); onEdit() }} />}
        {onDelete && <><div className="my-1 border-t border-slate-100" /><Item tone="red" icon={Trash2} t="Delete report" on={() => { setMenu(null); onDelete() }} /></>}
      </div></Portal>}
    {dlg === 'view' && <ReportView code={r.id} onClose={() => setDlg(null)} />}
    {dlg === 'approve' && <Portal><ConfirmDialog title={`Approve report ${r.id}?`} confirmLabel="Yes, approve" busy={approve.isPending} error={approve.error ? errMsg(approve.error) : undefined} onConfirm={() => approve.mutate()} onCancel={() => setDlg(null)}>Its workers, equipment and materials will count towards {r.projectName}'s totals and progress.</ConfirmDialog></Portal>}
    {dlg === 'return' && <Portal><ConfirmDialog danger title={`Return report ${r.id} for correction?`} confirmLabel="Yes, return it" confirmDisabled={note.trim().length < 3} busy={ret.isPending} error={ret.error ? errMsg(ret.error) : undefined} onConfirm={() => ret.mutate()} onCancel={() => setDlg(null)}>
      {r.status === 'Approved' ? 'It will stop counting towards the project totals until it is corrected, resubmitted and approved again. ' : 'It will not count until it is corrected, resubmitted and approved. '}Tell the supervisor what to fix:
      <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={3} autoFocus placeholder="e.g. The number of helpers looks wrong" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></ConfirmDialog></Portal>}
    {dlg === 'resubmit' && <Portal><ConfirmDialog title={`Resubmit report ${r.id}?`} confirmLabel="Yes, resubmit" busy={resub.isPending} error={resub.error ? errMsg(resub.error) : undefined} onConfirm={() => resub.mutate()} onCancel={() => setDlg(null)}>It goes back to Pending so it can be reviewed again. The same report is reused, nothing is duplicated.</ConfirmDialog></Portal>}</span>)
}
