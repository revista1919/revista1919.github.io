import React from 'react';

function Footer() {
  return React.createElement(
    'footer',
    { className: 'bg-gray-800 text-white p-4 mt-6 text-center' },
    React.createElement('p', null, '© 2025 Revista Nacional de las Ciencias para Estudiantes. Todos los derechos reservados.')
  );
}

export default Footer;