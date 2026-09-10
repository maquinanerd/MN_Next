/**
 * Tailwind v4 runs as a PostCSS plugin. The theme itself is CSS-first: it lives in
 * `packages/tokens/src/tokens.css` (`@theme`), so there is no `tailwind.config.*`.
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
