import React from 'react';
import { useTranslation } from 'react-i18next';

function SubmitSection() {
  return React.createElement(
    'div',
    { className: 'submit-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6' },
    React.createElement('h2', { className: 'text-xl sm:text-2xl font-semibold mb-3 sm:mb-4' }, 'Enviar un Artículo'),
    React.createElement('p', { className: 'text-sm sm:text-base mb-3 sm:mb-4' }, React.createElement('strong', null, 'Importante: No incluyas tu nombre directamente en el documento'), ' - solo en el formulario de abajo.'),
    React.createElement('div', { className: 'relative w-full h-96 sm:h-[600px]' },
      React.createElement('iframe', {
        src: 'https://docs.google.com/forms/d/e/1FAIpQLSf3oTgTOurPOKTmUeBMYxq1XtVLHkI6R0l9CoqFmMyLOlEefg/viewform?embedded=true',
        className: 'w-full h-full',
        frameBorder: '0',
        marginHeight: '0',
        marginWidth: '0',
      }, 'Cargando...')
    )
  );
}

export default SubmitSection;