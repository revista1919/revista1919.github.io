import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import { motion } from "framer-motion";
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
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export default function NewsSection({ className }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
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

  function truncateHTML(html, maxLength = 200) {
    // Simple HTML truncation: split by paragraphs, take first few, truncate last
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const paragraphs = Array.from(tempDiv.querySelectorAll('p, div, h1, h2, h3, ul, ol, img'));
    let truncated = '';
    let charCount = 0;
    for (let elem of paragraphs) {
      const elemText = elem.outerHTML;
      if (charCount + elemText.length > maxLength) {
        // Truncate the last element
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
    if (!body) return <p className="text-[#000000]">Sin contenido disponible.</p>;
    try {
      let html = base64DecodeUnicode(body);
      if (truncate) {
        html = truncateHTML(html, 200); // Short preview for cards
      }
      return (
        <div
          className="ql-editor break-words leading-relaxed text-[#000000] overflow-hidden"
          style={{ lineHeight: '1.6', marginBottom: '10px' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } catch (err) {
      console.error('Error decoding body:', err);
      return <p className="text-[#000000]">Error al decodificar contenido.</p>;
    }
  }

  const filteredNews = news.filter((n) =>
    n.titulo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const loadMoreNews = () => setVisibleNews((prev) => prev + 6);

  const openNews = (item) => {
    const slug = generateSlug(`${item.titulo} ${item.fecha}`);
    window.location.href = `/news/${slug}.html`;
  };

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
              onClick={() => openNews(item)}
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
                className="text-[#000000] text-sm leading-relaxed overflow-hidden"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {decodeBody(item.cuerpo, true)}
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
            Ver más
          </button>
        </div>
      )}
    </div>
  );
}