import React from 'react';
import { NavLink } from 'react-router-dom';

function Tabs({ sections }) {
  return (
    <div className="flex overflow-x-auto scrollbar-hide">
      {sections.map((section) => {
        // Determinar si es una sección destacada para autores
        const isHighlighted = ['submit', 'guidelines', 'login'].includes(section.name);
        
        return (
          <NavLink
            key={section.name}
            to={section.path}
            end={section.name === 'home'}
            className={({ isActive }) =>
              `px-5 py-3.5 text-[11px] font-sans uppercase tracking-[0.1em] transition-colors whitespace-nowrap border-r border-gray-200 relative flex items-center gap-2 ${
                isActive 
                  ? 'bg-[#002147] text-white font-bold'
                  : isHighlighted
                    ? 'text-[#002147] hover:bg-[#002147]/5 font-bold'
                    : 'text-gray-500 hover:text-black hover:bg-gray-50 font-medium'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isHighlighted && !isActive && (
                  <span className="w-1.5 h-1.5 bg-[#002147] rounded-full flex-shrink-0"></span>
                )}
                {section.label}
              </>
            )}
          </NavLink>
        );
      })}
    </div>
  );
}

export default Tabs;