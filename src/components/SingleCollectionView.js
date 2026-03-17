import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import { useParams, useSearchParams } from 'react-router-dom';
import CollectionArticleCard from './CollectionArticleCard';
import useDebounce from '../hooks/useDebounce'; // Lo crearemos después

function SingleCollectionView() {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const { folderName } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [collectionMeta, setCollectionMeta] = useState(null);
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState(''); // Para el input inmediato
  
  // Debounce de 300ms para la búsqueda
  const debouncedSearch = useDebounce(searchInput, 300);

  // URL del metadata.json
  const METADATA_URL = `/collections/${folderName}/metadata.json`;

  // Cargar metadata de la colección
  useEffect(() => {
    const fetchCollectionData = async () => {
      setLoading(true);
      try {
        const response = await fetch(METADATA_URL);
        if (!response.ok) {
          throw new Error(`Error loading collection metadata: ${response.status}`);
        }
        const data = await response.json();
        setArticles(data);
        setFilteredArticles(data);
        
        // También necesitamos cargar el collections.json para obtener el título real
        const collectionsResponse = await fetch('/collections/collections.json');
        if (collectionsResponse.ok) {
          const collectionsData = await collectionsResponse.json();
          const currentCollection = collectionsData.find(
            col => col['carpet-name'] === folderName
          );
          setCollectionMeta(currentCollection || null);
        }
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (folderName) {
      fetchCollectionData();
    }
  }, [folderName]);

  // Leer el término de búsqueda de la URL al cargar
  useEffect(() => {
    const term = searchParams.get('collection_search') || '';
    setSearchInput(term);
  }, [searchParams]);

  // Filtrar artículos SOLO cuando cambia el término con debounce
  useEffect(() => {
    const lowerTerm = debouncedSearch.toLowerCase();
    
    if (!lowerTerm) {
      setFilteredArticles(articles);
      return;
    }

    const filtered = articles.filter((article) => {
      const title = article.name?.[language] || article.name?.spanish || '';
      const abstract = article.abstract?.[language] || article.abstract?.spanish || '';
      const authors = article.author?.map(a => a.name).join(' ') || '';
      const keywords = article.keywords?.[language]?.join(' ') || '';

      return (
        title.toLowerCase().includes(lowerTerm) ||
        abstract.toLowerCase().includes(lowerTerm) ||
        authors.toLowerCase().includes(lowerTerm) ||
        keywords.toLowerCase().includes(lowerTerm)
      );
    });
    
    setFilteredArticles(filtered);
  }, [debouncedSearch, articles, language]);

  // Actualizar URL cuando cambia el término con debounce
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (debouncedSearch) {
      params.set('collection_search', debouncedSearch);
    } else {
      params.delete('collection_search');
    }
    setSearchParams(params, { replace: true }); // replace: true evita que se acumulen en el historial
  }, [debouncedSearch]);

  const handleSearchChange = (e) => {
    setSearchInput(e.target.value);
  };

  const clearSearch = () => {
    setSearchInput('');
  };

  // Obtener el título localizado
  const getLocalizedTitle = () => {
    if (collectionMeta?.title) {
      return collectionMeta.title[language] || collectionMeta.title.spanish || folderName?.replace(/-/g, ' ');
    }
    // Fallback al nombre de la carpeta formateado
    return folderName?.replace(/-/g, ' ');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#007398]"></div>
        <p className="mt-4 text-gray-500 font-serif italic">
          {isSpanish ? 'Cargando colección...' : 'Loading collection...'}
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

  return (
    <motion.div
      className="py-8 max-w-4xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h1 className="text-3xl font-serif font-bold text-gray-900 mb-2">
        {getLocalizedTitle()}
      </h1>
      {collectionMeta?.description && (
        <p className="text-gray-600 mb-4">
          {collectionMeta.description[language] || collectionMeta.description.spanish}
        </p>
      )}
      <p className="text-gray-500 text-sm mb-6 border-b pb-4">
        {isSpanish 
          ? `Explorando ${filteredArticles.length} artículos en esta colección.` 
          : `Exploring ${filteredArticles.length} articles in this collection.`}
      </p>

      {/* Buscador con mejor UX */}
      <div className="mb-8">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchInput}
              onChange={handleSearchChange}
              placeholder={isSpanish ? "Buscar en esta colección..." : "Search in this collection..."}
              className="w-full p-3 pr-10 border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#007398] font-serif"
            />
            {searchInput && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={isSpanish ? "Limpiar búsqueda" : "Clear search"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {searchInput && searchInput !== debouncedSearch && (
            <div className="flex items-center text-sm text-gray-500">
              <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {isSpanish ? 'Buscando...' : 'Searching...'}
            </div>
          )}
        </div>
        
        {/* Feedback de resultados */}
        {filteredArticles.length > 0 && searchInput && (
          <p className="text-sm text-gray-500 mt-2">
            {isSpanish 
              ? `Se encontraron ${filteredArticles.length} resultados` 
              : `Found ${filteredArticles.length} results`}
          </p>
        )}
      </div>

      {/* Lista de Artículos */}
      <div className="space-y-4">
        {filteredArticles.length === 0 ? (
          <div className="bg-white border border-gray-200 p-12 text-center rounded-sm">
            <p className="text-lg text-gray-600 font-serif italic mb-4">
              {isSpanish 
                ? 'No se han encontrado artículos para esta búsqueda.' 
                : 'No articles found for this search.'}
            </p>
            {searchInput && (
              <button
                onClick={clearSearch}
                className="text-[#007398] hover:underline font-medium"
              >
                {isSpanish ? 'Limpiar búsqueda' : 'Clear search'}
              </button>
            )}
          </div>
        ) : (
          filteredArticles.map((article, index) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
            >
              <CollectionArticleCard 
                article={article} 
                collectionFolder={folderName}
              />
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}

export default SingleCollectionView;