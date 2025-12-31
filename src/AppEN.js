import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { auth } from './firebase';
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut,
} from 'firebase/auth';
import { Routes, Route, useLocation, NavLink, useSearchParams } from 'react-router-dom';
import { useLanguage } from './hooks/useLanguage';
import Header from './components/HeaderEN';
import SearchAndFilters from './components/SearchAndFiltersEN';
import ArticleCard from './components/ArticleCardEN';
import VolumeCard from './components/VolumeCardEN';  // Nuevo
import Tabs from './components/TabsEN';
import SubmitSection from './components/SubmitSectionEN';
import AdminSection from './components/AdminSectionEN';
import AboutSection from './components/AboutSectionEN';
import GuidelinesSection from './components/GuidelinesSectionEN';
import FAQSection from './components/FAQSectionEN';
import TeamSection from './components/TeamSectionEN';
import Footer from './components/FooterEN';
import LoginSection from './components/LoginSectionEN';
import PortalSection from './components/PortalSectionEN';
import NewsSection from './components/NewsSectionEN';
import './index.css';
import { motion, AnimatePresence } from 'framer-motion';

const USERS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';
const ARTICLES_JSON = '/articles.json';
const VOLUMES_JSON = '/volumes.json';  // Nuevo
const isPrerendering = typeof navigator !== 'undefined' && navigator.userAgent.includes('ReactSnap');

