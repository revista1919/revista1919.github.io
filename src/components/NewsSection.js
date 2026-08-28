import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import NewsletterSubscription from './NewsletterSubscription';

const NEWS_JSON = "/news/news.json";
const SCIENCE_NEWS_INDEX = "/science/index.json";
const SCIENCE_NEWS_BASE = "/science";
const SCIENCE_NEWS_URL_BASE = "/science/news";

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

function formatDate(raw, short = false) {
  if (!raw) return "Sin fecha";
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
      if (short) {
        return parsedDate.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
      }
      return parsedDate.toLocaleString("es-CL", {
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

function decodeBody(body, truncate = false, length = 250) {
  if (!body) return <p className="text-slate-700">Sin contenido disponible.</p>;
  try {
    let html = body;
    if (body.startsWith('data:') || /^[A-Za-z0-9+/=]+$/.test(body)) {
      html = base64DecodeUnicode(body);
    }
    if (truncate) {
      html = truncateHTML(html, length);
    }
    return (
      <div
        className="editorial-abstract"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch (err) {
    console.error('Error decoding body:', err);
    return <p className="text-slate-700">Error al decodificar contenido.</p>;
  }
}

// ========== MAPEO DE ÁREAS ==========
const AREAS_MAP = {
  'biologia': { es: 'Biología', color: '#059669' },
  'quimica': { es: 'Química', color: '#7c3aed' },
  'fisica': { es: 'Física', color: '#2563eb' },
  'matematica': { es: 'Matemática', color: '#dc2626' },
  'computacion': { es: 'Computación', color: '#0891b2' },
  'astronomia': { es: 'Astronomía', color: '#4f46e5' },
  'geologia': { es: 'Geología', color: '#b45309' },
  'medicina': { es: 'Medicina', color: '#e11d48' },
  'ingenieria': { es: 'Ingeniería', color: '#475569' },
  'ciencias_sociales': { es: 'Ciencias Soc.', color: '#9333ea' },
  'medio_ambiente': { es: 'Medio Ambiente', color: '#16a34a' },
  'neurociencia': { es: 'Neurociencia', color: '#db2777' },
  'logros_estudiantiles': { es: 'Logros', color: '#ea580c' },
  'general': { es: 'Ciencia', color: '#334155' }
};

// ========== COMPONENTE PRINCIPAL ==========
export default function NewsSection({ className }) {
  const [news, setNews] = useState([]);
  const [scienceNews, setScienceNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [visibleScienceNews, setVisibleScienceNews] = useState(12);
  const [activeTab, setActiveTab] = useState('all');
  const [showAllInternalNews, setShowAllInternalNews] = useState(false); // Estado para controlar la visibilidad

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
            fechaIso: String(item["fechaIso"] ?? ""),
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
                      content_es: item.content?.es || '',
                      author_name: item.author?.name || 'Redacción Editorial',
                      author_slug: generateAuthorSlug(item.author?.name || ''),
                      area_id: item.area_id || 'general',
                      photo: item.photo || '',
                      featured: item.featured || false,
                      createdAt: item.metadata?.createdAt || new Date().toISOString(),
                      timestamp: item.metadata?.createdTimestamp || new Date().getTime(),
                      slug: item.slug || '',
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

  const loadMoreScienceNews = () => setVisibleScienceNews((prev) => prev + 8);

  const openNews = (item) => window.location.href = `/news/${item.slug}.html`;
  const openScienceNews = (item) => window.location.href = `${SCIENCE_NEWS_URL_BASE}/${item.slug}.html`;
  const openAuthorProfile = (authorSlug) => window.location.href = `/team/${authorSlug}.html`;

  // Organización de datos para el grid denso
  const featuredScience = filteredScienceNews.find(n => n.featured) || filteredScienceNews[0];
  const sidebarScienceNews = filteredScienceNews.filter(n => n.id !== featuredScience?.id).slice(0, 4);
  const visualRowNews = filteredScienceNews.filter(n => n.id !== featuredScience?.id && !sidebarScienceNews.includes(n)).slice(0, 4);
  const remainingScienceNews = filteredScienceNews.filter(n => n.id !== featuredScience?.id && !sidebarScienceNews.includes(n) && !visualRowNews.includes(n)).slice(0, visibleScienceNews - 9);

  // Control de noticias internas visibles
  const internalNewsToShow = showAllInternalNews ? filteredInternalNews : filteredInternalNews.slice(0, 4);

  if (loading) return <div className="py-32 text-center font-serif italic text-slate-500 text-lg tracking-widest">Iniciando prensa rotativa...</div>;
  if (error) return <p className="text-center text-red-800 py-32 font-serif bg-red-50 border-t border-red-200">{error}</p>;

  return (
    <div className={`w-full bg-[#FCFCFB] text-[#111] min-h-screen pb-24 ${className || ""}`}>

      {/* --- INYECCIÓN TIPOGRÁFICA ESTRICTA (ESTILO EDITORIAL) --- */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700&family=Inter:wght@400;500;600;700;800&display=swap');
        
        .font-journal { font-family: 'Merriweather', serif; }
        .font-system { font-family: 'Inter', sans-serif; }
        
        .editorial-abstract p {
          margin-bottom: 0.5rem;
          line-height: 1.5;
          color: #475569;
          font-family: 'Merriweather', serif;
          font-size: 0.95rem;
        }
        .editorial-abstract.text-small p {
          font-size: 0.85rem;
          line-height: 1.4;
          color: #64748b;
        }
        .editorial-abstract.text-large p {
          font-size: 1.15rem;
          line-height: 1.6;
          color: #334155;
        }
        
        .truncate-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .truncate-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        
        .newspaper-columns {
          column-count: 1;
          column-gap: 2rem;
        }
        @media (min-width: 768px) { .newspaper-columns { column-count: 2; } }
        @media (min-width: 1024px) { .newspaper-columns { column-count: 3; } }
        
        .newspaper-item {
          break-inside: avoid;
          page-break-inside: avoid;
        }
      `}} />

      <div className="max-w-[1600px] mx-auto px-4 md:px-8 pt-12">

        {/* --- MASTHEAD & NAVEGACIÓN --- */}
        <header className="mb-10">
          <div className="flex flex-col md:flex-row justify-between items-end border-b-[4px] border-[#0F172A] pb-6 mb-4 gap-6">
            <div>
              <h1 className="text-6xl md:text-8xl lg:text-[7.5rem] font-journal font-black tracking-tighter leading-none text-[#0F172A]">
                Ciencia<span className="text-[#EA580C]">.</span>
              </h1>
              <p className="font-system font-bold uppercase tracking-[0.25em] text-xs text-slate-500 mt-4 ml-1">
                Noticias de la Revista Nacional de las Ciencias para Estudiantes
              </p>
            </div>
            
            <div className="w-full md:w-64">
              <div className="relative border-b border-slate-300 pb-1">
                <input
                  type="text"
                  placeholder="Buscar artículos..."
                  className="w-full bg-transparent text-sm font-system font-medium text-slate-800 focus:outline-none placeholder-slate-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <svg className="w-4 h-4 absolute right-0 top-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
            </div>
          </div>

          <nav className="flex gap-8 border-b border-slate-200 pb-4 overflow-x-auto hide-scrollbar">
            {[
              { id: 'all', label: 'Portada Completa' },
              { id: 'science', label: 'Investigación & Divulgación' },
              { id: 'internal', label: 'Boletín Académico' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap font-system text-xs font-bold uppercase tracking-[0.15em] transition-colors ${
                  activeTab === tab.id
                    ? 'text-[#0F172A]'
                    : 'text-slate-400 hover:text-[#EA580C]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </header>

        {/* --- SECCIÓN: DIVULGACIÓN CIENTÍFICA --- */}
        {(activeTab === 'all' || activeTab === 'science') && scienceNews.length > 0 && (
          <section className="mb-20">
            
            {/* BLOQUE SUPERIOR: Hero + Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 border-b-2 border-slate-900 pb-12 mb-10">
              
              {/* Artículo Principal */}
              {featuredScience && (
                <article 
                  className="lg:col-span-8 group cursor-pointer lg:border-r border-slate-300 lg:pr-12"
                  onClick={() => openScienceNews(featuredScience)}
                >
                  <div className="relative mb-6 overflow-hidden bg-slate-100">
                    <img
                      src={featuredScience.photo || "https://www.revistacienciasestudiantes.com/team.jpg"}
                      className="w-full aspect-video object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                      alt={featuredScience.title_es}
                      onError={(e) => {
                        e.target.src = "https://www.revistacienciasestudiantes.com/team.jpg";
                      }}
                    />
                    <div className="absolute bottom-0 left-0 p-3 bg-white/90 backdrop-blur-sm border-t border-r border-slate-200">
                       <span className="font-system text-[10px] font-black uppercase tracking-widest" style={{ color: AREAS_MAP[featuredScience.area_id]?.color || '#0F172A' }}>
                         {AREAS_MAP[featuredScience.area_id]?.es || 'General'}
                       </span>
                    </div>
                  </div>

                  <h2 className="text-4xl md:text-5xl lg:text-[3.5rem] font-journal font-black leading-[1.1] mb-5 text-[#0F172A] group-hover:text-[#EA580C] transition-colors">
                    {featuredScience.title_es}
                  </h2>
                  
                  <div className="editorial-abstract text-large mb-6 truncate-3">
                    {decodeBody(featuredScience.content_es, true, 300)}
                  </div>

                  <div className="flex items-center gap-3 font-system text-xs font-semibold text-slate-500 uppercase tracking-wider border-t border-slate-200 pt-4">
                    <span 
                      className="text-[#0F172A] hover:text-[#EA580C] cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); openAuthorProfile(featuredScience.author_slug); }}
                    >
                      Por {featuredScience.author_name}
                    </span>
                    <span>|</span>
                    <time>{formatDate(featuredScience.createdAt)}</time>
                  </div>
                </article>
              )}

              {/* Sidebar con Newsletter */}
              <aside className="lg:col-span-4 flex flex-col gap-8">
                {/* Newsletter destacado */}
                <div className="bg-[#0F172A] text-white p-6 rounded-sm shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#EA580C] rounded-full opacity-10 translate-x-1/3 -translate-y-1/3"></div>
                  <h3 className="font-journal text-2xl font-bold mb-3 relative z-10">Suscríbete al Boletín</h3>
                  <p className="font-system text-sm text-slate-300 mb-4 relative z-10">
                    Recibe todas las investigaciones y noticias directamente en tu correo.
                  </p>
                  <div className="relative z-10">
                    <NewsletterSubscription variant="compact" showTitle={false} />
                  </div>
                </div>

                {/* En Tendencia */}
                <div>
                  <div className="flex items-center justify-between border-b border-black pb-2 mb-4">
                    <h3 className="font-system font-black uppercase tracking-[0.2em] text-sm text-[#0F172A]">En Tendencia</h3>
                    <span className="w-2 h-2 bg-[#EA580C] rounded-full animate-pulse"></span>
                  </div>
                  
                  <div className="flex flex-col gap-0">
                    {sidebarScienceNews.map((item, idx) => (
                      <article 
                        key={item.id} 
                        className="group cursor-pointer py-4 border-b border-slate-200 last:border-b-0 hover:bg-slate-50 transition-colors -mx-2 px-2 rounded-sm flex gap-4"
                        onClick={() => openScienceNews(item)}
                      >
                        <div className="w-20 h-20 flex-shrink-0 bg-slate-100 overflow-hidden">
                          <img
                            src={item.photo || "https://www.revistacienciasestudiantes.com/team.jpg"}
                            className="w-full h-full object-cover"
                            alt={item.title_es}
                            onError={(e) => {
                              e.target.src = "https://www.revistacienciasestudiantes.com/team.jpg";
                            }}
                          />
                        </div>
                        
                        <div className="flex-1">
                          <span className="font-system text-[9px] font-bold uppercase tracking-widest mb-1 block" style={{ color: AREAS_MAP[item.area_id]?.color || '#0F172A' }}>
                            {AREAS_MAP[item.area_id]?.es || 'General'}
                          </span>
                          <h4 className="text-sm font-journal font-bold leading-snug mb-1 text-[#0F172A] group-hover:text-[#EA580C]">
                            {item.title_es}
                          </h4>
                          <time className="font-system text-[9px] text-slate-400 font-medium uppercase tracking-wider block">
                            {formatDate(item.createdAt, true)}
                          </time>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </aside>
            </div>

            {/* BLOQUE MEDIO: Fila Visual */}
            {visualRowNews.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 border-b border-slate-300 pb-12 mb-12">
                {visualRowNews.map((item) => (
                  <article 
                    key={item.id} 
                    className="group cursor-pointer flex flex-col h-full"
                    onClick={() => openScienceNews(item)}
                  >
                    <div className="overflow-hidden mb-4 relative aspect-[16/10] bg-slate-100">
                      <img
                        src={item.photo || "https://www.revistacienciasestudiantes.com/team.jpg"}
                        className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-500"
                        alt={item.title_es}
                        onError={(e) => {
                          e.target.src = "https://www.revistacienciasestudiantes.com/team.jpg";
                        }}
                      />
                      <div className="absolute top-0 w-full h-1" style={{ backgroundColor: AREAS_MAP[item.area_id]?.color || '#0F172A' }}></div>
                    </div>
                    <h4 className="text-lg font-journal font-bold leading-tight mb-2 group-hover:text-[#EA580C] transition-colors">
                      {item.title_es}
                    </h4>
                    <p className="font-system text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-auto pt-2">
                      {item.author_name} <span className="mx-1">•</span> {formatDate(item.createdAt, true)}
                    </p>
                  </article>
                ))}
              </div>
            )}

            {/* BLOQUE INFERIOR: Más noticias */}
            {remainingScienceNews.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {remainingScienceNews.map((item) => (
                   <article 
                    key={item.id} 
                    className="group cursor-pointer flex gap-4 border-b border-slate-200 pb-6"
                    onClick={() => openScienceNews(item)}
                  >
                    <div className="w-24 h-24 flex-shrink-0 bg-slate-100 overflow-hidden">
                      <img 
                        src={item.photo || "https://www.revistacienciasestudiantes.com/team.jpg"} 
                        className="w-full h-full object-cover"
                        alt={item.title_es}
                        onError={(e) => {
                          e.target.src = "https://www.revistacienciasestudiantes.com/team.jpg";
                        }}
                      />
                    </div>
                    <div className="flex-1 flex flex-col">
                      <span className="font-system text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: AREAS_MAP[item.area_id]?.color || '#0F172A' }}>
                        {AREAS_MAP[item.area_id]?.es || 'General'}
                      </span>
                      <h4 className="text-base font-journal font-bold leading-snug mb-2 group-hover:text-[#EA580C]">
                        {item.title_es}
                      </h4>
                      <time className="font-system text-[10px] text-slate-400 mt-auto">{formatDate(item.createdAt, true)}</time>
                    </div>
                  </article>
                ))}
              </div>
            )}
            
            {filteredScienceNews.length > visibleScienceNews && (
              <div className="mt-8 text-center">
                <button
                  onClick={loadMoreScienceNews}
                  className="font-system text-xs font-bold uppercase tracking-[0.2em] text-[#0F172A] border-b border-[#0F172A] pb-1 hover:text-[#EA580C] hover:border-[#EA580C] transition-colors"
                >
                  Cargar más investigaciones
                </button>
              </div>
            )}

          </section>
        )}


        {/* --- SECCIÓN: INSTITUCIONAL --- */}
        {(activeTab === 'all' || activeTab === 'internal') && news.length > 0 && (
          <section className="bg-slate-100/50 border-t-4 border-[#0F172A] py-12 px-6 md:px-12 -mx-4 md:-mx-8 rounded-sm">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4 border-b border-slate-300 pb-6">
              <div>
                <h2 className="text-4xl md:text-5xl font-journal font-black tracking-tight text-[#0F172A] m-0">
                  Boletín Académico
                </h2>
                <p className="font-system text-sm text-slate-500 mt-2">Comunicados, avisos y noticias de la comunidad.</p>
              </div>
              <span className="font-system font-bold uppercase tracking-widest text-xs px-3 py-1 bg-white border border-slate-300 text-slate-500 shadow-sm">
                Edición Oficial
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              
              {/* Lista de Noticias Internas */}
              <div className="lg:col-span-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {internalNewsToShow.map((item, idx) => (
                    <article 
                      key={item.slug || idx}
                      className="group cursor-pointer bg-white border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all rounded-sm relative flex flex-col"
                      onClick={() => openNews(item)}
                    >
                      {item.photo && (
                        <div className="aspect-[16/9] bg-slate-100 overflow-hidden">
                          <img
                            src={item.photo}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            alt={item.titulo}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      
                      <div className="absolute top-0 left-0 w-1 h-full bg-[#EA580C] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      
                      <div className="p-5 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                          <span className="font-system text-[9px] font-black uppercase tracking-[0.25em] text-[#EA580C]">
                            Aviso Oficial
                          </span>
                          <time className="font-system text-[10px] text-slate-400 font-medium uppercase">
                            {formatDate(item.fechaIso || item.fecha, true)}
                          </time>
                        </div>
                        
                        <h4 className="text-xl font-journal font-bold leading-tight mb-3 text-[#0F172A] group-hover:text-[#EA580C] transition-colors">
                          {item.titulo}
                        </h4>
                        
                        <div className="editorial-abstract text-small truncate-3 opacity-80">
                          {decodeBody(item.cuerpo, true, 180)}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {/* Botón Mostrar más/menos */}
                {filteredInternalNews.length > 4 && (
                  <div className="mt-8 text-center">
                    <button
                      onClick={() => setShowAllInternalNews(!showAllInternalNews)}
                      className="font-system text-xs font-bold uppercase tracking-[0.2em] text-[#0F172A] border-b border-[#0F172A] pb-1 hover:text-[#EA580C] hover:border-[#EA580C] transition-colors"
                    >
                      {showAllInternalNews ? 'Mostrar menos' : 'Mostrar más'}
                    </button>
                  </div>
                )}
              </div>

              {/* Sidebar Derecha: Enlaces rápidos y widgets */}
              <div className="lg:col-span-4 flex flex-col gap-8">
                <div className="sticky top-8">
                  <div className="border-t border-slate-300 pt-6">
                    <h5 className="font-system font-bold uppercase tracking-widest text-xs text-slate-400 mb-4">Enlaces Rápidos</h5>
                    <ul className="flex flex-col gap-3 font-journal text-sm text-[#0F172A]">
                      <li>
                        <a 
                          href="https://www.revistacienciasestudiantes.com/quick.html" 
                          className="hover:text-[#EA580C] underline decoration-slate-300 underline-offset-4"
                        >
                          Políticas para Autores
                        </a>
                      </li>
                      <li>
                        <a 
                          href="https://www.revistacienciasestudiantes.com/policies.html" 
                          className="hover:text-[#EA580C] underline decoration-slate-300 underline-offset-4"
                        >
                          Normativas
                        </a>
                      </li>
                      <li>
                        <a 
                          href="https://www.revistacienciasestudiantes.com/article" 
                          className="hover:text-[#EA580C] underline decoration-slate-300 underline-offset-4"
                        >
                          Archivo Histórico
                        </a>
                      </li>
                    </ul>
                  </div>

                  {/* --- WIDGET 1: LECTURA OBLIGATORIA --- */}
                  <div className="mt-8 bg-white p-8 border border-slate-200 shadow-sm rounded-sm">
                    <div className="flex items-center justify-between border-b border-black pb-3 mb-6">
                      <h3 className="font-system font-black uppercase tracking-[0.2em] text-sm text-[#0F172A]">
                        Lectura recomendada
                      </h3>
                      <svg className="w-5 h-5 text-[#EA580C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>

                    <article 
                      className="group cursor-pointer"
                      onClick={() => window.location.href = "https://www.revistacienciasestudiantes.com/news/bienvenido-a-la-revista-nacional-de-las-ciencias-para-estudiantes-2025-09-15.html"}
                    >
                      <div className="overflow-hidden mb-5 aspect-[3/2] bg-slate-100">
                        <img 
                          src="https://www.revistacienciasestudiantes.com/team.jpg"
                          alt="¡Bienvenido a la Revista Nacional de las Ciencias para Estudiantes!"
                          className="w-full h-full object-cover object-[center_20%] scale-110 transition-transform duration-500 group-hover:scale-125"
                          onError={(e) => { e.target.src = 'https://www.revistacienciasestudiantes.com/team.jpg'; }}
                        />
                      </div>
                      
                      <span className="font-system text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">
                        Editorial • 15 Septiembre 2025
                      </span>
                      
                      <h4 className="font-journal text-2xl font-black leading-tight text-[#0F172A] group-hover:text-[#EA580C] transition-colors mb-3">
                        Bienvenido a la Revista Nacional de las Ciencias para Estudiantes
                      </h4>
                      
                      <p className="editorial-abstract text-small text-slate-700 mb-5 line-clamp-3">
                        Un mensaje inaugural del equipo editorial que marca el inicio de esta plataforma dedicada a la divulgación científica estudiantil en Chile. Conoce nuestros objetivos y cómo puedes participar.
                      </p>
                      
                      <div className="font-system text-xs font-bold uppercase tracking-wider text-[#EA580C] flex items-center gap-2 group-hover:gap-3 transition-all">
                        Leer artículo completo 
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                      </div>
                    </article>
                  </div>

                  {/* --- WIDGET 2: SECCIÓN DE AYUDA (FAQ) --- */}
                  <div className="mt-8 bg-[#0F172A] text-white p-8 rounded-sm shadow-xl relative overflow-hidden">
                    <svg className="absolute -bottom-10 -right-10 w-48 h-48 text-[#EA580C] opacity-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5L8 10.667V9a1 1 0 10-2 0v3a1 1 0 001 1h3a1 1 0 100-2H8.333l2.167-3.167A1 1 0 0010 7z" clipRule="evenodd" /></svg>
                    
                    <div className="relative z-10">
                      <div className="flex items-center gap-4 mb-5">
                        <div className="p-3 bg-[#EA580C]/20 rounded-full">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 1.73-2 3.13-2 1.93 0 3.5 1.57 3.5 3.5 0 1.721-1.264 3.08-2.88 3.27M14 16h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h3 className="font-system font-black uppercase tracking-[0.2em] text-sm text-slate-300">
                          ¿Dudas sobre la Revista?
                        </h3>
                      </div>
                      
                      <p className="font-system text-sm text-slate-300 mb-6 leading-relaxed">
                        Hemos recopilado las respuestas a las consultas más frecuentes de autores, lectores y colaboradores sobre nuestras políticas y procesos.
                      </p>
                      
                      <a 
                        href="https://www.revistacienciasestudiantes.com/faq" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-block w-full text-center bg-white text-[#0F172A] font-system text-sm font-bold py-3.5 px-6 rounded-[2px] hover:bg-slate-100 transition-colors shadow-md"
                      >
                        Ir a Preguntas Frecuentes
                      </a>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </section>
        )}

        {/* --- ESTADO VACÍO --- */}
        {filteredInternalNews.length === 0 && filteredScienceNews.length === 0 && !loading && (
          <div className="py-24 text-center border-t border-slate-200 mt-10">
            <svg className="w-12 h-12 mx-auto text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v10a2 2 0 01-2 2z" />
            </svg>
            <p className="font-journal text-xl text-slate-500">
              El archivo no contiene registros que coincidan con la búsqueda.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}