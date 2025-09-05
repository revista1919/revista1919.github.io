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
  const [visibleNews, setVisibleNews] = useState(6);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [enviado, setEnviado] = useState(false);
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
    const formData = new URLSearchParams();
    formData.append("nombre", nombre);
    formData.append("correo", correo);
    fetch(scriptURL, { method: "POST", body: formData })
      .then((r) => r.text())
      .then(() => {
        setEnviado(true);
        setNombre("");
        setCorreo("");
      })
      .catch((err) => alert("Error al enviar: " + err));
  };

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

  function isLikelyImageUrl(url) {
    if (!url) return false;
    const u = url.toLowerCase();
    return (
      /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/.test(u) ||
      /googleusercontent|gstatic|ggpht|google\.(com|cl).*\/(img|images|url)/.test(u) ||
      /^data:image\/[a-zA-Z+]+;base64,/.test(u)
    );
  }

  function normalizeUrl(u) {
    let url = (u || "").trim();
    if (/^https?:[^/]/i.test(url)) {
      url = url.replace(/^https?:/i, (m) => m + "//");
    }
    return url;
  }

  function decodeBody(body) {
    if (!body) return <p className="text-[#000000]">Sin contenido disponible.</p>;
    const paragraphs = String(body)
      .split("===")
      .filter((p) => p.trim() !== "");
    return paragraphs.map((p, idx) => (
      <div key={idx} className="mb-4 leading-relaxed break-words" style={{ clear: "both" }}>
        {renderParagraph(p)}
      </div>
    ));
  }

  function renderParagraph(p) {
    let text = p.trim();
    const placeholders = [];
    const TOK = (i) => `__TOK${i}__`;

    // Handle escaping
    text = text.replace(/\\([*/_$~])/g, (_, char) => `<<ESC_${char.charCodeAt(0)}>>`);

    // Handle alignment and size
    let align = "";
    let size = "";
    text = text.replace(/\[align:([^\]]*)\]/gi, (_, a) => {
      align = a;
      return "";
    });
    text = text.replace(/\[size:([^\]]*)\]/gi, (_, s) => {
      size = s;
      return "";
    });

    // Image pattern: [img:URL,width,height,align]
    const imgPattern = /\[img:([^\]]*?)(?:,(\d*(?:px|%)?))?(?:,(\d*(?:px|%)?))?(?:,(left|center|right))?\]/gi;
    text = text.replace(imgPattern, (_, url, width = "auto", height = "auto", imgAlign = "left") => {
      const id = placeholders.length;
      placeholders.push({ type: "image", url: normalizeUrl(url), width, height, align: imgAlign });
      return TOK(id);
    });

    // Link pattern: word(URL)
    const linkPattern = /\b(\w+)\((https?:\/\/[^\s)]+)\)/gi;
    text = text.replace(linkPattern, (_, word, url) => {
      const id = placeholders.length;
      placeholders.push({ type: "link", word, url });
      return TOK(id);
    });

    // Standalone URLs
    const urlPattern = /(?:https?:\/\/[^\s)]+|^data:image\/[a-zA-Z+]+;base64,[^\s)]+)/gi;
    text = text.replace(urlPattern, (u) => {
      if (placeholders.some((ph) => ph.url === u)) return u;
      const id = placeholders.length;
      placeholders.push({ type: isLikelyImageUrl(u) ? "image" : "url", url: u });
      return TOK(id);
    });

    // Revert escaped characters
    text = text.replace(/<<ESC_(\d+)>>/g, (_, code) => String.fromCharCode(Number(code)));

    // Process styles
    const parts = text.split(/(__TOK\d+__)/g);
    const out = [];
    let buf = "";
    let bold = false;
    let italic = false;
    let underline = false;
    let strike = false;
    let key = 0;

    for (const part of parts) {
      if (/^__TOK\d+__$/.test(part)) {
        if (buf) {
          out.push(
            <span
              key={key++}
              style={{
                fontWeight: bold ? "bold" : "normal",
                fontStyle: italic ? "italic" : "normal",
                textDecoration: `${underline ? "underline" : ""} ${strike ? "line-through" : ""}`.trim(),
              }}
            >
              {buf}
            </span>
          );
          buf = "";
        }
        const idx = Number(part.match(/\d+/)[0]);
        const ph = placeholders[idx];
        if (!ph) continue;
        if (ph.type === "link") {
          out.push(
            <a
              key={key++}
              href={normalizeUrl(ph.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {ph.word}
            </a>
          );
        } else if (ph.type === "image") {
          out.push(
            <img
              key={key++}
              src={normalizeUrl(ph.url)}
              alt="Imagen de la noticia"
              className="max-w-full h-auto rounded-md my-2"
              style={{
                width: ph.width,
                height: ph.height,
                display: "block",
                marginLeft: ph.align === "left" ? "0" : ph.align === "center" ? "auto" : "auto",
                marginRight: ph.align === "right" ? "0" : ph.align === "center" ? "auto" : "auto",
                float: ph.align === "left" || ph.align === "right" ? ph.align : "none",
              }}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "https://via.placeholder.com/800x450?text=Imagen+no+disponible";
              }}
            />
          );
        } else if (ph.type === "url") {
          out.push(
            <a
              key={key++}
              href={normalizeUrl(ph.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {ph.url}
            </a>
          );
        }
        continue;
      }
      for (const ch of part) {
        if (ch === "*") {
          if (buf) {
            out.push(
              <span
                key={key++}
                style={{
                  fontWeight: bold ? "bold" : "normal",
                  fontStyle: italic ? "italic" : "normal",
                  textDecoration: `${underline ? "underline" : ""} ${strike ? "line-through" : ""}`.trim(),
                }}
              >
                {buf}
              </span>
            );
            buf = "";
          }
          bold = !bold;
        } else if (ch === "/") {
          if (buf) {
            out.push(
              <span
                key={key++}
                style={{
                  fontWeight: bold ? "bold" : "normal",
                  fontStyle: italic ? "italic" : "normal",
                  textDecoration: `${underline ? "underline" : ""} ${strike ? "line-through" : ""}`.trim(),
                }}
              >
                {buf}
              </span>
            );
            buf = "";
          }
          italic = !italic;
        } else if (ch === "$") {
          if (buf) {
            out.push(
              <span
                key={key++}
                style={{
                  fontWeight: bold ? "bold" : "normal",
                  fontStyle: italic ? "italic" : "normal",
                  textDecoration: `${underline ? "underline" : ""} ${strike ? "line-through" : ""}`.trim(),
                }}
              >
                {buf}
              </span>
            );
            buf = "";
          }
          underline = !underline;
        } else if (ch === "~") {
          if (buf) {
            out.push(
              <span
                key={key++}
                style={{
                  fontWeight: bold ? "bold" : "normal",
                  fontStyle: italic ? "italic" : "normal",
                  textDecoration: `${underline ? "underline" : ""} ${strike ? "line-through" : ""}`.trim(),
                }}
              >
                {buf}
              </span>
            );
            buf = "";
          }
          strike = !strike;
        } else {
          buf += ch;
        }
      }
    }
    if (buf) {
      out.push(
        <span
          key={key++}
          style={{
            fontWeight: bold ? "bold" : "normal",
            fontStyle: italic ? "italic" : "normal",
            textDecoration: `${underline ? "underline" : ""} ${strike ? "line-through" : ""}`.trim(),
          }}
        >
          {buf}
        </span>
      );
    }
    return <span style={{ textAlign: align || "left", fontSize: size || "inherit" }}>{out}</span>;
  }

  const filteredNews = news.filter((n) =>
    n.titulo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const loadMoreNews = () => setVisibleNews((prev) => prev + 6);

  if (loading) return <p className="text-center text-[#000000]">Cargando noticias...</p>;
  if (error) return <p className="text-center text-red-500">{error}</p>;

  return (
    <div className={`space-y-6 bg-[#f4ece7] p-6 rounded-lg shadow-md ${className || ""}`}>
      <h3 className="text-2xl font-semibold text-[#5a3e36]">Noticias</h3>
      <div className="bg-gradient-to-br from-[#f9f6f2] to-[#f1e7df] p-6 rounded-2xl shadow-lg max-w-2xl mx-auto border border-[#e2d8cf]">
        <h4 className="text-xl font-semibold text-[#5a3e36] text-center mb-3">
          Suscríbete a nuestra Newsletter
        </h4>
        <p className="text-center text-[#3e3e3e] mb-6 text-sm">
          Recibe directamente en tu correo las últimas noticias y artículos académicos.
        </p>
        {!enviado ? (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row justify-center items-center gap-3"
          >
            <input
              type="text"
              placeholder="Tu nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="px-4 py-2 rounded-lg border border-gray-300 w-full sm:flex-1 text-[#000000] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#800020] transition"
            />
            <input
              type="email"
              placeholder="Tu correo"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
              className="px-4 py-2 rounded-lg border border-gray-300 w-full sm:flex-1 text-[#000000] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#800020] transition"
            />
            <button
              type="submit"
              className="bg-[#800020] text-white px-6 py-2 rounded-lg font-medium shadow-md hover:bg-[#5a0015] transition-colors duration-200"
            >
              Suscribirse
            </button>
          </form>
        ) : (
          <p className="text-green-700 font-semibold text-center mt-4">
            ¡Gracias por suscribirte!
          </p>
        )}
      </div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#5a3e36] bg-white text-[#000000]"
        placeholder="Buscar noticias..."
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredNews.length === 0 ? (
          <p className="text-center text-[#000000] col-span-full">
            No se encontraron noticias.
          </p>
        ) : (
          filteredNews.slice(0, visibleNews).map((item, idx) => (
            <motion.div
              key={idx}
              whileHover={{ scale: 1.015 }}
              className="bg-white p-5 rounded-2xl shadow-lg cursor-pointer flex flex-col border border-gray-100 hover:shadow-xl transition"
              onClick={() => setSelectedNews(item)}
            >
              <h4
                className="text-lg font-semibold text-[#5a3e36] mb-2 leading-snug"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {item.titulo}
              </h4>
              <p className="text-sm text-gray-500 mb-3 italic">{item.fecha}</p>
              <div
                className="text-[#000000] text-sm leading-relaxed"
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
      {!loading && filteredNews.length > visibleNews && (
        <div className="text-center mt-6">
          <button
            className="bg-[#5a3e36] text-white px-4 py-2 rounded-md hover:bg-[#7a5c4f] focus:outline-none focus:ring-2 focus:ring-[#5a3e36] text-sm sm:text-base"
            onClick={loadMoreNews}
          >
            Mostrar más
          </button>
        </div>
      )}
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
              className="bg-white rounded-2xl shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 flex flex-col"
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.92 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-2xl font-bold text-[#5a3e36] mb-4">
                {selectedNews.titulo}
              </h4>
              <p className="text-sm text-gray-500 mb-6">{selectedNews.fecha}</p>
              <div className="text-[#000000] flex-1">{decodeBody(selectedNews.cuerpo)}</div>
              <div className="mt-6 text-center">
                <button
                  onClick={() => setSelectedNews(null)}
                  className="px-4 py-2 bg-[#5a3e36] text-white rounded-lg hover:bg-[#5a3e36]/80 transition"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}