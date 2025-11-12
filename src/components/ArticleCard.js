import React, { useState } from 'react';

// Helper functions
const getYear = (date) => {
  if (!date) return 'Desconocido';
  const parsedDate = new Date(date);
  return isNaN(parsedDate) ? 'Desconocido' : parsedDate.getFullYear();
};

const parseDateFlexible = (date) => {
  if (!date) return 'No disponible';
  const parsedDate = new Date(date);
  return isNaN(parsedDate) ? date : parsedDate.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
};

// Slug que conserva letras con tilde → las normaliza sin eliminarlas
const generateSlug = (name) => {
  if (!name) return '';

  const normalized = name
    .normalize('NFD') // Descompone acentos: á → a + ◌́
    .replace(/[\u0300-\u036f]/g, '') // Elimina marcas diacríticas
    .replace(/ñ/gi, 'n') // ñ → n
    .replace(/Ñ/gi, 'N'); // Ñ → N

  return normalized
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Espacios → guión
    .replace(/[^a-z0-9-]/g, '')     // Solo letras, números y guiones
    .replace(/-+/g, '-')            // Evita guiones múltiples
    .replace(/^-+|-+$/g, '');       // Quita guiones al inicio/final
};

function ArticleCard({ article }) {
  console.log('Objeto article recibido:', article);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCitations, setShowCitations] = useState(false);
  const [showFullAbstract, setShowFullAbstract] = useState(false);
  const [showEnglishAbstract, setShowEnglishAbstract] = useState(false);

  const journal = 'Revista Nacional de las Ciencias para Estudiantes';
  const pdfUrl = article?.pdf || null;
  const htmlUrl = article?.numeroArticulo
    ? `https://www.revistacienciasestudiantes.com/articles/article-${generateSlug(article.titulo)}-${article.numeroArticulo}.html`
    : null;
  const pages = `${article?.primeraPagina || ''}-${article?.ultimaPagina || ''}`.trim() || '';

  const handleAuthorClick = (authorName) => {
    if (!authorName) return;
    const slug = generateSlug(authorName);
    window.location.href = `/team/${slug}.html`;
  };

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

  const toggleExpand = (e) => {
    const tag = e.target.tagName.toLowerCase();
    const isInteractive = ['a', 'button', 'span'].includes(tag) || e.target.closest('a, button, span');
    if (!isInteractive) {
      setIsExpanded(!isExpanded);
    }
  };

  if (!article || Object.keys(article).length === 0) {
    return (
      <div className="py-6 px-4 sm:px-6 border-b border-gray-200 last:border-b-0">
        <p className="text-center text-gray-500 font-medium">No se encontraron datos para este artículo.</p>
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
      aria-label={`Expandir artículo: ${article.titulo || 'Sin título'}`}
    >
      <h2 className="text-lg sm:text-xl font-semibold text-blue-700 hover:text-blue-800 transition-colors mb-2">
        {article.titulo || 'Sin título'}
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
                aria-label={`Ver perfil de ${a.trim()}`}
              >
                {a.trim()}
              </span>
              {idx < arr.length - 1 ? '; ' : ''}
            </React.Fragment>
          ))
        ) : (
          'Autor desconocido'
        )}
      </p>
      <p className="text-xs text-green-600">
        {journal} · {getYear(article.fecha)} {pages && `· pp. ${pages}`}
      </p>

      {!isExpanded && article.resumen && (
        <p className="text-sm text-gray-700 mt-2 line-clamp-3">
          {article.resumen}
        </p>
      )}

      {isExpanded && (
        <div className="mt-4 space-y-4 animate-fade-in">
          <p className="text-sm text-gray-800">
            <strong className="font-medium">Fecha:</strong> {parseDateFlexible(article.fecha)}
          </p>

          {article.area ? (
            <div className="text-sm text-gray-800">
              <strong className="font-medium">Áreas:</strong>{' '}
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
              <strong className="font-medium">Área:</strong> No especificada
            </p>
          )}

          <p className="text-sm text-gray-800">
            <strong className="font-medium">Palabras Clave:</strong>
          </p>
          {article.palabras_clave && article.palabras_clave.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {article.palabras_clave.map((kw, idx) => (
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
            <strong className="font-medium">Resumen: </strong>
            {article.resumen ? (
              <>
                {showFullAbstract ? article.resumen : `${article.resumen.slice(0, 200)}...`}
                {article.resumen.length > 200 && (
                  <button
                    className="ml-2 text-blue-600 hover:text-blue-800 underline text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
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
              className="text-blue-600 hover:text-blue-800 underline text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              onClick={(e) => { e.stopPropagation(); setShowEnglishAbstract(!showEnglishAbstract); }}
            >
              {showEnglishAbstract ? 'Ocultar abstract en inglés' : 'Ver abstract en inglés'}
            </button>
            {showEnglishAbstract && (
              <p className="text-sm text-gray-800 mt-2 bg-white p-3 rounded-lg shadow-inner">
                {article.englishAbstract || 'Abstract no disponible'}
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
                  Abrir PDF
                </a>
                <a
                  href={pdfUrl}
                  download
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm shadow"
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
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm shadow"
                onClick={(e) => e.stopPropagation()}
              >
                Abrir página completa
              </a>
            )}
          </div>

          <button
            className="text-brown-800 hover:text-brown-900 underline text-sm focus:outline-none focus:ring-2 focus:ring-brown-500 rounded"
            onClick={(e) => { e.stopPropagation(); setShowCitations(!showCitations); }}
          >
            {showCitations ? 'Ocultar citas' : 'Cómo citar este artículo'}
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

export default ArticleCard;
