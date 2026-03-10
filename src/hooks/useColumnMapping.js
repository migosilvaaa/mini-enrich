import { useState, useEffect, useMemo } from 'react'
import { autoMapColumns } from '../lib/fieldMapping'
import { splitName, extractDomain } from '../lib/nameUtils'

const NONE = '__none__'

/**
 * Manages column mapping state for the three fields (name, email, title).
 *
 * @param {string[]} headers   - CSV column headers
 * @param {object[]} csvData   - Parsed CSV rows
 * @returns {{
 *   mapping: { name: string|null, email: string|null, title: string|null },
 *   updateMapping: (field: string, value: string) => void,
 *   isValid: boolean,
 *   mappedData: object[],
 *   preview: object[],
 *   NONE: string,
 * }}
 */
export function useColumnMapping(headers, csvData) {
  const [mapping, setMapping] = useState({ name: null, email: null, title: null })

  // Auto-map when headers change (e.g. new file loaded)
  useEffect(() => {
    if (!headers || headers.length === 0) return
    const auto = autoMapColumns(headers)
    setMapping(auto)
  }, [headers])

  function updateMapping(field, value) {
    setMapping((prev) => ({
      ...prev,
      [field]: value === NONE ? null : value,
    }))
  }

  // Name and email are required
  const isValid = !!(mapping.name && mapping.email)

  // Transform all CSV rows into enrichment-ready objects
  const mappedData = useMemo(() => {
    if (!isValid || !csvData.length) return []

    const skipped = []
    const rows = []

    for (const row of csvData) {
      const rawName = mapping.name ? (row[mapping.name] || '').trim() : ''
      const rawEmail = mapping.email ? (row[mapping.email] || '').trim() : ''
      const rawTitle = mapping.title ? (row[mapping.title] || '').trim() : ''

      // Skip rows with no email
      if (!rawEmail) {
        skipped.push(row)
        continue
      }

      const { firstName, lastName } = splitName(rawName)
      const domain = extractDomain(rawEmail)

      rows.push({
        first_name: firstName,
        last_name: lastName,
        email: rawEmail,
        domain,
        existing_title: rawTitle,
      })
    }

    return rows
  }, [csvData, mapping, isValid])

  // First 3 mapped rows for the preview card
  const preview = useMemo(() => mappedData.slice(0, 3), [mappedData])

  return { mapping, updateMapping, isValid, mappedData, preview, NONE }
}
