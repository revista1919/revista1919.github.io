import React from 'react';

function GuidelinesSection() {
  return React.createElement(
    'div',
    { className: 'guidelines-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6' },
    React.createElement('h2', { className: 'text-xl sm:text-2xl font-semibold mb-3 sm:mb-4' }, 'Normas Editoriales'),
    React.createElement(
      'ul',
      { className: 'list-disc pl-4 sm:pl-5 text-sm sm:text-base' },
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, 'Extensión: 2.000–10.000 palabras (tablas no cuentan como palabras)'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, 'Formato: Word (.docx), sin nombre del autor en el documento'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, 'Originalidad: El artículo debe ser inédito, no publicado ni enviado a otro medio, y no puede usar IA para redactar'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, 'Citación: Exclusivamente estilo Chicago'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, 'Aceptamos artículos en español y en inglés'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, 'Elementos permitidos: Gráficas, ecuaciones, imágenes, tablas (fuera del conteo de palabras)')
    )
  );
}

export default GuidelinesSection;