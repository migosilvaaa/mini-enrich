import { useState, useCallback } from 'react'
import Papa from 'papaparse'

export function useCsvParser() {
  const [data, setData] = useState([])
  const [headers, setHeaders] = useState([])
  const [rowCount, setRowCount] = useState(0)
  const [error, setError] = useState(null)
  const [fileName, setFileName] = useState(null)

  const parseFile = useCallback((file) => {
    if (!file) return
    if (!file.name.endsWith('.csv')) {
      setError('Only .csv files are supported.')
      return
    }

    setError(null)
    setFileName(file.name)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        if (results.errors.length > 0 && results.data.length === 0) {
          setError('Could not parse CSV. Make sure the file is a valid .csv export.')
          return
        }

        const rows = results.data
        const cols = results.meta.fields || []

        if (rows.length === 0) {
          setError('The CSV has no data rows.')
          return
        }
        if (rows.length > 500) {
          setError(`CSV has ${rows.length} rows. Maximum supported is 500.`)
          return
        }

        setHeaders(cols)
        setData(rows)
        setRowCount(rows.length)
      },
      error(err) {
        setError(err.message)
      },
    })
  }, [])

  const reset = useCallback(() => {
    setData([])
    setHeaders([])
    setRowCount(0)
    setError(null)
    setFileName(null)
  }, [])

  return { data, headers, rowCount, error, fileName, parseFile, reset }
}
