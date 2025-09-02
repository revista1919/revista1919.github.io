import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

function parseDateFlexible(dateStr) {
  if (!dateStr) return 'Fecha no disponible';
  let date = new Date(dateStr);
  if (!isNaN(date)) return date.toLocaleDateString();
  const parts = dateStr.split(/[\/.-]/);
  if (parts.length === 3) {
    let [day, month, year] = parts.map((p) => p.padStart(2, '0'));
    if (year.length === 2) year = '20' + year;
    date = new Date(`${year}-${month}-${day}`);
    if (!isNaN(date)) return date.toLocaleDateString();
  }
  return dateStr;
}

function getYear(dateStr) {
  if (!dateStr) return 's.f.'; // sin fecha
  let date = new Date(dateStr);
  if (!isNaN(date)) return date.getFullYear();
  const parts = dateStr.split(/[\/.-]/);
  if (parts.length === 3) {
    let [day, month, year] = parts.map((p) => p.padStart(2, '0'));
    if (year.length === 2) year = '20' + year;
    date = new Date(`${year}-${month}-${day}`);
    if (!isNaN(date)) return date.getFullYear();
  }
  return dateStr;
}

function ArticleCard({ article }) {
  const [showCitations, setShowCitations] = useState(false);
  const [showFullAbstract, setShowFullAbstract] = useState(false);
  const [isAuthorModalOpen, setIsAuthorModalOpen] = useState(false);
  const [authorsData, setAuthorsData] = useState([]);
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [csvError, setCsvError] = useState(null);

  const journal = 'Revista Nacional de las Ciencias para Estudiantes';
  const csvUrl =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';

  const pdfUrl = article['Número de artículo']
    ? `https://www.revistacienciasestudiantes.com/Articles/Articulo${article['Número de artículo']}.pdf`
    : null;

  // Cargar autores desde CSV
  useEffect(() => {
    setIsLoading(true);
    setCsvError(null);
    Papa.parse(csvUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setAuthorsData(result.data || []);
        setIsLoading(false);
      },
      error: () => {
        setCsvError('No se pudo cargar la información de los autores.');
        setAuthorsData([]);
        setIsLoading(false);
      },
    });
  }, []);

  const handleAuthorClick = (authorName) => {
    if (!authorName) return;
    setIsLoading(true);
    const author =
      authorsData.find((data) => data['Nombre'] === authorName) || {
        Nombre: authorName,
        Descripción: 'Información no disponible',
        'Áreas de interés': 'No especificadas',
      };
    setSelectedAuthor(author);
    setIsAuthorModalOpen(true);
    setIsLoading(false);
  };

  // Citas con JSX (para cursivas y links)
  const getChicagoCitation = () => {
    const authors = article['Autor(es)'] || 'Autor desconocido';
    const title = article['Título'] || 'Sin título';
    const volume = article['Volumen'] || '';
    const number = article['Número'] || '';
    const year = getYear(article['Fecha']);
    const pages = article['Páginas'] || '';

    return (
      <>
        {authors}. “{title}.” <em>{journal}</em> {volume}, no. {number} ({year}): {pages}.{' '}
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-words">
            {pdfUrl}
          </a>
        )}
      </>
    );
  };

  const getApaCitation = () => {
    const authors = article['Autor(es)'] || 'Autor desconocido';
    const title = article['Título'] || 'Sin título';
    const volume = article['Volumen'] || '';
    const number = article['Número'] || '';
    const year = getYear(article['Fecha']);
    const pages = article['Páginas'] || '';

    return (
      <>
        {authors} ({year}). {title}. <em>{journal}</em>, {volume}({number}), {pages}.{' '}
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-words">
            {pdfUrl}
          </a>
        )}
      </>
    );
  };

  const getMlaCitation = () => {
    const authors = article['Autor(es)'] || 'Autor desconocido';
    const title = article['Título'] || 'Sin título';
    const volume = article['Volumen'] || '';
    const number = article['Número'] || '';
    const year = getYear(article['Fecha']);
    const pages = article['Páginas'] || '';

    return (
      <>
        {authors}. “{title}.” <em>{journal}</em>, vol. {volume}, no. {number}, {year}, pp. {pages}.{' '}
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-words">
            {pdfUrl}
          </a>
        )}
      </>
    );
  };

  return (
    <div className="article-card bg-white p-4 sm:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <h2 className="text-lg sm:text-xl font-semibold mb-2 cursor-pointer hover:text-blue-600">
        {article['Título'] || 'Sin título'}
      </h2>

      <p className="text-gray-600 text-sm sm:text-base mb-1">
        <strong>Autor(es): </strong>
        {article['Autor(es)']?.split(',').map((a, idx, arr) => (
          <span
            key={idx}
            className="cursor-pointer hover:text-blue-500 underline"
            onClick={() => handleAuthorClick(a.trim())}
          >
            {a.trim()}
            {idx < arr.length - 1 ? ', ' : ''}
          </span>
        ))}
      </p>

      <p className="text-gray-600 text-sm sm:text-base mb-1">
        <strong>Fecha:</strong> {parseDateFlexible(article['Fecha'])}
      </p>
      <p className="text-gray-600 text-sm sm:text-base mb-2">
        <strong>Área:</strong> {article['Área temática'] || 'No especificada'}
      </p>

      {article['Palabras clave'] && (
        <div className="flex flex-wrap gap-2 mb-2">
          {article['Palabras clave']
            .split(/[;,]/)
            .map((k) => k.trim())
            .filter(Boolean)
            .map((kw, idx) => (
              <span
                key={idx}
                className="bg-gray-200 text-gray-800 text-xs sm:text-sm px-2 py-1 rounded-full"
              >
                {kw}
              </span>
            ))}
        </div>
      )}

      <p className="text-gray-700 text-sm sm:text-base mb-2">
        <strong>Resumen: </strong>
        {showFullAbstract ? article['Resumen'] : `${article['Resumen']?.slice(0, 100)}...`}
        {article['Resumen']?.length > 100 && (
          <button
            className="ml-2 text-blue-500 hover:underline text-xs sm:text-sm"
            onClick={() => setShowFullAbstract(!showFullAbstract)}
          >
            {showFullAbstract ? 'Leer menos' : 'Leer más'}
          </button>
        )}
      </p>

      {/* Botones */}
      <div className="flex gap-3 mb-3">
        {pdfUrl && (
          <>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs sm:text-sm"
            >
              Ver artículo
            </a>
            <a
              href={pdfUrl}
              download
              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs sm:text-sm"
            >
              Descargar PDF
            </a>
          </>
        )}
      </div>

      {/* Citas */}
      <button
        className="text-brown-800 hover:text-brown-700 text-sm sm:text-base mb-2 focus:outline-none focus:ring-2 focus:ring-brown-800"
        onClick={() => setShowCitations(!showCitations)}
      >
        {showCitations ? 'Ocultar citas' : 'Cómo citar este artículo'}
      </button>
      {showCitations && (
        <div className="text-gray-700 text-sm sm:text-base space-y-3 break-words">
          <p><strong>Chicago:</strong> {getChicagoCitation()}</p>
          <p><strong>APA:</strong> {getApaCitation()}</p>
          <p><strong>MLA:</strong> {getMlaCitation()}</p>
        </div>
      )}

{isAuthorModalOpen && selectedAuthor && (
  <div className="fixed inset-0 flex items-center justify-center z-50">
    {/* Fondo oscuro */}
    <div
      className="absolute inset-0 bg-black bg-opacity-40"
      onClick={() => setIsAuthorModalOpen(false)}
    ></div>

    {/* Contenedor del modal */}
    <div className="bg-white p-4 sm:p-6 rounded-lg max-w-sm w-full max-h-[80vh] overflow-y-auto shadow-xl z-50">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-bold">{selectedAuthor.Nombre || 'Autor desconocido'}</h3>
        <button
          className="text-gray-500 hover:text-gray-700 text-xl"
          onClick={() => setIsAuthorModalOpen(false)}
        >
          ×
        </button>
      </div>

      <div className="text-gray-700 text-sm sm:text-base space-y-2">
        <p><strong>Descripción:</strong> {selectedAuthor.Descripción || 'No disponible'}</p>
        <p><strong>Áreas de interés:</strong> {selectedAuthor['Áreas de interés'] || 'No especificadas'}</p>
      </div>
    </div>
  </div>
)}
    </div>
  );
}

export default ArticleCard;