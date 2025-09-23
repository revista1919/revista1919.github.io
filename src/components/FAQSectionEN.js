import React from 'react';
import { useTranslation } from 'react-i18next';

function FAQSection() {
  return React.createElement(
    'div',
    { className: 'faq-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6' },
    React.createElement('h2', { className: 'text-xl sm:text-2xl font-semibold mb-3 sm:mb-4' }, 'Frequently Asked Questions'),
    React.createElement(
      'ul',
      { className: 'list-disc pl-4 sm:pl-5 text-sm sm:text-base' },
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, 'Who can publish?'), ' Any school or university student worldwide.'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, 'Can I use AI to help write?'), ' No. It will be automatically rejected.'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, 'How long does it take to get a response?'), ' Between 1 and 3 weeks, depending on the volume of submissions.'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, 'How is an article reviewed?'), ' Blind review, without the author’s name. Students and professors will review your article based on your field.'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, 'In what format should I submit the article?'), ' Word (.docx), Chicago style, 2,000–10,000 words.'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, 'How can I apply as an administrator?'), ' From the Apply as Administrator tab.')
    )
  );
}

export default FAQSection;