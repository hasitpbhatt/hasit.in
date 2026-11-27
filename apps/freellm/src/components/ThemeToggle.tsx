/**
 * Shared theme toggle. Styling lives in /theme.css; the click handler is here
 * rather than relying on /theme.js, because React may mount this button after
 * theme.js has already run its one-shot binding pass.
 */
export default function ThemeToggle() {
  return (
    <button
      type="button"
      className="theme-toggle"
      data-theme-toggle
      aria-label="Toggle colour theme"
      title="Toggle colour theme"
      onClick={() => window.HasitTheme?.toggle()}
    >
      <svg
        className="icon-sun"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
      <svg
        className="icon-moon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  )
}
