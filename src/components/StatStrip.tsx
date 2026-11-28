import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { CountUp } from './ui'

export type Stat = {
  label: string
  value: number | string
  icon: LucideIcon
  /** Small grey line under the number (optional). */
  sub?: string
  /** Makes the stat a link (optional). */
  to?: string
}

// One white rounded strip with round glossy badges, used for the "total cards" on every page.
export default function StatStrip({
  items,
  className = '',
  i = 0,
}: {
  items: Stat[]
  className?: string
  /** Position in the page's entrance animation. */
  i?: number
}) {
  const body = (s: Stat): ReactNode => (
    <>
      <span
        style={{
          background:
            'linear-gradient(145deg, #2fae9d 0%, #1c8578 52%, #0f4a43 100%)',
        }}
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-white shadow-md shadow-brand/30 ring-2 ring-white transition duration-300 group-hover:scale-105"
      >
        <s.icon size={21} strokeWidth={2} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-600">{s.label}</p>
        <p className="truncate text-2xl font-bold leading-tight tnum text-brand" title={typeof s.value === 'string' ? s.value : undefined}>
          {typeof s.value === 'number' ? <CountUp value={s.value} /> : s.value}
        </p>
        {s.sub && <p className="truncate text-[11px] text-slate-500">{s.sub}</p>}
      </div>

      {s.to && (
        <span className="hidden shrink-0 text-lg text-brand/60 transition group-hover:translate-x-0.5 group-hover:text-brand 2xl:block">
          ↗
        </span>
      )}
    </>
  )

  return (
    <div
      style={{ '--i': i } as CSSProperties}
      className={`rise card-shadow flex items-center rounded-3xl border border-slate-200 bg-white px-4 py-4 ${className}`}
    >
      <div className="grid w-full grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-4">
        {items.map(s =>
          s.to ? (
            <Link
              key={s.label}
              to={s.to}
              title={s.sub}
              className="group flex min-w-0 items-center gap-3 rounded-2xl p-2 transition hover:bg-brand/5"
            >
              {body(s)}
            </Link>
          ) : (
            <div key={s.label} title={s.sub} className="group flex min-w-0 items-center gap-3 p-2">
              {body(s)}
            </div>
          ),
        )}
      </div>
    </div>
  )
}
