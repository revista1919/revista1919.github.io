// src/Router.jsx
import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import App from './App';
import AppEN from './AppEN';
import ReviewerResponsePage from './components/ReviewerResponsePage';

const Router = () => {
  const location = useLocation();
  const { pathname } = location;

  // Si la ruta es /reviewer-response, mostrar directamente
  if (pathname.includes('/reviewer-response')) {
    return <ReviewerResponsePage />;
  }

  // Determina el idioma basado en la ruta
  const isSpanish = pathname.startsWith('/es');
  const isEnglish = pathname.startsWith('/en');
  
  // Si es la raíz, redirigir a español por defecto
  if (pathname === '/' || pathname === '') {
    return <Navigate to="/es" replace />;
  }

  // Si no tiene prefijo de idioma pero no es la raíz, redirigir a español
  if (!isSpanish && !isEnglish && pathname !== '/') {
    return <Navigate to={`/es${pathname}`} replace />;
  }

  console.log('Router - Current path:', pathname, 'Language:', isSpanish ? 'ES' : 'EN');

  // Renderizar el componente apropiado según el prefijo
  if (isSpanish) {
    return <App />;
  } else if (isEnglish) {
    return <AppEN />;
  }

  // Fallback (no debería llegar aquí)
  return <Navigate to="/es" replace />;
};

export default Router;