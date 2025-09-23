import React from 'react';
import { useTranslation } from 'react-i18next';

function AboutSection() {
  return React.createElement(
    'div',
    { className: 'about-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6' },
    React.createElement('h2', { className: 'text-xl sm:text-2xl font-semibold mb-3 sm:mb-4' }, 'Who We Are'),
    React.createElement('p', { className: 'text-sm sm:text-base mb-2 sm:mb-3' }, 'The National Review of Sciences for Students is an interdisciplinary, peer-reviewed publication written, edited, and curated by students and teachers, both from schools and universities. It is open to everyone, though it especially encourages participation from Chileans, but it is open to all the world. Its goal is to foster critical thinking and scientific research among young people through a serious, accessible, and rigorous publication system.'),
    React.createElement('p', { className: 'text-sm sm:text-base' }, React.createElement('em', null, 'It is not associated with any specific institution, program, or school. It is an independent initiative, open to all students. There is no cost; it is completely free and operates thanks to the commitment of our contributors.'))
  );
}

export default AboutSection;