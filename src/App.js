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
import LoginSection from './components/LoginSection';
import PortalSection from './components/PortalSection';
import NewsSection from './components/NewsSection';

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
  const [user, setUser] = useState(null);

  // Fetch articles from CSV
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const response = await fetch(
          'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv',
          { cache: 'no-store' }
        );
        if (!response.ok) throw new Error(`Error al cargar el archivo CSV: ${response.status}`);
        const csvText = await response.text();
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          delimiter: ',',
          transform: (value) => value.trim(),
          complete: ({ data }) => {
            setArticles(data);
            setFilteredArticles(data);
            const uniqueAreas = [...new Set(data.map((a) => a['Área temática']))].filter(Boolean);
            setAreas(uniqueAreas);
            setLoading(false);
          },
          error: (error) => {
            console.error('Error parsing CSV:', error);
            setLoading(false);
          },
        });
      } catch (error) {
        console.error('Error fetching CSV:', error);
        setLoading(false);
      }
    };
    fetchArticles();
  }, []);

  // Handle search and filters
  const handleSearch = (term, area) => {
    setSearchTerm(term);
    setSelectedArea(area);
    const lowerTerm = term.toLowerCase();
    const filtered = articles.filter((article) => {
      const matchesSearch =
        article['Título']?.toLowerCase().includes(lowerTerm) ||
        article['Autor(es)']?.toLowerCase().includes(lowerTerm) ||
        article['Resumen']?.toLowerCase().includes(lowerTerm) ||
        article['Palabras clave']?.toLowerCase().includes(lowerTerm);
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

  // Handle login
  const handleLogin = (user) => {
    setUser(user);
    setActiveTab('login');
  };

  // Handle logout
  const handleLogout = () => {
    setUser(null);
  };

  // Define sections for tabs
  const sections = [
    {
      name: 'articles',
      label: 'Artículos',
      component: (
        <div className="py-8 max-w-7xl mx-auto">
          <SearchAndFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedArea={selectedArea}
            setSelectedArea={setSelectedArea}
            areas={areas}
            onSearch={handleSearch}
            clearFilters={clearFilters}
          />
          <div className="articles grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-6">
            {loading ? (
              <p className="text-center text-sm sm:text-base text-gray-600 col-span-full">Cargando...</p>
            ) : filteredArticles.length === 0 ? (
              <p className="text-center text-sm sm:text-base text-gray-600 col-span-full">No se encontraron artículos</p>
            ) : (
              filteredArticles.slice(0, visibleArticles).map((article) => (
                <ArticleCard key={article['Título']} article={article} />
              ))
            )}
          </div>
          {!loading && filteredArticles.length > visibleArticles && (
            <div className="text-center mt-6">
              <button
                className="bg-[#5a3e36] text-white px-4 py-2 rounded-md hover:bg-[#7a5c4f] focus:outline-none focus:ring-2 focus:ring-[#5a3e36] text-sm sm:text-base"
                onClick={loadMoreArticles}
              >
                Cargar más
              </button>
            </div>
          )}
          {!loading && visibleArticles > 6 && (
            <button
              className="fixed bottom-4 right-4 bg-[#5a3e36] text-white px-4 py-2 rounded-md hover:bg-[#7a5c4f] focus:outline-none focus:ring-2 focus:ring-[#5a3e36] z-10 text-sm sm:text-base"
              onClick={showLessArticles}
            >
              Mostrar menos
            </button>
          )}
        </div>
      ),
    },
    {
      name: 'submit',
      label: 'Enviar Artículo',
      component: <SubmitSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'team',
      label: 'Nuestro Equipo',
      component: <TeamSection setActiveTab={setActiveTab} className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'admin',
      label: 'Administración',
      component: (
        <div className="py-8 max-w-7xl mx-auto">
          <AdminSection />
        </div>
      ),
    },
    {
      name: 'about',
      label: 'Acerca de',
      component: <AboutSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'guidelines',
      label: 'Guías',
      component: <GuidelinesSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'faq',
      label: 'Preguntas Frecuentes',
      component: <FAQSection className="py-8 max-w-7xl mx-auto" />,
    },
    
    {
      name: 'news',
      label: 'Noticias',
      component: <NewsSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'login',
      label: 'Login / Estado de Artículos',
      component: (
        <div className="py-8 max-w-lg mx-auto">
          <h2 className="text-2xl font-semibold text-center text-[#5a3e36] mb-4">
            Interfaz para Autores y Revisores
          </h2>
          <p className="text-center text-[#7a5c4f] mb-6">
            Esta sección es solo para autores y revisores/autores con permisos especiales.
          </p>
          {user ? (
            <PortalSection user={user} onLogout={handleLogout} />
          ) : (
            <LoginSection onLogin={handleLogin} />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#f4ece7] flex flex-col">
      <style>
        {`
          .full-width-header {
            width: 100%;
            margin: 0;
            padding-left: 0;
            padding-right: 0;
            padding-top: 0;
          }
          .full-width-footer {
            width: 100%;
            margin: 0;
            padding-left: 0;
            padding-right: 0;
            padding-bottom: 0;
            margin-top: auto;
          }
        `}
      </style>
      <Header className="full-width-header" />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex-grow">
        <Tabs sections={sections} activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
      <Footer className="full-width-footer" />
    </div>
  );
}

export default App;