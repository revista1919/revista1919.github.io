import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import logo from '../../public/logo.png';
import logoEN from '../../public/logoEN.png';
import { useLanguage } from '../hooks/useLanguage';

function Header({ onOpenMenu }) {
  const navigate = useNavigate();
  const { switchLanguage, language } = useLanguage();
  const isSpanish = language === 'es';

  const handleLanguageToggle = () => {
    switchLanguage(isSpanish ? 'en' : 'es');
  };

  const handleNavigate = (path) => {
    if (isSpanish) {
      navigate(path);
    } else {
      window.location.href = `https://www.revistacienciasestudiantes.com${path}`;
    }
  };

  return (
    <div className="relative bg-white border-b-2 border-black">
      {/* Header principal */}
      <div className="relative z-10 w-full px-6 lg:px-12 pt-4 pb-2 sm:pt-6 sm:pb-4">
        <div className="flex items-center justify-between relative">
          {/* LADO IZQUIERDO - Botón menú */}
          <div className="flex-1 flex justify-start">
            <button
              onClick={onOpenMenu}
              className="group flex items-center gap-3 hover:text-[#002147] transition-colors focus:outline-none"
              aria-label={isSpanish ? 'Abrir menú' : 'Open menu'}
            >
              <div className="space-y-1.5">
                <div className="w-6 h-px bg-current transition-all"></div>
                <div className="w-6 h-px bg-current"></div>
                <div className="w-4 h-px bg-current group-hover:w-6 transition-all"></div>
              </div>
              <span className="hidden sm:block text-[10px] font-medium uppercase tracking-[0.2em]">
                {isSpanish ? 'Índice' : 'Menu'}
              </span>
            </button>
          </div>

          {/* CENTRO - Logo */}
          <div className="flex-shrink-0 px-4">
            <motion.div
              onClick={() => handleNavigate(isSpanish ? '/' : '/en/')}
              className="cursor-pointer"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6 }}
              whileHover={{ opacity: 0.8 }}
            >
              <img
                src={isSpanish ? logo : logoEN}
                alt={isSpanish ? 'Revista Logo' : 'Journal Logo'}
                className="h-12 sm:h-16 w-auto object-contain"
              />
            </motion.div>
          </div>

          {/* LADO DERECHO - Selector de idioma */}
          <div className="flex-1 flex justify-end">
            <button
              onClick={handleLanguageToggle}
              className="flex border border-gray-300 text-[10px] font-medium tracking-[0.2em] uppercase rounded-none"
              title={isSpanish ? 'Switch to English' : 'Cambiar a Español'}
            >
              <span className={`px-3 py-1.5 transition-colors ${isSpanish ? 'bg-[#002147] text-white' : 'bg-transparent text-gray-500 hover:text-black'}`}>
                ES
              </span>
              <span className={`px-3 py-1.5 transition-colors ${!isSpanish ? 'bg-[#002147] text-white' : 'bg-transparent text-gray-500 hover:text-black'}`}>
                EN
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Header;