/**
 * Split a full name string into firstName and lastName.
 * "Pat La Morte" → { firstName: "Pat", lastName: "La Morte" }
 * "Stephanie"    → { firstName: "Stephanie", lastName: "" }
 */
export function splitName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

/**
 * Extract the domain from an email address.
 * "plamorte@pax8.com" → "pax8.com"
 */
export function extractDomain(email) {
  return (email || '').split('@')[1]?.toLowerCase().trim() || ''
}

/**
 * Convert a domain into a human-readable account name.
 * "pax8.com"       → "Pax8"
 * "my-company.io"  → "My Company"
 */
export function domainToAccountName(domain) {
  const base = (domain || '').split('.')[0]
  return base
    .split('-')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ')
}
