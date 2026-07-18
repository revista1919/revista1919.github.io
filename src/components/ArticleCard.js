import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Helper functions
const getYear = (date) => {
  if (!date) return 'Desconocido';
  // Forzar UTC para evitar desfase horario
  const parsedDate = new Date(date + 'T12:00:00Z');
  return isNaN(parsedDate) ? 'Desconocido' : parsedDate.getUTCFullYear();
};

const parseDateFlexible = (date) => {
  if (!date) return 'No disponible';
  // Forzar UTC para evitar desfase horario
  const parsedDate = new Date(date + 'T12:00:00Z');
  if (isNaN(parsedDate)) return date;
  
  return parsedDate.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC' // Forzar UTC
  });
};

// Slug generator (consistente con el script Node.js)
// Slug generator (CORREGIDO)
const generateSlug = (name) => {
  if (!name) return '';
  
  // 1. Convertir a minúsculas
  let slug = name.toLowerCase();
  
  // 2. Eliminar tildes (esto ya funciona bien)
  slug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // 3. [NUEVO] Reemplazar puntos seguidos de letras o espacios por un guión
  //    Esto convertirá "ee.uu" en "ee-uu"
  slug = slug.replace(/\.(?=[a-z]|\s)/g, '-');
  
  // 4. Reemplazar cualquier otro carácter no deseado (incluyendo puntos sueltos restantes) por guiones
  //    Ahora los puntos ya se procesaron, este paso se encarga del resto.
  slug = slug.replace(/[^a-z0-9]+/g, '-');
  
  // 5. Eliminar guiones múltiples y guiones al principio o final
  slug = slug.replace(/-+/g, '-');
  slug = slug.replace(/^-+|-+$/g, '');
  
  return slug;
};

