import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function VolumeCard({ volume }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const pdfUrl = volume.pdf || '';
  const htmlUrl = `/volumes/volume-${volume.volumen}-${volume.numero}.html`;
  const portada = volume.portada || '';

  return (
    <motion.div
      layout
      onClick={() => setIsExpanded(!isExpanded)}
      className="group relative bg-[#FCFCFA] border border-[#E5E5E1] rounded-sm overflow-hidden transition-all duration-700 hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] cursor-pointer flex flex-col h-full"
    >
      {/* Línea decorativa superior */}
      <div className="h-1.5 w-full bg-[#007398] opacity-10 group-hover:opacity-100 transition-opacity duration-700" />
      <div className="pt-10 px-10 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-[0.4em] font-black text-[#007398] mb-1">
            Revista Nacional de las Ciencias
          </span>
          <div className="flex items-center gap-2">  {/* ISSN AGREGADO: Integrado aquí permanentemente */}
            <div className="h-[1px] w-8 bg-[#007398]/30 group-hover:w-full transition-all duration-700" />
            <span className="text-[9px] font-mono text-gray-400 tracking-[0.5em]">ISSN 3087-2839</span>
          </div>
        </div>
        <span className="text-[10px] text-gray-400 font-serif italic tracking-widest">
          {volume.fecha || 'Sin fecha'}
        </span>
      </div>
      <div className="p-10 flex-grow flex flex-col">
        {/* Título */}
        <div className="mb-8">
          <span className="text-[11px] font-serif italic text-gray-500 block mb-2">Volumen {volume.volumen} — No. {volume.numero}</span>
          <h2 className="text-3xl font-serif text-[#1a1a1a] leading-[1.1] group-hover:text-[#007398] transition-colors duration-500">
            {volume.titulo || 'Sin título registrado'}
          </h2>
        </div>
        {/* Portada */}
        {portada && (
          <div className="relative group/img">
            {/* Marco */}
            <div className="relative p-3 bg-white border border-[#E5E5E1] shadow-sm transition-transform duration-700 group-hover:scale-[1.02]">
              <div className="overflow-hidden aspect-[3/4] bg-gray-100 relative">
                <img
                  src={portada}
                  alt={volume.titulo}
                  className="w-full h-full object-cover mix-blend-multiply opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all duration-[1.5s] ease-in-out"
                />
                {/* Overlay de textura */}
                <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
              </div>
            </div>
            {/* Sello */}
            <div className="absolute -bottom-4 -right-4 w-16 h-16 border border-[#007398]/20 rounded-full flex items-center justify-center bg-white/80 backdrop-blur-md shadow-sm z-10 group-hover:rotate-12 transition-transform duration-1000">
              <span className="text-[7px] text-[#007398] text-center leading-none uppercase tracking-tighter">
                Archivo<br/>Oficial
              </span>
            </div>
          </div>
        )}
        {/* Sección expandible */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-10 space-y-8 border-t border-[#E5E5E1] pt-8"
            >
              {volume.editorial && (
                <div className="relative">
                  <span className="absolute -left-4 top-0 text-2xl text-[#007398]/20 font-serif">“</span>
                  <p className="text-sm text-gray-600 font-serif leading-relaxed italic px-2">
                    {volume.editorial}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3">
                <a
                  href={htmlUrl}
                  target="_blank"
                  className="group/btn relative overflow-hidden py-4 border border-gray-900 text-gray-900 text-[10px] uppercase font-bold tracking-[0.3em] text-center transition-all hover:text-white"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="relative z-10">Ver Contenidos</span>
                  <div className="absolute inset-0 bg-gray-900 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
                </a>
                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    className="py-4 bg-[#007398] text-white text-[10px] uppercase font-bold tracking-[0.3em] text-center hover:bg-[#005a77] shadow-lg shadow-[#007398]/20 transition-all"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Descargar PDF
                  </a>
                )}
              </div>
              {/* ISSN AGREGADO: Hardcodeado permanentemente, sin condición */}
              <div className="flex justify-center border-t border-gray-100 pt-4">
                <span className="text-[9px] font-mono text-gray-400 tracking-[0.5em]">ISSN 3087-2839</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Footer */}
      <div className="px-10 py-6 bg-white flex justify-between items-center border-t border-[#E5E5E1]">
         <div className="text-[9px] text-gray-400 uppercase tracking-widest font-medium">
           {isExpanded ? 'Cerrar' : 'Ver Detalles'}
         </div>
         <motion.div
           animate={{ rotate: isExpanded ? 180 : 0 }}
           className="text-[#007398]"
         >
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
             <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
           </svg>
         </motion.div>
      </div>
    </motion.div>
  );
}

export default VolumeCard;