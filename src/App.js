// App.js
import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

import Header from './components/Header';
import SearchAndFilters from './components/SearchAndFilters';
import ArticleCard from './components/ArticleCard';
import Tabs from './components/Tabs';
import SubmitSection from './components/SubmitSection';
import AdminSection from './components/AdminSection';
import AboutSection from './components/AboutSection';
import GuidelinesSection from './components/GuidelinesSection';
import FAQSection from './components/FAQSection';
import TeamSection from './components/TeamSection';
import Footer from './components/Footer';
import NewsletterSection from './components/NewsletterSection';

import './index.css';

function App() {
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleArticles, setVisibleArticles] = useState(6);
  const [activeTab, setActiveTab] = useState('articles');

  // ---------------- Cargar CSV ----------------
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const response = await fetch(
          'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv'
        );
        if (!response.ok) throw new Error('Network response was not ok');
        const csvText = await response.text();
        const articlesData = parseCSV(csvText);
        setArticles(articlesData);
        setFilteredArticles(articlesData);
        const uniqueAreas = [
          ...new Set(articlesData.map((article) => article['Área temática'] || ''))
        ].filter((area) => area);
        setAreas(uniqueAreas);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching or parsing articles:', error.message);
        setLoading(false);
      }
    };
    fetchArticles();
  }, []);

  const parseCSV = (csv) => {
    const result = [];
    Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        data.forEach((row) => {
          if (row['Título'] && row['Autor'] && row['Fecha de publicación']) {
            const article = {
              Título: row['Título'] || '',
              Autor: row['Autor'] || '',
              Resumen: row['Resumen'] || '',
              'Link al PDF': row['Link al PDF'] || '',
              'Link al texto': row['Link al texto'] || '',
              'Fecha de publicación': row['Fecha de publicación'] || '',
              'Área temática': row['Área temática'] || '',
              Area: row['Área temática'] || 'No especificada'
            };
            result.push(article);
          }
        });
      },
      error: (error) => console.error('Error parsing CSV:', error)
    });
    return result;
  };

  // ---------------- Citaciones ----------------
  const journal = 'Revista Nacional de las Ciencias para Estudiantes';
  const getAPACitation = (article) => {
    const date = new Date(article['Fecha de publicación']);
    return `${article['Autor']}. (${date.getFullYear()}). ${article['Título']}. ${journal}.`;
  };
  const getMLACitation = (article) => {
    const date = new Date(article['Fecha de publicación']);
    return `${article['Autor']}. "${article['Título']}." ${journal}, ${date.getFullYear()}.`;
  };
  const getChicagoCitation = (article) => {
    const date = new Date(article['Fecha de publicación']);
    return `${article['Autor']}. "${article['Título']}." ${journal} (${date.getFullYear()}).`;
  };

  // ---------------- Filtros y búsqueda ----------------
  const handleSearch = (term, area) => {
    setSearchTerm(term);
    setSelectedArea(area);
    const lowerTerm = term.toLowerCase();
    const filtered = articles.filter((article) => {
      const apaCitation = getAPACitation(article);
      const mlaCitation = getMLACitation(article);
      const chicagoCitation = getChicagoCitation(article);
      const matchesSearch =
        article['Título'].toLowerCase().includes(lowerTerm) ||
        article['Autor'].toLowerCase().includes(lowerTerm) ||
        article['Resumen'].toLowerCase().includes(lowerTerm) ||
        apaCitation.toLowerCase().includes(lowerTerm) ||
        mlaCitation.toLowerCase().includes(lowerTerm) ||
        chicagoCitation.toLowerCase().includes(lowerTerm);
      const matchesArea = area === '' || (article['Área temática'] || '').toLowerCase() === area.toLowerCase();
      return matchesSearch && matchesArea;
    });
    setFilteredArticles(filtered);
    setVisibleArticles(6);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedArea('');
    setFilteredArticles(articles);
    setVisibleArticles(6);
  };

  const loadMoreArticles = () => setVisibleArticles((prev) => prev + 6);
  const showLessArticles = () => setVisibleArticles(6);

  // ---------------- Pestañas ----------------
  const sections = [
    {
      name: 'articles',
      label: 'Artículos',
      component: (
        <div>
          <SearchAndFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedArea={selectedArea}
            setSelectedArea={setSelectedArea}
            areas={areas}
            onSearch={handleSearch}
            clearFilters={clearFilters}
          />
          <div className="articles grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 mt-4 sm:mt-6">
            {loading
              ? <p className="text-center text-sm sm:text-base">Cargando...</p>
              : filteredArticles.slice(0, visibleArticles).map((article) => (
                  <ArticleCard key={article['Título']} article={article} />
                ))
            }
          </div>
          {!loading && filteredArticles.length > visibleArticles && (
            <div className="text-center mt-4 sm:mt-6">
              <button
                className="bg-blue-500 text-white px-3 sm:px-4 py-2 sm:py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                onClick={loadMoreArticles}
              >
                Cargar más
              </button>
            </div>
          )}
          {!loading && visibleArticles > 6 && (
            <button
              className="fixed bottom-4 right-4 bg-blue-500 text-white px-3 sm:px-4 py-2 sm:py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 z-10 text-sm sm:text-base"
              onClick={showLessArticles}
            >
              Mostrar menos
            </button>
          )}
        </div>
      )
    },
    { name: 'submit', label: 'Enviar Artículo', component: <SubmitSection /> },
    { name: 'team', label: 'Nuestro Equipo', component: <TeamSection setActiveTab={setActiveTab} /> },
    { name: 'admin', label: 'Administración', component: <AdminSection /> },
    { name: 'about', label: 'Acerca de', component: <AboutSection /> },
    { name: 'guidelines', label: 'Guías', component: <GuidelinesSection /> },
    { name: 'faq', label: 'Preguntas Frecuentes', component: <FAQSection /> },
    { name: 'newsletter', label: 'Newsletter', component: <NewsletterSection /> }
  ];

  return (
    <div className="container relative">
      <Header />
      <Tabs sections={sections} activeTab={activeTab} setActiveTab={setActiveTab} />
      <Footer />
    </div>
  );
}

export default App;