/* -------------------------- FORMATOS DE AUTORES -------------------------- */
// Obtener array de nombres de autores (para compatibilidad con funciones existentes)
const getAuthorNames = (autores) => {
  if (!autores) return [];
  
  // Si es string (formato antiguo), convertir a array
  if (typeof autores === 'string') {
    return autores.split(';').map(a => a.trim()).filter(a => a);
  }
  
  // Si es array de objetos (nuevo formato)
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

// Obtener array completo de objetos de autores
const getAuthorsArray = (autores) => {
  if (!autores) return [];
  
  // Si es string, convertir a objetos simples
  if (typeof autores === 'string') {
    return autores.split(';').map(a => ({ 
      name: a.trim(),
      authorId: null,
      email: null,
      institution: null,
      orcid: null
    }));
  }
  
  // Si ya es array, devolverlo
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
      return author; // Ya es objeto
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

const formatAuthorsDisplay = (authors, language = 'es') => {
  const names = getAuthorNames(authors);
  if (names.length === 0) return 'Autor desconocido';
  const connector = language === 'es' ? 'y' : 'and';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} ${connector} ${names[1]}`;
  return names.slice(0, -1).join(', ') + `, ${connector} ` + names[names.length - 1];
};

// Renderizar autores con iconos (ORCID, email)
const renderAuthorsWithIcons = (authors, language = 'es') => {
  const authorsArray = getAuthorsArray(authors);
  
  return authorsArray.map((author, i) => {
    const name = author.name || `${author.firstName || ''} ${author.lastName || ''}`.trim();
    const slug = generateSlug(name);
    
    return (
      <span key={i} className="inline-flex items-center text-[13px] md:text-sm text-[#002B49] font-medium mr-1.5">
        <span
          onClick={(e) => { e.stopPropagation(); window.location.href = `/team/${slug}.html`; }}
          className="hover:text-[#007398] hover:underline cursor-pointer transition-colors"
        >
          {name}
        </span>
        
        {/* ORCID Icon */}
        {author.orcid && (
          <a
            href={`https://orcid.org/${author.orcid}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-1 text-[#A6CE39] hover:opacity-80"
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
        
        {/* Email Icon */}
        {author.email && (
          <a
            href={`mailto:${author.email}`}
            onClick={(e) => e.stopPropagation()}
            className="ml-1 text-slate-400 hover:text-[#007398]"
            title="Email"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </a>
        )}
        
        {i < authorsArray.length - 1 && <span className="text-slate-400 ml-0.5">,</span>}
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
  // Usar permalink si existe, si no, generar el slug tradicional
  const articleSlug = article?.permalink || `${generateSlug(article?.titulo || '')}-${article?.numeroArticulo || ''}`;
  
  // Usar el pdfUrl directamente del artículo (tal como viene del JSON)
  const pdfUrl = article?.pdfUrl || article?.pdf || '';
  
  // URLs de las versiones HTML (consistentes con el script)
  const htmlUrlEs = `/articles/article-${articleSlug}.html`;
  const htmlUrlEn = `/articles/article-${articleSlug}EN.html`;
  
  const pages = `${article?.primeraPagina || ''}-${article?.ultimaPagina || ''}`.trim() || '';

  const handleAuthorClick = (authorName) => {
    if (!authorName) return;
    const slug = generateSlug(authorName);
    window.location.href = `/team/${slug}.html`;
  };

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
    const isInteractive = e.target.closest('a, button, .interactive-zone');
    if (!isInteractive) setIsExpanded(!isExpanded);
  };

  if (!article || Object.keys(article).length === 0) {
    return (
      <motion.div
        className="group relative bg-white border border-gray-200 rounded-sm p-6 mb-6 hover:shadow-md transition-all duration-300"
        layout
      >
        <p className="text-center text-gray-500 font-medium">No se encontraron datos para este artículo.</p>
      </motion.div>
    );
  }

  const authorsArray = getAuthorsArray(article?.autores);
  const tipo = article.tipo || 'Artículo de Investigación';

  // Determinar qué abstract mostrar
  const abstractToShow = article?.resumen || article?.abstract || 'Resumen no disponible';
  const englishAbstract = article?.abstract || article?.resumen || 'Abstract not available';

  /* --------------------------- RENDER PRINCIPAL --------------------------- */
  return (
    <article 
      onClick={toggleExpand}
      className={`group py-6 transition-colors duration-200 cursor-pointer ${isExpanded ? 'bg-[#F8FAFC]' : 'hover:bg-slate-50/50'}`}
    >
      <div className="px-2 md:px-6">
        
        {/* Metadatos Superiores */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-sans text-slate-500 mb-2.5">
          <span className="uppercase tracking-widest font-bold text-[#007398]">{article.area || 'Artículo'}</span>
          <span className="hidden sm:inline text-slate-300">|</span>
          <span className="uppercase tracking-wider">Vol. {article.volumen}, Núm. {article.numero} ({getYear(article.fecha)})</span>
          {pages && (
            <>
              <span className="hidden sm:inline text-slate-300">|</span>
              <span className="uppercase tracking-wider">pp. {pages}</span>
            </>
          )}
        </div>

        {/* Título Principal */}
        <a href={htmlUrlEs} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="interactive-zone block mb-2">
          <h3 className="font-serif text-xl md:text-[22px] font-semibold text-[#002B49] leading-snug group-hover:text-[#007398] transition-colors">
            {article.titulo}
          </h3>
        </a>

        {/* Autores */}
        <div className="mb-3 leading-relaxed interactive-zone">
          {renderAuthorsWithIcons(article?.autores)}
        </div>

        {/* Action Bar Rápido (Estado Colapsado) */}
        {!isExpanded && (
          <div className="flex items-center gap-4 mt-4 interactive-zone">
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-red-600 hover:text-red-700 transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M7 3v18h10V8l-5-5H7zm3 5h2v2h-2V8zm0 3h2v2h-2v-2zm0 3h2v2h-2v-2z" /></svg>
                PDF
              </a>
            )}
            <a href={htmlUrlEs} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#007398] hover:text-[#004B7F] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              HTML
            </a>
            <button onClick={() => setIsExpanded(true)} className="ml-auto text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-[#002B49] flex items-center gap-1">
              Ver Abstract <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>
        )}

        {/* Contenido Expandido */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden interactive-zone">
              <div className="pt-5 mt-4 border-t border-slate-200">
                
                {/* Abstract */}
                <div className="mb-6">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Resumen</h4>
                  <p className="text-sm md:text-[15px] text-slate-700 font-serif leading-relaxed text-justify">
                    {abstractToShow}
                  </p>
                  {article.abstract && article.abstract !== article.resumen && (
                    <div className="border-l-2 border-blue-100 pl-4 py-1 mt-4">
                      <button
                        onClick={() => setShowEnglishAbstract(!showEnglishAbstract)}
                        className="text-[#007398] text-[10px] font-bold uppercase tracking-tighter"
                      >
                        {showEnglishAbstract ? '↓ Ocultar Abstract' : '→ Read English Abstract'}
                      </button>
                      {showEnglishAbstract && (
                        <p className="mt-2 text-sm text-gray-600 italic font-serif leading-relaxed">
                          {article.abstract}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Keywords */}
                {article.palabras_clave && article.palabras_clave.length > 0 && (
                  <div className="mb-6 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mr-2">Palabras Clave:</span>
                    {article.palabras_clave.map((kw, idx) => (
                      <span key={idx} className="bg-white border border-slate-200 text-xs text-slate-600 px-2.5 py-1 rounded-full">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}

                {/* Keywords en inglés si existen */}
                {article.keywords_english && article.keywords_english.length > 0 && (
                  <div className="mb-6 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mr-2">Keywords:</span>
                    {article.keywords_english.map((kw, idx) => (
                      <span key={idx} className="bg-white border border-slate-200 text-xs text-slate-600 px-2.5 py-1 rounded-full">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}

                {/* Información adicional (opcional) */}
                {(article.funding || article.conflicts) && (
                  <div className="text-[10px] text-gray-500 mb-6">
                    {article.funding && (
                      <p><strong>Financiación:</strong> {article.funding}</p>
                    )}
                    {article.conflicts && (
                      <p className="mt-1"><strong>Conflictos de interés:</strong> {article.conflicts}</p>
                    )}
                  </div>
                )}

                {/* Fechas de recepción/aceptación si existen */}
                {(article.receivedDate || article.acceptedDate) && (
                  <div className="grid grid-cols-2 gap-4 text-[11px] md:text-sm mb-6">
                    {article.receivedDate && (
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="block text-gray-400 uppercase text-[9px] font-bold">Recibido</span>
                        <span className="font-medium">{parseDateFlexible(article.receivedDate)}</span>
                      </div>
                    )}
                    {article.acceptedDate && (
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="block text-gray-400 uppercase text-[9px] font-bold">Aceptado</span>
                        <span className="font-medium">{parseDateFlexible(article.acceptedDate)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Action Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200 p-4 rounded-sm shadow-sm">
                  <div className="flex gap-4">
                    {pdfUrl && (
                      <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-red-50 text-red-700 border border-red-100 hover:bg-red-100 text-[11px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2">
                        PDF Completo
                      </a>
                    )}
                    <a href={htmlUrlEs} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-[#F3F7F9] text-[#007398] border border-[#EBF4F7] hover:bg-[#EBF4F7] text-[11px] font-bold uppercase tracking-widest transition-colors">
                      HTML
                    </a>
                    {article.tituloEnglish && (
                      <a
                        href={htmlUrlEn}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-[#F3F7F9] text-gray-500 border border-gray-200 hover:bg-gray-100 text-[11px] font-bold uppercase tracking-widest transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        ENGLISH
                      </a>
                    )}
                    <button onClick={() => setShowCitations(!showCitations)} className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-[11px] font-bold uppercase tracking-widest transition-colors">
                      Citar
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                    ISSN 3087-2839
                  </span>
                </div>

                {/* Caja de Citaciones */}
                <AnimatePresence>
                  {showCitations && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-4 bg-[#F8FAFC] border border-slate-200 p-5 shadow-inner">
                      <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-200 pb-2">Formatos de Citación</h4>
                      <div className="space-y-5 text-sm font-serif">
                        {[{ label: 'APA', ...getApa() }, { label: 'MLA', ...getMla() }, { label: 'Chicago', ...getChicago() }].map((cite) => (
                          <div key={cite.label} className="group relative">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-sans font-bold text-[#002B49] text-xs">{cite.label}</span>
                              <button onClick={() => copyToClipboard(cite.plain, cite.html, cite.label)} className="text-[10px] uppercase font-bold tracking-widest text-[#007398] hover:text-[#004B7F] bg-white border border-[#007398]/20 px-2 py-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                {copiedFormat === cite.label ? 'Copiado ✓' : 'Copiar'}
                              </button>
                            </div>
                            <p className="text-slate-700 leading-relaxed bg-white p-3 border border-slate-100" dangerouslySetInnerHTML={{ __html: cite.html }} />
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </article>
  );
}

export default ArticleCard;