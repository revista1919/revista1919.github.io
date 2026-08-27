import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import NewsletterSubscription from './NewsletterSubscription';

const NEWS_JSON = "/news/news.json";
const SCIENCE_NEWS_INDEX = "/science/index.json";
const SCIENCE_NEWS_BASE = "/science";
const SCIENCE_NEWS_URL_BASE = "/science/news"; // URL corregida

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

function formatDate(raw) {
  if (!raw) return "";
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
      const parts = parsedDate.toLocaleDateString("es-ES", {
        timeZone: "America/Santiago",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).split(" ");
      return `${parts[0]} ${parts[1].toUpperCase()} ${parts[2]}`;
    } catch {
      return raw;
    }
  }
  return raw;
}

function truncateHTML(html, maxLength = 180) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const paragraphs = Array.from(tempDiv.querySelectorAll('p, div, h1, h2, h3, ul, ol'));
  let truncated = '';
  let charCount = 0;
  for (let elem of paragraphs) {
    const textContent = elem.textContent || '';
    if (charCount + textContent.length > maxLength) {
      const remaining = maxLength - charCount;
      truncated += `<p>${textContent.substring(0, remaining)}...</p>`;
      break;
    }
    truncated += `<p>${textContent}</p>`;
    charCount += textContent.length;
  }
  return truncated;
}

