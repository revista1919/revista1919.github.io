import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';

// Helper para obtener el año (CORREGIDO para formato DD-MM-YYYY)
const getYear = (dateString) => {
  if (!dateString) return null;
  
  // Parsear fecha en formato DD-MM-YYYY
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    // Crear fecha en formato YYYY-MM-DD para evitar problemas de zona horaria
    const parsedDate = new Date(`${year}-${month}-${day}T12:00:00Z`);
    return isNaN(parsedDate) ? null : parsedDate.getUTCFullYear();
  }
  return null;
};

function CollectionArticleCard({ article, collectionFolder }) {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const [isExpanded, setIsExpanded] = useState(false);

  // Determinar el área (manejar array correctamente)
  const area = article.area && article.area.length > 0 
    ? article.area[0].charAt(0).toUpperCase() + article.area[0].slice(1) // Capitalizar
    : 'General';
  
  // Obtener el año (CORREGIDO)
  const year = getYear(article['original-date']);
  
  // Título traducido (para mostrar principal)
  const translatedTitle = article['name-translated']?.[language] || '';
  
  // Título original (en latín u otro idioma original)
  const originalTitle = article.name?.spanish || article.name?.english || '';
  
  // Título a mostrar (priorizar traducción, luego original)
  const displayTitle = translatedTitle || originalTitle || 'Untitled';
  
  // Abstract
  const abstract = article.abstract?.[language] 
    || article.abstract?.spanish 
    || 'No abstract available.';
  
  // URL del HTML del artículo (CORREGIDO)
  // Si el idioma de la interfaz es inglés Y el artículo está en inglés, usar .EN.html
  // En tu JSON, article.language es "spanish", así que nunca usará .EN.html, pero lo dejamos para futuro
  const isOriginalEnglish = article.language === 'english';
  const htmlFileName = `${article.id}${language === 'en' && isOriginalEnglish ? '.EN' : ''}.html`;
  const htmlUrl = `/collections/${collectionFolder}/articles/${htmlFileName}`;

  // URL del PDF (si existe)
  const pdfUrl = article['pdf-url'] || null;

  const toggleExpand = (e) => {
    const tag = e.target.tagName.toLowerCase();
    const isInteractive = ['a', 'button'].includes(tag) || e.target.closest('a, button');
    if (!isInteractive) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <motion.div
      layout
      onClick={toggleExpand}
      className={`group relative bg-white border border-gray-200 mb-4 transition-all duration-300 cursor-pointer rounded-lg overflow-hidden
        ${isExpanded ? 'shadow-xl ring-1 ring-[#007398]/20' : 'hover:shadow-md'}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors
        ${isExpanded ? 'bg-[#007398]' : 'bg-gray-100 group-hover:bg-[#007398]'}`}
      />
      <div className="p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
          <div className="flex-1">
            {/* Metadatos simples - AHORA EL AÑO APARECE CORRECTAMENTE */}
            <div className="flex flex-wrap items-center gap-2 mb-1 text-[9px] font-bold uppercase tracking-widest text-gray-500">
              <span>{area}</span>
              {year && <span>• {year}</span>}
            </div>
            {/* Título como enlace */}
            <a
              href={htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="block"
            >
              <h3 className={`font-serif font-bold text-black leading-tight mb-2 transition-colors hover:text-[#007398]
                ${isExpanded ? 'text-lg' : 'text-base line-clamp-2'}`}>
                {displayTitle}
              </h3>
              {/* Mostrar título original debajo cuando está expandido */}
              {isExpanded && originalTitle && originalTitle !== displayTitle && (
                <p className="text-xs text-gray-400 italic mt-1">
                  {originalTitle}
                </p>
              )}
            </a>
            {/* Autor(es) */}
            {article.author && article.author.length > 0 && (
              <div className="text-xs text-gray-600 mb-2">
                {article.author.map(a => a.name).join(', ')}
              </div>
            )}
            {/* Abstract corto si no está expandido */}
            {!isExpanded && (
              <p className="text-xs text-gray-500 italic line-clamp-2">
                {abstract}
              </p>
            )}
          </div>
          {/* Botones de acción */}
          <div className="flex flex-row gap-2 md:flex-col md:min-w-[100px]" onClick={(e) => e.stopPropagation()}>
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 md:flex-none flex items-center justify-center gap-1 px-2 py-1.5 bg-[#007398] text-white text-[9px] font-bold rounded hover:bg-[#005a77] transition-all"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                PDF
              </a>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex-1 md:flex-none px-2 py-1.5 border border-gray-300 text-gray-700 text-[9px] font-bold rounded hover:bg-gray-50"
            >
              {isExpanded ? (isSpanish ? 'CERRAR' : 'CLOSE') : (isSpanish ? 'DETALLES' : 'DETAILS')}
            </button>
          </div>
        </div>
        {/* Contenido Expandible */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {/* MOSTRAR IDIOMA ORIGINAL (campo "idioma" del JSON) */}
            {article.idioma && (
              <div className="mb-3 text-xs text-gray-500">
                <span className="font-bold">{isSpanish ? 'Idioma original:' : 'Original language:'}</span> {article.idioma}
              </div>
            )}
            {/* Abstract completo */}
            <div className="mb-3">
              <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">
                {isSpanish ? 'Resumen' : 'Abstract'}
              </h4>
              <p className="text-sm text-gray-800 leading-relaxed font-serif text-justify">
                {abstract}
              </p>
            </div>
            {/* Editores/Colaboradores */}
            {(article.editor || article.colaboradores) && (
              <div className="mb-3 text-xs text-gray-500">
                {article.editor && article.editor.length > 0 && (
                  <p><span className="font-bold">{isSpanish ? 'Editores:' : 'Editors:'}</span> {article.editor.map(e => e.name).join(', ')}</p>
                )}
                {article.colaboradores && article.colaboradores.length > 0 && (
                  <p className="mt-1"><span className="font-bold">{isSpanish ? 'Colaboradores:' : 'Contributors:'}</span> {article.colaboradores.map(c => c.name).join(', ')}</p>
                )}
              </div>
            )}
            {/* Palabras clave */}
            {article.keywords && article.keywords[language] && article.keywords[language].length > 0 && (
              <div>
                <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">
                  {isSpanish ? 'Palabras Clave' : 'Keywords'}
                </h4>
                <div className="flex flex-wrap gap-1">
                  {article.keywords[language].map((kw, idx) => (
                    <span key={idx} className="bg-gray-100 text-[9px] px-2 py-0.5 text-gray-600 italic rounded">
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default CollectionArticleCard;