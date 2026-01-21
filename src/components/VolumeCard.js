import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function VolumeCard({ volume }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const pdfUrl = volume.pdf || '';
  const htmlUrl = `/volumes/volume-${volume.volumen}-${volume.numero}.html`;
  const portada = volume.portada || '';

  return (
    <div
      className="group bg-white border border-gray-200 rounded-sm overflow-hidden transition-all duration-500 hover:border-gray-400 hover:shadow-xl cursor-pointer flex flex-col h-full"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Encabezado Ceremonioso */}
      <div className="pt-8 px-8 flex justify-between items-baseline">
        <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#007398]">
          Volumen {volume.volumen || '—'}
        </span>
        <span className="text-[10px] text-gray-400 font-mono italic">
          {volume.fecha || 'Sin fecha'}
        </span>
      </div>
      <div className="p-8 flex-grow flex flex-col">
        {/* Título Estilo Editorial */}
        <h2 className="text-2xl font-serif text-gray-900 leading-tight mb-6 group-hover:text-[#007398] transition-colors">
          Número {volume.numero || 'N/A'}: {volume.titulo || 'Sin título registrado'}
        </h2>
        {/* Portada con marco de galería */}
        {portada && (
          <div className="relative p-2 border border-gray-100 bg-gray-50 mb-6 shadow-inner">
            <div className="overflow-hidden aspect-[3/4]">
              <img
                src={portada}
                alt={`Cubierta ${volume.titulo || 'Sin título'}`}
                className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-700 scale-100 group-hover:scale-105"
              />
            </div>
            {/* Sello de autenticidad visual */}
            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm p-2 text-[8px] uppercase tracking-tighter border border-gray-200">
              Official Archive
            </div>
          </div>
        )}
        {/* Resumen Introductorio */}
        {!isExpanded && volume.resumen && (
          <p className="text-gray-600 text-sm leading-relaxed line-clamp-3 font-serif italic border-l-2 border-gray-100 pl-4">
            {volume.resumen}
          </p>
        )}
        {/* Sección Expandible */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-4 border-t border-gray-100 mt-4">
                <div className="text-sm text-gray-700 leading-relaxed">
                  <h4 className="text-[10px] uppercase font-bold text-gray-400 mb-2 tracking-widest">Resumen Editorial</h4>
                  {volume.resumen || 'Resumen no disponible'}
                </div>
                <div className="text-sm text-gray-700 leading-relaxed">
                  <h4 className="text-[10px] uppercase font-bold text-gray-400 mb-2 tracking-widest">Abstract</h4>
                  {volume.abstract || 'Abstract no disponible'}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-gray-400">Áreas:</span>
                  <span className="text-xs text-[#007398] font-medium italic">{volume.area || 'No especificadas'}</span>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-gray-400 mb-2 tracking-widest">Palabras Clave</h4>
                  <div className="flex flex-wrap gap-2">
                    {volume.palabras_clave?.length > 0 ? (
                      volume.palabras_clave.map((kw, idx) => (
                        <span key={idx} className="bg-[#007398]/10 text-[#007398] px-2 py-1 rounded text-xs font-medium">
                          {kw}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-500 italic">No disponibles</span>
                    )}
                  </div>
                </div>
                {/* Botones de Acción Minimalistas */}
                <div className="grid grid-cols-1 gap-2 pt-6">
                  <a
                    href={htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 border border-[#007398] text-[#007398] text-[10px] uppercase font-bold tracking-[0.2em] text-center hover:bg-[#007398] hover:text-white transition-all"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Examinar Contenidos
                  </a>
                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 bg-gray-900 text-white text-[10px] uppercase font-bold tracking-[0.2em] text-center hover:bg-black transition-all"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Descargar Edición Completa (PDF)
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Footer de la Card (Indicador) */}
      <div className="px-8 py-3 bg-gray-50 border-t border-gray-100 flex justify-center">
        <div className={`w-2 h-2 rounded-full transition-all duration-300 ${isExpanded ? 'bg-[#007398] w-8' : 'bg-gray-300'}`}></div>
      </div>
    </div>
  );
}

export default VolumeCard;