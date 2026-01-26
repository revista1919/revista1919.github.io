import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Helper functions
const getYear = (date) => {
  if (!date) return 'n.d.';
  const parsedDate = new Date(date);
  return isNaN(parsedDate) ? 'n.d.' : parsedDate.getFullYear();
};

const parseDateFlexible = (date) => {
  if (!date) return 'Not available';
  const parsedDate = new Date(date);
  return isNaN(parsedDate)
    ? date
    : parsedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

// Slug generator
const generateSlug = (name) => {
  if (!name) return '';
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/gi, 'n')
    .replace(/Ñ/gi, 'N');
  return normalized
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/* -------------------------- AUTHOR FORMATS -------------------------- */
const formatChicagoAuthors = (authors) => {
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
  return `${authors[0]}, et al.`;
};

const apaFormatName = (fullName) => {
  const parts = fullName.trim().split(' ');
  const last = parts.pop();
  const initials = parts.map((p) => p[0].toUpperCase() + '.').join(' ');
  return `${last}, ${initials}`;
};

const formatAPAAuthors = (authors) => {
  const formatted = authors.map(apaFormatName);
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} & ${formatted[1]}`;
  return formatted.slice(0, -1).join(', ') + ', & ' + formatted[formatted.length - 1];
};

const formatMLAAuthors = (authors) => {
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
  return `${authors[0]}, et al.`;
};
/* -------------------------------------------------------------------------- */

function ArticleCardEN({ article }) {
  console.log('Article object received:', article);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCitations, setShowCitations] = useState(false);
  const [showSpanishAbstract, setShowSpanishAbstract] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState(null);

  const journalDisplay = 'The National Review of Sciences for Students';
  const journalFormal = 'Revista Nacional de las Ciencias para Estudiantes';
  const articleSlug = `${generateSlug(article?.titulo || '')}-${article?.numeroArticulo || ''}`;
  const pdfUrl =
    article?.pdf ||
    article?.pdf_url ||
    article?.url_pdf ||
    `https://www.revistacienciasestudiantes.com/Articles/Article-${generateSlug(article?.titulo || '')}-${article?.numeroArticulo || ''}.pdf`;

  const htmlUrl = `/articles/article-${articleSlug}EN.html`;
  const pages = `${article?.primeraPagina || ''}-${article?.ultimaPagina || ''}`.trim() || '';

  const handleAuthorClick = (authorName) => {
    if (!authorName) return;
    const slug = generateSlug(authorName);
    window.location.href = `/team/${slug}.EN.html`;
  };

  /* --------------------------- FULL CITATIONS ---------------------------- */
  const getChicagoText = () => {
    const authorsRaw = article?.autores || '';
    const authors = authorsRaw.split(';').map(a => a.trim()).filter(a => a);
    const title = article?.titulo || 'Untitled';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);
    return `${formatChicagoAuthors(authors)}. "${title}." ${journalFormal} ${volume}, no. ${number} (${year}): ${pages}.`;
  };

  const getApaText = () => {
    const authorsRaw = article?.autores || '';
    const authors = authorsRaw.split(';').map(a => a.trim()).filter(a => a);
    const title = article?.titulo || 'Untitled';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);
    return `${formatAPAAuthors(authors)} (${year}). ${title}. ${journalFormal}, ${volume}(${number}), ${pages}.`;
  };

  const getMlaText = () => {
    const authorsRaw = article?.autores || '';
    const authors = authorsRaw.split(';').map(a => a.trim()).filter(a => a);
    const title = article?.titulo || 'Untitled';
    const volume = article?.volumen || '';
    const number = article?.numero || '';
    const year = getYear(article?.fecha);
    return `${formatMLAAuthors(authors)}. "${title}." ${journalFormal}, vol. ${volume}, no. ${number}, ${year}, pp. ${pages}.`;
  };
  /* ----------------------------------------------------------------------- */

  const copyToClipboard = async (text, format) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const toggleExpand = (e) => {
    const tag = e.target.tagName.toLowerCase();
    const isInteractive = ['a', 'button', 'span'].includes(tag) || e.target.closest('a, button, span');
    if (!isInteractive) {
      setIsExpanded(!isExpanded);
    }
  };

  if (!article || Object.keys(article).length === 0) {
    return (
      <motion.div
        className="group relative bg-white border border-gray-200 rounded-sm p-6 mb-6 hover:shadow-md transition-all duration-300"
        layout
      >
        <p className="text-center text-gray-500 font-medium">No data found for this article.</p>
      </motion.div>
    );
  }

  const authorsArray = (article?.autores || '').split(';').map(a => a.trim()).filter(a => a);
  const type = article.type || 'Research Article';

  /* --------------------------- MAIN RENDER --------------------------- */
  return (
    <motion.div
      className="group relative bg-white border border-gray-200 rounded-sm p-6 mb-6 hover:shadow-md transition-all duration-300"
      layout
      onClick={toggleExpand}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-label={`Expand article: ${article.titulo || 'Untitled'}`}
    >
      {/* Side Indicator Blue (academic style) */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors ${isExpanded ? 'bg-[#007398]' : 'bg-gray-200 group-hover:bg-[#007398]'}`} />
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6">
        <div className="flex-1">
          {/* Upper Metadata */}
          <div className="flex flex-wrap items-center gap-3 mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            <span className="text-[#007398]">{article.area}</span>
            <span>•</span>
            <span>VOL. {article.volumen}</span>
            <span>•</span>
            <span>NO. {article.numero}</span>
            <span>•</span>
            <span>{type}</span>
          </div>
          {/* Title - Using Serif as in HTML */}
          <h3
            className="text-xl md:text-2xl font-serif font-bold text-black leading-tight mb-3 cursor-pointer hover:text-[#007398] transition-colors"
          >
            {article.titulo}
          </h3>
          {/* Authors */}
          <div className="flex flex-wrap gap-x-2 text-sm mb-4">
            {authorsArray.map((auth, i) => (
              <span
                key={i}
                onClick={(e) => { e.stopPropagation(); handleAuthorClick(auth); }}
                className="text-[#007398] hover:underline cursor-pointer font-medium"
              >
                {auth}{i < authorsArray.length - 1 ? ',' : ''}
              </span>
            ))}
          </div>
          {/* Short Abstract (always visible) */}
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 mb-4 italic">
            {article.englishAbstract}
          </p>
        </div>
        {/* Main Action Buttons */}
        <div className="flex md:flex-col gap-2 min-w-[120px]">
          {pdfUrl ? (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-[#007398] text-white text-xs font-bold rounded-sm hover:bg-[#005a77] transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              PDF
            </a>
          ) : (
            <div className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-300 text-gray-600 text-xs font-bold rounded-sm cursor-not-allowed">
              PDF not available
            </div>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            className="px-4 py-2 border border-[#007398] text-[#007398] text-xs font-bold rounded-sm hover:bg-gray-50 transition-all"
          >
            {isExpanded ? 'CLOSE' : 'DETAILS'}
          </button>
        </div>
      </div>
      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-6 pt-6 border-t border-gray-100 space-y-6">
              {/* General Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[#333]">
                <div>
                  <p className="mb-1"><strong className="text-gray-900">Published:</strong> {parseDateFlexible(article.fecha)}</p>
                  <p><strong className="text-gray-900">Pages:</strong> {pages}</p>
                </div>
                <div>
                  {/* Keywords - Now elegant in dark blue/gray */}
                  <strong className="text-gray-900 block mb-2">Keywords:</strong>
                  <div className="flex flex-wrap gap-2">
                    {article.keywords_english?.map((kw, idx) => (
                      <span key={idx} className="bg-gray-100 text-[#333] border border-gray-200 text-[11px] px-2 py-0.5 rounded-sm">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {/* Abstracts */}
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-sm">
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">Full Abstract</h4>
                  <p className="text-sm text-[#333] leading-relaxed text-justify font-serif">{article.englishAbstract || 'Abstract not available'}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowSpanishAbstract(!showSpanishAbstract); }}
                  className="text-[#007398] text-xs font-bold hover:underline"
                >
                  {showSpanishAbstract ? '↓ HIDE ABSTRACT (ES)' : '→ VIEW ABSTRACT (SPANISH)'}
                </button>
                {showSpanishAbstract && (
                  <div className="bg-[#f0f7f9] p-4 rounded-sm border-l-2 border-[#007398]">
                    <p className="text-sm text-[#333] italic leading-relaxed font-serif">{article.resumen || 'No Spanish abstract available.'}</p>
                  </div>
                )}
              </div>
              {/* Card Footer with Citations */}
              <div className="flex flex-wrap gap-3 pt-4">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowCitations(!showCitations); }}
                  className="text-xs font-bold text-gray-500 hover:text-black flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                  CITE ARTICLE
                </button>
                <a
                  href={htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-[#007398] hover:underline flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  VIEW FULL PAGE
                </a>
              </div>
              {/* Academic Style Citations Section */}
              {showCitations && (
                <div className="bg-gray-50 border border-gray-200 p-4 text-[12px] space-y-3">
                  <div className="flex justify-between items-start gap-4">
                    <p className="leading-relaxed">
                      <strong>APA:</strong> {getApaText()}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyToClipboard(getApaText(), 'APA'); }}
                      className="text-[#007398] font-bold"
                    >
                      {copiedFormat === 'APA' ? 'COPIED' : 'COPY'}
                    </button>
                  </div>
                  <div className="flex justify-between items-start gap-4">
                    <p className="leading-relaxed">
                      <strong>MLA:</strong> {getMlaText()}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyToClipboard(getMlaText(), 'MLA'); }}
                      className="text-[#007398] font-bold"
                    >
                      {copiedFormat === 'MLA' ? 'COPIED' : 'COPY'}
                    </button>
                  </div>
                  <div className="flex justify-between items-start gap-4">
                    <p className="leading-relaxed">
                      <strong>Chicago:</strong> {getChicagoText()}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyToClipboard(getChicagoText(), 'Chicago'); }}
                      className="text-[#007398] font-bold"
                    >
                      {copiedFormat === 'Chicago' ? 'COPIED' : 'COPY'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default ArticleCardEN;