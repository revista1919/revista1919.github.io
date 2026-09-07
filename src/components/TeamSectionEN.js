import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function TeamSectionEN() {
  const [mainData, setMainData] = useState([]);
  const [scientificData, setScientificData] = useState([]);
  const [institutionsData, setInstitutionsData] = useState([]);
  const [selectedRole, setSelectedRole] = useState('All');
  const [isLoading, setIsLoading] = useState(false);
  const [jsonError, setJsonError] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const jsonUrl = 'https://www.revistacienciasestudiantes.com/team/Team.json';

  // Role translation mapping
  const ES_TO_EN = {
    'Fundador': 'Founder',
    'Co-Fundador': 'Co-Founder',
    'Director General': 'General Director',
    'Subdirector General': 'Deputy General Director',
    'Editor en Jefe': 'Editor-in-Chief',
    'Editor de Sección': 'Section Editor',
    'Editora de Sección': 'Section Editor',
    'Revisor': 'Reviewer',
    'Revisor / Comité Editorial': 'Reviewer',
    'Responsable de Desarrollo Web': 'Web Development Manager',
    'Encargado de Soporte Técnico': 'Technical Support Manager',
    'Encargado de Redes Sociales': 'Social Media Manager',
    'Encargada de Redes Sociales': 'Social Media Manager',
    'Encargado de Asignación de Artículos': 'Article Assignment Manager',
    'Diseñador Gráfico': 'Graphic Designer',
    'Diseñadora Gráfica': 'Graphic Designer',
    'Community Manager': 'Community Manager',
    'Encargado de Nuevos Colaboradores': 'New Collaborators Manager',
    'Encargada de Nuevos Colaboradores': 'New Collaborators Manager',
    'Coordinador de Eventos o Convocatorias': 'Events or Calls Coordinator',
    'Coordinadora de Eventos o Convocatorias': 'Events or Calls Coordinator',
    'Asesor Legal': 'Legal Advisor',
    'Asesora Legal': 'Legal Advisor',
    'Asesor Editorial': 'Editorial Advisor',
    'Asesora Editorial': 'Editorial Advisor',
    'Responsable de Finanzas': 'Finance Manager',
    'Responsable de Transparencia': 'Transparency Manager',
    'Autor': 'Author',
    'Asesor Académico': 'Academic Advisor',
    'Institución Colaboradora': 'Partner Institution',
    'Equipo Editorial': 'Editorial Team'
  };

  // Role definitions in English
  const roleDefinitions = {
    'Editorial Team': 'Group of individuals who sustain the academic project of the journal. They participate in the evaluation, editing, proofreading, dissemination, and management of content, ensuring the scientific and editorial quality of each issue.',
    'Scientific Committee': 'Advisory body composed of renowned specialists who provide guidance on the quality, relevance, and scientific rigor of the content, ensuring compliance with the academic standards of the publication.',
    'Partner Institution': 'Entities that support the project through institutional backing, funding, or dissemination, contributing to the strengthening and sustainability of the journal.'
  };

  // Helper function to translate role
  const translateRole = (spanishRole) => {
    return ES_TO_EN[spanishRole] || spanishRole;
  };

  useEffect(() => {
    setIsLoading(true);
    setJsonError(null);

    fetch(jsonUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        return response.json();
      })
      .then(users => {
        const allData = users.filter(user => {
          const memberRoles = user.roles || [];
          return !(memberRoles.length === 1 && memberRoles[0] === 'Autor');
        });

        // Role is still "Asesor Académico" but section is called "Scientific Committee"
        const scientific = allData.filter(user => {
          const roles = user.roles || [];
          return roles.includes('Asesor Académico');
        });

        const institutions = allData.filter(user => {
          const roles = user.roles || [];
          return roles.includes('Institución Colaboradora');
        });

        const mainMembers = allData.filter(user => {
          const roles = user.roles || [];
          return !roles.includes('Asesor Académico') && 
                 !roles.includes('Institución Colaboradora');
        });

        setMainData(mainMembers);
        setScientificData(scientific);
        setInstitutionsData(institutions);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error loading JSON:', error);
        setJsonError('Could not load team information.');
        setMainData([]);
        setScientificData([]);
        setInstitutionsData([]);
        setIsLoading(false);
      });
  }, []);

  // Extract unique roles for filter (translated to English, excluding "Reviewer")
  const roles = useMemo(() => {
    const allRoles = mainData.flatMap(user => {
      return (user.roles || []).filter(role => 
        role && role !== 'Autor' && role !== 'Revisor'
      );
    });
    const translatedRoles = allRoles.map(role => translateRole(role));
    const uniqueRoles = [...new Set(translatedRoles)];
    return ['All', ...uniqueRoles.sort()];
  }, [mainData]);

  // Filter members by selected role (comparing translated roles)
  const filteredMembers = useMemo(() => {
    if (selectedRole === 'All') return mainData;
    return mainData.filter(user => {
      const memberRoles = user.roles || [];
      const translatedMemberRoles = memberRoles.map(role => translateRole(role));
      return translatedMemberRoles.includes(selectedRole);
    });
  }, [mainData, selectedRole]);

  const displayedMembers = showAll ? filteredMembers : filteredMembers.slice(0, 15);

  const handleNavigation = (slug) => {
    if (!slug) return;
    window.location.href = `/team/${slug}.EN.html`;
  };

  const getUserSlug = (user) => {
    return user.slug || generateSlug(user.displayName || `${user.firstName} ${user.lastName}`);
  };

  const generateSlug = (name) => {
    if (!name) return '';
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  };

  // Tooltip with academic editorial style
  const RoleDefinitionButton = ({ role, sectionName }) => {
    const definitionKey = sectionName || role;
    if (!roleDefinitions[definitionKey]) return null;
    
    return (
      <div className="relative inline-flex items-center ml-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActiveTooltip(activeTooltip === definitionKey ? null : definitionKey);
          }}
          className="text-[10px] font-mono text-gray-400 hover:text-[#002147] transition-colors duration-300 focus:outline-none"
          title={`Definition of ${definitionKey}`}
        >
          [?]
        </button>
        <AnimatePresence>
          {activeTooltip === definitionKey && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-72 p-5 bg-white border border-[#002147] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)]"
            >
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-[#002147]"></div>
              <p className="text-left font-['Inter',sans-serif] text-[11px] leading-relaxed text-[#1a1a1a] normal-case tracking-normal">
                {roleDefinitions[definitionKey]}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="bg-[#FCFCFC] min-h-screen font-['Inter',sans-serif] text-[#1a1a1a] selection:bg-[#002147] selection:text-white">
      
      {/* ===================== HEADER SECTION ===================== */}
      <header className="bg-white border-b border-gray-300 pt-20 pb-16 px-6">
        <div className="max-w-[1200px] mx-auto">
          <motion.span
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="text-[10px] uppercase tracking-[0.25em] font-semibold text-[#002147]/70 mb-4 block"
          >
            Institutional Directory
          </motion.span>
          <motion.h1
            initial={{ y: 20, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-4xl md:text-5xl font-['Lora',serif] text-[#002147] mb-6 tracking-tight font-medium"
          >
            Editorial and Academic Body
          </motion.h1>
          <div className="w-16 h-px bg-[#002147]/40 mb-6"></div>
          <p className="text-gray-600 max-w-2xl leading-relaxed text-sm">
            Fostering scientific excellence through editorial rigor, peer review, and the collaborative work of our distinguished international team.
          </p>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-12">
        
        {/* ===================== ROLE FILTERS ===================== */}
        {/* Mobile filter button */}
        <div className="md:hidden mb-8">
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="w-full flex items-center justify-between px-5 py-4 bg-white border border-gray-300 text-[10px] font-bold uppercase tracking-[0.2em] text-[#002147] hover:border-[#002147] transition-colors duration-300"
          >
            <span>Filter by role: {selectedRole}</span>
            <span className="font-mono text-gray-400">{showMobileFilters ? '[-]' : '[+]'}</span>
          </button>
        </div>

        {/* Desktop filters */}
        <div className="hidden md:flex flex-wrap gap-2 mb-12">
          {roles.map((role) => (
            <div key={role} className="flex items-center">
              <button
                onClick={() => setSelectedRole(role)}
                className={`px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors duration-300 border ${
                  selectedRole === role
                    ? 'border-[#002147] bg-[#002147] text-white'
                    : 'border-gray-300 bg-white text-gray-500 hover:border-[#002147] hover:text-[#002147]'
                }`}
              >
                {role}
              </button>
              {role !== 'All' && <RoleDefinitionButton role={role} />}
            </div>
          ))}
        </div>

        {/* Mobile filters */}
        <AnimatePresence>
          {showMobileFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="md:hidden mb-8 overflow-hidden"
            >
              <div className="bg-white border border-gray-300 divide-y divide-gray-200">
                {roles.map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      setSelectedRole(role);
                      setShowMobileFilters(false);
                    }}
                    className={`w-full text-left px-5 py-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors duration-300 ${
                      selectedRole === role
                        ? 'bg-[#002147] text-white'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ===================== EDITORIAL TEAM GRID ===================== */}
        {isLoading ? (
          <div className="text-center py-32">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-[#002147] animate-spin mx-auto mb-6"></div>
            <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">
              Querying records...
            </p>
          </div>
        ) : jsonError ? (
          <div className="border border-[#8B0000] bg-[#8B0000]/5 p-8 text-center">
            <p className="text-[#8B0000] text-[10px] font-bold uppercase tracking-[0.2em]">
              {jsonError}
            </p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="border border-gray-300 bg-white p-16 text-center">
            <p className="text-gray-500 font-['Lora',serif] italic">
              No records found for this criteria.
            </p>
          </div>
        ) : (
          <>
            {/* SEAMLESS GRID */}
            <motion.div 
              layout 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-l border-gray-300 bg-white"
            >
              <AnimatePresence>
                {displayedMembers.map((member) => {
                  const slug = getUserSlug(member);
                  return (
                    <motion.div
                      layout
                      key={member.uid || member.displayName}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      onClick={() => handleNavigation(slug)}
                      className="group border-b border-r border-gray-300 p-8 hover:bg-[#FAFAF8] transition-colors duration-300 cursor-pointer flex flex-col"
                    >
                      <div className="flex items-start space-x-5 mb-6">
                        {member.imageUrl ? (
                          <div className="w-20 h-20 flex-shrink-0 border border-gray-300 overflow-hidden">
                            <img
                              src={member.imageUrl}
                              alt={member.displayName}
                              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                            />
                          </div>
                        ) : (
                          <div className="w-20 h-20 flex-shrink-0 border border-gray-300 bg-[#F5F5F0] flex items-center justify-center">
                            <span className="text-[#002147] font-['Lora',serif] text-2xl">
                              {member.firstName?.charAt(0)}{member.lastName?.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div>
                          <h3 className="text-xl font-['Lora',serif] text-[#1a1a1a] group-hover:text-[#002147] leading-tight mb-2 transition-colors duration-300 font-medium">
                            {member.displayName || `${member.firstName} ${member.lastName}`}
                          </h3>
                        </div>
                      </div>
                      
                      <div className="mt-auto">
                        <div className="flex flex-wrap gap-2">
                          {(member.roles || []).filter(r => r && r !== 'Autor' && r !== 'Revisor').map((role) => (
                            <span 
                              key={role} 
                              className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500 border border-gray-200 px-2.5 py-1 bg-white"
                            >
                              {translateRole(role)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>

            {filteredMembers.length > 15 && (
              <div className="text-center mt-12">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="px-8 py-4 bg-white border border-[#002147] text-[#002147] text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-[#002147] hover:text-white transition-colors duration-300"
                >
                  {showAll ? "REDUCE DIRECTORY" : "VIEW COMPLETE DIRECTORY"}
                </button>
              </div>
            )}
          </>
        )}

        {/* ===================== SCIENTIFIC COMMITTEE SECTION ===================== */}
        {scientificData.length > 0 && (
          <section className="mt-32">
            <div className="border-b-2 border-[#1a1a1a] pb-4 mb-10 flex items-center">
              <h2 className="text-3xl font-['Lora',serif] text-[#1a1a1a] font-medium">
                International Scientific Committee
              </h2>
              <RoleDefinitionButton role="Scientific Committee" sectionName="Scientific Committee" />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 border-t border-l border-gray-300 bg-white">
              {scientificData.map((member) => {
                const slug = getUserSlug(member);
                return (
                  <div
                    key={member.uid || member.displayName}
                    onClick={() => handleNavigation(slug)}
                    className="group border-b border-r border-gray-300 p-6 text-center cursor-pointer hover:bg-[#FAFAF8] transition-colors duration-300"
                  >
                    <div className="w-24 h-24 mx-auto mb-5 border border-gray-300 overflow-hidden">
                      {member.imageUrl ? (
                        <img
                          src={member.imageUrl}
                          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                          alt={member.displayName}
                        />
                      ) : (
                        <div className="w-full h-full bg-[#F5F5F0] flex items-center justify-center text-[#002147] font-['Lora',serif] text-2xl">
                          {member.firstName?.charAt(0)}{member.lastName?.charAt(0)}
                        </div>
                      )}
                    </div>
                    <h4 className="text-base font-['Lora',serif] text-[#1a1a1a] group-hover:text-[#002147] leading-tight mb-2 transition-colors duration-300 font-medium">
                      {member.displayName || `${member.firstName} ${member.lastName}`}
                    </h4>
                    <p className="text-[9px] text-gray-400 uppercase tracking-[0.2em] font-bold">
                      {translateRole('Asesor Académico')}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ===================== PARTNER INSTITUTIONS SECTION ===================== */}
        {institutionsData.length > 0 && (
          <section className="mt-32">
            <div className="border-b-2 border-[#1a1a1a] pb-4 mb-10 flex items-center">
              <h2 className="text-3xl font-['Lora',serif] text-[#1a1a1a] font-medium">
                Partner Institutions
              </h2>
              <RoleDefinitionButton role="Partner Institution" sectionName="Partner Institution" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 border-t border-l border-gray-300 bg-white">
              {institutionsData.map((inst) => {
                const slug = getUserSlug(inst);
                const website = inst.social?.website || inst.website || '';

                return (
                  <motion.div
                    key={inst.uid || inst.displayName}
                    onClick={() => handleNavigation(slug)}
                    className="flex flex-col sm:flex-row border-b border-r border-gray-300 hover:bg-[#FAFAF8] transition-colors duration-300 cursor-pointer group"
                  >
                    <div className="sm:w-2/5 p-8 flex items-center justify-center border-b sm:border-b-0 sm:border-r border-gray-200 bg-white">
                      {inst.imageUrl ? (
                        <img
                          src={inst.imageUrl}
                          className="max-w-full max-h-20 object-contain grayscale group-hover:grayscale-0 transition-all duration-500 mix-blend-multiply"
                          alt={inst.displayName}
                        />
                      ) : (
                        <span className="text-[10px] text-gray-300 font-bold uppercase tracking-[0.2em]">
                          No Logo
                        </span>
                      )}
                    </div>

                    <div className="sm:w-3/5 p-8 flex flex-col justify-center">
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.2em] mb-2 block">
                        Institutional Endorsement
                      </span>
                      <h3 className="text-xl font-['Lora',serif] text-[#1a1a1a] mb-4 leading-tight group-hover:text-[#002147] transition-colors duration-300 font-medium">
                        {inst.displayName || `${inst.firstName} ${inst.lastName}`}
                      </h3>

                      <div className="flex items-center gap-4 mt-auto">
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#002147]">
                          VIEW PROFILE &rarr;
                        </span>
                        {website && (
                          <a
                            href={website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-[#002147] transition-colors duration-300 border-l border-gray-300 pl-4"
                            title="Visit official website"
                          >
                            WEBSITE
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
      </main>

      {/* ===================== RECRUITMENT FOOTER ===================== */}
      <footer className="mt-32 bg-[#002147] text-white border-t border-gray-200 px-6 py-24 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="w-16 h-16 border border-white/20 mx-auto mb-8 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <h3 className="text-3xl font-['Lora',serif] mb-6 font-medium">
            Join Our Editorial Project
          </h3>
          <p className="text-gray-300 mb-10 font-['Inter',sans-serif] text-sm leading-relaxed">
            We seek researchers, academics, and professionals committed to peer review and the advancement of scientific communication.
          </p>
          <a
            href="https://www.revistacienciasestudiantes.com/en/admin"
            className="inline-block bg-white text-[#002147] px-8 py-4 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-gray-100 transition-colors duration-300"
          >
            APPLICATION FORM
          </a>
        </div>
      </footer>
    </div>
  );
}

export default TeamSectionEN;