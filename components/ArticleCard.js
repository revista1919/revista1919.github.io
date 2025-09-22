'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

function parseDateFlexible(dateStr) {
  const t = useTranslations();
  if (!dateStr) return t('noDateAvailable');
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
  const t = useTranslations();
  if (!dateStr) return t('noYear');
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

function generateSlug(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export default function ArticleCard({ article }) {
  console.log('Objeto article recibido:', article);

  const t = useTranslations();
  const [showCitations, setShowCitations] = useState(false);
  const [showFullAbstract, setShowFullAbstract] = useState(false);
  const [showEnglishAbstract, setShowEnglishAbstract] = useState(false);

  const pdfUrl = article?.['Número de artículo']
    ? `https://www.revistacienciasestudiantes.com/Articles/Articulo${article['Número de artículo']}.pdf`
    : null;

  const pages = `${article?.['Primera página'] || ''}-${article?.['Última página'] || ''}`.trim() || '';

  const handleAuthorClick = (authorName) => {
    if (!authorName) return;
    const slug = generateSlug(authorName);
    window.location.href = `/team/${slug}`;
  };

  const getChicagoCitation = () => {
    const authors = article?.['Autor(es)']?.split(';').map(a => a.trim()).join('; ') || t('unknownAuthor');
    const title = article?.['Título'] || t('noTitle');
    const volume = article?.['Volumen'] || '';
    const number = article?.['Número'] || '';
    const year = getYear(article?.['Fecha']);

    return (
      <>
        {authors}. “{title}.” <em>{t('journalTitle')}</em> {volume}, no. {number} ({year}): {pages}.{' '}
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-words">
            {pdfUrl}
          </a>
        )}
      </>
    );
  };

  const getApaCitation = () => {
    const authors = article?.['Autor(es)']?.split(';').map(a => a.trim()).join('; ') || t('unknownAuthor');
    const title = article?.['Título'] || t('noTitle');
    const volume = article?.['Volumen'] || '';
    const number = article?.['Número'] || '';
    const year = getYear(article?.['Fecha']);

    return (
      <>
        {authors} ({year}). {title}. <em>{t('journalTitle')}</em>, {volume}({number}), {pages}.{' '}
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-words">
            {pdfUrl}
          </a>
        )}
      </>
    );
  };

  const getMlaCitation = () => {
    const authors = article?.['Autor(es)']?.split(';').map(a => a.trim()).join('; ') || t('unknownAuthor');
    const title = article?.['Título'] || t('noTitle');
    const volume = article?.['Volumen'] || '';
    const number = article?.['Número'] || '';
    const year = getYear(article?.['Fecha']);

    return (
      <>
        {authors}. “{title}.” <em>{t('journalTitle')}</em>, vol. {volume}, no. {number}, {year}, pp. {pages}.{' '}
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-words">
            {pdfUrl}
          </a>
        )}
      </>
    );
  };

  if (!article || Object.keys(article).length === 0) {
    return (
      <div className="article-card bg-white p-4 sm:p-6 rounded-lg shadow-md">
        {t('noArticleData')}
      </div>
    );
  }

  return (
    <div className="article-card bg-white p-4 sm:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <h2 className="text-lg sm:text-xl font-semibold mb-2 cursor-pointer hover:text-blue-600">
        {article['Título'] || t('noTitle')}
      </h2>

      <p className="text-gray-600 text-sm sm:text-base mb-1">
        <strong>{t('authors')} </strong>
        {article['Autor(es)'] ? (
          article['Autor(es)'].split(';').map((a, idx, arr) => (
            <Link
              key={idx}
              href={`/team/${generateSlug(a.trim())}`}
              className="cursor-pointer hover:text-blue-500 underline"
              onClick={() => handleAuthorClick(a.trim())}
              aria-label={t('viewAuthorProfile', { author: a.trim() })}
            >
              {a.trim()}
              {idx < arr.length - 1 ? '; ' : ''}
            </Link>
          ))
        ) : (
          t('unknownAuthor')
        )}
      </p>

      <p className="text-gray-600 text-sm sm:text-base mb-1">
        <strong>{t('date')} </strong> {parseDateFlexible(article['Fecha'])}
      </p>
      <p className="text-gray-600 text-sm sm:text-base mb-2">
        <strong>{t('area')} </strong> {article['Área temática'] || t('noSpecified')}
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
        <strong>{t('abstract')} </strong>
        {article['Resumen'] ? (
          <>
            {showFullAbstract ? article['Resumen'] : `${article['Resumen'].slice(0, 100)}...`}
            {article['Resumen'].length > 100 && (
              <button
                className="ml-2 text-blue-500 hover:underline text-xs sm:text-sm"
                onClick={() => setShowFullAbstract(!showFullAbstract)}
                aria-label={showFullAbstract ? t('readLessAria') : t('readMoreAria')}
              >
                {showFullAbstract ? t('readLess') : t('readMore')}
              </button>
            )}
          </>
        ) : (
          t('noAbstract')
        )}
      </p>

      <div className="mt-2 mb-2">
        <button
          className="text-blue-500 hover:underline text-xs sm:text-sm"
          onClick={() => setShowEnglishAbstract(!showEnglishAbstract)}
          aria-label={showEnglishAbstract ? t('hideEnglishAbstractAria') : t('showEnglishAbstractAria')}
        >
          {showEnglishAbstract ? t('hideEnglishAbstract') : t('showEnglishAbstract')}
        </button>
        {showEnglishAbstract && (
          <p className="text-gray-700 text-sm sm:text-base mt-2">
            {article['Abstract'] || t('noAbstract')}
          </p>
        )}
      </div>

      <div className="flex gap-3 mb-3">
        {pdfUrl && (
          <>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs sm:text-sm"
              aria-label={t('viewArticleAria')}
            >
              {t('viewArticle')}
            </a>
            <a
              href={pdfUrl}
              download
              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs sm:text-sm"
              aria-label={t('downloadPdfAria')}
            >
              {t('downloadPdf')}
            </a>
          </>
        )}
      </div>

      <button
        className="text-brown-800 hover:text-brown-700 text-sm sm:text-base mb-2 focus:outline-none focus:ring-2 focus:ring-brown-800"
        onClick={() => setShowCitations(!showCitations)}
        aria-label={showCitations ? t('hideCitationsAria') : t('showCitationsAria')}
      >
        {showCitations ? t('hideCitations') : t('showCitations')}
      </button>
      {showCitations && (
        <div className="text-gray-700 text-sm sm:text-base space-y-3 break-words">
          <p><strong>{t('citationChicago')}</strong> {getChicagoCitation()}</p>
          <p><strong>{t('citationApa')}</strong> {getApaCitation()}</p>
          <p><strong>{t('citationMla')}</strong> {getMlaCitation()}</p>
        </div>
      )}
    </div>
  );
}