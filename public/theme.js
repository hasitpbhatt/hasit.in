/*
 * hasit.in — shared theme runtime.
 *
 * Kept dependency-free and tiny because every app loads it. The bootstrap part
 * is inlined into each document's <head> (see THEME_BOOTSTRAP below) so the
 * correct theme is applied before first paint; this file only wires up clicks.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'theme';
  var root = document.documentElement;

  function stored() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return v === 'dark' || v === 'light' ? v : null;
    } catch (e) {
      return null;
    }
  }

  function systemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function current() {
    if (root.classList.contains('dark-theme')) return 'dark';
    if (root.classList.contains('light-theme')) return 'light';
    return systemTheme();
  }

  function apply(theme, persist) {
    root.classList.toggle('dark-theme', theme === 'dark');
    root.classList.toggle('light-theme', theme === 'light');
    root.style.colorScheme = theme;

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (e) {
        /* private mode — the class still applies for this page view */
      }
    }

    root.dispatchEvent(
      new CustomEvent('hasit:themechange', { detail: { theme: theme }, bubbles: true })
    );
  }

  function toggle() {
    apply(current() === 'dark' ? 'light' : 'dark', true);
  }

  function init() {
    // One delegated listener instead of binding each button. React (and any
    // other client renderer) mounts its own toggles after this script runs, and
    // a per-button pass would race with a component that also handles the click
    // — the two handlers would cancel each other out. Delegation covers buttons
    // that appear at any time and guarantees exactly one handler.
    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      if (!target.closest('[data-theme-toggle]')) return;
      event.preventDefault();
      toggle();
    });

    // Follow the OS only while the visitor has not chosen a theme themselves.
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () {
        if (!stored()) apply(systemTheme(), false);
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  init();

  window.HasitTheme = { apply: apply, toggle: toggle, current: current };
})();
