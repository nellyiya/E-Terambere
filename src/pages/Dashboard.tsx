
import type { CSSProperties, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { CountUp, Skeleton, tip } from '../components/ui'
import { errMsg } from '../lib/api'
import { getDashboard } from '../services/dashboardApi'
import { rwf } from '../services/costs'

const Panel = ({
  title,
  sub,
  icon: I,
  to,
  i,
  children,
}: {
  title: string
  sub: string
  icon: LucideIcon
  to?: string
  i: number
  children: ReactNode
}) => (
  <div
    style={{ '--i': i } as CSSProperties}
    className="rise card-shadow rounded-2xl border border-slate-200 bg-white p-6 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg"
  >
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#034337]/10 text-[#034337]">
          <I size={18} />
        </span>

        <div>
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            {sub}
          </p>
        </div>
      </div>

      {to && (
        <Link
          to={to}
          className="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-[#034337] transition hover:bg-[#034337]/5"
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

const Empty = ({ text }: { text: string }) => (
  <div className="grid h-64 place-items-center">
    <div className="max-w-sm text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#034337]/5 text-[#034337]">
        <FileText size={22} />
      </div>
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  </div>
)

const grid = (
  <CartesianGrid
    stroke="#e2e8f0"
    vertical={false}
    strokeDasharray="3 3"
  />
)

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
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Skeleton className="h-96" />
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

  const totalCost = d.costByCategory.reduce(
    (a, c) => a + c.amount,
    0,
  )

  const top = d.costByCategory.length
    ? d.costByCategory.reduce((a, c) =>
        c.amount > a.amount ? c : a,
      )
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

  return (
    <div className="space-y-6">

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([l, v, s, I, to], i) => (
          <Link
            key={l}
            to={to}
            style={{ '--i': i } as CSSProperties}
            className="rise group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#034337]/30 hover:shadow-xl"
          >
            {/* Subtle green background */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#034337]/[0.07] via-transparent to-transparent" />

            {/* Top accent */}
            <div className="absolute left-0 top-0 h-1 w-full bg-[#034337]" />

            <div className="relative flex items-start justify-between">
              <div className="space-y-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#034337]/10 text-[#034337] transition-all duration-300 group-hover:scale-110 group-hover:bg-[#034337] group-hover:text-white">
                  <I size={23} strokeWidth={1.8} />
                </div>

                <div>
                  <p className="text-3xl font-bold tracking-tight text-slate-800 tnum">
                    <CountUp value={v} />
                  </p>

                  <p className="mt-1.5 text-sm font-semibold text-slate-800">
                    {l}
                  </p>

                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    {s}
                  </p>
                </div>
              </div>

              <span className="relative text-xl text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-[#034337]">
                ↗
              </span>
            </div>

            <div className="relative mt-5 flex items-center gap-2 border-t border-slate-100 pt-4">
              <span className="h-2 w-2 rounded-full bg-[#034337]" />

              <span className="text-xs font-medium text-slate-500">
                {[
                  'Projects overview',
                  'Report activity',
                  'Team overview',
                  k.pending > 0 ? 'Action required' : 'All caught up',
                ][i]}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* REPORTS SUBMITTED - VERTICAL BAR CHART */}
        <Panel
          i={4}
          title="Reports submitted per day"
          sub="How many reports supervisors sent in on each day"
          icon={FileText}
          to="/reports"
        >
          {days.length === 0 ? (
            <Empty text="No reports yet. They appear here when reports are added." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={days}
                  margin={{ top: 12, right: 10, left: -15, bottom: 5 }}
                >
                  <defs>
                    <linearGradient
                      id="reportBarFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#034337"
                        stopOpacity={1}
                      />
                      <stop
                        offset="100%"
                        stopColor="#034337"
                        stopOpacity={0.65}
                      />
                    </linearGradient>
                  </defs>

                  {grid}

                  <XAxis
                    dataKey="label"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748b' }}
                    dy={8}
                  />

                  <YAxis
                    fontSize={11}
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748b' }}
                    width={35}
                  />

                  <Tooltip
                    {...tip}
                    cursor={{ fill: '#034337', opacity: 0.05 }}
                    formatter={(v: number) => [
                      `${v} reports`,
                      'Submitted',
                    ]}
                  />

                  <Bar
                    dataKey="reports"
                    name="Reports"
                    fill="url(#reportBarFill)"
                    radius={[7, 7, 0, 0]}
                    maxBarSize={45}
                    animationDuration={900}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {busiest && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-4 py-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#034337]/10 text-[#034337]">
                <FileText size={16} />
              </span>

              <p className="text-sm text-slate-500">
                Busiest day:{' '}
                <span className="font-semibold text-slate-800">
                  {busiest.label}
                </span>{' '}
                with{' '}
                <span className="font-semibold text-[#034337]">
                  {busiest.reports}
                </span>{' '}
                reports.
              </p>
            </div>
          )}
        </Panel>

        {/* RECORDED COST  */}
        <Panel
          i={5}
          title="Recorded cost by category"
          sub="Money recorded as spent in each category. Work Done is not counted as spending."
          icon={Wallet}
          to="/project-management/summary"
        >
          {totalCost === 0 ? (
            <Empty text="No costs recorded yet. Labor comes from reports, and other costs are entered on each project." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={d.costByCategory}
                  layout="vertical"
                  margin={{ top: 10, right: 25, left: 10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient
                      id="costBarFill"
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="0"
                    >
                      <stop
                        offset="0%"
                        stopColor="#034337"
                        stopOpacity={0.75}
                      />
                      <stop
                        offset="100%"
                        stopColor="#034337"
                        stopOpacity={1}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke="#e2e8f0"
                    horizontal={false}
                    strokeDasharray="3 3"
                  />

                  <XAxis
                    type="number"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748b' }}
                    tickFormatter={(v: number) =>
                      v >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}M`
                        : v >= 1000
                          ? `${(v / 1000).toFixed(0)}K`
                          : `${v}`
                    }
                  />

                  <YAxis
                    type="category"
                    dataKey="name"
                    width={105}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748b' }}
                  />

                  <Tooltip
                    {...tip}
                    cursor={{ fill: '#034337', opacity: 0.05 }}
                    formatter={(v: number) => [
                      rwf(v),
                      'Recorded cost',
                    ]}
                  />

                  <Bar
                    dataKey="amount"
                    name="Recorded cost"
                    fill="url(#costBarFill)"
                    radius={[0, 7, 7, 0]}
                    maxBarSize={28}
                    animationDuration={900}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {top && totalCost > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-4 py-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#034337]/10 text-[#034337]">
                <Wallet size={16} />
              </span>

              <p className="text-sm text-slate-500">
                Largest category:{' '}
                <span className="font-semibold text-slate-800">
                  {top.name}
                </span>
                ,{' '}
                <span className="font-semibold text-[#034337]">
                  {rwf(top.amount)}
                </span>{' '}
                ({Math.round((top.amount / totalCost) * 100)}% of recorded cost).
              </p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
