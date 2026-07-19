// Home Assistant frontend custom elements used by the card (globally registered by HA).
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'ha-card': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
      'ha-icon': DetailedHTMLProps<HTMLAttributes<HTMLElement> & { icon?: string }, HTMLElement>;
    }
  }

  interface Window {
    customCards?: Array<{ type: string; name: string; description?: string; preview?: boolean }>;
  }
}

export {};
