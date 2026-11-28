import { useState, type CSSProperties, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Briefcase, Building2, CalendarDays, ClipboardCheck, Flag, FolderKanban, Hourglass, MapPin, Timer, UserCog, Users, Wallet, type LucideIcon } from 'lucide-react'
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
const GRAD = 'linear-gradient(145deg, #2fae9d 0%, #1c8578 52%, #0f4a43 100%)'
const Detail = ({ label, icon: I, children }: { label: string; icon: LucideIcon; children: ReactNode }) => (
  <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
    <span style={{ background: GRAD }} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-md shadow-brand/30 ring-2 ring-white"><I size={17} /></span>
    <div className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-0.5 break-words text-sm font-semibold text-[#1c2e4e]">{children || '–'}</dd></div>
  </div>)
// Same rounded white card as the dashboard panels: icon badge, title, short subtitle.
const Card = ({ title, sub, icon: I, i, className = '', children }: { title: string; sub: string; icon: LucideIcon; i: number; className?: string; children: ReactNode }) => (
  <div style={{ '--i': i } as CSSProperties} className={`rise card-shadow flex flex-col rounded-3xl border border-slate-200 bg-white p-5 ${className}`}>
    <div className="mb-4 flex items-start gap-3">
      <span style={{ background: GRAD }} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-md shadow-brand/30 ring-2 ring-white"><I size={18} /></span>
      <div><h2 className="font-semibold">{title}</h2><p className="mt-0.5 text-xs leading-relaxed text-slate-500">{sub}</p></div>
    </div>
    {children}
  </div>)
const pct100 = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)))
const tl = (p: Project) => {
  const a = ms(p.startDate), b = ms(p.endDate), now = Date.now()
  const ok = !isNaN(a) && !isNaN(b) && b > a, done = p.status === 'Completed'
  const pct = ok ? Math.max(0, Math.min(100, ((now - a) / (b - a)) * 100)) : 0
  const left = ok ? Math.ceil((b - now) / DAY) : 0
  const late = ok && !done && left < 0
  const note = !ok ? 'Start and end dates are not set.' : done ? 'Project completed.' : now < a ? `Starts in ${Math.ceil((a - now) / DAY)} days.` : late ? `${-left} days past the expected completion.` : `${left} days left, ${Math.round(pct)}% of the planned time has passed.`
  return { ok, done, pct, left, late, note }
}
const Tile = ({ label, value, sub, icon: I, i }: { label: string; value: ReactNode; sub?: string; icon: LucideIcon; i: number }) => (
  <div style={{ '--i': i } as CSSProperties} className="rise card-shadow flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg">
    <span style={{ background: GRAD }} className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-white shadow-md shadow-brand/30 ring-2 ring-white"><I size={21} /></span>
    <div className="min-w-0">
      <p className="text-xs font-semibold text-slate-600">{label}</p>
      <p className="truncate text-xl font-bold leading-tight tnum text-[#1c2e4e]">{value}</p>
      {sub && <p className="truncate text-[11px] text-slate-500">{sub}</p>}
    </div>
  </div>)
