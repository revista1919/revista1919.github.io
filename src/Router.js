// src/Router.jsx
import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import App from './App';
import AppEN from './AppEN';
import ReviewerResponsePage from './components/ReviewerResponsePage';

const Router = () => {
  const location = useLocation();
  const { pathname } = location;

  // NUEVO: Si la ruta es /reviewer-response, NO aplicar lógica de idioma
  if (pathname.includes('/reviewer-response')) {
    console.log('Router - ReviewerResponsePage detected, bypassing language redirect');
    return <ReviewerResponsePage />;
  }

  // Determina el idioma basado en la ruta (funcionalidad original)
  const isSpanish = pathname.startsWith('/es') || !pathname.startsWith('/en');
  const cleanPath = pathname.replace(/^\/(es|en)/, '');

  // Actualiza la URL si es necesario para mantener consistencia (versión mejorada)
  if (isSpanish && !pathname.startsWith('/es') && pathname !== '/') {
    // Redirigir a /es si no tiene prefijo (excepto para la raíz)
    console.log('Router - Redirecting to Spanish version:', `/es${cleanPath}`);
    return <Navigate to={`/es${cleanPath}`} replace />;
  }

  // Manejo específico para la ruta /en (versión mejorada)
  if (!isSpanish && pathname.startsWith('/en') && pathname === '/en') {
    return <AppEN />;
  }

  console.log('Router - Current path:', pathname, 'Language:', isSpanish ? 'ES' : 'EN');

  // Retorna el componente según el idioma (funcionalidad original)
  return isSpanish ? <App /> : <AppEN />;
};

export default Router;