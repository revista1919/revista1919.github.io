import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

function parseDateFlexible(dateStr) {
  if (!dateStr) return 'Date not available';
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
  if (!dateStr) return 'n.d.'; // no date
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

function ArticleCardEN({ article }) {
  console.log('Article object received:', article);

  const [showCitations, setShowCitations] = useState(false);
  const [showFullEnglishAbstract, setShowFullEnglishAbstract] = useState(false);
  const [showFullSpanishAbstract, setShowFullSpanishAbstract] = useState(false);
  const [showSpanishAbstract, setShowSpanishAbstract] = useState(false);

  const journal = 'The National Review of Sciences for Students';
  const pdfUrl = article?.['Número de artículo']
    ? `https://www.revistacienciasestudiantes.com/Articles/Articulo${article['Número de artículo']}.pdf`
    : null;

  const pages = `${article?.['Primera página'] || ''}-${article?.['Última página'] || ''}`.trim() || '';

  // Updated to point to English team pages (.EN.html)
  const handleAuthorClick = (authorName) => {
    if (!authorName) return;
    const slug = generateSlug(authorName);
    window.location.href = `/team/${slug}.EN.html`;
  };

  const getChicagoCitation = () => {
    const authors = article?.['Autor(es)']?.split(';').map(a => a.trim()).join('; ') || 'Unknown author';
    const title = article?.['Título'] || 'Untitled';
    const volume = article?.['Volumen'] || '';
    const number = article?.['Número'] || '';
    const year = getYear(article?.['Fecha']);

    return (
      <>
        {authors}. "{title}." <em>{journal}</em> {volume}, no. {number} ({year}): {pages}.{' '}
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-words">
            {pdfUrl}
          </a>
        )}
      </>
    );
  };

  const getApaCitation = () => {
    const authors = article?.['Autor(es)']?.split(';').map(a => a.trim()).join('; ') || 'Unknown author';
    const title = article?.['Título'] || 'Untitled';
    const volume = article?.['Volumen'] || '';
    const number = article?.['Número'] || '';
    const year = getYear(article?.['Fecha']);

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
    const authors = article?.['Autor(es)']?.split(';').map(a => a.trim()).join('; ') || 'Unknown author';
    const title = article?.['Título'] || 'Untitled';
    const volume = article?.['Volumen'] || '';
    const number = article?.['Número'] || '';
    const year = getYear(article?.['Fecha']);

    return (
      <>
        {authors}. "{title}." <em>{journal}</em>, vol. {volume}, no. {number}, {year}, pp. {pages}.{' '}
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
        No data found for this article.
      </div>
    );
  }

  return (
    <article className="article-card bg-white p-4 sm:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
      {/* Article Title */}
      <h2 className="text-lg sm:text-xl font-semibold mb-2 cursor-pointer hover:text-blue-600">
        {article['Título'] || 'Untitled'}
      </h2>

      {/* Authors - Updated to English team pages */}
      <p className="text-gray-600 text-sm sm:text-base mb-1">
        <strong>Author(s): </strong>
        {article['Autor(es)'] ? (
          article['Autor(es)'].split(';').map((a, idx, arr) => (
            <span
              key={idx}
              className="cursor-pointer hover:text-blue-500 underline"
              onClick={() => handleAuthorClick(a.trim())}
            >
              {a.trim()}
              {idx < arr.length - 1 ? '; ' : ''}
            </span>
          ))
        ) : (
          'Unknown author'
        )}
      </p>

      {/* Publication Details */}
      <p className="text-gray-600 text-sm sm:text-base mb-1">
        <strong>Date:</strong> {parseDateFlexible(article['Fecha'])}
      </p>
      <p className="text-gray-600 text-sm sm:text-base mb-2">
        <strong>Area:</strong> {article['Área temática'] || 'Not specified'}
      </p>

      {/* Keywords */}
      {article['Palabras clave'] && (
        <div className="flex flex-wrap gap-2 mb-3">
          {article['Palabras clave']
            .split(/[;,]/)
            .map((k) => k.trim())
            .filter(Boolean)
            .map((kw, idx) => (
              <span
                key={idx}
                className="bg-gray-200 text-gray-800 text-xs sm:text-sm px-2 py-1 rounded-full"
              >
                {kw}
              </span>
            ))}
        </div>
      )}

      {/* ENGLISH ABSTRACT - First (expanded by default for journals) */}
      {article['Abstract'] && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-800 mb-2 uppercase tracking-wide">
            Abstract
          </h3>
          <p className="text-gray-700 text-sm sm:text-base mb-2">
            {showFullEnglishAbstract 
              ? article['Abstract'] 
              : `${article['Abstract'].slice(0, 150)}...`
            }
            {article['Abstract'].length > 150 && (
              <button
                className="ml-2 text-blue-500 hover:underline text-xs sm:text-sm"
                onClick={() => setShowFullEnglishAbstract(!showFullEnglishAbstract)}
              >
                {showFullEnglishAbstract ? 'Read less' : 'Read more'}
              </button>
            )}
          </p>
        </div>
      )}

      {/* SPANISH ABSTRACT - Second */}
      <div className="mb-4">
        <button
          className="text-blue-500 hover:underline text-sm sm:text-base mb-2 focus:outline-none"
          onClick={() => setShowSpanishAbstract(!showSpanishAbstract)}
        >
          {showSpanishAbstract ? 'Hide Spanish abstract' : 'View Spanish abstract'}
        </button>
        
        {showSpanishAbstract && (
          <>
            <h3 className="text-sm font-medium text-gray-800 mb-2 uppercase tracking-wide mt-2">
              Resumen
            </h3>
            <p className="text-gray-700 text-sm sm:text-base mb-2">
              {article['Resumen'] ? (
                <>
                  {showFullSpanishAbstract 
                    ? article['Resumen'] 
                    : `${article['Resumen'].slice(0, 150)}...`
                  }
                  {article['Resumen'].length > 150 && (
                    <button
                      className="ml-2 text-blue-500 hover:underline text-xs sm:text-sm"
                      onClick={() => setShowFullSpanishAbstract(!showFullSpanishAbstract)}
                    >
                      {showFullSpanishAbstract ? 'Leer menos' : 'Leer más'}
                    </button>
                  )}
                </>
              ) : (
                'Resumen no disponible'
              )}
            </p>
          </>
        )}
      </div>

      {/* Article Actions */}
      <div className="flex gap-3 mb-4">
        {pdfUrl && (
          <>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="View full article"
            >
              View Article
            </a>
            <a
              href={pdfUrl}
              download
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              aria-label="Download PDF"
            >
              Download PDF
            </a>
          </>
        )}
      </div>

      {/* Citation Toggle */}
      <button
        className="text-gray-700 hover:text-gray-900 text-sm sm:text-base mb-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
        onClick={() => setShowCitations(!showCitations)}
        aria-expanded={showCitations}
      >
        {showCitations ? 'Hide citations' : 'How to cite this article'}
      </button>

      {/* Citation Styles */}
      {showCitations && (
        <div className="text-gray-700 text-sm sm:text-base space-y-3 pt-2 border-t border-gray-200">
          <div>
            <h4 className="font-semibold text-gray-900 mb-1">Chicago:</h4>
            <p className="text-sm">{getChicagoCitation()}</p>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-1">APA:</h4>
            <p className="text-sm">{getApaCitation()}</p>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-1">MLA:</h4>
            <p className="text-sm">{getMlaCitation()}</p>
          </div>
        </div>
      )}
    </article>
  );
}

export default ArticleCardEN;