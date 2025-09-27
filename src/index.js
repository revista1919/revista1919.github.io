import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppES from './App';
import AppEN from './AppEN';

const Root = () => {
  const basename = process.env.NODE_ENV === 'production' ? '/revistacienciasestudiantes' : '/';

  return (
    <Router basename={basename}>
      <Routes>
        <Route path="/es/*" element={<AppES />} />
        <Route path="/en/*" element={<AppEN />} />
        <Route path="/*" element={<AppES />} />
      </Routes>
    </Router>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Root />);