function AppEN() {
  const { cleanPath } = useLanguage();
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [areas, setAreas] = useState([]);
  const [volumes, setVolumes] = useState([]);  // Nuevo
  const [filteredVolumes, setFilteredVolumes] = useState([]);  // Nuevo
  const [volumeSearchTerm, setVolumeSearchTerm] = useState('');  // Nuevo
  const [selectedVolumeArea, setSelectedVolumeArea] = useState('');  // Nuevo
  const [volumeAreas, setVolumeAreas] = useState([]);  // Nuevo
  const [loading, setLoading] = useState(true);
  const [visibleArticles, setVisibleArticles] = useState(6);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const fetchUserData = async (email) => {
    try {
      const response = await fetch(USERS_CSV, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Error loading CSV: ${response.status}`);
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
        role: csvUser?.['Rol en la Revista'] || 'User',
        image: csvUser?.Imagen || '',
      };
    } catch (err) {
      console.error('Error fetching user CSV:', err);
      return { name: email, role: 'User', image: '' };
    }
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
          } else {
            setUser(null);
            localStorage.removeItem('userData');
          }
          setAuthLoading(false);
        });
        return () => unsubscribe();
      })
      .catch((error) => {
        console.error('Error setting persistence:', error);
        setAuthLoading(false);
      });
  }, []);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const response = await fetch(ARTICLES_JSON, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Error loading the JSON file: ${response.status}`);
        }
        const data = await response.json();
        setArticles(data);
        const allAreas = data.flatMap((a) =>
          (a.area || '')
            .split(';')
            .map((area) => area.trim())
            .filter(Boolean)
        );
        const uniqueAreas = [...new Set(allAreas)].sort();
        setAreas(uniqueAreas);
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
          throw new Error(`Error loading volumes.json: ${response.status}`);
        }
        const data = await response.json();
        setVolumes(data);
        const allVolumeAreas = data.flatMap((v) =>
          (v.area || '')
            .split(';')
            .map((area) => area.trim())
            .filter(Boolean)
        );
        const uniqueVolumeAreas = [...new Set(allVolumeAreas)].sort();
        setVolumeAreas(uniqueVolumeAreas);
      } catch (error) {
        console.error('Error fetching volumes JSON:', error);
      }
    };
    fetchVolumes();
  }, []);

  const filterArticles = () => {
    const lowerTerm = searchTerm.toLowerCase();
    const filtered = articles.filter((article) => {
      const matchesSearch =
        article.titulo?.toLowerCase().includes(lowerTerm) ||
        article.autores?.toLowerCase().includes(lowerTerm) ||
        article.englishAbstract?.toLowerCase().includes(lowerTerm) ||
        article.keywords_english?.join(', ')?.toLowerCase().includes(lowerTerm);
      const matchesArea =
        selectedArea === '' ||
        (article.area || '')
          .toLowerCase()
          .split(';')
          .map((a) => a.trim())
          .some((a) => a.toLowerCase() === selectedArea.toLowerCase());
      return matchesSearch && matchesArea;
    });
    setFilteredArticles(filtered);
    setVisibleArticles(6);
  };

  const filterVolumes = () => {
    const lowerTerm = volumeSearchTerm.toLowerCase();
    const filtered = volumes.filter((volume) => {
      const matchesSearch =
        volume.titulo?.toLowerCase().includes(lowerTerm) ||
        volume.abstract?.toLowerCase().includes(lowerTerm) ||
        volume.keywords?.join(', ')?.toLowerCase().includes(lowerTerm);
      const matchesArea =
        selectedVolumeArea === '' ||
        (volume.area || '')
          .toLowerCase()
          .split(';')
          .map((a) => a.trim())
          .some((a) => a.toLowerCase() === selectedVolumeArea.toLowerCase());
      return matchesSearch && matchesArea;
    });
    setFilteredVolumes(filtered);
  };

  useEffect(() => {
    filterArticles();
  }, [searchTerm, selectedArea, articles]);

  useEffect(() => {
    filterVolumes();
  }, [volumeSearchTerm, selectedVolumeArea, volumes]);

  useEffect(() => {
    const path = cleanPath(location.pathname);
    if (path === '/article') {
      const q = searchParams.get('q') || '';
      const area = searchParams.get('area') || '';
      setSearchTerm(q);
      setSelectedArea(area);
    } else if (path === '/volume') {
      const qv = searchParams.get('qv') || '';
      const areav = searchParams.get('areav') || '';
      setVolumeSearchTerm(qv);
      setSelectedVolumeArea(areav);
    }
  }, [location.pathname, searchParams]);

  const handleSearch = (term, area) => {
    setSearchTerm(term);
    setSelectedArea(area);
    const newParams = new URLSearchParams(searchParams);
    if (term) {
      newParams.set('q', term);
    } else {
      newParams.delete('q');
    }
    if (area) {
      newParams.set('area', area);
    } else {
      newParams.delete('area');
    }
    setSearchParams(newParams);
  };

  const handleVolumeSearch = (term, area) => {
    setVolumeSearchTerm(term);
    setSelectedVolumeArea(area);
    const newParams = new URLSearchParams(searchParams);
    if (term) {
      newParams.set('qv', term);
    } else {
      newParams.delete('qv');
    }
    if (area) {
      newParams.set('areav', area);
    } else {
      newParams.delete('areav');
    }
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedArea('');
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('q');
    newParams.delete('area');
    setSearchParams(newParams);
  };

  const clearVolumeFilters = () => {
    setVolumeSearchTerm('');
    setSelectedVolumeArea('');
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('qv');
    newParams.delete('areav');
    setSearchParams(newParams);
  };

  const loadMoreArticles = () => setVisibleArticles((prev) => prev + 6);
  const showLessArticles = () => setVisibleArticles(6);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      localStorage.removeItem('userData');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const sections = [
    {
      name: 'articles',
      label: 'Articles',
      path: '/en/article',
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
              <p className="text-center text-base text-gray-600 col-span-full">
                Loading...
              </p>
            ) : filteredArticles.length === 0 ? (
              <p className="text-center text-base text-gray-600 col-span-full">
                We are currently in the review and collection period for articles. Submit yours via the form in the next tab.
              </p>
            ) : (
              filteredArticles.slice(0, visibleArticles).map((article, index) => (
                <motion.div
                  key={article.titulo}
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
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                onClick={loadMoreArticles}
              >
                Load more
              </button>
            </div>
          )}
          {!loading && visibleArticles > 6 && (
            <button
              className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 z-10 text-base"
              onClick={showLessArticles}
            >
              Show less
            </button>
          )}
        </motion.div>
      ),
    },
    {
      name: 'volumes',
      label: 'Volumes',
      path: '/en/volume',
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
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {filteredVolumes.length === 0 ? (
              <p className="text-center text-base text-gray-600 col-span-full">
                No volumes available yet.
              </p>
            ) : (
              filteredVolumes.map((volume, index) => (
                <motion.div
                  key={`${volume.volumen}-${volume.numero}`}
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
      label: 'Submit Article',
      path: '/en/submit',
      component: <SubmitSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'team',
      label: 'Our Team',
      path: '/en/team',
      component: <TeamSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'admin',
      label: 'Apply for a Position!',
      path: '/en/admin',
      component: (
        <div className="py-8 max-w-7xl mx-auto">
          <AdminSection />
        </div>
      ),
    },
    {
      name: 'about',
      label: 'About',
      path: '/en/about',
      component: <AboutSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'guidelines',
      label: 'Guidelines',
      path: '/en/guidelines',
      component: <GuidelinesSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'faq',
      label: 'FAQ',
      path: '/en/faq',
      component: <FAQSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'news',
      label: 'News',
      path: '/en/new',
      component: <NewsSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'login',
      label: 'Login',
      path: '/en/login',
      component: (
        <div className={`py-8 ${user ? 'w-full' : 'max-w-lg mx-auto'}`}>
          {!user && (
            <>
              <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
                Interface for Authors and Reviewers
              </h2>
              <p className="text-center text-gray-600 mb-6">
                This section is for authors and reviewers/authors with special permissions only.
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
    return <div className="text-center text-gray-600">Loading authentication...</div>;
  }

  const isLoginActive = location.pathname.includes('login');

  const framerItem = (delay) => ({
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    transition: { delay: 0.1 * delay, duration: 0.3 }
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header onOpenMenu={() => setIsMenuOpen(true)} />
      <div
        className={`container ${
          user && isLoginActive
            ? 'max-w-full px-0'
            : 'mx-auto px-6 lg:px-8'
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
                <span className="font-medium text-gray-700">Menu</span>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="text-gray-600 hover:text-gray-800 focus:outline-none"
                  aria-label="Close menu"
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
                      aria-label={`Go to ${section.label}`}
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

export default AppEN;