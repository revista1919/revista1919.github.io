import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

function Tabs({ sections }) {
  const [isOpen, setIsOpen] = useState(false);

  const framerItem = (delay) => ({
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    transition: { delay: 0.1 * delay, duration: 0.3 }
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4">
      <nav className="bg-white border-b-2 border-gray-200 shadow-sm">
        <div className="px-4 py-2">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center justify-center w-10 h-10 focus:outline-none"
            aria-label="Abrir menú"
          >
            <div className="space-y-1.5">
              <div className="w-6 h-0.5 bg-gray-600 rounded"></div>
              <div className="w-6 h-0.5 bg-gray-600 rounded"></div>
              <div className="w-6 h-0.5 bg-gray-600 rounded"></div>
            </div>
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              aria-hidden="true"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3 }}
              className="fixed top-0 left-0 h-full w-4/5 max-w-xs bg-white shadow-lg z-50 overflow-y-auto"
            >
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <span className="font-medium text-gray-700">Menú</span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-600 hover:text-gray-800 focus:outline-none"
                  aria-label="Cerrar menú"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4">
                {sections.map((section, index) => (
                  <motion.div key={section.name} {...framerItem(index)}>
                    <NavLink
                      to={section.path}
                      className={({ isActive }) =>
                        `block py-3 px-4 text-base font-medium rounded-md transition-colors ${isActive ? 'bg-brown-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`
                      }
                      onClick={() => setIsOpen(false)}
                      aria-label={`Ir a ${section.label}`}
                    >
                      {section.label}
                    </NavLink>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}

export default Tabs;