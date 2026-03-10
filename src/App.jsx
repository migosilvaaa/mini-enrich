import { useState } from 'react'
import StepIndicator from './components/StepIndicator'
import ConnectionStatus from './components/ConnectionStatus'
import FileUpload from './components/FileUpload'
import ColumnMapper from './components/ColumnMapper'
import EnrichmentProgress from './components/EnrichmentProgress'
import ResultsTable from './components/ResultsTable'
import ToastStack from './components/Toast'
import { useCsvParser } from './hooks/useCsvParser'
import { useToast } from './hooks/useToast'
import { ArrowRight } from 'lucide-react'

export default function App() {
  const [step, setStep] = useState('upload')
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [mappedData, setMappedData] = useState(null)
  const [enrichmentResults, setEnrichmentResults] = useState(null) // { results, stats }

  const { toasts, addToast, removeToast } = useToast()

  const csvState = useCsvParser()
  const { data: csvData, headers, reset: resetCsv } = csvState

  const canProceedToMap = csvData.length > 0 && connectionStatus === 'connected'

  function handleStartOver() {
    resetCsv()
    setMappedData(null)
    setEnrichmentResults(null)
    setStep('upload')
  }

  function handleMappingComplete(data) {
    setMappedData(data)
    setEnrichmentResults(null) // clear any prior run
    setStep('enrich')
  }

  function handleEnrichmentComplete(payload) {
    setEnrichmentResults(payload)
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#050038]">
              <span className="text-xs font-bold text-white">M</span>
            </span>
            <span className="text-base font-semibold text-gray-900">Contact Enrichment</span>
          </div>
          <StepIndicator currentStep={step} />
        </div>
      </header>

      <ToastStack toasts={toasts} onDismiss={removeToast} />

      <main className="mx-auto max-w-4xl px-6 py-10">
        {step === 'upload' && (
          <UploadStep
            csvState={csvState}
            connectionStatus={connectionStatus}
            onConnectionStatusChange={setConnectionStatus}
            canProceed={canProceedToMap}
            onNext={() => setStep('map')}
          />
        )}

        {step === 'map' && (
          <ColumnMapper
            headers={headers}
            csvData={csvData}
            onBack={() => setStep('upload')}
            onNext={handleMappingComplete}
          />
        )}

        {step === 'enrich' && !enrichmentResults && (
          <EnrichmentProgress
            mappedData={mappedData}
            onBack={() => setStep('map')}
            onComplete={handleEnrichmentComplete}
            addToast={addToast}
          />
        )}

        {step === 'enrich' && enrichmentResults && (
          <ResultsTable
            results={enrichmentResults.results}
            stats={enrichmentResults.stats}
            onStartOver={handleStartOver}
          />
        )}
      </main>
    </div>
  )
}

// ─── Upload step ──────────────────────────────────────────────────────────────

function UploadStep({ csvState, connectionStatus, onConnectionStatusChange, canProceed, onNext }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Upload Contacts</h1>
        <p className="mt-1 text-sm text-gray-500">
          Export your active users from Looker and upload the CSV here.
        </p>
      </div>

      <ConnectionStatus onStatusChange={onConnectionStatusChange} />

      <FileUpload csvState={csvState} />

      {csvState.data.length > 0 && connectionStatus !== 'connected' && (
        <p className="text-xs text-amber-600">
          ZoomInfo must be connected before you can enrich contacts.
        </p>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className={[
            'flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors',
            canProceed
              ? 'bg-[#050038] text-white hover:bg-indigo-900 cursor-pointer'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed',
          ].join(' ')}
        >
          Next: Map Fields
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

