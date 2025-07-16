import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import SearchAndFilters from './components/SearchAndFilters';
import ArticleCard from './components/ArticleCard';
import SubmitSection from './components/SubmitSection';
import AdminSection from './components/AdminSection';
import AboutSection from './components/AboutSection';
import GuidelinesSection from './components/GuidelinesSection';
import FAQSection from './components/FAQSection';
import Footer from './components/Footer'; // ✅ Importación agregada
import './index.css';

function App() {
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv');
        const csvText = await response.text();
        const articlesData = parseCSV(csvText);
        setArticles(articlesData);
        setFilteredArticles(articlesData);
        const uniqueAreas = [...new Set(articlesData.map(article => article['Área temática'] || ''))];
        setAreas(uniqueAreas);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching articles:', error);
        setLoading(false);
      }
    };
    fetchArticles();
  }, []);

  const parseCSV = (csv) => {
    const lines = csv.split('\n');
    const headers = lines[0].split(',').map(header => header.trim());
    const result = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(value => value.trim());
      if (values.length === headers.length) {
        const article = {};
        headers.forEach((header, index) => {
          article[header] = values[index];
        });
        result.push(article);
      }
    }
    return result;
  };

  const handleSearch = (term, area) => {
    setSearchTerm(term);
    setSelectedArea(area);
    const filtered = articles.filter(article =>
      article['Título'].toLowerCase().includes(term.toLowerCase()) &&
      (area === '' || (article['Área temática'] || '').toLowerCase() === area.toLowerCase())
    );
    setFilteredArticles(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedArea('');
    setFilteredArticles(articles);
  };

  return React.createElement(
    'div',
    { className: 'container' },
    React.createElement(Header, null),
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
      { className: 'articles grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6' },
      loading
        ? React.createElement('p', { className: 'text-center' }, 'Cargando...')
        : filteredArticles.map(article =>
            React.createElement(ArticleCard, { key: article['Título'], article })
          )
    ),
    React.createElement(SubmitSection, null),
    React.createElement(AdminSection, null),
    React.createElement(AboutSection, null),
    React.createElement(GuidelinesSection, null),
    React.createElement(FAQSection, null),
    React.createElement(Footer, null) // ✅ Ahora sí se renderiza sin romper nada
  );
}

export default App;
