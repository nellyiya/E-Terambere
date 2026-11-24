import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { globalSearch } from '../services/topbarApi'
import { useOutside } from './useOutside'
export default function GlobalSearch() {
  const nav = useNavigate()
  const [text, setText] = useState(''), [term, setTerm] = useState(''), [open, setOpen] = useState(false), [cur, setCur] = useState(0)
  useEffect(() => { const t = setTimeout(() => setTerm(text), 250); return () => clearTimeout(t) }, [text])
  const ref = useOutside<HTMLDivElement>(() => setOpen(false))
  const ready = term.trim().length >= 2
  const { data = [], isFetching, error } = useQuery({ queryKey: ['global-search', term], queryFn: () => globalSearch(term), enabled: ready })
  const go = (to: string) => { nav(to); setOpen(false); setText(''); setTerm('') }
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false)
    else if (e.key === 'ArrowDown') { e.preventDefault(); setCur(Math.min(cur + 1, data.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCur(Math.max(cur - 1, 0)) }
    else if (e.key === 'Enter' && data[cur]) go(data[cur].to)
  }
  return (<div ref={ref} className="relative mx-auto w-full max-w-md">
    <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
    <input value={text} onChange={e => { setText(e.target.value); setOpen(true); setCur(0) }} onFocus={() => setOpen(true)} onKeyDown={key} role="combobox" aria-expanded={open} aria-label="Search"
      placeholder="Search projects, supervisors, reports…" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" />
    {open && text.trim().length > 0 && <div className="absolute left-0 right-0 top-11 z-40 max-h-96 overflow-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-lg">
      {!ready ? <p className="px-4 py-3 text-sm text-slate-500">Type at least 2 characters.</p>
        : error ? <p className="px-4 py-3 text-sm text-red-700">Search failed. Try again.</p>
        : isFetching && !data.length ? <p className="px-4 py-3 text-sm text-slate-500">Searching…</p>
        : !data.length ? <p className="px-4 py-3 text-sm text-slate-500">No results for “{term}”.</p>
        : data.map((h, i) => <div key={h.key + h.group}>
          {(i === 0 || data[i - 1].group !== h.group) && <p className="px-4 pb-1 pt-2 text-xs font-medium text-slate-400">{h.group}</p>}
          <button onClick={() => go(h.to)} onMouseEnter={() => setCur(i)} className={`block w-full px-4 py-2 text-left text-sm ${i === cur ? 'bg-slate-100' : ''}`}><span className="font-medium">{h.title}</span><span className="block text-xs text-slate-500">{h.sub}</span></button></div>)}
    </div>}
  </div>)
}
