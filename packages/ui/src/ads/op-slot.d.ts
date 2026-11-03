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
        /** The template registered for the slot in OpaPreço, when it is not the key's default. */
        template?: 'product_card_v1';
        /** Where the slot shows: OpaPreço's script asks for no ad anywhere else. */
        viewports?: 'desktop';
      };
    }
  }
}
