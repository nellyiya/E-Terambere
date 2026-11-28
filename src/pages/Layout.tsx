import { useState, type CSSProperties, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, ClipboardCheck, FolderKanban, Flag, MapPin, Timer, Wallet, type LucideIcon } from 'lucide-react'
import StatStrip from '../components/StatStrip'
import AddProjectDialog from '../components/AddProjectDialog'
import ConfirmDialog from '../components/ConfirmDialog'
import ProjectBoq from '../components/ProjectBoq'
import ProjectOtherCosts from '../components/ProjectOtherCosts'
import ProjectProgress from '../components/ProjectProgress'
import ProjectReports from '../components/ProjectReports'
import { ProjectEquipment, ProjectLabour, ProjectMaterials } from '../components/ProjectSections'
import ProjectSubcontractors from '../components/ProjectSubcontractors'
import { errMsg } from '../lib/api'
import { dmy } from '../lib/period'
import { rwf } from '../services/costs'
import { dateText, deleteProject, durationText, getProject, listSites, projectChangedKeys, type Project } from '../services/projectsApi'
import { dot, Ring } from './Projects'
const mgmtTabs: [string, string][] = [['overview', 'Overview'], ['daily-reports', 'Daily Reports'], ['boq', 'BOQ'], ['equipment', 'Equipment'], ['casual-labour', 'Casual Labour'], ['material-costs', 'Material Costs'], ['other-costs', 'Other Costs'], ['subcontractors', 'Subcontractors']]
const DAY = 864e5
const ms = (v: unknown) => (typeof v === 'string' && v ? Date.parse(v) : NaN)
const Detail = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0 rounded-2xl bg-slate-50 px-4 py-3">
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd className="mt-1 break-words text-sm font-semibold text-[#1c2e4e]">{children || '–'}</dd>
  </div>)
// Same rounded white card as the dashboard panels: icon badge, title, short subtitle.
const Card = ({ title, sub, icon: I, i, className = '', children }: { title: string; sub: string; icon: LucideIcon; i: number; className?: string; children: ReactNode }) => (
  <div style={{ '--i': i } as CSSProperties} className={`rise card-shadow flex flex-col rounded-3xl border border-slate-200 bg-white p-5 ${className}`}>
    <div className="mb-4 flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><I size={18} /></span>
      <div><h2 className="font-semibold">{title}</h2><p className="mt-0.5 text-xs leading-relaxed text-slate-500">{sub}</p></div>
    </div>
    {children}
  </div>)
