import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from 'react-i18next';
const NEWS_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQKnN8qMJcBN8im9Q61o-qElx1jQp5NdS80_B-FakCHrPLXHlQ_FXZWT0o5GVVHAM26l9sjLxsTCNO8/pub?output=csv";
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
      return parsedDate.toLocaleString("es-CL", {
        timeZone: "America/Santiago",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
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
  if (!body) return <p className="text-gray-800">Sin contenido disponible.</p>;
  try {
    let html = base64DecodeUnicode(body);
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
    return <p className="text-gray-800">Error al decodificar contenido.</p>;
  }
}
export default function NewsSection({ className }) {
  const [news, setNews] = useState([]);
  const [welcomeNote, setWelcomeNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [visibleNews, setVisibleNews] = useState(7);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const scriptURL =
    "https://script.google.com/macros/s/AKfycbzyyR93tD85nPprIKAR_IDoWYBSAnlFwVes09rJgOM3KQsByg_MgzafWDK1BcFhfVJHew/exec";
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch(NEWS_CSV, { cache: "no-store" });
        if (!response.ok) throw new Error("Error al cargar el archivo CSV");
        const csvText = await response.text();
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          delimiter: ",",
          transform: (value) => (typeof value === "string" ? value.trim() : value),
          complete: ({ data }) => {
            if (!data || data.length === 0) {
              setError("CSV vacío o sin formato válido");
              setLoading(false);
              return;
            }
            const validNews = data
              .filter(
                (item) =>
                  (item["Título"] || "").trim() !== "" &&
                  (item["Contenido de la noticia"] || "").trim() !== ""
              )
              .map((item) => ({
                titulo: String(item["Título"] ?? ""),
                cuerpo: String(item["Contenido de la noticia"] ?? ""),
                fecha: formatDate(String(item["Fecha"] ?? "")),
                fechaIso: parseDateIso(String(item["Fecha"] ?? "")),
                photo: String(item["Photo"] ?? ""),
                timestamp: new Date(parseDateIso(String(item["Fecha"] ?? ""))).getTime()
              }))
              .sort((a, b) => b.timestamp - a.timestamp);
            const foundWelcome = validNews.find(n => n.fechaIso === '2025-09-15');
            setWelcomeNote(foundWelcome);
            setNews(validNews);
            setLoading(false);
          },
          error: (err) => {
            console.error("Error al parsear CSV:", err);
            setError("Error al cargar noticias");
            setLoading(false);
          },
        });
      } catch (err) {
        console.error("Error al cargar noticias:", err);
        setError("Error al conectar con el servidor");
        setLoading(false);
      }
    };
    fetchNews();
  }, []);
  const handleSubmit = (e) => {
    e.preventDefault();
    setSubscribing(true);
    const formData = new URLSearchParams();
    formData.append("nombre", nombre);
    formData.append("correo", correo);
    fetch(scriptURL, { method: "POST", body: formData })
      .then((r) => r.text())
      .then(() => {
        setEnviado(true);
        setNombre("");
        setCorreo("");
        setSubscribing(false);
      })
      .catch((err) => {
        alert("Error al enviar: " + err);
        setSubscribing(false);
      });
  };
  const filteredNews = news.filter((n) =>
    n.titulo?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const loadMoreNews = () => setVisibleNews((prev) => prev + 6);
  const openNews = (item) => {
    const slug = generateSlug(`${item.titulo} ${item.fechaIso}`);
    window.location.href = `/news/${slug}.html`;
  };
  const featured = filteredNews[0];
  const listNews = filteredNews.slice(1, visibleNews);
  if (loading) return <div className="py-20 text-center font-serif italic text-gray-400">Actualizando archivo de noticias...</div>;
  if (error) return <p className="text-center text-red-600">{error}</p>;
  return (
    <div className={`max-w-7xl mx-auto px-4 py-12 bg-white text-gray-900 ${className || ""}`}>
      {/* --- HEADER & NEWSLETTER --- */}
      <header className="border-b-4 border-black pb-6 mb-12 flex flex-col md:flex-row justify-between items-end gap-8">
        <div>
          <h2 className="text-5xl font-serif font-black tracking-tighter mb-2">Boletín Informativo</h2>
          <p className="text-gray-500 font-serif italic">Crónicas, avances y anuncios de la comunidad científica estudiantil.</p>
        </div>
        <div className="w-full md:w-auto bg-gray-50 p-4 border border-gray-200">
          <p className="text-[10px] uppercase tracking-widest font-bold mb-3 text-gray-400">Suscripción</p>
          {!enviado ? (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Tu nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className="bg-white border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:border-black transition-colors w-full"
              />
              <input
                type="email"
                placeholder="correo@gmail.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
                className="bg-white border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:border-black transition-colors w-full"
              />
              <button
                type="submit"
                disabled={subscribing}
                className="bg-black text-white px-4 py-1.5 text-[10px] uppercase font-bold hover:bg-[#007398] transition-colors"
              >
                {subscribing ? "Enviando..." : "Unirse"}
              </button>
            </form>
          ) : (
            <p className="text-green-600 font-semibold text-center mt-4">
              ¡Gracias por suscribirte!
            </p>
          )}
        </div>
      </header>
      {/* --- BARRA DE BÚSQUEDA --- */}
      <div className="mb-12 relative">
        <input
          type="text"
          placeholder="Buscar en el archivo..."
          className="w-full border-b border-gray-200 py-2 text-lg font-serif italic focus:outline-none focus:border-blue-600 transition-colors"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      {/* --- GRID EDITORIAL SIMÉTRICO --- */}
      <div className="flex flex-col gap-12">
        {/* 1. ARTÍCULO DESTACADO (Más Reciente) */}
        {featured && (
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-12 border-b border-gray-100 group cursor-pointer"
            onClick={() => openNews(featured)}
          >
            <div className="lg:col-span-7 flex flex-col gap-8">
              <div className="overflow-hidden rounded-sm bg-gray-100 aspect-video">
                <img 
                  src={featured.photo ? `data:image/jpeg;base64,${featured.photo}` : "https://www.revistacienciasestudiantes.com/team.jpg"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                  alt="Featured"
                />
              </div>
              {welcomeNote && welcomeNote.fechaIso !== featured.fechaIso && (
                <div className="group/welcome cursor-pointer" onClick={(e) => { e.stopPropagation(); openNews(welcomeNote); }}>
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-600 mb-4 block">Nota Editorial</span>
                  <h3 className="text-4xl font-serif font-bold leading-tight group-hover/welcome:text-blue-600 transition-colors">
                    {welcomeNote.titulo}
                  </h3>
                </div>
              )}
            </div>
            <div className="lg:col-span-5 flex flex-col justify-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-600 mb-4 block">Última Actualización</span>
              <h3 className="text-4xl font-serif font-bold leading-tight mb-4 group-hover:text-blue-600 transition-colors">
                {featured.titulo}
              </h3>
              <div className="text-gray-600 font-serif text-lg mb-6 line-clamp-3 italic">
                {decodeBody(featured.cuerpo, true)}
              </div>
              <time className="text-xs font-mono text-gray-400">{featured.fecha}</time>
            </div>
          </motion.article>
        )}
        {/* 2. GRID DE NOTICIAS RESTANTES (Simetría Perfecta) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-16">
          <AnimatePresence>
            {listNews.map((item, idx) => (
              <motion.article
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="flex flex-col border-t border-gray-100 pt-6 group cursor-pointer"
                onClick={() => openNews(item)}
              >
                <div className="mb-3 h-32 bg-gray-100 rounded overflow-hidden">
                  <img 
                    src={item.photo ? `data:image/jpeg;base64,${item.photo}` : "https://via.placeholder.com/400x225?text=Imagen+Noticia"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                    alt={item.titulo}
                  />
                </div>
                <time className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-3 block">
                  {item.fecha}
                </time>
                <h4 className="text-xl font-serif font-bold leading-snug mb-3 group-hover:underline decoration-blue-200">
                  {item.titulo}
                </h4>
                <div className="text-sm text-gray-500 line-clamp-3 leading-relaxed mb-4 italic">
                  {decodeBody(item.cuerpo, true)}
                </div>
                <div className="mt-auto pt-4 flex justify-end border-t border-gray-50">
                  <span className="text-[10px] font-black uppercase tracking-widest group-hover:text-blue-600 transition-colors">
                    Leer Nota →
                  </span>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      </div>
      {filteredNews.length === 0 && (
        <p className="text-center text-gray-600 col-span-full mt-8">
          No se encontraron noticias.
        </p>
      )}
      {!loading && filteredNews.length > visibleNews && (
        <div className="mt-20 flex justify-center border-t-2 border-black pt-10">
          <button
            onClick={loadMoreNews}
            className="px-12 py-4 bg-gray-900 text-white text-[10px] font-black uppercase tracking-[0.4em] hover:bg-blue-600 transition-all shadow-xl"
          >
            Explorar Archivo Completo
          </button>
        </div>
      )}
    </div>
  );
}