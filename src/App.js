// App.js
import React, { useState, useEffect, useMemo } from 'react';
import { auth } from './firebase';
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut,
} from 'firebase/auth';
import { Routes, Route, useLocation, NavLink, useSearchParams } from 'react-router-dom';
import { useLanguage } from './hooks/useLanguage';
import Header from './components/Header';
import SearchAndFilters from './components/SearchAndFilters';
import ReviewerResponsePage from './components/ReviewerResponsePage';
import ArticleCard from './components/ArticleCard';
import VolumeCard from './components/VolumeCard';
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
import HomeSection from './components/HomeSection';
// En AppEN.js, en la sección de imports, AÑADE:
import { Routes, Route, useLocation, NavLink, useSearchParams, Navigate } from 'react-router-dom';
//                                                              ^^^^^^^^
import './index.css';
import { motion, AnimatePresence } from 'framer-motion';

const ARTICLES_JSON = '/articles.json';
const VOLUMES_JSON = '/volumes.json';

const isPrerendering = typeof navigator !== 'undefined' && navigator.userAgent.includes('ReactSnap');

function App() {
  const { cleanPath } = useLanguage();
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [areas, setAreas] = useState([]);
  const [volumes, setVolumes] = useState([]);
  const [filteredVolumes, setFilteredVolumes] = useState([]);
  const [volumeSearchTerm, setVolumeSearchTerm] = useState('');
  const [selectedVolumeArea, setSelectedVolumeArea] = useState('');
  const [volumeAreas, setVolumeAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [volumeLoading, setVolumeLoading] = useState(true);
  const [visibleArticles, setVisibleArticles] = useState(6);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedArticleVolume, setSelectedArticleVolume] = useState('');
  const [selectedArticleNumber, setSelectedArticleNumber] = useState('');
  const [articleVolumes, setArticleVolumes] = useState([]);
  const [articleNumbers, setArticleNumbers] = useState([]);
  const [selectedVolumeVolume, setSelectedVolumeVolume] = useState('');
  const [selectedVolumeNumber, setSelectedVolumeNumber] = useState('');
  const [volumeVolumes, setVolumeVolumes] = useState([]);
  const [volumeNumbers, setVolumeNumbers] = useState([]);

  // Función para obtener datos del usuario desde Firebase/ localStorage
  const getUserData = (firebaseUser) => {
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuario',
      role: 'Usuario',
      image: firebaseUser.photoURL || '',
    };
  };

  useEffect(() => {
    if (isPrerendering) {
      setAuthLoading(false);
      return;
    }

    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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
              userData = getUserData(firebaseUser);
              localStorage.setItem('userData', JSON.stringify(userData));
            }
            setUser(userData);
          } else {
            setUser(null);
            localStorage.removeItem('userData');
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

  // Función auxiliar para obtener texto de autores
  const getAutoresText = (autores) => {
    if (!autores) return '';
    if (Array.isArray(autores)) {
      return autores.map(a => a.name || '').join(', ');
    }
    return String(autores);
  };

  // Función auxiliar para obtener instituciones
  const getInstitutionsText = (autores) => {
    if (!autores || !Array.isArray(autores)) return '';
    const institutions = autores.map(a => a.institution).filter(Boolean);
    return [...new Set(institutions)].join(', ');
  };

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const response = await fetch(ARTICLES_JSON, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Error al cargar el archivo JSON: ${response.status}`);
        }
        const data = await response.json();
        const sortedData = data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        setArticles(sortedData);
        setFilteredArticles(sortedData);

        const allAreas = sortedData.flatMap((a) =>
          (a.area || '')
            .split(';')
            .map((area) => area.trim())
            .filter(Boolean)
        );
        const uniqueAreas = [...new Set(allAreas)].sort();
        setAreas(uniqueAreas);

        // Obtener volúmenes únicos como números
        const uniqueVolumes = [...new Set(sortedData.map(a => safeString(a.volumen)))]
          .filter(Boolean)
          .sort((a, b) => {
            const numA = parseInt(a) || 0;
            const numB = parseInt(b) || 0;
            return numB - numA;
          });
        setArticleVolumes(uniqueVolumes);

        // Obtener números únicos
        const uniqueNumbers = [...new Set(sortedData.map(a => safeString(a.numero)))]
          .filter(Boolean)
          .sort((a, b) => {
            const numA = parseInt(a) || 0;
            const numB = parseInt(b) || 0;
            return numB - numA;
          });
        setArticleNumbers(uniqueNumbers);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching JSON:', error);
        setLoading(false);
      }
    };

    fetchArticles();
  }, []);

  useEffect(() => {
    const fetchVolumes = async () => {
      try {
        const response = await fetch(VOLUMES_JSON, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Error al cargar volumes.json: ${response.status}`);
        }
        const data = await response.json();
        const sortedData = data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        setVolumes(sortedData);
        setFilteredVolumes(sortedData);

        const allVolumeAreas = sortedData.flatMap((v) =>
          (v.area || '')
            .split(';')
            .map((area) => area.trim())
            .filter(Boolean)
        );
        const uniqueVolumeAreas = [...new Set(allVolumeAreas)].sort();
        setVolumeAreas(uniqueVolumeAreas);

        const uniqueVolumes = [...new Set(sortedData.map(v => safeString(v.volumen)))]
          .filter(Boolean)
          .sort((a, b) => {
            const numA = parseInt(a) || 0;
            const numB = parseInt(b) || 0;
            return numB - numA;
          });
        setVolumeVolumes(uniqueVolumes);

        const uniqueNumbers = [...new Set(sortedData.map(v => safeString(v.numero)))]
          .filter(Boolean)
          .sort((a, b) => {
            const numA = parseInt(a) || 0;
            const numB = parseInt(b) || 0;
            return numB - numA;
          });
        setVolumeNumbers(uniqueNumbers);

        setVolumeLoading(false);
      } catch (error) {
        console.error('Error fetching volumes JSON:', error);
        setVolumeLoading(false);
      }
    };

    fetchVolumes();
  }, []);

  const safeString = (val) => {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  };

  const normalizeNumberSearch = (term) => {
    if (!term) return '';
    const onlyNumbers = term.replace(/[^0-9]/g, '');
    return onlyNumbers || term.toLowerCase();
  };

  useEffect(() => {
    const lowerTerm = searchTerm.toLowerCase();
    const numericTerm = normalizeNumberSearch(searchTerm);
    
    const filtered = articles.filter((article) => {
      // Manejo seguro de autores
      const autoresText = getAutoresText(article.autores).toLowerCase();
      const institucionesText = getInstitutionsText(article.autores).toLowerCase();
      
      // Manejo seguro de palabras clave
      const keywordsText = Array.isArray(article.palabras_clave) 
        ? article.palabras_clave.join(' ').toLowerCase()
        : safeString(article.palabras_clave).toLowerCase();

      const matchesSearch =
        safeString(article.titulo).toLowerCase().includes(lowerTerm) ||
        autoresText.includes(lowerTerm) ||
        safeString(article.resumen).toLowerCase().includes(lowerTerm) ||
        institucionesText.includes(lowerTerm) ||
        keywordsText.includes(lowerTerm) ||
        safeString(article.volumen).toLowerCase().includes(lowerTerm) ||
        safeString(article.numero).toLowerCase().includes(lowerTerm) ||
        safeString(article.fecha).toLowerCase().includes(lowerTerm) ||
        safeString(article.volumen).includes(numericTerm) ||
        safeString(article.numero).includes(numericTerm);

      const matchesArea =
        selectedArea === '' ||
        safeString(article.area)
          .toLowerCase()
          .split(';')
          .map((a) => a.trim())
          .some((a) => a === selectedArea.toLowerCase());

      const matchesVolume =
        selectedArticleVolume === '' ||
        safeString(article.volumen) === selectedArticleVolume;

      const matchesNumber =
        selectedArticleNumber === '' ||
        safeString(article.numero) === selectedArticleNumber;

      return matchesSearch && matchesArea && matchesVolume && matchesNumber;
    });

    setFilteredArticles(filtered);
    setVisibleArticles(6);
  }, [searchTerm, selectedArea, selectedArticleVolume, selectedArticleNumber, articles]);

  useEffect(() => {
    const lowerTerm = volumeSearchTerm.toLowerCase();
    const numericTerm = normalizeNumberSearch(volumeSearchTerm);
    
    const filtered = volumes.filter((volume) => {
      const matchesSearch =
        safeString(volume.titulo).toLowerCase().includes(lowerTerm) ||
        safeString(volume.resumen).toLowerCase().includes(lowerTerm) ||
        (Array.isArray(volume.palabras_clave) 
          ? volume.palabras_clave.join(' ').toLowerCase().includes(lowerTerm)
          : safeString(volume.palabras_clave).toLowerCase().includes(lowerTerm)) ||
        safeString(volume.volumen).toLowerCase().includes(lowerTerm) ||
        safeString(volume.numero).toLowerCase().includes(lowerTerm) ||
        safeString(volume.volumen).includes(numericTerm) ||
        safeString(volume.numero).includes(numericTerm);

      const matchesArea =
        selectedVolumeArea === '' ||
        safeString(volume.area)
          .toLowerCase()
          .split(';')
          .map((a) => a.trim())
          .some((a) => a.toLowerCase() === selectedVolumeArea.toLowerCase());

      const matchesVolume =
        selectedVolumeVolume === '' ||
        safeString(volume.volumen) === selectedVolumeVolume;

      const matchesNumber =
        selectedVolumeNumber === '' ||
        safeString(volume.numero) === selectedVolumeNumber;

      return matchesSearch && matchesArea && matchesVolume && matchesNumber;
    });

    setFilteredVolumes(filtered);
  }, [volumeSearchTerm, selectedVolumeArea, selectedVolumeVolume, selectedVolumeNumber, volumes]);

  useEffect(() => {
    const rawPath = location.pathname.replace(/\/$/, '');
    const path = typeof cleanPath === 'function' ? cleanPath(rawPath) : rawPath;
    
    if (path === '/article' || path === '/' || path === '') {
      const term = searchParams.get('article_search') ?? '';
      const area = searchParams.get('article_area') ?? '';
      const volume = searchParams.get('article_volume') ?? '';
      const number = searchParams.get('article_number') ?? '';
      
      setSearchTerm(term);
      setSelectedArea(area);
      setSelectedArticleVolume(volume);
      setSelectedArticleNumber(number);
    } else if (path === '/volume') {
      const term = searchParams.get('volume_search') ?? '';
      const area = searchParams.get('volume_area') ?? '';
      const volume = searchParams.get('volume_volume') ?? '';
      const number = searchParams.get('volume_number') ?? '';
      
      setVolumeSearchTerm(term);
      setSelectedVolumeArea(area);
      setSelectedVolumeVolume(volume);
      setSelectedVolumeNumber(number);
    }
  }, [location.pathname, searchParams, cleanPath]);

  const handleSearch = (term, area, volume, number) => {
    const params = new URLSearchParams(searchParams);
    if (term) params.set('article_search', term); else params.delete('article_search');
    if (area) params.set('article_area', area); else params.delete('article_area');
    if (volume) params.set('article_volume', volume); else params.delete('article_volume');
    if (number) params.set('article_number', number); else params.delete('article_number');
    
    setSearchTerm(term);
    setSelectedArea(area);
    setSelectedArticleVolume(volume);
    setSelectedArticleNumber(number);
    setSearchParams(params);
  };

  const handleVolumeSearch = (term, area, volume, number) => {
    const params = new URLSearchParams(searchParams);
    if (term) params.set('volume_search', term); else params.delete('volume_search');
    if (area) params.set('volume_area', area); else params.delete('volume_area');
    if (volume) params.set('volume_volume', volume); else params.delete('volume_volume');
    if (number) params.set('volume_number', number); else params.delete('volume_number');
    
    setVolumeSearchTerm(term);
    setSelectedVolumeArea(area);
    setSelectedVolumeVolume(volume);
    setSelectedVolumeNumber(number);
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedArea('');
    setSelectedArticleVolume('');
    setSelectedArticleNumber('');
    const params = new URLSearchParams(searchParams);
    params.delete('article_search');
    params.delete('article_area');
    params.delete('article_volume');
    params.delete('article_number');
    setSearchParams(params);
  };

  const clearVolumeFilters = () => {
    setVolumeSearchTerm('');
    setSelectedVolumeArea('');
    setSelectedVolumeVolume('');
    setSelectedVolumeNumber('');
    const params = new URLSearchParams(searchParams);
    params.delete('volume_search');
    params.delete('volume_area');
    params.delete('volume_volume');
    params.delete('volume_number');
    setSearchParams(params);
  };

  const loadMoreArticles = () => setVisibleArticles((prev) => prev + 6);
  const showLessArticles = () => setVisibleArticles(6);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      localStorage.removeItem('userData');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const sections = useMemo(() => [
    {
      name: 'home',
      label: 'Inicio',
      path: '/',
      component: <HomeSection onOpenMenu={() => setIsMenuOpen(true)} />,
    },
    {
      name: 'articles',
      label: 'Artículos',
      path: '/article',
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
            placeholder="Buscar artículos..."
            quickTags={['2025', 'Vol. 1', 'Núm. 1']}
            selectedVolume={selectedArticleVolume}
            setSelectedVolume={setSelectedArticleVolume}
            volumesList={articleVolumes}
            selectedNumber={selectedArticleNumber}
            setSelectedNumber={setSelectedArticleNumber}
            numbersList={articleNumbers}
            volumeLabel="Volumen"
            numberLabel="Número"
          />
          <div className="articles mt-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#007398]"></div>
                <p className="mt-4 text-gray-500 font-serif italic">Cargando archivo bibliográfico...</p>
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="bg-white border border-gray-200 p-12 text-center rounded-sm">
                <p className="text-lg text-gray-600 font-serif italic">
                  "No se han encontrado registros para los criterios seleccionados."
                </p>
                <p className="mt-2 text-sm text-[#007398] font-bold uppercase tracking-wider">
                  ¡Sé el primero en publicar en esta área!
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-6">
                  {filteredArticles.slice(0, visibleArticles).map((article, index) => (
                    <motion.div
                      key={article.titulo + index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index % 6 * 0.05, duration: 0.3 }}
                    >
                      <ArticleCard article={article} />
                    </motion.div>
                  ))}
                </div>
                <div className="mt-12 mb-8 flex flex-col items-center border-t border-gray-200 pt-8">
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-6">
                    Mostrando {Math.min(visibleArticles, filteredArticles.length)} de {filteredArticles.length} artículos
                  </p>
                  <div className="flex gap-4">
                    {filteredArticles.length > visibleArticles && (
                      <button
                        className="px-8 py-3 bg-[#007398] text-white text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-[#005a77] transition-all shadow-sm"
                        onClick={loadMoreArticles}
                      >
                        Cargar más registros
                      </button>
                    )}
                    {visibleArticles > 6 && (
                      <button
                        className="px-8 py-3 border border-gray-300 text-gray-600 text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-white hover:text-black transition-all"
                        onClick={showLessArticles}
                      >
                        Ver menos
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      ),
    },
    {
      name: 'volumes',
      label: 'Volúmenes',
      path: '/volume',
      component: (
        <motion.div
          className="py-8 max-w-7xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <SearchAndFilters
            searchTerm={volumeSearchTerm}
            setSearchTerm={setVolumeSearchTerm}
            selectedArea={selectedVolumeArea}
            setSelectedArea={setSelectedVolumeArea}
            areas={volumeAreas}
            onSearch={handleVolumeSearch}
            clearFilters={clearVolumeFilters}
            placeholder="Buscar volúmenes..."
            quickTags={['2025', 'Vol. 1', 'Núm. 1']}
            selectedVolume={selectedVolumeVolume}
            setSelectedVolume={setSelectedVolumeVolume}
            volumesList={volumeVolumes}
            selectedNumber={selectedVolumeNumber}
            setSelectedNumber={setSelectedVolumeNumber}
            numbersList={volumeNumbers}
            volumeLabel="Volumen"
            numberLabel="Número"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {volumeLoading ? (
              <div className="flex flex-col items-center justify-center py-20 col-span-full">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#007398]"></div>
                <p className="mt-4 text-gray-500 font-serif italic">Cargando volúmenes...</p>
              </div>
            ) : filteredVolumes.length === 0 ? (
              <div className="bg-white border border-gray-200 p-12 text-center rounded-sm col-span-full">
                <p className="text-lg text-gray-600 font-serif italic">
                  "No se han encontrado volúmenes para los criterios seleccionados."
                </p>
                <p className="mt-2 text-sm text-[#007398] font-bold uppercase tracking-wider">
                  ¡Explora otras áreas!
                </p>
              </div>
            ) : (
              filteredVolumes.map((volume, index) => (
                <motion.div
                  key={`${volume.volumen}-${volume.numero}-${index}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.3 }}
                >
                  <VolumeCard volume={volume} />
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      ),
    },
    {
      name: 'submit',
      label: 'Enviar Artículo',
      path: '/submit',
      component: <SubmitSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'team',
      label: 'Nuestro Equipo',
      path: '/team',
      component: <TeamSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'admin',
      label: '¡Postula a algún cargo!',
      path: '/admin',
      component: (
        <div className="py-8 max-w-7xl mx-auto">
          <AdminSection />
        </div>
      ),
    },
    {
      name: 'about',
      label: 'Acerca de',
      path: '/about',
      component: <AboutSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'guidelines',
      label: 'Guías',
      path: '/guidelines',
      component: <GuidelinesSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'faq',
      label: 'Preguntas Frecuentes',
      path: '/faq',
      component: <FAQSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'news',
      label: 'Noticias',
      path: '/new',
      component: <NewsSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'login',
      label: 'Login',
      path: '/login',
      component: (
        <div className={`py-8 ${user ? 'w-full' : 'max-w-lg mx-auto'}`}>
          {!user && (
            <>
              <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
                Interfaz para Autores y Revisores
              </h2>
              <p className="text-center text-gray-600 mb-6">
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
  ], [articles, filteredArticles, areas, searchTerm, selectedArea, selectedArticleVolume, selectedArticleNumber, articleVolumes, articleNumbers, volumes, filteredVolumes, volumeAreas, volumeSearchTerm, selectedVolumeArea, selectedVolumeVolume, selectedVolumeNumber, volumeVolumes, volumeNumbers, loading, volumeLoading, visibleArticles, user]);

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="font-serif text-2xl font-bold tracking-tighter text-blue-900"
        >
          CARGANDO...
        </motion.div>
      </div>
    );
  }

  const isLoginActive = location.pathname.includes('login');
  const rawPath = location.pathname.replace(/\/$/, '');
  const normalizedPath =
    typeof cleanPath === 'function'
      ? cleanPath(rawPath)
      : rawPath;
  const isHome = normalizedPath === '/' || normalizedPath === '' || rawPath === '/es';

  const framerItem = (delay) => ({
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    transition: { delay: 0.1 * delay, duration: 0.3 }
  });

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col font-sans text-gray-900">
      {!isHome && <Header onOpenMenu={() => setIsMenuOpen(true)} />}
      <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <Tabs sections={sections} />
        </div>
      </nav>
      <main className="flex-grow">
        <AnimatePresence mode="wait">
         {/* En App.js, reemplaza TODO el bloque <Routes> con esto */}
<Routes location={location} key={location.key}>
  {/* Ruta para revisores */}
  <Route path="/reviewer-response" element={
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="container mx-auto px-6 lg:px-8 flex-grow"
    >
      <ReviewerResponsePage />
    </motion.div>
  } />
  
  {/* Rutas de secciones en español - SIN el prefijo /es */}
  {sections.map(s => (
    <Route 
      key={s.path} 
      path={s.path} 
      element={
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className={`container ${
            user && isLoginActive
              ? 'max-w-full px-0'
              : 'mx-auto px-6 lg:px-8'
          } flex-grow`}
        >
          {s.component}
        </motion.div>
      } 
    />
  ))}
  
  {/* Ruta comodín para redirigir rutas no encontradas a / */}
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
        </AnimatePresence>
      </main>
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
                        `block py-3 px-4 text-base font-medium rounded-md transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`
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