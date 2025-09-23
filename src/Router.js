// src/Router.jsx
import React from 'react';
import { useLocation } from 'react-router-dom';
import App from './App';
import AppEN from './AppEN';

const Router = () => {
  const location = useLocation();
  const { pathname } = location;

  // Determina el idioma basado en la ruta
  const isSpanish = pathname.startsWith('/es') || !pathname.startsWith('/en');
  const cleanPath = pathname.replace(/^\/(es|en)/, '');

  // Actualiza la URL si es necesario para mantener consistencia
  if (isSpanish && !pathname.startsWith('/es')) {
    // Redirigir a /es si no tiene prefijo
    window.history.replaceState(null, '', '/es' + cleanPath);
    return null; // O puedes usar <Navigate to={`/es${cleanPath}`} />
  }

  console.log('Router - Current path:', pathname, 'Language:', isSpanish ? 'ES' : 'EN');

  return isSpanish ? <App /> : <AppEN />;
};

export default Router;