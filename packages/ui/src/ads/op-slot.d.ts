import type { OpaPrecoSlot } from './opapreco';

/**
 * `<op-slot>`, the custom element OpaPreço's script defines (`OpaPrecoAd.tsx`), in the
 * JSX element table. React 19 keeps that table under `React.JSX`, so the declaration
 * augments the `react` module rather than a global `JSX`.
 */
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'op-slot': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        'slot-key': OpaPrecoSlot;
        'site-key': string;
        endpoint: string;
        section?: string;
        /** Comma-separated tag slugs. */
        tags?: string;
        'content-id'?: string;
      };
    }
  }
}
