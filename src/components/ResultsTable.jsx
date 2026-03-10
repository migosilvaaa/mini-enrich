import { useState } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import { downloadCsv } from '../lib/csvExport'

// ── Constants ─────────────────────────────────────────────────────────────────

const FILTERS = [
  { id: 'all',       label: 'All' },
  { id: 'enriched',  label: 'Enriched' },
  { id: 'partial',   label: 'Partial' },
  { id: 'not_found', label: 'Not Found' },
]

const STATUS_CHIP = {
  enriched:  { icon: '✅', label: 'Enriched',  classes: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  partial:   { icon: '⚠️', label: 'Partial',   classes: 'bg-amber-50 text-amber-700 border border-amber-200' },
  not_found: { icon: '❌', label: 'Not Found', classes: 'bg-red-50 text-red-600 border border-red-200' },
  pending:   { icon: '⏳', label: 'Pending',   classes: 'bg-gray-100 text-gray-500' },
}

function rowBg(status) {
  if (status === 'enriched')  return 'bg-white'
  if (status === 'partial')   return 'bg-amber-50/70'
  if (status === 'not_found') return 'bg-red-50/70'
  return 'bg-white'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusChip({ status }) {
  const cfg = STATUS_CHIP[status] || STATUS_CHIP.pending
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cfg.classes}`}>
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  )
}

function Cell({ value, muted, mono }) {
  if (!value && value !== 0) {
    return <span className="italic text-gray-300">—</span>
  }
  return (
    <span className={[
      mono ? 'font-mono text-xs' : '',
      muted ? 'text-gray-400' : 'text-gray-800',
    ].join(' ')}>
      {value}
    </span>
  )
}

function Th({ children, wide }) {
  return (
    <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap ${wide ? 'min-w-[160px]' : ''}`}>
      {children}
    </th>
  )
}

function Td({ children }) {
  return (
    <td className="max-w-[200px] truncate px-4 py-2.5 text-sm">
      {children}
    </td>
  )
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ stats, total }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
      <span className="text-gray-900 font-semibold">{total} contacts</span>
      <span className="text-gray-300 mx-1">·</span>
      <span className="flex items-center gap-1.5 text-emerald-700">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        {stats.enriched} enriched
      </span>
      <span className="text-gray-300 mx-1">·</span>
      <span className="flex items-center gap-1.5 text-amber-700">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        {stats.partial} partial
      </span>
      <span className="text-gray-300 mx-1">·</span>
      <span className="flex items-center gap-1.5 text-red-600">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        {stats.notFound} not found
      </span>
    </div>
  )
}

// ── Filter toggles ────────────────────────────────────────────────────────────

function FilterBar({ active, onChange, counts }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1 w-fit">
      {FILTERS.map((f) => {
        const isActive = active === f.id
        const count = f.id === 'all' ? null : counts[f.id] ?? 0
        return (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            className={[
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
              isActive
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {f.label}
            {count !== null && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                isActive ? 'bg-gray-100 text-gray-600' : 'bg-gray-200 text-gray-500'
              }`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ResultsTable({ results, stats, onStartOver }) {
  const [activeFilter, setActiveFilter] = useState('all')

  const filtered = activeFilter === 'all'
    ? results
    : results.filter((r) => r.status === activeFilter)

  const counts = {
    enriched:  stats.enriched,
    partial:   stats.partial,
    not_found: stats.notFound,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Results</h1>
          <div className="mt-2">
            <StatsBar stats={stats} total={results.length} />
          </div>
        </div>

        {/* Primary download */}
        <button
          onClick={() => downloadCsv(results, false)}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-[#050038] px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-900 transition-colors"
        >
          <Download className="h-4 w-4" />
          Download CSV
        </button>
      </div>

      {/* Filter toggles + metadata link row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <FilterBar active={activeFilter} onChange={setActiveFilter} counts={counts} />

        {/* Secondary download */}
        <button
          onClick={() => downloadCsv(results, true)}
          className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600 transition-colors whitespace-nowrap"
        >
          Download with metadata
        </button>
      </div>

      {/* Results table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <Th>First</Th>
              <Th>Last</Th>
              <Th wide>Title</Th>
              <Th wide>Email</Th>
              <Th>Phone</Th>
              <Th>Domain</Th>
              <Th>Account</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                  No contacts match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => (
                <tr
                  key={`${row.email}-${i}`}
                  className={`border-b border-gray-50 last:border-0 ${rowBg(row.status)}`}
                >
                  <Td><Cell value={row.first_name} /></Td>
                  <Td><Cell value={row.last_name} muted /></Td>
                  <Td>
                    <span className="block max-w-[200px] truncate" title={row.title}>
                      <Cell value={row.title} />
                    </span>
                  </Td>
                  <Td>
                    <span className="block max-w-[200px] truncate" title={row.email}>
                      <Cell value={row.email} muted />
                    </span>
                  </Td>
                  <Td><Cell value={row.phone} mono /></Td>
                  <Td><Cell value={row.account_domain} muted /></Td>
                  <Td><Cell value={row.account_name} /></Td>
                  <Td><StatusChip status={row.status} /></Td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Row count footer */}
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-right text-xs text-gray-400">
          {filtered.length === results.length
            ? `${results.length} contacts`
            : `${filtered.length} of ${results.length} contacts`}
        </div>
      </div>

      {/* Start over */}
      <div className="flex justify-start pt-2">
        <button
          onClick={onStartOver}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Start Over
        </button>
      </div>
    </div>
  )
}
