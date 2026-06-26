/**
 * Shared validation rules for the contact form.
 *
 * This file is the single source of truth, imported by BOTH the client
 * component (for instant user feedback) and the server endpoint (for the
 * security re-validation). Keeping the rules here means the two sides can
 * never drift out of sync.
 *
 * In Nuxt it is available through the `#shared` alias:
 *   import { FIELD_LIMITS, EMAIL_REGEX } from '#shared/contact-form'
 *
 * Note: these are RULES only. The destination email address is
 * configuration and lives elsewhere (a prop on the client, an environment
 * variable on the server).
 */

/**
 * Maximum allowed length per field, in characters.
 * Used on both sides to reject oversized payloads and keep the limits aligned.
 */
export const FIELD_LIMITS = {
  name: 100,
  email: 200,
  message: 5000,
} as const

/**
 * Email validation regex.
 *
 * Intentionally pragmatic, not a full RFC 5322 implementation: it checks the
 * "something@something.something" shape with no spaces, which catches the most
 * common typos. The only truly reliable check is sending an actual email.
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Shape of the contact form data, reused on the client and the server so the
 * data structure is described in one place.
 */
export interface ContactFormData {
  name: string
  email: string
  message: string
}
