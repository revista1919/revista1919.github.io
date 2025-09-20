import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Papa from 'papaparse';
import { auth } from './firebase';
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut,
} from 'firebase/auth';
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

const USERS_CSV = process.env.REACT_APP_USERS_CSV || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';

function App() {
  const { t } = useTranslation();
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

  // Fetch user data from CSV
  const fetchUserData = async (email) => {
    try {
      console.log('🔍 Buscando datos de usuario en CSV:', email);
      const response = await fetch(USERS_CSV, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error al cargar CSV: ${response.status} ${response.statusText}`);
      }
      
      const csvText = await response.text();
      const { data, errors } = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        delimiter: ',',
        transform: (value) => value?.toString().trim(),
      });

      if (errors.length > 0) {
        console.warn('⚠️ Errores al parsear CSV de usuarios:', errors);
      }

      const csvUser = data.find(
        (u) =>
          u.Correo?.toLowerCase() === email.toLowerCase() ||
          u['E-mail']?.toLowerCase() === email.toLowerCase()
      );

      const userData = {
        name: csvUser?.Nombre || csvUser?.['Nombre completo'] || email,
        role: csvUser?.['Rol en la Revista'] || csvUser?.Rol || 'Usuario',
        image: csvUser?.Imagen || csvUser?.['URL de imagen'] || '',
      };

      console.log('✅ Datos de usuario encontrados:', userData);
      return userData;
    } catch (err) {
      console.error('❌ Error fetching user CSV:', err);
      return { name: email, role: 'Usuario', image: '' };
    }
  };

  // Persistencia y estado de autenticación
  useEffect(() => {
    const setupAuth = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
        console.log('🔐 Persistencia de autenticación configurada');
      } catch (error) {
        console.warn('⚠️ No se pudo configurar persistencia:', error);
      }

      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        console.log('🔍 onAuthStateChanged fired:', firebaseUser ? firebaseUser.email : 'No user');
        
        if (firebaseUser) {
          try {
            const storedUser = localStorage.getItem('userData');
            let userData;
            
            if (storedUser) {
              try {
                const parsedStored = JSON.parse(storedUser);
                if (
                  parsedStored &&
                  parsedStored.uid === firebaseUser.uid &&
                  parsedStored.email === firebaseUser.email
                ) {
                  userData = parsedStored;
                  console.log('✅ Usuario encontrado en localStorage');
                }
              } catch (parseError) {
                console.warn('⚠️ Error parseando localStorage:', parseError);
              }
            }

            if (!userData) {
              console.log('🔍 Buscando datos en CSV...');
              const csvData = await fetchUserData(firebaseUser.email);
              userData = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                ...csvData,
              };
              localStorage.setItem('userData', JSON.stringify(userData));
              console.log('💾 Usuario guardado en localStorage');
            }

            setUser(userData);
            console.log('✅ Usuario autenticado:', userData);
          } catch (error) {
            console.error('❌ Error procesando usuario:', error);
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.email,
              role: 'Usuario',
              image: '',
            });
          }
        } else {
          setUser(null);
          localStorage.removeItem('userData');
          console.log('👋 No hay usuario autenticado');
        }
        
        setAuthLoading(false);
      });

      return () => {
        unsubscribe();
        console.log('🧹 Cleanup de auth listener');
      };
    };

    setupAuth().catch((error) => {
      console.error('❌ Error al configurar autenticación:', error);
      setAuthLoading(false);
    });
  }, []);

  // Fetch de artículos CSV
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const ARTICLES_CSV = process.env.REACT_APP_ARTICULOS_SCRIPT_URL || 
          'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv';
        
        console.log('📄 Fetching artículos desde:', ARTICLES_CSV);
        
        const response = await fetch(ARTICLES_CSV, { 
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          }
        });

        if (!response.ok) {
          throw new Error(`Error al cargar el archivo CSV: ${response.status} ${response.statusText}`);
        }

        const csvText = await response.text();
        const { data, errors } = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          delimiter: ',',
          transform: (value) => value?.toString().trim(),
          dynamicTyping: false,
        });

        if (errors.length > 0) {
          console.warn('⚠️ Errores al parsear CSV de artículos:', errors);
        }

        console.log(`✅ ${data.length} artículos cargados`);
        setArticles(data);
        setFilteredArticles(data);

        const uniqueAreas = [...new Set(data.map((a) => a['Área temática']).filter(Boolean))];
        setAreas(uniqueAreas);
        console.log(`📂 ${uniqueAreas.length} áreas únicas encontradas:`, uniqueAreas);

        setLoading(false);
      } catch (error) {
        console.error('❌ Error fetching CSV:', error);
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
        !term ||
        article['Título']?.toLowerCase().includes(lowerTerm) ||
        article['Autor(es)']?.toLowerCase().includes(lowerTerm) ||
        article['Resumen']?.toLowerCase().includes(lowerTerm) ||
        article['Palabras clave']?.toLowerCase().includes(lowerTerm) ||
        article['Abstract']?.toLowerCase().includes(lowerTerm);

      const matchesArea =
        !area || (article['Área temática'] || '').toLowerCase() === area.toLowerCase();

      return matchesSearch && matchesArea;
    });

    setFilteredArticles(filtered);
    setVisibleArticles(6);
    console.log(`🔍 Búsqueda: "${term}" en área "${area}", ${filtered.length} resultados`);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedArea('');
    setFilteredArticles(articles);
    setVisibleArticles(6);
    console.log('🧹 Filtros limpiados');
  };

  const loadMoreArticles = () => {
    setVisibleArticles((prev) => prev + 6);
    console.log('➕ Cargando más artículos');
  };

  const showLessArticles = () => {
    setVisibleArticles(6);
    console.log('⬇️ Mostrar menos artículos');
  };

  // Login manual
  const handleLogin = async (userData) => {
    console.log('🔐 handleLogin called with:', userData);
    
    if (!userData || !userData.email) {
      setUser(null);
      localStorage.removeItem('userData');
      console.log('❌ No hay datos de usuario válidos en handleLogin');
      return;
    }

    try {
      const csvData = await fetchUserData(userData.email);
      const updatedUserData = {
        uid: userData.uid || `manual_${Date.now()}`,
        email: userData.email,
        ...csvData,
      };
      
      setUser(updatedUserData);
      localStorage.setItem('userData', JSON.stringify(updatedUserData));
      setActiveTab('login');
      console.log('✅ Usuario autenticado manualmente:', updatedUserData);
    } catch (error) {
      console.error('❌ Error en handleLogin:', error);
      setUser(null);
      localStorage.removeItem('userData');
    }
  };

  // Logout manual
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      localStorage.removeItem('userData');
      setActiveTab('articles');
      console.log('👋 Logout ejecutado correctamente');
    } catch (error) {
      console.error('❌ Error al cerrar sesión:', error);
      // Forzar logout local
      setUser(null);
      localStorage.removeItem('userData');
      setActiveTab('articles');
    }
  };

  // Secciones de tabs con traducciones
  const sections = [
    {
      name: 'articles',
      label: t('articles'),
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
              <div className="col-span-full flex justify-center items-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5a3e36] mx-auto mb-2"></div>
                  <p className="text-sm sm:text-base text-gray-600">{t('loading')}</p>
                </div>
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <p className="text-sm sm:text-base text-gray-600">{t('noArticlesFound')}</p>
                <button
                  onClick={clearFilters}
                  className="mt-2 bg-[#5a3e36] text-white px-4 py-2 rounded-md hover:bg-[#7a5c4f] text-sm"
                >
                  {t('clearFilters')}
                </button>
              </div>
            ) : (
              filteredArticles.slice(0, visibleArticles).map((article) => (
                <ArticleCard key={`${article['Título']}-${article['Autor(es)']}`} article={article} />
              ))
            )}
          </div>
          {!loading && filteredArticles.length > visibleArticles && (
            <div className="text-center mt-6">
              <button
                className="bg-[#5a3e36] text-white px-4 py-2 rounded-md hover:bg-[#7a5c4f] focus:outline-none focus:ring-2 focus:ring-[#5a3e36] text-sm sm:text-base transition-colors"
                onClick={loadMoreArticles}
              >
                {t('loadMore')}
              </button>
            </div>
          )}
          {!loading && visibleArticles > 6 && (
            <button
              className="fixed bottom-4 right-4 bg-[#5a3e36] text-white px-4 py-2 rounded-md hover:bg-[#7a5c4f] focus:outline-none focus:ring-2 focus:ring-[#5a3e36] z-10 text-sm sm:text-base shadow-lg transition-colors"
              onClick={showLessArticles}
            >
              {t('showLess')}
            </button>
          )}
        </div>
      ),
    },
    {
      name: 'submit',
      label: t('submit'),
      component: <SubmitSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'team',
      label: t('team'),
      component: <TeamSection setActiveTab={setActiveTab} className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'admin',
      label: user?.role === 'Administrador' ? t('admin') : null,
      component: user?.role === 'Administrador' ? (
        <div className="py-8 max-w-7xl mx-auto">
          <AdminSection user={user} />
        </div>
      ) : null,
      hidden: user?.role !== 'Administrador',
    },
    {
      name: 'about',
      label: t('about'),
      component: <AboutSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'guidelines',
      label: t('guidelines'),
      component: <GuidelinesSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'faq',
      label: t('faq'),
      component: <FAQSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'news',
      label: t('news'),
      component: <NewsSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'login',
      label: t('login'),
      component: (
        <div className={`py-8 ${user ? 'w-full' : 'max-w-lg mx-auto'}`}>
          {!user && (
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-[#5a3e36] mb-4">
                {t('authorPortal')}
              </h2>
              <p className="text-[#7a5c4f] mb-6 max-w-md mx-auto">
                {t('authorPortalDescription') || 'Esta sección es solo para autores y revisores/autores con permisos especiales.'}
              </p>
            </div>
          )}
          {user ? (
            <PortalSection user={user} onLogout={handleLogout} />
          ) : (
            <LoginSection onLogin={handleLogin} onLogout={handleLogout} />
          )}
        </div>
      ),
    },
  ].filter(section => section.component !== null); // Filtrar secciones ocultas

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f4ece7] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5a3e36] mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loadingAuthentication')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4ece7] flex flex-col">
      <Header 
        user={user} 
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        className="w-full m-0 p-0" 
      />
      <main className="flex-grow">
        <div
          className={`container ${
            user && activeTab === 'login'
              ? 'max-w-full px-0'
              : 'mx-auto px-4 sm:px-6 lg:px-8'
          }`}
        >
          <Tabs 
            sections={sections} 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
          />
        </div>
      </main>
      <Footer className="w-full m-0 p-0 mt-auto" />
    </div>
  );
}

export default App;