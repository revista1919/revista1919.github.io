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

  const jsonUrl = 'https://www.revistacienciasestudiantes.com/team/Team.json';

  // Role definitions in English
  const roleDefinitions = {
    'Equipo Editorial': 'Group of individuals who sustain the academic project of the journal. They participate in the evaluation, editing, proofreading, dissemination, and management of content, ensuring the scientific and editorial quality of each issue.',
    'Comité Científico': 'Advisory body composed of renowned specialists who provide guidance on the quality, relevance, and scientific rigor of the content, ensuring compliance with the academic standards of the publication.',
    'Institución Colaboradora': 'Entities that support the project through institutional backing, funding, or dissemination, contributing to the strengthening and sustainability of the journal.'
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

  // Extract unique roles for filter (excluding "Revisor")
  const roles = useMemo(() => {
    const allRoles = mainData.flatMap(user => {
      return (user.roles || []).filter(role => 
        role && role !== 'Autor' && role !== 'Revisor'
      );
    });
    const uniqueRoles = [...new Set(allRoles)];
    return ['All', ...uniqueRoles.sort()];
  }, [mainData]);

  // Filter members by selected role
  const filteredMembers = useMemo(() => {
    if (selectedRole === 'All') return mainData;
    return mainData.filter(user => {
      const memberRoles = user.roles || [];
      return memberRoles.includes(selectedRole);
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

  // Tooltip component with info icon
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
          className="text-gray-400 hover:text-[#FF7900] transition-colors focus:outline-none"
          title={`What is ${definitionKey}?`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <AnimatePresence>
          {activeTooltip === definitionKey && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-3 w-72 p-4 bg-[#003B5C] text-white text-xs leading-relaxed rounded shadow-xl"
            >
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-[#003B5C]"></div>
              <p className="text-left font-sans">{roleDefinitions[definitionKey]}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="bg-[#FCFCFD] min-h-screen font-sans text-[#1A232C]">
      
      {/* ===================== HEADER SECTION ===================== */}
      <header className="bg-white border-b border-gray-200 pt-20 pb-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <motion.span
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-[11px] uppercase tracking-[0.3em] font-semibold text-[#003B5C] mb-4 block"
          >
            Institutional Directory
          </motion.span>
          <motion.h1
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="text-4xl md:text-5xl font-serif text-[#003B5C] mb-6"
          >
            Editorial and Academic Body
          </motion.h1>
          <div className="w-16 h-1 bg-[#FF7900] mx-auto mb-6"></div>
          <p className="text-[#64748B] max-w-2xl mx-auto leading-relaxed text-sm md:text-base">
            Fostering scientific excellence through editorial rigor, peer review, and the collaborative work of our distinguished team.
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12">
        
        {/* ===================== ROLE FILTERS ===================== */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {roles.map((role) => (
            <div key={role} className="flex items-center">
              <button
                onClick={() => setSelectedRole(role)}
                className={`px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all duration-300 border-b-2 ${
                  selectedRole === role
                    ? 'border-[#FF7900] text-[#003B5C] bg-[#F3F7F9]'
                    : 'border-transparent text-gray-500 hover:text-[#003B5C] hover:bg-gray-50'
                }`}
              >
                {role}
              </button>
              {role !== 'All' && <RoleDefinitionButton role={role} />}
            </div>
          ))}
        </div>

        {/* ===================== EDITORIAL TEAM GRID ===================== */}
        {isLoading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-4 border-[#003B5C] border-t-[#FF7900] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-gray-500 uppercase tracking-widest">Loading directory...</p>
          </div>
        ) : jsonError ? (
          <p className="text-red-600 text-center py-10 bg-red-50 border border-red-100 rounded">{jsonError}</p>
        ) : filteredMembers.length === 0 ? (
          <p className="text-gray-500 text-center py-10">No members found for this criteria.</p>
        ) : (
          <>
            <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {displayedMembers.map((member) => {
                  const slug = getUserSlug(member);
                  return (
                    <motion.div
                      layout
                      key={member.uid || member.displayName}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => handleNavigation(slug)}
                      className="group bg-white border border-gray-200 border-t-4 border-t-transparent hover:border-t-[#FF7900] hover:shadow-xl hover:shadow-gray-200/40 p-6 transition-all duration-300 cursor-pointer flex flex-col"
                    >
                      <div className="flex items-start space-x-4 mb-4">
                        {member.imageUrl ? (
                          <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0 border border-gray-100">
                            <img
                              src={member.imageUrl}
                              alt={member.displayName}
                              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded bg-[#F3F7F9] flex items-center justify-center flex-shrink-0 border border-gray-100">
                            <span className="text-[#003B5C] font-serif text-xl">
                              {member.firstName?.charAt(0)}{member.lastName?.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div>
                          <h3 className="text-lg font-serif text-[#003B5C] leading-tight group-hover:text-[#FF7900] transition-colors">
                            {member.displayName || `${member.firstName} ${member.lastName}`}
                          </h3>
                        </div>
                      </div>
                      
                      <div className="mt-auto pt-4 border-t border-gray-50">
                        <div className="flex flex-wrap gap-1.5">
                          {(member.roles || []).filter(r => r && r !== 'Autor' && r !== 'Revisor').map((role) => (
                            <span key={role} className="text-[10px] font-semibold uppercase tracking-wider bg-[#F3F7F9] text-[#003B5C] px-2.5 py-1 rounded-sm">
                              {role}
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
                  className="px-6 py-2 border border-[#003B5C] text-[#003B5C] text-xs font-bold uppercase tracking-widest hover:bg-[#003B5C] hover:text-white transition-colors rounded-sm"
                >
                  {showAll ? "Show fewer results" : "View complete directory"}
                </button>
              </div>
            )}
          </>
        )}

        {/* ===================== SCIENTIFIC COMMITTEE SECTION ===================== */}
        {scientificData.length > 0 && (
          <section className="mt-24">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-8">
              <h2 className="text-2xl font-serif text-[#003B5C] inline-flex items-center">
                Scientific Committee
                <RoleDefinitionButton role="Comité Científico" sectionName="Comité Científico" />
              </h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {scientificData.map((member) => {
                const slug = getUserSlug(member);
                return (
                  <div
                    key={member.uid || member.displayName}
                    onClick={() => handleNavigation(slug)}
                    className="text-center group cursor-pointer"
                  >
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden border-2 border-transparent group-hover:border-[#FF7900] shadow-sm transition-all duration-300">
                      {member.imageUrl ? (
                        <img
                          src={member.imageUrl}
                          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                          alt={member.displayName}
                        />
                      ) : (
                        <div className="w-full h-full bg-[#F3F7F9] flex items-center justify-center text-[#003B5C] font-serif">
                          {member.firstName?.charAt(0)}{member.lastName?.charAt(0)}
                        </div>
                      )}
                    </div>
                    <h4 className="text-sm font-serif text-[#1A232C] group-hover:text-[#003B5C] leading-snug">
                      {member.displayName || `${member.firstName} ${member.lastName}`}
                    </h4>
                    <p className="text-[9px] text-[#64748B] uppercase mt-1.5 tracking-widest font-semibold">
                      Academic Advisor
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ===================== PARTNER INSTITUTIONS SECTION ===================== */}
        {institutionsData.length > 0 && (
          <section className="mt-28">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-10">
              <h2 className="text-2xl font-serif text-[#003B5C] inline-flex items-center">
                Partner Institutions
                <RoleDefinitionButton role="Institución Colaboradora" sectionName="Institución Colaboradora" />
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {institutionsData.map((inst) => {
                const slug = getUserSlug(inst);
                const website = inst.social?.website || inst.website || '';

                return (
                  <motion.div
                    key={inst.uid || inst.displayName}
                    whileHover={{ y: -3 }}
                    onClick={() => handleNavigation(slug)}
                    className="flex flex-col sm:flex-row bg-white border border-gray-200 hover:border-[#FF7900] hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden rounded-sm"
                  >
                    <div className="sm:w-1/3 bg-[#F3F7F9] p-6 flex items-center justify-center border-b sm:border-b-0 sm:border-r border-gray-100">
                      {inst.imageUrl ? (
                        <img
                          src={inst.imageUrl}
                          className="max-w-full max-h-24 object-contain mix-blend-multiply"
                          alt={inst.displayName}
                        />
                      ) : (
                        <svg className="w-12 h-12 text-[#003B5C]/20" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L2 7v2h20V7L12 2zm0 2.8L18.4 7H5.6L12 4.8zM4 11h3v8H4v-8zm5 0h3v8H9v-8zm5 0h3v8h-3v-8zm5 0h3v8h-3v-8zM2 21h20v2H2v-2z"/>
                        </svg>
                      )}
                    </div>

                    <div className="sm:w-2/3 p-6 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] text-[#FF7900] font-bold uppercase tracking-widest mb-1 block">
                          Institutional Endorsement
                        </span>
                        <h3 className="text-xl font-serif text-[#003B5C] mb-3 leading-tight">
                          {inst.displayName || `${inst.firstName} ${inst.lastName}`}
                        </h3>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        <span className="text-xs font-semibold text-[#64748B] hover:text-[#003B5C] flex items-center gap-1 transition-colors">
                          View Profile 
                          <span aria-hidden="true">&rarr;</span>
                        </span>

                        {website && (
                          <a
                            href={website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 text-xs text-[#003B5C] hover:text-[#FF7900] transition-colors"
                            title="Visit official website"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      </main>

      {/* ===================== RECRUITMENT FOOTER ===================== */}
      <footer className="mt-20 bg-[#003B5C] text-white border-t-4 border-[#FF7900] px-4 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <svg className="w-10 h-10 mx-auto text-[#FF7900] mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <h3 className="text-3xl font-serif mb-4">Join our editorial project</h3>
          <p className="text-[#A1B3C4] mb-8 font-sans">
            We seek researchers, academics, and professionals committed to peer review and the advancement of scientific communication.
          </p>
          <a
            href="https://www.revistacienciasestudiantes.com/en/admin"
            className="inline-block bg-[#FF7900] text-white px-8 py-3 text-xs font-bold uppercase tracking-widest hover:bg-[#E06A00] transition-colors rounded-sm"
          >
            Apply for a Position
          </a>
        </div>
      </footer>
    </div>
  );
}

export default TeamSectionEN;