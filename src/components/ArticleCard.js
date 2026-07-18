import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Helper functions
const getYear = (date) => {
  if (!date) return 'Desconocido';
  const parsedDate = new Date(date + 'T12:00:00Z');
  return isNaN(parsedDate) ? 'Desconocido' : parsedDate.getUTCFullYear();
};

const parseDateFlexible = (date) => {
  if (!date) return 'No disponible';
  const parsedDate = new Date(date + 'T12:00:00Z');
  if (isNaN(parsedDate)) return date;
  
  return parsedDate.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
};

const generateSlug = (name) => {
  if (!name) return '';
  let slug = name.toLowerCase();
  slug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  slug = slug.replace(/\.(?=[a-z]|\s)/g, '-');
  slug = slug.replace(/[^a-z0-9]+/g, '-');
  slug = slug.replace(/-+/g, '-');
  slug = slug.replace(/^-+|-+$/g, '');
  return slug;
};

// Validar y formatear enlace DOI
const formatDOI = (doi) => {
  if (!doi) return null;
  const cleanDoi = String(doi).trim();
  if (cleanDoi.startsWith('http')) return cleanDoi;
  if (cleanDoi.startsWith('doi.org/')) return `https://${cleanDoi}`;
  return `https://doi.org/${cleanDoi}`;
};

// Limpiar texto visual del DOI (para mostrar solo el identificador si se desea, o la URL corta)
const displayDOI = (doi) => {
  if (!doi) return null;
  return formatDOI(doi).replace('https://', '');
};

/* -------------------------- FORMATOS DE AUTORES -------------------------- */
const getAuthorNames = (autores) => {
  if (!autores) return [];
  if (typeof autores === 'string') {
    return autores.split(';').map(a => a.trim()).filter(a => a);
  }
  if (Array.isArray(autores)) {
    return autores.map(author => {
      if (typeof author === 'string') return author;
      if (author.name) return author.name;
      if (author.firstName || author.lastName) {
        return `${author.firstName || ''} ${author.lastName || ''}`.trim();
      }
      return '';
    }).filter(Boolean);
  }
  return [];
};

const getAuthorsArray = (autores) => {
  if (!autores) return [];
  if (typeof autores === 'string') {
    return autores.split(';').map(a => ({ 
      name: a.trim(),
      authorId: null,
      email: null,
      institution: null,
      orcid: null
    }));
  }
  if (Array.isArray(autores)) {
    return autores.map(author => {
      if (typeof author === 'string') {
        return { 
          name: author,
          authorId: null,
          email: null,
          institution: null,
          orcid: null
        };
      }
      return author; 
    });
  }
  return [];
};

const chicagoAuthors = (authors) => {
  const names = getAuthorNames(authors);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names[0]}, et al.`;
};

const apaFormatName = (fullName) => {
  const parts = fullName.trim().split(' ');
  if (parts.length < 2) return fullName;
  const last = parts.pop();
  const initials = parts.map((p) => p[0].toUpperCase() + '.').join(' ');
  return `${last}, ${initials}`;
};

const apaAuthors = (authors) => {
  const names = getAuthorNames(authors);
  const formatted = names.map(apaFormatName);
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} & ${formatted[1]}`;
  return formatted.slice(0, -1).join(', ') + ', & ' + formatted[formatted.length - 1];
};

