/**
 * Service to transiently detect likely personal contact information in chat messages.
 * Does not store, log, or transmit any detected information.
 */
export function containsContactInformation(message: string): boolean {
  const normalized = message.toLowerCase();

  // 1. Check for obvious email patterns
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  if (emailRegex.test(normalized)) {
    return true;
  }

  // 2. Check for Indian mobile numbers
  // Matches: 10 consecutive digits, or 10 digits with a single space/hyphen separating first/last 5 digits,
  // optionally prefixed by +91 or 91 (with optional space/hyphen).
  const phoneRegex = /(?:\+?91[\s-]?)?[6-9]\d{9}|(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]\d{5}/;
  if (phoneRegex.test(normalized)) {
    return true;
  }

  // 3. Check for common case-insensitive contact-sharing phrases
  const keywords = [
    'call me',
    'whatsapp',
    'whatsapp me',
    'contact me',
    'my number',
    'phone number',
    'telegram',
    'email me',
  ];

  for (const keyword of keywords) {
    if (normalized.includes(keyword)) {
      return true;
    }
  }

  return false;
}
