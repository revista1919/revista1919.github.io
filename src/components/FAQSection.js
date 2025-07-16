import React from 'react';

function FAQSection() {
  return React.createElement(
    'div',
    { className: 'faq-section bg-white p-6 rounded-lg shadow-md mt-6' },
    React.createElement('h2', { className: 'text-2xl font-semibold mb-4' }, 'Preguntas Frecuentes'),
    React.createElement(
      'ul',
      { className: 'list-disc pl-5' },
      React.createElement('li', null, React.createElement('strong', null, '¿Quién puede publicar?'), ' Cualquier estudiante escolar o universitario del mundo.'),
      React.createElement('li', null, React.createElement('strong', null, '¿Se puede usar IA para ayudarme a escribir?'), ' No. Será rechazado automáticamente.'),
      React.createElement('li', null, React.createElement('strong', null, '¿Cuánto se demoran en responder?'), ' Entre 1 y 3 semanas, dependiendo del volumen de solicitudes.'),
      React.createElement('li', null, React.createElement('strong', null, '¿Cómo se revisa un artículo?'), ' Revisión ciega, sin nombre del autor. Hay alumnos y profesores que revisarán tu artículo según tu área.'),
      React.createElement('li', null, React.createElement('strong', null, '¿En qué formato envío el artículo?'), ' Word (.docx), estilo Chicago, 2.000–10.000 palabras.'),
      React.createElement('li', null, React.createElement('strong', null, '¿Cómo puedo postular como administrador?'), ' Desde la pestaña Postula como administrador.')
    )
  );
}

export default FAQSection;