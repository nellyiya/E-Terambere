import type { CSSProperties, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ClipboardCheck,
  FileText,
  FolderKanban,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Skeleton, tip } from '../components/ui'
import StatStrip from '../components/StatStrip'
import { errMsg } from '../lib/api'
import { getDashboard } from '../services/dashboardApi'
import { getSettings } from '../services/settings'

// Chart colour (SVG needs a real value). Keep in step with the brand colour set in Layout.tsx.
const BRAND = '#1c8578'

const Panel = ({
  title,
  sub,
  icon: I,
  to,
  i,
  className = '',
  children,
}: {
  title: string
  sub: string
  icon: LucideIcon
  to?: string
  i: number
  className?: string
  children: ReactNode
}) => (
  <div
    style={{ '--i': i } as CSSProperties}
    className={`rise card-shadow flex flex-col rounded-3xl border border-slate-200 bg-white p-5 transition duration-300 hover:shadow-lg ${className}`}
  >
    <div className="mb-4 flex shrink-0 flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
          <I size={18} />
        </span>

        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            {sub}
          </p>
        </div>
      </div>

      {to && (
        <Link
          to={to}
          className="shrink-0 whitespace-nowrap rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white shadow-sm transition hover:opacity-90"
        >
          View details ↗
        </Link>
      )}
    </div>

    {children}
  </div>
)

const mon = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const day = (s: string) => {
  const [m, dd] = s.split('-')
  return `${mon[Number(m) - 1]} ${Number(dd)}`
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n || 0)))

const Empty = ({ text }: { text: string }) => (
  <div className="grid min-h-[12rem] flex-1 place-items-center">
    <div className="max-w-sm text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand/5 text-brand">
        <FileText size={22} />
      </div>
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  </div>
)

const grid = (
  <CartesianGrid
    stroke="#e2e8f0"
    strokeDasharray="3 3"
  />
)

