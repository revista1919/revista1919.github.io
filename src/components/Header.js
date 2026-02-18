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
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="text-white p-3 sm:p-6 mb-4 sm:mb-6 relative"
      style={{ backgroundColor: 'rgb(44, 17, 21)' }}
    >
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between relative">
        <button
          onClick={onOpenMenu}
          className="absolute top-1 left-1 sm:static flex items-center justify-center w-8 h-8 focus:outline-none sm:mr-4"
          aria-label="Abrir menú"
        >
          <div className="space-y-1">
            <div className="w-5 h-0.5 bg-white rounded"></div>
            <div className="w-5 h-0.5 bg-white rounded"></div>
            <div className="w-5 h-0.5 bg-white rounded"></div>
          </div>
        </button>
        <div className="flex flex-col items-center sm:flex-row sm:items-center mt-10 sm:mt-0">
          <motion.img
            src={logo}
            alt="Revista Logo"
            className="h-20 sm:h-24 lg:h-32 mb-2 sm:mb-0 sm:mr-5"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
          <motion.h1
            className="text-2xl sm:text-3xl lg:text-4xl font-bold italic font-serif text-center sm:text-left"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
          >
            Revista Nacional de las Ciencias para Estudiantes
          </motion.h1>
        </div>
        <button
          onClick={handleLanguageToggle}
          className="absolute top-1 right-1 sm:static px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 hover:bg-white hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-20 z-10"
          style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
          title={`Cambiar a ${language === 'es' ? 'Inglés' : 'Español'}`}
        >
          {language === 'es' ? 'EN' : 'ES'}
        </button>
      </div>
      <motion.p
        className="text-cream-100 text-xs sm:text-sm italic font-serif text-center sm:absolute sm:bottom-2 sm:right-4 sm:text-right"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5, ease: 'easeOut' }}
      >
        Una revista por y para estudiantes
      </motion.p>
    </motion.header>
  );
}

export default Header;