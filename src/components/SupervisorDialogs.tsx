import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, UserCog, UserPlus, X } from 'lucide-react'
import { errMsg } from '../lib/api'
import { createSupervisor, deleteSupervisor, updateSupervisor, type Supervisor } from '../services/supervisorsApi'
const cls = 'mt-1 w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20'
const GRAD = 'linear-gradient(145deg, #2fae9d 0%, #1c8578 52%, #0f4a43 100%)'
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
  const Icon = supervisor ? UserCog : UserPlus
  return (<div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={supervisor ? 'Edit supervisor' : 'Create supervisor account'}>
    <form noValidate onSubmit={e => { e.preventDefault(); setTouched(true); if (!Object.keys(errs).length) m.mutate() }} className="max-h-[92vh] w-full max-w-md space-y-5 overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <span style={{ background: GRAD }} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white shadow-md shadow-brand/30 ring-2 ring-white"><Icon size={19} /></span>
          <div>
            <h2 className="text-lg font-semibold leading-tight">{supervisor ? 'Edit supervisor' : 'Create supervisor account'}</h2>
            <p className="text-xs text-slate-500">{supervisor ? 'Update their details or reset the password' : 'They can sign in with the email and password below'}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"><X size={18} /></button>
      </div>
      <div className="space-y-4">
        {field('name', 'Full name')}{field('email', 'Email', 'email')}{field('phone', 'Phone')}
        {field('password', supervisor ? 'New password (optional)' : 'Temporary password', 'password', supervisor ? 'Leave empty to keep the current password.' : undefined)}
      </div>
      {m.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errMsg(m.error)}</p>}
      <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4">
        <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-5 py-2 text-sm transition hover:bg-slate-50">Cancel</button>
        <button disabled={m.isPending} className="rounded-full bg-brand px-6 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-60">{m.isPending ? 'Saving…' : supervisor ? 'Save changes' : 'Create account'}</button>
      </div>
    </form></div>)
}
export function SupervisorDelete({ supervisor, onClose, onDone }: { supervisor: Supervisor; onClose: () => void; onDone?: () => void }) {
  const qc = useQueryClient()
  const m = useMutation({ mutationFn: () => deleteSupervisor(supervisor.id), onSuccess: () => { refresh(qc); onClose(); onDone?.() } })
  return (<div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-label="Delete supervisor"><div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
    <div className="flex items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-100 text-red-600 ring-2 ring-white"><Trash2 size={19} /></span>
      <div>
        <h2 className="text-lg font-semibold leading-tight">Delete {supervisor.name}?</h2>
        <p className="mt-1.5 text-sm text-slate-600">This removes the account and cannot be undone. Supervisors who have projects or reports can't be deleted. Deactivate them instead.</p>
      </div>
    </div>
    {m.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errMsg(m.error)}</p>}
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button onClick={onClose} className="rounded-full border border-slate-200 px-5 py-2 text-sm transition hover:bg-slate-50">Cancel</button><button disabled={m.isPending} onClick={() => m.mutate()} className="rounded-full bg-red-600 px-6 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60">{m.isPending ? 'Deleting…' : 'Delete supervisor'}</button></div></div></div>)
}
