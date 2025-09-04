import React from 'react';

function Tabs({ sections, activeTab, setActiveTab }) {
  return React.createElement(
    'div',
    { className: 'tabs-container' },
    React.createElement(
      'nav',
      { className: 'bg-[#f8f1e9] shadow-sm border-b-2 border-[#e6d9c6] py-4' },
      React.createElement(
        'ul',
        { className: 'flex flex-wrap justify-center gap-2 sm:gap-4 px-4 max-w-4xl mx-auto' },
        sections.map((section) =>
          React.createElement(
            'li',
            { key: section.name },
            React.createElement(
              'button',
              {
                className: `px-4 py-2 text-sm sm:text-base font-medium rounded-md transition-all duration-300 ${
                  activeTab === section.name
                    ? 'bg-[#8b6f47] text-white shadow-md'
                    : 'bg-[#e6d9c6] text-[#5a3e36] hover:bg-[#d9c8a9] hover:text-[#5a3e36]'
                } focus:outline-none focus:ring-2 focus:ring-[#8b6f47]`,
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