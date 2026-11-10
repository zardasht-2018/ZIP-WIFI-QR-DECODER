import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { registerServiceWorkerWithUpdates } from './services/swUpdateService';

// Register Service Worker with update detection & single-reload guard
registerServiceWorkerWithUpdates();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
