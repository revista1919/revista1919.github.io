import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import AppES from './App'; // ← Apunta a App.js (español)
import AppEN from './AppEN'; // ← Apunta a AppEN.js (inglés)

// Componente raíz que maneja el routing
const Root = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AppES />} />
        <Route path="/en*" element={<AppEN />} />
      </Routes>
    </Router>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Root />);