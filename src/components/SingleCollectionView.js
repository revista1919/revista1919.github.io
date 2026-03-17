// components/SingleCollectionView.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import { useParams, useSearchParams } from 'react-router-dom';
import CollectionArticleCard from './CollectionArticleCard';
import useDebounce from '../hooks/useDebounce';

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
  
  const debouncedSearch = useDebounce(searchInput, 300);

  const METADATA_URL = `/collections/${folderName}/metadata.json`;

  useEffect(() => {
    const fetchCollectionData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(METADATA_URL);
        if (!response.ok) {
          throw new Error(`Error loading collection metadata: ${response.status}`);
        }
        const data = await response.json();
        
        console.log('Datos recibidos:', data);
        
        // Procesar los datos - en tu caso es un array con un objeto
        let articlesArray = [];
        
        if (Array.isArray(data)) {
          // Tu caso: array con un objeto que es el artículo
          articlesArray = data.filter(item => item && item.id);
        } else if (data && typeof data === 'object') {
          articlesArray = data.id ? [data] : [];
        }
        
        console.log('Artículos procesados:', articlesArray);
        setArticles(articlesArray);
        setFilteredArticles(articlesArray);
        
        // Cargar collections.json
        const collectionsResponse = await fetch('/collections/collections.json');
        if (collectionsResponse.ok) {
          const collectionsData = await collectionsResponse.json();
          const currentCollection = collectionsData.find(
            col => col['carpet-name'] === folderName
          );
          setCollectionMeta(currentCollection || null);
        }
      } catch (err) {
        console.error('Error fetching collection:', err);
        setError(err.message);
        setArticles([]);
        setFilteredArticles([]);
      } finally {
        setLoading(false);
      }
    };

    if (folderName) {
      fetchCollectionData();
    }
  }, [folderName]);

  useEffect(() => {
    const term = searchParams.get('collection_search') || '';
    setSearchInput(term);
  }, [searchParams]);

  useEffect(() => {
    if (!articles.length) {
      setFilteredArticles([]);
      return;
    }

    const lowerTerm = debouncedSearch.toLowerCase().trim();
    
    if (!lowerTerm) {
      setFilteredArticles(articles);
      return;
    }

    const filtered = articles.filter((article) => {
      const title = article.name?.[language] || 
                   article.name?.spanish || 
                   article.name?.english || 
                   '';
      
      const abstract = article.abstract?.[language] || 
                      article.abstract?.spanish || 
                      article.abstract?.english || 
                      '';
      
      const authors = article.author?.map(a => a.name).join(' ') || '';
      
      const keywords = article.keywords?.[language]?.join(' ') || 
                      article.keywords?.spanish?.join(' ') || 
                      article.keywords?.english?.join(' ') || 
                      '';

      return (
        title.toLowerCase().includes(lowerTerm) ||
        abstract.toLowerCase().includes(lowerTerm) ||
        authors.toLowerCase().includes(lowerTerm) ||
        keywords.toLowerCase().includes(lowerTerm) ||
        article.id?.toLowerCase().includes(lowerTerm)
      );
    });
    
    setFilteredArticles(filtered);
  }, [debouncedSearch, articles, language]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (debouncedSearch) {
      params.set('collection_search', debouncedSearch);
    } else {
      params.delete('collection_search');
    }
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, searchParams, setSearchParams]);

  const handleSearchChange = (e) => {
    setSearchInput(e.target.value);
  };

  const clearSearch = () => {
    setSearchInput('');
  };

  const getLocalizedTitle = () => {
    if (collectionMeta?.title) {
      return collectionMeta.title[language] || 
             collectionMeta.title.spanish || 
             collectionMeta.title.english || 
             folderName?.replace(/-/g, ' ');
    }
    return folderName?.replace(/-/g, ' ') || '';
  };

  const getLocalizedDescription = () => {
    if (collectionMeta?.description) {
      return collectionMeta.description[language] || 
             collectionMeta.description.spanish || 
             collectionMeta.description.english || 
             '';
    }
    return '';
  };

  // Debug: Verificar qué está pasando con CollectionArticleCard
  console.log('Estado actual:', {
    loading,
    error,
    articlesCount: articles.length,
    filteredCount: filteredArticles.length,
    firstArticle: articles[0]
  });

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
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-[#007398] text-white rounded-sm hover:bg-[#005a7a] transition-colors"
        >
          {isSpanish ? 'Reintentar' : 'Retry'}
        </button>
      </div>
    );
  }

  return (
    <motion.div
      className="py-8 max-w-4xl mx-auto px-4 sm:px-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h1 className="text-3xl font-serif font-bold text-gray-900 mb-2">
        {getLocalizedTitle()}
      </h1>
      
      {getLocalizedDescription() && (
        <p className="text-gray-600 mb-4">
          {getLocalizedDescription()}
        </p>
      )}
      
      <p className="text-gray-500 text-sm mb-6 border-b pb-4">
        {isSpanish 
          ? `Explorando ${filteredArticles.length} artículos en esta colección.` 
          : `Exploring ${filteredArticles.length} articles in this collection.`}
      </p>

      <div className="mb-8">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchInput}
              onChange={handleSearchChange}
              placeholder={isSpanish ? "Buscar en esta colección..." : "Search in this collection..."}
              className="w-full p-3 pr-10 border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#007398] font-serif"
              disabled={articles.length === 0}
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
        </div>
      </div>

      {/* Lista de Artículos */}
      <div className="space-y-4">
        {!articles.length ? (
          <div className="bg-white border border-gray-200 p-12 text-center rounded-sm">
            <p className="text-lg text-gray-600 font-serif italic">
              {isSpanish 
                ? 'Esta colección no tiene artículos disponibles.' 
                : 'This collection has no articles available.'}
            </p>
          </div>
        ) : filteredArticles.length === 0 ? (
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
          <div>
            {/* DEBUG: Mostrar información del artículo */}
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-sm">
              <p className="font-bold">Debug: Artículo cargado</p>
              <p>ID: {articles[0]?.id}</p>
              <p>Título: {articles[0]?.name?.spanish}</p>
            </div>
            
            {filteredArticles.map((article, index) => (
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
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default SingleCollectionView;