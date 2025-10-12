import React from 'react';

function FAQSection() {
  return React.createElement(
    'div',
    { className: 'faq-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6' },
    React.createElement('h2', { className: 'text-xl sm:text-2xl font-semibold mb-3 sm:mb-4' }, 'Frequently Asked Questions'),
    React.createElement(
      'ul',
      { className: 'list-disc pl-4 sm:pl-5 text-sm sm:text-base' },
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, 'Who can publish?'), ' Any school or university student in the world.'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, 'Can I use AI to help me write?'), ' No. It will be automatically rejected.'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, 'How long does it take to respond?'), ' Between 1 and 3 weeks, depending on the volume of requests.'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, 'How is an article reviewed?'), ' Double-blind review, without the author\'s name. There are students and professors who will review your article according to your area.'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, 'What is the editorial process like?'), ' When you send us your article, reviewers and an editor are assigned to it, the latter will communicate with you when the review of your article is finished, to discuss changes or other issues.'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, 'What will happen when my article is published?'), ' The article will appear on our website and will be indexed in Google Scholar. We are doing the procedures to get our ISSN. It is also possible that we invite you to our podcast, in addition to disseminating it on our Social Networks.'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, 'In what format do I send the article?'), ' Word (.docx), Chicago style, 2,000–10,000 words.'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, 'How can I apply for a position?'), ' From the "Apply for a position!" tab.')
    )
  );
}

export default FAQSection;