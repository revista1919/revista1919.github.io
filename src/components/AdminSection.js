// Spanish Version: AdminSection.jsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

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
      isPostulable: false,
    },
    {
      name: 'Editor de Sección',
      description: 'Revisa y edita textos de una sección específica (por ejemplo, Opinión, Cultura, Actualidad). Vota por publicar o no un trabajo. Principalmente aplica las correcciones hechas por los revisores. Es el encargado de comunicarse con el autor para solicitar datos y entregar su retroalimentación',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Editor+de+Secci%C3%B3n'
    },
    {
      name: 'Revisor / Comité Editorial',
      description: 'Corrige estilo, ortografía y coherencia de los artículos. Además un revisor puede revisar fuentes, verificar calidad de las mismas y de los contenidos. Proporciona retroalimentación a los autores y vota si publicar o no un artículo.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Revisor'
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
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Encargado+de+Soporte+T%C3%A9cnico'
    },
    {
      name: 'Encargado de Asignación de Artículos',
      description: 'Recibe, organiza y canaliza las postulaciones de artículos hacia los revisores y editores',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Encargado+de+Asignaci%C3%B3n+de+Art%C3%ADculos'
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
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Dise%C3%B1ador/a+Gr%C3%A1fico/a'
    },
    {
      name: 'Community Manager',
      description: 'Interactúa con la comunidad, responde mensajes y fomenta la participación en las plataformas de la revista.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Community+Manager'
    },
    {
      name: 'Encargado/a de Nuevos Colaboradores',
      description: 'Orienta a nuevos postulantes a roles administrativos, revisores o editores.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Encargado/a+de+Nuevos+Colaboradores'
    },
    {
      name: 'Coordinador/a de Eventos o Convocatorias',
      description: 'Organiza conversatorios, debates, concursos u otras actividades para promover la revista.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Coordinador/a+de+Eventos+o+Convocatorias'
    },
    {
      name: 'Asesor/a Legal/Editorial',
      description: 'Revisa términos legales, normas editoriales y derechos de autor para la revista.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Asesor/a+Legal/Editorial'
    },
    {
      name: 'Responsable de Finanzas / Transparencia',
      description: 'Gestiona donaciones o presupuestos, asegurando transparencia en las finanzas.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Responsable+de+Finanzas+/+Transparencia'
    },
    {
      name: 'Asesor Académico',
      description: 'Verifica la calidad de un volumen y está disponible para consultas puntuales.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Asesor+Acad%C3%A9mico'
    },
  ];

  const handleRoleClick = (role) => {
    setSelectedRole(role);
    setIsModalOpen(true);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      className="admin-section bg-white p-6 rounded-xl shadow-lg mt-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.h2
        className="text-2xl font-bold mb-4 text-gray-800 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        Únete a nuestro equipo
      </motion.h2>
      <motion.p
        className="text-base text-gray-600 mb-6 text-center max-w-2xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        Forma parte de la Revista Nacional de las Ciencias para Estudiantes. Contribuye con tu talento a la divulgación científica y apoya a estudiantes en su camino hacia la investigación. Selecciona un rol para conocer sus funciones o postula a los cargos disponibles. Puedes consultar las políticas de postulación en{' '}
        <a
          href="https://www.revistacienciasestudiantes.com/policiesApp.html"
          className="text-blue-600 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ver políticas de postulación"
        >
          nuestras políticas de postulación
        </a>
        .
      </motion.p>
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {roles.map((role) => (
          <motion.div
            key={role.name}
            className={`p-4 rounded-xl shadow-md transition-shadow hover:shadow-lg ${
              role.isPostulable ? 'bg-blue-50' : 'bg-gray-100 cursor-not-allowed'
            }`}
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
          >
            <p
              className={`text-lg font-semibold ${
                role.isPostulable ? 'text-blue-600 cursor-pointer hover:underline' : 'text-gray-500'
              }`}
              onClick={role.isPostulable ? () => handleRoleClick(role) : null}
              aria-label={`Ver descripción del rol ${role.name}`}
            >
              {role.name}
            </p>
            <p className="text-base text-gray-600">
              {role.isPostulable ? 'Cargo postulable' : 'Cargo definido'}
            </p>
            {role.isPostulable && (
              <button
                className="mt-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                onClick={() => window.open(role.link, '_blank')}
                aria-label={`Postular al rol ${role.name}`}
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
            className="bg-white p-6 rounded-xl max-w-lg max-h-[90vh] overflow-y-auto mx-4 shadow-xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-2">
              <h3 className="text-xl font-bold text-gray-800">{selectedRole.name}</h3>
              <button
                className="text-gray-500 hover:text-gray-700 text-xl focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full w-8 h-8 flex items-center justify-center"
                onClick={() => setIsModalOpen(false)}
                aria-label="Cerrar modal de descripción del rol"
              >
                ×
              </button>
            </div>
            <div className="text-gray-700 text-base">
              <p className="font-semibold text-blue-600 mb-2">Descripción:</p>
              <p className="text-gray-600 mb-4">{selectedRole.description}</p>
              <p className="text-gray-600">
                {selectedRole.isPostulable ? 'Este cargo está abierto a postulaciones.' : 'Este cargo está definido y no admite postulaciones.'}
              </p>
              {selectedRole.isPostulable && (
                <button
                  className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                  onClick={() => window.open(selectedRole.link, '_blank')}
                  aria-label={`Postular al rol ${selectedRole.name}`}
                >
                  Postular ahora
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default AdminSection;
