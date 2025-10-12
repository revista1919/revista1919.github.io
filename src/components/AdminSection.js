import React, { useState } from 'react';
import { motion } from 'framer-motion';
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
      description: 'Revisa y edita textos de una sección específica (por ejemplo, Opinión, Cultura, Actualidad). Vota por publicar o no un trabajo. Principalmente aplica las correcciones hechas por los revisores. Es el encargado de comunicarse con el autor para solicitar datos y entregar su retroalimentación',
      isPostulable: true,
    },
    {
      name: 'Revisor / Comité Editorial',
      description: 'Corrige estilo, ortografía y coherencia de los artículos. Además un revisor puede revisar fuentes, verificar calidad de las mismas y de los contenidos. Proporciona retroalimentación a los autores y vota si publicar o no un artículo.',
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
      name: 'Encargado de Asignación de Artículos',
      description: 'Recibe, organiza y canaliza las postulaciones de artículos hacia los revisores y editores',
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

  return (
    <motion.div
      className="admin-section bg-gray-50 p-6 rounded-xl shadow-lg mt-6"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.h2
        className="text-2xl font-bold mb-4 text-blue-800 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Únete a nuestro equipo
      </motion.h2>
      <motion.p
        className="text-base text-gray-700 mb-6 text-center max-w-2xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        Forma parte de la Revista Nacional de las Ciencias para Estudiantes. Contribuye con tu talento a la divulgación científica y apoya a estudiantes en su camino hacia la investigación. Selecciona un rol para conocer sus funciones o postula a los cargos disponibles. Puedes consultar las políticas de postulación en{' '}
        <a
          href="https://www.revistacienciasestudiantes.com/policiesApp.html"
          className="text-blue-600 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          nuestras políticas de postulación
        </a>
        .
      </motion.p>
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { staggerChildren: 0.1 } }
        }}
        initial="hidden"
        animate="show"
      >
        {roles.map((role) => (
          <motion.div
            key={role.name}
            className={`p-4 rounded-xl shadow-md transition-shadow ${role.isPostulable ? 'bg-green-50 hover:shadow-lg' : 'bg-gray-100 cursor-not-allowed'}`}
            variants={{
              hidden: { opacity: 0, scale: 0.95 },
              show: { opacity: 1, scale: 1 }
            }}
          >
            <p
              className={`text-lg font-bold ${role.isPostulable ? 'text-green-700 cursor-pointer hover:underline' : 'text-gray-500'}`}
              onClick={role.isPostulable ? () => handleRoleClick(role) : null}
            >
              {role.name}
            </p>
            <p className="text-base text-gray-600">
              {role.isPostulable ? 'Cargo postulable' : 'Cargo definido'}
            </p>
            {role.isPostulable && (
              <button
                className="mt-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                onClick={handlePostulateClick}
              >
                Postular
              </button>
            )}
          </motion.div>
        ))}
      </motion.div>
      {isModalOpen && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white p-6 rounded-xl max-w-lg max-h-[90vh] overflow-y-auto shadow-xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            {/* Contenido del modal similar, con animaciones si deseas */}
            <h3 className="text-xl font-bold text-blue-800 mb-4">{selectedRole.name}</h3>
            <p className="text-gray-700">{selectedRole.description}</p>
            {selectedRole.isPostulable && (
              <button className="mt-4 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700" onClick={handlePostulateClick}>
                Postular ahora
              </button>
            )}
            <button className="text-gray-600 hover:text-gray-800" onClick={() => setIsModalOpen(false)}>
              Cerrar
            </button>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default AdminSection;