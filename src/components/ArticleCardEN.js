import React, { useState } from 'react';
// Helper functions
const getYear = (date) => {
  if (!date) return 'n.d.';
  const parsedDate = new Date(date);
  return isNaN(parsedDate) ? 'n.d.' : parsedDate.getFullYear();
};
const parseDateFlexible = (date) => {
  if (!date) return 'Not available';
  const parsedDate = new Date(date);
  return isNaN(parsedDate)
    ? date
    : parsedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};
// Format names => "Juan Pérez" → "Pérez, Juan"
const formatLastFirst = (name) => {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return name; // If a single name, return as is
  const last = parts.pop();
  return `${last}, ${parts.join(' ')}`;
};
// Format names APA → "Juan Pérez" → "Pérez, J."
const formatAPA = (name) => {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return name;
  const last = parts.pop();
  const initials = parts.map((p) => p[0].toUpperCase() + '.').join(' ');
  return `${last}, ${initials}`;
};
// CHICAGO RULES
const formatChicagoAuthors = (authors) => {
  if (authors.length === 1) return formatLastFirst(authors[0]);
  if (authors.length === 2)
    return `${formatLastFirst(authors[0])} and ${authors[1]}`;
  return `${formatLastFirst(authors[0])} et al.`;
};
// APA RULES
const formatAPAAuthors = (authors) => {
  if (authors.length === 1) return formatAPA(authors[0]);
  if (authors.length === 2)
    return `${formatAPA(authors[0])}, & ${formatAPA(authors[1])}`;
  return authors
    .map((a, i) =>
      i === authors.length - 1
        ? `& ${formatAPA(a)}`
        : `${formatAPA(a)}, `
    )
    .join('');
};
// MLA RULES
const formatMLAAuthors = (authors) => {
  if (authors.length === 1) return formatLastFirst(authors[0]);
  if (authors.length === 2)
    return `${formatLastFirst(authors[0])} and ${authors[1]}`;
  return `${formatLastFirst(authors[0])} et al.`;
};
const generateSlug = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};
function ArticleCardEN({ article }) {
  console.log('Article object received:', article);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCitations, setShowCitations] = useState(false);
  const [showFullAbstract, setShowFullAbstract] = useState(false);
  const [showSpanishAbstract, setShowSpanishAbstract] = useState(false);
  const [copiedChicago, setCopiedChicago] = useState(false);
  const [copiedApa, setCopiedApa] = useState(false);
  const [copiedMla, setCopiedMla] = useState(false);
  const journalDisplay = 'The National Review of Sciences for Students';
  const journalFormal = 'Revista Nacional de las Ciencias para Estudiantes';
  const pdfUrl = article?.pdf || null;
  const authorsArray = article?.autores
    ? article.autores.split(';').map((a) => a.trim())
    : [];
  const articleSlug = `${generateSlug(article.titulo)}-${article.numeroArticulo}`;
  const htmlUrl = `https://www.revistacienciasestudiantes.com/articles/article-${articleSlug}EN.html`;
  const pages = `${article?.primeraPagina || ''}-${article?.ultimaPagina || ''}`.trim() || '';
  // C I T A C I O N E S E N I N G L E S
  const getChicagoCitation = () => {
    const authors = authorsArray.length
      ? formatChicagoAuthors(authorsArray)
      : 'Unknown author';
    const title = article?.titulo || 'Untitled';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);
    return (
      <>
        {authors}. "{title}." <em>{journalFormal}</em> {volume}, no. {number} ({year}): {pages}.{' '}
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-words">
            {pdfUrl}
          </a>
        )}
      </>
    );
  };
  const getChicagoText = () => {
    const authors = authorsArray.length
      ? formatChicagoAuthors(authorsArray)
      : 'Unknown author';
    const title = article?.titulo || 'Untitled';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);
    return `${authors}. "${title}." ${journalFormal} ${volume}, no. ${number} (${year}): ${pages}. ${pdfUrl || ''}`;
  };
  const getChicagoHtml = () => {
    const authors = authorsArray.length
      ? formatChicagoAuthors(authorsArray)
      : 'Unknown author';
    const title = article?.titulo || 'Untitled';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);
    return `${authors}. &ldquo;${title}.&rdquo; <em>${journalFormal}</em> ${volume}, no. ${number} (${year}): ${pages}. ${pdfUrl ? `<a href="${pdfUrl}">${pdfUrl}</a>` : ''}`;
  };
  const getApaCitation = () => {
    const authors = authorsArray.length
      ? formatAPAAuthors(authorsArray)
      : 'Unknown author';
    const title = article?.titulo || 'Untitled';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);
    return (
      <>
        {authors} ({year}). {title}. <em>{journalFormal}</em>, {volume}({number}), {pages}.{' '}
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-words">
            {pdfUrl}
          </a>
        )}
      </>
    );
  };
  const getApaText = () => {
    const authors = authorsArray.length
      ? formatAPAAuthors(authorsArray)
      : 'Unknown author';
    const title = article?.titulo || 'Untitled';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);
    return `${authors} (${year}). ${title}. ${journalFormal}, ${volume}(${number}), ${pages}. ${pdfUrl || ''}`;
  };
  const getApaHtml = () => {
    const authors = authorsArray.length
      ? formatAPAAuthors(authorsArray)
      : 'Unknown author';
    const title = article?.titulo || 'Untitled';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);
    return `${authors} (${year}). ${title}. <em>${journalFormal}</em>, ${volume}(${number}), ${pages}. ${pdfUrl ? `<a href="${pdfUrl}">${pdfUrl}</a>` : ''}`;
  };
  const getMlaCitation = () => {
    const authors = authorsArray.length
      ? formatMLAAuthors(authorsArray)
      : 'Unknown author';
    const title = article?.titulo || 'Untitled';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);
    return (
      <>
        {authors}. "{title}." <em>{journalFormal}</em>, vol. {volume}, no. {number}, {year}, pp. {pages}.{' '}
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-words">
            {pdfUrl}
          </a>
        )}
      </>
    );
  };
  const getMlaText = () => {
    const authors = authorsArray.length
      ? formatMLAAuthors(authorsArray)
      : 'Unknown author';
    const title = article?.titulo || 'Untitled';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);
    return `${authors}. "${title}." ${journalFormal}, vol. ${volume}, no. ${number}, ${year}, pp. ${pages}. ${pdfUrl || ''}`;
  };
  const getMlaHtml = () => {
    const authors = authorsArray.length
      ? formatMLAAuthors(authorsArray)
      : 'Unknown author';
    const title = article?.titulo || 'Untitled';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);
    return `${authors}. &ldquo;${title}.&rdquo; <em>${journalFormal}</em>, vol. ${volume}, no. ${number}, ${year}, pp. ${pages}. ${pdfUrl ? `<a href="${pdfUrl}">${pdfUrl}</a>` : ''}`;
  };
  const handleAuthorClick = (authorName) => {
    if (!authorName) return;
    const slug = generateSlug(authorName);
    window.location.href = `/team/${slug}EN.html`;
  };
  const copyChicago = async (e) => {
    e.stopPropagation();
    const html = getChicagoHtml();
    const plain = getChicagoText();
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ]);
      setCopiedChicago(true);
      setTimeout(() => setCopiedChicago(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };
  const copyApa = async (e) => {
    e.stopPropagation();
    const html = getApaHtml();
    const plain = getApaText();
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ]);
      setCopiedApa(true);
      setTimeout(() => setCopiedApa(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };
  const copyMla = async (e) => {
    e.stopPropagation();
    const html = getMlaHtml();
    const plain = getMlaText();
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ]);
      setCopiedMla(true);
      setTimeout(() => setCopiedMla(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };
  const toggleExpand = (e) => {
    const tag = e.target.tagName.toLowerCase();
    const isInteractive =
      ['a', 'button', 'span'].includes(tag) || e.target.closest('a, button, span');
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
      className={`py-4 px-4 sm:px-6 bg-white hover:bg-gray-50 transition-colors duration-200 cursor-pointer border-b border-gray-200 last:border-b-0 ${
        isExpanded ? 'bg-gray-50' : ''
      }`}
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
        {authorsArray.length > 0 ? (
          authorsArray.map((a, idx) => (
            <React.Fragment key={idx}>
              <span
                className="cursor-pointer hover:text-blue-600 underline transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAuthorClick(a);
                }}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAuthorClick(a);
                }}
                aria-label={`View profile of ${a}`}
              >
                {a}
              </span>
              {idx < authorsArray.length - 1 ? '; ' : ''}
            </React.Fragment>
          ))
        ) : (
          'Unknown author'
        )}
      </p>
      <p className="text-xs text-green-600">
        {journalDisplay} · {getYear(article.fecha)} {pages && `· pp. ${pages}`}
      </p>
      {!isExpanded && article.englishAbstract && (
        <p className="text-sm text-gray-700 mt-2 line-clamp-3">{article.englishAbstract}</p>
      )}
      {isExpanded && (
        <div className="mt-4 space-y-4 animate-fade-in">
          <p className="text-sm text-gray-800">
            <strong className="font-medium">Publication Date:</strong>{' '}
            {parseDateFlexible(article.fecha)}
          </p>
          {article.area ? (
            <div className="text-sm text-gray-800">
              <strong className="font-medium">Thematic Area:</strong>{' '}
              <div className="flex flex-wrap gap-2 mt-1">
                {article.area.split(';').map((area, idx) => (
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
              <strong className="font-medium">Thematic Area:</strong> Not specified
            </p>
          )}
          <p className="text-sm text-gray-800">
            <strong className="font-medium">Keywords:</strong>
          </p>
          {article.keywords_english?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {article.keywords_english.map((kw, idx) => (
                <span
                  key={idx}
                  className="bg-blue-100 text-blue-800 text-xs font-medium px-3 py-1 rounded-full shadow-sm"
                >
                  {kw.trim()}
                </span>
              ))}
            </div>
          )}
          <p className="text-sm text-gray-800">
            <strong className="font-medium">Abstract: </strong>
            {article.englishAbstract ? (
              <>
                {showFullAbstract
                  ? article.englishAbstract
                  : `${article.englishAbstract.slice(0, 200)}...`}
                {article.englishAbstract.length > 200 && (
                  <button
                    className="ml-2 text-blue-600 hover:text-blue-800 underline text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFullAbstract(!showFullAbstract);
                    }}
                  >
                    {showFullAbstract ? 'Read less' : 'Read more'}
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
              onClick={(e) => {
                e.stopPropagation();
                setShowSpanishAbstract(!showSpanishAbstract);
              }}
            >
              {showSpanishAbstract ? 'Hide Spanish abstract' : 'View Spanish abstract'}
            </button>
            {showSpanishAbstract && (
              <p className="text-sm text-gray-800 mt-2 bg-white p-3 rounded-lg shadow-inner">
                {article.resumen || 'Resumen no disponible'}
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
            onClick={(e) => {
              e.stopPropagation();
              setShowCitations(!showCitations);
            }}
          >
            {showCitations ? 'Hide citations' : 'How to cite this article'}
          </button>
          {showCitations && (
            <div className="text-gray-800 text-sm space-y-4 bg-white p-4 rounded-lg shadow-inner break-words">
              <div className="flex justify-between items-start">
                <p>
                  <strong className="font-medium">Chicago:</strong> {getChicagoCitation()}
                </p>
                <button
                  className="ml-4 px-3 py-1 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-xs shadow"
                  onClick={copyChicago}
                >
                  {copiedChicago ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="flex justify-between items-start">
                <p>
                  <strong className="font-medium">APA:</strong> {getApaCitation()}
                </p>
                <button
                  className="ml-4 px-3 py-1 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-xs shadow"
                  onClick={copyApa}
                >
                  {copiedApa ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="flex justify-between items-start">
                <p>
                  <strong className="font-medium">MLA:</strong> {getMlaCitation()}
                </p>
                <button
                  className="ml-4 px-3 py-1 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-xs shadow"
                  onClick={copyMla}
                >
                  {copiedMla ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default ArticleCardEN;