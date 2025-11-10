import React, { useState } from 'react';

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

  const [isExpanded, setIsExpanded] = useState(false);
  const [showCitations, setShowCitations] = useState(false);
  const [showFullEnglishAbstract, setShowFullEnglishAbstract] = useState(false);
  const [showSpanishAbstract, setShowSpanishAbstract] = useState(false);
  const [showFullSpanishAbstract, setShowFullSpanishAbstract] = useState(false);

  const journal = 'The National Review of Sciences for Students';
  const pdfUrl = article?.pdf || null;

  const htmlUrl = article?.numeroArticulo
    ? `https://www.revistacienciasestudiantes.com/articles/articulo${article.numeroArticulo}EN.html`
    : null;

  const pages = `${article?.primeraPagina || ''}-${article?.ultimaPagina || ''}`.trim() || '';

  // Updated to point to English team pages (.EN.html)
  const handleAuthorClick = (authorName) => {
    if (!authorName) return;
    const slug = generateSlug(authorName);
    window.location.href = `/team/${slug}.EN.html`;
  };

  const getChicagoCitation = () => {
    const authors = article?.autores?.split(';').map(a => a.trim()).join('; ') || 'Unknown author';
    const title = article?.titulo || 'Untitled';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);

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
    const authors = article?.autores?.split(';').map(a => a.trim()).join('; ') || 'Unknown author';
    const title = article?.titulo || 'Untitled';
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
    const authors = article?.autores?.split(';').map(a => a.trim()).join('; ') || 'Unknown author';
    const title = article?.titulo || 'Untitled';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);

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

  const toggleExpand = (e) => {
    // Prevent expansion if clicking on interactive elements
    const tag = e.target.tagName.toLowerCase();
    const isInteractive = ['a', 'button', 'span'].includes(tag) || e.target.closest('a, button, span');
    if (!isInteractive) {
      setIsExpanded(!isExpanded);
    }
  };

  if (!article || Object.keys(article).length === 0) {
    return (
      <div className="py-6 px-4 sm:px-6 border-b border-gray-200 last:border-b-0">
        <p className="text-center text-gray-500 font-medium">No data found for this article.</p>
      </div>
    );
  }

  return (
    <div
  className={`py-4 px-4 sm:px-6 bg-white hover:bg-gray-50 transition-colors duration-200 cursor-pointer border-b border-gray-200 last:border-b-0 ${isExpanded ? 'bg-gray-50' : ''}`}
  onClick={toggleExpand}
  role="button"
  tabIndex={0}
  aria-expanded={isExpanded}
  aria-label={`Expand article: ${article.titulo || 'Untitled'}`}
>

      <h2 className="text-lg sm:text-xl font-semibold text-blue-700 hover:text-blue-800 transition-colors mb-2">
        {article.titulo || 'Untitled'}
      </h2>

      <p className="text-sm text-gray-700 mb-2">
        {article.autores ? (
          article.autores.split(';').map((a, idx, arr) => (
            <React.Fragment key={idx}>
              <span
                className="cursor-pointer hover:text-blue-600 underline transition-colors"
                onClick={(e) => { e.stopPropagation(); handleAuthorClick(a.trim()); }}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAuthorClick(a.trim()); }}
                aria-label={`View profile of ${a.trim()}`}
              >
                {a.trim()}
              </span>
              {idx < arr.length - 1 ? '; ' : ''}
            </React.Fragment>
          ))
        ) : (
          'Unknown author'
        )}
      </p>

      <p className="text-xs text-green-600">
        {journal} · {getYear(article.fecha)} {pages && `· pp. ${pages}`}
      </p>

      {!isExpanded && article.englishAbstract && (
        <p className="text-sm text-gray-700 mt-2 line-clamp-3">
          {article.englishAbstract}
        </p>
      )}

      {isExpanded && (
        <div className="mt-4 space-y-4 animate-fade-in">
          <p className="text-sm text-gray-800">
            <strong className="font-medium">Date:</strong> {parseDateFlexible(article.fecha)}
          </p>
          {article.area ? (
  <div className="text-sm text-gray-800">
    <strong className="font-medium">Areas:</strong>
    <div className="flex flex-wrap gap-2 mt-1">
      {article.area
        .split(';')
        .map((area, idx) => (
          <span
            key={idx}
            className="bg-yellow-100 text-yellow-800 text-xs font-medium px-3 py-1 rounded-full shadow-sm"
          >
            {area.trim()}
          </span>
        ))}
    </div>
  </div>
) : (
  <p className="text-sm text-gray-800">
    <strong className="font-medium">Area:</strong> Not specified
  </p>
)}
 
 <p className="text-sm text-gray-800">
    <strong className="font-medium">Keywords:</strong>
  </p>

          {article.keywords_english && article.keywords_english.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {article.keywords_english
                .map((kw, idx) => (
                  <span
                    key={idx}
                    className="bg-blue-100 text-blue-800 text-xs font-medium px-3 py-1 rounded-full shadow-sm"
                  >
                    {kw}
                  </span>
                ))}
            </div>
          )}
          

          <p className="text-sm text-gray-800">
            <strong className="font-medium">Abstract: </strong>
            {article.englishAbstract ? (
              <>
                {showFullEnglishAbstract ? article.englishAbstract : `${article.englishAbstract.slice(0, 200)}...`}
                {article.englishAbstract.length > 200 && (
                  <button
                    className="ml-2 text-blue-600 hover:text-blue-800 underline text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    onClick={(e) => { e.stopPropagation(); setShowFullEnglishAbstract(!showFullEnglishAbstract); }}
                  >
                    {showFullEnglishAbstract ? 'Read less' : 'Read more'}
                  </button>
                )}
              </>
            ) : (
              'Abstract not available'
            )}
          </p>

          <div>
            <button
              className="text-blue-600 hover:text-blue-800 underline text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              onClick={(e) => { e.stopPropagation(); setShowSpanishAbstract(!showSpanishAbstract); }}
            >
              {showSpanishAbstract ? 'Hide Spanish abstract' : 'View Spanish abstract'}
            </button>
            {showSpanishAbstract && (
              <p className="text-sm text-gray-800 mt-2 bg-white p-3 rounded-lg shadow-inner">
                <strong className="font-medium">Resumen: </strong>
                {article.resumen ? (
                  <>
                    {showFullSpanishAbstract ? article.resumen : `${article.resumen.slice(0, 200)}...`}
                    {article.resumen.length > 200 && (
                      <button
                        className="ml-2 text-blue-600 hover:text-blue-800 underline text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                        onClick={(e) => { e.stopPropagation(); setShowFullSpanishAbstract(!showFullSpanishAbstract); }}
                      >
                        {showFullSpanishAbstract ? 'Leer menos' : 'Leer más'}
                      </button>
                    )}
                  </>
                ) : (
                  'Resumen no disponible'
                )}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {pdfUrl && (
              <>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm shadow"
                  onClick={(e) => e.stopPropagation()}
                >
                  Open PDF
                </a>
                <a
                  href={pdfUrl}
                  download
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm shadow"
                  onClick={(e) => e.stopPropagation()}
                >
                  Download PDF
                </a>
              </>
            )}
            {htmlUrl && (
              <a
                href={htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm shadow"
                onClick={(e) => e.stopPropagation()}
              >
                Open full page
              </a>
            )}
          </div>

          <button
            className="text-brown-800 hover:text-brown-900 underline text-sm focus:outline-none focus:ring-2 focus:ring-brown-500 rounded"
            onClick={(e) => { e.stopPropagation(); setShowCitations(!showCitations); }}
          >
            {showCitations ? 'Hide citations' : 'How to cite this article'}
          </button>
          {showCitations && (
            <div className="text-gray-800 text-sm space-y-4 bg-white p-4 rounded-lg shadow-inner break-words">
              <p><strong className="font-medium">Chicago:</strong> {getChicagoCitation()}</p>
              <p><strong className="font-medium">APA:</strong> {getApaCitation()}</p>
              <p><strong className="font-medium">MLA:</strong> {getMlaCitation()}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ArticleCardEN;