const pct100 = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)))
function Timeline({ p }: { p: Project }) {
  const a = ms(p.startDate), b = ms(p.endDate), now = Date.now()
  const ok = !isNaN(a) && !isNaN(b) && b > a, done = p.status === 'Completed'
  const pct = ok ? Math.max(0, Math.min(100, ((now - a) / (b - a)) * 100)) : 0
  const left = ok ? Math.ceil((b - now) / DAY) : 0
  const late = ok && !done && left < 0
  const note = !ok ? 'Start and end dates are not set.' : done ? 'Project completed.' : now < a ? `Starts in ${Math.ceil((a - now) / DAY)} days.` : late ? `${-left} days past the expected completion.` : `${left} days left, ${Math.round(pct)}% of the planned time has passed.`
  return (<div className="flex flex-1 flex-col justify-center">
    <div className="flex justify-between gap-4 text-sm">
      <div><p className="text-xs text-slate-500">Start</p><p className="mt-0.5 font-semibold tnum">{dateText(p.startDate)}</p></div>
      <div className="text-right"><p className="text-xs text-slate-500">Expected completion</p><p className="mt-0.5 font-semibold tnum">{dateText(p.endDate)}</p></div>
    </div>
    <div className="relative mt-5 h-2.5 rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${late ? 'bg-red-500' : 'bg-brand'}`} style={{ width: `${done ? 100 : pct}%`, transition: 'width 900ms ease' }} />
      {ok && !done && <span className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${late ? 'bg-red-500' : 'bg-brand'}`} style={{ left: `${pct}%` }} />}
    </div>
    <p className={`mt-4 inline-flex w-fit rounded-xl px-4 py-2 text-sm ${late ? 'bg-red-50 font-medium text-red-700' : 'bg-slate-50 text-slate-500'}`}>{note}</p>
  </div>)
}
function Overview({ p }: { p: Project }) {
  const sites = useQuery({ queryKey: ['sites', p.id], queryFn: () => listSites(p.id) })
  const rings: [number, string, string][] = [
    [pct100(p.progress), 'Physical progress', 'Work done so far'],
    [pct100(p.financialProgress), 'Financial progress', 'Share of contract spent'],
  ]
  return (<div className="space-y-4">
    {/* TOP: KEY NUMBERS */}
    <StatStrip i={0} items={[
      { label: 'Contract value', value: rwf(p.contractValue), icon: Wallet },
      { label: 'Duration', value: p.durationDays ? `${p.durationDays} days` : '–', icon: Timer },
      { label: 'Start date', value: dateText(p.startDate), icon: CalendarDays },
      { label: 'Expected completion', value: dateText(p.endDate), icon: Flag },
    ]} />

    {/* MIDDLE: TIMELINE + PROGRESS */}
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card i={1} title="Timeline" sub="How much of the planned time has passed" icon={CalendarDays} className="lg:col-span-2">
        <Timeline p={p} />
      </Card>
      <Card i={2} title="Progress" sub="Physical and financial progress of this project" icon={ClipboardCheck}>
        <div className="flex flex-1 flex-col justify-around gap-5">
          {rings.map(([v, label, sub]) => (
            <div key={label} className="flex items-center gap-4">
              <Ring v={v} size={84} label={label} />
              <div><p className="text-sm font-semibold">{label}</p><p className="mt-0.5 text-xs text-slate-500">{sub}</p></div>
            </div>))}
        </div>
      </Card>
    </div>

    {/* BOTTOM: DETAILS + SITES */}
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card i={3} title="Project details" sub="Who is involved and where it is" icon={FolderKanban} className="lg:col-span-2">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Detail label="Project type">{p.projectType}</Detail>
          <Detail label="Client">{p.client}</Detail>
          <Detail label="Consultant">{p.consultant}</Detail>
          <Detail label="Location"><span className="capitalize">{(p.location ?? '').toLowerCase()}</span></Detail>
          <div className="sm:col-span-2">
            <Detail label="Supervisors">
              {p.supervisors.length
                ? <span className="mt-1 flex flex-wrap gap-2">{p.supervisors.map(s => (
                    <span key={s.id} className="inline-flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-xs font-medium capitalize ring-1 ring-slate-200">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-brand/10 text-[10px] font-semibold uppercase text-brand">{s.name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('')}</span>
                      {s.name.toLowerCase()}
                    </span>))}</span>
                : ''}
            </Detail>
          </div>
        </dl>
      </Card>

      <Card i={4} title="Sites" sub={sites.data ? `${sites.data.length} ${sites.data.length === 1 ? 'site' : 'sites'} on this project` : 'Loading sites…'} icon={MapPin}>
        {!sites.data ? null : sites.data.length === 0
          ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No sites yet.</p>
          : <ul className="space-y-2">{sites.data.map(s => (
              <li key={s.name} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                <span className="min-w-0 truncate font-medium">{s.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{s.reports} report{s.reports === 1 ? '' : 's'}{s.last_report ? ` · ${dmy(s.last_report)}` : ''}</span>
              </li>))}</ul>}
      </Card>
    </div>
  </div>)
}
export default function ProjectWorkspace() {
  const { projectId = '', tab = 'overview' } = useParams(), { search, pathname } = useLocation()
  const base = pathname.startsWith('/project-management') ? `/project-management/${projectId}` : `/projects/${projectId}`
  const qc = useQueryClient(), nav = useNavigate(), [editing, setEditing] = useState(false), [deleting, setDeleting] = useState(false)
  const { data: p, isLoading, error, refetch } = useQuery({ queryKey: ['project', projectId], queryFn: () => getProject(projectId) })
  const backTo = pathname.startsWith('/project-management') ? '/project-management' : '/projects'
  const del = useMutation({ mutationFn: () => deleteProject(projectId), onSuccess: () => { qc.removeQueries({ queryKey: ['project', projectId] }); projectChangedKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] })); nav(backTo) } })
  if (isLoading) return <p className="text-sm text-slate-500">Loading project…</p>
  if (error || !p) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{errMsg(error ?? new Error('not found'))} <button onClick={() => refetch()} className="underline">Try again</button></div>
  const isMgmt = pathname.startsWith('/project-management')
  const tabs = isMgmt ? mgmtTabs : [['progress', 'Progress'] as [string, string]]
  const body = ({ 'daily-reports': isMgmt ? <ProjectReports id={p.id} /> : undefined, boq: isMgmt ? <ProjectBoq id={p.id} /> : undefined, equipment: isMgmt ? <ProjectEquipment id={p.id} /> : undefined, 'casual-labour': isMgmt ? <ProjectLabour id={p.id} /> : undefined, 'material-costs': isMgmt ? <ProjectMaterials id={p.id} /> : undefined,
    'other-costs': isMgmt ? <ProjectOtherCosts id={p.id} /> : undefined, subcontractors: isMgmt ? <ProjectSubcontractors id={p.id} /> : undefined, progress: <ProjectProgress id={p.id} /> }[tab] ?? <Overview p={p} />)
  return (<div className="space-y-6">
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand text-white"><FolderKanban size={22} /></span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold capitalize leading-snug tracking-tight">{p.name.toLowerCase()}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5 text-slate-600"><i className={`h-2 w-2 rounded-full ${dot[p.status] ?? 'bg-slate-400'}`} />{p.status}</span>
              <span aria-hidden>·</span><span className="capitalize">{(p.location ?? '').toLowerCase() || '–'}</span>
              <span aria-hidden>·</span><span>{p.id}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(true)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm transition hover:border-brand hover:text-brand">Edit project</button>
          <button onClick={() => { del.reset(); setDeleting(true) }} className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm text-red-700 transition hover:bg-red-50">Delete project</button>
        </div>
      </div>
      {tabs.length > 0 && <div className="mt-6 flex gap-6 overflow-x-auto border-b border-slate-200">{tabs.map(([s, l]) => <NavLink key={s} to={`${base}/${s}${search}`} className={({ isActive }) => `-mb-px whitespace-nowrap border-b-2 pb-3 text-sm transition ${isActive ? 'border-brand font-medium text-brand' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{l}</NavLink>)}</div>}
    </div>
    {body}
    {editing && <AddProjectDialog project={p} onClose={() => setEditing(false)} />}
    {deleting && <ConfirmDialog danger title={`Delete ${p.name}?`} confirmLabel="Yes, delete project" busy={del.isPending} error={del.error ? errMsg(del.error) : undefined} onConfirm={() => del.mutate()} onCancel={() => setDeleting(false)}>This removes the project and cannot be undone. Projects that already have reports can't be deleted.</ConfirmDialog>}</div>)
}