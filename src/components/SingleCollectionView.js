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
        console.log(`🔍 Intentando cargar: ${METADATA_URL}`);
        const response = await fetch(METADATA_URL);
        
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status} - No se pudo cargar ${METADATA_URL}`);
        }
        
        const data = await response.json();
        console.log('📦 Datos CRUDOS recibidos:', data);
        console.log('📦 Tipo de dato recibido:', Array.isArray(data) ? 'Array' : typeof data);

        // --- LÓGICA ROBUSTA PARA NORMALIZAR LOS ARTÍCULOS A UN ARRAY ---
        let articlesArray = [];

        if (Array.isArray(data)) {
          console.log('✅ Caso: Array detectado. Longitud:', data.length);
          // Caso 1: Es un array. Filtramos elementos nulos y nos aseguramos que cada uno sea un objeto válido.
          articlesArray = data.filter(item => item && typeof item === 'object');
          console.log(`   Array filtrado (sin nulos): ${articlesArray.length} elementos.`);
        } else if (data && typeof data === 'object') {
          console.log('✅ Caso: Objeto detectado.');
          // Caso 2: Es un objeto solo. ¿Es el artículo en sí o es un objeto con los artículos dentro?
          if (data.id) {
            // Si tiene ID, probablemente es un artículo suelto. Lo metemos en un array.
            console.log('   El objeto tiene ID, se trata como un único artículo.');
            articlesArray = [data];
          } else {
            // Si no tiene ID, podría ser un objeto con una propiedad que contiene los artículos (ej. { articles: [...] })
            console.warn('   El objeto no tiene ID. Buscando propiedades con arrays...');
            // Intento 1: Buscar una propiedad común que pueda contener los artículos
            const possibleArticleKeys = ['articles', 'items', 'data', 'docs'];
            for (const key of possibleArticleKeys) {
              if (data[key] && Array.isArray(data[key])) {
                console.log(`   Encontrado array en propiedad "${key}". Usándolo.`);
                articlesArray = data[key].filter(item => item && typeof item === 'object');
                break;
              }
            }
            // Si no encontró nada, articlesArray se queda como []
          }
        } else {
          console.warn('⚠️ Datos vacíos o en formato no reconocido.');
        }
        // --- FIN DE LA LÓGICA ROBUSTA ---

        console.log('🎯 Artículos NORMALIZADOS (articlesArray):', articlesArray);
        console.log('🎯 Primer artículo (si existe):', articlesArray[0]);

        // Actualizamos los estados
        setArticles(articlesArray);
        setFilteredArticles(articlesArray);
        
        // Cargar collections.json (sin cambios)
        console.log('📂 Intentando cargar collections.json');
        const collectionsResponse = await fetch('/collections/collections.json');
        if (collectionsResponse.ok) {
          const collectionsData = await collectionsResponse.json();
          console.log('   collections.json cargado:', collectionsData);
          const currentCollection = collectionsData.find(
            col => col['carpet-name'] === folderName
          );
          setCollectionMeta(currentCollection || null);
          console.log('   Metadatos de colección encontrados:', currentCollection);
        } else {
          console.warn('   No se pudo cargar collections.json');
        }

      } catch (err) {
        console.error('❌ Error GORDO en fetchCollectionData:', err);
        setError(err.message);
        setArticles([]);
        setFilteredArticles([]);
      } finally {
        setLoading(false);
        console.log('🏁 fetchCollectionData finalizado. loading = false');
      }
    };

    if (folderName) {
      fetchCollectionData();
    } else {
      console.warn('⚠️ No hay folderName en useParams');
    }
  }, [folderName]);

  // Leer el término de búsqueda de la URL al cargar
  useEffect(() => {
    const term = searchParams.get('collection_search') || '';
    setSearchInput(term);
  }, [searchParams]);

  // Efecto para filtrar artículos (usando debouncedSearch)
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

    console.log(`🔎 Filtrando por: "${lowerTerm}" en ${articles.length} artículos.`);
    const filtered = articles.filter((article) => {
      // Asegurarse de que article existe y es un objeto
      if (!article) return false;

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

      const result = (
        title.toLowerCase().includes(lowerTerm) ||
        abstract.toLowerCase().includes(lowerTerm) ||
        authors.toLowerCase().includes(lowerTerm) ||
        keywords.toLowerCase().includes(lowerTerm) ||
        article.id?.toLowerCase().includes(lowerTerm)
      );
      return result;
    });
    
    console.log(`   Resultado del filtro: ${filtered.length} artículos.`);
    setFilteredArticles(filtered);
  }, [debouncedSearch, articles, language]);

  // Efecto para actualizar URL cuando cambia la búsqueda
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

  console.log('🖥️ Renderizando SingleCollectionView. filteredArticles:', filteredArticles.length);

  // --- SPINNER DE CARGA (LOADING) ---
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

  // --- PANTALLA DE ERROR ---
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

  // --- VISTA PRINCIPAL (CON ARTÍCULOS) ---
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

      {/* BUSCADOR */}
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

      {/* LISTA DE ARTÍCULOS */}
      <div className="space-y-4">
        {/* Caso: No hay artículos en la colección */}
        {!articles.length ? (
          <div className="bg-white border border-gray-200 p-12 text-center rounded-sm">
            <p className="text-lg text-gray-600 font-serif italic">
              {isSpanish 
                ? 'Esta colección no tiene artículos disponibles.' 
                : 'This collection has no articles available.'}
            </p>
          </div>
        ) : filteredArticles.length === 0 ? (
          /* Caso: Hay artículos pero ninguno coincide con la búsqueda */
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
          /* Caso: Hay artículos y se muestran */
          <div>
            {/* Panel de Debug (opcional, lo puedes quitar cuando todo funcione) */}
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-sm text-xs">
              <p className="font-bold">🔧 DEBUG: {filteredArticles.length} artículo(s) a renderizar</p>
              <p>ID del primero: {filteredArticles[0]?.id}</p>
              <p>Título (ES): {filteredArticles[0]?.name?.spanish}</p>
              <p>Tipo de datos pasado a CollectionArticleCard: {typeof filteredArticles[0]}</p>
              <p>¿Es un array? {Array.isArray(filteredArticles[0]) ? '⚠️ SÍ (error)' : '✅ No (bien)'}</p>
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