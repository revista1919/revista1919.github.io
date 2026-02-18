import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppES from './App';
import AppEN from './AppEN';

const Root = () => {
  return (
    <Router>
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
