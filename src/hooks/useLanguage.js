// hooks/useLanguage.js
import { useState, useEffect } from 'react';

export const useLanguage = () => {
  const [language, setLanguage] = useState('es');
  const [cleanPath, setCleanPath] = useState('/');

  useEffect(() => {
    const path = window.location.pathname;
    const isEnglish = path.startsWith('/en/');
    
    setLanguage(isEnglish ? 'en' : 'es');
    setCleanPath(isEnglish ? path.replace('/en/', '') : path);
  }, []);

  const switchLanguage = (newLang) => {
    const basePath = cleanPath === '/' ? '' : cleanPath;
    const newPath = newLang === 'en' ? `/en${basePath}` : basePath;
    
    // Actualizar la URL
    window.history.pushState({}, '', newPath);
    
    // Actualizar estado (esto causará re-render)
    setLanguage(newLang);
    
    // Opcional: reload para cargar el componente correcto
    window.location.href = newPath;
  };

  return { language, cleanPath, switchLanguage };
};