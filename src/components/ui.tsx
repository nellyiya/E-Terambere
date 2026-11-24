import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
export const Skeleton = ({ className = '' }: { className?: string }) => <div aria-hidden="true" className={`skeleton ${className}`} />
export const TableSkeleton = ({ rows = 6 }: { rows?: number }) => (
  <div role="status" aria-label="Loading" className="card-shadow overflow-hidden rounded-2xl border border-slate-200 bg-white"><Skeleton className="h-11 rounded-none" />
    {Array.from({ length: rows }, (_, i) => <div key={i} className="flex items-center gap-4 border-t border-slate-100 px-4 py-4"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 flex-1" /><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-16" /></div>)}</div>)
export const EmptyState = ({ icon: I, title, text, children }: { icon: LucideIcon; title: string; text: string; children?: ReactNode }) => (
  <div className="rise grid place-items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><span className="grid h-16 w-16 place-items-center rounded-full bg-brand/10 text-brand"><I size={28} strokeWidth={1.6} /></span>
    <h3 className="mt-4 font-semibold">{title}</h3><p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>{children && <div className="mt-5">{children}</div>}</div>)
export function useCountUp(target: number, ms = 900) {  // numbers glide up to their value; skipped when the person prefers reduced motion
  const [v, setV] = useState(0), from = useRef(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { from.current = target; setV(target); return }
    const start = performance.now(), a = from.current; let raf = 0
    const tick = (t: number) => { const p = Math.min(1, (t - start) / ms), val = a + (target - a) * (1 - Math.pow(1 - p, 3)); from.current = val; setV(val); if (p < 1) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}
export const CountUp = ({ value, format }: { value: number; format?: (n: number) => string }) => { const v = useCountUp(value); return <>{format ? format(v) : new Intl.NumberFormat('en-US').format(Math.round(v))}</> }
export const tip = { contentStyle: { borderRadius: 12, border: '1px solid var(--color-slate-200)', boxShadow: '0 10px 30px -10px rgb(0 0 0 / .25)', fontSize: 12, padding: '8px 12px' }, cursor: { fill: 'rgb(3 67 55 / .06)' } }
