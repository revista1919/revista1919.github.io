import React from 'react';
import logo from '../../public/logo.png';
import { useLanguage } from '../hooks/useLanguage';

function Header() {
  const { switchLanguage, language } = useLanguage();

  const handleLanguageToggle = () => {
    switchLanguage(language === 'es' ? 'en' : 'es');
  };

  return React.createElement(
    'header',
    {
      className: 'text-white p-3 sm:p-6 mb-4 sm:mb-6 relative',
      style: { backgroundColor: '#52262dff' },
    },
    React.createElement(
      'div',
      { className: 'container flex flex-col items-center justify-between' },
      React.createElement(
        'div',
        { className: 'flex flex-col items-center mb-3 sm:mb-0 sm:flex-row sm:items-center' },
        React.createElement('img', { 
          src: logo, 
          alt: 'Revista Logo', 
          className: 'h-20 sm:h-24 lg:h-32 mb-2 sm:mb-0 sm:mr-5' 
        }),
        React.createElement(
          'h1', 
          { className: 'text-2xl sm:text-3xl lg:text-4xl font-bold italic font-serif text-center' }, 
          'Revista Nacional de las Ciencias para Estudiantes'
        )
      ),
      React.createElement(
        'button',
        {
          onClick: handleLanguageToggle,
          className: 'absolute top-1 right-1 sm:top-2 sm:right-2 lg:top-2 lg:right-4 px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 hover:bg-white hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-20 z-10',
          style: { 
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
          title: `Cambiar a ${language === 'es' ? 'Inglés' : 'Español'}`
        },
        language === 'es' ? 'EN' : 'ES'
      ),
      React.createElement(
        'p',
        { className: 'text-cream-100 text-xs sm:text-sm italic font-serif text-center sm:absolute sm:bottom-2 sm:right-4 sm:text-right' },
        'Una revista por y para estudiantes'
      )
    )
  );
}

export default Header;