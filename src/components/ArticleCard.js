function ArticleCard({ article }) {
  console.log('Objeto article recibido:', article);

  const [isExpanded, setIsExpanded] = useState(false);
  const [showCitations, setShowCitations] = useState(false);
  const [showFullAbstract, setShowFullAbstract] = useState(false);
  const [showEnglishAbstract, setShowEnglishAbstract] = useState(false);

  const journal = 'Revista Nacional de las Ciencias para Estudiantes';
  const pdfUrl = article?.['Número de artículo']
    ? `https://www.revistacienciasestudiantes.com/Articles/Articulo${article['Número de artículo']}.pdf`
    : null;

  const htmlUrl = article?.['Número de artículo']
    ? `https://www.revistacienciasestudiantes.com/articles/articulo${article['Número de artículo']}.html`
    : null;

  const pages = `${article?.['Primera página'] || ''}-${article?.['Última página'] || ''}`.trim() || '';

  const handleAuthorClick = (authorName) => {
    if (!authorName) return;
    const slug = generateSlug(authorName);
    window.location.href = `/team/${slug}.html`;
  };

  const getChicagoCitation = () => {
    const authors = article?.['Autor(es)']?.split(';').map(a => a.trim()).join('; ') || 'Autor desconocido';
    const title = article?.['Título'] || 'Sin título';
    const volume = article?.['Volumen'] || '';
    const number = article?.['Número'] || '';
    const year = getYear(article?.['Fecha']);

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
    const authors = article?.['Autor(es)']?.split(';').map(a => a.trim()).join('; ') || 'Autor desconocido';
    const title = article?.['Título'] || 'Sin título';
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
    const authors = article?.['Autor(es)']?.split(';').map(a => a.trim()).join('; ') || 'Autor desconocido';
    const title = article?.['Título'] || 'Sin título';
    const volume = article?.['Volumen'] || '';
    const number = article?.['Número'] || '';
    const year = getYear(article?.['Fecha']);

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

  const toggleExpand = (e) => {
    if (e.target.tagName !== 'A' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SPAN') {
      setIsExpanded(!isExpanded);
    }
  };

  if (!article || Object.keys(article).length === 0) {
    return (
      <div className="border-b border-gray-200 py-4">
        No se encontraron datos para este artículo.
      </div>
    );
  }

  return (
    <div
      className={`border-b border-gray-200 py-4 px-4 sm:px-6 hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-100' : ''}`}
      onClick={toggleExpand}
    >
      <h2 className="text-base sm:text-lg font-medium text-blue-600 hover:underline mb-1">
        {article['Título'] || 'Sin título'}
      </h2>

      <p className="text-sm text-gray-700 mb-1">
        {article['Autor(es)'] ? (
          article['Autor(es)'].split(';').map((a, idx, arr) => (
            <span
              key={idx}
              className="cursor-pointer hover:text-blue-500 underline"
              onClick={(e) => { e.stopPropagation(); handleAuthorClick(a.trim()); }}
            >
              {a.trim()}
              {idx < arr.length - 1 ? '; ' : ''}
            </span>
          ))
        ) : (
          'Autor desconocido'
        )}
      </p>

      <p className="text-sm text-gray-500">
        {journal} · {getYear(article['Fecha'])} · {pages && `pp. ${pages}`}
      </p>

      {isExpanded && (
        <div className="mt-4 space-y-4 animate-fadeIn">
          <p className="text-sm text-gray-700">
            <strong>Fecha:</strong> {parseDateFlexible(article['Fecha'])}
          </p>
          <p className="text-sm text-gray-700">
            <strong>Área:</strong> {article['Área temática'] || 'No especificada'}
          </p>

          {article['Palabras clave'] && (
            <div className="flex flex-wrap gap-2">
              {article['Palabras clave']
                .split(/[;,]/)
                .map((k) => k.trim())
                .filter(Boolean)
                .map((kw, idx) => (
                  <span
                    key={idx}
                    className="bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded-full"
                  >
                    {kw}
                  </span>
                ))}
            </div>
          )}

          <p className="text-sm text-gray-700">
            <strong>Resumen: </strong>
            {article['Resumen'] ? (
              <>
                {showFullAbstract ? article['Resumen'] : `${article['Resumen'].slice(0, 200)}...`}
                {article['Resumen'].length > 200 && (
                  <button
                    className="ml-2 text-blue-500 hover:underline text-xs"
                    onClick={(e) => { e.stopPropagation(); setShowFullAbstract(!showFullAbstract); }}
                  >
                    {showFullAbstract ? 'Leer menos' : 'Leer más'}
                  </button>
                )}
              </>
            ) : (
              'Resumen no disponible'
            )}
          </p>

          <div>
            <button
              className="text-blue-500 hover:underline text-xs"
              onClick={(e) => { e.stopPropagation(); setShowEnglishAbstract(!showEnglishAbstract); }}
            >
              {showEnglishAbstract ? 'Ocultar abstract en inglés' : 'Ver abstract en inglés'}
            </button>
            {showEnglishAbstract && (
              <p className="text-sm text-gray-700 mt-2">
                {article['Abstract'] || 'Abstract no disponible'}
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
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  Abrir PDF
                </a>
                <a
                  href={pdfUrl}
                  download
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  Descargar PDF
                </a>
              </>
            )}
            {htmlUrl && (
              <a
                href={htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                Abrir página completa
              </a>
            )}
          </div>

          <button
            className="text-brown-800 hover:text-brown-700 text-sm focus:outline-none"
            onClick={(e) => { e.stopPropagation(); setShowCitations(!showCitations); }}
          >
            {showCitations ? 'Ocultar citas' : 'Cómo citar este artículo'}
          </button>
          {showCitations && (
            <div className="text-gray-700 text-sm space-y-3 break-words">
              <p><strong>Chicago:</strong> {getChicagoCitation()}</p>
              <p><strong>APA:</strong> {getApaCitation()}</p>
              <p><strong>MLA:</strong> {getMlaCitation()}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}