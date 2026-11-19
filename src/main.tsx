import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Defensa de cuota / autorización Google Maps JS (Case A Demo Key)
declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

window.gm_authFailure = () => {
  window.dispatchEvent(
    new CustomEvent('gmp-quota-exceeded', {
      detail: { source: 'gm_authFailure' },
    })
  );
};

const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  try {
    const joined = args
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item instanceof Error) return item.message;
        return String(item);
      })
      .join(' ');

    if (
      joined.includes('OverQuotaMapError') ||
      joined.includes('QuotaExceededError') ||
      joined.includes('ApiNotActivatedMapError') ||
      joined.includes('RefererNotAllowedMapError')
    ) {
      window.dispatchEvent(
        new CustomEvent('gmp-quota-exceeded', {
          detail: { source: 'console_error' },
        })
      );
    }
  } catch {
    // Do not break error logging
  }
  originalConsoleError(...args);
};

createRoot(document.getElementById('root')!).render(<App />);
