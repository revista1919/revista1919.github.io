import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function TeamSectionEN({ setActiveTab }) {
  const [mainData, setMainData] = useState([]);
  const [advisorsData, setAdvisorsData] = useState([]);
  const [institutionsData, setInstitutionsData] = useState([]);
  const [selectedRole, setSelectedRole] = useState('All');
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
          throw new Error(`HTTP error: ${response.status}`);
        }
        return response.json();
      })
      .then(users => {
        // Filter based on roles (exclude pure authors if needed)
        const allData = users.filter(user => {
          const memberRoles = user.roles || [];
          return !(memberRoles.length === 1 && memberRoles[0] === 'Autor');
        });

        // Separate by categories
        const advisors = allData.filter(user => {
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
        setAdvisorsData(advisors);
        setInstitutionsData(institutions);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error loading JSON:', error);
        setJsonError('Could not load team information.');
        setMainData([]);
        setAdvisorsData([]);
        setInstitutionsData([]);
        setIsLoading(false);
      });
  }, []);

  // Extract unique roles for filter
  const roles = useMemo(() => {
    const allRoles = mainData.flatMap(user => {
      return (user.roles || []).filter(role => role && role !== 'Autor');
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

  // Navigate to member profile (.html version)
  const handleNavigation = (slug) => {
    if (!slug) return;
    window.location.href = `/team/${slug}.EN.html`; // Using .html as before
  };

  // Get slug from user data
  const getUserSlug = (user) => {
    return user.slug || generateSlug(user.displayName || `${user.firstName} ${user.lastName}`);
  };

  // Helper function to generate slug (just in case)
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
      {/* Journal Style Header */}
      <header className="text-center mb-16">
        <motion.span
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#007398] mb-4 block"
        >
          Organizational Structure
        </motion.span>
        <motion.h1
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="text-4xl sm:text-5xl font-serif text-gray-900 mb-6"
        >
          Editorial and Academic Body
        </motion.h1>
        <div className="w-24 h-1 bg-gray-200 mx-auto mb-6"></div>
        <p className="text-gray-500 max-w-2xl mx-auto leading-relaxed italic font-serif">
          "Fostering scientific excellence through academic collaboration and editorial rigor."
        </p>
      </header>

      {/* Role Selector */}
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

      {/* Operational Members Grid */}
      {isLoading ? (
        <div className="text-center py-20 font-serif italic text-gray-400 animate-pulse">Loading Directory...</div>
      ) : jsonError ? (
        <p className="text-red-600 text-sm sm:text-lg text-center">{jsonError}</p>
      ) : filteredMembers.length === 0 ? (
        <p className="text-gray-600 text-sm sm:text-lg text-center">No members found for this role.</p>
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

      {/* Show More Button */}
      {filteredMembers.length > 15 && (
        <div className="text-center mt-12">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-[11px] uppercase tracking-[0.2em] font-bold text-gray-400 hover:text-[#007398] transition-colors"
          >
            {showAll ? "[ — Show Less ]" : "[ + Show All Staff ]"}
          </button>
        </div>
      )}

      {/* Academic Advisors Section - WITH HOVER EFFECT */}
      {advisorsData.length > 0 && (
        <section className="mt-24 pt-16 border-t border-gray-100">
          <h2 className="text-2xl font-serif text-center mb-12 text-gray-800 tracking-tight">Senior Advisory Council</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {advisorsData.map((member) => {
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
                  <p className="text-[10px] text-[#007398] uppercase mt-1 tracking-widest font-bold">Academic Advisor</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Partner Institutions Section - Majestic Design with Double Navigation */}
      {institutionsData.length > 0 && (
        <section className="mt-32 pt-20 border-t-2 border-double border-gray-100">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-serif text-gray-900 tracking-widest uppercase mb-2">Institutional Alliances</h2>
            <div className="w-12 h-0.5 bg-[#007398] mx-auto mb-4"></div>
            <p className="text-xs font-sans text-gray-400 tracking-[0.3em] uppercase">Entities that support our work</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {institutionsData.map((inst) => {
              const slug = getUserSlug(inst);
              const website = inst.social?.website || inst.website || '';

              return (
                <motion.div
                  key={inst.uid || inst.displayName}
                  whileHover={{ y: -5 }}
                  onClick={() => handleNavigation(slug)} // Default action: internal slug
                  className="relative flex flex-col items-center md:flex-row md:items-stretch bg-[#fafafa] border border-gray-100 p-8 group overflow-hidden transition-all duration-500 cursor-pointer"
                >
                  {/* Majestic Side Decoration */}
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#007398] scale-y-0 group-hover:scale-y-100 transition-transform duration-500 origin-top"></div>

                  {/* Institution Logo */}
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

                  {/* Informational Content */}
                  <div className="flex flex-col justify-between text-center md:text-left relative z-10">
                    <div>
                      <h3 className="text-xl font-serif text-gray-900 mb-2 leading-tight group-hover:text-[#007398] transition-colors">
                        {inst.displayName || `${inst.firstName} ${inst.lastName}`}
                      </h3>
                      <p className="text-[11px] font-sans text-gray-400 uppercase tracking-widest mb-6">
                        Partner Institution
                      </p>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="flex flex-col sm:flex-row gap-4 items-center md:items-start">
                      {/* 1. Internal Profile Button (visual, click handled by div) */}
                      <span className="text-[10px] font-sans font-bold uppercase tracking-[.2em] text-gray-800 border-b border-gray-300 pb-1">
                        View Profile
                      </span>

                      {/* 2. SPECIAL BUTTON: External Website */}
                      {website && (
                        <a
                          href={website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()} // IMPORTANT: Prevent card's slug click
                          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-[#007398] text-[9px] font-bold uppercase tracking-widest hover:bg-[#007398] hover:text-white hover:border-[#007398] transition-all duration-300 shadow-sm"
                        >
                          Official Website
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

      {/* Recruitment Footer */}
      <footer className="mt-32 p-12 bg-gray-900 text-white text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-[#007398]"></div>
        <h3 className="text-2xl font-serif mb-4">Want to be part of our history?</h3>
        <p className="text-gray-400 text-sm max-w-xl mx-auto mb-8 font-serif italic">
          We seek brilliant minds passionate about scientific communication.
        </p>
        <a
          href="https://www.revistacienciasestudiantes.com/en/admin"
          className="inline-block border border-white px-8 py-3 text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-white hover:text-black transition-all"
        >
          Apply for an Editorial Position
        </a>
      </footer>
    </div>
  );
}

export default TeamSectionEN;