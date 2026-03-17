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

  // Crear el texto de los idiomas disponibles
  const getLanguagesText = () => {
    if (!collection.languages || collection.languages.length === 0) return null;

    const langMap = { spanish: 'Español', english: 'English' };
    const availableLangs = collection.languages.map(langCode => langMap[langCode] || langCode).join(' · ');

    // Si la colección no está en el idioma actual, añadir una advertencia
    if (!collection.languages.includes(language)) {
      const warning = isSpanish ? ' (Solo disponible en otros idiomas)' : ' (Only available in other languages)';
      return <span className="text-amber-600 font-bold">{availableLangs}{warning}</span>;
    }
    return <span>{availableLangs}</span>;
  };

  const languagesText = getLanguagesText();

  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 hover:shadow-xl transition-all"
    >
      <Link to={`/collection/${collection['carpet-name']}`} className="block">
        {/* Imagen de la Colección */}
        {collection.image && (
          <div className="h-48 overflow-hidden">
            <img
              src={collection.image}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://via.placeholder.com/400x200?text=Image+Not+Found';
              }}
            />
          </div>
        )}
        <div className="p-6">
          <h3 className="text-xl font-serif font-bold text-gray-900 mb-2 line-clamp-2">
            {title}
          </h3>
          <p className="text-gray-600 text-sm mb-4 line-clamp-3">
            {description}
          </p>
          {/* Indicador de Idiomas */}
          {languagesText && (
            <div className="text-xs text-gray-500 uppercase tracking-wider border-t pt-4 mt-2">
              {isSpanish ? 'Idiomas:' : 'Languages:'} {languagesText}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

export default CollectionCard;