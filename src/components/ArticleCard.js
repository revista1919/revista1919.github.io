import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

function parseDateFlexible(dateStr) {
  if (!dateStr) return 'Fecha no disponible';
  let date = new Date(dateStr);
  if (!isNaN(date)) return date.toLocaleDateString();
  const parts = dateStr.split(/[\/.-]/);
  if (parts.length === 3) {
    let [day, month, year] = parts.map((p) => p.padStart(2, '0'));
    if (year.length === 2) year = '20' + year;
    date = new Date(`${year}-${month}-${day}`);
    if (!isNaN(date)) return date.toLocaleDateString();
  }
  return dateStr;
}

function getYear(dateStr) {
  if (!dateStr) return 's.f.';
  let date = new Date(dateStr);
  if (!isNaN(date)) return date.getFullYear();
  const parts = dateStr.split(/[\/.-]/);
  if (parts.length === 3) {
    let [day, month, year] = parts.map((p) => p.padStart(2, '0'));
    if (year.length === 2) year = '20' + year;
    date = new Date(`${year}-${month}-${day}`);
    if (!isNaN(date)) return date.getFullYear();
  }
  return dateStr;
}

function generateSlug(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function ArticleCard({ article }) {
  const [showCitations, setShowCitations] = useState(false);
  const [showFullAbstract, setShowFullAbstract] = useState(false);
  const [showEnglishAbstract, setShowEnglishAbstract] = useState(false);

  const journal = 'Revista Nacional de las Ciencias para Estudiantes';
  const pdfUrl = article?.numeroArticulo
    ? `https://www.revistacienciasestudiantes.com/Articles/Articulo${article.numeroArticulo}.pdf`
    : null;
  const pages = `${article?.primeraPagina || ''}-${article?.ultimaPagina || ''}`.trim() || '';

  const getChicagoCitation = () => {
    const authors = article?.autores?.split(';').map(a => a.trim()).join('; ') || 'Autor desconocido';
    const title = article?.titulo || 'Sin título';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);

    return (
      <>
        {authors}. “{title}.” <em>{journal}</em> {volume}, no. {number} ({year}): {pages}.{' '}
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-words">
            {pdfUrl}
          </a>
        )}
      </>
    );
  };

  const getApaCitation = () => {
    const authors = article?.autores?.split(';').map(a => a.trim()).join('; ') || 'Autor desconocido';
    const title = article?.titulo || 'Sin título';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);

    return (
      <>
        {authors} ({year}). {title}. <em>{journal}</em>, {volume}({number}), {pages}.{' '}
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-words">
            {pdfUrl}
          </a>
        )}
      </>
    );
  };

  const getMlaCitation = () => {
    const authors = article?.autores?.split(';').map(a => a.trim()).join('; ') || 'Autor desconocido';
    const title = article?.titulo || 'Sin título';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);

    return (
      <>
        {authors}. “{title}.” <em>{journal}</em>, vol. {volume}, no. {number}, {year}, pp. {pages}.{' '}
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-words">
            {pdfUrl}
          </a>
        )}
      </>
    );
  };

  if (!article || Object.keys(article).length === 0) {
    return (
      <div className="article-card bg-white p-4 sm:p-6 rounded-lg shadow-md">
        No se encontraron datos para este artículo.
      </div>
    );
  }

  return (
    <div className="article-card bg-white p-4 sm:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <h2 className="text-lg sm:text-xl font-semibold mb-2 cursor-pointer hover:text-blue-600">
        {article.titulo || 'Sin título'}
      </h2>

      <p className="text-gray-600 text-sm sm:text-base mb-1">
        <strong>Autor(es): </strong>
        {article.autores ? (
          article.autores.split(';').map((a, idx, arr) => (
            <a
              key={idx}
              href={`/team/${generateSlug(a.trim())}.html`}
              className="cursor-pointer hover:text-blue-500 underline"
            >
              {a.trim()}
              {idx < arr.length - 1 ? '; ' : ''}
            </a>
          ))
        ) : (
          'Autor desconocido'
        )}
      </p>

      <p className="text-gray-600 text-sm sm:text-base mb-1">
        <strong>Fecha:</strong> {parseDateFlexible(article.fecha)}
      </p>
      <p className="text-gray-600 text-sm sm:text-base mb-2">
        <strong>Área:</strong> {article.area || 'No especificada'}
      </p>

      {article.palabras_clave && (
        <div className="flex flex-wrap gap-2 mb-2">
          {article.palabras_clave.map((kw, idx) => (
            <span
              key={idx}
              className="bg-gray-200 text-gray-800 text-xs sm:text-sm px-2 py-1 rounded-full"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      <p className="text-gray-700 text-sm sm:text-base mb-2">
        <strong>Resumen: </strong>
        {article.resumen ? (
          <>
            {showFullAbstract ? article.resumen : `${article.resumen.slice(0, 100)}...`}
            {article.resumen.length > 100 && (
              <button
                className="ml-2 text-blue-500 hover:underline text-xs sm:text-sm"
                onClick={() => setShowFullAbstract(!showFullAbstract)}
              >
                {showFullAbstract ? 'Leer menos' : 'Leer más'}
              </button>
            )}
          </>
        ) : (
          'Resumen no disponible'
        )}
      </p>

      <div className="mt-2 mb-2">
        <button
          className="text-blue-500 hover:underline text-xs sm:text-sm"
          onClick={() => setShowEnglishAbstract(!showEnglishAbstract)}
        >
          {showEnglishAbstract ? 'Ocultar abstract en inglés' : 'Ver abstract en inglés'}
        </button>
        {showEnglishAbstract && (
          <p className="text-gray-700 text-sm sm:text-base mt-2">
            {article.englishAbstract || 'Abstract no disponible'}
          </p>
        )}
      </div>

      <div className="flex gap-3 mb-3">
        {pdfUrl && (
          <>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs sm:text-sm"
            >
              Ver artículo
            </a>
            <a
              href={pdfUrl}
              download
              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs sm:text-sm"
            >
              Descargar PDF
            </a>
          </>
        )}
      </div>

      <button
        className="text-brown-800 hover:text-brown-700 text-sm sm:text-base mb-2 focus:outline-none focus:ring-2 focus:ring-brown-800"
        onClick={() => setShowCitations(!showCitations)}
      >
        {showCitations ? 'Ocultar citas' : 'Cómo citar este artículo'}
      </button>
      {showCitations && (
        <div className="text-gray-700 text-sm sm:text-base space-y-3 break-words">
          <p><strong>Chicago:</strong> {getChicagoCitation()}</p>
          <p><strong>APA:</strong> {getApaCitation()}</p>
          <p><strong>MLA:</strong> {getMlaCitation()}</p>
        </div>
      )}
    </div>
  );
}

export default ArticleCard;