import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import { motion, AnimatePresence } from "framer-motion";

const NEWS_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQKnN8qMJcBN8im9Q61o-qElx1jQp5NdS80_B-FakCHrPLXHlQ_FXZWT0o5GVVHAM26l9sjLxsTCNO8/pub?output=csv";

export default function NewsSection({ className }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [selectedNews, setSelectedNews] = useState(null);

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

  // ---- Utilidades de fecha ----
  function formatDate(raw) {
    if (!raw) return "Sin fecha";
    const d = new Date(raw);
    if (isNaN(d)) return raw; 
    try {
      return d.toLocaleString("es-CL", {
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

  // ---- Detección de imágenes y normalización de URL ----
  function isLikelyImageUrl(url) {
    if (!url) return false;
    const u = url.toLowerCase();
    return (
      /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/.test(u) ||
      /googleusercontent|gstatic|ggpht|google\.(com|cl).*\/(img|images|url)/.test(u)
    );
  }

  function normalizeUrl(u) {
    let url = (u || "").trim();
    if (/^https?:[^/]/i.test(url)) url = url.replace(/^https?:/i, (m) => m + "//");
    return url;
  }

  // ---- Parser completo ----
  function decodeBody(body) {
    if (!body) return <p className="text-[#7a5c4f]">Sin contenido disponible.</p>;
    const paragraphs = String(body).split("===");

    return paragraphs.map((p, idx) => (
      <p key={idx} className="mb-4 leading-relaxed break-words">
        {renderParagraph(p)}
      </p>
    ));
  }

  function renderParagraph(p) {
    let text = p;
    const placeholders = [];
    const TOK = (i) => `__TOK${i}__`;

    // Detectar texto(link)
    const linkPattern = /(.+?)\((https?:\/\/[^\s)]+)\)/g;
    text = text.replace(linkPattern, (_, anchorText, url) => {
      const words = anchorText.trim().split(" ");
      const normalText = words.slice(0, -1).join(" "); 
      const clickableText = words[words.length - 1]; 
      const id = placeholders.length;
      placeholders.push({ type: "anchor", normalText, clickableText, url });
      return TOK(id);
    });

    // URLs sueltas
    const urlPattern = /https?:\/\/[^\s)]+/g;
    text = text.replace(urlPattern, (u) => {
      const id = placeholders.length;
      placeholders.push({
        type: isLikelyImageUrl(u) ? "image" : "url",
        url: u,
      });
      return TOK(id);
    });

    return renderWithStylesAndTokens(text, placeholders);
  }

  function renderWithStylesAndTokens(text, placeholders) {
    const parts = text.split(/(__TOK\d+__)/g);
    const out = [];
    let buf = "";
    let bold = false;
    let italic = false;
    let key = 0;

    function flush() {
      if (!buf) return;
      out.push(...renderOnlyStyles(buf, bold, italic, key));
      key += 1;
      buf = "";
    }

    for (const part of parts) {
      if (/^__TOK\d+__$/.test(part)) {
        flush();
        const idx = Number(part.replace(/__TOK(\d+)__/, "$1"));
        const ph = placeholders[idx];
        if (!ph) continue;

        if (ph.type === "anchor") {
          const url = normalizeUrl(ph.url);
          const normalNodes = renderOnlyStyles(ph.normalText);
          const clickableNode = (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {renderOnlyStyles(ph.clickableText)}
            </a>
          );
          out.push(...normalNodes, " ", clickableNode);
        } else if (ph.type === "image") {
          const url = normalizeUrl(ph.url);
          out.push(
            <img
              src={url}
              alt="Imagen de la noticia"
              className="max-w-full h-auto rounded-md my-2"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src =
                  "https://via.placeholder.com/800x450?text=Imagen+no+disponible";
              }}
              key={key++}
            />
          );
        } else {
          const url = normalizeUrl(ph.url);
          out.push(
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
              key={key++}
            >
              {url}
            </a>
          );
        }
        continue;
      }

      // Parse * y /
      for (let i = 0; i < part.length; i++) {
        const ch = part[i];
        if (ch === "*") {
          flush();
          bold = !bold;
        } else if (ch === "/") {
          flush();
          italic = !italic;
        } else {
          buf += ch;
        }
      }
    }
    flush();
    return out;
  }

  function renderOnlyStyles(text, bold = false, italic = false) {
    const out = [];
    let buf = "";
    let key = 0;

    function push(str) {
      if (!str) return;
      if (bold && italic) out.push(<strong key={key++}><em>{str}</em></strong>);
      else if (bold) out.push(<strong key={key++}>{str}</strong>);
      else if (italic) out.push(<em key={key++}>{str}</em>);
      else out.push(<span key={key++}>{str}</span>);
    }

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === "*") {
        push(buf);
        buf = "";
        bold = !bold;
      } else if (ch === "/") {
        push(buf);
        buf = "";
        italic = !italic;
      } else buf += ch;
    }
    push(buf);
    return out;
  }

  const filteredNews = news.filter((n) =>
    n.titulo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <p className="text-center text-[#7a5c4f]">Cargando noticias...</p>;
  if (error) return <p className="text-center text-red-500">{error}</p>;

  return (
    <div className={`space-y-6 bg-[#f4ece7] p-6 rounded-lg shadow-md ${className || ""}`}>
      <h3 className="text-2xl font-semibold text-[#5a3e36]">Noticias</h3>

      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#5a3e36] bg-white text-[#5a3e36]"
        placeholder="Buscar noticias..."
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredNews.length === 0 ? (
          <p className="text-center text-[#7a5c4f] col-span-full">No se encontraron noticias.</p>
        ) : (
          filteredNews.map((item, idx) => (
            <motion.div
              key={idx}
              whileHover={{ scale: 1.02 }}
              className="bg-white p-4 rounded-2xl shadow-md cursor-pointer flex flex-col"
              onClick={() => setSelectedNews(item)}
            >
              <h4
                className="text-lg font-semibold text-[#5a3e36] mb-2"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {item.titulo}
              </h4>

              <p className="text-sm text-gray-500 mb-3">{item.fecha}</p>

              <div
                className="text-[#7a5c4f] text-sm"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {decodeBody(item.cuerpo)}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selectedNews && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedNews(null)}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6"
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.92 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-2xl font-bold text-[#5a3e36] mb-4">{selectedNews.titulo}</h4>
              <p className="text-sm text-gray-500 mb-6">{selectedNews.fecha}</p>
              <div className="text-[#7a5c4f]">{decodeBody(selectedNews.cuerpo)}</div>
              <button
                onClick={() => setSelectedNews(null)}
                className="mt-6 px-4 py-2 bg-[#5a3e36] text-white rounded-lg hover:bg-[#5a3e36]/80 transition"
              >
                Cerrar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
