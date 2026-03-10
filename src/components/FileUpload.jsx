import { useRef, useState, useCallback } from 'react'
import { Upload, X, FileText } from 'lucide-react'

const PREVIEW_ROWS = 5
const PREVIEW_COLS = 8

export default function FileUpload({ onFileParsed, csvState }) {
  const { data, headers, rowCount, error, fileName, parseFile, reset } = csvState

  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef(null)

  const handleFile = useCallback(
    (file) => {
      if (!file) return
      parseFile(file)
    },
    [parseFile]
  )

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      handleFile(file)
    },
    [handleFile]
  )

  const onDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = () => setIsDragging(false)

  const onInputChange = (e) => {
    handleFile(e.target.files[0])
    // Reset input so the same file can be re-selected after a clear
    e.target.value = ''
  }

  const handleClear = () => {
    reset()
    onFileParsed?.(null)
  }

  // Notify parent when data is ready
  const hasData = data.length > 0

  // Visible columns for preview
  const visibleHeaders = headers.slice(0, PREVIEW_COLS)
  const hiddenCount = headers.length - PREVIEW_COLS
  const previewRows = data.slice(0, PREVIEW_ROWS)

  return (
    <div className="w-full space-y-4">
      {/* Drop zone — hide after file loaded */}
      {!hasData && (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          className={[
            'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center cursor-pointer transition-colors select-none',
            isDragging
              ? 'border-[#050038] bg-indigo-50'
              : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50',
          ].join(' ')}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <Upload className="h-5 w-5 text-gray-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">
              Drop your Looker CSV here, or{' '}
              <span className="text-[#050038] underline underline-offset-2">browse</span>
            </p>
            <p className="mt-1 text-xs text-gray-400">.csv files only · max 500 contacts</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="sr-only"
            onChange={onInputChange}
          />
        </div>
      )}

      {/* Parse error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="mt-0.5 shrink-0">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* File loaded state */}
      {hasData && (
        <div className="space-y-3">
          {/* File header bar */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="text-sm font-medium text-gray-700 truncate max-w-xs">{fileName}</span>
              <span className="shrink-0 rounded-full bg-[#050038] px-2.5 py-0.5 text-xs font-semibold text-white">
                {rowCount} contact{rowCount !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={handleClear}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {visibleHeaders.map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-gray-600"
                    >
                      {h}
                    </th>
                  ))}
                  {hiddenCount > 0 && (
                    <th className="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-gray-400">
                      +{hiddenCount} more
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr
                    key={i}
                    className={i < previewRows.length - 1 ? 'border-b border-gray-50' : ''}
                  >
                    {visibleHeaders.map((h) => (
                      <td
                        key={h}
                        className="max-w-[180px] truncate px-3 py-2 text-gray-700"
                        title={row[h]}
                      >
                        {row[h] || (
                          <span className="italic text-gray-300">—</span>
                        )}
                      </td>
                    ))}
                    {hiddenCount > 0 && <td />}
                  </tr>
                ))}
              </tbody>
            </table>
            {rowCount > PREVIEW_ROWS && (
              <div className="border-t border-gray-100 px-3 py-2 text-center text-xs text-gray-400">
                Showing {PREVIEW_ROWS} of {rowCount} rows
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
