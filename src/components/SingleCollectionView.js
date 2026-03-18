import React, { useState, useEffect, useRef } from 'react';
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
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  
  const inputRef = useRef(null);

  // URLs
  const COLLECTION_META_URL = `/collections/metadata.json`;
  const ARTICLES_URL = `/collections/${folderName}/metadata.json`;

  // Cargar metadata de la colección y los artículos
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Cargar metadata de todas las colecciones para encontrar el título correcto
        const collectionResponse = await fetch(COLLECTION_META_URL);
        if (!collectionResponse.ok) {
          throw new Error(`Error loading collections metadata: ${collectionResponse.status}`);
        }
        const collectionsData = await collectionResponse.json();
        
        // Buscar la colección que coincida con el folderName
        const currentCollection = collectionsData.find(
          col => col['carpet-name'] === folderName
        );
        setCollectionMeta(currentCollection || null);

        // Cargar artículos de la colección
        const articlesResponse = await fetch(ARTICLES_URL);
        if (!articlesResponse.ok) {
          throw new Error(`Error loading articles: ${articlesResponse.status}`);
        }
        const articlesData = await articlesResponse.json();
        setArticles(articlesData);
        setFilteredArticles(articlesData);

      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (folderName) {
      fetchData();
    }
  }, [folderName]);

  // Leer el término de búsqueda de la URL al cargar
  useEffect(() => {
    const term = searchParams.get('collection_search') || '';
    setSearchInput(term);
    setActiveSearchTerm(term);
  }, [searchParams]);

  // Filtrar artículos cuando cambia activeSearchTerm
  useEffect(() => {
    if (!activeSearchTerm.trim()) {
      setFilteredArticles(articles);
      return;
    }

    const lowerTerm = activeSearchTerm.toLowerCase();
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
  }, [activeSearchTerm, articles, language]);

  // Manejar la búsqueda con el botón
  const handleSearch = () => {
    setActiveSearchTerm(searchInput);
    const params = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      params.set('collection_search', searchInput);
    } else {
      params.delete('collection_search');
    }
    setSearchParams(params);
  };

  // Manejar tecla Enter
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setSearchInput('');
    setActiveSearchTerm('');
    const params = new URLSearchParams(searchParams);
    params.delete('collection_search');
    setSearchParams(params);
    inputRef.current?.focus();
  };

  // Obtener el título correcto de la colección
  const getCollectionTitle = () => {
    if (collectionMeta?.title) {
      return collectionMeta.title[language] || collectionMeta.title.spanish || folderName?.replace(/-/g, ' ');
    }
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
        <p className="text-gray-600 text-sm mb-4">
          {collectionMeta.description[language] || collectionMeta.description.spanish}
        </p>
      )}
      
      <p className="text-gray-500 text-sm mb-6 border-b pb-4">
        {isSpanish 
          ? `${filteredArticles.length} artículos en esta colección` 
          : `${filteredArticles.length} articles in this collection`}
        {activeSearchTerm && (
          <span className="ml-1 text-[#007398]">
            {isSpanish ? `• buscando: "${activeSearchTerm}"` : `• searching: "${activeSearchTerm}"`}
          </span>
        )}
      </p>

      {/* Buscador con botón */}
      <div className="mb-8">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isSpanish ? "Buscar en esta colección..." : "Search in this collection..."}
              className="w-full p-3 border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#007398] font-serif pr-10"
              aria-label={isSpanish ? "Término de búsqueda" : "Search term"}
            />
            {searchInput && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={isSpanish ? "Limpiar búsqueda" : "Clear search"}
              >
                ×
              </button>
            )}
          </div>
          
          <button
            onClick={handleSearch}
            className="px-6 py-3 bg-[#007398] text-white text-sm rounded-sm hover:bg-[#005d7a] transition-colors duration-200 font-medium"
          >
            {isSpanish ? 'Buscar' : 'Search'}
          </button>
        </div>
        
        {/* Sugerencia sutil */}
        <p className="text-xs text-gray-400 mt-1 ml-1">
          {isSpanish ? 'Presiona Enter o haz clic en Buscar' : 'Press Enter or click Search'}
        </p>
      </div>

      {/* Lista de Artículos */}
      <div className="space-y-4">
        {filteredArticles.length === 0 ? (
          <div className="bg-white border border-gray-200 p-12 text-center rounded-sm">
            <p className="text-lg text-gray-600 font-serif italic mb-2">
              {isSpanish 
                ? 'No se encontraron artículos para esta búsqueda' 
                : 'No articles found for this search'}
            </p>
            {activeSearchTerm && (
              <button
                onClick={clearSearch}
                className="text-[#007398] hover:underline text-sm"
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