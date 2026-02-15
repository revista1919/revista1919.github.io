import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function TeamSection({ setActiveTab }) {
  const [mainData, setMainData] = useState([]);
  const [asesoresData, setAsesoresData] = useState([]);
  const [institutionsData, setInstitutionsData] = useState([]);
  const [selectedRole, setSelectedRole] = useState('Todos');
  const [isLoading, setIsLoading] = useState(false);
  const [jsonError, setJsonError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const jsonUrl = 'https://www.revistacienciasestudiantes.com/team/Team.json';

  useEffect(() => {
    setIsLoading(true);
    setJsonError(null);

    fetch(jsonUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }
        return response.json();
      })
      .then(users => {
        // Filtrar según roles (excluir autores puros si es necesario)
        const allData = users.filter(user => {
          const memberRoles = user.roles || [];
          // Si tiene solo el rol 'Autor' y ningún otro, lo excluimos
          return !(memberRoles.length === 1 && memberRoles[0] === 'Autor');
        });

        // Separar por categorías
        const asesores = allData.filter(user => {
          const roles = user.roles || [];
          return roles.includes('Asesor Académico');
        });

        const institutions = allData.filter(user => {
          const roles = user.roles || [];
          return roles.includes('Institución Colaboradora');
        });

        const mainMembers = allData.filter(user => {
          const roles = user.roles || [];
          return !roles.includes('Asesor Académico') && !roles.includes('Institución Colaboradora');
        });

        setMainData(mainMembers);
        setAsesoresData(asesores);
        setInstitutionsData(institutions);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error al cargar el JSON:', error);
        setJsonError('No se pudo cargar la información del equipo.');
        setMainData([]);
        setAsesoresData([]);
        setInstitutionsData([]);
        setIsLoading(false);
      });
  }, []);

  // Extraer roles únicos para el filtro
  const roles = useMemo(() => {
    const allRoles = mainData.flatMap(user => {
      return (user.roles || []).filter(role => role && role !== 'Autor');
    });
    const uniqueRoles = [...new Set(allRoles)];
    return ['Todos', ...uniqueRoles.sort()];
  }, [mainData]);

  // Filtrar miembros por rol seleccionado
  const filteredMembers = useMemo(() => {
    if (selectedRole === 'Todos') return mainData;
    return mainData.filter(user => {
      const memberRoles = user.roles || [];
      return memberRoles.includes(selectedRole);
    });
  }, [mainData, selectedRole]);

  const displayedMembers = showAll ? filteredMembers : filteredMembers.slice(0, 15);

  // Función para navegar al perfil del miembro (VERSIÓN .html)
  const handleNavigation = (slug) => {
    if (!slug) return;
    window.location.href = `/team/${slug}.html`; // Usamos .html como antes
  };

  // Obtener el slug desde el displayName o firstName+lastName
  const getUserSlug = (user) => {
    return user.slug || generateSlug(user.displayName || `${user.firstName} ${user.lastName}`);
  };

  // Función auxiliar para generar slug (por si acaso)
  const generateSlug = (name) => {
    if (!name) return '';
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-16 bg-white min-h-screen">
      {/* Header Estilo Journal */}
      <header className="text-center mb-16">
        <motion.span
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#007398] mb-4 block"
        >
          Estructura Organizacional
        </motion.span>
        <motion.h1
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="text-4xl sm:text-5xl font-serif text-gray-900 mb-6"
        >
          Cuerpo Editorial y Académico
        </motion.h1>
        <div className="w-24 h-1 bg-gray-200 mx-auto mb-6"></div>
        <p className="text-gray-500 max-w-2xl mx-auto leading-relaxed italic font-serif">
          "Fomentando la excelencia científica a través de la colaboración académica y el rigor editorial."
        </p>
      </header>

      {/* Selector de Roles */}
      <div className="flex flex-wrap justify-center gap-3 mb-12 border-b border-gray-100 pb-8">
        {roles.map((role) => (
          <button
            key={role}
            onClick={() => setSelectedRole(role)}
            className={`px-5 py-2 text-xs uppercase tracking-widest transition-all duration-300 border ${
              selectedRole === role
                ? 'bg-gray-900 text-white border-gray-900'
                : 'text-gray-500 border-gray-200 hover:border-gray-400'
            }`}
          >
            {role}
          </button>
        ))}
      </div>

      {/* Grid de Miembros Operativos */}
      {isLoading ? (
        <div className="text-center py-20 font-serif italic text-gray-400 animate-pulse">Cargando Directorio...</div>
      ) : jsonError ? (
        <p className="text-red-600 text-sm sm:text-lg text-center">{jsonError}</p>
      ) : filteredMembers.length === 0 ? (
        <p className="text-gray-600 text-sm sm:text-lg text-center">No hay miembros para este rol.</p>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence>
            {displayedMembers.map((member) => {
              const slug = getUserSlug(member);
              return (
                <motion.div
                  layout
                  key={member.uid || member.displayName}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => handleNavigation(slug)}
                  className="group p-6 border border-gray-100 hover:border-[#007398]/30 hover:shadow-2xl hover:shadow-gray-200/50 transition-all duration-500 bg-white relative overflow-hidden cursor-pointer"
                >
                  <div className="flex items-center space-x-5">
                    <div className="relative">
                      {member.imageUrl && (
                        <div className="w-20 h-20 overflow-hidden border border-gray-100 p-1 group-hover:border-[#007398] transition-colors duration-500">
                          <img
                            src={member.imageUrl}
                            alt={member.displayName}
                            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-serif text-gray-900 group-hover:text-[#007398] transition-colors">
                        {member.displayName || `${member.firstName} ${member.lastName}`}
                      </h3>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(member.roles || []).filter(r => r && r !== 'Autor').map((role) => (
                          <span key={role} className="text-[9px] uppercase tracking-tighter bg-gray-50 text-gray-500 px-2 py-0.5 border border-gray-100 italic">
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Botón "Ver más" */}
      {filteredMembers.length > 15 && (
        <div className="text-center mt-12">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-[11px] uppercase tracking-[0.2em] font-bold text-gray-400 hover:text-[#007398] transition-colors"
          >
            {showAll ? "[ — Mostrar menos ]" : "[ + Ver todo el equipo ]"}
          </button>
        </div>
      )}

      {/* Sección de Asesores - CON HOVER EFECTO */}
      {asesoresData.length > 0 && (
        <section className="mt-24 pt-16 border-t border-gray-100">
          <h2 className="text-2xl font-serif text-center mb-12 text-gray-800 tracking-tight italic">Consejo Superior de Asesoría</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {asesoresData.map((member) => {
              const slug = getUserSlug(member);
              return (
                <div
                  key={member.uid || member.displayName}
                  onClick={() => handleNavigation(slug)}
                  className="text-center p-6 border border-gray-50 bg-gray-50/30 cursor-pointer group hover:border-[#007398]/30 hover:shadow-lg transition-all duration-300"
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full overflow-hidden border-2 border-white shadow-sm group-hover:border-[#007398] transition-all">
                    {member.imageUrl && (
                      <img
                        src={member.imageUrl}
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                        alt={member.displayName}
                      />
                    )}
                  </div>
                  <h4 className="text-md font-serif text-gray-900 group-hover:text-[#007398] transition-colors">
                    {member.displayName || `${member.firstName} ${member.lastName}`}
                  </h4>
                  <p className="text-[10px] text-[#007398] uppercase mt-1 tracking-widest font-bold">Asesor Académico</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* SECCIÓN INSTITUCIONES: DISEÑO MAJESTUOSO CON DOBLE NAVEGACIÓN */}
      {institutionsData.length > 0 && (
        <section className="mt-32 pt-20 border-t-2 border-double border-gray-100">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-serif text-gray-900 tracking-widest uppercase mb-2">Alianzas Institucionales</h2>
            <div className="w-12 h-0.5 bg-[#007398] mx-auto mb-4"></div>
            <p className="text-xs font-sans text-gray-400 tracking-[0.3em] uppercase">Entidades que respaldan nuestra labor</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {institutionsData.map((inst) => {
              const slug = getUserSlug(inst);
              // Buscar el sitio web en social.website o en algún campo específico
              const website = inst.social?.website || inst.website || '';

              return (
                <motion.div
                  key={inst.uid || inst.displayName}
                  whileHover={{ y: -5 }}
                  onClick={() => handleNavigation(slug)} // Acción por defecto: Slug interno
                  className="relative flex flex-col items-center md:flex-row md:items-stretch bg-[#fafafa] border border-gray-100 p-8 group overflow-hidden transition-all duration-500 cursor-pointer"
                >
                  {/* Decoración Majestuosa Lateral */}
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#007398] scale-y-0 group-hover:scale-y-100 transition-transform duration-500 origin-top"></div>

                  {/* Logo de la Institución */}
                  <div className="flex-shrink-0 mb-6 md:mb-0 md:mr-8 flex items-center justify-center bg-white p-4 shadow-sm border border-gray-50 w-36 h-36 relative z-10">
                    {inst.imageUrl ? (
                      <img
                        src={inst.imageUrl}
                        className="max-w-full max-h-full object-contain filter grayscale group-hover:grayscale-0 transition-all duration-700"
                        alt={inst.displayName}
                      />
                    ) : (
                      <div className="text-4xl text-gray-200">🏛️</div>
                    )}
                  </div>

                  {/* Contenido Informativo */}
                  <div className="flex flex-col justify-between text-center md:text-left relative z-10">
                    <div>
                      <h3 className="text-xl font-serif text-gray-900 mb-2 leading-tight group-hover:text-[#007398] transition-colors">
                        {inst.displayName || `${inst.firstName} ${inst.lastName}`}
                      </h3>
                      <p className="text-[11px] font-sans text-gray-400 uppercase tracking-widest mb-6">
                        Institución Colaboradora
                      </p>
                    </div>

                    {/* BOTONES DE ACCIÓN */}
                    <div className="flex flex-col sm:flex-row gap-4 items-center md:items-start">
                      {/* 1. Botón de Perfil Interno (visual, el clic ya lo maneja el div) */}
                      <span className="text-[10px] font-sans font-bold uppercase tracking-[.2em] text-gray-800 border-b border-gray-300 pb-1">
                        Ver Perfil
                      </span>

                      {/* 2. BOTÓN ESPECIAL: Sitio Web Externo */}
                      {website && (
                        <a
                          href={website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()} // IMPORTANTE: Evita que el clic en el botón active el slug de la card
                          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-[#007398] text-[9px] font-bold uppercase tracking-widest hover:bg-[#007398] hover:text-white hover:border-[#007398] transition-all duration-300 shadow-sm"
                        >
                          Sitio Web Oficial
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* Footer de Captación */}
      <footer className="mt-32 p-12 bg-gray-900 text-white text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-[#007398]"></div>
        <h3 className="text-2xl font-serif mb-4">¿Desea formar parte de nuestra historia?</h3>
        <p className="text-gray-400 text-sm max-w-xl mx-auto mb-8 font-serif italic">
          Buscamos mentes brillantes apasionadas por la comunicación científica.
        </p>
        <a
          href="https://www.revistacienciasestudiantes.com/es/admin"
          className="inline-block border border-white px-8 py-3 text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-white hover:text-black transition-all"
        >
          Postular a un cargo editorial
        </a>
      </footer>
    </div>
  );
}

export default TeamSection;