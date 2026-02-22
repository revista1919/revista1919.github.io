import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom'; // Cambiado a HashRouter
import AppES from './App';
import AppEN from './AppEN';
import ReviewerResponsePage from './components/ReviewerResponsePage';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppES />} />
        <Route path="/en/*" element={<AppEN />} />
        <Route path="/reviewer-response" element={<ReviewerResponsePage />} />
        <Route path="*" element={<AppES />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
);