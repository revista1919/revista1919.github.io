import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

function Tabs({ sections }) {
  return (
    <div className="tabs-container">
      <nav className="bg-[#f8f1e9] shadow-sm border-b-2 border-[#e6d9c6] py-2 sm:py-4">
        {/* Mobile dropdown */}
        <div className="sm:hidden px-2">
          <select
            className="w-full px-2 py-1 text-xs font-medium bg-[#e6d9c6] text-[#5a3e36] rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
            onChange={(e) => window.location.href = e.target.value}
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
        <div className="tabs-scroll-container hidden sm:block">
          {sections.map((section) => (
            <NavLink
              key={section.name}
              to={section.path}
              className={({ isActive }) =>
                `tab-item px-4 py-2 text-base font-medium rounded-md transition-all duration-300 ${
                  isActive
                    ? 'bg-[#8b6f47] text-white shadow-md'
                    : 'bg-[#e6d9c6] text-[#5a3e36] hover:bg-[#d9c8a9] hover:text-[#5a3e36]'
                } focus:outline-none focus:ring-2 focus:ring-[#8b6f47]`
              }
              aria-label={`Ir a la pestaña ${section.label}`}
            >
              {section.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="flex-grow">
        <Outlet />
      </main>
    </div>
  );
}

export default Tabs;