import React, { useState } from 'react';

function VolumeCard({ volume }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  const pdfUrl = volume.pdf || '';
  const htmlUrl = `/volumes/volume-${volume.volumen}-${volume.numero}.html`; // Asumiendo slug basado en el script
  const portada = volume.portada || '';

  const title = `Volumen ${volume.volumen || 'N/A'} - Número ${volume.numero || 'N/A'} ${volume.titulo ? `- ${volume.titulo}` : ''}`;

  return (
    <div
      className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-2xl transition-all duration-300 cursor-pointer border border-blue-200 transform hover:-translate-y-1"
      onClick={toggleExpand}
    >
      <div className="p-6 relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-300"></div>
        <h2 className="text-2xl font-serif text-blue-800 mb-2">{title}</h2>
        <p className="text-sm text-gray-600 mb-4">{volume.fecha || 'Fecha no disponible'}</p>
        {portada && (
          <div className="relative overflow-hidden rounded-lg mb-4 shadow-inner">
            <img 
              src={portada} 
              alt={`Portada de ${title}`} 
              className="w-full h-56 object-cover transition-transform duration-300 hover:scale-105" 
            />
          </div>
        )}
        {!isExpanded && volume.resumen && (
          <p className="text-gray-700 line-clamp-3 italic">{volume.resumen}</p>
        )}
      </div>
      {isExpanded && (
        <div className="px-6 pb-6 bg-gradient-to-b from-white to-blue-50 animate-fadeIn">
          <p className="text-gray-700 mb-4">{volume.resumen || 'Resumen no disponible'}</p>
          <p className="text-gray-700 mb-4">{volume.abstract || 'Abstract no disponible'}</p>
          <div className="mb-4">
            <strong>Áreas:</strong> {volume.area || 'No especificadas'}
          </div>
          <div className="flex flex-wrap gap-2 mb-6">
            {volume.palabras_clave?.map((kw, idx) => (
              <span key={idx} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">{kw}</span>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-all duration-300 shadow-md hover:shadow-lg flex-1 text-center"
                onClick={(e) => e.stopPropagation()}
              >
                Descargar PDF del Volumen
              </a>
            )}
            <a
              href={htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-blue-800 text-white px-6 py-3 rounded-md hover:bg-blue-900 transition-all duration-300 shadow-md hover:shadow-lg flex-1 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              Abrir Página del Volumen
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default VolumeCard;