// src/Router.jsx
import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import App from './App';
import AppEN from './AppEN';
import ReviewerResponsePage from './components/ReviewerResponsePage';

const Router = () => {
  const location = useLocation();
  const { pathname } = location;

  // --- 1. RUTA ESPECIAL (SIN REDIRECCIÓN DE IDIOMA) ---
  // Si la ruta es /reviewer-response, mostramos el componente directamente.
  // Esto permite que los enlaces en los emails funcionen sin importar el idioma.
  if (pathname === '/reviewer-response') {
    return <ReviewerResponsePage />;
  }

  // --- 2. DETECCIÓN DE IDIOMA ---
  // Determinamos el idioma basado en el primer segmento de la ruta.
  const isEnglish = pathname.startsWith('/en');
  // Consideramos español si empieza con '/es' O si es la raíz '/' (que será español por defecto)
  const isSpanish = pathname.startsWith('/es') || pathname === '/';

  // --- 3. MANEJO DE LA RAÍZ ('/') ---
  // Si estamos en la raíz, simplemente renderizamos la versión en español (<App />).
  // Esto es consistente con la idea de que el español es el idioma por defecto.
  if (pathname === '/') {
    return <App />;
  }

  // --- 4. LIMPIEZA DE LA RUTA PARA LOS COMPONENTES PRINCIPALES ---
  // Eliminamos el prefijo de idioma (/es o /en) para pasarlo a App o AppEN.
  // Esto permite que la lógica interna de esas apps funcione con rutas relativas.
  const pathWithoutLang = pathname.replace(/^\/(es|en)/, '');

  // --- 5. RENDERIZADO CONDICIONAL ---
  if (isEnglish) {
    // Renderizamos la versión en inglés. Le pasamos la ruta limpia a través de `key`
    // para forzar un re-renderizado cuando cambie, pero la navegación interna
    // de AppEN usará esta ruta limpia.
    return <AppEN key={pathWithoutLang} />;
  }

  if (isSpanish) {
    // Renderizamos la versión en español, también con la ruta limpia.
    return <App key={pathWithoutLang} />;
  }

  // --- 6. MANEJO DE ERROR 404 (REDIRECCIÓN INTELIGENTE) ---
  // Si llegamos aquí, es porque la ruta no tiene un prefijo de idioma válido
  // (ej: /ruta-invalida, /es, /en). Redirigimos a la versión en español por defecto.
  // También manejamos el caso donde la ruta es solo '/es' o '/en' (sin nada después).
  if (pathname === '/es' || pathname === '/en') {
    // Redirigimos a la página de inicio en el idioma correspondiente.
    return <Navigate to={pathname === '/es' ? '/' : '/en'} replace />;
  }

  // Para cualquier otra ruta no reconocida (ej: /pagina-que-no-existe), redirigimos a la raíz.
  console.warn(`Ruta no encontrada: ${pathname}. Redirigiendo a /`);
  return <Navigate to="/" replace />;
};

export default Router;