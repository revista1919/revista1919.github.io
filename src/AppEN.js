import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { auth } from './firebase';
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut,
} from 'firebase/auth';
import { useLanguage } from './hooks/useLanguage'; // ← MANTENIDO
import Header from './components/HeaderEN'; // ← ARCHIVO EN
import SearchAndFilters from './components/SearchAndFiltersEN'; // ← ARCHIVO EN
import ArticleCard from './components/ArticleCardEN'; // ← ARCHIVO EN
import Tabs from './components/TabsEN'; // ← ARCHIVO EN
import SubmitSection from './components/SubmitSectionEN'; // ← ARCHIVO EN
import AdminSection from './components/AdminSectionEN'; // ← ARCHIVO EN
import AboutSection from './components/AboutSectionEN'; // ← ARCHIVO EN
import GuidelinesSection from './components/GuidelinesSectionEN'; // ← ARCHIVO EN
import FAQSection from './components/FAQSectionEN'; // ← ARCHIVO EN
import TeamSection from './components/TeamSectionEN'; // ← ARCHIVO EN
import Footer from './components/FooterEN'; // ← ARCHIVO EN
import LoginSection from './components/LoginSectionEN'; // ← ARCHIVO EN
import PortalSection from './components/PortalSectionEN'; // ← ARCHIVO EN
import NewsSection from './components/NewsSectionEN'; // ← ARCHIVO EN
import './index.css';
// import App from './App'; // ← ELIMINADO

const USERS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';

function AppEN() {
  const { cleanPath } = useLanguage(); // ← MANTENIDO
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

  // Auth persistence and state
  useEffect(() => {
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
            console.log('User authenticated:', userData);
          } else {
            setUser(null);
            localStorage.removeItem('userData');
            console.log('No user authenticated');
          }
          setAuthLoading(false);
        });
        return () => unsubscribe();
      })
      .catch((error) => {
        console.error('Error setting up persistence:', error);
        setAuthLoading(false);
      });
  }, []);

  // Fetch articles CSV
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const response = await fetch(
          'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv',
          { cache: 'no-store' }
        );

        if (!response.ok) {
          throw new Error(`Error loading CSV file: ${response.status}`);
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

  // Search and filters
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

  // Manual login
  const handleLogin = async (userData) => {
    console.log('handleLogin called with:', userData);
    if (!userData) {
      setUser(null);
      localStorage.removeItem('userData');
      console.log('No user authenticated in handleLogin');
      return;
    }

    try {
      const csvData = await fetchUserData(userData.email);
      const updatedUserData = {
        uid: userData.uid,
        email: userData.email,
        name: csvData.name,
        role: csvData.role,
        image: csvData.image,
      };
      setUser(updatedUserData);
      localStorage.setItem('userData', JSON.stringify(updatedUserData));
      setActiveTab('login'); // Ensure login tab stays active
      console.log('User authenticated in handleLogin:', updatedUserData);
    } catch (error) {
      console.error('Error in handleLogin:', error);
      setUser(null);
      localStorage.removeItem('userData');
    }
  };

  // Manual logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      localStorage.removeItem('userData');
      console.log('Logout executed in AppEN.jsx');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Tab sections
  const sections = [
    {
      name: 'articles',
      label: 'Articles',
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
              <p className="text-center text-sm sm:text-base text-gray-600 col-span-full">
                Loading...
              </p>
            ) : filteredArticles.length === 0 ? (
              <p className="text-center text-sm sm:text-base text-gray-600 col-span-full">
                No articles found
              </p>
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
                Load More
              </button>
            </div>
          )}
          {!loading && visibleArticles > 6 && (
            <button
              className="fixed bottom-4 right-4 bg-[#5a3e36] text-white px-4 py-2 rounded-md hover:bg-[#7a5c4f] focus:outline-none focus:ring-2 focus:ring-[#5a3e36] z-10 text-sm sm:text-base"
              onClick={showLessArticles}
            >
              Show Less
            </button>
          )}
        </div>
      ),
    },
    {
      name: 'submit',
      label: 'Submit Article',
      component: <SubmitSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'team',
      label: 'Our Team',
      component: <TeamSection setActiveTab={setActiveTab} className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'admin',
      label: 'Apply for a Position!',
      component: (
        <div className="py-8 max-w-7xl mx-auto">
          <AdminSection />
        </div>
      ),
    },
    {
      name: 'about',
      label: 'About',
      component: <AboutSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'guidelines',
      label: 'Guidelines',
      component: <GuidelinesSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'faq',
      label: 'Frequently Asked Questions',
      component: <FAQSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'news',
      label: 'News',
      component: <NewsSection className="py-8 max-w-7xl mx-auto" />,
    },
    {
      name: 'login',
      label: 'Login / Article Status',
      component: (
        <div className={`py-8 ${user ? 'w-full' : 'max-w-lg mx-auto'}`}>
          {!user && (
            <>
              <h2 className="text-2xl font-semibold text-center text-[#5a3e36] mb-4">
                Interface for Authors and Reviewers
              </h2>
              <p className="text-center text-[#7a5c4f] mb-6">
                This section is only for authors and reviewers with special permissions.
              </p>
            </>
          )}
          {user ? (
            <PortalSection user={user} onLogout={handleLogout} />
          ) : (
            <LoginSection onLogin={handleLogin} onLogout={handleLogout} />
          )}
        </div>
      ),
    },
  ];

  if (authLoading) {
    return <div className="text-center text-gray-600">Loading authentication...</div>;
  }

  return (
    <div className="min-h-screen bg-[#f4ece7] flex flex-col">
      <Header className="w-full m-0 p-0" />
      <div
        className={`container ${
          user && activeTab === 'login'
            ? 'max-w-full px-0'
            : 'mx-auto px-4 sm:px-6 lg:px-8'
        } flex-grow`}
      >
        <Tabs sections={sections} activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
      <Footer className="w-full m-0 p-0 mt-auto" />
    </div>
  );
}

export default AppEN;