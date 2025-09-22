'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import logoIG from '/public/logoig.png';
import logoYT from '/public/logoyt.png';

function Footer() {
  const t = useTranslations('Footer');
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
      .then(r => r.text())
      .then(res => {
        setEnviado(true);
        setNombre('');
        setCorreo('');
      })
      .catch(err => alert(t('errors.submitError') + err));
  };

  return (
    <footer className="bg-gray-800 text-white p-4 sm:p-6 mt-6 text-center text-xs sm:text-sm">
      <p>{t('copyright')}</p>
      <div className="flex flex-col sm:flex-row justify-center items-center gap-6 mt-4">
        <a
          href="https://www.instagram.com/revistanacionalcienciae"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center text-blue-400 hover:text-blue-500 text-center max-w-[200px]"
          aria-label={t('instagramAria')}
        >
          <img
            src={logoIG}
            alt={t('instagramAlt')}
            className="h-8 w-8 sm:h-6 sm:w-6 object-contain mb-1"
          />
          <span className="underline">@revistanacionalcienciae</span>
        </a>
        <a
          href="https://www.youtube.com/@RevistaNacionaldelasCienciaspa"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center text-red-400 hover:text-red-500 text-center max-w-[200px]"
          aria-label={t('youtubeAria')}
        >
          <img
            src={logoYT}
            alt={t('youtubeAlt')}
            className="h-8 w-8 sm:h-6 sm:w-6 object-contain mb-1"
          />
          <span className="underline block truncate">{t('youtubeText')}</span>
        </a>
        <a
          href="https://www.tiktok.com/@revistacienciaestudiante?_t=ZM-8zn7utyYgfV&_r=1&fbclid=PAb21jcAM4geVleHRuA2FlbQIxMQABp6FwcLtLWxDXe4_8tmRePn2jurMVJ1_Lua30PwJL6IWE6Ft0S7IlkH94WljP_aem_GiF6Itr22HQ5B2y8qYSzGQ"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center text-black hover:text-gray-800 text-center max-w-[200px]"
          aria-label={t('tiktokAria')}
        >
          <img
            src="https://i.postimg.cc/zGShz56s/d800ce127021655e50667df1734a2a7e.png"
            alt={t('tiktokAlt')}
            className="h-8 w-8 sm:h-6 sm:w-6 object-contain mb-1"
          />
          <span className="underline block truncate">@revistacienciaestudiante</span>
        </a>
        <a
          href="https://open.spotify.com/show/6amsgUkNXgUTD219XpuqOe?si=LPzCNpusQjSLGBq_pPrVTw"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center text-green-500 hover:text-green-600 text-center max-w-[200px]"
          aria-label={t('spotifyAria')}
        >
          <img
            src="https://i.postimg.cc/XvBgkXvT/spotify-logo-1.png"
            alt={t('spotifyAlt')}
            className="h-8 w-8 sm:h-6 sm:w-6 object-contain mb-1"
          />
          <span className="underline block truncate">{t('spotifyText')}</span>
        </a>
      </div>
      <div className="mt-6">
        {!enviado ? (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row justify-center items-center gap-3 max-w-xl mx-auto"
          >
            <input
              type="text"
              placeholder={t('namePlaceholder')}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="p-2 rounded border border-gray-400 flex-1 w-full sm:w-auto text-gray-800"
              aria-label={t('nameAria')}
            />
            <input
              type="email"
              placeholder={t('emailPlaceholder')}
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
              className="p-2 rounded border border-gray-400 flex-1 w-full sm:w-auto text-gray-800"
              aria-label={t('emailAria')}
            />
            <button
              type="submit"
              className="bg-yellow-500 text-gray-900 px-4 py-2 rounded hover:bg-yellow-400 transition-colors font-semibold"
              aria-label={t('subscribeAria')}
            >
              {t('subscribe')}
            </button>
          </form>
        ) : (
          <p className="text-green-400 font-semibold mt-2">{t('thanksForSubscribing')}</p>
        )}
      </div>
    </footer>
  );
}

export default Footer;