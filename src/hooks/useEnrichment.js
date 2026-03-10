import { useState, useRef, useCallback } from 'react'
import { enrichContacts, enrichCompanies, ApiError } from '../lib/api'
import { domainToAccountName } from '../lib/nameUtils'

const BATCH_SIZE = 25
const BATCH_DELAY_MS = 200   // courtesy pause between batches
const RETRY_DELAY_MS = 2000  // wait on 429
const MAX_RETRIES = 3

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Determine enrichment status for a single contact row.
 *
 * - "not_found" : ZoomInfo returned no match (matched === false)
 * - "enriched"  : ZoomInfo matched AND we have both a title and a phone
 * - "partial"   : ZoomInfo matched but data is incomplete
 *
 * Title and phone here are the final resolved values (after fallbacks),
 * but status tracks ZoomInfo match quality, not just field presence.
 */
function computeStatus(matched, title, phone) {
  if (!matched) return 'not_found'
  if (title && phone) return 'enriched'
  return 'partial'
}

/**
 * Build the initial working row for every contact in mappedData.
 * This is the shape that results[] holds throughout enrichment.
 */
function initRow(contact) {
  return {
    // From column mapping
    first_name: contact.first_name,
    last_name: contact.last_name,
    email: contact.email,
    domain: contact.domain,
    existing_title: contact.existing_title,
    // Enriched fields — populated as phases complete
    title: null,
    phone: null,
    companyName: null,       // ZoomInfo contact-level company name
    zoominfoCompanyId: null,
    contactAccuracyScore: null,
    account_name: null,
    account_domain: contact.domain,
    // UI state
    status: 'pending',       // pending | enriched | partial | not_found
    _matched: false,         // did ZoomInfo return a match?
  }
}

/**
 * @param {{ onWarning?: (msg: string) => void }} [options]
 */
