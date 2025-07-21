import React, { useState } from 'react';

const Tabs = ({ sections }) => {
  const [activeTab, setActiveTab] = useState(sections[0].name);

  return React.createElement(
    'div',
    { className: 'mt-4 sm:mt-6' },
    // Pestañas
    React.createElement(
      'div',
      { className: 'flex flex-wrap border-b border-gray-300 gap-2 sm:gap-4' },
      sections.map(section =>
        React.createElement(
          'button',
          {
            key: section.name,
            className: `px-3 py-2 sm:px-4 sm:py-3 font-semibold text-xs sm:text-sm md:text-base rounded-t-md ${
              activeTab === section.name
                ? 'border-b-2 border-brown-800 text-brown-800 bg-cream-100'
                : 'text-gray-600 hover:text-brown-800 hover:bg-cream-100'
            }`,
            onClick: () => setActiveTab(section.name),
          },
          section.label
        )
      )
    ),
    // Contenido de la pestaña activa
    React.createElement(
      'div',
      { className: 'mt-4 sm:mt-6' },
      sections.find(section => section.name === activeTab).component
    )
  );
};

export default Tabs;