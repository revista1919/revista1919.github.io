import React from 'react';
import logo from '../../public/logo.png';

function Header() {
  return React.createElement(
    'header',
    {
      className: 'text-white p-4 mb-6 relative',
      style: { backgroundColor: '#52262dff' },
    },
    React.createElement(
      'div',
      { className: 'container flex flex-col sm:flex-row items-center justify-between' }, // Cambiado a flex-col en móviles
      React.createElement(
        'div',
        { className: 'flex items-center mb-4 sm:mb-0' }, // Margen inferior en móviles
        React.createElement('img', { src: logo, alt: 'Revista Logo', className: 'h-24 sm:h-40 mr-0 sm:mr-5' }), // Imagen más pequeña en móviles
        React.createElement('h1', { className: 'text-2xl sm:text-4xl font-semibold italic font-serif text-center sm:text-left' }, 'Revista Nacional de las Ciencias para Estudiantes') // Texto más pequeño y centrado en móviles
      ),
      React.createElement(
        'p',
        { className: 'absolute bottom-2 right-4 text-cream-100 text-xs sm:text-sm italic font-serif text-right' }, // Texto más pequeño en móviles
        'Una revista por y para estudiantes'
      )
    )
  );
}

export default Header;