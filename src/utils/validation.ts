/**
 * Enterprise Email Domain Validation Utility
 *
 * Ensures only business/corporate emails are permitted.
 * Disallows consumer, free, personal, and temporary disposable email providers.
 */

export const BLOCKED_PERSONAL_DOMAINS = new Set([
  // Google
  'gmail.com',
  'googlemail.com',

  // Yahoo
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.co.uk',
  'yahoo.ca',
  'yahoo.fr',
  'yahoo.de',
  'yahoo.it',
  'yahoo.es',
  'yahoo.com.br',
  'yahoo.com.au',
  'ymail.com',
  'rocketmail.com',

  // Microsoft
  'outlook.com',
  'hotmail.com',
  'hotmail.co.uk',
  'hotmail.fr',
  'live.com',
  'msn.com',
  'passport.com',

  // Apple
  'icloud.com',
  'me.com',
  'mac.com',

  // AOL
  'aol.com',
  'aim.com',

  // Proton
  'proton.me',
  'protonmail.com',
  'protonmail.ch',

  // Zoho
  'zoho.com',
  'zohomail.com',

  // Mail.com / GMX / Web.de
  'mail.com',
  'email.com',
  'gmx.com',
  'gmx.net',
  'gmx.de',
  'web.de',

  // Yandex & Eastern Europe
  'yandex.com',
  'yandex.ru',
  'mail.ru',
  'bk.ru',
  'inbox.ru',
  'list.ru',

  // Tuta
  'tutanota.com',
  'tutamail.com',
  'tuta.com',
  'tuta.io',

  // Others & Disposable / Temporary
  'fastmail.com',
  'hushmail.com',
  'inbox.com',
  'rediffmail.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'sharklasers.com',
  'mailinator.com',
  'throwawaymail.com',
  'getairmail.com',
  'dispostable.com',
  'yopmail.com',
]);

/**
 * Checks if an email uses a personal or disposable consumer domain.
 * @param email Email address to check
 * @returns true if domain is personal/disallowed, false if valid corporate domain
 */
export function isPersonalEmail(email: string): boolean {
  if (!email || typeof email !== 'string' || !email.includes('@')) return false;
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  if (BLOCKED_PERSONAL_DOMAINS.has(domain)) return true;
  for (const blocked of BLOCKED_PERSONAL_DOMAINS) {
    if (domain.endsWith('.' + blocked)) return true;
  }
  return false;
}
