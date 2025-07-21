import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';

function ArticleCard({ article }) {
  const [showCitations, setShowCitations] = useState(false);
  const [showFullAbstract, setShowFullAbstract] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthorModalOpen, setIsAuthorModalOpen] = useState(false);
  const [authorsData, setAuthorsData] = useState([]);
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [csvError, setCsvError] = useState(null);

  const journal = 'Revista Nacional de las Ciencias para Estudiantes';
  const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';

  // Cargar datos del CSV al montar el componente
  useEffect(() => {
    setIsLoading(true);
    setCsvError(null);
    Papa.parse(csvUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setAuthorsData(result.data || []);
        setIsLoading(false);
      },
      error: (error) => {
        console.error('Error al cargar el CSV:', error);
        setCsvError('No se pudo cargar la información de los autores.');
        setAuthorsData([]);
        setIsLoading(false);
      },
    });
  }, []);

  // Memorizar datos procesados para evitar reprocesamiento
  const processedAuthors = useMemo(() => authorsData, [authorsData]);

  const getAPACitation = () => {
    const date = article['Fecha de publicación'] ? new Date(article['Fecha de publicación']) : new Date();
    const author = article['Autor'] || 'Autor desconocido';
    const title = article['Título'] || 'Sin título';
    return React.createElement(
      'span',
      null,
      `${author}. (${date.getFullYear()}). `,
      React.createElement('span', { className: 'italic' }, title),
      '. ',
      React.createElement('span', { className: 'italic' }, journal),
      '.'
    );
  };

  const getMLACitation = () => {
    const date = article['Fecha de publicación'] ? new Date(article['Fecha de publicación']) : new Date();
    const author = article['Autor'] || 'Autor desconocido';
    const title = article['Título'] || 'Sin título';
    return React.createElement(
      'span',
      null,
      `${author}. "`,
      React.createElement('span', { className: 'italic' }, title),
      '." ',
      React.createElement('span', { className: 'italic' }, journal),
      `, ${date.getFullYear()}.`
    );
  };

  const getChicagoCitation = () => {
    const date = article['Fecha de publicación'] ? new Date(article['Fecha de publicación']) : new Date();
    const author = article['Autor'] || 'Autor desconocido';
    const title = article['Título'] || 'Sin título';
    return React.createElement(
      'span',
      null,
      `${author}. "${title}." `,
      React.createElement('span', { className: 'italic' }, journal),
      ` (${date.getFullYear()}).`
    );
  };

  const getTruncatedAbstract = () => {
    const maxLength = 50;
    const abstract = article['Resumen'] || 'Resumen no disponible';
    if (abstract.length <= maxLength) return abstract;
    return abstract.substring(0, maxLength) + '...';
  };

  const handleAuthorClick = (authorName) => {
    if (!authorName) return;
    setIsLoading(true);
    const author = processedAuthors.find((data) => data['Nombre'] === authorName) || {
      Nombre: authorName,
      Descripción: 'Información no disponible',
      'Áreas de interés': 'No especificadas',
      'Rol en la Revista': 'No especificado',
    };
    setSelectedAuthor(author);
    setIsAuthorModalOpen(true);
    setIsLoading(false);
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
          'aria-label': `Ver detalles de ${article['Título'] || 'artículo'}`,
        },
        article['Título'] || 'Sin título'
      ),
      React.createElement(
        'p',
        { className: 'text-gray-600 text-xs sm:text-base mb-1 sm:mb-2' },
        React.createElement('strong', null, 'Autor:'), ' ',
        React.createElement(
          'span',
          {
            className: 'cursor-pointer hover:text-blue-500 underline',
            onClick: () => handleAuthorClick(article['Autor']),
            'aria-label': `Ver información de ${article['Autor'] || 'autor desconocido'}`,
          },
          article['Autor'] || 'Autor desconocido'
        )
      ),
      React.createElement(
        'p',
        { className: 'text-gray-600 text-xs sm:text-base mb-1 sm:mb-2' },
        React.createElement('strong', null, 'Fecha:'), ' ',
        article['Fecha de publicación']
          ? new Date(article['Fecha de publicación']).toLocaleDateString()
          : 'Fecha no disponible'
      ),
      React.createElement(
        'p',
        { className: 'text-gray-600 text-xs sm:text-base mb-1 sm:mb-2' },
        React.createElement('strong', null, 'Área:'), ' ',
        article['Area'] || 'No especificada'
      ),
      // Resumen y botones solo en escritorio
      React.createElement(
        'div',
        { className: 'hidden sm:block' },
        React.createElement(
          'p',
          { className: 'text-gray-700 text-sm sm:text-base mb-2 sm:mb-3' },
          React.createElement('strong', null, 'Resumen:'), ' ',
          showFullAbstract ? (article['Resumen'] || 'Resumen no disponible') : getTruncatedAbstract(),
          (article['Resumen']?.length || 0) > 50 &&
            React.createElement(
              'button',
              {
                className: 'text-brown-800 hover:text-brown-700 text-sm sm:text-base ml-2 focus:outline-none focus:ring-2 focus:ring-brown-800',
                onClick: () => setShowFullAbstract(!showFullAbstract),
                'aria-label': showFullAbstract ? 'Ocultar resumen completo' : 'Mostrar resumen completo',
              },
              showFullAbstract ? 'Leer menos' : 'Leer más'
            )
        ),
        article['Link al PDF'] &&
          React.createElement(
            'a',
            {
              href: article['Link al PDF'],
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'text-blue-500 hover:underline text-sm sm:text-base',
              'aria-label': 'Leer PDF del artículo',
            },
            'Leer PDF'
          ),
        React.createElement(
          'div',
          { className: 'mt-3 sm:mt-4' },
          React.createElement(
            'button',
            {
              className: 'text-brown-800 hover:text-brown-700 text-sm sm:text-base mb-2 sm:mb-3 focus:outline-none focus:ring-2 focus:ring-brown-800',
              onClick: () => setShowCitations(!showCitations),
              'aria-label': showCitations ? 'Ocultar citas' : 'Mostrar citas',
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
            'aria-label': 'Ver resumen del artículo',
          },
          'Ver resumen'
        )
      )
    ),
    // Modal para resumen (móviles)
    isModalOpen &&
      React.createElement(
        'div',
        { className: 'sm:hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50' },
        React.createElement(
          'div',
          { className: 'bg-white p-4 rounded-lg max-w-[90vw] mx-2 max-h-[90vh] overflow-y-auto' },
          React.createElement(
            'div',
            { className: 'flex justify-between items-center mb-3' },
            React.createElement('h2', { className: 'text-lg font-semibold' }, article['Título'] || 'Sin título'),
            React.createElement(
              'button',
              {
                className: 'text-gray-600 hover:text-gray-800 text-xl focus:outline-none focus:ring-2 focus:ring-blue-500',
                onClick: () => setIsModalOpen(false),
                'aria-label': 'Cerrar modal de resumen',
              },
              '×'
            )
          ),
          React.createElement(
            'p',
            { className: 'text-gray-600 text-sm mb-2' },
            React.createElement('strong', null, 'Autor:'), ' ',
            article['Autor'] || 'Autor desconocido'
          ),
          React.createElement(
            'p',
            { className: 'text-gray-600 text-sm mb-2' },
            React.createElement('strong', null, 'Fecha:'), ' ',
            article['Fecha de publicación']
              ? new Date(article['Fecha de publicación']).toLocaleDateString()
              : 'Fecha no disponible'
          ),
          React.createElement(
            'p',
            { className: 'text-gray-600 text-sm mb-2' },
            React.createElement('strong', null, 'Área:'), ' ',
            article['Area'] || 'No especificada'
          ),
          React.createElement(
            'p',
            { className: 'text-gray-700 text-sm mb-3' },
            React.createElement('strong', null, 'Resumen:'), ' ',
            article['Resumen'] || 'Resumen no disponible'
          ),
          article['Link al PDF'] &&
            React.createElement(
              'a',
              {
                href: article['Link al PDF'],
                target: '_blank',
                rel: 'noopener noreferrer',
                className: 'text-blue-500 hover:underline text-sm block mb-3',
                'aria-label': 'Leer PDF del artículo',
              },
              'Leer PDF'
            ),
          React.createElement(
            'div',
            null,
            React.createElement(
              'button',
              {
                className: 'text-brown-800 hover:text-brown-700 text-sm font-semibold mb-3 focus:outline-none focus:ring-2 focus:ring-brown-800',
                onClick: () => setShowCitations(!showCitations),
                'aria-label': showCitations ? 'Ocultar citas' : 'Mostrar citas',
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
      ),
    // Modal para información del autor (móviles y escritorio)
    isAuthorModalOpen &&
      React.createElement(
        'div',
        { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50' },
        React.createElement(
          'div',
          { className: 'bg-white p-4 sm:p-8 rounded-lg max-w-[90vw] sm:max-w-lg max-h-[90vh] overflow-y-auto mx-2 shadow-lg' },
          isLoading
            ? React.createElement('p', { className: 'text-gray-600 text-sm sm:text-lg' }, 'Cargando...')
            : csvError
              ? React.createElement('p', { className: 'text-red-600 text-sm sm:text-lg' }, csvError)
              : React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'div',
                    { className: 'flex justify-between items-center mb-4 sm:mb-5 border-b border-gray-200 pb-2' },
                    React.createElement(
                      'h2',
                      { className: 'text-lg sm:text-xl font-bold text-gray-800' },
                      selectedAuthor['Nombre'] || 'Autor desconocido'
                    ),
                    React.createElement(
                      'button',
                      {
                        className: 'text-gray-500 hover:text-gray-700 text-xl focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full w-8 h-8 flex items-center justify-center',
                        onClick: () => setIsAuthorModalOpen(false),
                        'aria-label': 'Cerrar modal de autor',
                      },
                      '×'
                    )
                  ),
                  React.createElement(
                    'div',
                    { className: 'text-gray-700 text-sm sm:text-lg space-y-4 sm:space-y-5' },
                    React.createElement(
                      'div',
                      null,
                      React.createElement('p', { className: 'font-semibold text-blue-600' }, 'Descripción:'),
                      React.createElement('p', { className: 'text-gray-600' }, selectedAuthor['Descripción'] || 'Información no disponible')
                    ),
                    React.createElement(
                      'div',
                      null,
                      React.createElement('p', { className: 'font-semibold text-blue-600' }, 'Áreas de interés:'),
                      React.createElement('p', { className: 'text-gray-600' }, selectedAuthor['Áreas de interés'] || 'No especificadas')
                    ),
                    React.createElement(
                      'div',
                      null,
                      React.createElement('p', { className: 'font-semibold text-blue-600' }, 'Rol en la Revista:'),
                      React.createElement('p', { className: 'text-gray-600' }, selectedAuthor['Rol en la Revista'] || 'No especificado')
                    )
                  )
                )
        )
      )
  );
}

export default ArticleCard;