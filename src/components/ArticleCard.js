import React, { useState } from 'react';

function ArticleCard({ article }) {
  const [showCitations, setShowCitations] = useState(false);
  const [showFullAbstract, setShowFullAbstract] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const journal = 'Revista Nacional de las Ciencias para Estudiantes';

  const getAPACitation = () => {
    const date = new Date(article['Fecha de publicación']);
    return React.createElement(
      'span',
      null,
      `${article['Autor']}. (${date.getFullYear()}). `,
      React.createElement('span', { className: 'italic' }, article['Título']),
      '. ',
      React.createElement('span', { className: 'italic' }, journal),
      '.'
    );
  };

  const getMLACitation = () => {
    const date = new Date(article['Fecha de publicación']);
    return React.createElement(
      'span',
      null,
      `${article['Autor']}. "`,
      React.createElement('span', { className: 'italic' }, article['Título']),
      '." ',
      React.createElement('span', { className: 'italic' }, journal),
      `, ${date.getFullYear()}.`
    );
  };

  const getChicagoCitation = () => {
    const date = new Date(article['Fecha de publicación']);
    return React.createElement(
      'span',
      null,
      `${article['Autor']}. "${article['Título']}." `,
      React.createElement('span', { className: 'italic' }, journal),
      ` (${date.getFullYear()}).`
    );
  };

  const getTruncatedAbstract = () => {
    const maxLength = 50; // Más corto para móviles
    if (article['Resumen'].length <= maxLength) return article['Resumen'];
    return article['Resumen'].substring(0, maxLength) + '...';
  };

  return React.createElement(
    'div',
    { className: 'article-card bg-white p-3 sm:p-5 rounded-lg shadow-md hover:shadow-lg transition-shadow' },
    // Vista compacta (móviles) y normal (escritorio)
    React.createElement(
      'div',
      null,
      React.createElement(
        'h2',
        {
          className: 'text-base sm:text-xl font-semibold mb-1 sm:mb-3 cursor-pointer hover:text-blue-500',
          onClick: () => setIsModalOpen(true),
        },
        article['Título']
      ),
      React.createElement('p', { className: 'text-gray-600 text-xs sm:text-base mb-1 sm:mb-2' }, React.createElement('strong', null, 'Autor:'), ' ', article['Autor']),
      React.createElement('p', { className: 'text-gray-600 text-xs sm:text-base mb-1 sm:mb-2' }, React.createElement('strong', null, 'Fecha:'), ' ', new Date(article['Fecha de publicación']).toLocaleDateString()),
      React.createElement('p', { className: 'text-gray-600 text-xs sm:text-base mb-1 sm:mb-2' }, React.createElement('strong', null, 'Área:'), ' ', article['Area'] || 'No especificada'),
      // Resumen y botones solo en escritorio
      React.createElement(
        'div',
        { className: 'hidden sm:block' },
        React.createElement(
          'p',
          { className: 'text-gray-700 text-sm sm:text-base mb-2 sm:mb-3' },
          React.createElement('strong', null, 'Resumen:'), ' ',
          showFullAbstract ? article['Resumen'] : getTruncatedAbstract(),
          article['Resumen'].length > 100 &&
            React.createElement(
              'button',
              {
                className: 'text-brown-800 hover:text-brown-700 text-sm sm:text-base ml-2 focus:outline-none focus:ring-2 focus:ring-brown-800',
                onClick: () => setShowFullAbstract(!showFullAbstract),
              },
              showFullAbstract ? 'Leer menos' : 'Leer más'
            )
        ),
        React.createElement('a', {
          href: article['Link al PDF'],
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'text-blue-500 hover:underline text-sm sm:text-base',
        }, 'Leer PDF'),
        React.createElement(
          'div',
          { className: 'mt-3 sm:mt-4' },
          React.createElement(
            'button',
            {
              className: 'text-brown-800 hover:text-brown-700 text-sm sm:text-base mb-2 sm:mb-3 focus:outline-none focus:ring-2 focus:ring-brown-800',
              onClick: () => setShowCitations(!showCitations),
            },
            showCitations ? 'Ocultar citas' : 'Mostrar citas'
          ),
          showCitations &&
            React.createElement(
              'div',
              { className: 'text-gray-700 text-sm sm:text-base' },
              React.createElement('p', { className: 'font-semibold' }, 'Cita en APA:'),
              React.createElement('p', { className: 'mb-2 sm:mb-3' }, getAPACitation()),
              React.createElement('p', { className: 'font-semibold' }, 'Cita en MLA:'),
              React.createElement('p', { className: 'mb-2 sm:mb-3' }, getMLACitation()),
              React.createElement('p', { className: 'font-semibold' }, 'Cita en Chicago:'),
              React.createElement('p', null, getChicagoCitation())
            )
        )
      ),
      // Botón para mostrar resumen en móviles
      React.createElement(
        'div',
        { className: 'sm:hidden mt-2' },
        React.createElement(
          'button',
          {
            className: 'text-blue-500 hover:text-blue-600 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500',
            onClick: () => setIsModalOpen(true),
          },
          'Ver resumen'
        )
      )
    ),
    // Modal para móviles
    isModalOpen &&
      React.createElement(
        'div',
        { className: 'sm:hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50' },
        React.createElement(
          'div',
          { className: 'bg-white p-4 rounded-lg max-w-full mx-2 max-h-[90vh] overflow-y-auto' },
          React.createElement(
            'div',
            { className: 'flex justify-between items-center mb-3' },
            React.createElement('h2', { className: 'text-lg font-semibold' }, article['Título']),
            React.createElement(
              'button',
              {
                className: 'text-gray-600 hover:text-gray-800 text-xl focus:outline-none',
                onClick: () => setIsModalOpen(false),
              },
              '×'
            )
          ),
          React.createElement('p', { className: 'text-gray-600 text-sm mb-2' }, React.createElement('strong', null, 'Autor:'), ' ', article['Autor']),
          React.createElement('p', { className: 'text-gray-600 text-sm mb-2' }, React.createElement('strong', null, 'Fecha:'), ' ', new Date(article['Fecha de publicación']).toLocaleDateString()),
          React.createElement('p', { className: 'text-gray-600 text-sm mb-2' }, React.createElement('strong', null, 'Área:'), ' ', article['Area'] || 'No especificada'),
          React.createElement(
            'p',
            { className: 'text-gray-700 text-sm mb-3' },
            React.createElement('strong', null, 'Resumen:'), ' ',
            article['Resumen']
          ),
          React.createElement('a', {
            href: article['Link al PDF'],
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'text-blue-500 hover:underline text-sm block mb-3',
          }, 'Leer PDF'),
          React.createElement(
            'div',
            null,
            React.createElement(
              'button',
              {
                className: 'text-brown-800 hover:text-brown-700 text-sm font-semibold mb-3 focus:outline-none focus:ring-2 focus:ring-brown-800',
                onClick: () => setShowCitations(!showCitations),
              },
              showCitations ? 'Ocultar citas' : 'Mostrar citas'
            ),
            showCitations &&
              React.createElement(
                'div',
                { className: 'text-gray-700 text-sm' },
                React.createElement('p', { className: 'font-semibold' }, 'Cita en APA:'),
                React.createElement('p', { className: 'mb-2' }, getAPACitation()),
                React.createElement('p', { className: 'font-semibold' }, 'Cita en MLA:'),
                React.createElement('p', { className: 'mb-2' }, getMLACitation()),
                React.createElement('p', { className: 'font-semibold' }, 'Cita en Chicago:'),
                React.createElement('p', null, getChicagoCitation())
              )
          )
        )
      )
  );
}

export default ArticleCard;