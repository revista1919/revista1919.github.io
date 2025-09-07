import React from 'react';
import logo from '../../public/logo.png';
import { useTranslation } from 'react-i18next';

function Header() {
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
        'p',
        { className: 'text-cream-100 text-xs sm:text-sm italic font-serif text-center sm:absolute sm:bottom-2 sm:right-4 sm:text-right' },
        'Una revista por y para estudiantes'
      )
    )
  );
}

export default Header;