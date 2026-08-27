import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import NewsletterSubscription from './NewsletterSubscription';

const NEWS_JSON = "/news/news.json";
const SCIENCE_NEWS_INDEX = "/science/index.json";
const SCIENCE_NEWS_BASE = "/science";
const DOMAIN = "https://www.revistacienciasestudiantes.com";

// ========== UTILIDADES ==========
const base64DecodeUnicode = (str) => {
  try {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  } catch (err) {
    console.error('Error decoding Base64:', err);
    return '';
  }
};

function generateSlug(name) {
  if (!name) return '';
  name = name.toLowerCase();
  name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  name = name.replace(/\s+/g, '-');
  name = name.replace(/[^a-z0-9-]/g, '');
  name = name.replace(/-+/g, '-');
  name = name.replace(/^-+|-+$/g, '');
  return name;
}

function generateAuthorSlug(authorName) {
  return generateSlug(authorName);
}

function parseDateIso(raw) {
  if (!raw) return '';
  let parsedDate = new Date(raw);
  if (isNaN(parsedDate.getTime())) {
    const datePattern = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
    const match = raw.match(datePattern);
    if (match) {
      const [, day, month, year] = match;
      parsedDate = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
    }
  }
  if (!isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString().split('T')[0];
  }
  return '';
}

