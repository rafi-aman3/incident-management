/**
 * Best-effort PII redactor. Defence-in-depth, NOT a guarantee — Anthropic's
 * no-training-on-API-input policy is the actual privacy backstop. We strip
 * the names we know about (profiles + injured persons) and the obvious
 * patterns (emails, US phone, UK NI numbers) so that the *typical* request
 * payload doesn't carry full names.
 *
 * Free-text descriptions can re-leak. SPEC §17 documents this explicitly.
 */

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// US (XXX-XXX-XXXX, (XXX) XXX-XXXX, XXXXXXXXXX) and UK (07XXX XXXXXX, +44 XXXX XXXXXX) — coarse but useful.
const PHONE_RE = /\b(?:\+?\d[\s().-]?){9,14}\d\b/g;
// UK National Insurance number e.g. AB123456C.
const UK_NI_RE = /\b[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]\b/g;

export interface NamedEntity {
  fullName: string;
  initials: string;
}

/** Build initials from a full name. "Maria González-Sanchez" → "MGS". */
export function initialsOf(fullName: string): string {
  return fullName
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 4);
}

/**
 * Redact a free-text payload before it leaves the org.
 *   - Replace each known name with its initials
 *   - Replace email addresses with [EMAIL]
 *   - Replace phone numbers with [PHONE]
 *   - Replace UK NI numbers with [NI]
 *
 * Names are matched case-insensitively, longest first (so "Maria González"
 * isn't half-replaced before "Maria" gets a chance).
 */
export function redactText(text: string, names: NamedEntity[] = []): string {
  let out = text;

  const sorted = [...names].sort((a, b) => b.fullName.length - a.fullName.length);
  for (const { fullName, initials } of sorted) {
    if (!fullName.trim()) continue;
    const escaped = fullName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "gi");
    out = out.replace(re, initials);
  }

  out = out.replace(EMAIL_RE, "[EMAIL]");
  out = out.replace(PHONE_RE, "[PHONE]");
  out = out.replace(UK_NI_RE, "[NI]");

  return out;
}
