// AppEN.js - VERSIÓN COMPLETA CON DISEÑO EDITORIAL ACADÉMICO
import React, { useState, useEffect, useMemo } from 'react';
import { auth } from './firebase';
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut,
} from 'firebase/auth';
import { useLanguage } from './hooks/useLanguage';
import Header from './components/HeaderEN';
import SearchAndFilters from './components/SearchAndFiltersEN';
import ArticleCard from './components/ArticleCardEN';
import VolumeCard from './components/VolumeCardEN';
import AimsScopeSection from './components/AimsScopeSection';
import NewsletterModal from './components/NewsletterModal';
import CollectionViewEN from './components/CollectionViewEN';
import SingleCollectionViewEN from './components/SingleCollectionViewEN';
import ReviewerResponsePage from './components/ReviewerResponsePage';
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
import ScientificNewsUploadSection from './components/ScientificNewsUploadSection';
import { Routes, Route, useLocation, NavLink, useSearchParams, Navigate } from 'react-router-dom';
import HomeSectionEN from './components/HomeSectionEN';
import './index.css';
import { motion, AnimatePresence } from 'framer-motion';
import ReviewerOnboarding from './components/ReviewerOnboarding';

const ARTICLES_JSON = '/articles.json';
const VOLUMES_JSON = '/volumes.json';

const isPrerendering = typeof navigator !== 'undefined' && navigator.userAgent.includes('ReactSnap');

