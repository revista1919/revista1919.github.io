import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import logo from '../../public/logo.png';
import { useLanguage } from '../hooks/useLanguage';

function Header({ onOpenMenu }) {
  const navigate = useNavigate();
  const { switchLanguage, language } = useLanguage();

  const handleLanguageToggle = () => {
    switchLanguage(language === 'es' ? 'en' : 'es');
  };

  return (
    <div className="relative bg-white">
      {/* Fondos animados decorativos */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1] 
          }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute -top-20 -right-20 w-64 h-64 sm:w-96 sm:h-96 bg-blue-200 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.05, 0.15, 0.05] 
          }}
          transition={{ duration: 10, repeat: Infinity, delay: 1 }}
          className="absolute top-1/4 -left-20 w-72 h-72 bg-gray-200 rounded-full blur-3xl"
        />
      </div>

      {/* Header principal */}
      <div className="relative z-10 w-full px-4 pt-4 pb-2 sm:pt-6 sm:pb-4">
        <div className="flex items-center justify-between relative">
          {/* LADO IZQUIERDO - Botón menú */}
          <div className="flex-1 flex justify-start">
            <button
              onClick={onOpenMenu}
              className="group flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg transition-colors focus:outline-none"
              aria-label="Abrir menú"
            >
              <div className="space-y-1.5">
                <div className="w-5 h-0.5 bg-gray-900 rounded group-hover:w-6 transition-all"></div>
                <div className="w-6 h-0.5 bg-gray-900 rounded"></div>
                <div className="w-4 h-0.5 bg-gray-900 rounded group-hover:w-6 transition-all"></div>
              </div>
              <span className="hidden sm:block text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Menú
              </span>
            </button>
          </div>

          {/* CENTRO - Logo */}
          <div className="flex-shrink-0 px-4">
            <motion.div
              onClick={() => navigate('/')}
              className="cursor-pointer flex flex-col items-center"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6 }}
              whileHover={{ scale: 1.02 }}
            >
              <img
                src={logo}
                alt="Revista Logo"
                className="h-12 sm:h-16 w-auto object-contain drop-shadow-sm"
              />
              <div className="h-px w-8 bg-blue-200 mt-2 hidden sm:block"></div>
            </motion.div>
          </div>

          {/* LADO DERECHO - Selector de idioma */}
          <div className="flex-1 flex justify-end">
            <motion.button
              onClick={handleLanguageToggle}
              whileTap={{ scale: 0.95 }}
              className="relative flex items-center bg-gray-100/80 backdrop-blur-sm border border-gray-200 p-1 rounded-full w-20 h-9 overflow-hidden shadow-sm"
              title={`Cambiar a ${language === 'es' ? 'Inglés' : 'Español'}`}
            >
              <motion.div
                className="absolute top-1 bottom-1 w-[34px] bg-white rounded-full shadow-md z-0"
                initial={false}
                animate={{ x: language === 'es' ? 0 : 38 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
              <div className="relative z-10 flex w-full justify-around items-center text-[10px] font-bold tracking-tighter">
                <span className={language === 'es' ? 'text-blue-600' : 'text-gray-400'}>ES</span>
                <span className={language === 'en' ? 'text-blue-600' : 'text-gray-400'}>EN</span>
              </div>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Header;