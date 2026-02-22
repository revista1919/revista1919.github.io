import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import AppES from './App';
import AppEN from './AppEN';

// Componente para manejar la redirección desde sessionStorage
const RouteHandler = () => {
  const location = useLocation();
 
  React.useEffect(() => {
    // Si hay una ruta guardada en sessionStorage y no estamos ya en esa ruta
    const redirectPath = sessionStorage.getItem('redirect');
    if (redirectPath && redirectPath !== location.pathname + location.search + location.hash) {
      sessionStorage.removeItem('redirect');
      window.location.replace(redirectPath);
    }
  }, [location]);

  return (
    <Routes>
      {/* Español: ruta raíz y /es/* */}
      <Route path="/" element={<AppES />} />
      <Route path="/es/*" element={<AppES />} />
      
      {/* Inglés: /en/* */}
      <Route path="/en/*" element={<AppEN />} />
      
      {/* Ruta comodín: redirige a español */}
      <Route path="*" element={<AppES />} />
    </Routes>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <RouteHandler />
    </BrowserRouter>
  </React.StrictMode>
);