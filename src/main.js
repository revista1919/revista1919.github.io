import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n'; // Asumo que tienes un archivo de configuración para i18next
import App from './App';
import './index.css'; // Estilos globales

// Obtener el elemento raíz del DOM
const container = document.getElementById('root');
const root = createRoot(container);

// Renderizar la aplicación
root.render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </React.StrictMode>
);