function formatDate(raw) {
  if (!raw) return "No date";
  let parsedDate = new Date(raw);
  if (isNaN(parsedDate.getTime())) {
    const datePattern = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
    const match = raw.match(datePattern);
    if (match) {
      const [, day, month, year] = match;
      parsedDate = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
    }
  }
  if (!isNaN(parsedDate.getTime())) {
    try {
      return parsedDate.toLocaleString("en-US", {
        timeZone: "America/Santiago",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return raw;
    }
  }
  return raw;
}

function truncateHTML(html, maxLength = 200) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const paragraphs = Array.from(tempDiv.querySelectorAll('p, div, h1, h2, h3, ul, ol, img'));
  let truncated = '';
  let charCount = 0;
  for (let elem of paragraphs) {
    const elemText = elem.outerHTML;
    if (charCount + elemText.length > maxLength) {
      const textContent = elem.textContent || '';
      if (textContent.length > 0) {
        const remaining = maxLength - charCount;
        truncated += elem.outerHTML.substring(0, elem.outerHTML.length - (textContent.length - remaining)) + '...';
      }
      break;
    }
    truncated += elemText;
    charCount += elemText.length;
  }
  return truncated;
}

function decodeBody(body, truncate = false) {
  if (!body) return <p className="text-gray-800">No content available.</p>;
  try {
    let html = body;
    // Intentar decodificar si es base64
    if (/^[A-Za-z0-9+/=]+$/.test(body) && body.length > 50) {
      html = base64DecodeUnicode(body);
    }
    if (truncate) {
      html = truncateHTML(html, 200);
    }
    return (
      <div
        className="ql-editor break-words leading-relaxed text-gray-800 overflow-hidden"
        style={{ lineHeight: '1.6', marginBottom: '10px' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch (err) {
    console.error('Error decoding body:', err);
    return <p className="text-gray-800">Error decoding content.</p>;
  }
}

// ========== MAPEO DE ÁREAS ==========
const AREAS_MAP = {
  'biologia': { es: 'Biología', en: 'Biology', color: '#059669' },
  'quimica': { es: 'Química', en: 'Chemistry', color: '#7c3aed' },
  'fisica': { es: 'Física', en: 'Physics', color: '#2563eb' },
  'matematica': { es: 'Matemática', en: 'Mathematics', color: '#dc2626' },
  'computacion': { es: 'Computación', en: 'Computer Science', color: '#0891b2' },
  'astronomia': { es: 'Astronomía', en: 'Astronomy', color: '#4f46e5' },
  'geologia': { es: 'Geología', en: 'Geology', color: '#b45309' },
  'medicina': { es: 'Medicina', en: 'Medicine', color: '#e11d48' },
  'ingenieria': { es: 'Ingeniería', en: 'Engineering', color: '#475569' },
  'ciencias_sociales': { es: 'Ciencias Sociales', en: 'Social Sciences', color: '#9333ea' },
  'medio_ambiente': { es: 'Medio Ambiente', en: 'Environment', color: '#16a34a' },
  'neurociencia': { es: 'Neurociencia', en: 'Neuroscience', color: '#db2777' },
  'logros_estudiantiles': { es: 'Logros Estudiantiles', en: 'Student Achievements', color: '#ea580c' }
};

// ========== COMPONENTE PRINCIPAL ==========
export default function NewsSectionEN({ className }) {
  const [news, setNews] = useState([]);
  const [scienceNews, setScienceNews] = useState([]);
  const [welcomeNote, setWelcomeNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [visibleNews, setVisibleNews] = useState(6);
  const [visibleScienceNews, setVisibleScienceNews] = useState(6);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'internal', 'science'

  useEffect(() => {
    const fetchNews = async () => {
      try {
        // Cargar noticias internas
        const response = await fetch(NEWS_JSON, { cache: "no-store" });
        if (!response.ok) throw new Error("Error loading JSON file");
        const data = await response.json();
        
        if (!data || data.length === 0) {
          setError("JSON is empty or has invalid format");
          setLoading(false);
          return;
        }
        
        const validNews = data
          .filter(
            (item) =>
              (item["title"] || "").trim() !== "" &&
              (item["content"] || "").trim() !== ""
          )
          .map((item) => ({
            titulo: String(item["title"] ?? ""),
            cuerpo: String(item["content"] ?? ""),
            fecha: String(item["fecha"] ?? ""),
            fechaIso: String(item["fechaIso"] ?? ""),
            photo: String(item["photo"] ?? ""),
            slug: String(item["slug"] ?? ""),
            timestamp: item["timestamp"],
            type: 'internal'
          }))
          .sort((a, b) => b.timestamp - a.timestamp);
        
        const foundWelcome = validNews.find(n => n.fechaIso === '2025-09-15');
        setWelcomeNote(foundWelcome);
        setNews(validNews);

        // Cargar noticias científicas
        try {
          const scienceResponse = await fetch(SCIENCE_NEWS_INDEX, { cache: "no-store" });
          if (scienceResponse.ok) {
            const scienceIndex = await scienceResponse.json();
            const years = Object.keys(scienceIndex.years || {}).sort().reverse();
            
            const allScienceNews = [];
            
            for (const year of years) {
              const yearData = scienceIndex.years[year];
              const yearJsonPath = `${SCIENCE_NEWS_BASE}/${year}/${yearData.json_file}`;
              
              try {
                const yearResponse = await fetch(yearJsonPath, { cache: "no-store" });
                if (yearResponse.ok) {
                  const yearNews = await yearResponse.json();
                  const newsArray = yearNews.news || yearNews;
                  
                  newsArray.forEach(item => {
                    allScienceNews.push({
                      id: item.id,
                      title_es: item.title?.es || '',
                      title_en: item.title?.en || '',
                      content_es: item.content?.es || '',
                      content_en: item.content?.en || '',
                      author_name: item.author?.name || 'Editorial Staff',
                      author_slug: generateAuthorSlug(item.author?.name || ''),
                      area_id: item.area_id || 'general',
                      category: item.category || 'general',
                      tags: item.tags || [],
                      photo: item.photo || '',
                      featured: item.featured || false,
                      createdAt: item.metadata?.createdAt || new Date().toISOString(),
                      timestamp: item.metadata?.createdTimestamp || new Date().getTime(),
                      slug: item.slug || '',
                      year: year,
                      type: 'science'
                    });
                  });
                }
              } catch (yearError) {
                console.warn(`Error loading news from year ${year}:`, yearError);
              }
            }
            
            allScienceNews.sort((a, b) => b.timestamp - a.timestamp);
            setScienceNews(allScienceNews);
          }
        } catch (scienceError) {
          console.warn('Could not load scientific news:', scienceError);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error loading news:", err);
        setError("Error connecting to server");
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  // Filtrar noticias
  const filteredInternalNews = news.filter((n) =>
    n.titulo?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredScienceNews = scienceNews.filter((n) =>
    n.title_en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.title_es?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (n.author_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (n.tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const loadMoreNews = () => setVisibleNews((prev) => prev + 6);
  const loadMoreScienceNews = () => setVisibleScienceNews((prev) => prev + 6);
  
  const openNews = (item) => {
    window.location.href = `/news/${item.slug}.EN.html`;
  };
  
  const openScienceNews = (item) => {
    window.location.href = `/science/${item.year}/${item.slug}.EN.html`;
  };
  
  const openAuthorProfile = (authorSlug) => {
    window.location.href = `/team/${authorSlug}.html`;
  };

  // Obtener noticias destacadas
  const featuredInternal = filteredInternalNews[0];
  const featuredScience = filteredScienceNews.find(n => n.featured) || filteredScienceNews[0];
  
  const listInternalNews = filteredInternalNews.slice(1, visibleNews);
  const listScienceNews = filteredScienceNews.filter(n => n !== featuredScience).slice(0, visibleScienceNews);

  if (loading) return <div className="py-20 text-center font-serif italic text-gray-400">Updating news file...</div>;
  if (error) return <p className="text-center text-red-600">{error}</p>;

  return (
    <div className={`max-w-7xl mx-auto px-4 py-12 bg-white text-gray-900 ${className || ""}`}>
      {/* --- HEADER & NEWSLETTER --- */}
      <header className="border-b-4 border-black pb-6 mb-12 flex flex-col md:flex-row justify-between items-end gap-8">
        <div>
          <h2 className="text-5xl font-serif font-black tracking-tighter mb-2">Newsletter</h2>
          <p className="text-gray-500 font-serif italic">Chronicles, advances and announcements from the student scientific community.</p>
        </div>
        <div className="w-full md:w-auto">
          <NewsletterSubscription variant="compact" showTitle={false} />
        </div>
      </header>

      {/* --- SEARCH BAR & TABS --- */}
      <div className="mb-12 space-y-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search in the archive..."
            className="w-full border-b border-gray-200 py-2 text-lg font-serif italic focus:outline-none focus:border-blue-600 transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {/* Tabs de filtro */}
        <div className="flex gap-2 border-b border-gray-100">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${
              activeTab === 'all' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('internal')}
            className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${
              activeTab === 'internal' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Internal Newsletter
          </button>
          <button
            onClick={() => setActiveTab('science')}
            className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${
              activeTab === 'science' 
                ? 'border-emerald-600 text-emerald-600' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Science Outreach
          </button>
        </div>
      </div>

      {/* --- SECTION: SCIENCE OUTREACH NEWS --- */}
      {(activeTab === 'all' || activeTab === 'science') && scienceNews.length > 0 && (
        <section className="mb-20">
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-600 mb-2 block">
                Science Outreach
              </span>
              <h3 className="text-3xl font-serif font-black tracking-tighter">
                Science in First Person
              </h3>
            </div>
            <span className="text-xs font-mono text-gray-400">
              {scienceNews.length} articles
            </span>
          </div>

          {/* Featured Scientific Article */}
          {featuredScience && (
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-12 border-b border-gray-100 group cursor-pointer mb-12"
              onClick={() => openScienceNews(featuredScience)}
            >
              <div className="lg:col-span-7 overflow-hidden rounded-sm bg-gray-100 aspect-video md:aspect-auto md:h-[400px]">
                <img
                  src={featuredScience.photo || "https://www.revistacienciasestudiantes.com/team.jpg"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  alt={featuredScience.title_en}
                />
              </div>
              
              <div className="lg:col-span-5 flex flex-col justify-center">
                {featuredScience.area_id && AREAS_MAP[featuredScience.area_id] && (
                  <span 
                    className="text-[10px] font-bold uppercase tracking-[0.3em] mb-4 inline-block"
                    style={{ color: AREAS_MAP[featuredScience.area_id].color }}
                  >
                    {AREAS_MAP[featuredScience.area_id].en}
                    {featuredScience.featured && ' • ⭐ Featured'}
                  </span>
                )}
                <h4 className="text-3xl md:text-4xl font-serif font-bold leading-tight mb-4 group-hover:text-emerald-600 transition-colors">
                  {featuredScience.title_en}
                </h4>
                
                {/* Clickable Author */}
                <div 
                  className="flex items-center gap-2 mb-4 cursor-pointer group/author"
                  onClick={(e) => {
                    e.stopPropagation();
                    openAuthorProfile(featuredScience.author_slug);
                  }}
                >
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-emerald-700">
                      {featuredScience.author_name.charAt(0)}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover/author:text-emerald-600 transition-colors">
                    {featuredScience.author_name}
                  </span>
                </div>
                
                <div className="text-gray-600 font-serif text-lg mb-6 line-clamp-4 md:line-clamp-6 italic">
                  {decodeBody(featuredScience.content_en, true)}
                </div>
                <time className="text-xs font-mono text-gray-400">
                  {formatDate(featuredScience.createdAt)}
                </time>
              </div>
            </motion.article>
          )}

          {/* Science News Grid */}
          {listScienceNews.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12 md:gap-y-16">
              <AnimatePresence>
                {listScienceNews.map((item, idx) => (
                  <motion.article
                    key={`science-${idx}`}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex flex-col border-t border-emerald-100 pt-6 group cursor-pointer"
                    onClick={() => openScienceNews(item)}
                  >
                    <div className="flex flex-row md:flex-col gap-4">
                      <div className="w-1/3 md:w-full h-24 md:h-48 bg-emerald-50 rounded-sm overflow-hidden flex-shrink-0">
                        <img
                          src={item.photo || "https://via.placeholder.com/400x225?text=Science"}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          alt={item.title_en}
                        />
                      </div>
                      <div className="flex flex-col flex-1">
                        {item.area_id && AREAS_MAP[item.area_id] && (
                          <span 
                            className="text-[9px] font-bold uppercase tracking-widest mb-1 md:mb-3 block"
                            style={{ color: AREAS_MAP[item.area_id].color }}
                          >
                            {AREAS_MAP[item.area_id].en}
                          </span>
                        )}
                        <h5 className="text-lg md:text-xl font-serif font-bold leading-snug mb-2 group-hover:underline decoration-emerald-200">
                          {item.title_en}
                        </h5>
                        
                        {/* Author */}
                        <div 
                          className="flex items-center gap-2 mb-2 cursor-pointer group/author"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAuthorProfile(item.author_slug);
                          }}
                        >
                          <span className="text-xs font-medium text-gray-500 group-hover/author:text-emerald-600 transition-colors">
                            {item.author_name}
                          </span>
                        </div>
                        
                        <div className="hidden md:block text-sm text-gray-500 line-clamp-3 leading-relaxed mb-4 italic">
                          {decodeBody(item.content_en, true)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-auto pt-4 hidden md:flex justify-between items-center border-t border-emerald-50">
                      <time className="text-[9px] font-mono text-gray-400">
                        {formatDate(item.createdAt).split(',')[0]}
                      </time>
                      <span className="text-[10px] font-black uppercase tracking-widest group-hover:text-emerald-600 transition-colors">
                        Read Article →
                      </span>
                    </div>
                  </motion.article>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Load More Science News */}
          {filteredScienceNews.length > visibleScienceNews + 1 && (
            <div className="mt-12 flex justify-center">
              <button
                onClick={loadMoreScienceNews}
                className="px-8 py-3 border-2 border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-emerald-50 transition-all"
              >
                More Science Outreach
              </button>
            </div>
          )}
        </section>
      )}

      {/* --- SECTION: INTERNAL NEWS --- */}
      {(activeTab === 'all' || activeTab === 'internal') && news.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-600 mb-2 block">
                Internal Newsletter
              </span>
              <h3 className="text-3xl font-serif font-black tracking-tighter">
                Journal Updates
              </h3>
            </div>
            <span className="text-xs font-mono text-gray-400">
              {news.length} news
            </span>
          </div>

          {/* Featured Internal News */}
          {featuredInternal && (
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-12 border-b border-gray-100 group cursor-pointer mb-12"
              onClick={() => openNews(featuredInternal)}
            >
              <div className="lg:col-span-7 flex flex-col gap-6">
                <div className="overflow-hidden rounded-sm bg-gray-100 aspect-video md:aspect-auto md:h-[400px]">
                  <img
                    src={featuredInternal.photo ? featuredInternal.photo : "https://www.revistacienciasestudiantes.com/team.jpg"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    alt="Featured"
                  />
                </div>
                
                {welcomeNote && welcomeNote.fechaIso !== featuredInternal.fechaIso && (
                  <div 
                    className="hidden lg:block group/welcome border-t pt-6" 
                    onClick={(e) => { e.stopPropagation(); openNews(welcomeNote); }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-600 mb-2 block">Editorial Note</span>
                    <h3 className="text-3xl font-serif font-bold leading-tight group-hover/welcome:text-blue-600 transition-colors">
                      {welcomeNote.titulo}
                    </h3>
                    <p className="text-sm text-gray-500 mt-2 font-serif italic">Continue reading →</p>
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 flex flex-col justify-center">
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-600 mb-4 block">Latest Update</span>
                <h3 className="text-3xl md:text-4xl font-serif font-bold leading-tight mb-4 group-hover:text-blue-600 transition-colors">
                  {featuredInternal.titulo}
                </h3>
                <div className="text-gray-600 font-serif text-lg mb-6 line-clamp-4 md:line-clamp-6 italic">
                  {decodeBody(featuredInternal.cuerpo, true)}
                </div>
                <time className="text-xs font-mono text-gray-400">{featuredInternal.fecha}</time>
              </div>

              {welcomeNote && welcomeNote.fechaIso !== featuredInternal.fechaIso && (
                <div 
                  className="lg:hidden bg-blue-50 p-6 -mx-4 border-y border-blue-100" 
                  onClick={(e) => { e.stopPropagation(); openNews(welcomeNote); }}
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-600 mb-2 block">Editorial Note</span>
                  <h3 className="text-2xl font-serif font-bold leading-tight">
                    {welcomeNote.titulo}
                  </h3>
                  <p className="text-blue-700 text-xs font-bold uppercase tracking-widest mt-4">Read editor's message →</p>
                </div>
              )}
            </motion.article>
          )}

          {/* Internal News Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12 md:gap-y-16">
            <AnimatePresence>
              {listInternalNews.map((item, idx) => (
                <motion.article
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex flex-col border-t border-gray-100 pt-6 group cursor-pointer"
                  onClick={() => openNews(item)}
                >
                  <div className="flex flex-row md:flex-col gap-4">
                    <div className="w-1/3 md:w-full h-24 md:h-48 bg-gray-100 rounded-sm overflow-hidden flex-shrink-0">
                      <img
                        src={item.photo ? item.photo : "https://via.placeholder.com/400x225?text=RNCE"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        alt={item.titulo}
                      />
                    </div>
                    <div className="flex flex-col flex-1">
                      <time className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mb-1 md:mb-3 block">
                        {item.fecha.split(',')[0]}
                      </time>
                      <h4 className="text-lg md:text-xl font-serif font-bold leading-snug mb-2 group-hover:underline decoration-blue-200">
                        {item.titulo}
                      </h4>
                      <div className="hidden md:block text-sm text-gray-500 line-clamp-3 leading-relaxed mb-4 italic">
                        {decodeBody(item.cuerpo, true)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-auto pt-4 hidden md:flex justify-end border-t border-gray-50">
                    <span className="text-[10px] font-black uppercase tracking-widest group-hover:text-blue-600 transition-colors">
                      Read Note →
                    </span>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>

          {filteredInternalNews.length > visibleNews && (
            <div className="mt-12 flex justify-center">
              <button
                onClick={loadMoreNews}
                className="px-8 py-3 border-2 border-blue-200 text-blue-700 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-blue-50 transition-all"
              >
                Explore Internal Archive
              </button>
            </div>
          )}
        </section>
      )}

      {/* --- MESSAGE IF NO RESULTS --- */}
      {filteredInternalNews.length === 0 && filteredScienceNews.length === 0 && (
        <p className="text-center text-gray-600 col-span-full mt-8">
          No news found.
        </p>
      )}
    </div>
  );
}