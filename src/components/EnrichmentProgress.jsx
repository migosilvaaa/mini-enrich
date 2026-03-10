import { useEffect } from 'react'
import { useEnrichment } from '../hooks/useEnrichment'
import { X, ArrowLeft, Download } from 'lucide-react'

function estimatedSeconds(count) {
  // ~2s per batch of 25 (API round-trip + courtesy delay) + ~2s Phase 2
  const batches = Math.ceil(count / 25)
  return Math.max(5, batches * 2 + 2)
}

// ── Status chip ───────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   icon: '⏳', classes: 'bg-gray-100 text-gray-500' },
  enriched:  { label: 'Enriched',  icon: '✅', classes: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  partial:   { label: 'Partial',   icon: '⚠️', classes: 'bg-amber-50 text-amber-700 border border-amber-200' },
  not_found: { label: 'Not Found', icon: '❌', classes: 'bg-red-50 text-red-600 border border-red-200' },
}

function StatusChip({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cfg.classes}`}>
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  )
}

// ── Row background by status ──────────────────────────────────────────────────

function rowBg(status) {
  if (status === 'partial')   return 'bg-amber-50/60'
  if (status === 'not_found') return 'bg-red-50/60'
  return 'bg-white'
}

// ── Missing-value placeholder ─────────────────────────────────────────────────

function Empty() {
  return <span className="italic text-gray-300">—</span>
}

// ── Phase label ───────────────────────────────────────────────────────────────

function phaseLabel(phase) {
  if (phase === 'contacts')  return 'Phase 1 of 2 — Enriching titles & phones'
  if (phase === 'companies') return 'Phase 2 of 2 — Looking up accounts'
  if (phase === 'done')      return 'Complete'
  if (phase === 'cancelled') return 'Cancelled'
  return ''
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EnrichmentProgress({ mappedData, onBack, onComplete, addToast }) {
  const { isRunning, phase, progress, results, error, stats, startEnrichment, cancel, reset } =
    useEnrichment({ onWarning: (msg) => addToast?.(msg, 'warning') })

  // Auto-start on mount
  useEffect(() => {
    if (mappedData?.length > 0) {
      startEnrichment(mappedData)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Empty data guard ─────────────────────────────────────────────────────
  if (!mappedData?.length) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-center space-y-2">
          <p className="font-semibold text-amber-800">No contacts to enrich</p>
          <p className="text-sm text-amber-700">All rows were skipped — no email addresses found.</p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to mapping
        </button>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center space-y-3">
          <p className="text-2xl">⚠️</p>
          <p className="font-semibold text-red-800">Enrichment failed</p>
          <p className="text-sm text-red-700">{error}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { reset(); onBack?.() }}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to mapping
          </button>
          <button
            onClick={() => { reset(); startEnrichment(mappedData) }}
            className="rounded-lg bg-[#050038] px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-900 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const isDone      = phase === 'done'
  const isCancelled = phase === 'cancelled'
  const showTable   = results.length > 0

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {isDone ? 'Enrichment Complete' : isCancelled ? 'Enrichment Cancelled' : 'Enriching Contacts…'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isDone
              ? `${mappedData.length} contacts processed via ZoomInfo`
              : isCancelled
              ? 'Partial results shown below.'
              : `${mappedData.length} contacts · ~${estimatedSeconds(mappedData.length)}s estimated`}
          </p>
        </div>

        {/* Cancel button — only while running */}
        {isRunning && (
          <button
            onClick={cancel}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        )}
      </div>

      {/* Progress bar + phase label */}
      {!isDone && !isCancelled && (
        <ProgressSection phase={phase} progress={progress} />
      )}

      {/* Stats bar — shown when done or cancelled with data */}
      {(isDone || isCancelled) && stats && (
        <StatsBar stats={stats} />
      )}

      {/* Cancelled notice */}
      {isCancelled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Enrichment was cancelled. Rows still showing ⏳ were not sent to ZoomInfo.
        </div>
      )}

      {/* Live / final results table */}
      {showTable && (
        <LiveTable results={results} isRunning={isRunning} />
      )}

      {/* Actions after done/cancelled */}
      {(isDone || isCancelled) && (
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => { reset(); onBack?.() }}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {isDone && (
            <button
              onClick={() => onComplete?.({ results, stats })}
              className="flex items-center gap-2 rounded-lg bg-[#050038] px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-900 transition-colors"
            >
              <Download className="h-4 w-4" />
              View Results & Download
            </button>
          )}
          {isCancelled && (
            <button
              onClick={() => { reset(); startEnrichment(mappedData) }}
              className="rounded-lg bg-[#050038] px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-900 transition-colors"
            >
              Restart Enrichment
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Progress section ──────────────────────────────────────────────────────────

function ProgressSection({ phase, progress }) {
  const label = phaseLabel(phase)
  const pct   = progress.percent ?? 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="tabular-nums text-gray-500">
          {phase === 'contacts' && progress.total > 0
            ? `Batch ${progress.current} of ${progress.total}`
            : phase === 'companies'
            ? 'Looking up accounts…'
            : ''}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-[#050038] transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-right text-xs text-gray-400">{pct}%</p>
    </div>
  )
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ stats }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-3">
      <StatPill count={stats.enriched}  label="enriched"  color="text-emerald-700" dot="bg-emerald-500" />
      <span className="text-gray-200">·</span>
      <StatPill count={stats.partial}   label="partial"   color="text-amber-700"   dot="bg-amber-400" />
      <span className="text-gray-200">·</span>
      <StatPill count={stats.notFound}  label="not found" color="text-red-600"     dot="bg-red-400" />
    </div>
  )
}

function StatPill({ count, label, color, dot }) {
  return (
    <span className={`flex items-center gap-1.5 text-sm font-medium ${color}`}>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {count} {label}
    </span>
  )
}

// ── Live table ────────────────────────────────────────────────────────────────

function LiveTable({ results, isRunning }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Title</Th>
            <Th>Phone</Th>
            <Th>Account</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {results.map((row, i) => (
            <tr
              key={`${row.email}-${i}`}
              className={`border-b border-gray-50 last:border-0 transition-colors duration-200 ${rowBg(row.status)}`}
            >
              <Td>
                {row.first_name || row.last_name
                  ? `${row.first_name} ${row.last_name}`.trim()
                  : <Empty />}
              </Td>
              <Td muted>{row.email}</Td>
              <Td>{row.title || <Empty />}</Td>
              <Td>{row.phone || <Empty />}</Td>
              <Td muted>
                {row.account_name
                  ? <span>{row.account_name}<span className="text-gray-300"> · {row.account_domain}</span></span>
                  : row.account_domain || <Empty />}
              </Td>
              <Td>
                <StatusChip status={row.status} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>

      {isRunning && (
        <div className="border-t border-gray-100 px-4 py-2.5 text-center text-xs text-gray-400 animate-pulse">
          Enriching…
        </div>
      )}
    </div>
  )
}

function Th({ children }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
      {children}
    </th>
  )
}

function Td({ children, muted }) {
  return (
    <td className={`max-w-[200px] truncate px-4 py-2.5 ${muted ? 'text-gray-400' : 'text-gray-800'}`}>
      {children}
    </td>
  )
}
