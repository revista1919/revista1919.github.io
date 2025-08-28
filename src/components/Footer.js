import React, { useState } from 'react';

function Footer() {
  const [igError, setIgError] = useState(false);
  const [ytError, setYtError] = useState(false);

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
        'div',
        { key: 'links', className: 'flex flex-col sm:flex-row items-center justify-center gap-3 mt-2' },
        [
          // Instagram
          React.createElement(
            'a',
            {
              key: 'instagram',
              href: 'https://www.instagram.com/revistanacionalcienciae',
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'flex items-center gap-2 text-blue-400 hover:text-blue-500'
            },
            [
              igError
                ? React.createElement(
                    'div',
                    {
                      key: 'fallback',
                      className: 'flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold rounded-full h-6 w-6 text-xs'
                    },
                    'IG'
                  )
                : React.createElement('img', {
                    key: 'logo',
                    src: '/logoig.png',
                    alt: 'Instagram',
                    className: 'h-5 w-auto sm:h-6 object-contain',
                    onError: () => setIgError(true)
                  }),
              '@revistanacionalcienciae'
            ]
          ),
          // YouTube
          React.createElement(
            'a',
            {
              key: 'youtube',
              href: 'https://www.youtube.com/@RevistaNacionaldelasCienciaspa',
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'flex items-center gap-2 text-red-400 hover:text-red-500'
            },
            [
              ytError
                ? React.createElement(
                    'div',
                    {
                      key: 'fallback',
                      className: 'flex items-center justify-center bg-red-600 text-white font-bold rounded-full h-6 w-6 text-xs'
                    },
                    'YT'
                  )
                : React.createElement('img', {
                    key: 'logo',
                    src: '/logoyt.png',
                    alt: 'YouTube',
                    className: 'h-5 w-auto sm:h-6 object-contain',
                    onError: () => setYtError(true)
                  }),
              'Revista Nacional de las Ciencias para Estudiantes'
            ]
          )
        ]
      )
    ]
  );
}

export default Footer;
