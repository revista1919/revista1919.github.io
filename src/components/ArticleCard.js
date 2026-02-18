import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

// Slug generator (consistente con el script Node.js)
const generateSlug = (name) => {
  if (!name) return '';
  name = name.toLowerCase();
  name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  name = name.replace(/\s+/g, '-');
  name = name.replace(/[^a-z0-9-]/g, '');
  name = name.replace(/-+/g, '-');
  name = name.replace(/^-+|-+$/g, '');
  return name;
};

/* -------------------------- FORMATOS DE AUTORES -------------------------- */
const chicagoAuthors = (authors) => {
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} y ${authors[1]}`;
  return `${authors[0]}, et al.`;
};

const apaFormatName = (fullName) => {
  const parts = fullName.trim().split(' ');
  if (parts.length < 2) return fullName;
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
  if (authors.length === 2) return `${authors[0]} y ${authors[1]}`;
  return `${authors[0]}, et al.`;
};

const formatAuthorsDisplay = (authors, language = 'es') => {
  if (authors.length === 0) return 'Autor desconocido';
  const connector = language === 'es' ? 'y' : 'and';
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} ${connector} ${authors[1]}`;
  return authors.slice(0, -1).join(', ') + `, ${connector} ` + authors[authors.length - 1];
};
/* -------------------------------------------------------------------------- */

