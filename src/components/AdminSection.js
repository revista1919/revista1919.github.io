// Spanish Version: AdminSection.jsx
import React from 'react';
import { motion } from 'framer-motion';

function AdminSection() {
  const roles = [
    {
      name: 'Fundador',
      category: 'Dirección',
      description: 'Persona que inició el proyecto, definiendo su visión y objetivos iniciales. Supervisa la dirección estratégica de la revista.',
      isPostulable: false,
    },
    {
      name: 'Co-Fundador',
      category: 'Dirección',
      description: 'Colaborador clave en la fundación del proyecto, apoya al Fundador en la toma de decisiones estratégicas.',
      isPostulable: false,
    },
    {
      name: 'Director General',
      category: 'Dirección',
      description: 'Encargado de la visión general, coordinación del equipo, relaciones externas y supervisión global de la revista.',
      isPostulable: false,
    },
    {
      name: 'Subdirector General',
      category: 'Dirección',
      description: 'Asiste al Director General en decisiones estratégicas y asume la dirección en su ausencia.',
      isPostulable: false,
    },
    {
      name: 'Editor en Jefe',
      category: 'Editorial',
      description: 'Supervisa todos los contenidos y coordina al equipo editorial. Garantiza la calidad de los artículos.',
      isPostulable: false,
    },
    {
      name: 'Editor de Sección',
      category: 'Editorial',
      description: 'Revisa y edita textos de una sección específica (por ejemplo, Opinión, Cultura, Actualidad). Vota por publicar o no un trabajo. Principalmente aplica las correcciones hechas por los revisores. Es el encargado de comunicarse con el autor para solicitar datos y entregar su retroalimentación',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Editor+de+Secci%C3%B3n'
    },
    {
      name: 'Revisor / Comité Editorial',
      category: 'Editorial',
      description: 'Corrige estilo, ortografía y coherencia de los artículos. Además un revisor puede revisar fuentes, verificar calidad de las mismas y de los contenidos. Proporciona retroalimentación a los autores y vota si publicar o no un artículo.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Revisor'
    },
    {
      name: 'Encargado de Asignación de Artículos',
      category: 'Editorial',
      description: 'Recibe, organiza y canaliza las postulaciones de artículos hacia los revisores y editores',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Encargado+de+Asignaci%C3%B3n+de+Art%C3%ADculos'
    },
    {
      name: 'Responsable de Desarrollo Web',
      category: 'Tecnología',
      description: 'Administra el sitio web, corrige errores técnicos y implementa mejoras de diseño y funcionalidad.',
      isPostulable: false,
    },
    {
      name: 'Encargado de Soporte Técnico',
      category: 'Tecnología',
      description: 'Resuelve problemas técnicos relacionados con la carga de contenidos, formularios y correos.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Encargado+de+Soporte+T%C3%A9cnico'
    },
    {
      name: 'Encargado/a de Redes Sociales',
      category: 'Comunicaciones',
      description: 'Gestiona las redes sociales (Instagram, X, TikTok, etc.), publica contenido y promueve la revista.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Encargado/a+de+Redes+Sociales'
    },
    {
      name: 'Diseñador/a Gráfico/a',
      category: 'Diseño',
      description: 'Crea material visual como afiches, portadas y plantillas para redes sociales.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Dise%C3%B1ador/a+Gr%C3%A1fico/a'
    },
    {
      name: 'Community Manager',
      category: 'Comunicaciones',
      description: 'Interactúa con la comunidad, responde mensajes y fomenta la participación en las plataformas de la revista.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Community+Manager'
    },
    {
      name: 'Encargado/a de Nuevos Colaboradores',
      category: 'Operaciones',
      description: 'Orienta a nuevos postulantes a roles administrativos, revisores o editores.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Encargado/a+de+Nuevos+Colaboradores'
    },
    {
      name: 'Coordinador/a de Eventos o Convocatorias',
      category: 'Operaciones',
      description: 'Organiza conversatorios, debates, concursos u otras actividades para promover la revista.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Coordinador/a+de+Eventos+o+Convocatorias'
    },
    {
      name: 'Asesor/a Legal/Editorial',
      category: 'Consultoría',
      description: 'Revisa términos legales, normas editoriales y derechos de autor para la revista.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Asesor/a+Legal/Editorial'
    },
    {
      name: 'Responsable de Finanzas / Transparencia',
      category: 'Finanzas',
      description: 'Gestiona donaciones o presupuestos, asegurando transparencia en las finanzas.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Responsable+de+Finanzas+/+Transparencia'
    },
    {
      name: 'Asesor Académico',
      category: 'Consultoría',
      description: 'Verifica la calidad de un volumen y está disponible para consultas puntuales.',
      isPostulable: true,
      link: 'https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform?usp=pp_url&entry.311312536=Espa%C3%B1ol&entry.324949366=Asesor+Acad%C3%A9mico'
    },
  ];

  // Agrupamos roles por categoría para una lectura más profesional
  const categories = [...new Set(roles.map(r => r.category))];

  return (
    <section className="max-w-7xl mx-auto px-4 py-20 bg-white">
      {/* Header Estilo Editorial */}
      <div className="border-b-2 border-black pb-8 mb-16 text-center md:text-left">
        <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#007398] block mb-2">
          Oportunidades Académicas
        </span>
        <h2 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 mb-6">
          Convocatoria de Colaboradores
        </h2>
        <div className="flex flex-col md:flex-row justify-between items-end gap-6">
          <p className="text-lg text-gray-600 max-w-3xl font-serif italic leading-relaxed">
            "Buscamos mentes comprometidas con la excelencia y la divulgación científica. Únete a una red global de estudiantes y académicos dedicada al rigor intelectual."
          </p>
          <a
            href="https://www.revistacienciasestudiantes.com/policiesApp.html"
            className="text-[11px] font-bold uppercase tracking-widest border-b border-black pb-1 hover:text-[#007398] hover:border-[#007398] transition-all whitespace-nowrap"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ver políticas de postulación"
          >
            Ver Políticas de Postulación →
          </a>
        </div>
      </div>
      {/* Grid de Categorías */}
      <div className="space-y-20">
        {categories.map((cat) => (
          <div key={cat} className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Título de Categoría Lateral */}
            <div className="lg:col-span-1">
              <h3 className="text-xs uppercase tracking-[0.3em] font-black text-gray-400 border-l-2 border-gray-100 pl-4 py-1">
                {cat}
              </h3>
            </div>
            {/* Roles de la categoría */}
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              {roles.filter(r => r.category === cat).map((role) => (
                <motion.div
                  key={role.name}
                  whileHover={{ y: -4 }}
                  className={`group relative p-6 border rounded-sm transition-all duration-300 ${
                    role.isPostulable
                      ? 'border-gray-200 hover:border-[#007398] bg-white shadow-sm hover:shadow-md'
                      : 'border-gray-100 bg-gray-50 opacity-80'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="text-lg font-serif font-bold text-gray-900 group-hover:text-[#007398] transition-colors">
                      {role.name}
                    </h4>
                    {role.isPostulable && (
                      <span className="text-[9px] bg-[#007398]/10 text-[#007398] px-2 py-0.5 font-bold uppercase tracking-tighter">
                        Abierto
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed mb-6 font-serif italic">
                    {role.description}
                  </p>
                  {role.isPostulable ? (
                    <button
                      onClick={() => window.open(role.link, '_blank')}
                      className="w-full py-2 bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#007398] transition-colors rounded-sm"
                      aria-label={`Postular al rol ${role.name}`}
                    >
                      Enviar Postulación
                    </button>
                  ) : (
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest font-medium italic">
                      Cargo Institucional Definido
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Footer sutil */}
      <div className="mt-24 pt-12 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400 font-serif leading-relaxed">
          La Revista Nacional de las Ciencias para Estudiantes no discrimina por origen, género o institución.<br/>
          Todas las postulaciones son revisadas por nuestro comité.
        </p>
      </div>
    </section>
  );
}

export default AdminSection;