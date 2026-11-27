/** Global injected by the shared `/theme.js` runtime. */
declare global {
  interface Window {
    HasitTheme?: {
      apply(theme: 'dark' | 'light', persist: boolean): void;
      toggle(): void;
      current(): 'dark' | 'light';
    };
  }
}

export {}
