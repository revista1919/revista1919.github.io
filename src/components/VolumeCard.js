import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function VolumeCard({ volume }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const pdfUrl = volume.pdf || '';
  const htmlUrl = `/volumes/volume-${volume.volumen}-${volume.numero}.html`;
  const portada = volume.portada || '';

  return (
    // Sin fondos grises ni bordes envolventes. Un contenedor limpio.
    <motion.article 
      layout
      className="group flex flex-col h-full bg-transparent"
    >
      {/* 1. PORTADA: El ancla visual */}
      {portada ? (
        <a 
          href={htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block mb-6 relative"
        >
          {/* Sombra realista y borde sutil imitando una revista impresa */}
          <div className="relative aspect-[3/4] w-full max-w-[280px] mx-auto overflow-hidden border border-gray-200 shadow-md transition-all duration-500 group-hover:shadow-xl group-hover:-translate-y-1 rounded-sm bg-white">
            <img
              src={portada}
              alt={volume.titulo || `Portada Volumen ${volume.volumen}`}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </div>
        </a>
      ) : (
        // Placeholder elegante si no hay portada
        <div className="mb-6 aspect-[3/4] w-full max-w-[280px] mx-auto bg-gray-50 border border-gray-200 flex flex-col items-center justify-center p-6 text-center shadow-sm">
          <span className="text-[#007398] font-serif italic text-lg mb-2">Volumen {volume.volumen}</span>
          <span className="text-xs text-gray-400 uppercase tracking-widest">Sin imagen de portada</span>
        </div>
      )}

      {/* 2. METADATOS Y TÍTULO */}
      <div className="flex flex-col flex-grow text-center md:text-left px-2">
        {/* Metadatos (Estilo Elsevier: pequeños, mayúsculas, espaciados) */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-2 gap-y-1 text-[11px] uppercase tracking-widest font-semibold text-gray-500 mb-2">
          <span className="text-[#007398]">Volumen {volume.volumen}</span>
          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
          <span>Número {volume.numero}</span>
        </div>

        {/* Título */}
        <a 
          href={htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block mb-2"
        >
          <h2 className="text-xl md:text-2xl font-serif text-gray-900 leading-tight transition-colors group-hover:text-[#007398]">
            {volume.titulo || 'Número Regular'}
          </h2>
        </a>

        {/* Fecha de Publicación */}
        <p className="text-sm text-gray-500 mb-5">
          {volume.fecha ? `Publicado: ${volume.fecha}` : 'Fecha no disponible'}
        </p>

        {/* 3. ACCIONES EN LÍNEA (Igual al ArticleCard) */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-auto pt-2">
          <a 
            href={htmlUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 hover:text-[#007398] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            Ver Contenidos
          </a>
          
          {pdfUrl && (
            <a 
              href={pdfUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-1.5 text-sm font-semibold text-[#007398] hover:text-[#005a77] transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              PDF Completo
            </a>
          )}

          {volume.editorial && (
            <button 
              onClick={() => setIsExpanded(!isExpanded)} 
              className="flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors ml-auto"
            >
              {isExpanded ? 'Ocultar' : 'Editorial'}
              <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
          )}
        </div>

        {/* 4. CONTENIDO EXPANDIBLE (Editorial y Metadatos Extra) */}
        <AnimatePresence>
          {isExpanded && volume.editorial && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-6 pt-5 border-t border-gray-200 text-left">
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Nota Editorial</span>
                <p className="text-sm text-gray-700 font-serif leading-relaxed italic border-l-2 border-[#007398]/30 pl-3">
                  "{volume.editorial}"
                </p>
                <div className="mt-4 pt-4 text-[10px] font-mono text-gray-400 tracking-[0.2em] uppercase">
                  ISSN: 3087-2839
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.article>
  );
}

export default VolumeCard;