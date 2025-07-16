import React from 'react';

function ArticleCard({ article }) {
  return React.createElement(
    'div',
    { className: 'article-card bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow' },
    React.createElement('h2', { className: 'text-xl font-semibold mb-2' }, article['Título']),
    React.createElement('p', { className: 'text-gray-600 mb-1' }, React.createElement('strong', null, 'Autor:'), ' ', article['Autor']),
    React.createElement('p', { className: 'text-gray-600 mb-1' }, React.createElement('strong', null, 'Fecha:'), ' ', new Date(article['Fecha de publicación']).toLocaleDateString()),
    React.createElement('p', { className: 'text-gray-700 mb-2' }, article['Resumen']),
    React.createElement('a', {
      href: article['Link al PDF'],
      target: '_blank',
      rel: 'noopener noreferrer',
      className: 'text-blue-500 hover:underline',
    }, 'Leer PDF')
  );
}

export default ArticleCard;
