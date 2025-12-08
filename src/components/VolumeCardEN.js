import React, { useState } from 'react';

function VolumeCardEN({ volume }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  const pdfUrl = volume.pdf || '';
  const portada = volume.portada || '';

  const title = `Volume ${volume.volumen || 'N/A'} - Issue ${volume.numero || 'N/A'} ${volume.titulo ? `- ${volume.titulo}` : ''}`;

  return (
    <div
      className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 cursor-pointer border border-gold-200"
      onClick={toggleExpand}
    >
      <div className="p-6">
        <h2 className="text-2xl font-serif text-gold-800 mb-2">{title}</h2>
        <p className="text-sm text-gray-600 mb-4">{volume.fecha || 'Date not available'}</p>
        {portada && (
          <img src={portada} alt={`Cover of ${title}`} className="w-full h-48 object-cover rounded-md mb-4" />
        )}
        {!isExpanded && volume.abstract && (
          <p className="text-gray-700 line-clamp-3">{volume.abstract}</p>
        )}
      </div>
      {isExpanded && (
        <div className="px-6 pb-6 bg-gradient-to-b from-white to-gold-50 animate-fadeIn">
          <p className="text-gray-700 mb-4">{volume.abstract || 'Abstract not available'}</p>
          <p className="text-gray-700 mb-4">{volume.resumen || 'Resumen no disponible'}</p>
          <div className="mb-4">
            <strong>Thematic Area:</strong> {volume.area || 'Not specified'}
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {volume.keywords?.map((kw, idx) => (
              <span key={idx} className="bg-gold-100 text-gold-800 px-3 py-1 rounded-full text-sm">{kw}</span>
            ))}
          </div>
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-gold-600 text-white px-6 py-3 rounded-md hover:bg-gold-700 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              Download Volume PDF
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default VolumeCardEN;