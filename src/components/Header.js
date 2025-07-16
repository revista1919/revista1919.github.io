import React from 'react';

function Header() {
  return React.createElement(
    'header',
    { className: 'bg-gray-800 text-white p-4 mb-6' },
    React.createElement(
      'div',
      { className: 'container flex items-center justify-between' },
      React.createElement(
        'div',
        { className: 'flex items-center' },
        React.createElement('img', { src: '/logo.png', alt: 'Revista Logo', className: 'h-12 mr-4' }),
        React.createElement('h1', { className: 'text-2xl font-bold' }, 'Revista Nacional de las Ciencias')
      )
    )
  );
}

export default Header;
