import { ArrowLeft, ArrowRight, User, Mail, Briefcase, CheckCircle2 } from 'lucide-react'
import { useColumnMapping } from '../hooks/useColumnMapping'

const FIELD_CONFIG = [
  {
    key: 'name',
    label: 'Full Name',
    icon: User,
    required: true,
    description: 'Used to split into first + last name',
  },
  {
    key: 'email',
    label: 'Email',
    icon: Mail,
    required: true,
    description: 'Primary ZoomInfo match key',
  },
  {
    key: 'title',
    label: 'Existing Title',
    icon: Briefcase,
    required: false,
    description: 'Fallback if ZoomInfo has no title',
  },
]

export default function ColumnMapper({ headers, csvData, onBack, onNext }) {
  const { mapping, updateMapping, isValid, mappedData, preview, NONE } = useColumnMapping(
    headers,
    csvData
  )

  const skippedCount = csvData.length - mappedData.length

  return (
    <div className="space-y-8">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Map Fields</h1>
        <p className="mt-1 text-sm text-gray-500">
          Match your CSV columns to the fields ZoomInfo needs. We've auto-detected the most likely
          columns — confirm or adjust below.
        </p>
      </div>

      {/* Mapping rows */}
      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
        {FIELD_CONFIG.map(({ key, label, icon: Icon, required, description }) => {
          const selectedValue = mapping[key] ?? NONE
          const isAutoMapped = mapping[key] !== null

          return (
            <div key={key} className="flex items-center gap-4 px-5 py-4">
              {/* Icon + label */}
              <div className="flex w-44 shrink-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                  <Icon className="h-4 w-4 text-gray-500" />
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {label}
                    {required && <span className="ml-1 text-red-400">*</span>}
                  </p>
                  <p className="text-xs text-gray-400">{description}</p>
                </div>
              </div>

              {/* Arrow */}
              <ArrowRight className="h-4 w-4 shrink-0 text-gray-300" />

              {/* Dropdown */}
              <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1">
                  <select
                    value={selectedValue}
                    onChange={(e) => updateMapping(key, e.target.value)}
                    className={[
                      'w-full appearance-none rounded-lg border px-3 py-2 pr-8 text-sm transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-[#050038]/20 focus:border-[#050038]',
                      isAutoMapped && selectedValue !== NONE
                        ? 'border-emerald-300 bg-emerald-50 text-gray-800'
                        : 'border-gray-200 bg-white text-gray-800',
                      !required && selectedValue === NONE ? 'text-gray-400' : '',
                    ].join(' ')}
                  >
                    {!required && (
                      <option value={NONE}>— None (skip this field) —</option>
                    )}
                    {required && (
                      <option value={NONE} disabled>
                        — Select a column —
                      </option>
                    )}
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  {/* Chevron */}
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>

                {/* Auto-mapped badge */}
                {isAutoMapped && selectedValue !== NONE ? (
                  <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" />
                    Auto-detected
                  </span>
                ) : (
                  <span className="w-[105px] shrink-0" /> /* keep layout stable */
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Skipped rows warning */}
      {skippedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          <span>⚠</span>
          <span>
            <strong>{skippedCount}</strong> row{skippedCount !== 1 ? 's' : ''} will be skipped —
            no email address found.
          </span>
        </div>
      )}

      {/* Preview card */}
      {isValid && preview.length > 0 && (
        <PreviewCard preview={preview} mapping={mapping} />
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <button
          onClick={() => onNext(mappedData)}
          disabled={!isValid}
          className={[
            'flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors',
            isValid
              ? 'bg-[#050038] text-white hover:bg-indigo-900 cursor-pointer'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed',
          ].join(' ')}
        >
          Start Enrichment
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Preview card ─────────────────────────────────────────────────────────────

function PreviewCard({ preview, mapping }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Preview — first {preview.length} contact{preview.length !== 1 ? 's' : ''}</p>

      <div className="space-y-3">
        {preview.map((row, i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white px-4 py-3 space-y-1.5 text-sm">
            {/* Name */}
            <PreviewRow
              label="Name"
              raw={`${row.first_name}${row.last_name ? ' ' + row.last_name : ''}`}
              parsed={
                row.last_name
                  ? `first: ${row.first_name} · last: ${row.last_name}`
                  : `first: ${row.first_name} · last: (none)`
              }
            />

            {/* Email + domain */}
            <PreviewRow
              label="Email"
              raw={row.email}
              parsed={`domain: ${row.domain || '(no domain)'}`}
            />

            {/* Title */}
            {mapping.title && (
              <PreviewRow
                label="Title"
                raw={row.existing_title || '(empty)'}
                parsed="will be enriched via ZoomInfo"
                parsedMuted
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function PreviewRow({ label, raw, parsed, parsedMuted }) {
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className="w-10 shrink-0 text-xs font-semibold text-gray-400 uppercase tracking-wide">
        {label}
      </span>
      <span className="font-medium text-gray-800">{raw}</span>
      <span className="text-gray-300">→</span>
      <span className={parsedMuted ? 'text-gray-400 italic' : 'text-[#050038] font-medium'}>
        {parsed}
      </span>
    </div>
  )
}
