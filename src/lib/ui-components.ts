/**
 * Reusable frontend components rendered as HTML by the Worker.
 *
 * These helpers are intentionally framework-free so they can be dropped into
 * any server-rendered page (portfolio, TRX faucet, admin dashboards, ...).
 * Every user-facing value is escaped through escapeHtml before it reaches the
 * markup, and the matching client behaviour lives in /components.js.
 */

import { escapeHtml } from './html.ts';

export type StatusTone =
  | 'neutral'
  | 'idle'
  | 'loading'
  | 'success'
  | 'ready'
  | 'online'
  | 'warning'
  | 'warn'
  | 'error'
  | 'danger'
  | 'failed'
  | 'offline'
  | 'locked'
  | 'done'
  | 'complete'
  | 'info'
  | 'pending';

export type EmptyStateVariant = 'card' | 'plain' | 'inline';
export type EmptyStateSize = 'sm' | 'md' | 'lg';
export type TokenAnimation = 'fade' | 'iris' | 'slide';

const ALLOWED_STATUS = new Set<StatusTone>([
  'neutral',
  'idle',
  'loading',
  'success',
  'ready',
  'online',
  'warning',
  'warn',
  'error',
  'danger',
  'failed',
  'offline',
  'locked',
  'done',
  'complete',
  'info',
  'pending',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanStatus(value: unknown): StatusTone {
  const raw = String(value ?? 'neutral').trim().toLowerCase();
  return (ALLOWED_STATUS.has(raw as StatusTone) ? raw : 'neutral') as StatusTone;
}

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function normalizeArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value === undefined || value === null) return [];
  return [value as T];
}

export interface StatusBadgeOptions {
  /** Text shown next to the status dot. */
  label?: unknown;
  text?: unknown;
  title?: unknown;
  /** Visual tone of the badge. */
  status?: StatusTone | string;
  tone?: StatusTone | string;
  variant?: StatusTone | string;
  /** Overall size. */
  size?: 'sm' | 'md' | 'lg';
  /** Poll an endpoint and keep the badge up to date. */
  live?: boolean;
  polling?: boolean;
  endpoint?: string;
  url?: string;
  /** Polling interval in milliseconds. */
  interval?: number;
  pollInterval?: number;
  /** Optional icon/emoji shown before the label. */
  icon?: unknown;
  /** Extra class names. */
  className?: string;
  /** Optional tooltip. */
  tooltip?: unknown;
}

