// hooks/useLanguage.js
import { useLocation, useNavigate } from 'react-router-dom';

export const useLanguage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname } = location;

  const getLanguageFromPath = () => {
    if (pathname.startsWith('/en')) return 'en';
    return 'es'; // Default: español (incluye /, /es, etc.)
  };

  const cleanPath = () => {
    const lang = getLanguageFromPath();
    return pathname.replace(`/${lang}`, '');
  };

  const switchLanguage = (newLang) => {
    const currentCleanPath = cleanPath();
    const basePath = currentCleanPath === '/' ? '' : currentCleanPath;
    const newPath = newLang === 'en' ? `/en${basePath}` : `/es${basePath}`; // Usa /es para consistencia
    
    // Navega usando el router (no pushState manual, y NO reload)
    navigate(newPath, { replace: true }); // replace: true evita acumular historial
  };

  return {
    language: getLanguageFromPath(),
    cleanPath: cleanPath(),
    switchLanguage,
  };
};