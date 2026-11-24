import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { errMsg } from '../lib/api'
import { createSupervisor, deleteSupervisor, updateSupervisor, type Supervisor } from '../services/supervisorsApi'
const cls = 'mt-1 w-full rounded-lg border px-3 py-2 text-sm'
const refresh = (qc: ReturnType<typeof useQueryClient>) => ['supervisors', 'supervisor', 'supervisor-options', 'projects', 'project'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
export function SupervisorDialog({ onClose, supervisor }: { onClose: () => void; supervisor?: Supervisor }) {
  const qc = useQueryClient()
  const [v, setV] = useState({ name: supervisor?.name ?? '', email: supervisor?.email ?? '', phone: supervisor?.phone ?? '', password: '' }), [touched, setTouched] = useState(false)
  const errs: Record<string, string> = {}
  if (v.name.trim().length < 3) errs.name = 'Enter a full name of at least 3 characters.'
  if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) errs.email = 'Enter a valid email address.'
  if (!/^\+?\d{9,15}$/.test(v.phone.trim())) errs.phone = 'Enter 9 to 15 digits, like +250788123456.'
  if (!supervisor && v.password.length < 8) errs.password = 'Use at least 8 characters.'
  if (supervisor && v.password && v.password.length < 8) errs.password = 'Use at least 8 characters, or leave it empty to keep the current one.'
  const m = useMutation({
    mutationFn: () => { const d = { name: v.name.trim(), email: v.email.trim(), phone: v.phone.trim(), password: v.password || undefined }; return supervisor ? updateSupervisor(supervisor.id, d) : createSupervisor(d) },
    onSuccess: () => { refresh(qc); onClose() } })
  const field = (k: keyof typeof v, label: string, type = 'text', hint?: string) => (
    <label className="block text-sm">{label}<input type={type} value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} autoComplete="off" className={`${cls} ${touched && errs[k] ? 'border-red-400' : 'border-slate-200'}`} />
      {touched && errs[k] ? <p className="mt-1 text-xs text-red-600">{errs[k]}</p> : hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}</label>)
  return (<div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40" role="dialog" aria-modal="true" aria-label={supervisor ? 'Edit supervisor' : 'Create supervisor account'}>
    <form noValidate onSubmit={e => { e.preventDefault(); setTouched(true); if (!Object.keys(errs).length) m.mutate() }} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{supervisor ? 'Edit supervisor' : 'Create supervisor account'}</h2><button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100"><X size={18} /></button></div>
      {field('name', 'Full name')}{field('email', 'Email', 'email')}{field('phone', 'Phone')}
      {field('password', supervisor ? 'New password (optional)' : 'Temporary password', 'password', supervisor ? 'Leave empty to keep the current password.' : undefined)}
      {m.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errMsg(m.error)}</p>}
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
        <button disabled={m.isPending} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{m.isPending ? 'Saving…' : supervisor ? 'Save changes' : 'Create account'}</button></div>
    </form></div>)
}
export function SupervisorDelete({ supervisor, onClose, onDone }: { supervisor: Supervisor; onClose: () => void; onDone?: () => void }) {
  const qc = useQueryClient()
  const m = useMutation({ mutationFn: () => deleteSupervisor(supervisor.id), onSuccess: () => { refresh(qc); onClose(); onDone?.() } })
  return (<div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40" role="alertdialog" aria-modal="true" aria-label="Delete supervisor"><div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
    <h2 className="text-lg font-semibold">Delete {supervisor.name}?</h2><p className="text-sm text-slate-600">This removes the account and cannot be undone. Supervisors who have projects or reports can't be deleted. Deactivate them instead.</p>
    {m.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errMsg(m.error)}</p>}
    <div className="flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={m.isPending} onClick={() => m.mutate()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{m.isPending ? 'Deleting…' : 'Delete supervisor'}</button></div></div></div>)
}
