import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import CollectionCard from './CollectionCard';

const COLLECTIONS_JSON = '/collections/collections.json';

function CollectionView() {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCollections = async () => {
      setLoading(true);
      try {
        const response = await fetch(COLLECTIONS_JSON);
        if (!response.ok) {
          throw new Error(`Error loading collections: ${response.status}`);
        }
        let data = await response.json();

        // Filtrar solo colecciones activas
        data = data.filter(col => col.status === 'active');

        // Opcional: Ordenar las colecciones de alguna manera (ej. por título)
        data.sort((a, b) => {
          const titleA = a.title?.[language] || a.title?.spanish || '';
          const titleB = b.title?.[language] || b.title?.spanish || '';
          return titleA.localeCompare(titleB);
        });

        setCollections(data);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCollections();
  }, [language]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="w-12 h-12 border-2 border-[#c5a059]/30 border-t-[#001a36] rounded-full animate-spin"></div>
        <p className="mt-6 text-[#001a36] font-serif italic tracking-wide">
          {isSpanish ? 'Abriendo los archivos...' : 'Opening the archives...'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 p-8 text-center rounded-sm my-8">
        <p className="text-lg text-red-600 font-serif italic">
          {isSpanish ? `Error al cargar: ${error}` : `Error loading: ${error}`}
        </p>
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="bg-white border border-gray-200 p-12 text-center rounded-sm my-8">
        <p className="text-lg text-gray-600 font-serif italic">
          {isSpanish ? 'No hay colecciones disponibles.' : 'No collections available.'}
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className="py-8 max-w-7xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* MANIFIESTO EDITORIAL - GABINETE DE CURIOSIDADES */}
      <motion.header 
        className="text-center mb-16"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        <span className="text-[#c5a059] font-sans text-[10px] uppercase tracking-[4px] font-bold block mb-4">
          Ex Libris Scientiarum
        </span>
        
        <h1 className="text-3xl font-serif font-bold text-[#001a36] mb-6 border-b pb-4 max-w-3xl mx-auto">
          {isSpanish ? 'Colecciones Editoriales' : 'Editorial Collections'}
        </h1>
        
        {/* EXPLICACIÓN DE LÍNEAS INDEPENDIENTES */}
        <div className="max-w-2xl mx-auto px-4">
          <p className="text-gray-600 font-serif leading-relaxed italic text-lg">
            {isSpanish 
              ? "Más allá de nuestros volúmenes periódicos, las Colecciones representan líneas de investigación independientes. Son curadurías críticas y rescates históricos que operan bajo su propia lógica editorial, fuera de la numeración ordinaria de la revista."
              : "Beyond our periodic volumes, our Collections represent independent research lines. These are critical curations and historical recoveries that operate under their own editorial logic, separate from the journal's ordinary numbering."
            }
          </p>
          
          {/* SEPARADOR ACADÉMICO */}
          <div className="mt-8 flex justify-center items-center gap-4">
            <div className="h-[1px] w-12 bg-[#c5a059]/40"></div>
            <span className="text-[#c5a059] text-xl">❦</span>
            <div className="h-[1px] w-12 bg-[#c5a059]/40"></div>
          </div>
        </div>
      </motion.header>

      {/* GRID DE COLECCIONES - CON ANIMACIÓN ESCALONADA */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {collections.map((collection, index) => (
          <motion.div
            key={collection.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + (index * 0.1), duration: 0.5 }}
          >
            <CollectionCard collection={collection} />
          </motion.div>
        ))}
      </div>

      {/* NOTA AL PIE - SIN COMPONENTES ADICIONALES */}
      {collections.length > 0 && (
        <motion.footer 
          className="mt-16 text-center border-t border-gray-200 pt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 + (collections.length * 0.05), duration: 0.5 }}
        >
          <p className="font-sans text-[11px] text-gray-400 uppercase tracking-widest">
            {isSpanish 
              ? "Todas las traducciones y ediciones críticas están bajo licencia académica." 
              : "All translations and critical editions are under academic license."}
          </p>
        </motion.footer>
      )}
    </motion.div>
  );
}

export default CollectionView;