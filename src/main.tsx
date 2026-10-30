import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App.tsx';
import { initializeAppearance } from './utils/settings';

initializeAppearance();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register service worker in production builds for PWA installability & offline support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const register = () => navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
    .catch(err => console.error('Offline support could not be initialized:', err));
  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', register, { once: true });
}
