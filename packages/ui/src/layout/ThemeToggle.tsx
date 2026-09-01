'use client';

import { useEffect, useState } from 'react';
import { THEME_COOKIE, type Appearance } from '@mn/tokens';

/**
 * Appearance switch.
 *
 * The server renders `data-theme` from the cookie, so the first paint is already correct
 * and there is no flash. This component only flips the attribute and writes the cookie
 * back; it never decides the initial value, because that decision has to happen before
 * hydration.
 *
 * `aria-pressed` plus a textual label, as the a11y doc requires - an icon alone does not
 * announce state.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Appearance | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next: Appearance = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    // Lax + one year: a reader's appearance choice should survive a session, and it is
    // not a credential, so it does not need to be HttpOnly.
    const secure = location.protocol === 'https:' ? '; secure' : '';
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax${secure}`;
    setTheme(next);
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="mn-iconbutton"
      aria-pressed={isDark}
      // The visible label collapses below 600px; the name must survive that.
      aria-label={isDark ? 'Tema escuro ativo. Mudar para o tema claro' : 'Tema claro ativo. Mudar para o tema escuro'}
      onClick={toggle}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        aria-hidden="true"
      >
        {isDark ? (
          <path d="M21 12.8A9 9 0 0 1 11.2 3a7 7 0 1 0 9.8 9.8z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7" />
          </>
        )}
      </svg>
      <span>{isDark ? 'Tema escuro' : 'Tema claro'}</span>
    </button>
  );
}
