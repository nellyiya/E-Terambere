import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
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
import { badge } from './Projects'
const mgmtTabs: [string, string][] = [['overview', 'Overview'], ['daily-reports', 'Daily Reports'], ['boq', 'BOQ'], ['equipment', 'Equipment'], ['casual-labour', 'Casual Labour'], ['material-costs', 'Material Costs'], ['other-costs', 'Other Costs'], ['subcontractors', 'Subcontractors']]
function Overview({ p }: { p: Project }) {
  const sites = useQuery({ queryKey: ['sites', p.id], queryFn: () => listSites(p.id) })
  return (<div className="space-y-6">
    <div className="grid grid-cols-3 gap-x-6 gap-y-5 rounded-2xl border border-slate-200 bg-white p-6">{([['Project type', p.projectType], ['Client', p.client], ['Consultant', p.consultant], ['Project location', p.location], ['Start date', dateText(p.startDate)], ['Expected completion', dateText(p.endDate)],
      ['Project duration', durationText(p.durationDays)], ['Contract value', rwf(p.contractValue)], ['Supervisors', p.supervisors.length ? p.supervisors.map(s => s.name).join(', ') : '–'], ['Status', p.status]] as [string, string][]).map(([l, v]) => <div key={l}><p className="text-xs text-slate-500">{l}</p><p className="mt-1 text-sm font-medium">{v || '–'}</p></div>)}</div>
    {sites.data && <div className="rounded-2xl border border-slate-200 bg-white p-6"><p className="mb-3 text-xs text-slate-500">Sites</p><div className="flex flex-wrap gap-3">{sites.data.map(s => <span key={s.name} className="rounded-xl bg-slate-50 px-4 py-2 text-sm"><b className="font-medium">{s.name}</b><span className="ml-2 text-xs text-slate-500">{s.reports} report{s.reports === 1 ? '' : 's'}{s.last_report ? ` · last ${dmy(s.last_report)}` : ''}</span></span>)}</div></div>}
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
  return (<div className="space-y-6"><div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between"><div><div className="flex items-center gap-3"><h1 className="text-2xl font-semibold">{p.name}</h1><span className={`rounded px-2 py-0.5 text-xs ${badge[p.status]}`}>{p.status}</span></div>
        <p className="mt-1 text-sm text-slate-500">{p.location} · Project ID: {p.id} · {p.supervisors.length ? `Supervisors: ${p.supervisors.map(s => s.name).join(', ')}` : 'No supervisor yet'}</p>
        <div className="mt-3 flex gap-2"><button onClick={() => setEditing(true)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">Edit project</button><button onClick={() => { del.reset(); setDeleting(true) }} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">Delete project</button></div></div>
</div>
      {tabs.length > 0 && <div className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200">{tabs.map(([s, l]) => <NavLink key={s} to={`${base}/${s}${search}`} className={({ isActive }) => `-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm ${isActive ? 'border-brand font-medium text-brand' : 'border-transparent text-slate-500'}`}>{l}</NavLink>)}</div>}</div>
    {body}
    {editing && <AddProjectDialog project={p} onClose={() => setEditing(false)} />}
    {deleting && <ConfirmDialog danger title={`Delete ${p.name}?`} confirmLabel="Yes, delete project" busy={del.isPending} error={del.error ? errMsg(del.error) : undefined} onConfirm={() => del.mutate()} onCancel={() => setDeleting(false)}>This removes the project and cannot be undone. Projects that already have reports can't be deleted.</ConfirmDialog>}</div>)
}