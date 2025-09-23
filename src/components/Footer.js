import React, { useState } from 'react';
import logoIG from '/public/logoig.png';
import logoYT from '/public/logoyt.png';
import { useTranslation } from 'react-i18next';

function Footer() {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [enviado, setEnviado] = useState(false);

  const scriptURL = "https://script.google.com/macros/s/AKfycbzyyR93tD85nPprIKAR_IDoWYBSAnlFwVes09rJgOM3KQsByg_MgzafWDK1BcFhfVJHew/exec";

 const handleSubmit = (e) => {
  e.preventDefault();
  const formData = new URLSearchParams();
  formData.append('nombre', nombre);
  formData.append('correo', correo);

  fetch(scriptURL, {
    method: "POST",
    body: formData
  })
    .then(r => r.text())  // 🔹 Cambiado
    .then(res => {
      setEnviado(true);    // simple feedback
      setNombre('');
      setCorreo('');
    })
    .catch(err => alert("Error al enviar: " + err));
};


  return (
    <footer className="bg-gray-800 text-white p-4 sm:p-6 mt-6 text-center text-xs sm:text-sm">
      {/* Copyright */}
      <p>© 2025 Revista Nacional de las Ciencias para Estudiantes. Todos los derechos reservados.</p>

      {/* Redes sociales */}
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
          />
          <span className="underline">@revistanacionalcienciae</span>
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
          />
          <span className="underline block truncate">Revista Nacional de las Ciencias</span>
        </a>

        {/* TikTok */}
        <a
          href="https://www.tiktok.com/@revistacienciaestudiante?_t=ZM-8zn7utyYgfV&_r=1&fbclid=PAb21jcAM4geVleHRuA2FlbQIxMQABp6FwcLtLWxDXe4_8tmRePn2jurMVJ1_Lua30PwJL6IWE6Ft0S7IlkH94WljP_aem_GiF6Itr22HQ5B2y8qYSzGQ"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center text-black hover:text-gray-800 text-center max-w-[200px]"
        >
          <img
            src="https://i.postimg.cc/zGShz56s/d800ce127021655e50667df1734a2a7e.png"
            alt="TikTok"
            className="h-8 w-8 sm:h-6 sm:w-6 object-contain mb-1"
          />
          <span className="underline block truncate">@revistacienciaestudiante</span>
        </a>

        {/* Spotify */}
        <a
          href="https://open.spotify.com/show/6amsgUkNXgUTD219XpuqOe?si=LPzCNpusQjSLGBq_pPrVTw"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center text-green-500 hover:text-green-600 text-center max-w-[200px]"
        >
          <img
            src="https://i.postimg.cc/XvBgkXvT/spotify-logo-1.png"
            alt="Spotify"
            className="h-8 w-8 sm:h-6 sm:w-6 object-contain mb-1"
          />
          <span className="underline block truncate">Podcast</span>
        </a>
      </div>

      {/* Newsletter */}
      <div className="mt-6">
        {!enviado ? (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row justify-center items-center gap-3 max-w-xl mx-auto"
          >
            <input
              type="text"
              placeholder="Tu nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="p-2 rounded border border-gray-400 flex-1 w-full sm:w-auto text-gray-800"
            />
            <input
              type="email"
              placeholder="Tu correo"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
              className="p-2 rounded border border-gray-400 flex-1 w-full sm:w-auto text-gray-800"
            />
            <button
              type="submit"
              className="bg-yellow-500 text-gray-900 px-4 py-2 rounded hover:bg-yellow-400 transition-colors font-semibold"
            >
              Suscribirse
            </button>
          </form>
        ) : (
          <p className="text-green-400 font-semibold mt-2">¡Gracias por suscribirte!</p>
        )}
      </div>
    </footer>
  );
}

export default Footer;