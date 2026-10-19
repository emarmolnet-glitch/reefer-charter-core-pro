/**
 * global-madre-entry.jsx
 * Punto de entrada autónomo para montar el Drawer Global MADRE
 * en SeaCharter Core PRO como overlay global sobre cualquier vista.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { GlobalMadreDrawer } from './components/GlobalMadreDrawer.jsx';

let madreRoot = null;

export function mountGlobalMadreDrawer(container) {
  let mountPoint = container?.querySelector?.('#madre-drawer-root')
    || document.getElementById('madre-drawer-root');

  if (!mountPoint) {
    mountPoint = document.createElement('div');
    mountPoint.id = 'madre-drawer-root';
    document.body.appendChild(mountPoint);
  }

  if (!madreRoot) {
    madreRoot = createRoot(mountPoint);
  }
  madreRoot.render(<GlobalMadreDrawer showTrigger={false} />);
  return madreRoot;
}

if (typeof window !== 'undefined') {
  window.mountGlobalMadreDrawer = mountGlobalMadreDrawer;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      mountGlobalMadreDrawer();
    });
  } else {
    mountGlobalMadreDrawer();
  }
}