const mlaAuthors = (authors) => {
  const names = getAuthorNames(authors);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names[0]}, et al.`;
};

const renderAuthorsWithIcons = (authors, language = 'es') => {
  const authorsArray = getAuthorsArray(authors);
  
  return authorsArray.map((author, i) => {
    const name = author.name || `${author.firstName || ''} ${author.lastName || ''}`.trim();
    const slug = generateSlug(name);
    
    return (
      <span key={i} className="inline-flex items-center gap-1">
        <span
          onClick={(e) => { e.stopPropagation(); window.location.href = `/team/${slug}.html`; }}
          className="text-gray-800 hover:text-[#007398] hover:underline cursor-pointer font-medium"
        >
          {name}
        </span>
        
        {author.orcid && (
          <a
            href={`https://orcid.org/${author.orcid}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-block ml-0.5 text-[#A6CE39] hover:opacity-80"
            title="ORCID"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 256 256">
              <circle cx="128" cy="128" r="120" fill="currentColor"/>
              <g fill="#FFFFFF">
                <rect x="71" y="78" width="17" height="102"/>
                <circle cx="79.5" cy="56" r="11"/>
                <path d="M103 78 v102 h41.5 c28.2 0 51-22.8 51-51 s-22.8-51-51-51 H103 zm17 17 h24.5 c18.8 0 34 15.2 34 34 s-15.2 34-34 34 H120 V95 z" fillRule="evenodd"/>
              </g>
            </svg>
          </a>
        )}
        
        {author.email && (
          <a
            href={`mailto:${author.email}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-block ml-0.5 text-gray-400 hover:text-[#007398]"
            title="Email"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          </a>
        )}
        
        {i < authorsArray.length - 1 && <span className="text-gray-400 mr-1">,</span>}
      </span>
    );
  });
};
/* -------------------------------------------------------------------------- */

function ArticleCard({ article }) {
  console.log('Objeto article recibido:', article);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCitations, setShowCitations] = useState(false);
  const [showEnglishAbstract, setShowEnglishAbstract] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState(null);

  const journal = 'Revista Nacional de las Ciencias para Estudiantes';
  const articleSlug = article?.permalink || `${generateSlug(article?.titulo || '')}-${article?.numeroArticulo || ''}`;
  
  const pdfUrl = article?.pdfUrl || article?.pdf || '';
  const doiUrl = formatDOI(article?.doi);
  const doiDisplay = displayDOI(article?.doi);
  
  const htmlUrlEs = `/articles/article-${articleSlug}.html`;
  const htmlUrlEn = `/articles/article-${articleSlug}EN.html`;
  
  const pages = `${article?.primeraPagina || ''}-${article?.ultimaPagina || ''}`.trim() || '';

  /* --------------------------- CITAS COMPLETAS ---------------------------- */
  const getChicago = () => {
    const authorsRaw = article?.autores || '';
    const title = article?.titulo || 'Sin título';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);
    const plain = `${chicagoAuthors(authorsRaw)}. "${title}." ${journal} ${volume}, no. ${number} (${year}): ${pages}.`;
    const html = `${chicagoAuthors(authorsRaw)}. "${title}." <i>${journal}</i> ${volume}, no. ${number} (${year}): ${pages}.`;
    return { plain, html };
  };

  const getApa = () => {
    const authorsRaw = article?.autores || '';
    const title = article?.titulo || 'Sin título';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);
    const plain = `${apaAuthors(authorsRaw)} (${year}). ${title}. ${journal}, ${volume}(${number}), ${pages}.`;
    const html = `${apaAuthors(authorsRaw)} (${year}). ${title}. <i>${journal}</i>, <i>${volume}</i>(${number}), ${pages}.`;
    return { plain, html };
  };

  const getMla = () => {
    const authorsRaw = article?.autores || '';
    const title = article?.titulo || 'Sin título';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);
    const plain = `${mlaAuthors(authorsRaw)}. "${title}." ${journal}, vol. ${volume}, no. ${number}, ${year}, pp. ${pages}.`;
    const html = `${mlaAuthors(authorsRaw)}. "${title}." <i>${journal}</i>, vol. ${volume}, no. ${number}, ${year}, pp. ${pages}.`;
    return { plain, html };
  };
  /* ----------------------------------------------------------------------- */

  const copyToClipboard = async (plain, html, format) => {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([plain], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        }),
      ]);
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch (err) {
      console.error('Error al copiar: ', err);
    }
  };

  const toggleExpand = (e) => {
    const tag = e.target.tagName.toLowerCase();
    // Incluye 'svg' y 'path' para evitar que el clic en iconos expanda el artículo
    const isInteractive = ['a', 'button', 'span', 'svg', 'path'].includes(tag) || e.target.closest('a, button');
    if (!isInteractive) {
      setIsExpanded(!isExpanded);
    }
  };

  if (!article || Object.keys(article).length === 0) {
    return (
      <motion.article
        className="py-8 md:py-10 border-b border-gray-200 last:border-0 group transition-colors hover:bg-gray-50/40 px-2 sm:px-6"
        layout
      >
        <p className="text-center text-gray-500 font-medium">No se encontraron datos para este artículo.</p>
      </motion.article>
    );
  }

  const tipo = article.tipo || 'Artículo de Investigación';
  const abstractToShow = article?.resumen || article?.abstract || 'Resumen no disponible';

  /* --------------------------- RENDER PRINCIPAL --------------------------- */
  return (
    <motion.article 
      layout 
      onClick={toggleExpand}
      className="py-8 md:py-10 border-b border-gray-200 last:border-0 group transition-colors hover:bg-gray-50/40 px-2 sm:px-6 cursor-pointer"
    >
      <div className="flex flex-col gap-3">
        
        {/* Encabezado de Metadatos (Academic Style) */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-widest font-semibold text-gray-500">
          
          {/* Logo Open Access en línea perfectamente alineado */}
          <div title="Open Access" className="flex items-center text-[#f68212]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-auto flex-shrink-0" viewBox="70 30 540 300">
              <g transform="matrix(1.25 0 0 -1.25 0 360)">
                <defs>
                  <path id="oa-bg" d="M-90-36h900v360H-90z"/>
                </defs>
                <clipPath id="oa-clip">
                  <use href="#oa-bg" overflow="visible"/>
                </clipPath>
                <g clipPath="url(#oa-clip)">
                  <path d="M720-3H0v294.285h720V-3z" fill="#fff"/>
                  <path d="M262.883 200.896v-8.846h25.938v8.846c0 21.412 17.421 38.831 38.831 38.831 21.409 0 38.829-17.419 38.829-38.831v-63.985h25.939v63.985c0 35.713-29.056 64.769-64.768 64.769-35.711 0-64.769-29.056-64.769-64.769M349.153 99.568c0-11.816-9.58-21.396-21.399-21.396-11.818 0-21.398 9.58-21.398 21.396 0 11.823 9.58 21.404 21.398 21.404 11.819 0 21.399-9.581 21.399-21.404" fill="currentColor"/>
                  <path d="M277.068 99.799c0 27.811 22.627 50.436 50.438 50.436 27.809 0 50.433-22.625 50.433-50.436 0-27.809-22.624-50.438-50.433-50.438-27.811.001-50.438 22.63-50.438 50.438m-25.938 0c0-42.109 34.265-76.373 76.375-76.373 42.111 0 76.373 34.265 76.373 76.373 0 42.113-34.262 76.375-76.373 76.375-42.11 0-76.375-34.262-76.375-76.375" fill="currentColor"/>
                </g>
              </g>
            </svg>
          </div>

          <span className="text-[#007398]">{tipo}</span>
          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
          <span>Vol. {article.volumen}, No. {article.numero}</span>
          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
          <span>{getYear(article.fecha)}</span>
        </div>

        {/* Título: Elegante, Serif, Gran Tamaño */}
        <a 
          href={htmlUrlEs} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="block w-full max-w-4xl mt-1"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="font-serif text-xl md:text-3xl text-gray-900 leading-snug font-medium transition-colors hover:text-[#007398]">
            {article.titulo}
          </h3>
        </a>

        {/* Autores y DOI */}
        <div className="flex flex-col gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-wrap items-center gap-x-1 text-sm md:text-base text-gray-700">
            {renderAuthorsWithIcons(article?.autores)}
          </div>
          
          {/* DOI Visible debajo de los autores (Estilo Académico) */}
          {doiUrl && (
            <a 
              href={doiUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-[13px] font-medium text-gray-500 hover:text-[#007398] transition-colors inline-flex items-center gap-1 w-fit"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              {doiDisplay}
            </a>
          )}
        </div>

        {/* Resumen recortado (vista colapsada) */}
        {!isExpanded && (
          <p className="font-serif text-gray-600 text-sm md:text-base leading-relaxed line-clamp-3 max-w-5xl mt-2">
            {abstractToShow}
          </p>
        )}

        {/* Botones de acción en línea (Estilo T&F) */}
        <div className="flex flex-wrap items-center gap-6 mt-4 pt-2" onClick={(e) => e.stopPropagation()}>
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-semibold text-[#007398] hover:text-[#005a77] transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              Descargar PDF
            </a>
          )}
          <a href={htmlUrlEs} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-[#007398] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            Ver Texto Completo
          </a>
          {article.tituloEnglish && (
            <a href={htmlUrlEn} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#007398] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m0 4v2" /></svg>
              English Version
            </a>
          )}
          <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors ml-auto">
            {isExpanded ? 'Menos detalles' : 'Más detalles'}
            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>

        {/* Contenido Expandible: Diseño académico limpio */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: 'auto', opacity: 1 }} 
              exit={{ height: 0, opacity: 0 }} 
              className="overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mt-6 pt-6 border-t border-gray-200">
                
                {/* Fechas en línea plana (Academic string) */}
                <div className="flex flex-wrap items-center text-xs text-gray-500 font-medium tracking-wide mb-6">
                  {article.receivedDate && <span>Recibido: {parseDateFlexible(article.receivedDate)} <span className="mx-2 text-gray-300">|</span> </span>}
                  {article.acceptedDate && <span>Aceptado: {parseDateFlexible(article.acceptedDate)} <span className="mx-2 text-gray-300">|</span> </span>}
                  <span>Publicado: {parseDateFlexible(article.fecha)}</span>
                  <span className="mx-2 text-gray-300">|</span>
                  <span>Páginas: {pages || 'N/A'}</span>
                  <span className="mx-2 text-gray-300">|</span>
                  <span>ISSN 3087-2839</span>
                  {doiUrl && (
                    <>
                      <span className="mx-2 text-gray-300">|</span>
                      <span>DOI: <a href={doiUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[#007398] hover:underline">{article.doi}</a></span>
                    </>
                  )}
                </div>

                <div className="max-w-4xl">
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Abstract</h4>
                  <p className="text-base text-gray-800 leading-relaxed font-serif text-justify mb-6">
                    {abstractToShow}
                  </p>

                  {article.abstract && article.abstract !== article.resumen && (
                    <div className="mb-6">
                      <button 
                        onClick={() => setShowEnglishAbstract(!showEnglishAbstract)} 
                        className="text-[#007398] text-xs font-bold uppercase tracking-wider hover:underline flex items-center gap-1"
                      >
                        {showEnglishAbstract ? 'Ocultar Abstract Original' : 'Leer Abstract en Inglés'}
                      </button>
                      {showEnglishAbstract && (
                        <p className="mt-3 text-base text-gray-600 font-serif leading-relaxed text-justify">
                          {article.abstract}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Keywords limpios, sin cajas */}
                  {article.palabras_clave && article.palabras_clave.length > 0 && (
                    <div className="mb-6 text-sm">
                      <span className="font-bold text-gray-900 mr-2">Palabras clave:</span>
                      <span className="text-gray-700 italic">{article.palabras_clave.join(', ')}</span>
                    </div>
                  )}

                  {/* Keywords en inglés si existen */}
                  {article.keywords_english && article.keywords_english.length > 0 && (
                    <div className="mb-6 text-sm">
                      <span className="font-bold text-gray-900 mr-2">Keywords:</span>
                      <span className="text-gray-700 italic">{article.keywords_english.join(', ')}</span>
                    </div>
                  )}

                  {/* Información adicional (opcional) */}
                  {(article.funding || article.conflicts) && (
                    <div className="mb-6 text-sm text-gray-600">
                      {article.funding && (
                        <p className="mb-1"><strong className="text-gray-900">Financiación:</strong> {article.funding}</p>
                      )}
                      {article.conflicts && (
                        <p><strong className="text-gray-900">Conflictos de interés:</strong> {article.conflicts}</p>
                      )}
                    </div>
                  )}

                  {/* Botón para Citar */}
                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <button 
                      onClick={() => setShowCitations(!showCitations)} 
                      className="px-4 py-2 bg-gray-100 text-gray-800 text-xs font-bold uppercase tracking-wider hover:bg-gray-200 transition-colors flex items-center gap-2 rounded-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                      Citar este artículo
                    </button>

                    {showCitations && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        className="mt-4 bg-gray-50 border border-gray-200 p-5 rounded-sm space-y-5"
                      >
                        {[
                          { label: 'APA', ...getApa() },
                          { label: 'MLA', ...getMla() },
                          { label: 'Chicago', ...getChicago() }
                        ].map((cite) => (
                          <div key={cite.label} className="border-b border-gray-200 pb-4 last:border-0 last:pb-0">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{cite.label}</span>
                              <button 
                                onClick={() => copyToClipboard(cite.plain, cite.html, cite.label)} 
                                className="text-[#007398] text-xs font-bold hover:underline"
                              >
                                {copiedFormat === cite.label ? 'COPIADO' : 'COPIAR'}
                              </button>
                            </div>
                            <p className="text-sm text-gray-800 font-serif leading-relaxed" dangerouslySetInnerHTML={{ __html: cite.html }} />
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

export default ArticleCard;