export function renderStatusBadge(...args: unknown[]): string {
  let options: StatusBadgeOptions = {};
  if (args.length === 1 && isRecord(args[0])) {
    options = args[0] as StatusBadgeOptions;
  } else {
    const [label, status, extra] = args;
    options = {
      label,
      status: status as StatusTone | string,
      ...(isRecord(extra) ? extra : {}),
    };
  }

  const label = cleanText(
    options.label ?? options.text ?? options.title ?? ''
  );
  const status = cleanStatus(options.status ?? options.tone ?? options.variant);
  const size = options.size === 'sm' || options.size === 'lg' ? options.size : 'md';
  const endpoint = cleanText(options.endpoint ?? options.url);
  const interval = Number(options.interval ?? options.pollInterval) || 0;
  const live = Boolean(options.live || options.polling || endpoint);
  const icon = cleanText(options.icon);
  const tooltip = cleanText(options.tooltip);
  const extraClass = cleanText(options.className);

  const classes = [
    'status-badge',
    `status-badge--${status}`,
    `status-badge--${size}`,
    extraClass,
  ]
    .filter(Boolean)
    .join(' ');

  const dataAttrs = [
    live ? 'data-status-live="true"' : '',
    endpoint ? `data-poll-endpoint="${escapeHtml(endpoint)}"` : '',
    interval > 0 ? `data-poll-interval="${escapeHtml(String(interval))}"` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const iconHtml = icon ? `<span class="status-badge__icon" aria-hidden="true">${escapeHtml(icon)}</span>` : '';
  const labelHtml = label
    ? `<span class="status-badge__label">${escapeHtml(label)}</span>`
    : '<span class="status-badge__label sr-only">Status</span>';

  return `<span class="${escapeHtml(classes)}" role="status" aria-live="polite" aria-atomic="true" data-status="${escapeHtml(status)}"${tooltip ? ` title="${escapeHtml(tooltip)}"` : ''}${dataAttrs ? ` ${dataAttrs}` : ''}>${iconHtml ? `${iconHtml} ` : ''}<span class="status-badge__dot" aria-hidden="true"></span> ${labelHtml}</span>`;
}

export interface EmptyStateAction {
  label: unknown;
  href?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | string;
  onClick?: string;
}

export interface EmptyStateOptions {
  title?: unknown;
  heading?: unknown;
  description?: unknown;
  body?: unknown;
  message?: unknown;
  text?: unknown;
  icon?: unknown;
  emoji?: unknown;
  actions?: EmptyStateAction[] | EmptyStateAction;
  action?: EmptyStateAction | string;
  variant?: EmptyStateVariant | string;
  size?: EmptyStateSize | string;
  className?: string;
  role?: string;
}

export function renderEmptyState(...args: unknown[]): string {
  let options: EmptyStateOptions = {};
  if (args.length === 1 && isRecord(args[0])) {
    options = args[0] as EmptyStateOptions;
  } else {
    const [title, description, extra] = args;
    options = {
      title,
      description,
      ...(isRecord(extra) ? extra : {}),
    };
  }

  const title = cleanText(
    options.title ?? options.heading ?? ''
  );
  const description = cleanText(
    options.description ??
      options.body ??
      options.message ??
      options.text ??
      ''
  );
  const icon = cleanText(options.icon ?? options.emoji);
  const size =
    options.size === 'sm' || options.size === 'lg' ? options.size : 'md';
  const rawVariant = cleanText(options.variant || 'card');
  const variant: EmptyStateVariant =
    rawVariant === 'plain' || rawVariant === 'inline' ? rawVariant : 'card';
  const className = cleanText(options.className);
  const role = cleanText(options.role) || 'status';

  const actionArray = [
    ...normalizeArray<EmptyStateAction>(options.actions),
    ...(options.action !== undefined ? normalizeArray(options.action) : []),
  ];

  const actionsHtml = actionArray
    .map((action) => {
      if (typeof action === 'string') return action;
      if (!isRecord(action)) return '';
      const record = action as unknown as EmptyStateAction;
      const label = escapeHtml(cleanText(record.label));
      if (!label) return '';
      const href = cleanText(record.href);
      const onClick = cleanText(record.onClick);
      const variant = cleanText(record.variant) || 'primary';
      const cls = `empty-state__action btn btn-${escapeHtml(variant)}`;
      if (href) {
        return `<a href="${escapeHtml(href)}" class="${escapeHtml(cls)}">${label}</a>`;
      }
      const clickAttr = onClick ? ` onclick="${escapeHtml(onClick)}"` : '';
      return `<button type="button" class="${escapeHtml(cls)}"${clickAttr}>${label}</button>`;
    })
    .filter(Boolean)
    .join('\n');

  const iconHtml = icon
    ? `<div class="empty-state__icon" aria-hidden="true">${escapeHtml(icon)}</div>`
    : '';
  const titleHtml = title
    ? `<h3 class="empty-state__title">${escapeHtml(title)}</h3>`
    : '';
  const descriptionHtml = description
    ? `<p class="empty-state__description">${escapeHtml(description)}</p>`
    : '';

  const classes = [
    'empty-state',
    `empty-state--${variant}`,
    `empty-state--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return `<section class="${escapeHtml(classes)}" role="${escapeHtml(role)}" aria-live="polite">
  ${iconHtml}
  ${titleHtml}
  ${descriptionHtml}
  ${actionsHtml ? `<div class="empty-state__actions">${actionsHtml}</div>` : ''}
</section>`;
}

export function renderNoDataState(...args: unknown[]): string {
  const [title, description, extra] = args;
  return renderEmptyState({
    icon: '📭',
    title: title ?? 'Nothing here yet',
    description: description ?? 'Check back once something has been added.',
    ...(isRecord(extra) ? extra : {}),
  });
}

export function renderSearchEmptyState(...args: unknown[]): string {
  const [query, extra] = args;
  const q = cleanText(query);
  return renderEmptyState({
    icon: '🔍',
    title: q ? `No results for "${q}"` : 'No results found',
    description: q
      ? 'Try a different search term or clear the filters.'
      : 'Try adjusting your search or filters.',
    ...(isRecord(extra) ? extra : {}),
  });
}

export function renderErrorState(...args: unknown[]): string {
  const [title, description, extra] = args;
  return renderEmptyState({
    icon: '⚠️',
    title: title ?? 'Something went wrong',
    description: description ?? 'Please try again in a moment.',
    variant: 'card',
    ...(isRecord(extra) ? extra : {}),
  });
}

export function renderLoadingState(...args: unknown[]): string {
  const [label, extra] = args;
  return renderEmptyState({
    icon: '⏳',
    title: cleanText(label) || 'Loading…',
    description: '',
    variant: 'plain',
    ...(isRecord(extra) ? extra : {}),
  });
}

export interface TokenRevealOptions {
  token?: unknown;
  value?: unknown;
  secret?: unknown;
  key?: unknown;
  label?: unknown;
  title?: unknown;
  hint?: unknown;
  maskedText?: unknown;
  placeholder?: unknown;
  revealLabel?: unknown;
  hideLabel?: unknown;
  copy?: boolean;
  copyLabel?: unknown;
  animation?: TokenAnimation | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

let tokenCounter = 0;

export function renderTokenReveal(...args: unknown[]): string {
  let options: TokenRevealOptions = {};
  if (args.length === 1 && isRecord(args[0])) {
    options = args[0] as TokenRevealOptions;
  } else {
    const [token, extra] = args;
    options = {
      token,
      ...(isRecord(extra) ? extra : {}),
    };
  }

  const token = cleanText(
    options.token ?? options.value ?? options.secret ?? options.key ?? ''
  );
  const label = cleanText(options.label ?? options.title ?? '');
  const hint = cleanText(options.hint ?? '');
  const maskedText = cleanText(options.maskedText ?? options.placeholder) || '••••••••••••';
  const revealLabel = cleanText(options.revealLabel) || 'Reveal';
  const hideLabel = cleanText(options.hideLabel) || 'Hide';
  const copy = options.copy !== false;
  const copyLabel = cleanText(options.copyLabel) || 'Copy';
  const animation = cleanText(options.animation) || 'fade';
  const size = options.size === 'sm' || options.size === 'lg' ? options.size : 'md';
  const className = cleanText(options.className);

  const id = `token-reveal-${++tokenCounter}`;
  const classes = [
    'token-reveal',
    `token-reveal--${size}`,
    `token-reveal--${animation}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const labelHtml = label
    ? `<label class="token-reveal__label" for="${escapeHtml(id)}">${escapeHtml(label)}</label>`
    : '';
  const hintHtml = hint
    ? `<p class="token-reveal__hint">${escapeHtml(hint)}</p>`
    : '';

  return `<div class="${escapeHtml(classes)}" id="${escapeHtml(id)}" data-token="${escapeHtml(token)}" data-token-state="masked">
  ${labelHtml}
  <div class="token-reveal__value">
    <code class="token-reveal__masked" aria-hidden="false">${escapeHtml(maskedText)}</code>
    <code class="token-reveal__secret" hidden aria-live="polite">${escapeHtml(token)}</code>
  </div>
  <div class="token-reveal__actions">
    <button type="button" class="token-reveal__toggle btn btn-secondary btn-sm" data-token-action="toggle" aria-expanded="false" aria-controls="${escapeHtml(id)}">${escapeHtml(revealLabel)}</button>
    ${copy ? `<button type="button" class="token-reveal__copy btn btn-ghost btn-sm" data-token-action="copy">${escapeHtml(copyLabel)}</button>` : ''}
  </div>
  ${hintHtml}
</div>`;
}

// Convenience aliases kept for callers/tests that use shorter names.
export const renderStatus = renderStatusBadge;
export const renderBadge = renderStatusBadge;
export const statusBadge = renderStatusBadge;

export const renderEmpty = renderEmptyState;
export const emptyState = renderEmptyState;
export const renderEmptyStateCard = renderEmptyState;

export const renderToken = renderTokenReveal;
export const tokenReveal = renderTokenReveal;
export const renderSecret = renderTokenReveal;
export const revealToken = renderTokenReveal;

export const renderPollingStatusBadge = renderStatusBadge;
export const pollingStatusBadge = renderStatusBadge;
export const renderEmptyStateLibrary = renderEmptyState;
export const emptyStateLibrary = renderEmptyState;
