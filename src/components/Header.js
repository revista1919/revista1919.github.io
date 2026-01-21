import React from 'react';
import { motion } from 'framer-motion';
import logo from '../../public/logo.png';
import { useLanguage } from '../hooks/useLanguage';

function Header({ onOpenMenu }) {
  const { switchLanguage, language } = useLanguage();

  const handleLanguageToggle = () => {
    switchLanguage(language === 'es' ? 'en' : 'es');
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      className="text-white py-4 sm:py-5 relative shadow-sm z-20"
      style={{ backgroundColor: '#52262dff', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}
    >
      <div className="container mx-auto flex items-center justify-between px-4 sm:px-6 relative">
        {/* Menu Button */}
        <button
          onClick={onOpenMenu}
          className="flex items-center justify-center w-10 h-10 hover:bg-white hover:bg-opacity-10 rounded-full transition-colors duration-200 focus:outline-none"
          aria-label="Abrir menú"
        >
          <div className="space-y-1.5 w-5 h-5 flex flex-col justify-center">
            <div className="w-full h-0.5 bg-white rounded-full"></div>
            <div className="w-full h-0.5 bg-white rounded-full"></div>
            <div className="w-full h-0.5 bg-white rounded-full"></div>
          </div>
        </button>

        {/* Logo and Title */}
        <div className="flex items-center space-x-4 sm:space-x-5 flex-1 justify-center">
          <motion.img
            src={logo}
            alt="Revista Logo"
            className="h-10 sm:h-14 lg:h-16"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
          <motion.h1
            className="text-lg sm:text-xl lg:text-2xl font-bold italic font-serif leading-tight text-left"
            initial={{ x: -15, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5, ease: 'easeInOut' }}
          >
            Revista Nacional de las Ciencias para Estudiantes
          </motion.h1>
        </div>

        {/* Language and Motto */}
        <div className="flex flex-col items-end space-y-2 min-w-[120px]">
          <button
            onClick={handleLanguageToggle}
            className="px-3 py-1.5 rounded text-xs font-medium transition-all duration-200 hover:bg-white hover:bg-opacity-10 focus:outline-none flex items-center text-white/90 hover:text-white"
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
            title={`Cambiar a ${language === 'es' ? 'Inglés' : 'Español'}`}
          >
            {language === 'es' ? 'English' : 'Español'}
          </button>
          <motion.p
            className="text-white/70 text-xs sm:text-sm italic font-serif text-right"
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5, ease: 'easeInOut' }}
          >
            Una revista por y para estudiantes
          </motion.p>
        </div>
      </div>
    </motion.header>
  );
}

export default Header;