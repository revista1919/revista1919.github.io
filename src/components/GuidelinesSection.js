import React from 'react';
import { useTranslation } from 'react-i18next';

function GuidelinesSection() {
  return React.createElement(
    'div',
    { className: 'guidelines-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6' },
    React.createElement('h2', { className: 'text-xl sm:text-2xl font-semibold mb-3 sm:mb-4' }, 'Normas Editoriales'),
    React.createElement(
      'ul',
      { className: 'list-disc pl-4 sm:pl-5 text-sm sm:text-base' },
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, 'Extensión: 1.000–10.000 palabras (tablas no cuentan como palabras)'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, 'Formato: Word (.docx), sin nombre del autor en el documento'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, 'Originalidad: El artículo debe ser inédito, no publicado ni enviado a otro medio, y no puede usar IA para redactar'),
      React.createElement(
        'li',
        { className: 'mb-2 sm:mb-3' },
        'Citación: Exclusivamente ',
        React.createElement(
          'a',
          {
            href: 'https://www.chicagomanualofstyle.org/tools_citationguide.html',
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'text-blue-500 hover:underline'
          },
          'estilo Chicago'
        )
      ),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, 'Aceptamos artículos en español y en inglés'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, 'Elementos permitidos: Gráficas, ecuaciones, imágenes, tablas (fuera del conteo de palabras)')
    ),
    React.createElement('h3', { className: 'text-lg sm:text-xl font-semibold mt-6 mb-3' }, 'Para aprender a hacer un artículo científico, te recomendamos los siguientes videos:'),
    React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
      React.createElement('iframe', {
        width: '100%',
        height: '200',
        src: 'https://www.youtube.com/embed/wyPhAGW6-94',
        title: 'Video 1',
        frameBorder: '0',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowFullScreen: true
      }),
      React.createElement('iframe', {
        width: '100%',
        height: '200',
        src: 'https://www.youtube.com/embed/videoseries?list=PL8yQlmhs7KsBerg9X63QnZnlNAopwzDmw',
        title: 'Playlist',
        frameBorder: '0',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowFullScreen: true
      })
    ),
    React.createElement('h3', { className: 'text-lg sm:text-xl font-semibold mt-8 mb-4' }, 'Para investigar, te recomendamos los siguientes sitios:'),
    React.createElement(
      'div',
      { className: 'grid grid-cols-1 sm:grid-cols-3 gap-4' },
      [
        { name: 'Google Scholar', url: 'https://scholar.google.com/', desc: 'Buscador académico de Google con millones de artículos científicos.' },
        { name: 'SciELO', url: 'https://scielo.org/es/', desc: 'Biblioteca científica en línea de acceso abierto en español y portugués.' },
        { name: 'Consensus', url: 'https://consensus.app/', desc: 'Plataforma impulsada por IA para encontrar y resumir artículos científicos.' }
      ].map((site, index) =>
        React.createElement(
          'a',
          {
            key: index,
            href: site.url,
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'block p-4 bg-gray-50 rounded-xl shadow hover:shadow-md transition'
          },
          React.createElement('h4', { className: 'text-base sm:text-lg font-semibold text-gray-800 mb-2' }, site.name),
          React.createElement('p', { className: 'text-sm text-gray-600' }, site.desc)
        )
      )
    )
  );
}

export default GuidelinesSection;
