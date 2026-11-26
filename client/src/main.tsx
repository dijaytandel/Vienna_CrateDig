import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { APP_ROUTES } from './app/router';
import AuthProvider from './auth/AuthProvider';
import './index.css';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={createBrowserRouter(APP_ROUTES)} />
    </AuthProvider>
  </StrictMode>,
);
