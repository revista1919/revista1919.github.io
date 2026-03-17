// components/CollectionCard.js
import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import { Link } from 'react-router-dom';

function CollectionCard({ collection }) {
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  // Determinar qué título y descripción mostrar
  const title = collection.title?.[language] || collection.title?.spanish || 'Untitled';
  const description = collection.description?.[language] || collection.description?.spanish || 'No description available.';

  // Crear el texto de los idiomas disponibles con estilo editorial
  const getLanguagesText = () => {
    if (!collection.languages || collection.languages.length === 0) return null;

    const langMap = { spanish: 'Español', english: 'English' };
    const availableLangs = collection.languages.map(langCode => langMap[langCode] || langCode).join(' · ');
    
    const isAvailableInCurrentLang = collection.languages.includes(language);
    const isMonolingual = collection.languages.length === 1;
    
    if (isMonolingual) {
      const onlyLang = collection.languages[0];
      if (!isAvailableInCurrentLang) {
        return (
          <span className="text-amber-700 font-serif italic text-[11px]">
            {availableLangs} <span className="text-amber-600/70">—</span> {isSpanish 
              ? `Solo en ${langMap[onlyLang]}` 
              : `Only in ${langMap[onlyLang]}`}
          </span>
        );
      }
      return <span className="text-gray-600 font-serif text-[11px]">{availableLangs}</span>;
    }
    
    return <span className="text-gray-600 font-serif text-[11px]">{availableLangs}</span>;
  };

  const languagesText = getLanguagesText();

  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="group relative bg-[#fcfaf2] border border-[#e0dcd0] overflow-hidden"
      style={{
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
        transition: 'box-shadow 0.3s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)';
      }}
    >
      <Link to={`/collection/${collection['carpet-name']}`} className="block h-full">
        {/* Contenedor de Imagen con Overlay Editorial */}
        {collection.image && (
          <div className="relative h-56 overflow-hidden border-b border-[#e0dcd0]">
            <img
              src={collection.image}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=400&auto=format';
              }}
            />
            {/* Sello Editorial sobre la imagen */}
            <div className="absolute top-4 left-4 bg-[#001a36]/90 text-[#c5a059] px-3 py-1 text-[10px] uppercase tracking-[2px] font-sans font-bold border border-[#c5a059]/30">
              {collection.type || (isSpanish ? 'COLECCIÓN' : 'COLLECTION')}
            </div>
          </div>
        )}

        <div className="p-8 text-center">
          {/* Título con Serif de autoridad */}
          <h3 className="text-2xl font-serif font-medium text-[#001a36] mb-3 leading-tight group-hover:text-[#8b1e3f] transition-colors duration-300 line-clamp-2">
            {title}
          </h3>
          
          {/* Adorno divisor sutil */}
          <div className="w-12 h-[1px] bg-[#c5a059] mx-auto mb-4 opacity-50"></div>

          <p className="text-gray-600 text-sm leading-relaxed mb-6 line-clamp-3 font-serif italic">
            {description}
          </p>

          {/* Footer de la Card estilo Bibliográfico */}
          <div className="pt-4 border-t border-[#e0dcd0]/60">
            <div className="text-[10px] uppercase tracking-[1.5px] font-sans font-bold text-gray-400 mb-1">
              {isSpanish ? 'Disponibilidad' : 'Availability'}
            </div>
            <div className="min-h-[28px] flex items-center justify-center">
              {languagesText}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default CollectionCard;