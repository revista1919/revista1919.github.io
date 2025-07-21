import React from 'react';

function AdminSection() {
  return React.createElement(
    'div',
    { className: 'admin-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6' },
    React.createElement('h2', { className: 'text-xl sm:text-2xl font-semibold mb-3 sm:mb-4' }, 'Postula como Administrador'),
    React.createElement('p', { className: 'text-sm sm:text-base mb-3 sm:mb-4' }, 'Rellena el formulario para postularte como administrador. Un administrador puede revisar artículos y ser parte del proceso de edición de manera especializada. Es una labor completamente voluntaria.'),
    React.createElement('div', { className: 'relative w-full h-96 sm:h-[600px]' },
      React.createElement('iframe', {
        src: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?embedded=true',
        className: 'w-full h-full',
        frameBorder: '0',
        marginHeight: '0',
        marginWidth: '0',
      }, 'Cargando...')
    )
  );
}

export default AdminSection;