import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import NewsletterSubscription from './NewsletterSubscription';

const NEWS_JSON = "/news/news.json";
const SCIENCE_NEWS_INDEX = "/science/index.json";
const SCIENCE_NEWS_BASE = "/science";
const SCIENCE_NEWS_URL_BASE = "/science/news"; // Nueva constante para URLs correctas
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
        month: "long",
        year: "numeric",
      });
    } catch {
      return raw;
    }
  }
  return raw;
}

function truncateHTML(html, maxLength = 220) {
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
  if (!body) return <p className="text-slate-700">No content available.</p>;
  try {
    let html = body;
    // Intentar decodificar si es base64
    if (/^[A-Za-z0-9+/=]+$/.test(body) && body.length > 50) {
      html = base64DecodeUnicode(body);
    }
    if (truncate) {
      html = truncateHTML(html, 250);
    }
    return (
      <div
        className="editorial-abstract"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch (err) {
    console.error('Error decoding body:', err);
    return <p className="text-slate-700">Error decoding content.</p>;
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
  const [visibleScienceNews, setVisibleScienceNews] = useState(8);
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
  const loadMoreScienceNews = () => setVisibleScienceNews((prev) => prev + 8);
  
  const openNews = (item) => {
    window.location.href = `/news/${item.slug}.EN.html`;
  };
  
  // CORRECCIÓN DE LA URL PARA NOTICIAS CIENTÍFICAS
  const openScienceNews = (item) => {
    window.location.href = `${SCIENCE_NEWS_URL_BASE}/${item.slug}.EN.html`;
  };
  
  const openAuthorProfile = (authorSlug) => {
    window.location.href = `/team/${authorSlug}.html`;
  };

  // Obtener noticias destacadas
  const featuredInternal = filteredInternalNews[0];
  const featuredScience = filteredScienceNews.find(n => n.featured) || filteredScienceNews[0];
  
  const listInternalNews = filteredInternalNews.slice(1, visibleNews);
  const listScienceNews = filteredScienceNews.filter(n => n !== featuredScience).slice(0, visibleScienceNews);

  if (loading) return <div className="py-32 text-center font-serif italic text-slate-500 text-lg">Initializing publications index...</div>;
  if (error) return <p className="text-center text-red-800 py-32 font-serif">{error}</p>;

  return (
    <div className={`w-full bg-[#FCFBF9] text-[#0F172A] min-h-screen pb-24 ${className || ""}`}>
      
      {/* --- INYECCIÓN TIPOGRÁFICA --- */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700&family=Inter:wght@400;500;600;700&display=swap');
        
        .font-journal { font-family: 'Merriweather', serif; }
        .font-system { font-family: 'Inter', sans-serif; }
        
        .editorial-abstract p {
          margin-bottom: 0.75rem;
          line-height: 1.6;
          color: #334155;
          font-family: 'Merriweather', serif;
          font-size: 0.95rem;
        }
        .editorial-abstract-large p {
          font-size: 1.1rem;
          line-height: 1.7;
          color: #1E293B;
        }
        
        .truncate-multiline {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;  
          overflow: hidden;
        }
      `}} />

      <div className="max-w-[1400px] mx-auto px-6 md:px-12 pt-16">
        
        {/* --- MASTHEAD (ESTILO NATURE/SCIENCE) --- */}
        <header className="border-b-[6px] border-[#0F172A] pb-10 mb-10">
          <div className="flex flex-col md:flex-row justify-between items-end gap-10">
            <div className="max-w-4xl">
              <span className="font-system text-xs font-bold uppercase tracking-[0.25em] text-[#EA580C] mb-4 block">
                National Journal of Sciences for Students
              </span>
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-journal font-black tracking-tight leading-[0.9] text-[#0F172A]">
                Scientific Bulletin
              </h1>
              <p className="font-journal italic text-xl md:text-2xl mt-6 text-slate-600 border-l-4 border-[#EA580C] pl-5">
                Research, chronicles and advances in the development of student science.
              </p>
            </div>
            <div className="w-full md:w-80 shrink-0 border border-slate-300 bg-white p-6 shadow-sm">
              <NewsletterSubscription variant="compact" showTitle={false} />
            </div>
          </div>
        </header>

        {/* --- CONTROLES EDITORIALES --- */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-16 border-b-2 border-slate-200 pb-2 gap-6">
          <div className="flex gap-8 w-full md:w-auto font-system">
            {['all', 'science', 'internal'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-xs font-bold uppercase tracking-[0.15em] transition-all relative ${
                  activeTab === tab 
                    ? 'text-[#0F172A]' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab === 'all' ? 'Complete Edition' : tab === 'science' ? 'Scientific Outreach' : 'Institutional News'}
                {activeTab === tab && (
                  <span className="absolute bottom-[-2px] left-0 w-full h-[2px] bg-[#EA580C]"></span>
                )}
              </button>
            ))}
          </div>
          
          <div className="w-full md:w-72 relative">
            <input
              type="text"
              placeholder="Search the registry..."
              className="w-full bg-transparent border-b border-slate-300 py-2 pl-2 text-sm font-system italic text-slate-700 focus:outline-none focus:border-[#0F172A] transition-colors rounded-none placeholder-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* --- SECCIÓN: DIVULGACIÓN CIENTÍFICA (ALTA DENSIDAD) --- */}
        {(activeTab === 'all' || activeTab === 'science') && scienceNews.length > 0 && (
          <section className="mb-24">
            
            {/* Cabecera de Sección */}
            <div className="flex items-center gap-4 mb-10">
              <h2 className="text-3xl font-journal font-black tracking-tight text-[#0F172A] m-0">Research</h2>
              <div className="flex-1 h-px bg-slate-300 mt-2"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              
              {/* Artículo Principal (Izquierda, 8 columnas) */}
              {featuredScience && (
                <div className="lg:col-span-8 border-b lg:border-b-0 lg:border-r border-slate-300 pb-12 lg:pb-0 lg:pr-12">
                  <article 
                    className="group cursor-pointer flex flex-col h-full"
                    onClick={() => openScienceNews(featuredScience)}
                  >
                    <div className="overflow-hidden mb-6 bg-slate-100 relative">
                      <img
                        src={featuredScience.photo || "https://www.revistacienciasestudiantes.com/team.jpg"}
                        className="w-full aspect-[16/9] object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-700"
                        alt={featuredScience.title_en}
                      />
                      {featuredScience.area_id && AREAS_MAP[featuredScience.area_id] && (
                        <div 
                          className="absolute top-0 left-0 text-white text-[10px] font-system font-bold uppercase tracking-widest px-4 py-2"
                          style={{ backgroundColor: AREAS_MAP[featuredScience.area_id].color }}
                        >
                          {AREAS_MAP[featuredScience.area_id].en}
                        </div>
                      )}
                    </div>
                    
                    <h3 className="text-4xl md:text-5xl font-journal font-black leading-tight mb-5 group-hover:text-[#EA580C] transition-colors">
                      {featuredScience.title_en}
                    </h3>
                    
                    <div className="flex items-center gap-3 mb-6 font-system border-y border-slate-200 py-3">
                      <span 
                        className="text-xs font-bold uppercase tracking-widest text-slate-800 hover:text-[#EA580C] cursor-pointer"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          openAuthorProfile(featuredScience.author_slug); 
                        }}
                      >
                        {featuredScience.author_name}
                      </span>
                      <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                      <time className="text-xs text-slate-500 uppercase tracking-wider">
                        {formatDate(featuredScience.createdAt)}
                      </time>
                    </div>
                    
                    <div className="editorial-abstract-large mb-6">
                      {decodeBody(featuredScience.content_en, true)}
                    </div>
                  </article>
                </div>
              )}

              {/* Grid Secundario (Derecha, 4 columnas) */}
              <div className="lg:col-span-4 flex flex-col gap-8">
                {listScienceNews.slice(0, 3).map((item, idx) => (
                  <article 
                    key={`science-side-${idx}`}
                    className="group cursor-pointer flex flex-col pb-8 border-b border-slate-200 last:border-0 last:pb-0"
                    onClick={() => openScienceNews(item)}
                  >
                    {item.area_id && AREAS_MAP[item.area_id] && (
                      <span 
                        className="text-[10px] font-system font-bold uppercase tracking-widest mb-3 block"
                        style={{ color: AREAS_MAP[item.area_id].color }}
                      >
                        {AREAS_MAP[item.area_id].en}
                      </span>
                    )}
                    <h4 className="text-2xl font-journal font-bold leading-snug mb-3 group-hover:text-[#EA580C] transition-colors">
                      {item.title_en}
                    </h4>
                    <div className="font-system flex items-center gap-2 mb-3">
                      <span 
                        className="text-xs font-bold text-slate-700 hover:text-[#EA580C] cursor-pointer"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          openAuthorProfile(item.author_slug); 
                        }}
                      >
                        {item.author_name}
                      </span>
                    </div>
                    <div className="editorial-abstract truncate-multiline">
                      {decodeBody(item.content_en, true)}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {/* Grid Terciario (4 Columnas densas) */}
            {listScienceNews.length > 3 && (
              <div className="mt-12 pt-12 border-t-[3px] border-slate-900 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {listScienceNews.slice(3, visibleScienceNews).map((item, idx) => (
                  <article 
                    key={`science-bottom-${idx}`}
                    className="group cursor-pointer flex flex-col"
                    onClick={() => openScienceNews(item)}
                  >
                    <div className="mb-4 bg-slate-100 overflow-hidden relative">
                       <img
                        src={item.photo || "https://via.placeholder.com/400x225?text=Science"}
                        className="w-full aspect-[4/3] object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-500"
                        alt={item.title_en}
                      />
                      <div className="absolute top-0 w-full h-1" style={{ backgroundColor: AREAS_MAP[item.area_id]?.color || '#0F172A' }}></div>
                    </div>
                    <h5 className="text-xl font-journal font-bold leading-tight mb-2 group-hover:text-[#EA580C] transition-colors line-clamp-3">
                      {item.title_en}
                    </h5>
                    <div className="mt-auto pt-2 font-system flex items-center justify-between text-xs text-slate-500 border-t border-slate-200">
                      <span className="font-bold text-slate-700 truncate max-w-[70%]">{item.author_name}</span>
                      <time>{formatDate(item.createdAt).split(' ')[0]}</time>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {filteredScienceNews.length > visibleScienceNews && (
              <div className="mt-16 flex justify-center border-t border-slate-200 pt-8">
                <button
                  onClick={loadMoreScienceNews}
                  className="px-10 py-3 bg-white border border-[#0F172A] text-[#0F172A] font-system text-xs font-bold uppercase tracking-[0.2em] hover:bg-[#0F172A] hover:text-white transition-all"
                >
                  Load Previous Records
                </button>
              </div>
            )}
          </section>
        )}

        {/* --- SECCIÓN: NOTICIAS INSTITUCIONALES (DISEÑO MÁS COMPACTO) --- */}
        {(activeTab === 'all' || activeTab === 'internal') && news.length > 0 && (
          <section>
            
            <div className="flex items-center gap-4 mb-10">
              <h2 className="text-3xl font-journal font-black tracking-tight text-[#0F172A] m-0">Institutional</h2>
              <div className="flex-1 h-px bg-slate-300 mt-2"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              
              {/* Noticia Interna Destacada (4 columnas) */}
              {featuredInternal && (
                <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-300 pb-12 lg:pb-0 lg:pr-12">
                  <article 
                    className="group cursor-pointer flex flex-col h-full bg-[#f4f4f5] p-6 border-t-4 border-[#0F172A]"
                    onClick={() => openNews(featuredInternal)}
                  >
                    <span className="font-system text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4 block">
                      Official Communiqué
                    </span>
                    <h3 className="text-3xl font-journal font-bold leading-tight mb-4 group-hover:text-[#EA580C] transition-colors">
                      {featuredInternal.titulo}
                    </h3>
                    <div className="editorial-abstract mb-6 flex-1">
                      {decodeBody(featuredInternal.cuerpo, true)}
                    </div>
                    <time className="font-system text-xs font-bold uppercase tracking-widest text-slate-400 pt-4 border-t border-slate-300 block">
                      {featuredInternal.fecha}
                    </time>
                  </article>
                </div>
              )}

              {/* Lista de Noticias Internas (8 columnas, Grid de 2x2) */}
              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                {listInternalNews.map((item, idx) => (
                  <article 
                    key={`internal-${idx}`}
                    className="group cursor-pointer flex flex-col border-b border-slate-200 pb-8"
                    onClick={() => openNews(item)}
                  >
                    <time className="font-system text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3 block">
                      {item.fecha}
                    </time>
                    <h4 className="text-xl font-journal font-bold leading-snug mb-3 group-hover:text-[#EA580C] transition-colors">
                      {item.titulo}
                    </h4>
                    <div className="editorial-abstract truncate-multiline">
                      {decodeBody(item.cuerpo, true)}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {filteredInternalNews.length > visibleNews && (
              <div className="mt-16 flex justify-center border-t border-slate-200 pt-8">
                <button
                  onClick={loadMoreNews}
                  className="px-10 py-3 bg-white border border-slate-300 text-slate-600 font-system text-xs font-bold uppercase tracking-[0.2em] hover:border-[#0F172A] hover:text-[#0F172A] transition-all"
                >
                  View Institutional Archive
                </button>
              </div>
            )}
          </section>
        )}

        {/* --- ESTADO VACÍO --- */}
        {filteredInternalNews.length === 0 && filteredScienceNews.length === 0 && (
          <div className="py-24 text-center border-t border-slate-200">
            <p className="font-journal text-xl italic text-slate-500">
              No records found matching your search.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}