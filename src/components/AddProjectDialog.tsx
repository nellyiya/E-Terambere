import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { errMsg } from '../lib/api'
import { createProject, daysBetween, durationText, getSupervisorOptions, projectChangedKeys, updateProject, type Project, type ProjectInput, type Status } from '../services/projectsApi'
const cls = 'mt-1 w-full rounded-lg border px-3 py-2 text-sm'
const TYPES = ['Road construction', 'Bridge', 'Dam', 'Water supply', 'Irrigation', 'Building', 'School', 'Health facility', 'Other']
export default function AddProjectDialog({ onClose, project }: { onClose: () => void; project?: Project }) {
  const qc = useQueryClient(), nav = useNavigate()
  const [v, setV] = useState({ name: project?.name ?? '', type: project?.projectType ?? '', client: project?.client ?? '', consultant: project?.consultant ?? '', location: project?.location ?? '', start: project?.startDate ?? '', end: project?.endDate ?? '',
    value: project ? String(project.contractValue) : '', supervisorIds: project?.supervisors.map(s => s.id) ?? [], sites: String(project?.sites ?? 1), status: (project?.status ?? 'Planning') as Status })
  const [touched, setTouched] = useState(false)
  const { data: sups = [] } = useQuery({ queryKey: ['supervisor-options'], queryFn: getSupervisorOptions })
  const err: Record<string, string> = {}
  const n = Number(v.sites), cv = Number(v.value)
  if (v.name.trim().length < 3) err.name = 'Enter a project name of at least 3 characters.'
  if (v.type.trim().length < 2) err.type = 'Enter or choose the project type.'
  if (v.client.trim().length < 2) err.client = 'Enter the client.'
  if (v.consultant.trim() && v.consultant.trim().length < 2) err.consultant = 'Enter the consultant, or leave it empty.'
  if (v.location.trim().length < 2) err.location = 'Enter the project location.'
  if (!v.start) err.start = 'Choose the start date.'
  if (!v.end) err.end = 'Choose the expected completion date.'
  else if (v.start && v.end <= v.start) err.end = 'Expected completion must be after the start date.'
  if (!v.value || !Number.isFinite(cv) || cv <= 0 || cv > 1e12) err.value = 'Enter the contract value as a positive amount in RWF.'
  if (!Number.isInteger(n) || n < 1 || n > 50) err.sites = 'Enter a whole number from 1 to 50.'
  const days = v.start && v.end && v.end > v.start ? daysBetween(v.start, v.end) : null
  const m = useMutation({
    mutationFn: (d: ProjectInput) => (project ? updateProject(project.id, d) : createProject(d)),
    onSuccess: p => { projectChangedKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] })); onClose(); if (!project) nav(`/projects/${p.id}/overview`) } })
  const submit = (e: React.FormEvent) => { e.preventDefault(); setTouched(true); if (Object.keys(err).length) return
    m.mutate({ name: v.name.trim(), projectType: v.type.trim(), client: v.client.trim(), consultant: v.consultant.trim(), location: v.location.trim(), startDate: v.start, endDate: v.end, status: v.status, supervisorIds: v.supervisorIds, sites: n, contractValue: cv }) }
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value })
  const E = ({ k }: { k: string }) => touched && err[k] ? <p className="mt-1 text-xs text-red-600">{err[k]}</p> : null
  const b = (k: string) => (touched && err[k] ? 'border-red-400' : 'border-slate-200')
  return (<div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label={project ? 'Edit project' : 'Add project'}>
    <form onSubmit={submit} noValidate className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-auto rounded-2xl bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{project ? 'Edit project' : 'Add project'}</h2><button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100"><X size={18} /></button></div>
      <datalist id="project-types">{TYPES.map(t => <option key={t} value={t} />)}</datalist>
      <div className="grid grid-cols-2 gap-4">
        <label className="col-span-2 block text-sm">1. Project name<input value={v.name} onChange={set('name')} autoFocus className={`${cls} ${b('name')}`} /><E k="name" /></label>
        <label className="block text-sm">2. Project type<input list="project-types" value={v.type} onChange={set('type')} placeholder="Choose or type" className={`${cls} ${b('type')}`} /><E k="type" /></label>
        <label className="block text-sm">3. Client<input value={v.client} onChange={set('client')} className={`${cls} ${b('client')}`} /><E k="client" /></label>
        <label className="block text-sm">4. Consultant (optional)<input value={v.consultant} onChange={set('consultant')} className={`${cls} ${b('consultant')}`} /><E k="consultant" /></label>
        <label className="block text-sm">5. Project location<input value={v.location} onChange={set('location')} placeholder="e.g. Nyabarongo, Muhanga District" className={`${cls} ${b('location')}`} /><E k="location" /></label>
        <label className="block text-sm">6. Start date<input type="date" value={v.start} onChange={set('start')} className={`${cls} ${b('start')}`} /><E k="start" /></label>
        <label className="block text-sm">7. Expected completion<input type="date" value={v.end} min={v.start || undefined} onChange={set('end')} className={`${cls} ${b('end')}`} /><E k="end" /></label>
        <div className="text-sm">8. Project duration<div aria-live="polite" className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">{days ? durationText(days) : 'Calculated from the two dates'}</div></div>
        <label className="block text-sm">9. Contract value (RWF)<input type="number" min="0" value={v.value} onChange={set('value')} className={`${cls} ${b('value')}`} /><E k="value" /></label></div>
        <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-4">
        <label className="block text-sm col-span-2">Supervisors
          <div className="mt-1 space-y-1 rounded-lg border border-slate-200 p-2 max-h-40 overflow-y-auto">
            {sups.map(s => {
              const on = v.supervisorIds.includes(s.id)
              return <label key={s.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={on} onChange={() => setV({ ...v, supervisorIds: on ? v.supervisorIds.filter(id => id !== s.id) : [...v.supervisorIds, s.id] })} className="accent-brand" />
                <span className="text-sm">{s.name}</span>
              </label>
            })}
            {!sups.length && <span className="text-xs text-slate-400 px-2">No supervisors available</span>}
          </div>
        </label>
        <label className="block text-sm">Number of sites<input type="number" value={v.sites} onChange={set('sites')} className={`${cls} ${b('sites')}`} /><E k="sites" /></label>
        <label className="block text-sm">Status<select value={v.status} onChange={set('status')} className={`${cls} border-slate-200`}>{['Planning', 'Active', 'On Hold', 'Completed'].map(s => <option key={s}>{s}</option>)}</select></label></div>
      {m.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errMsg(m.error)}</p>}
      {touched && Object.keys(err).length > 0 && <p className="text-sm text-red-600">Please fix the highlighted problems above.</p>}
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
        <button disabled={m.isPending} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{m.isPending ? 'Saving…' : project ? 'Save changes' : 'Create project'}</button></div>
    </form></div>)
}
