// src/Router.jsx
import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import App from './App';
import AppEN from './AppEN';
import ReviewerResponsePage from './components/ReviewerResponsePage'; // <-- NUEVO

const Router = () => {
  const location = useLocation();
  const { pathname } = location;

  // NUEVO: Si la ruta es /reviewer-response, no aplicar redirección por idioma
  if (pathname.includes('/reviewer-response')) {
    // Verificar si hay parámetro de idioma en la URL
    const searchParams = new URLSearchParams(location.search);
    const lang = searchParams.get('lang');
    
    // Si hay parámetro lang, podríamos decidir qué versión mostrar
    // Por ahora, mostramos el componente directamente sin redirección
    return <ReviewerResponsePage />;
  }

  // Determina el idioma basado en la ruta
  const isSpanish = pathname.startsWith('/es') || !pathname.startsWith('/en');
  const cleanPath = pathname.replace(/^\/(es|en)/, '');

  // Actualiza la URL si es necesario para mantener consistencia
  if (isSpanish && !pathname.startsWith('/es') && pathname !== '/') {
    // Redirigir a /es si no tiene prefijo (excepto para la raíz)
    return <Navigate to={`/es${cleanPath}`} replace />;
  }

  if (!isSpanish && pathname.startsWith('/en') && pathname === '/en') {
    return <AppEN />;
  }

  console.log('Router - Current path:', pathname, 'Language:', isSpanish ? 'ES' : 'EN');

  return isSpanish ? <App /> : <AppEN />;
};

export default Router;