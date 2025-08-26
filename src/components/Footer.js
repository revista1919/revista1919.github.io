import React from 'react';

function Footer() {
  return React.createElement(
    'footer',
    { className: 'bg-gray-800 text-white p-3 sm:p-4 mt-4 sm:mt-6 text-center text-xs sm:text-sm' },
    [
      React.createElement(
        'p',
        { key: 'text' },
        '© 2025 Revista Nacional de las Ciencias para Estudiantes. Todos los derechos reservados.'
      ),
      React.createElement(
        'a',
        {
          key: 'instagram',
          href: 'https://www.instagram.com/revistanacionalcienciae',
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'flex items-center justify-center gap-2 mt-2 text-blue-400 hover:text-blue-500'
        },
        [
          React.createElement('img', {
            key: 'logo',
            src: '/logoig.png', // ponlo en /public/logoig.png
            alt: 'Instagram',
            className: 'h-5 w-auto sm:h-6 object-contain'
          }),
          '@revistanacionalcienciae'
        ]
      )
    ]
  );
}

export default Footer;
