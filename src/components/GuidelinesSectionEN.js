import React from 'react';
import { useTranslation } from 'react-i18next';

function GuidelinesSection() {
  return React.createElement(
    'div',
    { className: 'guidelines-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6' },
    React.createElement('h2', { className: 'text-xl sm:text-2xl font-semibold mb-3 sm:mb-4' }, 'Editorial Guidelines'),
    React.createElement(
      'ul',
      { className: 'list-disc pl-4 sm:pl-5 text-sm sm:text-base' },
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, 'Length: 1,000–10,000 words (tables do not count as words)'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, 'Format: Word (.docx), without the author’s name in the document'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, 'Originality: The article must be unpublished, not submitted elsewhere, and cannot use AI for writing'),
      React.createElement(
        'li',
        { className: 'mb-2 sm:mb-3' },
        'Citation: Exclusively ',
        React.createElement(
          'a',
          {
            href: 'https://www.chicagomanualofstyle.org/tools_citationguide.html',
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'text-blue-500 hover:underline'
          },
          'Chicago style'
        )
      ),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, 'We accept articles in Spanish and English'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, 'Permitted elements: Graphs, equations, images, tables (not counted in word count)')
    ),
    React.createElement('h3', { className: 'text-lg sm:text-xl font-semibold mt-6 mb-3' }, 'To learn how to write a scientific article, we recommend the following videos:'),
    React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
      React.createElement('iframe', {
        width: '100%',
        height: '200',
        src: 'https://www.youtube.com/embed/-kguiI17880?si=zy1QYpbgBc787vfP',
        title: 'Video 1',
        frameBorder: '0',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowFullScreen: true
      }),
      React.createElement('iframe', {
        width: '100%',
        height: '200',
        src: 'https://www.youtube.com/embed/videoseries?list=PL_ctsbuZQZeyezIbWex0bUvbRNdIFlWdK&si=i4Scy8gnP8bGfOC3',
        title: 'Playlist',
        frameBorder: '0',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowFullScreen: true
      })
    ),
    React.createElement('h3', { className: 'text-lg sm:text-xl font-semibold mt-8 mb-4' }, 'For research, we recommend the following sites:'),
    React.createElement(
      'div',
      { className: 'grid grid-cols-1 sm:grid-cols-3 gap-4' },
      [
        { name: 'Google Scholar', url: 'https://scholar.google.com/', desc: 'Google’s academic search engine with millions of scientific articles.' },
        { name: 'SciELO', url: 'https://scielo.org/en/', desc: 'Open-access online scientific library in Spanish and Portuguese.' },
        { name: 'Consensus', url: 'https://consensus.app/', desc: 'AI-powered platform for finding and summarizing scientific articles.' }
      ].map((site, index) =>
        React.createElement(
          'a',
          {
            key: index,
            href: site.url,
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'block p-4 bg-gray-50 rounded-xl shadow hover:shadow-md transition'
          },
          React.createElement('h4', { className: 'text-base sm:text-lg font-semibold text-gray-800 mb-2' }, site.name),
          React.createElement('p', { className: 'text-sm text-gray-600' }, site.desc)
        )
      )
    )
  );
}

export default GuidelinesSection;