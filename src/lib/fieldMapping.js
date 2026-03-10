/**
 * Candidate header strings (lowercase, trimmed) for each field.
 * Listed from most-specific to least-specific so the first match wins
 * when a CSV header contains multiple candidate substrings.
 */
export const FIELD_HINTS = {
  name: ['full name', 'fullname', 'contact name', 'name'],
  email: ['email address', 'e-mail', 'user email', 'mail', 'email'],
  title: ['combined title', 'job title', 'title', 'role', 'position'],
}

/**
 * Given an array of CSV column headers, return the best auto-mapped
 * column name for each field, or null if no match is found.
 *
 * Matching strategy (in priority order):
 *   1. Exact match (normalized): header === hint
 *   2. Starts-with match: header starts with hint
 *   3. Contains match: header contains hint
 *
 * @param {string[]} headers
 * @returns {{ name: string|null, email: string|null, title: string|null }}
 */
export function autoMapColumns(headers) {
  const normalized = headers.map((h) => ({ original: h, lower: h.toLowerCase().trim() }))

  function bestMatch(hints) {
    // Try each hint in order; return the first header that matches
    for (const hint of hints) {
      // 1. Exact
      const exact = normalized.find((h) => h.lower === hint)
      if (exact) return exact.original

      // 2. Starts-with
      const startsWith = normalized.find((h) => h.lower.startsWith(hint))
      if (startsWith) return startsWith.original

      // 3. Contains
      const contains = normalized.find((h) => h.lower.includes(hint))
      if (contains) return contains.original
    }
    return null
  }

  return {
    name: bestMatch(FIELD_HINTS.name),
    email: bestMatch(FIELD_HINTS.email),
    title: bestMatch(FIELD_HINTS.title),
  }
}
