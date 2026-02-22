// hooks/useLanguage.js
import { useLocation, useNavigate } from 'react-router-dom';

export const useLanguage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname } = location;

  const getLanguageFromPath = () => {
    if (pathname.startsWith('/en')) return 'en';
    return 'es'; // Default: español
  };

  const cleanPath = () => {
    const lang = getLanguageFromPath();
    // Si es español, quita /es o /es/ del path
    if (lang === 'es') {
      if (pathname === '/es' || pathname === '/es/') return '/';
      return pathname.replace(/^\/es/, '') || '/';
    }
    // Si es inglés, quita /en del path
    if (lang === 'en') {
      return pathname.replace(/^\/en/, '') || '/';
    }
    return pathname;
  };

  const switchLanguage = (newLang) => {
    const currentCleanPath = cleanPath();
    // Si la ruta limpia es '/', no agregues nada extra
    const basePath = currentCleanPath === '/' ? '' : currentCleanPath;
    
    let newPath;
    if (newLang === 'en') {
      newPath = `/en${basePath}`;
    } else {
      newPath = basePath || '/'; // Español: sin prefijo o solo /
    }
    
    navigate(newPath, { replace: true });
  };

  return {
    language: getLanguageFromPath(),
    cleanPath: cleanPath(),
    switchLanguage,
  };
};