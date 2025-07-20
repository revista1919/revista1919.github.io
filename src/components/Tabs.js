import React, { useState } from 'react';

const Tabs = ({ sections }) => {
  const [activeTab, setActiveTab] = useState(sections[0].name);

  return React.createElement(
    'div',
    { className: 'mt-6' },
    // Pestañas
    React.createElement(
      'div',
      { className: 'flex border-b border-gray-300' },
      sections.map(section =>
        React.createElement(
          'button',
          {
            key: section.name,
            className: `px-4 py-2 font-semibold text-sm md:text-base ${
              activeTab === section.name
                ? 'border-b-2 border-brown-800 text-brown-800'
                : 'text-gray-600 hover:text-brown-800'
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
      { className: 'mt-4' },
      sections.find(section => section.name === activeTab).component
    )
  );
};

export default Tabs;