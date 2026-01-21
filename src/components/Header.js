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
      className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 py-4"
      initial={{ y: -100 }} animate={{ y: 0 }}
    >
      <div className="container mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src={logo} alt="Logo" className="h-12 w-auto" />
          <div className="hidden md:block">
            <h1 className="text-xl font-serif font-bold text-[#52262d] leading-none">
              Revista Nacional de las Ciencias para Estudiantes
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">
              Una revista por y para estudiantes • Vol. 2026
            </p>
          </div>
        </div>
       
        <nav className="flex items-center gap-6">
          {/* Botón de idioma más minimalista */}
          <button 
            onClick={handleLanguageToggle}
            className="text-xs font-bold tracking-tighter border border-gray-200 px-3 py-1 rounded-full hover:bg-gray-50 transition-all"
          >
            {language === 'es' ? 'EN' : 'ES'}
          </button>
          <button onClick={onOpenMenu} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <div className="space-y-1.5">
              <div className="w-6 h-0.5 bg-[#52262d]"></div>
              <div className="w-4 h-0.5 bg-[#52262d]"></div>
            </div>
          </button>
        </nav>
      </div>
    </motion.header>
  );
}

export default Header;