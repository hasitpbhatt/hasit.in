/**
 * HTML escaping for values interpolated into templates.
 *
 * Everything rendered into a page must go through here unless it is generated
 * by us. Claim log rows contain attacker-influenced data (IP headers, wallet
 * addresses), and the admin dashboard interpolates them raw.
 */

const AMP = String.fromCharCode(38);

const HTML_ENTITIES: Record<string, string> = {
  '&': AMP + 'amp;',
  '<': AMP + 'lt;',
  '>': AMP + 'gt;',
  '"': AMP + 'quot;',
  "'": AMP + '#39;',
  '`': AMP + '#96;',
};

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"'`]/g, (ch) => HTML_ENTITIES[ch] ?? ch);
}
