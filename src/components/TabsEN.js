import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

function Tabs({ sections }) {
  return (
    <div className="tabs-container">
      <nav className="tabs-nav">
        {/* Mobile dropdown */}
        <div className="sm:hidden px-4 py-2">
          <select
            className="mobile-tabs"
            onChange={(e) => (window.location.href = e.target.value)}
            aria-label="Seleccionar pestaña"
          >
            {sections.map((section) => (
              <option key={section.name} value={section.path}>
                {section.label}
              </option>
            ))}
          </select>
        </div>
        {/* Desktop tabs */}
        <div className="tabs-scroll-container hidden sm:flex">
          {sections.map((section) => (
            <NavLink
              key={section.name}
              to={section.path}
              className={({ isActive }) =>
                `tab-item ${isActive ? 'active' : ''}`
              }
              aria-label={`Ir a la pestaña ${section.label}`}
            >
              {section.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="flex-grow p-4">
        <Outlet />
      </main>
    </div>
  );
}

export default Tabs;