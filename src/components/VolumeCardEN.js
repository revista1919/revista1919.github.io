import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function VolumeCardEN({ volume }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const pdfUrl = volume.pdf || '';
  const htmlUrl = `/volumes/volume-${volume.volumen}-${volume.numero}EN.html`;
  const portada = volume.portada || '';

  return (
    <div
      className="group bg-white border border-gray-200 rounded-sm overflow-hidden transition-all duration-500 hover:border-gray-400 hover:shadow-xl cursor-pointer flex flex-col h-full"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Ceremonious Header */}
      <div className="pt-8 px-8 flex justify-between items-baseline">
        <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#007398]">
          Volume {volume.volumen || '—'}
        </span>
        <span className="text-[10px] text-gray-400 font-mono italic">
          {volume.fecha || 'No date'}
        </span>
      </div>
      <div className="p-8 flex-grow flex flex-col">
        {/* Editorial Style Title */}
        <h2 className="text-2xl font-serif text-gray-900 leading-tight mb-6 group-hover:text-[#007398] transition-colors">
          Issue {volume.numero || 'N/A'}: {volume.titulo || 'No title registered'}
        </h2>
        {/* Cover with gallery frame */}
        {portada && (
          <div className="relative p-2 border border-gray-100 bg-gray-50 mb-6 shadow-inner">
            <div className="overflow-hidden aspect-[3/4]">
              <img
                src={portada}
                alt={`Cover ${volume.titulo || 'Untitled'}`}
                className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-700 scale-100 group-hover:scale-105"
              />
            </div>
            {/* Visual authenticity seal */}
            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm p-2 text-[8px] uppercase tracking-tighter border border-gray-200">
              Official Archive
            </div>
          </div>
        )}
        {/* Introductory Summary */}
        {!isExpanded && volume.abstract && (
          <p className="text-gray-600 text-sm leading-relaxed line-clamp-3 font-serif italic border-l-2 border-gray-100 pl-4">
            {volume.abstract}
          </p>
        )}
        {/* Expandable Section */}
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
                  <h4 className="text-[10px] uppercase font-bold text-gray-400 mb-2 tracking-widest">Editorial Abstract</h4>
                  {volume.abstract || 'Abstract not available'}
                </div>
                <div className="text-sm text-gray-700 leading-relaxed">
                  <h4 className="text-[10px] uppercase font-bold text-gray-400 mb-2 tracking-widest">Resumen</h4>
                  {volume.resumen || 'Resumen no disponible'}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-gray-400">Areas:</span>
                  <span className="text-xs text-[#007398] font-medium italic">{volume.area || 'Not specified'}</span>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-gray-400 mb-2 tracking-widest">Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {volume.keywords?.length > 0 ? (
                      volume.keywords.map((kw, idx) => (
                        <span key={idx} className="bg-[#007398]/10 text-[#007398] px-2 py-1 rounded text-xs font-medium">
                          {kw}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-500 italic">Not available</span>
                    )}
                  </div>
                </div>
                {/* Minimalist Action Buttons */}
                <div className="grid grid-cols-1 gap-2 pt-6">
                  <a
                    href={htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 border border-[#007398] text-[#007398] text-[10px] uppercase font-bold tracking-[0.2em] text-center hover:bg-[#007398] hover:text-white transition-all"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Browse Contents
                  </a>
                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 bg-gray-900 text-white text-[10px] uppercase font-bold tracking-[0.2em] text-center hover:bg-black transition-all"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Download Full Issue (PDF)
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Card Footer (Indicator) */}
      <div className="px-8 py-3 bg-gray-50 border-t border-gray-100 flex justify-center">
        <div className={`w-2 h-2 rounded-full transition-all duration-300 ${isExpanded ? 'bg-[#007398] w-8' : 'bg-gray-300'}`}></div>
      </div>
    </div>
  );
}

export default VolumeCardEN;