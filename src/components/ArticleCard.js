import React, { useState } from 'react';
import { motion } from 'framer-motion';

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
      <motion.div
        className="group relative bg-white border border-gray-100 rounded-xl p-6 mb-6 hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300"
        whileHover={{ y: -4 }}
      >
        <p className="text-center text-gray-500 font-medium">No se encontraron datos para este artículo.</p>
      </motion.div>
    );
  }

  /* --------------------------- RENDER PRINCIPAL --------------------------- */

  return (
    <motion.div
      className="group relative bg-white border border-gray-100 rounded-xl p-6 mb-6 hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300"
      whileHover={{ y: -4 }}
      onClick={toggleExpand}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-label={`Expandir artículo: ${article.titulo || 'Sin título'}`}
    >
      {/* Indicador lateral de color burdeos */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#52262d] rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div className="flex-1">
          {/* Metadatos superiores */}
          <div className="flex flex-wrap items-center gap-3 mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            <span className="text-[#52262d] bg-[#52262d]/5 px-2 py-0.5 rounded">
              {article.area}
            </span>
            <span>•</span>
            <span>{parseDateFlexible(article.fecha)}</span>
          </div>
          {/* Título */}
          <h3 className="text-xl md:text-2xl font-serif font-semibold text-gray-900 group-hover:text-[#52262d] transition-colors mb-2">
            {article.titulo}
          </h3>
          {/* Autores con estilo de link sutil */}
          <p className="text-sm text-gray-600 mb-4 font-medium">
            {article.autores.split(';').map((auth, i) => (
              <span 
                key={i} 
                className="hover:text-blue-600 cursor-pointer transition-colors"
                onClick={(e) => { e.stopPropagation(); handleAuthorClick(auth.trim()); }}
              >
                {auth.trim()}{i < article.autores.split(';').length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
        </div>
        {/* Botones de acción compactos laterales */}
        <div className="flex md:flex-col gap-2">
          <button 
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-all"
            onClick={(e) => { e.stopPropagation(); window.open(pdfUrl, '_blank'); }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            PDF
          </button>
          <button 
            className="px-4 py-2 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 transition-all"
            onClick={(e) => { e.stopPropagation(); setShowCitations(!showCitations); }}
          >
            Citar
          </button>
        </div>
      </div>
      {/* Resumen colapsable con fondo suave */}
      <div className="mt-4 pt-4 border-t border-gray-50">
        <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 italic">
          "{article.resumen}"
        </p>
        <button 
          className="mt-2 text-[#52262d] text-xs font-bold hover:underline"
          onClick={(e) => { e.stopPropagation(); setShowFullAbstract(!showFullAbstract); }}
        >
          Leer abstract completo →
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4 animate-fade-in">
          {/* Fecha */}
          <p className="text-sm text-gray-800">
            <strong className="font-medium">Fecha:</strong> {parseDateFlexible(article.fecha)}
          </p>

          {/* Áreas */}
          {article.area ? (
            <div className="text-sm text-gray-800">
              <strong className="font-medium">Áreas:</strong>{' '}
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
              <strong className="font-medium">Área:</strong> No especificada
            </p>
          )}

          {/* Palabras clave */}
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

          {/* Resumen */}
          <p className="text-sm text-gray-800">
            <strong className="font-medium">Resumen: </strong>
            {article.resumen ? (
              <>
                {showFullAbstract ? article.resumen : `${article.resumen.slice(0, 200)}...`}
                {article.resumen.length > 200 && (
                  <button
                    className="ml-2 text-blue-600 hover:text-blue-800 underline text-xs"
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

          {/* Abstract inglés */}
          <div>
            <button
              className="text-blue-600 hover:text-blue-800 underline text-xs"
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

          {/* Botones PDF / HTML */}
          <div className="flex flex-wrap gap-3">
            {pdfUrl && (
              <>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm shadow"
                  onClick={(e) => e.stopPropagation()}
                >
                  Abrir PDF
                </a>
                <a
                  href={pdfUrl}
                  download
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm shadow"
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
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm shadow"
                onClick={(e) => e.stopPropagation()}
              >
                Abrir página completa
              </a>
            )}
          </div>

          {/* Citas */}
          {showCitations && (
            <div className="text-gray-800 text-sm space-y-4 bg-white p-4 rounded-lg shadow-inner break-words">
              <div className="flex justify-between items-start">
                <p><strong>Chicago:</strong> {getChicagoCitation()}</p>
                <button
                  className="ml-4 px-3 py-1 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-xs shadow"
                  onClick={copyChicago}
                >
                  {copiedChicago ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
              <div className="flex justify-between items-start">
                <p><strong>APA:</strong> {getApaCitation()}</p>
                <button
                  className="ml-4 px-3 py-1 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-xs shadow"
                  onClick={copyApa}
                >
                  {copiedApa ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
              <div className="flex justify-between items-start">
                <p><strong>MLA:</strong> {getMlaCitation()}</p>
                <button
                  className="ml-4 px-3 py-1 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-xs shadow"
                  onClick={copyMla}
                >
                  {copiedMla ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default ArticleCard;