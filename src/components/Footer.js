import React from 'react';
import logoIG from '/public/logoig.png'; // webpack se encarga
import logoYT from '/public/logoyt.png';

function Footer() {
  return (
    <footer className="bg-gray-800 text-white p-3 sm:p-4 mt-4 sm:mt-6 text-center text-xs sm:text-sm">
      <p>
        © 2025 Revista Nacional de las Ciencias para Estudiantes. Todos los
        derechos reservados.
      </p>

      {/* Contenedor de redes sociales centrado */}
      <div className="flex justify-center items-center gap-6 mt-2">
        {/* Instagram */}
        <a
          href="https://www.instagram.com/revistanacionalcienciae"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-blue-400 hover:text-blue-500"
        >
          <img
            src={logoIG}
            alt="Instagram"
            className="h-5 w-auto sm:h-6 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.insertAdjacentHTML(
                'afterend',
                '<span class="text-gray-400">[IG]</span>'
              );
            }}
          />
          @revistanacionalcienciae
        </a>

        {/* YouTube */}
        <a
          href="https://www.youtube.com/@RevistaNacionaldelasCienciaspa"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-red-400 hover:text-red-500"
        >
          <img
            src={logoYT}
            alt="YouTube"
            className="h-5 w-auto sm:h-6 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.insertAdjacentHTML(
                'afterend',
                '<span class="text-gray-400">[YT]</span>'
              );
            }}
          />
          Revista Nacional de las Ciencias para Estudiantes
        </a>
      </div>
    </footer>
  );
}

export default Footer;
