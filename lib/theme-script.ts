/**
 * The pre-paint theme resolver.
 *
 * Kept out of the layout so it is one named, testable constant rather than a string
 * buried in JSX: it runs before first paint on every page of the site, and a mistake in
 * it means every visitor gets the wrong theme.
 *
 * Order of precedence: an explicit cookie choice, then the OS preference. Wrapped in
 * try/catch because a browser with cookies disabled must still render.
 */
export const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )mn-theme=(dark|light)/);var t=m?m[1]:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
