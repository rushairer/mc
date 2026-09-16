import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { I18nProvider } from './i18n';
import { registerWildernessBound26_3 } from './world/registerWildernessBound26_3';

registerWildernessBound26_3();

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);
