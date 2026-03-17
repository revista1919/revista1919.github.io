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
  }, [language]); // Vuelve a cargar si el idioma cambia (por si ordenamos por título)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#007398]"></div>
        <p className="mt-4 text-gray-500 font-serif italic">
          {isSpanish ? 'Cargando colecciones...' : 'Loading collections...'}
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
      <h1 className="text-3xl font-serif font-bold text-gray-900 mb-8 border-b pb-4">
        {isSpanish ? 'Colecciones' : 'Collections'}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {collections.map((collection, index) => (
          <motion.div
            key={collection.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
          >
            <CollectionCard collection={collection} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default CollectionView;