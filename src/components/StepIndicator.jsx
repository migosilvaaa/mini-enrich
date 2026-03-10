const STEPS = [
  { id: 'upload', label: 'Upload' },
  { id: 'map', label: 'Map Fields' },
  { id: 'enrich', label: 'Enrich & Download' },
]

export default function StepIndicator({ currentStep }) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep)

  return (
    <nav aria-label="Progress">
      <ol className="flex items-center gap-0">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIndex
          const isCurrent = idx === currentIndex

          return (
            <li key={step.id} className="flex items-center">
              {/* Step circle + label */}
              <div className="flex items-center gap-2">
                <span
                  className={[
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                    isCompleted
                      ? 'bg-[#050038] text-white'
                      : isCurrent
                      ? 'border-2 border-[#050038] text-[#050038] bg-white'
                      : 'border-2 border-gray-300 text-gray-400 bg-white',
                  ].join(' ')}
                >
                  {isCompleted ? (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </span>
                <span
                  className={[
                    'text-sm font-medium whitespace-nowrap',
                    isCurrent ? 'text-[#050038]' : isCompleted ? 'text-gray-700' : 'text-gray-400',
                  ].join(' ')}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {idx < STEPS.length - 1 && (
                <div
                  className={[
                    'mx-3 h-px w-12 transition-colors',
                    idx < currentIndex ? 'bg-[#050038]' : 'bg-gray-200',
                  ].join(' ')}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
