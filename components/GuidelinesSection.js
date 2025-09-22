'use client';

import { useTranslations } from 'next-intl';

function GuidelinesSection() {
  const t = useTranslations('GuidelinesSection');

  return (
    <div className="guidelines-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6">
      <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">{t('title')}</h2>
      <ul className="list-disc pl-4 sm:pl-5 text-sm sm:text-base">
        <li className="mb-2 sm:mb-3">{t('length')}</li>
        <li className="mb-2 sm:mb-3">{t('format')}</li>
        <li className="mb-2 sm:mb-3">{t('originality')}</li>
        <li className="mb-2 sm:mb-3">
          {t('citation')}{' '}
          <a
            href="https://www.chicagomanualofstyle.org/tools_citationguide.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
            aria-label={t('chicagoStyleAria')}
          >
            {t('chicagoStyle')}
          </a>
        </li>
        <li className="mb-2 sm:mb-3">{t('languages')}</li>
        <li className="mb-2 sm:mb-3">{t('elements')}</li>
      </ul>
      <h3 className="text-lg sm:text-xl font-semibold mt-6 mb-3">{t('learnTitle')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <iframe
          width="100%"
          height="200"
          src="https://www.youtube.com/embed/wyPhAGW6-94"
          title={t('video1Title')}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        <iframe
          width="100%"
          height="200"
          src="https://www.youtube.com/embed/videoseries?list=PL8yQlmhs7KsBerg9X63QnZnlNAopwzDmw"
          title={t('playlistTitle')}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <h3 className="text-lg sm:text-xl font-semibold mt-8 mb-4">{t('researchTitle')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { name: t('googleScholar'), url: 'https://scholar.google.com/', desc: t('googleScholarDesc') },
          { name: t('scielo'), url: 'https://scielo.org/es/', desc: t('scieloDesc') },
          { name: t('consensus'), url: 'https://consensus.app/', desc: t('consensusDesc') }
        ].map((site, index) => (
          <a
            key={index}
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 bg-gray-50 rounded-xl shadow hover:shadow-md transition"
            aria-label={t('siteLinkAria', { name: site.name })}
          >
            <h4 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">{site.name}</h4>
            <p className="text-sm text-gray-600">{site.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

export default GuidelinesSection;