import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

function AdminSection() {
  const [selectedRole, setSelectedRole] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const roles = [
    {
      name: 'Fundador',
      description: 'Persona que inició el proyecto, definiendo su visión y objetivos iniciales. Supervisa la dirección estratégica de la revista.',
      isPostulable: false,
    },
    {
      name: 'Co-Fundador',
      description: 'Colaborador clave en la fundación del proyecto, apoya al Fundador en la toma de decisiones estratégicas.',
      isPostulable: false,
    },
    {
      name: 'Director General',
      description: 'Encargado de la visión general, coordinación del equipo, relaciones externas y supervisión global de la revista.',
      isPostulable: false,
    },
    {
      name: 'Subdirector General',
      description: 'Asiste al Director General en decisiones estratégicas y asume la dirección en su ausencia.',
      isPostulable: false,
    },
    {
      name: 'Editor en Jefe',
      description: 'Supervisa todos los contenidos y coordina al equipo editorial. Garantiza la calidad de los artículos.',
      isPostulable: true,
    },
    {
      name: 'Editor de Sección',
      description: 'Revisa y edita textos de una sección específica (por ejemplo, Opinión, Cultura, Actualidad). Vota por publicar o no un trabajo',
      isPostulable: true,
    },
    {
      name: 'Revisor / Comité Editorial',
      description: 'Corrige estilo, ortografía y coherencia de los artículos. Proporciona retroalimentación a los autores.',
      isPostulable: true,
    },
    {
      name: 'Responsable de Desarrollo Web',
      description: 'Administra el sitio web, corrige errores técnicos y implementa mejoras de diseño y funcionalidad.',
      isPostulable: false,
    },
    {
      name: 'Encargado de Soporte Técnico',
      description: 'Resuelve problemas técnicos relacionados con la carga de contenidos, formularios y correos.',
      isPostulable: true,
    },
    {
      name: 'Encargado/a de Redes Sociales',
      description: 'Gestiona las redes sociales (Instagram, X, TikTok, etc.), publica contenido y promueve la revista.',
      isPostulable: false,
    },
    {
      name: 'Diseñador/a Gráfico/a',
      description: 'Crea material visual como afiches, portadas y plantillas para redes sociales.',
      isPostulable: true,
    },
    {
      name: 'Community Manager',
      description: 'Interactúa con la comunidad, responde mensajes y fomenta la participación en las plataformas de la revista.',
      isPostulable: true,
    },
    {
      name: 'Encargado/a de Recepción de Artículos',
      description: 'Recibe, organiza y canaliza las postulaciones de artículos hacia los revisores.',
      isPostulable: true,
    },
    {
      name: 'Encargado/a de Nuevos Colaboradores',
      description: 'Orienta a nuevos postulantes a roles administrativos, revisores o editores.',
      isPostulable: true,
    },
    {
      name: 'Coordinador/a de Eventos o Convocatorias',
      description: 'Organiza conversatorios, debates, concursos u otras actividades para promover la revista.',
      isPostulable: true,
    },
    {
      name: 'Asesor/a Legal/Editorial',
      description: 'Revisa términos legales, normas editoriales y derechos de autor para la revista (NO NECESARIO POR EL MOMENTO).',
      isPostulable: true,
    },
    {
      name: 'Responsable de Finanzas / Transparencia',
      description: 'Gestiona donaciones o presupuestos, asegurando transparencia en las finanzas (NO NECESARIO POR EL MOMENTO).',
      isPostulable: true,
    },
  ];

  const handleRoleClick = (role) => {
    setSelectedRole(role);
    setIsModalOpen(true);
  };

  const handlePostulateClick = () => {
    window.open('https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform', '_blank');
    setIsModalOpen(false);
  };

  return React.createElement(
    'div',
    { className: 'admin-section bg-white p-3 sm:p-6 rounded-lg shadow-md mt-3 sm:mt-6' },
    // Encabezado
    React.createElement(
      'h2',
      { className: 'text-lg sm:text-2xl font-semibold mb-3 sm:mb-4 text-gray-800 text-center' },
      'Únete a nuestro equipo'
    ),
    React.createElement(
      'p',
      { className: 'text-sm sm:text-base text-gray-600 mb-3 sm:mb-6 text-center max-w-2xl mx-auto' },
      'Forma parte de la Revista Nacional de las Ciencias para Estudiantes. Contribuye con tu talento a la divulgación científica y apoya a estudiantes en su camino hacia la investigación. Selecciona un rol para conocer sus funciones o postula a los cargos disponibles.'
    ),
    // Lista de roles
    React.createElement(
      'div',
      { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 mb-3 sm:mb-8' },
      roles.map((role) =>
        React.createElement(
          'div',
          {
            key: role.name,
            className: `p-3 sm:p-4 rounded-lg shadow-sm transition-shadow ${
              role.isPostulable ? 'bg-green-50 hover:shadow-md' : 'bg-gray-100 cursor-not-allowed'
            }`,
          },
          React.createElement(
            'p',
            {
              className: `text-sm sm:text-lg font-semibold ${
                role.isPostulable ? 'text-green-600 cursor-pointer hover:underline' : 'text-gray-500'
              }`,
              onClick: role.isPostulable ? () => handleRoleClick(role) : null,
              'aria-label': `Ver descripción del rol ${role.name}`,
            },
            role.name
          ),
          React.createElement(
            'p',
            { className: 'text-xs sm:text-base text-gray-600' },
            role.isPostulable ? 'Cargo postulable' : 'Cargo definido'
          ),
          role.isPostulable &&
            React.createElement(
              'button',
              {
                className: 'mt-2 bg-green-500 text-white px-3 py-2 rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-h-10 sm:text-base',
                onClick: handlePostulateClick,
                'aria-label': `Postular al rol ${role.name}`,
              },
              'Postular'
            )
        )
      )
    ),
    // Modal para descripción del rol
    isModalOpen &&
      React.createElement(
        'div',
        { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50' },
        React.createElement(
          'div',
          { className: 'bg-white p-3 sm:p-6 rounded-lg max-w-[90vw] sm:max-w-lg max-h-[90vh] overflow-y-auto mx-2 shadow-lg' },
          React.createElement(
            'div',
            { className: 'flex justify-between items-center mb-2 sm:mb-4 border-b border-gray-200 pb-2' },
            React.createElement(
              'h3',
              { className: 'text-sm sm:text-xl font-bold text-gray-800' },
              selectedRole.name
            ),
            React.createElement(
              'button',
              {
                className: 'text-gray-500 hover:text-gray-700 text-lg sm:text-xl focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full w-8 h-8 flex items-center justify-center',
                onClick: () => setIsModalOpen(false),
                'aria-label': 'Cerrar modal de descripción del rol',
              },
              '×'
            )
          ),
          React.createElement(
            'div',
            { className: 'text-gray-700 text-sm sm:text-base' },
            React.createElement('p', { className: 'font-semibold text-blue-600 mb-2' }, 'Descripción:'),
            React.createElement('p', { className: 'text-gray-600 mb-3 sm:mb-4' }, selectedRole.description),
            React.createElement(
              'p',
              { className: 'text-gray-600' },
              selectedRole.isPostulable ? 'Este cargo está abierto a postulaciones.' : 'Este cargo está definido y no admite postulaciones.'
            ),
            selectedRole.isPostulable &&
              React.createElement(
                'button',
                {
                  className: 'mt-3 sm:mt-4 bg-green-500 text-white px-3 sm:px-4 py-2 rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-h-10 sm:text-base',
                  onClick: handlePostulateClick,
                  'aria-label': `Postular al rol ${selectedRole.name}`,
                },
                'Postular ahora'
              )
          )
        )
      )
  );
}

export default AdminSection;