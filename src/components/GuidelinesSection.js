import React from 'react';

function GuidelinesSection() {
  return React.createElement(
    'div',
    { className: 'guidelines-section bg-white p-6 rounded-lg shadow-md mt-6' },
    React.createElement('h2', { className: 'text-2xl font-semibold mb-4' }, 'Normas Editoriales'),
    React.createElement(
      'ul',
      { className: 'list-disc pl-5' },
      React.createElement('li', null, 'Extensión: 2.000–10.000 palabras (tablas no cuentan como palabras)'),
      React.createElement('li', null, 'Formato: Word (.docx), sin nombre del autor en el documento'),
      React.createElement('li', null, 'Originalidad: El artículo debe ser inédito, no publicado ni enviado a otro medio, y no puede usar IA para redactar'),
      React.createElement('li', null, 'Citación: Exclusivamente estilo Chicago'),
      React.createElement('li', null, 'Elementos permitidos: Gráficas, ecuaciones, imágenes, tablas (fuera del conteo de palabras)')
    )
  );
}

export default GuidelinesSection;