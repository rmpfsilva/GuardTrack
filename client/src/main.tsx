import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker for PWA functionality (both dev and prod for install prompt)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js', { scope: '/' })
      .then(registration => {
        console.log('[PWA] ServiceWorker registered successfully:', registration.scope);
        
        // Check for updates periodically in production
        if (import.meta.env.PROD) {
          setInterval(() => {
            registration.update();
          }, 60000); // Check every minute
        }
      })
      .catch(err => {
        console.error('[PWA] ServiceWorker registration failed:', err);
      });
  });
  
  // Debug: Log when beforeinstallprompt fires
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('[PWA] beforeinstallprompt event fired');
  });
}
