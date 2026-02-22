// src/Router.jsx
import React, { useEffect } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import App from './App';
import AppEN from './AppEN';
import ReviewerResponsePage from './components/ReviewerResponsePage';

const Router = () => {
  const location = useLocation();
  const { pathname } = location;

  // LOGS para depuración
  useEffect(() => {
    console.log('🌐 ROUTER - Path completo:', pathname);
    console.log('🌐 ROUTER - URL:', window.location.href);
  }, [pathname]);

  // CASO ESPECIAL: Ruta de respuesta de revisor (sin idioma)
  if (pathname === '/reviewer-response') {
    console.log('✅ ROUTER - Mostrando ReviewerResponsePage');
    return <ReviewerResponsePage />;
  }

  // CASO 1: Ruta raíz - mostrar español
  if (pathname === '/') {
    console.log('✅ ROUTER - Raíz, mostrando App (español)');
    return <App />;
  }

  // CASO 2: Ruta que empieza con /es/ - español
  if (pathname.startsWith('/es/')) {
    console.log('✅ ROUTER - Ruta española con subruta:', pathname);
    return <App />;
  }

  // CASO 3: Ruta exacta /es - redirigir a raíz
  if (pathname === '/es') {
    console.log('✅ ROUTER - Redirigiendo /es a /');
    return <Navigate to="/" replace />;
  }

  // CASO 4: Ruta que empieza con /en/ - inglés
  if (pathname.startsWith('/en/')) {
    console.log('✅ ROUTER - Ruta inglesa con subruta:', pathname);
    return <AppEN />;
  }

  // CASO 5: Ruta exacta /en - inglés (home)
  if (pathname === '/en') {
    console.log('✅ ROUTER - Ruta inglesa raíz, mostrando AppEN');
    return <AppEN />;
  }

  // CASO 6: Cualquier otra ruta - redirigir a raíz
  console.log('❌ ROUTER - Ruta no reconocida, redirigiendo a /');
  return <Navigate to="/" replace />;
};

export default Router;