import Papa from 'papaparse'

const STANDARD_FIELDS = [
  'first_name',
  'last_name',
  'title',
  'email',
  'phone',
  'account_domain',
  'account_name',
]

const METADATA_FIELDS = [
  ...STANDARD_FIELDS,
  'enrichment_status',
  'original_title',
  'accuracy_score',
]

/**
 * Serialize enrichment results to a CSV and trigger a browser download.
 *
 * @param {object[]} results        - Final results array from useEnrichment
 * @param {boolean}  includeMetadata - When true, appends enrichment_status,
 *                                    original_title, and accuracy_score columns
 */
export function downloadCsv(results, includeMetadata = false) {
  const fields = includeMetadata ? METADATA_FIELDS : STANDARD_FIELDS

  const rows = results.map((r) => {
    const row = {
      first_name:     r.first_name     ?? '',
      last_name:      r.last_name      ?? '',
      title:          r.title          ?? '',
      email:          r.email          ?? '',
      phone:          r.phone          ?? '',
      account_domain: r.account_domain ?? '',
      account_name:   r.account_name   ?? '',
    }

    if (includeMetadata) {
      row.enrichment_status = r.status                   ?? ''
      row.original_title    = r.existing_title           ?? ''
      row.accuracy_score    = r.contactAccuracyScore     ?? ''
    }

    return row
  })

  const csv = Papa.unparse({ fields, data: rows })

  const date     = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const filename = `enriched_contacts_${date}.csv`

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
