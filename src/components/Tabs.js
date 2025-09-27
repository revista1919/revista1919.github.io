import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function Tabs({ sections }) {
  const { t } = useTranslation();

  return (
    <div className="tabs-container">
      <nav className="bg-[#f8f1e9] shadow-sm border-b-2 border-[#e6d9c6] py-2 sm:py-4">
        {/* Menú desplegable para móviles */}
        <div className="sm:hidden px-2">
          <select
            className="w-full px-2 py-1 text-xs font-medium bg-[#e6d9c6] text-[#5a3e36] rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
            onChange={(e) => window.location.href = e.target.value}
            aria-label={t('selectTab')}
          >
            {sections.map((section) => (
              <option key={section.name} value={section.path}>
                {t(section.labelKey)}
              </option>
            ))}
          </select>
        </div>
        {/* Pestañas normales para pantallas grandes */}
        <ul className="hidden sm:flex flex-wrap justify-center gap-4 px-4 max-w-4xl mx-auto">
          {sections.map((section) => (
            <li key={section.name}>
              <NavLink
                to={section.path}
                className={({ isActive }) =>
                  `px-4 py-2 text-base font-medium rounded-md transition-all duration-300 ${
                    isActive
                      ? 'bg-[#8b6f47] text-white shadow-md'
                      : 'bg-[#e6d9c6] text-[#5a3e36] hover:bg-[#d9c8a9] hover:text-[#5a3e36]'
                  } focus:outline-none focus:ring-2 focus:ring-[#8b6f47]`
                }
                aria-label={t('goToTab', { label: t(section.labelKey) })}
              >
                {t(section.labelKey)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="flex-grow">
        <Outlet />
      </main>
    </div>
  );
}

export default Tabs;