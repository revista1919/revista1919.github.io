import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import { useParams, useSearchParams } from 'react-router-dom';
import CollectionArticleCard from './CollectionArticleCard';

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
  const [searchInput, setSearchInput] = useState(''); // Para el input controlado
  const [searchTerm, setSearchTerm] = useState(''); // Para el término de búsqueda real

  // URL del metadata.json de esta colección
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
        
        // Cargar metadata de la colección para obtener el título real
        // Asumiendo que hay un archivo collection.json en la carpeta
        const collectionResponse = await fetch(`/collections/${folderName}/collection.json`);
        if (collectionResponse.ok) {
          const collectionData = await collectionResponse.json();
          setCollectionMeta(collectionData);
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
    setSearchTerm(term);
  }, [searchParams]);

  // Filtrar artículos cuando cambia el searchTerm
  useEffect(() => {
    const lowerTerm = searchTerm.toLowerCase();
    const filtered = articles.filter((article) => {
      const title = article.name?.[language] || article.title?.[language] || article.name?.spanish || article.title?.spanish || '';
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
  }, [searchTerm, articles, language]);

  // Ejecutar búsqueda al hacer clic en el botón
  const handleSearch = () => {
    setSearchTerm(searchInput);
    const params = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      params.set('collection_search', searchInput.trim());
    } else {
      params.delete('collection_search');
    }
    setSearchParams(params);
  };

  // Manejar tecla Enter en el input
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchTerm('');
    const params = new URLSearchParams(searchParams);
    params.delete('collection_search');
    setSearchParams(params);
  };

  // Obtener el título real de la colección
  const getCollectionTitle = () => {
    if (collectionMeta?.title) {
      return collectionMeta.title[language] || collectionMeta.title.spanish || folderName?.replace(/-/g, ' ');
    }
    // Intentar parsear el folderName como fallback
    return folderName?.replace(/-/g, ' ') || '';
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
        {getCollectionTitle()}
      </h1>
      {collectionMeta?.description && (
        <p className="text-gray-600 font-serif mb-2">
          {collectionMeta.description[language] || collectionMeta.description.spanish}
        </p>
      )}
      <p className="text-gray-500 text-sm mb-6 border-b pb-4">
        {isSpanish 
          ? `${filteredArticles.length} artículo${filteredArticles.length !== 1 ? 's' : ''} en esta colección` 
          : `${filteredArticles.length} article${filteredArticles.length !== 1 ? 's' : ''} in this collection`}
      </p>

      {/* Buscador con mejor UX */}
      <div className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isSpanish ? "Buscar en esta colección..." : "Search in this collection..."}
            className="flex-1 p-3 border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#007398] font-serif"
          />
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-[#007398] text-white text-sm rounded-sm hover:bg-[#005d7a] transition-colors font-medium"
          >
            {isSpanish ? 'Buscar' : 'Search'}
          </button>
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-sm hover:bg-gray-50"
            >
              {isSpanish ? 'Limpiar' : 'Clear'}
            </button>
          )}
        </div>
        {searchTerm && (
          <p className="text-sm text-gray-500 mt-2">
            {isSpanish 
              ? `Mostrando resultados para: "${searchTerm}"` 
              : `Showing results for: "${searchTerm}"`}
          </p>
        )}
      </div>

      {/* Lista de Artículos */}
      <div className="space-y-4">
        {filteredArticles.length === 0 ? (
          <div className="bg-white border border-gray-200 p-12 text-center rounded-sm">
            <p className="text-lg text-gray-600 font-serif italic">
              {isSpanish 
                ? 'No se encontraron artículos para esta búsqueda'
                : 'No articles found for this search'}
            </p>
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="mt-4 text-[#007398] hover:underline text-sm"
              >
                {isSpanish ? 'Ver todos los artículos' : 'View all articles'}
              </button>
            )}
          </div>
        ) : (
          filteredArticles.map((article, index) => (
            <motion.div
              key={article.id || index}
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