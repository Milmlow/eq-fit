import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/fonts.css';
import './ui/themes.css';
import './ui/styles.css';
import './ui/today.css';
import './ui/backup.css';
import './ui/push.css';
import './ui/screens.css';
import { registerServiceWorker } from './pwa';
import { initTheme } from './ui/useTheme';

initTheme();
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
