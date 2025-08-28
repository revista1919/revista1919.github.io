import React from 'react';

function Footer() {
  return (
    <footer className="bg-gray-800 text-white p-3 sm:p-4 mt-4 sm:mt-6 text-center text-xs sm:text-sm">
      <p>© 2025 Revista Nacional de las Ciencias para Estudiantes. Todos los derechos reservados.</p>

      <div className="flex flex-wrap justify-center items-center gap-6 mt-3 sm:mt-4">
        {/* Instagram */}
        <a
          href="https://www.instagram.com/revistanacionalcienciae"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-blue-400 hover:text-blue-500"
        >
          <img
            src="/logoig.png"
            alt="Instagram"
            className="h-5 w-auto sm:h-6 object-contain"
            onError={(e) => {
              e.target.onerror = null;
              e.target.replaceWith(document.createTextNode("📷"));
            }}
          />
          <span>@revistanacionalcienciae</span>
        </a>

        {/* YouTube */}
        <a
          href="https://www.youtube.com/@RevistaNacionaldelasCienciaspa"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-red-400 hover:text-red-500"
        >
          <img
            src="/logoyt.png"
            alt="YouTube"
            className="h-5 w-auto sm:h-6 object-contain"
            onError={(e) => {
              e.target.onerror = null;
              e.target.replaceWith(document.createTextNode("▶️"));
            }}
          />
          <span>Revista Nacional de las Ciencias para Estudiantes</span>
        </a>
      </div>
    </footer>
  );
}

export default Footer;