function Overview({ p }: { p: Project }) {
  const sites = useQuery({ queryKey: ['sites', p.id], queryFn: () => listSites(p.id) })
  const t = tl(p)
  const rings: [number, string, string][] = [
    [pct100(p.progress), 'Physical progress', 'Work done so far'],
    [pct100(p.financialProgress), 'Financial progress', 'Share of contract spent'],
  ]
  return (<div className="space-y-4">
    {/* HERO: contract value + timeline */}
    <div style={{ '--i': 0 } as CSSProperties} className="rise card-shadow rounded-3xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span style={{ background: GRAD }} className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-white shadow-md shadow-brand/30 ring-2 ring-white"><Wallet size={24} /></span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-600">Contract value</p>
            <p className="break-words text-3xl font-bold leading-tight tracking-tight tnum text-[#1c2e4e]">{rwf(p.contractValue)}</p>
            <p className="mt-0.5 text-sm text-slate-500">{[p.projectType, p.client].filter(Boolean).join(' · ') || '–'}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium bg-slate-100 text-slate-600`}><i className={`h-2 w-2 rounded-full ${dot[p.status] ?? 'bg-slate-400'}`} />{p.status}</span>
      </div>
      <div className="mt-6 border-t border-slate-100 pt-5">
        <div className="flex justify-between gap-4 text-sm">
          <div><p className="text-xs text-slate-500">Start</p><p className="mt-0.5 font-semibold tnum text-[#1c2e4e]">{dateText(p.startDate)}</p></div>
          <div className="text-right"><p className="text-xs text-slate-500">Expected completion</p><p className="mt-0.5 font-semibold tnum text-[#1c2e4e]">{dateText(p.endDate)}</p></div>
        </div>
        <div className="relative mt-4 h-2.5 rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${t.late ? 'bg-red-500' : 'bg-brand'}`} style={{ width: `${t.done ? 100 : t.pct}%`, transition: 'width 900ms ease' }} />
          {t.ok && !t.done && <span className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-4 ${t.late ? 'bg-red-500 ring-red-500/15' : 'bg-brand ring-brand/15'}`} style={{ left: `${t.pct}%` }} />}
        </div>
        <p className={`mt-4 inline-block rounded-xl px-4 py-2 text-sm ${t.late ? 'bg-red-50 font-medium text-red-700' : 'bg-slate-50 text-slate-500'}`}>{t.note}</p>
      </div>
    </div>

    {/* STAT CARDS */}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Tile i={1} icon={Timer} label="Duration" value={p.durationDays ? `${p.durationDays} days` : '–'} sub="Planned length" />
      <Tile i={2} icon={CalendarDays} label="Start date" value={dateText(p.startDate)} sub="Work begins" />
      <Tile i={3} icon={Flag} label="Expected completion" value={dateText(p.endDate)} sub="Planned finish" />
      <Tile i={4} icon={Hourglass} label="Time left" value={t.done ? 'Done' : !t.ok ? '–' : t.late ? `${-t.left} days late` : `${t.left} days`} sub={t.ok ? `${Math.round(t.pct)}% of time passed` : undefined} />
    </div>

    {/* PROGRESS + DETAILS */}
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card i={5} title="Progress" sub="Physical and financial progress" icon={ClipboardCheck}>
        <div className="flex flex-1 flex-col justify-around gap-5">
          {rings.map(([v, label, sub]) => (
            <div key={label} className="flex items-center gap-4">
              <Ring v={v} size={88} label={label} />
              <div><p className="text-sm font-semibold">{label}</p><p className="mt-0.5 text-xs text-slate-500">{sub}</p></div>
            </div>))}
        </div>
      </Card>
      <Card i={6} title="Project details" sub="Who is involved and where it is" icon={FolderKanban} className="lg:col-span-2">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Detail icon={Briefcase} label="Project type">{p.projectType}</Detail>
          <Detail icon={Building2} label="Client">{p.client}</Detail>
          <Detail icon={UserCog} label="Consultant">{p.consultant}</Detail>
          <Detail icon={MapPin} label="Location"><span className="capitalize">{(p.location ?? '').toLowerCase()}</span></Detail>
          <div className="sm:col-span-2">
            <Detail icon={Users} label="Supervisors">
              {p.supervisors.length
                ? <span className="mt-1.5 flex flex-wrap gap-2">{p.supervisors.map(s => (
                    <span key={s.id} className="inline-flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-xs font-medium capitalize ring-1 ring-slate-200">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-brand/10 text-[10px] font-semibold uppercase text-brand">{s.name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('')}</span>
                      {s.name.toLowerCase()}
                    </span>))}</span>
                : ''}
            </Detail>
          </div>
        </dl>
      </Card>
    </div>

    {/* SITES */}
    <Card i={7} title="Sites" sub={sites.data ? `${sites.data.length} ${sites.data.length === 1 ? 'site' : 'sites'} on this project` : 'Loading sites…'} icon={MapPin}>
      {!sites.data ? null : sites.data.length === 0
        ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No sites yet.</p>
        : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{sites.data.map(s => (
            <div key={s.name} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition hover:border-brand/30 hover:bg-brand/5">
              <p className="truncate font-semibold text-[#1c2e4e]">{s.name}</p>
              <p className="mt-1 text-xs text-slate-500">{s.reports} report{s.reports === 1 ? '' : 's'}{s.last_report ? ` · last ${dmy(s.last_report)}` : ''}</p>
            </div>))}</div>}
    </Card>
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