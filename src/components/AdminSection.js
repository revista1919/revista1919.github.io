import React from 'react';

function AdminSection() {
  return React.createElement(
    'div',
    { className: 'admin-section bg-white p-6 rounded-lg shadow-md mt-6' },
    React.createElement('h2', { className: 'text-2xl font-semibold mb-4' }, 'Postula como Administrador'),
    React.createElement('p', { className: 'mb-4' }, 'Rellena el formulario para postularte como administrador. Un administrador puede revisar artículos y ser parte del proceso de edición de manera especializada. Es una labor completamente voluntaria.'),
    React.createElement('iframe', {
      src: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?embedded=true',
      width: '100%',
      height: '600',
      frameBorder: '0',
      marginHeight: '0',
      marginWidth: '0',
    }, 'Cargando...')
  );
}

export default AdminSection;