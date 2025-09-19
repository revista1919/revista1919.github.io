import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { auth } from './firebase'; // Asegúrate de importar auth desde tu archivo firebase.js
import { onAuthStateChanged, setPersistence, browserSessionPersistence } from 'firebase/auth';

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
  const [authLoading, setAuthLoading] = useState(true);

  // Configurar persistencia de sesión y observar estado de autenticación
  useEffect(() => {
    setPersistence(auth, browserSessionPersistence)
      .then(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          if (firebaseUser) {
            // Buscar datos adicionales del usuario (esto puede variar según tu lógica)
            const userData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName || firebaseUser.email,
              role: 'Usuario', // Ajusta según la lógica de roles desde el CSV
            };
            setUser(userData);
          } else {
            setUser(null);
          }
          setAuthLoading(false);
        });
        return unsubscribe;
      })
      .catch((error) => {
        console.error('Error al configurar persistencia:', error);
        setAuthLoading(false);
      });
  }, []);

  // Fetch articles from CSV
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const response = await fetch(
          'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv',
          { cache: 'no-store' }
        );

        if (!response.ok) {
          throw new Error(`Error al cargar el archivo CSV: ${response.status}`);
        }

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

      const matchesArea =
        area === '' || (article['Área temática'] || '').toLowerCase() === area.toLowerCase();

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
  const handleLogin = (userData) => {
    setUser(userData);
    setActiveTab('login');
  };

  // Handle logout
  const handleLogout = () => {
    setUser(null);
    setActiveTab('login'); // Redirigir a la pestaña de login tras cerrar sesión
  };

  if (authLoading) {
    return <div className="text-center text-gray-600">Cargando autenticación...</div>;
  }

  return (
    <div className="min-h-screen bg-[#f4ece7] flex flex-col">
      <Header className="w-full m-0 p-0" />
      <div className={`container ${user && activeTab === 'login' ? 'max-w-full px-0' : 'mx-auto px-4 sm:px-6 lg:px-8'} flex-grow`}>
        <Tabs sections={sections} activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
      <Footer className="w-full m-0 p-0 mt-auto" />
    </div>
  );
}

export default App;