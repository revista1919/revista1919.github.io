import React from 'react';
import logo from '../../public/logo.png';

function Header() {
  return React.createElement(
    'header',
    {
      className: 'text-white p-6 sm:p-6 mb-4 sm:mb-6 relative shadow-md',
      style: { backgroundColor: '#52262dff' },
    },
    React.createElement(
      'div',
      { className: 'container flex flex-row items-center justify-between sm:flex-col sm:items-center max-w-5xl mx-auto' },
      React.createElement(
        'div',
        { className: 'flex items-center w-full sm:flex-col sm:items-center sm:mb-3' },
        React.createElement('img', { 
          src: logo, 
          alt: 'Revista Logo', 
          className: 'h-24 sm:h-28 lg:h-36 mr-4 sm:mr-0 sm:mb-3' 
        }),
        React.createElement(
          'div',
          { className: 'flex flex-col items-end sm:items-center' },
          React.createElement(
            'h1', 
            { className: 'text-lg sm:text-3xl lg:text-4xl font-bold italic font-serif text-center sm:text-center' }, 
            'Revista Nacional de las Ciencias para Estudiantes'
          ),
          React.createElement(
            'p',
            { className: 'text-[9px] sm:text-sm text-cream-100 italic font-serif text-center sm:text-center sm:absolute sm:bottom-2 sm:right-4 sm:text-right mt-1 sm:mt-0' },
            'Una revista por y para estudiantes'
          )
        )
      )
    )
  );
}

export default Header;