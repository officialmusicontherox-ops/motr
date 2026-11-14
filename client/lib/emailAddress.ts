/**
 * Is this an address that could actually receive mail?
 *
 * The HTML spec's own rule for <input type="email"> does not require a dot,
 * so "jay@thehumblebrag" passes a browser's validation and every library
 * that defers to it. One artist submitted exactly that, and nobody noticed
 * until Resend refused the address during a send, a day after they joined.
 *
 * This asks for the one thing the browser does not: a domain with a label
 * and a top-level domain after it. It deliberately does not police which
 * endings exist, because that list changes and guessing wrong would turn
 * away a real address.
 */
export const EMAIL_RE = /^[^@\s,;]+@[^@\s,;.]+(\.[^@\s,;.]+)*\.[a-z]{2,}$/i;

export function isEmailAddress(value: unknown): value is string {
  return typeof value === "string" && EMAIL_RE.test(value.trim());
}
