import { StrictMode } from 'react';
import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

interface VertElement extends HTMLElement {
  reactRot?: Root;
}

/**
 * Monterer en side i #rot.
 *
 * Vite kjører modulen på nytt ved hot reload. Kaller vi createRoot() hver gang,
 * advarer React om at samme container får flere røtter. Roten lagres derfor på
 * DOM-elementet, som overlever modul-reload.
 */
export function monter(side: ReactElement): void {
  const vert = document.getElementById('rot') as VertElement | null;
  if (!vert) {
    return;
  }
  if (!vert.reactRot) {
    vert.reactRot = createRoot(vert);
  }
  vert.reactRot.render(<StrictMode>{side}</StrictMode>);
}