export function useEnrichment({ onWarning } = {}) {
  const [isRunning, setIsRunning]   = useState(false)
  const [phase, setPhase]           = useState(null)  // null | 'contacts' | 'companies' | 'done' | 'cancelled'
  const [progress, setProgress]     = useState({ current: 0, total: 0, percent: 0 })
  const [results, setResults]       = useState([])
  const [error, setError]           = useState(null)
  const [stats, setStats]           = useState(null)  // { enriched, partial, notFound }

  // cancelledRef is checked synchronously inside the async loop —
  // using a ref avoids stale-closure issues with React state.
  const cancelledRef = useRef(false)

  const cancel = useCallback(() => {
    cancelledRef.current = true
    setIsRunning(false)
    setPhase('cancelled')
  }, [])

  const reset = useCallback(() => {
    cancelledRef.current = false
    setIsRunning(false)
    setPhase(null)
    setProgress({ current: 0, total: 0, percent: 0 })
    setResults([])
    setError(null)
    setStats(null)
  }, [])

  const startEnrichment = useCallback(async (mappedData) => {
    // ── Setup ──────────────────────────────────────────────────────────────
    cancelledRef.current = false
    setError(null)
    setStats(null)
    setIsRunning(true)

    // Local working copy — we mutate this directly and push snapshots to
    // React state. This avoids reading stale state inside the async loop.
    const working = mappedData.map(initRow)
    setResults([...working])

    // ── Phase 1: Contact enrichment ────────────────────────────────────────
    setPhase('contacts')

    // Deduplicate: only send each unique email to ZoomInfo once.
    // Keep the full `working` array intact (all original rows, including dupes).
    const uniqueEmails = [...new Set(mappedData.map((r) => r.email.toLowerCase()))]

    const contactBatches = []
    for (let i = 0; i < uniqueEmails.length; i += BATCH_SIZE) {
      contactBatches.push(uniqueEmails.slice(i, i + BATCH_SIZE))
    }

    const totalContactBatches = contactBatches.length
    setProgress({ current: 0, total: totalContactBatches, percent: 0 })

    // email (lowercase) → ZoomInfo result — built up across all batches
    const enrichedMap = {}

    for (let batchIdx = 0; batchIdx < contactBatches.length; batchIdx++) {
      if (cancelledRef.current) return

      const batch = contactBatches[batchIdx]
      const contacts = batch.map((email) => ({ email }))

      // Retry loop for 429 / transient errors
      let retries = 0
      let batchSuccess = false

      while (retries < MAX_RETRIES && !batchSuccess) {
        if (cancelledRef.current) return

        try {
          const batchResults = await enrichContacts(contacts)

          for (const item of batchResults) {
            enrichedMap[item.email.toLowerCase()] = item
          }
          batchSuccess = true

        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            setError('ZoomInfo session expired. Please go back and retry.')
            setIsRunning(false)
            return
          }

          retries++
          if (retries >= MAX_RETRIES) {
            if (err instanceof ApiError && err.status === 429) {
              setError('ZoomInfo rate limit exceeded. Wait a moment, then try again.')
            } else {
              setError(`Enrichment failed: ${err.message}`)
            }
            setIsRunning(false)
            return
          }

          // Backoff: longer wait for 429, shorter for other errors
          const waitMs = (err instanceof ApiError && err.status === 429)
            ? RETRY_DELAY_MS
            : RETRY_DELAY_MS / 2
          await delay(waitMs)
        }
      }

      // Merge this batch's results into the working array.
      // Update EVERY row whose email appears in this batch (handles duplicates).
      for (const row of working) {
        const key = row.email.toLowerCase()
        const zi = enrichedMap[key]
        if (!zi) continue

        const title   = zi.jobTitle    || row.existing_title || ''
        const phone   = zi.mobilePhone || zi.phone           || ''
        const matched = zi.matched ?? false

        row.title                = title   || null
        row.phone                = phone   || null
        row.companyName          = zi.companyName          || null
        row.zoominfoCompanyId    = zi.zoominfoCompanyId    || null
        row.contactAccuracyScore = zi.contactAccuracyScore || null
        row._matched             = matched
        row.status               = computeStatus(matched, title, phone)
      }

      // Push snapshot to React so the live table re-renders
      setResults([...working])

      const current = batchIdx + 1
      setProgress({
        current,
        total: totalContactBatches,
        percent: Math.round((current / totalContactBatches) * 100),
      })

      // Courtesy delay between batches (skip after the last one)
      if (batchIdx < contactBatches.length - 1) {
        await delay(BATCH_DELAY_MS)
      }
    }

    if (cancelledRef.current) return

    // ── Phase 2: Company enrichment ────────────────────────────────────────
    setPhase('companies')

    // Collect unique company identifiers from matched contacts.
    // Key by zoominfoCompanyId when available (most precise), else domain.
    const companyInputsMap = {}  // key → { companyId?, domain }

    for (const [emailKey, zi] of Object.entries(enrichedMap)) {
      if (!zi.matched) continue
      const domain = emailKey.split('@')[1] || ''
      const key    = zi.zoominfoCompanyId || domain
      if (key && !companyInputsMap[key]) {
        companyInputsMap[key] = {
          companyId: zi.zoominfoCompanyId || null,
          domain,
        }
      }
    }

    // Also collect domains from unmatched contacts so we can at least set
    // account_domain correctly (account_name will fall back to domainToAccountName).
    for (const row of working) {
      if (!row.domain) continue
      if (!companyInputsMap[row.domain]) {
        companyInputsMap[row.domain] = { companyId: null, domain: row.domain }
      }
    }

    const companyInputs = Object.values(companyInputsMap)

    // domain → ZoomInfo company name
    const domainToName = {}

    if (companyInputs.length > 0) {
      const companyBatches = []
      for (let i = 0; i < companyInputs.length; i += BATCH_SIZE) {
        companyBatches.push(companyInputs.slice(i, i + BATCH_SIZE))
      }

      for (let batchIdx = 0; batchIdx < companyBatches.length; batchIdx++) {
        if (cancelledRef.current) return

        const batch = companyBatches[batchIdx]

        try {
          const companyResults = await enrichCompanies(batch)

          for (let i = 0; i < batch.length; i++) {
            const result = companyResults[i]
            if (result?.matched && result.name) {
              domainToName[batch[i].domain] = result.name
            }
          }
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            // 401 in Phase 2 is non-fatal — contacts already enriched,
            // fall back to contact-level companyName and domain heuristic.
            onWarning?.('ZoomInfo session expired during account lookup. Account names may be incomplete.')
            break
          }
          // Other errors in Phase 2 are also non-fatal
          onWarning?.(`Account lookup failed: ${err.message}. Account names will use domain fallback.`)
        }

        if (batchIdx < companyBatches.length - 1) {
          await delay(BATCH_DELAY_MS)
        }
      }
    }

    if (cancelledRef.current) return

    // Merge account_name into every row
    for (const row of working) {
      row.account_name =
        domainToName[row.domain]          ||  // ZoomInfo company lookup
        row.companyName                   ||  // ZoomInfo contact-level field
        domainToAccountName(row.domain)       // fallback heuristic
    }

    // ── Finalize ───────────────────────────────────────────────────────────
    const enrichedCount  = working.filter((r) => r.status === 'enriched').length
    const partialCount   = working.filter((r) => r.status === 'partial').length
    const notFoundCount  = working.filter((r) => r.status === 'not_found').length

    setResults([...working])
    setStats({ enriched: enrichedCount, partial: partialCount, notFound: notFoundCount })
    setProgress({ current: totalContactBatches, total: totalContactBatches, percent: 100 })
    setPhase('done')
    setIsRunning(false)
  }, [])

  return {
    isRunning,
    phase,
    progress,
    results,
    error,
    stats,
    startEnrichment,
    cancel,
    reset,
  }
}
