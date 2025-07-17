import React from 'react';
import logo from '../../public/logo.png'; // Ruta corregida

function Header() {
  return React.createElement(
    'header',
    {
      className: 'text-white p-4 mb-6 relative',
      style: { backgroundColor: '#52262dff' },
    },
    React.createElement(
      'div',
      { className: 'container flex items-center justify-between' },
      React.createElement(
        'div',
        { className: 'flex items-center' },
        React.createElement('img', { src: logo, alt: 'Revista Logo', className: 'h-40 mr-5' }),
        React.createElement('h1', { className: 'text-4xl font-semibold italic font-serif' }, 'Revista Nacional de las Ciencias para Estudiantes')
      ),
      React.createElement(
        'p',
        { className: 'absolute bottom-2 right-4 text-cream-100 text-sm italic font-serif text-right' },
        'Una revista por y para estudiantes'
      )
    )
  );
}

export default Header;