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
import './index.css';

function App() {
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleArticles, setVisibleArticles] = useState(6);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv');
        if (!response.ok) throw new Error('Network response was not ok');
        const csvText = await response.text();
        const articlesData = parseCSV(csvText);
        if (articlesData.length === 0) throw new Error('No articles found in CSV');
        setArticles(articlesData);
        setFilteredArticles(articlesData);
        const uniqueAreas = [...new Set(articlesData.map(article => article['Área temática'] || ''))].filter(area => area);
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
        data.forEach(row => {
          if (row['Título'] && row['Autor'] && row['Fecha de publicación']) {
            const article = {
              Título: row['Título'] || '',
              Autor: row['Autor'] || '',
              Resumen: row['Resumen'] || '',
              'Link al PDF': row['Link al PDF'] || '',
              'Fecha de publicación': row['Fecha de publicación'] || '',
              'Área temática': row['Área temática'] || '',
              Area: row['Área temática'] || 'No especificada',
            };
            result.push(article);
          }
        });
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
      },
    });
    return result;
  };

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

  const handleSearch = (term, area) => {
    setSearchTerm(term);
    setSelectedArea(area);
    const lowerTerm = term.toLowerCase();
    const filtered = articles.filter(article => {
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

  const loadMoreArticles = () => {
    setVisibleArticles(prev => prev + 6);
  };

  const showLessArticles = () => {
    setVisibleArticles(6);
  };

  // Definir las secciones para las pestañas
  const sections = [
    {
      name: 'articles',
      label: 'Artículos',
      component: React.createElement(
        'div',
        null,
        React.createElement(SearchAndFilters, {
          searchTerm,
          setSearchTerm,
          selectedArea,
          setSelectedArea,
          areas,
          onSearch: handleSearch,
          clearFilters,
        }),
        React.createElement(
          'div',
          { className: 'articles grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 mt-4 sm:mt-6' },
          loading
            ? React.createElement('p', { className: 'text-center text-sm sm:text-base' }, 'Cargando...')
            : filteredArticles.slice(0, visibleArticles).map(article =>
                React.createElement(ArticleCard, { key: article['Título'], article })
              )
        ),
        !loading && filteredArticles.length > visibleArticles &&
          React.createElement(
            'div',
            { className: 'text-center mt-4 sm:mt-6' },
            React.createElement(
              'button',
              {
                className: 'bg-blue-500 text-white px-3 sm:px-4 py-2 sm:py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base',
                onClick: loadMoreArticles,
              },
              'Cargar más'
            )
          ),
        !loading && visibleArticles > 6 &&
          React.createElement(
            'button',
            {
              className: 'fixed bottom-4 right-4 bg-blue-500 text-white px-3 sm:px-4 py-2 sm:py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 z-10 text-sm sm:text-base',
              onClick: showLessArticles,
            },
            'Mostrar menos'
          )
      ),
    },
    { name: 'submit', label: 'Enviar Artículo', component: React.createElement(SubmitSection, null) },
    { name: 'team', label: 'Nuestro Equipo', component: React.createElement(TeamSection, null) },
    { name: 'admin', label: 'Administración', component: React.createElement(AdminSection, null) },
    { name: 'about', label: 'Acerca de', component: React.createElement(AboutSection, null) },
    { name: 'guidelines', label: 'Guías', component: React.createElement(GuidelinesSection, null) },
    { name: 'faq', label: 'Preguntas Frecuentes', component: React.createElement(FAQSection, null) },
  ];

  return React.createElement(
    'div',
    { className: 'container relative' },
    React.createElement(Header, null),
    React.createElement(Tabs, { sections }),
    React.createElement(Footer, null)
  );
}

export default App;