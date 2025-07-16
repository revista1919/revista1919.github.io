import React, { useState } from 'react';

function ArticleCard({ article }) {
  const [showCitations, setShowCitations] = useState(false);
  const [showFullAbstract, setShowFullAbstract] = useState(false);

  const journal = 'Revista Nacional de las Ciencias para Estudiantes';

  const getAPACitation = () => {
    const date = new Date(article['Fecha de publicación']);
    return `${article['Autor']}. (${date.getFullYear()}). ${article['Título']}. ${journal}.`;
  };

  const getMLACitation = () => {
    const date = new Date(article['Fecha de publicación']);
    return `${article['Autor']}. "${article['Título']}." ${journal}, ${date.getFullYear()}.`;
  };

  const getChicagoCitation = () => {
    const date = new Date(article['Fecha de publicación']);
    return `${article['Autor']}. "${article['Título']}." ${journal} (${date.getFullYear()}).`;
  };

  const getTruncatedAbstract = () => {
    const maxLength = 100;
    if (article['Resumen'].length <= maxLength) return article['Resumen'];
    return article['Resumen'].substring(0, maxLength) + '...';
  };

  return React.createElement(
    'div',
    { className: 'article-card bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow' },
    React.createElement('h2', { className: 'text-xl font-semibold mb-2' }, article['Título']),
    React.createElement('p', { className: 'text-gray-600 mb-1' }, React.createElement('strong', null, 'Autor:'), ' ', article['Autor']),
    React.createElement('p', { className: 'text-gray-600 mb-1' }, React.createElement('strong', null, 'Fecha:'), ' ', new Date(article['Fecha de publicación']).toLocaleDateString()),
    React.createElement('p', { className: 'text-gray-600 mb-1' }, React.createElement('strong', null, 'Área:'), ' ', article['Area'] || 'No especificada'),
    React.createElement(
      'p',
      { className: 'text-gray-700 mb-2' },
      React.createElement('strong', null, 'Resumen:'), ' ',
      showFullAbstract ? article['Resumen'] : getTruncatedAbstract(),
      article['Resumen'].length > 100 &&
        React.createElement(
          'button',
          {
            className: 'text-brown-800 hover:text-brown-700 ml-2',
            onClick: () => setShowFullAbstract(!showFullAbstract),
          },
          showFullAbstract ? 'Leer menos' : 'Leer más'
        )
    ),
    React.createElement('a', {
      href: article['Link al PDF'],
      target: '_blank',
      rel: 'noopener noreferrer',
      className: 'text-blue-500 hover:underline',
    }, 'Leer PDF'),
    React.createElement(
      'div',
      { className: 'mt-4' },
      React.createElement(
        'button',
        {
          className: 'text-brown-800 hover:text-brown-700 mb-2',
          onClick: () => setShowCitations(!showCitations),
        },
        showCitations ? 'Ocultar citas' : 'Mostrar citas'
      ),
      showCitations &&
        React.createElement(
          'div',
          { className: 'text-gray-700' },
          React.createElement('p', { className: 'font-semibold' }, 'Cita en APA:'),
          React.createElement('p', { className: 'mb-2' }, getAPACitation()),
          React.createElement('p', { className: 'font-semibold' }, 'Cita en MLA:'),
          React.createElement('p', { className: 'mb-2' }, getMLACitation()),
          React.createElement('p', { className: 'font-semibold' }, 'Cita en Chicago:'),
          React.createElement('p', null, getChicagoCitation())
        )
    )
  );
}

export default ArticleCard;