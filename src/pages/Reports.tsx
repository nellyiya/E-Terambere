
import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, FileText, Plus, Search, Undo2 } from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog'
import ExportMenu from '../components/ExportMenu'
import FilterBar, { useFilters } from '../components/FilterBar'
import ReportDialog from '../components/ReportDialog'
import StatStrip from '../components/StatStrip'
import { ReportActions, StatusPill } from '../components/ReportReview'
import { EmptyState, TableSkeleton } from '../components/ui'
import { errMsg } from '../lib/api'
import { dmy } from '../lib/period'
import { deleteReport, fetchAllReports, listReports, reportKeys, type ReportRow } from '../services/reportsApi'

const size = 12, STATUSES = ['', 'Pending', 'Approved', 'Returned']
type Dlg = { kind: 'add' } | { kind: 'edit' | 'delete'; r: ReportRow } | null
const HEAD = ['Report', 'Project', 'Site', 'Status', 'Submitted by', 'Date', 'Actions']

export default function Reports() {
  const { f, page, set } = useFilters()
  const sp = useSearchParams()[0]

  const status = sp.get('status') ?? ''
  const search = sp.get('q') ?? ''
  const sort: 'asc' | 'desc' = sp.get('sort') === 'asc' ? 'asc' : 'desc'

  const qc = useQueryClient()
  const [dlg, setDlg] = useState<Dlg>(null)

  const query = { ...f, status, search, sort }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports', query, page],
    queryFn: () => listReports(query, page, size),
    placeholderData: keepPreviousData,
  })

  const del = useMutation({
    mutationFn: (id: string) => deleteReport(id),
    onSuccess: () => {
      reportKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] }))
      setDlg(null)
    },
  })

  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / size))
  const filtered = !!(f.project || f.site || f.from || f.to || status || search)
  const shown = data?.rows.length ?? 0

  const stats = useQuery({
    queryKey: ['reports', 'stats', f],
    staleTime: 60_000,
    queryFn: async () => {
      const count = async (st: string) =>
        (await listReports({ ...f, status: st, search: '' }, 1, 1)).total

      const [all, pending, approved, returned] = await Promise.all(
        ['', 'Pending', 'Approved', 'Returned'].map(count),
      )

      return { all, pending, approved, returned }
    },
  })

  const st = stats.data

  const cards = [
    { label: 'Total Reports', value: st?.all ?? '–', icon: FileText },
    { label: 'Pending', value: st?.pending ?? '–', icon: Clock },
    { label: 'Approved', value: st?.approved ?? '–', icon: CheckCircle2 },
    { label: 'Returned', value: st?.returned ?? '–', icon: Undo2 },
  ]

  return (
    <div className="space-y-6">
      <p className="mb-4 text-sm text-slate-500">Daily Reports</p>

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand text-white">
            <FileText size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-bold">Daily Reports</h1>
            <p className="text-sm text-slate-500">
              Reports sent in by supervisors from site
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ExportMenu
            title="Reports"
            file="reports"
            f={f}
            columns={['Report', 'Date', 'Project', 'Site', 'Supervisor', 'Activity', 'Status']}
            getRows={async () =>
              (await fetchAllReports(query)).map(r => [
                r.id,
                r.date,
                r.projectName,
                r.site,
                r.supervisor ?? '',
                r.activity,
                r.status,
              ])
            }
          />

          <button
            onClick={() => setDlg({ kind: 'add' })}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            <Plus size={16} />
            Add Report
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <StatStrip items={cards} />

      {/* Filters and sorting */}
      <div className="flex flex-wrap items-end gap-3">
        <FilterBar real />

        <label className="text-xs text-slate-500">
          Sort order
          <select
            value={sort}
            onChange={e => set({ sort: e.target.value })}
            className="mt-1 block rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition hover:border-brand focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option value="desc">Z-A</option>
            <option value="asc">A-Z</option>
          </select>
        </label>
      </div>

      {/* Search + status chips */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="relative min-w-60 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            defaultValue={search}
            onChange={e => set({ q: e.target.value })}
            placeholder="Search by report number or activity…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => set({ status: s })}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                status === s
                  ? 'bg-brand text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-slate-500">
        Showing <b className="font-medium text-[#1c2e4e]">{shown}</b> of{' '}
        <b className="font-medium text-[#1c2e4e]">{total}</b> reports
      </p>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Could not load reports. {errMsg(error)}{' '}
          <button onClick={() => refetch()} className="underline">
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <TableSkeleton rows={8} />
      ) : !data?.rows.length ? (
        <EmptyState
          icon={FileText}
          title={filtered ? 'No reports match' : 'No reports yet'}
          text={
            filtered
              ? 'Widen the date range or clear a filter.'
              : 'Reports appear here once they are added. Click Add Report to record the first one.'
          }
        >
          {!filtered && (
            <button
              onClick={() => setDlg({ kind: 'add' })}
              className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white"
            >
              Add Report
            </button>
          )}
        </EmptyState>
      ) : (
        <div className="rise overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="px-6 py-5">
            <h2 className="text-lg font-semibold">All reports</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                  {HEAD.map((h, i) => (
                    <th
                      key={h}
                      className={`whitespace-nowrap px-6 py-3 font-medium ${
                        i === HEAD.length - 1 ? 'text-right' : ''
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {data.rows.map(r => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="max-w-xs px-6 py-4 align-middle">
                      <div className="line-clamp-2 font-semibold leading-snug" title={r.activity}>
                        {r.activity}
                      </div>
                      <div className="tnum mt-0.5 text-xs text-slate-500">{r.id}</div>
                    </td>

                    <td className="max-w-xs px-6 py-4 align-middle text-slate-600">
                      <span className="line-clamp-2 capitalize" title={r.projectName}>
                        {r.projectName.toLowerCase()}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 align-middle">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        {r.site}
                      </span>
                    </td>

                    <td className="px-6 py-4 align-middle">
                      <StatusPill s={r.status} />
                      {r.status === 'Returned' && r.returnNote && (
                        <span
                          className="mt-1.5 line-clamp-2 block max-w-48 text-xs text-amber-700"
                          title={r.returnNote}
                        >
                          {r.returnNote}
                        </span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 align-middle capitalize text-slate-600">
                      {r.supervisor ? r.supervisor.toLowerCase() : '–'}
                    </td>

                    <td className="tnum whitespace-nowrap px-6 py-4 align-middle text-slate-600">
                      {dmy(r.date)}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-right align-middle">
                      <ReportActions
                        r={r}
                        onEdit={() => setDlg({ kind: 'edit', r })}
                        onDelete={() => {
                          del.reset()
                          setDlg({ kind: 'delete', r })
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{total} reports</span>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => set({ page: String(page - 1) })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 transition-colors hover:border-brand disabled:opacity-40 disabled:hover:border-slate-200"
          >
            Previous
          </button>

          Page {page} of {pages}

          <button
            disabled={page >= pages}
            onClick={() => set({ page: String(page + 1) })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 transition-colors hover:border-brand disabled:opacity-40 disabled:hover:border-slate-200"
          >
            Next
          </button>
        </div>
      </div>

      {dlg?.kind === 'add' && (
        <ReportDialog onClose={() => setDlg(null)} />
      )}

      {dlg?.kind === 'edit' && (
        <ReportDialog code={dlg.r.id} onClose={() => setDlg(null)} />
      )}

      {dlg?.kind === 'delete' && (
        <ConfirmDialog
          danger
          title={`Delete report ${dlg.r.id}?`}
          confirmLabel="Yes, delete report"
          busy={del.isPending}
          error={del.error ? errMsg(del.error) : undefined}
          onConfirm={() => del.mutate(dlg.r.id)}
          onCancel={() => setDlg(null)}
        >
          {dlg.r.projectName}, {dlg.r.site}, {dlg.r.date}. This also removes the workers,
          equipment and materials recorded in it, and changes the project's progress and
          cost figures. It cannot be undone.
        </ConfirmDialog>
      )}
    </div>
  )
}
