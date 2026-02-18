import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from 'react-i18next';

const NEWS_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQKnN8qMJcBN8im9Q61o-qElx1jQp5NdS80_B-FakCHrPLXHlQ_FXZWT0o5GVVHAM26l9sjLxsTCNO8/pub?output=csv";

const scriptURL =
  "https://script.google.com/macros/s/AKfycbyAmrjSmCkMTeLhzrLbtPd46hO9-uEenRPcD2B_Jp52g3GSEDYQr1SezZnC9WoWfBySng/exec";

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

const generateSlug = (name) => {
  if (!name) return '';
  name = name.toLowerCase();
  name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  name = name.replace(/\s+/g, '-');
  name = name.replace(/[^a-z0-9-]/g, '');
  name = name.replace(/-+/g, '-');
  name = name.replace(/^-+|-+$/g, '');
  return name;
};

const parseDate = (raw) => {
  if (!raw) return { label: "Sin fecha", iso: "" };
  let d = new Date(raw);
  if (isNaN(d.getTime())) {
    const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    }
  }
  if (isNaN(d.getTime())) {
    return { label: raw, iso: "" };
  }
  return {
    label: d.toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" }),
    iso: d.toISOString().split('T')[0]
  };
};

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
                cuerpo: base64DecodeUnicode(String(item["Contenido de la noticia"] ?? "")),
                ...parseDate(String(item["Fecha"] ?? ""))
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
    if (subscribing) return;
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

  const featured = filteredNews[0];
  const remaining = filteredNews.slice(1, visibleNews);

  if (loading) return <div className="py-20 text-center font-serif italic text-gray-400">Actualizando archivo de noticias...</div>;
  if (error) return <div className="py-20 text-center font-serif italic text-red-600">{error}</div>;

  return (
    <motion.div
      className={`max-w-7xl mx-auto px-4 py-12 bg-white text-gray-900 ${className || ""}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <header className="border-b-4 border-black pb-6 mb-12 flex flex-col md:flex-row justify-between items-end gap-8">
        <div>
          <h2 className="text-5xl font-serif font-black tracking-tighter mb-2">Boletín Informativo</h2>
          <p className="text-gray-500 font-serif italic">Crónicas, avances y anuncios de la comunidad científica estudiantil.</p>
        </div>
        <div className="w-full md:w-auto bg-gray-50 p-4 border border-gray-200">
          <p className="text-[10px] uppercase tracking-widest font-bold mb-3 text-gray-400">Suscripción Institucional</p>
          {!enviado ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Tu nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className="bg-white border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:border-black transition-colors"
              />
              <input
                type="email"
                placeholder="correo@ejemplo.edu"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
                className="bg-white border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:border-black transition-colors"
              />
              <button
                disabled={subscribing}
                className="bg-black text-white px-4 py-1.5 text-[10px] uppercase font-bold hover:bg-[#007398] transition-colors"
              >
                {subscribing ? "Enviando..." : "Unirse"}
              </button>
            </form>
          ) : (
            <p className="text-green-600 font-semibold text-center mt-4 text-sm">¡Gracias por suscribirte!</p>
          )}
        </div>
      </header>
      <div className="mb-12 relative">
        <input
          type="text"
          placeholder="Filtrar por palabra clave..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border-b border-gray-300 py-2 text-lg font-serif italic focus:outline-none focus:border-black transition-colors"
        />
        <span className="absolute right-0 top-2 text-gray-300 underline text-xs uppercase tracking-widest">Archivo Digital</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {filteredNews.length === 0 ? (
          <p className="col-span-full text-center text-gray-500 font-serif italic text-lg">No se encontraron noticias.</p>
        ) : (
          <>
            {featured && (
              <motion.article
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="lg:col-span-7 group cursor-pointer"
                onClick={() => window.location.href = `/news/${generateSlug(featured.titulo + " " + featured.iso)}.html`}
              >
                <div className="mb-4 overflow-hidden bg-gray-100 aspect-video flex items-center justify-center border border-gray-100">
                  <span className="text-6xl font-serif font-black text-gray-200 uppercase tracking-tighter">Ciencia Hoy</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#007398] mb-4 block">Nota Editorial</span>
                <h3 className="text-4xl font-serif font-bold leading-tight mb-4 group-hover:underline underline-offset-4 decoration-1">
                  {featured.titulo}
                </h3>
                <div
                  className="text-gray-600 leading-relaxed mb-4 line-clamp-3 font-serif italic text-lg"
                  dangerouslySetInnerHTML={{ __html: featured.cuerpo }}
                />
                <time className="text-xs font-mono text-gray-400 uppercase tracking-widest">{featured.label}</time>
              </motion.article>
            )}
            <div className="lg:col-span-5 flex flex-col gap-8 divide-y divide-gray-100">
              <AnimatePresence>
                {remaining.map((item, idx) => (
                  <motion.article
                    key={idx}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="pt-8 first:pt-0 group cursor-pointer"
                    onClick={() => window.location.href = `/news/${generateSlug(item.titulo + " " + item.iso)}.html`}
                  >
                    <time className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                      {item.label}
                    </time>
                    <h4 className="text-xl font-serif font-bold leading-snug group-hover:text-[#007398] transition-colors">
                      {item.titulo}
                    </h4>
                    <div
                      className="mt-2 text-sm text-gray-500 line-clamp-2 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: item.cuerpo }}
                    />
                  </motion.article>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
      {filteredNews.length > visibleNews && (
        <div className="mt-20 flex justify-center border-t border-black pt-8">
          <button
            onClick={() => setVisibleNews((prev) => prev + 6)}
            className="group flex items-center gap-4 text-xs font-black uppercase tracking-[0.5em] hover:text-[#007398] transition-all"
          >
            Cargar más registros
            <span className="group-hover:translate-x-2 transition-transform">→</span>
          </button>
        </div>
      )}
    </motion.div>
  );
}