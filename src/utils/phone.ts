const E164_REGEX = /^\+[1-9][0-9]{7,14}$/

/**
 * Strip common phone formatting characters and keep a canonical E.164 candidate.
 */
export function normalizePhoneE164(raw: string): string {
  return raw.trim().replace(/[()\s.-]/g, '')
}

export function isValidE164Phone(normalized: string): boolean {
  return E164_REGEX.test(normalized)
}

/**
 * Defensively validate a phone string before placing it in a `tel:` URI.
 */
export function sanitizeTelHref(raw: string | null | undefined): string | null {
  if (!raw) {
    return null
  }
  const normalized = normalizePhoneE164(raw)
  return isValidE164Phone(normalized) ? `tel:${normalized}` : null
}

