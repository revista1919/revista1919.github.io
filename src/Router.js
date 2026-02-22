// src/Router.jsx
import React, { useEffect } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import App from './App';
import AppEN from './AppEN';
import ReviewerResponsePage from './components/ReviewerResponsePage';

const Router = () => {
  const location = useLocation();
  const { pathname, search } = location;

  // LOG 1: Ver qué está entrando al router
  useEffect(() => {
    console.log('🔥 ROUTER - Pathname actual:', pathname);
    console.log('🔥 ROUTER - Search params:', search);
    console.log('🔥 ROUTER - URL completa:', window.location.href);
  }, [pathname, search]);

  // CASO 1: Ruta especial de revisor
  if (pathname === '/reviewer-response') {
    console.log('✅ ROUTER - Mostrando ReviewerResponsePage');
    return <ReviewerResponsePage />;
  }

  // CASO 2: Ruta raíz (español por defecto)
  if (pathname === '/') {
    console.log('✅ ROUTER - Raíz, mostrando App (español)');
    return <App />;
  }

  // CASO 3: Ruta que empieza con /en (INGLÉS)
  if (pathname.startsWith('/en')) {
    console.log('✅ ROUTER - Ruta inglesa detectada:', pathname);
    
    // Si es exactamente /en, mostrar AppEN con ruta limpia '/'
    if (pathname === '/en') {
      console.log('✅ ROUTER - Mostrando AppEN con path /');
      return <AppEN key="/" />;
    }
    
    // Para /en/algo, extraer la ruta sin el /en
    const pathWithoutEn = pathname.replace('/en', '');
    console.log('✅ ROUTER - Mostrando AppEN con path:', pathWithoutEn);
    return <AppEN key={pathWithoutEn} />;
  }

  // CASO 4: Ruta que empieza con /es (ESPAÑOL)
  if (pathname.startsWith('/es')) {
    console.log('✅ ROUTER - Ruta española detectada:', pathname);
    
    // Si es exactamente /es, redirigir a raíz (esto puede ser opcional)
    if (pathname === '/es') {
      console.log('✅ ROUTER - Redirigiendo /es a /');
      return <Navigate to="/" replace />;
    }
    
    // Para /es/algo, extraer la ruta sin el /es
    const pathWithoutEs = pathname.replace('/es', '');
    console.log('✅ ROUTER - Mostrando App con path:', pathWithoutEs);
    return <App key={pathWithoutEs} />;
  }

  // CASO 5: Cualquier otra ruta (404)
  console.log('❌ ROUTER - Ruta no reconocida, redirigiendo a /');
  return <Navigate to="/" replace />;
};

export default Router;