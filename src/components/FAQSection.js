import React from 'react';


function FAQSection() {
  return React.createElement(
    'div',
    { className: 'faq-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6' },
    React.createElement('h2', { className: 'text-xl sm:text-2xl font-semibold mb-3 sm:mb-4' }, 'Preguntas Frecuentes'),
    React.createElement(
      'ul',
      { className: 'list-disc pl-4 sm:pl-5 text-sm sm:text-base' },
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, '¿Quién puede publicar?'), ' Cualquier estudiante escolar o universitario del mundo.'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, '¿Se puede usar IA para ayudarme a escribir?'), ' No. Será rechazado automáticamente.'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, '¿Cuánto se demoran en responder?'), ' Entre 1 y 3 semanas, dependiendo del volumen de solicitudes.'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, '¿Cómo se revisa un artículo?'), ' Revisión doble ciego, sin nombre del autor. Hay alumnos y profesores que revisarán tu artículo según tu área.'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, '¿Cómo es el proceso editorial?'), ' Cuando nos envías tu artículo se le asignan revisores y un editor, este último se comunicará contigo cuando termine la revisión de tu artículo, para disutir cambios u otros temas.'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, '¿Qué pasará cuando mi artículo se publique?'), ' El artículo aparecerá en nuestra página web y será indexado en Google Académico. Estamos haciendo los procedimientos para conseguir nuestro ISSN. También es posible que te invitemos a nuestro podcast, además de difundirlo en nuestras Redes Sociales'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, '¿En qué formato envío el artículo?'), ' Word (.docx), estilo Chicago, 2.000–10.000 palabras.'),
      React.createElement('li', { className: 'mb-2 sm:mb-3' }, React.createElement('strong', null, '¿Cómo puedo postular a algún cargo?'), ' Desde la pestaña "¡Postula a algún cargo!".')
    )
  );
}

export default FAQSection;