function decodeBody(body, truncate = false) {
  if (!body) return null;
  try {
    let html = body;
    if (body.startsWith('data:') || /^[A-Za-z0-9+/=]+$/.test(body)) {
      html = base64DecodeUnicode(body);
    }
    if (truncate) {
      html = truncateHTML(html, 150);
    }
    return (
      <div
        className="editorial-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch (err) {
    console.error('Error decoding body:', err);
    return null;
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

const getFallbackImage = (area_id) => {
  const seeds = {
    'biologia': 'biology,nature',
    'quimica': 'chemistry,laboratory',
    'fisica': 'physics,abstract',
    'matematica': 'math,geometry',
    'computacion': 'code,computer',
    'astronomia': 'space,stars',
    'medicina': 'medical,hospital',
    'default': 'science,research'
  };
  const term = seeds[area_id] || seeds['default'];
  return `https://source.unsplash.com/800x600/?${term}`;
};

// ========== COMPONENTE PRINCIPAL ==========
export default function NewsSection({ className }) {
  const [news, setNews] = useState([]);
  const [scienceNews, setScienceNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [visibleNews, setVisibleNews] = useState(8);
  const [visibleScienceNews, setVisibleScienceNews] = useState(12);
  const [activeTab, setActiveTab] = useState('all'); 

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch(NEWS_JSON, { cache: "no-store" });
        if (!response.ok) throw new Error("Error al cargar noticias internas");
        const data = await response.json();
        
        const validNews = data
          .filter(
            (item) =>
              (item["titulo"] || "").trim() !== "" &&
              (item["cuerpo"] || "").trim() !== ""
          )
          .map((item) => ({
            titulo: String(item["titulo"] ?? ""),
            cuerpo: String(item["cuerpo"] ?? ""),
            fecha: String(item["fecha"] ?? ""),
            photo: String(item["photo"] ?? ""),
            timestamp: item["timestamp"],
            slug: String(item["slug"] ?? ""),
            type: 'internal'
          }))
          .sort((a, b) => b.timestamp - a.timestamp);
        
        setNews(validNews);

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
                      author_name: item.author?.name || 'Redacción Editorial',
                      author_slug: generateAuthorSlug(item.author?.name || ''),
                      area_id: item.area_id || 'general',
                      category: item.category || 'general',
                      photo: item.photo || getFallbackImage(item.area_id),
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
                console.warn(`Error cargando noticias del año ${year}:`, yearError);
              }
            }
            
            allScienceNews.sort((a, b) => b.timestamp - a.timestamp);
            setScienceNews(allScienceNews);
          }
        } catch (scienceError) {
          console.warn('No se pudieron cargar noticias científicas:', scienceError);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error al cargar noticias:", err);
        setError("Error al conectar con los repositorios editoriales.");
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  const filteredInternalNews = news.filter((n) =>
    n.titulo?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredScienceNews = scienceNews.filter((n) =>
    n.title_es?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (n.author_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const loadMoreNews = () => setVisibleNews((prev) => prev + 8);
  const loadMoreScienceNews = () => setVisibleScienceNews((prev) => prev + 12);
  
  const openNews = (item) => window.location.href = `/news/${item.slug}.html`;
  
  // CORRECCIÓN DE URL PARA NOTICIAS CIENTÍFICAS
  const openScienceNews = (item) => {
    window.location.href = `${SCIENCE_NEWS_URL_BASE}/${item.slug}.html`;
  };

  const featuredScience = filteredScienceNews.find(n => n.featured) || filteredScienceNews[0];
  const listScienceNews = filteredScienceNews.filter(n => n !== featuredScience).slice(0, visibleScienceNews);
  
  const sidebarScienceNews = listScienceNews.slice(0, 4);
  const gridScienceNews = listScienceNews.slice(4, 8);
  const highlightScienceNews = listScienceNews.slice(8, 9)[0]; 
  const extraScienceNews = listScienceNews.slice(9);

  if (loading) return <div className="py-32 text-center font-serif text-slate-500">Recuperando archivos...</div>;
  if (error) return <p className="text-center text-red-800 py-32 font-serif">{error}</p>;

  return (
    <div className={`w-full bg-white text-[#222] min-h-screen pb-24 ${className || ""}`}>
      
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=PT+Serif:ital,wght@0,400;0,700;1,400&family=Roboto:wght@300;400;500;700&display=swap');
        
        .font-serif-nature { font-family: 'PT Serif', Georgia, serif; }
        .font-sans-nature { font-family: 'Roboto', Arial, sans-serif; }
        
        .editorial-body p {
          margin-bottom: 0.5rem;
          line-height: 1.45;
          color: #444;
          font-family: 'Roboto', Arial, sans-serif;
          font-size: 0.9rem;
          font-weight: 300;
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;  
          overflow: hidden;
        }
        
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;  
          overflow: hidden;
        }

        .border-nature {
          border-color: #d8d8d8;
        }
      `}} />

      <div className="max-w-[1280px] mx-auto px-4 md:px-8 pt-8">
        
        {/* --- CONTROLES EDITORIALES --- */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-nature pb-3 gap-4">
          <div className="flex gap-6 w-full md:w-auto font-sans-nature">
            {['all', 'science', 'internal'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-[13px] font-bold uppercase tracking-wide transition-all ${
                  activeTab === tab ? 'text-black border-b-2 border-black pb-1' : 'text-gray-500 hover:text-black pb-1'
                }`}
              >
                {tab === 'all' ? 'Últimas' : tab === 'science' ? 'Investigación' : 'Institucional'}
              </button>
            ))}
          </div>
          
          <div className="w-full md:w-64">
            <input
              type="text"
              placeholder="Buscar artículos..."
              className="w-full bg-gray-50 border border-gray-300 py-1.5 px-3 text-sm font-sans-nature focus:outline-none focus:border-black transition-colors placeholder-gray-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* --- SECCIÓN: DIVULGACIÓN CIENTÍFICA --- */}
        {(activeTab === 'all' || activeTab === 'science') && scienceNews.length > 0 && (
          <section className="mb-16">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 border-b border-nature pb-8">
              
              {/* HERO (Left 8 cols) */}
              {featuredScience && (
                <div className="lg:col-span-8 flex flex-col md:flex-row bg-gray-50 border border-gray-200 cursor-pointer group" onClick={() => openScienceNews(featuredScience)}>
                  <div className="p-6 md:w-[45%] flex flex-col justify-center order-2 md:order-1">
                    <h2 className="text-[28px] md:text-[34px] font-serif-nature font-bold leading-[1.1] mb-3 text-black group-hover:text-blue-700 transition-colors">
                      {featuredScience.title_es}
                    </h2>
                    <div className="editorial-body line-clamp-3 mb-4">
                      {decodeBody(featuredScience.content_es, true)}
                    </div>
                    <div className="font-sans-nature text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                      <span className="text-gray-900">{featuredScience.category}</span> <span className="mx-1">|</span> {formatDate(featuredScience.createdAt)}
                    </div>
                  </div>
                  <div className="md:w-[55%] order-1 md:order-2 h-64 md:h-auto overflow-hidden">
                    <img
                      src={featuredScience.photo}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      alt={featuredScience.title_es}
                    />
                  </div>
                </div>
              )}

              {/* SIDEBAR (Right 4 cols) */}
              <div className="lg:col-span-4 flex flex-col divide-y divide-gray-300">
                {sidebarScienceNews.map((item, idx) => (
                  <article key={idx} className="py-4 first:pt-0 last:pb-0 cursor-pointer group flex flex-col justify-center h-full" onClick={() => openScienceNews(item)}>
                    <h3 className="text-[17px] font-serif-nature leading-tight mb-2 text-black group-hover:text-blue-700 transition-colors">
                      {item.title_es}
                    </h3>
                    <div className="font-sans-nature text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                      <span className="text-gray-900">{item.category}</span> <span className="mx-1">|</span> {formatDate(item.createdAt)}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {/* SECONDARY GRID (Image Top, Text Bottom) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8 border-b border-nature pb-8">
              {gridScienceNews.map((item, idx) => (
                <article key={`grid-${idx}`} className="cursor-pointer group flex flex-col" onClick={() => openScienceNews(item)}>
                  <div className="w-full aspect-[3/2] mb-3 overflow-hidden bg-gray-100">
                    <img src={item.photo} alt={item.title_es} className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
                  </div>
                  <h3 className="text-[18px] font-serif-nature font-bold leading-tight mb-2 text-black group-hover:text-blue-700">
                    {item.title_es}
                  </h3>
                  <div className="editorial-body line-clamp-3 mb-3 text-gray-600">
                    {decodeBody(item.content_es, true)}
                  </div>
                  <div className="mt-auto font-sans-nature text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    <span className="text-gray-900">{item.category}</span> <span className="mx-1">|</span> {formatDate(item.createdAt)}
                  </div>
                </article>
              ))}
              
              {/* HIGHLIGHT BOX (Opinion / Special) */}
              {highlightScienceNews && (
                <article className="bg-gray-100 p-5 border border-gray-200 cursor-pointer group flex flex-col" onClick={() => openScienceNews(highlightScienceNews)}>
                  <h3 className="text-[20px] font-serif-nature font-bold leading-tight mb-3 text-black group-hover:text-blue-700">
                    {highlightScienceNews.title_es}
                  </h3>
                  <div className="font-sans-nature text-[14px] font-bold text-gray-900 mb-1">
                    {highlightScienceNews.author_name}
                  </div>
                  <div className="font-sans-nature text-[11px] font-bold text-gray-500 uppercase tracking-wide mt-auto pt-4">
                    VISIÓN MUNDIAL <span className="mx-1">|</span> {formatDate(highlightScienceNews.createdAt)}
                  </div>
                </article>
              )}
            </div>

            {/* TERTIARY GRID (Dense Bottom Scroll) */}
            {extraScienceNews.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-[22px] font-serif-nature font-bold text-black">Más Noticias</h3>
                  <div className="flex-1 h-px bg-gray-300"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                  {extraScienceNews.map((item, idx) => (
                    <article key={`extra-${idx}`} className="cursor-pointer group flex flex-col" onClick={() => openScienceNews(item)}>
                      <div className="w-full aspect-video mb-3 overflow-hidden bg-gray-100">
                        <img src={item.photo} alt={item.title_es} className="w-full h-full object-cover group-hover:opacity-90" />
                      </div>
                      <h4 className="text-[15px] font-serif-nature font-bold leading-snug mb-1 text-black group-hover:text-blue-700">
                        {item.title_es}
                      </h4>
                      <div className="font-sans-nature text-[10px] font-bold text-gray-500 uppercase mt-auto pt-2">
                        {formatDate(item.createdAt)}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {filteredScienceNews.length > visibleScienceNews && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={loadMoreScienceNews}
                  className="px-6 py-2 border border-gray-400 text-black font-sans-nature text-[12px] font-bold uppercase hover:bg-gray-100 transition-colors"
                >
                  Cargar Más Artículos
                </button>
              </div>
            )}
          </section>
        )}

        {/* --- SECCIÓN: NOTICIAS INSTITUCIONALES --- */}
        {(activeTab === 'all' || activeTab === 'internal') && news.length > 0 && (
          <section className="mb-16">
            
            <div className="flex items-center gap-2 mb-6">
              <h2 className="text-[26px] font-serif-nature font-bold text-black">Boletines Institucionales</h2>
              <div className="flex-1 h-px bg-gray-300"></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
              {filteredInternalNews.slice(0, visibleNews).map((item, idx) => (
                <article 
                  key={`internal-${idx}`}
                  className="cursor-pointer group flex flex-col"
                  onClick={() => openNews(item)}
                >
                  {item.photo ? (
                    <div className="w-full aspect-[3/2] mb-3 overflow-hidden bg-gray-100">
                      <img src={item.photo} alt={item.titulo} className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
                    </div>
                  ) : (
                    <div className="w-full aspect-[3/2] mb-3 bg-gray-100 border border-gray-200 flex items-center justify-center p-4">
                      <span className="font-serif-nature text-gray-400 italic text-sm text-center line-clamp-3">{item.titulo}</span>
                    </div>
                  )}
                  
                  <h4 className="text-[17px] font-serif-nature font-bold leading-tight mb-2 text-black group-hover:text-blue-700 transition-colors">
                    {item.titulo}
                  </h4>
                  <div className="font-sans-nature text-[11px] font-bold text-gray-500 uppercase tracking-wide mt-auto pt-2 border-t border-gray-100">
                    BOLETÍN <span className="mx-1">|</span> {item.fecha}
                  </div>
                </article>
              ))}
            </div>

            {filteredInternalNews.length > visibleNews && (
              <div className="mt-10 flex justify-center border-t border-nature pt-6">
                <button
                  onClick={loadMoreNews}
                  className="px-6 py-2 border border-gray-400 text-black font-sans-nature text-[12px] font-bold uppercase hover:bg-gray-100 transition-colors"
                >
                  Cargar Más Boletines
                </button>
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  );
}