// Circular progress indicator with the percentage in the middle.
const Ring = ({
  value,
  label,
  sub,
}: {
  value: number
  label: string
  sub: string
}) => {
  const r = 42
  const c = 2 * Math.PI * r

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="9"
          />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={BRAND}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (c * value) / 100}
            style={{ transition: 'stroke-dashoffset 900ms ease' }}
          />
        </svg>

        <span className="absolute inset-0 grid place-items-center text-lg font-semibold tnum text-brand">
          {value}%
        </span>
      </div>

      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{sub}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const {
    data: d,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  })

  // Same query the layout uses, so it comes from the cache. Only used for the welcome card.
  const { data: me } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  })

  if (error)
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Could not load the dashboard. {errMsg(error)}
        <button onClick={() => refetch()} className="ml-2 underline">
          Try again
        </button>
      </div>
    )

  if (isLoading || !d)
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Skeleton className="h-52" />
          <Skeleton className="h-52 lg:col-span-2" />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )

  const k = d.kpi

  const days = d.reportsPerDay.map(x => ({
    label: day(x.date),
    reports: x.reports,
  }))

  const busiest = days.length
    ? days.reduce((a, b) => (b.reports > a.reports ? b : a))
    : null

  const cards: [string, number, string, LucideIcon, string][] = [
    [
      'Total Projects',
      k.projects,
      `${k.active} active · ${k.completed} completed`,
      FolderKanban,
      '/projects',
    ],
    [
      'Total Reports',
      k.reports,
      `${k.reports - k.pending} reviewed`,
      FileText,
      '/reports',
    ],
    [
      'Total Supervisors',
      k.supervisors,
      `${k.activeSupervisors} active`,
      Users,
      '/supervisors',
    ],
    [
      'Awaiting Reviews',
      k.pending,
      k.pending ? 'Reports waiting for you' : 'Nothing waiting',
      ClipboardCheck,
      '/reports?status=Pending',
    ],
  ]

  const name = me?.name ?? 'Admin'
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('') || 'A'

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="flex flex-col gap-4 lg:h-full">

      {/* TOP ROW: WELCOME + KPI TILES */}
      <div className="grid shrink-0 grid-cols-1 gap-4 lg:grid-cols-3">

        {/* WELCOME CARD */}
        <div
          style={{ '--i': 0 } as CSSProperties}
          className="rise card-shadow flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand text-xl font-semibold text-white ring-4 ring-brand/15">
              {initials}
            </span>

            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Welcome to your dashboard
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <span className="text-xs font-medium text-slate-500">{today}</span>

            <Link
              to={k.pending > 0 ? '/reports?status=Pending' : '/reports'}
              className="rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand transition hover:bg-brand/15"
            >
              {k.pending > 0
                ? `${k.pending} to review`
                : 'All caught up'}
            </Link>
          </div>
        </div>

        {/* STAT STRIP */}
        <StatStrip
          i={1}
          className="lg:col-span-2"
          items={cards.map(([label, value, sub, icon, to]) => ({ label, value, sub, icon, to }))}
        />
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-3">

        {/* REPORTS SUBMITTED - AREA CHART */}
        <Panel
          i={2}
          title="Reports submitted per day"
          sub="How many reports supervisors sent in on each day"
          icon={FileText}
          to="/reports"
          className="min-h-[20rem] lg:col-span-2 lg:min-h-0"
        >
          {days.length === 0 ? (
            <Empty text="No reports yet. They appear here when reports are added." />
          ) : (
            <div className="relative min-h-[12rem] flex-1">
              <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={days}
                  margin={{ top: 12, right: 10, left: -15, bottom: 5 }}
                >
                  <defs>
                    <linearGradient
                      id="reportAreaFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={BRAND}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="100%"
                        stopColor={BRAND}
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>

                  {grid}

                  <XAxis
                    dataKey="label"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#727886' }}
                    dy={8}
                  />

                  <YAxis
                    fontSize={11}
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#727886' }}
                    width={35}
                  />

                  <Tooltip
                    {...tip}
                    cursor={{ stroke: BRAND, strokeOpacity: 0.25 }}
                    formatter={(v: number) => [
                      `${v} reports`,
                      'Submitted',
                    ]}
                  />

                  <Area
                    type="monotone"
                    dataKey="reports"
                    name="Reports"
                    stroke={BRAND}
                    strokeWidth={2}
                    fill="url(#reportAreaFill)"
                    dot={{
                      r: 5,
                      fill: BRAND,
                      stroke: '#ffffff',
                      strokeWidth: 2,
                    }}
                    activeDot={{
                      r: 7,
                      fill: BRAND,
                      stroke: '#ffffff',
                      strokeWidth: 2,
                    }}
                    animationDuration={900}
                  />
                </AreaChart>
              </ResponsiveContainer>
              </div>
            </div>
          )}

          {busiest && (
            <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-4 py-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-brand">
                <FileText size={16} />
              </span>

              <p className="text-sm text-slate-500">
                Busiest day:{' '}
                <span className="font-semibold text-[#1c2e4e]">
                  {busiest.label}
                </span>{' '}
                with{' '}
                <span className="font-semibold text-brand">
                  {busiest.reports}
                </span>{' '}
                reports.
              </p>
            </div>
          )}
        </Panel>

        {/* PHYSICAL + FINANCIAL PROGRESS */}
        <Panel
          i={3}
          title="Progress"
          sub="Average physical and financial progress across your projects"
          icon={ClipboardCheck}
          className="lg:min-h-0"
        >
          <div className="flex flex-1 flex-col justify-around gap-6">
            <Ring
              value={clamp(k.avg)}
              label="Physical progress"
              sub="Average work done across projects"
            />
            <Ring
              value={clamp(k.avgFinancial)}
              label="Financial progress"
              sub="Average financial progress across projects"
            />
          </div>
        </Panel>
      </div>
    </div>
  )
}
