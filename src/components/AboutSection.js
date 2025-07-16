import React from 'react';

function AboutSection() {
  return React.createElement(
    'div',
    { className: 'about-section bg-white p-6 rounded-lg shadow-md mt-6' },
    React.createElement('h2', { className: 'text-2xl font-semibold mb-4' }, 'Quiénes Somos'),
    React.createElement('p', { className: 'mb-2' }, 'La Revista Nacional de las Ciencias para Estudiantes es una publicación interdisciplinaria revisada por pares, escrita, editada y curada por estudiantes y profesores, escolares y universitarios. Está abierta a todo el mundo, aunque fomenta especialmente la participación de chilenos. Su objetivo es fomentar el pensamiento crítico y la investigación científica entre jóvenes, mediante un sistema de publicación serio, accesible y riguroso.'),
    React.createElement('p', null, React.createElement('em', null, 'No está asociada a ninguna institución, programa ni colegio en particular. Es una iniciativa independiente, abierta a todos los estudiantes. No hay ningún costo, es completamente gratuita y opera gracias al compromiso de nuestros colaboradores.'))
  );
}

export default AboutSection;