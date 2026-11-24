import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Check, Circle, Eye, EyeOff, Lock } from 'lucide-react'
import { errMsg } from '../lib/api'
import { checks } from '../lib/password'
import { changePassword } from '../services/authApi'
const input = 'mt-1 w-full max-w-md rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20'
export default function ChangePassword({ email }: { email: string }) {
  const [cur, setCur] = useState(''), [next, setNext] = useState(''), [again, setAgain] = useState(''), [show, setShow] = useState(false), [touched, setTouched] = useState(false), [done, setDone] = useState(false)
  const rules = checks(next, email), score = rules.filter(([, ok]) => ok).length, strong = score === rules.length
  const m = useMutation({ mutationFn: () => changePassword(cur, next), onSuccess: () => { setCur(''); setNext(''); setAgain(''); setTouched(false); setDone(true) } })
  const err: Record<string, string> = {}
  if (!cur) err.cur = 'Enter your current password.'
  if (!strong) err.next = 'The new password does not meet every rule yet.'
  if (next !== again) err.again = 'The two new passwords are not the same.'
  const t = show ? 'text' : 'password', b = (k: string) => (touched && err[k] ? 'border-red-400' : 'border-slate-200')
  return (<form noValidate onSubmit={e => { e.preventDefault(); setTouched(true); setDone(false); if (!Object.keys(err).length) m.mutate() }} className="rise card-shadow mt-6 max-w-3xl rounded-2xl border border-slate-200 bg-white p-6" style={{ '--i': 3 } as React.CSSProperties}>
    <div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand"><Lock size={18} /></span><div><h2 className="font-semibold">Password</h2><p className="text-sm text-slate-500">Change the password you sign in with. Other devices are signed out.</p></div></div>
    <div className="space-y-4">
      <label className="block text-sm">Current password<input type={t} autoComplete="current-password" value={cur} onChange={e => setCur(e.target.value)} className={`${input} ${b('cur')}`} />{touched && err.cur && <p className="mt-1 text-xs text-red-600">{err.cur}</p>}</label>
      <label className="block text-sm">New password<input type={t} autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} className={`${input} ${b('next')}`} /></label>
      <div className="max-w-md"><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all duration-300 ${strong ? 'bg-brand' : score >= 5 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${(score / rules.length) * 100}%` }} /></div>
        <p className="mt-1 text-xs text-slate-500">{!next ? 'Choose a strong password.' : strong ? 'Strong password.' : score >= 5 ? 'Almost there.' : 'Too weak.'}</p></div>
      <ul className="grid max-w-xl grid-cols-2 gap-x-6 gap-y-1 text-xs">{rules.map(([l, ok]) => <li key={l} className={`flex items-center gap-1.5 ${ok ? 'text-brand' : 'text-slate-500'}`}>{ok ? <Check size={13} /> : <Circle size={13} />}{l}</li>)}</ul>
      <label className="block text-sm">Repeat the new password<input type={t} autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} className={`${input} ${b('again')}`} />{touched && err.again && <p className="mt-1 text-xs text-red-600">{err.again}</p>}</label>
      <button type="button" onClick={() => setShow(!show)} className="flex items-center gap-2 text-sm text-brand">{show ? <EyeOff size={14} /> : <Eye size={14} />}{show ? 'Hide passwords' : 'Show passwords'}</button>
      {touched && err.next && <p className="text-xs text-red-600">{err.next}</p>}
      {m.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errMsg(m.error)}</p>}
      <div className="flex items-center gap-3"><button disabled={m.isPending} className="rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60">{m.isPending ? 'Changing…' : 'Change password'}</button><span aria-live="polite" className="text-sm text-brand">{done ? 'Password changed. Other devices were signed out.' : ''}</span></div></div></form>)
}