function AppEN() {
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

  const getUserData = (firebaseUser) => {
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
      role: 'User',
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
        console.error('Error setting persistence:', error);
        setAuthLoading(false);
      });
  }, []);

  const getAutoresText = (autores) => {
    if (!autores) return '';
    if (Array.isArray(autores)) {
      return autores.map(a => a.name || '').join(', ');
    }
    return String(autores);
  };

  const getInstitutionsText = (autores) => {
    if (!autores || !Array.isArray(autores)) return '';
    const institutions = autores.map(a => a.institution).filter(Boolean);
    return [...new Set(institutions)].join(', ');
  };

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const preloadedData = document.getElementById('preloaded-articles-data');
        if (preloadedData && preloadedData.textContent) {
          const data = JSON.parse(preloadedData.textContent);
          const sortedData = data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
          setArticles(sortedData);
          setFilteredArticles(sortedData);
          setLoading(false);
          
          const allAreas = sortedData.flatMap((a) =>
            (a.area || '').split(';').map((area) => area.trim()).filter(Boolean)
          );
          setAreas([...new Set(allAreas)].sort());
          
          const uniqueVolumes = [...new Set(sortedData.map(a => safeString(a.volumen)))]
            .filter(Boolean)
            .sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
          setArticleVolumes(uniqueVolumes);
          
          const uniqueNumbers = [...new Set(sortedData.map(a => safeString(a.numero)))]
            .filter(Boolean)
            .sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
          setArticleNumbers(uniqueNumbers);
          
          return;
        }
        
        const response = await fetch(ARTICLES_JSON, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Error loading the JSON file: ${response.status}`);
        }
        const data = await response.json();
        const sortedData = data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        setArticles(sortedData);
        setFilteredArticles(sortedData);

        const allAreas = sortedData.flatMap((a) =>
          (a.area || '').split(';').map((area) => area.trim()).filter(Boolean)
        );
        const uniqueAreas = [...new Set(allAreas)].sort();
        setAreas(uniqueAreas);

        const uniqueVolumes = [...new Set(sortedData.map(a => safeString(a.volumen)))]
          .filter(Boolean)
          .sort((a, b) => {
            const numA = parseInt(a) || 0;
            const numB = parseInt(b) || 0;
            return numB - numA;
          });
        setArticleVolumes(uniqueVolumes);

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
          throw new Error(`Error loading volumes.json: ${response.status}`);
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
      const autoresText = getAutoresText(article.autores).toLowerCase();
      const institucionesText = getInstitutionsText(article.autores).toLowerCase();
      
      const keywordsText = Array.isArray(article.keywords_english) 
        ? article.keywords_english.join(' ').toLowerCase()
        : safeString(article.keywords_english).toLowerCase();

      const matchesSearch =
        safeString(article.tituloEnglish || article.titulo).toLowerCase().includes(lowerTerm) ||
        autoresText.includes(lowerTerm) ||
        safeString(article.abstract || article.resumen).toLowerCase().includes(lowerTerm) ||
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
        safeString(volume.abstract).toLowerCase().includes(lowerTerm) ||
        (Array.isArray(volume.keywords) 
          ? volume.keywords.join(' ').toLowerCase().includes(lowerTerm)
          : safeString(volume.keywords).toLowerCase().includes(lowerTerm)) ||
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
    
    if (path === '/en/article' || path === '/en' || path === '/en/') {
      const term = searchParams.get('article_search') ?? '';
      const area = searchParams.get('article_area') ?? '';
      const volume = searchParams.get('article_volume') ?? '';
      const number = searchParams.get('article_number') ?? '';
      
      setSearchTerm(term);
      setSelectedArea(area);
      setSelectedArticleVolume(volume);
      setSelectedArticleNumber(number);
    } else if (path === '/en/volume') {
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
      console.error('Error signing out:', error);
    }
  };

  const sections = useMemo(() => [
    {
      name: 'home',
      label: 'Home',
      path: '/en',
      component: <HomeSectionEN onOpenMenu={() => setIsMenuOpen(true)} />,
    },
    {
      name: 'articles',
      label: 'Articles',
      path: '/en/article',
      component: (
        <motion.div
          className="py-12 md:py-16 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 font-sans"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-12 max-w-4xl">
            <h1 className="text-4xl md:text-5xl font-serif text-[#002147] tracking-tight">Article Archive</h1>
            <hr className="w-16 border-t-2 border-[#002147] my-6" />
            <p className="text-lg text-gray-600 font-serif leading-relaxed">
              Explore and discover peer-reviewed research organized by discipline, volume, and issue number.
            </p>
          </div>

          <SearchAndFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedArea={selectedArea}
            setSelectedArea={setSelectedArea}
            areas={areas}
            onSearch={handleSearch}
            clearFilters={clearFilters}
            placeholder="Search by title, author, keywords..."
            quickTags={['2025', 'Vol. 1', 'No. 1']}
            selectedVolume={selectedArticleVolume}
            setSelectedVolume={setSelectedArticleVolume}
            volumesList={articleVolumes}
            selectedNumber={selectedArticleNumber}
            setSelectedNumber={setSelectedArticleNumber}
            numbersList={articleNumbers}
            volumeLabel="Volume"
            numberLabel="Number"
          />

          <div className="mt-12">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#002147] border-t-transparent"></div>
                <p className="mt-6 text-gray-500 font-serif text-sm italic">Querying the database...</p>
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="bg-gray-50 border border-gray-300 py-20 px-6 text-center rounded-none">
                <p className="text-lg text-gray-600 font-serif italic mb-2">
                  No records found for the selected criteria.
                </p>
                <button onClick={clearFilters} className="mt-4 text-xs text-[#002147] font-bold uppercase tracking-widest hover:underline">
                  Clear all filters
                </button>
              </div>
            ) : (
              <>
                <div className="border-t border-gray-300">
                  {filteredArticles.slice(0, visibleArticles).map((article, index) => (
                    <motion.div
                      key={article.titulo + index}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index % 6 * 0.05, duration: 0.3 }}
                    >
                      <ArticleCard article={article} />
                    </motion.div>
                  ))}
                </div>

                <div className="mt-16 mb-20 flex flex-col items-center border-t border-gray-300 pt-10">
                  <p className="text-xs text-gray-500 mb-8 uppercase tracking-[0.2em] font-bold">
                    Showing <span className="text-[#1a1a1a]">{Math.min(visibleArticles, filteredArticles.length)}</span> of <span className="text-[#1a1a1a]">{filteredArticles.length}</span> results
                  </p>
                  <div className="flex gap-4">
                    {filteredArticles.length > visibleArticles && (
                      <button
                        className="px-8 py-3 bg-[#002147] text-white text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-black transition-colors rounded-none"
                        onClick={loadMoreArticles}
                      >
                        Load more articles
                      </button>
                    )}
                    {visibleArticles > 6 && (
                      <button
                        className="px-8 py-3 bg-white border border-gray-300 text-gray-700 text-[10px] font-bold uppercase tracking-[0.2em] hover:border-[#002147] transition-colors rounded-none"
                        onClick={showLessArticles}
                      >
                        Show less
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
      label: 'Volumes',
      path: '/en/volume',
      component: (
        <motion.div
          className="py-12 md:py-16 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 font-sans"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-12 max-w-4xl">
            <h1 className="text-4xl md:text-5xl font-serif text-[#002147] tracking-tight">Volume Archive</h1>
            <hr className="w-16 border-t-2 border-[#002147] my-6" />
            <p className="text-lg text-gray-600 font-serif leading-relaxed">
              Browse our complete past and current editions.
            </p>
          </div>

          <SearchAndFilters
            searchTerm={volumeSearchTerm}
            setSearchTerm={setVolumeSearchTerm}
            selectedArea={selectedVolumeArea}
            setSelectedArea={setSelectedVolumeArea}
            areas={volumeAreas}
            onSearch={handleVolumeSearch}
            clearFilters={clearVolumeFilters}
            placeholder="Search volumes..."
            quickTags={['2025', 'Vol. 1', 'No. 1']}
            selectedVolume={selectedVolumeVolume}
            setSelectedVolume={setSelectedVolumeVolume}
            volumesList={volumeVolumes}
            selectedNumber={selectedVolumeNumber}
            setSelectedNumber={setSelectedVolumeNumber}
            numbersList={volumeNumbers}
            volumeLabel="Volume"
            numberLabel="Number"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
            {volumeLoading ? (
              <div className="flex flex-col items-center justify-center py-20 col-span-full">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#002147] border-t-transparent"></div>
                <p className="mt-6 text-gray-500 font-serif text-sm italic">Loading volumes...</p>
              </div>
            ) : filteredVolumes.length === 0 ? (
              <div className="bg-gray-50 border border-gray-300 py-20 px-6 text-center col-span-full rounded-none">
                <p className="text-lg text-gray-600 font-serif italic mb-2">
                  No volumes found for the selected criteria.
                </p>
                <button onClick={clearVolumeFilters} className="mt-4 text-xs text-[#002147] font-bold uppercase tracking-widest hover:underline">
                  Clear all filters
                </button>
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
      name: 'collections',
      label: 'Collections',
      path: '/en/collection',
      component: <CollectionViewEN />,
    },
    {
      name: 'submit',
      label: 'Submit Article',
      path: '/en/submit',
      component: <SubmitSection className="py-12 max-w-[1280px] mx-auto" />,
    },
    {
      name: 'team',
      label: 'Our Team',
      path: '/en/team',
      component: <TeamSection className="py-12 max-w-[1280px] mx-auto" />,
    },
    {
      name: 'admin',
      label: 'Apply for a Position!',
      path: '/en/admin',
      component: (
        <div className="py-12 max-w-[1280px] mx-auto">
          <AdminSection />
        </div>
      ),
    },
    {
      name: 'about',
      label: 'About',
      path: '/en/about',
      component: <AboutSection className="py-12 max-w-[1280px] mx-auto" />,
    },
    {
      name: 'aims-scope',
      label: 'Aims & Scope',
      path: '/en/aims-scope',
      component: <AimsScopeSection className="py-12 max-w-[1280px] mx-auto" />,
    },
    {
      name: 'guidelines',
      label: 'Guidelines',
      path: '/en/guidelines',
      component: <GuidelinesSection className="py-12 max-w-[1280px] mx-auto" />,
    },
    {
      name: 'faq',
      label: 'FAQ',
      path: '/en/faq',
      component: <FAQSection className="py-12 max-w-[1280px] mx-auto" />,
    },
    {
      name: 'news',
      label: 'News',
      path: '/en/new',
      component: <NewsSection className="py-12 max-w-[1280px] mx-auto" />,
    },
    {
      name: 'login',
      label: 'Login',
      path: '/en/login',
      component: (
        <div className={`py-12 ${user ? 'w-full' : 'max-w-lg mx-auto'}`}>
          {!user && (
            <div className="mb-8">
              <h2 className="text-3xl font-serif text-[#002147] text-center mb-4">
                Editorial Access
              </h2>
              <hr className="w-12 border-t-2 border-[#002147] mx-auto mb-6" />
              <p className="text-center text-gray-600 text-sm">
                Management platform for Authors, Reviewers, and Editors.
              </p>
            </div>
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
      <div className="h-screen flex items-center justify-center bg-white font-sans">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="font-serif text-sm tracking-[0.2em] text-gray-500 uppercase"
        >
          Initializing...
        </motion.div>
      </div>
    );
  }

  const isLoginActive = location.pathname.includes('login');
  const rawPath = location.pathname.replace(/\/$/, '');
  const normalizedPath = typeof cleanPath === 'function' ? cleanPath(rawPath) : rawPath;
  const isHome = normalizedPath === '/' || normalizedPath === '' || rawPath === '/en';

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-[#1a1a1a] selection:bg-[#002147] selection:text-white">
      
      {/* BARRA SUPERIOR INSTITUCIONAL */}
      <div className="h-1.5 w-full bg-[#002147] z-50"></div>

      {!isHome && <Header onOpenMenu={() => setIsMenuOpen(true)} />}

      {/* NAVEGACIÓN TIPO ÍNDICE */}
      <nav className="sticky top-0 z-30 bg-white border-b border-gray-300">
        <div className="max-w-[1400px] mx-auto px-6">
          <Tabs sections={sections} />
        </div>
      </nav>

      <main className="flex-grow flex flex-col">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.key}>
            <Route path="/reviewer-response" element={
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="container mx-auto px-6 lg:px-8 flex-grow">
                <ReviewerResponsePage />
              </motion.div>
            } />

            <Route path="/reviewer-onboarding" element={
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-grow">
                <ReviewerOnboarding />
              </motion.div>
            } />

            <Route path="/reviewer-workspace/:assignmentId" element={
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-grow">
                <ReviewerWorkspacePage />
              </motion.div>
            } />

            <Route path="/en/login" element={
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`container ${user ? 'max-w-full px-0' : 'mx-auto px-6 lg:px-8'} flex-grow`}>
                {!user ? <LoginSection onLogout={handleLogout} /> : <PortalSection user={user} onLogout={handleLogout} />}
              </motion.div>
            } />
            
            {/* Rutas anidadas del Portal */}
            {['submit', 'director', 'chief', 'submissions', 'reviewer-tasks', 'deskreview', 'assignment', 'calendar', 'reviewer-profile', 'reviewer-applications', 'tasks', 'news', 'sci-news', 'admissions', 'users'].map((subRoute) => (
              <Route key={subRoute} path={`/login/${subRoute}`} element={
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="container max-w-full px-0 flex-grow">
                  {user ? <PortalSection user={user} onLogout={handleLogout} /> : <Navigate to="/en/login" replace />}
                </motion.div>
              } />
            ))}

            <Route path="/collection/:folderName" element={
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="container mx-auto px-6 lg:px-8 flex-grow">
                <SingleCollectionViewEN />
              </motion.div>
            } />

            {sections.map(s => (
              <Route
                key={s.name}
                path={s.path.replace('/en', '')}
                element={
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`${s.name === 'home' ? 'w-full flex-grow' : `w-full ${user && isLoginActive ? 'max-w-full px-0' : ''} flex-grow`}`}>
                    {s.component}
                  </motion.div>
                }
              />
            ))}

            <Route path="*" element={<Navigate to="/en" replace />} />
          </Routes>
        </AnimatePresence>
      </main>

      <NewsletterModal delay={45000} scrollTrigger={0.5} cookieExpirationDays={90} />

      {/* MENÚ HAMBURGUESA EDITORIAL */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40"
              aria-hidden="true"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="fixed top-0 left-0 h-full w-[85%] max-w-sm bg-white shadow-2xl z-50 overflow-y-auto border-r border-gray-300 font-sans"
            >
              <div className="p-6 border-b border-gray-300 flex justify-between items-center bg-[#FAFAFA]">
                <span className="font-serif font-bold text-lg text-[#002147]">Navigation</span>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="text-gray-500 hover:text-black transition-colors p-1"
                  aria-label="Close menu"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-2 flex flex-col">
                {sections.map((section) => (
                  <NavLink
                    key={section.name}
                    to={section.path}
                    className={({ isActive }) =>
                      `block py-3 px-4 text-xs font-semibold uppercase tracking-[0.15em] border-b border-gray-100 transition-colors ${
                        isActive 
                          ? 'bg-[#002147] text-white' 
                          : 'text-gray-700 hover:bg-gray-100 hover:text-[#002147]'
                      }`
                    }
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {section.label}
                  </NavLink>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Footer className="w-full mt-auto border-t border-gray-300 bg-[#FAFAFA]" />
    </div>
  );
}

export default AppEN;