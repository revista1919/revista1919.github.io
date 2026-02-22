import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppES from './App';
import AppEN from './AppEN';
import ReviewerResponsePage from './components/ReviewerResponsePage';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Ruta raíz - Español */}
        <Route path="/" element={<AppES />} />
        
        {/* Todas las rutas que empiecen con /en - Inglés */}
        <Route path="/en/*" element={<AppEN />} />
        
        {/* Ruta especial para revisores */}
        <Route path="/reviewer-response" element={<ReviewerResponsePage />} />
        
        {/* Cualquier otra ruta no encontrada - redirige a español */}
        <Route path="*" element={<AppES />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);