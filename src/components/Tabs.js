import React, { useState } from 'react';

function Tabs({ sections }) {
  const [activeTab, setActiveTab] = useState(sections[0]?.name || 'articles');

  return React.createElement(
    'div',
    null,
    React.createElement(
      'nav',
      { className: 'bg-white shadow-md' },
      React.createElement(
        'ul',
        { className: 'flex flex-wrap justify-center sm:justify-start space-x-2 sm:space-x-4 p-4' },
        sections.map((section) =>
          React.createElement(
            'li',
            { key: section.name },
            React.createElement(
              'button',
              {
                className: `px-3 py-2 text-sm sm:text-base font-medium rounded-md transition-colors ${
                  activeTab === section.name
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-blue-100 hover:text-blue-600'
                }`,
                onClick: () => setActiveTab(section.name),
                'aria-label': `Ir a la pestaña ${section.label}`,
              },
              section.label
            )
          )
        )
      )
    ),
    React.createElement(
      'main',
      { className: 'flex-grow' },
      sections.find((section) => section.name === activeTab)?.component || null
    )
  );
}

export default Tabs;