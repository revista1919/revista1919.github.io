'use client';
import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import SearchAndFilters from '../../components/SearchAndFilters';
import ArticleCard from '../../components/ArticleCard';
import { useTranslations } from 'next-intl';

export default function Home({ params: { locale } }) {
  const t = useTranslations('Home'); // Namespace específico para la home
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleArticles, setVisibleArticles] = useState(6);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Primero intenta cargar desde JSON local (generado por el script)
  // Fallback a CSV si no existe
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        // Intentar cargar JSON local primero (más rápido, offline)
        const jsonResponse = await fetch(`/articles.json`);
        if (jsonResponse.ok) {
          const jsonData = await jsonResponse.json();
          // Convertir a formato CSV si es necesario
          const csvFormattedData = jsonData.map(article => ({
            'Título': article.titulo,
            'Autor(es)': article.autores,
            'Resumen': article.resumen,
            'Palabras clave': article.palabras_clave?.join('; ') || '',
            'Área temática': article.area,
            'Fecha': article.fecha,
            'Volumen': article.volumen,
            'Número': article.numero,
            'Número de artículo': article.numeroArticulo,
            'Abstract': article.englishAbstract
          }));
          setArticles(csvFormattedData);
          setFilteredArticles(csvFormattedData);
          const uniqueAreas = [...new Set(csvFormattedData.map((a) => a['Área temática']))].filter(Boolean);
          setAreas(uniqueAreas);
          setDataLoaded(true);
          setLoading(false);
          console.log('✅ Artículos cargados desde JSON local');
          return;
        }
      } catch (jsonError) {
        console.warn('JSON no disponible, cargando desde CSV:', jsonError);
      }

      // Fallback: Cargar desde CSV (tu método original)
      try {
        const csvUrl = process.env.NEXT_PUBLIC_ARTICLES_CSV_URL || 
          'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv';
        
        const response = await fetch(csvUrl, { 
          cache: 'no-store',
          headers: {
            'Accept': 'text/csv',
          }
        });
        
        if (!response.ok) {
          throw new Error(`Error al cargar el archivo CSV: ${response.status} ${response.statusText}`);
        }
        
        const csvText = await response.text();
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          delimiter: ',',
          transform: (value) => value?.toString().trim() || '',
          complete: ({ data }) => {
            // Filtrar artículos válidos
            const validArticles = data.filter(article => 
              article['Título']?.trim() && 
              article['Número de artículo']?.trim()
            );
            
            setArticles(validArticles);
            setFilteredArticles(validArticles);
            const uniqueAreas = [...new Set(validArticles.map((a) => a['Área temática']))]
              .filter(Boolean)
              .sort();
            setAreas(uniqueAreas);
            setDataLoaded(true);
            setLoading(false);
            console.log(`✅ Artículos cargados desde CSV: ${validArticles.length}`);
          },
          error: (error) => {
            console.error('Error parsing CSV:', error);
            setLoading(false);
          },
        });
      } catch (error) {
        console.error('Error fetching CSV:', error);
        // Mostrar mensaje de error traducido
        setLoading(false);
      }
    };

    fetchArticles();
  }, [locale]);

  // Función de búsqueda y filtrado optimizada
  const handleSearch = (term, area) => {
    setSearchTerm(term);
    setSelectedArea(area);
    
    if (!dataLoaded || articles.length === 0) return;

    const lowerTerm = term.toLowerCase().trim();
    const lowerArea = area.toLowerCase().trim();
    
    const filtered = articles.filter((article) => {
      // Búsqueda en múltiples campos
      const titleMatch = article['Título']?.toLowerCase().includes(lowerTerm);
      const authorsMatch = article['Autor(es)']?.toLowerCase().includes(lowerTerm);
      const summaryMatch = article['Resumen']?.toLowerCase().includes(lowerTerm);
      const keywordsMatch = article['Palabras clave']?.toLowerCase().includes(lowerTerm);
      const abstractMatch = article['Abstract']?.toLowerCase().includes(lowerTerm);
      
      const matchesSearch = lowerTerm === '' || 
        titleMatch || authorsMatch || summaryMatch || keywordsMatch || abstractMatch;
      
      const matchesArea = lowerArea === '' || 
        (article['Área temática'] || '').toLowerCase() === lowerArea;
      
      return matchesSearch && matchesArea;
    });

    setFilteredArticles(filtered);
    setVisibleArticles(6); // Reset pagination
  };

  // Limpiar filtros
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedArea('');
    setFilteredArticles(articles);
    setVisibleArticles(6);
  };

  // Paginación
  const loadMoreArticles = () => {
    setVisibleArticles((prev) => Math.min(prev + 6, filteredArticles.length));
  };

  const showLessArticles = () => {
    setVisibleArticles(6);
  };

  // Mostrar estado de carga con fallback
  if (loading) {
    return (
      <div className="py-12 max-w-7xl mx-auto">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#5a3e36]"></div>
          <p className="mt-4 text-lg text-gray-600">
            {t('loadingArticles') || 'Cargando artículos...'}
          </p>
        </div>
      </div>
    );
  }

  // No hay datos
  if (!dataLoaded || articles.length === 0) {
    return (
      <div className="py-12 max-w-7xl mx-auto">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-[#5a3e36] mb-4">
            {t('noArticles') || 'No hay artículos disponibles'}
          </h2>
          <p className="text-gray-600">
            {t('tryLater') || 'Intenta recargar la página más tarde.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-[#5a3e36] text-white px-6 py-2 rounded-md hover:bg-[#7a5c4f] transition-colors"
          >
            {t('reload') || 'Recargar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 max-w-7xl mx-auto">
      {/* Header de la sección */}
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-[#5a3e36] mb-4">
          {t('articlesTitle') || 'Artículos Científicos'}
        </h1>
        <p className="text-xl text-gray-700 max-w-3xl mx-auto">
          {t('articlesSubtitle') || 'Explora nuestra colección de investigaciones estudiantiles revisadas por pares'}
        </p>
        <p className="text-sm text-gray-500 mt-2">
          {t('totalArticles', { count: articles.length }) || `Mostrando ${articles.length} artículos disponibles`}
        </p>
      </div>

      {/* Componente de búsqueda y filtros */}
      <SearchAndFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedArea={selectedArea}
        setSelectedArea={setSelectedArea}
        areas={areas}
        onSearch={handleSearch}
        clearFilters={clearFilters}
        totalCount={articles.length}
        filteredCount={filteredArticles.length}
      />

      {/* Grid de artículos */}
      <div className="articles grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-8">
        {filteredArticles.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="text-gray-500">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('noResults') || 'No se encontraron resultados'}
              </h3>
              <p className="text-gray-500">
                {t('tryDifferentSearch') || 'Intenta con diferentes términos de búsqueda o filtros'}
              </p>
              <button
                onClick={clearFilters}
                className="mt-4 bg-[#5a3e36] text-white px-4 py-2 rounded-md hover:bg-[#7a5c4f] transition-colors"
              >
                {t('clearFilters') || 'Limpiar filtros'}
              </button>
            </div>
          </div>
        ) : (
          filteredArticles.slice(0, visibleArticles).map((article) => (
            <ArticleCard 
              key={`${article['Número de artículo']}-${article['Título']}`}
              article={article}
              locale={locale}
            />
          ))
        )}
      </div>

      {/* Paginación */}
      {!loading && filteredArticles.length > 0 && (
        <div className="text-center mt-8 space-y-4">
          {filteredArticles.length > visibleArticles && (
            <button
              onClick={loadMoreArticles}
              disabled={visibleArticles >= filteredArticles.length}
              className="bg-[#5a3e36] text-white px-6 py-3 rounded-md hover:bg-[#7a5c4f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base font-medium"
            >
              {t('loadMore', { remaining: filteredArticles.length - visibleArticles }) || 
               `Cargar más (${filteredArticles.length - visibleArticles} restantes)`}
            </button>
          )}
          
          {visibleArticles > 6 && (
            <button
              onClick={showLessArticles}
              className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors text-sm"
            >
              {t('showLess') || 'Mostrar menos'}
            </button>
          )}
        </div>
      )}

      {/* Botón flotante para mostrar menos (solo en mobile) */}
      {!loading && visibleArticles > 6 && filteredArticles.length > visibleArticles && (
        <button
          onClick={showLessArticles}
          className="fixed bottom-6 right-6 bg-[#5a3e36] text-white p-3 rounded-full shadow-lg hover:bg-[#7a5c4f] transition-colors z-20 md:hidden"
          aria-label={t('showLess') || 'Mostrar menos artículos'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}

      {/* Estadísticas de filtros */}
      {searchTerm || selectedArea ? (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm text-blue-800">
            <span>{t('filteredResults') || 'Resultados filtrados:'}</span>
            {searchTerm && (
              <span className="ml-2">
                "{searchTerm}" 
                {selectedArea && <span>, </span>}
              </span>
            )}
            {selectedArea && (
              <span className="font-medium">
                {t('area') || 'Área:'} {selectedArea}
              </span>
            )}
            <span className="ml-2">({filteredArticles.length}/{articles.length})</span>
            <button
              onClick={clearFilters}
              className="ml-3 text-blue-600 hover:text-blue-800 underline"
            >
              {t('clearAll') || 'Limpiar todo'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}