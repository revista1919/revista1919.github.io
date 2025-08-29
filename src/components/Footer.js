import React from 'react';
import logoIG from '/public/logoig.png';
import logoYT from '/public/logoyt.png';

function Footer() {
  return (
    <footer className="bg-gray-800 text-white p-3 sm:p-4 mt-4 sm:mt-6 text-center text-xs sm:text-sm">
      <p>
        © 2025 Revista Nacional de las Ciencias para Estudiantes. Todos los
        derechos reservados.
      </p>

      {/* Redes sociales responsivas y simétricas */}
      <div className="flex flex-col sm:flex-row justify-center items-center gap-6 mt-4">
        {/* Instagram */}
        <a
          href="https://www.instagram.com/revistanacionalcienciae"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center text-blue-400 hover:text-blue-500 text-center max-w-[200px]"
        >
          <img
            src={logoIG}
            alt="Instagram"
            className="h-8 w-8 sm:h-6 sm:w-6 object-contain mb-1"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.insertAdjacentHTML(
                'afterend',
                '<span class="text-gray-400">[IG]</span>'
              );
            }}
          />
          <span>@revistanacionalcienciae</span>
        </a>

        {/* YouTube */}
        <a
          href="https://www.youtube.com/@RevistaNacionaldelasCienciaspa"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center text-red-400 hover:text-red-500 text-center max-w-[200px]"
        >
          <img
            src={logoYT}
            alt="YouTube"
            className="h-8 w-8 sm:h-6 sm:w-6 object-contain mb-1"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.insertAdjacentHTML(
                'afterend',
                '<span class="text-gray-400">[YT]</span>'
              );
            }}
          />
          <span>Revista Nacional de las Ciencias</span>
        </a>
      </div>
    </footer>
  );
}

export default Footer;

