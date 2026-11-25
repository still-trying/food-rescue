const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const PHONE_REGEX =
  /\+[1-9][0-9\s().-]{7,15}[0-9]|\b\(?[0-9]{3}\)?[\s.][0-9]{3}[\s.-][0-9]{4}\b/g
const JWT_REGEX = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g

/**
 * Redact emails, phone numbers, and JWT tokens before recording diagnostics
 * or sending telemetry to an external error tracker.
 */
export function scrubPii(input: string): string {
  return input
    .replace(JWT_REGEX, '[REDACTED_TOKEN]')
    .replace(EMAIL_REGEX, '[REDACTED_EMAIL]')
    .replace(PHONE_REGEX, '[REDACTED_PHONE]')
}

export function reportClientError(context: string, error: unknown): void {
  const rawMessage =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  const sanitizedMessage = scrubPii(rawMessage)

  const env = (import.meta as { env?: Record<string, string | undefined> }).env
  if (env?.DEV) {
    console.error(`[${context}]`, sanitizedMessage)
  }
}
