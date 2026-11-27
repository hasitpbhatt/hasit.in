/**
 * Shared theme bootstrap and toggle markup.
 *
 * The inline script runs before the stylesheet so the correct theme class is on
 * <html> at first paint — without it, a dark-mode visitor sees a flash of light.
 * Keep it synchronous, tiny and inside <head>.
 */

/** Inline `<script>` for `<head>`, placed before any stylesheet link. */
export const THEME_BOOTSTRAP = `<script>
(function(){try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.className+=' dark-theme';return}if(t==='light'){document.documentElement.className+=' light-theme';return}}catch(e){}var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.className+=d?' dark-theme':' light-theme'})();
</script>`;

/** Sun + moon icons; CSS in theme.css reveals exactly one. */
const ICONS = `<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg><svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

/** Theme toggle button. Requires `public/theme.js` to be loaded. */
export function renderThemeToggle(extraClass = ''): string {
  const cls = ['theme-toggle', extraClass].filter(Boolean).join(' ');
  return `<button type="button" class="${cls}" data-theme-toggle aria-label="Toggle colour theme" title="Toggle colour theme">${ICONS}</button>`;
}

/** `<script defer>` tag for the theme runtime, plus a no-JS escape hatch. */
export const THEME_RUNTIME = `<script defer src="/theme.js"></script>`;
