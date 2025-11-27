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
  return isNaN(parsedDate)
    ? date
    : parsedDate.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
};

// Slug generator
const generateSlug = (name) => {
  if (!name) return '';
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/gi, 'n')
    .replace(/Ñ/gi, 'N');

  return normalized
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/* --------------------------  FORMATOS DE AUTORES -------------------------- */

const chicagoAuthors = (authors) => {
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]}, y ${authors[1]}`;
  return `${authors[0]}, et al.`;
};

const apaFormatName = (fullName) => {
  const parts = fullName.trim().split(' ');
  const last = parts.pop();
  const initials = parts.map((p) => p[0].toUpperCase() + '.').join(' ');
  return `${last}, ${initials}`;
};

const apaAuthors = (authors) => {
  const formatted = authors.map(apaFormatName);
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} & ${formatted[1]}`;
  return formatted.slice(0, -1).join(', ') + ', & ' + formatted[formatted.length - 1];
};

const mlaAuthors = (authors) => {
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]}, y ${authors[1]}`;
  return `${authors[0]}, et al.`;
};

/* -------------------------------------------------------------------------- */

function ArticleCard({ article }) {
  console.log('Objeto article recibido:', article);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCitations, setShowCitations] = useState(false);
  const [showFullAbstract, setShowFullAbstract] = useState(false);
  const [showEnglishAbstract, setShowEnglishAbstract] = useState(false);
  const [copiedChicago, setCopiedChicago] = useState(false);
  const [copiedApa, setCopiedApa] = useState(false);
  const [copiedMla, setCopiedMla] = useState(false);

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

  /* --------------------------- CITAS COMPLETAS ---------------------------- */

  const getChicagoCitation = () => {
    const authorsRaw = article?.autores || '';
    const authors = authorsRaw.split(';').map(a => a.trim()).filter(a => a);
    const title = article?.titulo || 'Sin título';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);

    return (
      <>
        {chicagoAuthors(authors)}. “{title}.” <em>{journal}</em> {volume}, no. {number} ({year}): {pages}.{' '}
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-words">
            {pdfUrl}
          </a>
        )}
      </>
    );
  };

  const getChicagoText = () => {
    const authorsRaw = article?.autores || '';
    const authors = authorsRaw.split(';').map(a => a.trim()).filter(a => a);
    const title = article?.titulo || 'Sin título';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);

    return `${chicagoAuthors(authors)}. “${title}.” ${journal} ${volume}, no. ${number} (${year}): ${pages}. ${pdfUrl || ''}`;
  };

  const getChicagoHtml = () => {
    const authorsRaw = article?.autores || '';
    const authors = authorsRaw.split(';').map(a => a.trim()).filter(a => a);
    const title = article?.titulo || 'Sin título';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);

    return `${chicagoAuthors(authors)}. &ldquo;${title}.&rdquo; <em>${journal}</em> ${volume}, no. ${number} (${year}): ${pages}. ${pdfUrl ? `<a href="${pdfUrl}">${pdfUrl}</a>` : ''}`;
  };

  const getApaCitation = () => {
    const authorsRaw = article?.autores || '';
    const authors = authorsRaw.split(';').map(a => a.trim()).filter(a => a);
    const title = article?.titulo || 'Sin título';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);

    return (
      <>
        {apaAuthors(authors)} ({year}). {title}. <em>{journal}</em>, {volume}({number}), {pages}.{' '}
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-words">
            {pdfUrl}
          </a>
        )}
      </>
    );
  };

  const getApaText = () => {
    const authorsRaw = article?.autores || '';
    const authors = authorsRaw.split(';').map(a => a.trim()).filter(a => a);
    const title = article?.titulo || 'Sin título';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);

    return `${apaAuthors(authors)} (${year}). ${title}. ${journal}, ${volume}(${number}), ${pages}. ${pdfUrl || ''}`;
  };

  const getApaHtml = () => {
    const authorsRaw = article?.autores || '';
    const authors = authorsRaw.split(';').map(a => a.trim()).filter(a => a);
    const title = article?.titulo || 'Sin título';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);

    return `${apaAuthors(authors)} (${year}). ${title}. <em>${journal}</em>, ${volume}(${number}), ${pages}. ${pdfUrl ? `<a href="${pdfUrl}">${pdfUrl}</a>` : ''}`;
  };

  const getMlaCitation = () => {
    const authorsRaw = article?.autores || '';
    const authors = authorsRaw.split(';').map(a => a.trim()).filter(a => a);
    const title = article?.titulo || 'Sin título';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);

    return (
      <>
        {mlaAuthors(authors)}. “{title}.” <em>{journal}</em>, vol. {volume}, no. {number}, {year}, pp. {pages}.{' '}
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-words">
            {pdfUrl}
          </a>
        )}
      </>
    );
  };

  const getMlaText = () => {
    const authorsRaw = article?.autores || '';
    const authors = authorsRaw.split(';').map(a => a.trim()).filter(a => a);
    const title = article?.titulo || 'Sin título';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);

    return `${mlaAuthors(authors)}. “${title}.” ${journal}, vol. ${volume}, no. ${number}, ${year}, pp. ${pages}. ${pdfUrl || ''}`;
  };

  const getMlaHtml = () => {
    const authorsRaw = article?.autores || '';
    const authors = authorsRaw.split(';').map(a => a.trim()).filter(a => a);
    const title = article?.titulo || 'Sin título';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);

    return `${mlaAuthors(authors)}. &ldquo;${title}.&rdquo; <em>${journal}</em>, vol. ${volume}, no. ${number}, ${year}, pp. ${pages}. ${pdfUrl ? `<a href="${pdfUrl}">${pdfUrl}</a>` : ''}`;
  };

  /* ----------------------------------------------------------------------- */

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

  /* --------------------------- RENDER PRINCIPAL --------------------------- */

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
          {/* Fecha */}
          <p className="text-sm text-gray-800">
            <strong className="font-medium">Fecha:</strong> {parse
