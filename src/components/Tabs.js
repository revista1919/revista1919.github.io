import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

function Tabs({ sections }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4">
      <nav className="bg-white border-b-2 border-gray-200 shadow-sm">
        {/* Mobile view: Tap to show dropdown */}
        <div className="sm:hidden px-4 py-2">
          <button
            className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium text-base truncate text-center"
            onClick={toggleDropdown}
            aria-label="Seleccionar pestaña"
          >
            {sections.find(section => window.location.pathname === section.path)?.label || sections[0].label}
          </button>
          {isDropdownOpen && (
            <div className="absolute z-10 w-full max-w-[calc(100%-2rem)] bg-white border border-gray-200 rounded-lg mt-1 shadow-lg">
              {sections.map((section) => (
                <NavLink
                  key={section.name}
                  to={section.path}
                  className={({ isActive }) =>
                    `block w-full px-4 py-2 text-base font-medium text-gray-700 truncate text-center hover:bg-gray-100 ${isActive ? 'bg-brown-600 text-white' : ''}`
                  }
                  onClick={() => setIsDropdownOpen(false)}
                  aria-label={`Ir a la pestaña ${section.label}`}
                >
                  {section.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
        {/* Desktop view: Tabs in a single line or wrapped and centered */}
        <div className="hidden sm:flex flex-wrap justify-center gap-2 p-3">
          {sections.map((section) => (
            <NavLink
              key={section.name}
              to={section.path}
              className={({ isActive }) =>
                `flex-1 sm:flex-none min-w-[120px] max-w-[200px] px-4 py-2 text-base font-medium text-gray-700 bg-gray-100 rounded-lg transition-colors duration-300 truncate text-center hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-brown-600 ${isActive ? 'bg-brown-600 text-white shadow-md' : ''}`
              }
              aria-label={`Ir a la pestaña ${section.label}`}
            >
              {section.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}

export default Tabs;
