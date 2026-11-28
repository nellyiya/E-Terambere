import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { getSettings } from '../services/settings'
import { getNotices, markRead, readIds } from '../services/topbarApi'
import { useOutside } from './useOutside'
export default function Notifications() {
  const nav = useNavigate(), qc = useQueryClient()
  const [open, setOpen] = useState(false), [, tick] = useState(0)
  const ref = useOutside<HTMLDivElement>(() => setOpen(false))
  const { data: me } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const { data = [], isLoading, error, refetch } = useQuery({ queryKey: ['notifications', me?.notify], queryFn: () => getNotices(me?.notify), enabled: !!me })
  const read = readIds(), unread = data.filter(n => !read.includes(n.id))
  const mark = (ids: string[]) => { markRead(ids); tick(x => x + 1); qc.invalidateQueries({ queryKey: ['notifications'] }) }
  return (<div ref={ref} className="relative">
    <button onClick={() => setOpen(!open)} aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ''}`} aria-expanded={open} className="relative rounded p-2 hover:bg-slate-100">
      <Bell size={18} />{unread.length > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">{unread.length > 9 ? '9+' : unread.length}</span>}</button>
    {open && <div className="absolute right-0 top-11 z-40 w-96 rounded-2xl border border-slate-200 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold">Notifications</h2>
        <button disabled={!unread.length} onClick={() => mark(unread.map(n => n.id))} className="text-xs text-brand disabled:text-slate-400">Mark all as read</button></div>
      <div className="max-h-96 overflow-auto">
        {error ? <p className="p-4 text-sm text-red-700">Could not load notifications. <button onClick={() => refetch()} className="underline">Try again</button></p>
          : isLoading ? <p className="p-4 text-sm text-slate-500">Loading…</p>
          : !data.length ? <p className="p-6 text-center text-sm text-slate-500">No reports need your attention right now.</p>
          : data.map(n => { const isRead = read.includes(n.id); return (
            <button key={n.id} onClick={() => { mark([n.id]); setOpen(false); nav(n.to) }} className={`flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${isRead ? '' : 'bg-brand/5'}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isRead ? 'bg-transparent' : n.tone === 'red' ? 'bg-red-500' : 'bg-amber-500'}`} />
              <span className="text-sm"><span className="font-medium">{n.title}</span><span className="block text-slate-600">{n.text}</span><span className="text-xs text-slate-400">{n.date}</span></span></button>) })}
      </div></div>}
  </div>)
}
