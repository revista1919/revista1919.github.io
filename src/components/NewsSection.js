
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
              }));
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
  const remaining = filteredNews.slice(1, visibleNews);
  const half = Math.ceil(remaining.length / 2);
  const leftNews = remaining.slice(0, half);
  const rightNews = remaining.slice(half);
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
          placeholder="Filtrar por palabra clave..."
          className="w-full border-b border-gray-300 py-2 text-lg font-serif italic focus:outline-none focus:border-black transition-colors"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span className="absolute right-0 top-2 text-gray-300 underline text-xs uppercase tracking-widest">Archivo Digital</span>
      </div>
      {/* --- GRID EDITORIAL --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Columna Izquierda: Nota Editorial + Noticias Izquierdas */}
        <div className="lg:col-span-7 flex flex-col gap-12">
          {featured && (
            <motion.article
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="group cursor-pointer"
              onClick={() => openNews(featured)}
            >
              <div className="mb-4 overflow-hidden bg-gray-100 aspect-video flex items-center justify-center border border-gray-100">
                <img 
                  src="https://www.revistacienciasestudiantes.com/team.jpg" 
                  alt="Equipo de la Revista" 
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#007398] mb-4 block">Nota Editorial</span>
              <h3 className="text-4xl font-serif font-bold leading-tight mb-4 group-hover:underline underline-offset-4 decoration-1">
                {featured.titulo}
              </h3>
              <div
                className="text-gray-600 leading-relaxed mb-4 line-clamp-3 font-serif italic text-lg"
              >
                {decodeBody(featured.cuerpo)}
              </div>
              <div className="flex justify-between items-center">
                <time className="text-xs font-mono text-gray-400 uppercase tracking-widest">{featured.fecha}</time>
                <span className="text-sm text-gray-500 group-hover:text-[#007398] transition-colors">Leer más →</span>
              </div>
            </motion.article>
          )}
          <div className="flex flex-col gap-8 divide-y divide-gray-100">
            <AnimatePresence>
              {leftNews.map((item, idx) => (
                <motion.article
                  key={`left-${idx}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="pt-8 first:pt-0 group cursor-pointer"
                  onClick={() => openNews(item)}
                >
                  <time className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                    {item.fecha}
                  </time>
                  <h4 className="text-xl font-serif font-bold leading-snug group-hover:text-[#007398] transition-colors">
                    {item.titulo}
                  </h4>
                  <div
                    className="mt-2 text-sm text-gray-500 line-clamp-2 leading-relaxed"
                  >
                    {decodeBody(item.cuerpo)}
                  </div>
                  <span className="mt-2 text-sm text-gray-500 group-hover:text-[#007398] transition-colors block text-right">Leer más →</span>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        </div>
        {/* Columna Derecha: Noticias Derechas */}
        <div className="lg:col-span-5 flex flex-col gap-8 divide-y divide-gray-100">
          <AnimatePresence>
            {rightNews.map((item, idx) => (
              <motion.article
                key={`right-${idx}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="pt-8 first:pt-0 group cursor-pointer"
                onClick={() => openNews(item)}
              >
                <time className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                  {item.fecha}
                </time>
                <h4 className="text-xl font-serif font-bold leading-snug group-hover:text-[#007398] transition-colors">
                  {item.titulo}
                </h4>
                <div
                  className="mt-2 text-sm text-gray-500 line-clamp-2 leading-relaxed"
                >
                  {decodeBody(item.cuerpo)}
                </div>
                <span className="mt-2 text-sm text-gray-500 group-hover:text-[#007398] transition-colors block text-right">Leer más →</span>
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
        <div className="mt-20 flex justify-center border-t border-black pt-8">
          <button
            onClick={loadMoreNews}
            className="group flex items-center gap-4 text-xs font-black uppercase tracking-[0.5em] hover:text-[#007398] transition-all"
          >
            Cargar más registros
            <span className="group-hover:translate-x-2 transition-transform">→</span>
          </button>
        </div>
      )}
    </div>
  );
}
