/**
 * Fetch wrappers for the Vercel API routes.
 *
 * All functions throw an ApiError on non-2xx responses so callers can
 * inspect `err.status` to distinguish 401, 429, etc. from generic failures.
 */

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parseErrorMessage(res) {
  try {
    const json = await res.json()
    return json.error || json.message || `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

/**
 * GET /api/auth-check
 * Returns { status: 'connected' | 'not_configured' | 'error', message? }
 */
export async function checkConnection() {
  const res = await fetch('/api/auth-check')
  if (!res.ok) throw new ApiError(res.status, await parseErrorMessage(res))
  return res.json()
}

/**
 * POST /api/enrich-contacts
 * @param {{ email: string }[]} contacts  — max 25
 * @returns enriched contact array
 */
export async function enrichContacts(contacts) {
  const res = await fetch('/api/enrich-contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contacts }),
  })
  if (!res.ok) throw new ApiError(res.status, await parseErrorMessage(res))
  return res.json()
}

/**
 * POST /api/enrich-companies
 * @param {{ companyId?: string, domain: string }[]} companies  — max 25
 * @returns enriched company array
 */
export async function enrichCompanies(companies) {
  const res = await fetch('/api/enrich-companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companies }),
  })
  if (!res.ok) throw new ApiError(res.status, await parseErrorMessage(res))
  return res.json()
}
