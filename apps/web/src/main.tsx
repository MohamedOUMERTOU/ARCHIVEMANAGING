import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { env } from '@/app/config/env';
import { App } from '@/app/App';
import '@/i18n';
import './index.css';

async function startMocks() {
  // Test sur import.meta.env directement : Vite le remplace au build et retire MSW si c'est « false »
  if (import.meta.env.VITE_API_MOCKS !== 'true' || !env.apiMocks) return;
  const { worker } = await import('@/mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}

const root = document.getElementById('root');
if (!root) throw new Error('Élément #root introuvable');

void startMocks().then(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
