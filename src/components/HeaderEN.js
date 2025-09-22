import React from 'react';
import logo from '../../public/logoEN.png';
import { useLanguage } from '../hooks/useLanguage'; // Ajusta la ruta según tu estructura

function HeaderEN() {
  const { switchLanguage, language } = useLanguage();

  const handleLanguageToggle = () => {
    switchLanguage(language === 'en' ? 'es' : 'en');
  };

  return React.createElement(
    'header',
    {
      className: 'text-white p-3 sm:p-6 mb-4 sm:mb-6 relative',
      style: { backgroundColor: '#52262dff' },
    },
    React.createElement(
      'div',
      { className: 'container flex flex-col lg:flex-row lg:items-center lg:justify-between' },
      React.createElement(
        'div',
        { className: 'flex flex-col items-center mb-3 sm:mb-0 sm:flex-row sm:items-center w-full lg:w-auto' },
        React.createElement('img', { 
          src: logo, 
          alt: 'Journal Logo', 
          className: 'h-20 sm:h-24 lg:h-32 mb-2 sm:mb-0 sm:mr-5' 
        }),
        React.createElement(
          'h1', 
          { className: 'text-2xl sm:text-3xl lg:text-4xl font-bold italic font-serif text-center lg:text-left' }, 
          'The National Review of Sciences for Students'
        )
      ),
      // Botón de idioma en la esquina superior derecha
      React.createElement(
        'button',
        {
          onClick: handleLanguageToggle,
          className: 'absolute top-2 right-2 sm:top-3 sm:right-3 lg:static lg:ml-4 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 hover:bg-white hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-30',
          style: { 
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)'
          },
          title: `Switch to ${language === 'en' ? 'Spanish' : 'English'}`
        },
        language === 'en' ? 'ES' : 'EN'
      ),
      // Tagline debajo en pantallas pequeñas, al lado en grandes
      React.createElement(
        'p',
        { 
          className: 'text-cream-100 text-xs sm:text-sm italic font-serif text-center mt-2 lg:mt-0 lg:ml-4 lg:text-left' 
        },
        'A journal by and for students'
      )
    )
  );
}

export default HeaderEN;