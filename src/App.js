import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { auth } from './firebase';
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut,
} from 'firebase/auth';
import { Routes, Route, useLocation, NavLink } from 'react-router-dom';
import { useLanguage } from './hooks/useLanguage';
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
import { motion, AnimatePresence } from 'framer-motion';

const USERS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';
const isPrerendering = typeof navigator !== 'undefined' && navigator.userAgent.includes('ReactSnap');

function App() {
  const { cleanPath } = useLanguage();
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleArticles, setVisibleArticles] = useState(6);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  // Fetch user data from CSV
  const fetchUserData = async (email) => {
    try {
      const response = await fetch(USERS_CSV, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Error al cargar CSV: ${response.status}`);
      const csvText = await response.text();
      const { data } = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        delimiter: ',',
        transform: (value) => value?.toString().trim(),
      });
      const csvUser = data.find(
        (u) =>
          u.Correo?.toLowerCase() === email.toLowerCase() ||
          u['E-mail']?.toLowerCase() === email.toLowerCase()
      );
      return {
        name: csvUser?.Nombre || email,
        role: csvUser?.['Rol en la Revista'] || 'Usuario',
        image: csvUser?.Imagen || '',
      };
    } catch (err) {
      console.error('Error fetching user CSV:', err);
      return { name: email, role: 'Usuario', image: '' };
    }
  };

  // Persistencia y estado de autenticación
  useEffect(() => {
    if (isPrerendering) {
      setAuthLoading(false);
      return;
    }

    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          console.log('onAuthStateChanged fired:', firebaseUser ? firebaseUser.email : 'No user');
          if (firebaseUser) {
            const storedUser = JSON.parse(localStorage.getItem('userData'));
            let userData;
            if (
              storedUser &&
              storedUser.uid === firebaseUser.uid &&
              storedUser.email === firebaseUser.email
            ) {
              userData = storedUser;
            } else {
              const csvData = await fetchUserData(firebaseUser.email);
              userData = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                name: csvData.name,
                role: csvData.role,
                image: csvData.image,
              };
              localStorage.setItem('userData', JSON.stringify(userData));
            }
            setUser(userData);
            console.log('Usuario autenticado:', userData);
          } else {
            setUser(null);
            localStorage.removeItem('userData');
            console.log('No hay usuario autenticado');
          }
          setAuthLoading(false);
        });
        return () => unsubscribe();
      })
      .catch((error) => {
        console.error('Error al configurar persistencia:', error);
        setAuthLoading(false);
      });
  }, []);

  // Fetch de artículos CSV
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

            const allAreas = data.flatMap((a) =>
              (a['Área temática'] || '')
                .split(';')
                .map((area) => area.trim())
                .filter(Boolean)
            );
            const uniqueAreas = [...new Set(allAreas)].sort(); // Ordenamos alfabéticamente para mejor UX
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

  // Búsqueda y filtros
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
        area === '' ||
        (article['Área temática'] || '')
          .toLowerCase()
          .split(';')                // separa por ;
          .map((a) => a.trim())      // limpia espacios en blanco
          .some((a) => a.toLowerCase() === area.toLowerCase()); // busca coincidencia exacta, asegurando lowercase en ambos lados

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

  // Logout manual
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      localStorage.removeItem('userData');
      console.log('Logout ejecutado en App.jsx');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Secciones de tabs
  const sections = [
    {
      name: 'articles',
      label: 'Artículos',
      path: '/es/articles',
      component: (
        <motion.div 
          className="py-8 max-w-7xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <SearchAndFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedArea={selectedArea}
            setSelectedArea={setSelectedArea}
            areas={areas}
            onSearch={handleSearch}
            clearFilters={clearFilters}
          />
          <div className="articles mt-6">
            {loading ? (
              <p className="text-center text-sm sm:text-base text-gray-600 col-span-full">
                Cargando...
              </p>
            ) : filteredArticles.length === 0 ? (
              <p className="text-center text-sm sm:text-base text-gray-600 col-span-full">
                Actualmente estamos en periodo de revisión y recolección de artículos. Envíanos el tuyo a través del formulario en la siguiente pestaña.
              </p>
            ) : (
              filteredArticles.slice(0, visibleArticles).map((article, index) => (
                <motion.div
                  key={article['Título']}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.3 }}
                >
                  <ArticleCard article={article} />
                </motion.div>
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
        </motion.div>
      ),
    },
    {
      name: 'submit',
      label: 'Enviar Artículo',
      path: '/es/submit',
      component: <SubmitSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'team',
      label: 'Nuestro Equipo',
      path: '/es/team',
      component: <TeamSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'admin',
      label: '¡Postula a algún cargo!',
      path: '/es/admin',
      component: (
        <div className="py-8 max-w-7xl mx-auto">
          <AdminSection />
        </div>
      ),
    },
    {
      name: 'about',
      label: 'Acerca de',
      path: '/es/about',
      component: <AboutSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'guidelines',
      label: 'Guías',
      path: '/es/guidelines',
      component: <GuidelinesSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'faq',
      label: 'Preguntas Frecuentes',
      path: '/es/faq',
      component: <FAQSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'news',
      label: 'Noticias',
      path: '/es/news',
      component: <NewsSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'login',
      label: 'Login',
      path: '/es/login',
      component: (
        <div className={`py-8 ${user ? 'w-full' : 'max-w-lg mx-auto'}`}>
          {!user && (
            <>
              <h2 className="text-2xl font-semibold text-center text-[#5a3e36] mb-4">
                Interfaz para Autores y Revisores
              </h2>
              <p className="text-center text-[#7a5c4f] mb-6">
                Esta sección es solo para autores y revisores/autores con permisos especiales.
              </p>
            </>
          )}
          {user ? (
            <PortalSection user={user} onLogout={handleLogout} />
          ) : (
            <LoginSection onLogout={handleLogout} />
          )}
        </div>
      ),
    },
  ];

  if (authLoading) {
    return <div className="text-center text-gray-600">Cargando autenticación...</div>;
  }

  const isLoginActive = location.pathname.includes('login');

  const framerItem = (delay) => ({
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    transition: { delay: 0.1 * delay, duration: 0.3 }
  });

  return (
    <div className="min-h-screen bg-[#f4ece7] flex flex-col">
      <Header onOpenMenu={() => setIsMenuOpen(true)} />
      <div
        className={`container ${
          user && isLoginActive
            ? 'max-w-full px-0'
            : 'mx-auto px-4 sm:px-6 lg:px-8'
        } flex-grow`}
      >
        <Tabs sections={sections} />
        <Routes>
          {sections.map((section) => (
            <Route key={section.name} path={section.path.substring(3)} element={section.component} />
          ))}
          <Route path="/" element={sections.find(s => s.name === 'articles').component} />
        </Routes>
      </div>
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              aria-hidden="true"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3 }}
              className="fixed top-0 left-0 h-full w-4/5 max-w-xs bg-white shadow-lg z-50 overflow-y-auto"
            >
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <span className="font-medium text-gray-700">Menú</span>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="text-gray-600 hover:text-gray-800 focus:outline-none"
                  aria-label="Cerrar menú"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4">
                {sections.map((section, index) => (
                  <motion.div key={section.name} {...framerItem(index)}>
                    <NavLink
                      to={section.path}
                      className={({ isActive }) =>
                        `block py-3 px-4 text-base font-medium rounded-md transition-colors ${isActive ? 'bg-[#5a3e36] text-white' : 'text-gray-700 hover:bg-gray-100'}`
                      }
                      onClick={() => setIsMenuOpen(false)}
                      aria-label={`Ir a ${section.label}`}
                    >
                      {section.label}
                    </NavLink>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <Footer className="w-full m-0 p-0 mt-auto" />
    </div>
  );
}

export default App;