function ArticleCard({ article }) {
  console.log('Objeto article recibido:', article);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCitations, setShowCitations] = useState(false);
  const [showEnglishAbstract, setShowEnglishAbstract] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState(null);

  const journal = 'Revista Nacional de las Ciencias para Estudiantes';
  const articleSlug = `${generateSlug(article?.titulo || '')}-${article?.numeroArticulo || ''}`;
  
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
    const authors = authorsRaw.split(';').map(a => a.trim()).filter(a => a);
    const title = article?.titulo || 'Sin título';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);
    const plain = `${chicagoAuthors(authors)}. "${title}." ${journal} ${volume}, no. ${number} (${year}): ${pages}.`;
    const html = `${chicagoAuthors(authors)}. "${title}." <i>${journal}</i> ${volume}, no. ${number} (${year}): ${pages}.`;
    return { plain, html };
  };

  const getApa = () => {
    const authorsRaw = article?.autores || '';
    const authors = authorsRaw.split(';').map(a => a.trim()).filter(a => a);
    const title = article?.titulo || 'Sin título';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);
    const plain = `${apaAuthors(authors)} (${year}). ${title}. ${journal}, ${volume}(${number}), ${pages}.`;
    const html = `${apaAuthors(authors)} (${year}). ${title}. <i>${journal}</i>, <i>${volume}</i>(${number}), ${pages}.`;
    return { plain, html };
  };

  const getMla = () => {
    const authorsRaw = article?.autores || '';
    const authors = authorsRaw.split(';').map(a => a.trim()).filter(a => a);
    const title = article?.titulo || 'Sin título';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);
    const plain = `${mlaAuthors(authors)}. "${title}." ${journal}, vol. ${volume}, no. ${number}, ${year}, pp. ${pages}.`;
    const html = `${mlaAuthors(authors)}. "${title}." <i>${journal}</i>, vol. ${volume}, no. ${number}, ${year}, pp. ${pages}.`;
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
    const isInteractive = ['a', 'button', 'span'].includes(tag) || e.target.closest('a, button, span');
    if (!isInteractive) {
      setIsExpanded(!isExpanded);
    }
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

  const authorsArray = (article?.autores || '').split(';').map(a => a.trim()).filter(a => a);
  const tipo = article.tipo || 'Artículo de Investigación';

  // Determinar qué abstract mostrar
  const abstractToShow = article?.resumen || article?.abstract || 'Resumen no disponible';
  const englishAbstract = article?.abstract || article?.resumen || 'Abstract not available';

  /* --------------------------- RENDER PRINCIPAL --------------------------- */
  return (
    <motion.div
      layout
      onClick={toggleExpand}
      className={`group relative bg-white border border-gray-200 mb-4 md:mb-6 transition-all duration-300 cursor-pointer
        ${isExpanded ? 'shadow-xl ring-1 ring-[#007398]/20' : 'hover:shadow-md'}`}
    >
      {/* Indicador lateral de color */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors
        ${isExpanded ? 'bg-[#007398]' : 'bg-gray-100 group-hover:bg-[#007398]'}`}
      />
      <div className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
         
          <div className="flex-1">
            {/* Metadatos: Más pequeños y elegantes en móvil */}
            <div className="flex flex-wrap items-center gap-2 mb-2 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <span className="text-[#007398]">{article.area || 'General'}</span>
              <span className="hidden xs:inline">•</span>
              <span className="bg-gray-100 px-1.5 py-0.5 rounded-sm">VOL. {article.volumen}</span>
              <span className="bg-gray-100 px-1.5 py-0.5 rounded-sm">NO. {article.numero}</span>
            </div>
            {/* Título: Ajuste de tamaño responsivo */}
            <h3 className={`font-serif font-bold text-black leading-tight mb-2 transition-colors group-hover:text-[#007398]
              ${isExpanded ? 'text-xl md:text-2xl' : 'text-lg md:text-xl line-clamp-2 md:line-clamp-none'}`}>
              {article.titulo}
            </h3>
            {/* Autores: Compactos */}
            <div className="flex flex-wrap gap-x-2 text-xs md:text-sm mb-3">
              {authorsArray.map((auth, i) => (
                <span
                  key={i}
                  onClick={(e) => { e.stopPropagation(); handleAuthorClick(auth); }}
                  className="text-[#007398] hover:underline cursor-pointer font-medium"
                >
                  {auth}{i < authorsArray.length - 1 ? ',' : ''}
                </span>
              ))}
            </div>
            {/* Resumen corto: Se oculta si está expandido para no repetir con el completo */}
            {!isExpanded && (
              <p className="text-xs md:text-sm text-gray-500 italic line-clamp-2">
                {abstractToShow}
              </p>
            )}
          </div>
          {/* Botones de acción: En móvil son una fila compacta al final o al lado */}
          <div className="flex flex-row md:flex-col gap-2 md:min-w-[110px]" onClick={(e) => e.stopPropagation()}>
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-[#007398] text-white text-[10px] font-bold rounded-sm hover:bg-[#005a77] transition-all"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                PDF
              </a>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex-1 md:flex-none px-3 py-2 border border-gray-300 text-gray-700 text-[10px] font-bold rounded-sm hover:bg-gray-50"
            >
              {isExpanded ? 'CERRAR' : 'DETALLES'}
            </button>
          </div>
        </div>
        {/* Contenido Expandible: Optimizado para scroll móvil */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-5 pt-5 border-t border-gray-100 space-y-5">
               
                {/* Info rápida en Grid 2 columnas incluso en móvil */}
                <div className="grid grid-cols-2 gap-4 text-[11px] md:text-sm">
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="block text-gray-400 uppercase text-[9px] font-bold">Publicado</span>
                    <span className="font-medium">{parseDateFlexible(article.fecha)}</span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="block text-gray-400 uppercase text-[9px] font-bold">Páginas</span>
                    <span className="font-medium">{pages || 'N/A'}</span>
                  </div>
                </div>

                {/* Fechas de recepción/aceptación si existen */}
                {(article.receivedDate || article.acceptedDate) && (
                  <div className="grid grid-cols-2 gap-4 text-[11px] md:text-sm">
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

                {/* Abstract con tipografía legible */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Resumen</h4>
                    <p className="text-sm md:text-base text-gray-800 leading-relaxed font-serif text-justify">
                      {abstractToShow}
                    </p>
                  </div>
                  {article.abstract && article.abstract !== article.resumen && (
                    <div className="border-l-2 border-blue-100 pl-4 py-1">
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

                {/* Palabras Clave */}
                {article.palabras_clave && article.palabras_clave.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Palabras Clave</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {article.palabras_clave.map((kw, idx) => (
                        <span key={idx} className="bg-white border border-gray-200 text-[10px] px-2 py-0.5 text-gray-600 italic">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Keywords en inglés si existen */}
                {article.keywords_english && article.keywords_english.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Keywords</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {article.keywords_english.map((kw, idx) => (
                        <span key={idx} className="bg-white border border-gray-200 text-[10px] px-2 py-0.5 text-gray-600 italic">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer de Acciones Secundarias */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-50">
                  <div className="flex gap-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowCitations(!showCitations); }}
                      className="text-[10px] font-bold text-gray-500 hover:text-[#007398] flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      CITAR
                    </button>
                    <a
                      href={htmlUrlEs}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-[#007398] flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      VER TEXTO COMPLETO
                    </a>
                    {article.tituloEnglish && (
                      <a
                        href={htmlUrlEn}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-gray-500 hover:text-[#007398] flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M3 5h12M9 3v2m0 4v2" />
                        </svg>
                        ENGLISH VERSION
                      </a>
                    )}
                  </div>
                  {/* ISSN AGREGADO: Añadido permanentemente aquí como metadato en el footer de la tarjeta */}
                  <span className="text-[9px] text-gray-400 uppercase tracking-widest">ISSN 3087-2839</span>
                </div>

                {/* Información adicional (opcional) */}
                {(article.funding || article.conflicts) && (
                  <div className="text-[10px] text-gray-500 border-t border-gray-100 pt-4 mt-2">
                    {article.funding && (
                      <p><strong>Financiación:</strong> {article.funding}</p>
                    )}
                    {article.conflicts && (
                      <p className="mt-1"><strong>Conflictos de interés:</strong> {article.conflicts}</p>
                    )}
                  </div>
                )}

                {/* Sección de Citas optimizada para móvil */}
                {showCitations && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="bg-gray-900 text-gray-300 p-4 rounded-sm text-[11px] space-y-4 font-mono"
                  >
                    {[
                      { label: 'APA', ...getApa() },
                      { label: 'MLA', ...getMla() },
                      { label: 'Chicago', ...getChicago() }
                    ].map((cite) => (
                      <div key={cite.label} className="flex flex-col gap-2 border-b border-gray-800 pb-2 last:border-0">
                        <div className="flex justify-between">
                          <span className="text-white font-bold">{cite.label}</span>
                          <button
                            onClick={() => copyToClipboard(cite.plain, cite.html, cite.label)}
                            className="text-[#007398] uppercase text-[9px] font-black"
                          >
                            {copiedFormat === cite.label ? 'Copiado' : 'Copiar'}
                          </button>
                        </div>
                        <p className="leading-tight opacity-80" dangerouslySetInnerHTML={{ __html: cite.html }} />
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default ArticleCard;