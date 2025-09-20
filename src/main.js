import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n'; // Configuración de i18n (crear este archivo)
import App from './App';
import './index.css';

// Configuración de Firebase (asegúrate de que este archivo exista)
import './firebase';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </React.StrictMode>
);

// Manejo de errores global
window.addEventListener('error', (event) => {
  console.error('Error global capturado:', event.error);
  // Puedes enviar esto a un servicio de logging si lo deseas
});

// Manejo de errores de promesas no capturadas
window.addEventListener('unhandledrejection', (event) => {
  console.error('Promesa rechazada no capturada:', event.reason);
  event.preventDefault();
});

// Polyfill para Buffer si es necesario (aunque webpack ya lo maneja)
if (typeof window.Buffer === 'undefined') {
  window.Buffer = require('buffer').Buffer;
}