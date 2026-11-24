import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Building2, User, type LucideIcon } from 'lucide-react'
import ChangePassword from '../components/ChangePassword'
import { Skeleton } from '../components/ui'
import { errMsg } from '../lib/api'
import { getSettings, saveSettings, type Settings as S } from '../services/settings'
const input = 'mt-1 w-full max-w-md rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20'
const Section = ({ t, d, icon: I, i, children }: { t: string; d: string; icon: LucideIcon; i: number; children: React.ReactNode }) => <section style={{ '--i': i } as React.CSSProperties} className="rise card-shadow rounded-2xl border border-slate-200 bg-white p-6"><div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand"><I size={18} /></span><div><h2 className="font-semibold">{t}</h2><p className="text-sm text-slate-500">{d}</p></div></div><div className="space-y-4">{children}</div></section>
export default function Settings() {
  const qc = useQueryClient()
  const { data, error, refetch } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const [v, setV] = useState<S | null>(null), [touched, setTouched] = useState(false), [saved, setSaved] = useState(false)
  useEffect(() => { if (data && !v) setV(data) }, [data, v])
  const m = useMutation({ mutationFn: saveSettings, onSuccess: s => { qc.setQueryData(['settings'], s); setSaved(true) } })
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Could not load settings. {errMsg(error)} <button onClick={() => refetch()} className="underline">Try again</button></div>
  if (!v) return <div className="max-w-3xl space-y-6"><Skeleton className="h-52" /><Skeleton className="h-40" /><Skeleton className="h-56" /></div>
  const errs: Record<string, string> = {}
  if (v.name.trim().length < 2) errs.name = 'Enter your name.'
  if (v.org.trim().length < 2) errs.org = 'Enter the organization name.'
  const edit = (p: Partial<S>) => { setV({ ...v, ...p }); setSaved(false) }
  const bd = (k: string) => (touched && errs[k] ? 'border-red-400' : 'border-slate-200')
  const err = (k: string) => touched && errs[k] ? <p className="mt-1 text-xs text-red-600">{errs[k]}</p> : null
  const toggles: [keyof S['notify'], string][] = [['flagged', 'Show reports I returned for correction in my notifications'], ['newReport', 'Show reports waiting for my review in my notifications'], ['weekly', 'Send a weekly summary']]
  return (<><form noValidate onSubmit={e => { e.preventDefault(); setTouched(true); if (!Object.keys(errs).length) m.mutate({ ...v, name: v.name.trim(), org: v.org.trim() }) }} className="max-w-3xl space-y-6">
    <Section t="Profile" d="Shown in the top bar." icon={User} i={0}>
      <label className="block text-sm">Name<input value={v.name} onChange={e => edit({ name: e.target.value })} className={`${input} ${bd('name')}`} />{err('name')}</label>
      <label className="block text-sm">Email (used to sign in)<input value={v.email} readOnly aria-readonly="true" className={`${input} cursor-not-allowed opacity-70`} /><p className="mt-1 text-xs text-slate-500">This is your sign-in email. Only the person who runs the server can change it.</p></label></Section>
    <Section t="Organization" d="The company that owns these projects." icon={Building2} i={1}>
      <label className="block text-sm">Organization name<input value={v.org} onChange={e => edit({ org: e.target.value })} className={`${input} ${bd('org')}`} />{err('org')}</label></Section>
    <Section t="Notifications" d="Choose which alerts you want." icon={Bell} i={2}>
      {toggles.map(([k, l]) => <label key={k} className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm transition hover:border-brand"><span>{l}</span><span className="relative inline-flex items-center"><input type="checkbox" className="peer sr-only" checked={v.notify[k]} onChange={e => edit({ notify: { ...v.notify, [k]: e.target.checked } })} /><span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2" /><span className="absolute left-0.5 h-5 w-5 rounded-full bg-[#fff] shadow transition peer-checked:translate-x-5" /></span></label>)}</Section>
    {m.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errMsg(m.error)}</p>}
    <div className="sticky bottom-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 card-shadow"><button disabled={m.isPending} className="rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60">{m.isPending ? 'Saving…' : 'Save changes'}</button><span aria-live="polite" className="text-sm text-brand">{saved ? 'All changes saved.' : ''}</span></div>
  </form><ChangePassword email={v.email} /></>)
}
