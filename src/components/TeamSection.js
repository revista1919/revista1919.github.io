import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'framer-motion';

function TeamSection({ setActiveTab }) {
  const [mainData, setMainData] = useState([]);
  const [asesoresData, setAsesoresData] = useState([]);
  const [institutionsData, setInstitutionsData] = useState([]);
  const [selectedRole, setSelectedRole] = useState('Todos');
  const [isLoading, setIsLoading] = useState(false);
  const [csvError, setCsvError] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const csvUrl =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';

  useEffect(() => {
    setIsLoading(true);
    setCsvError(null);
    Papa.parse(csvUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const allData = (result.data || []).filter((data) => {
          const memberRoles = (data['Rol en la Revista'] || '')
            .split(';')
            .map((role) => role.trim())
            .filter((role) => role);
          return !(memberRoles.length === 1 && memberRoles[0] === 'Autor');
        });
        const asesores = allData.filter((data) => {
          const roles = (data['Rol en la Revista'] || '').split(';').map((r) => r.trim());
          return roles.includes('Asesor Académico');
        });
        const institutions = allData.filter((data) => {
          const roles = (data['Rol en la Revista'] || '').split(';').map((r) => r.trim());
          return roles.includes('Institución Colaboradora');
        });
        const mainMembers = allData.filter((data) => {
          const roles = (data['Rol en la Revista'] || '').split(';').map((r) => r.trim());
          return !roles.includes('Asesor Académico') && !roles.includes('Institución Colaboradora');
        });
        setMainData(mainMembers);
        setAsesoresData(asesores);
        setInstitutionsData(institutions);
        setIsLoading(false);
      },
      error: (error) => {
        console.error('Error al cargar el CSV:', error);
        setCsvError('No se pudo cargar la información del equipo.');
        setMainData([]);
        setAsesoresData([]);
        setInstitutionsData([]);
        setIsLoading(false);
      },
    });
  }, []);

  const roles = useMemo(() => {
    const allRoles = mainData.flatMap((data) => {
      const rolesString = data['Rol en la Revista'] || 'No especificado';
      return rolesString.split(';').map((role) => role.trim()).filter((role) => role && role !== 'Autor');
    });
    const uniqueRoles = [...new Set(allRoles)];
    return ['Todos', ...uniqueRoles.sort()];
  }, [mainData]);

  const filteredMembers = useMemo(() => {
    if (selectedRole === 'Todos') return mainData;
    return mainData.filter((data) => {
      const memberRoles = (data['Rol en la Revista'] || 'No especificado')
        .split(';')
        .map((role) => role.trim());
      return memberRoles.includes(selectedRole);
    });
  }, [mainData, selectedRole]);

  const displayedMembers = showAll ? filteredMembers : filteredMembers.slice(0, 15);

  const generateSlug = (name) => {
    if (!name) return '';
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  };

  const handleMemberClick = (memberName) => {
    if (!memberName) return;
    const slug = generateSlug(memberName);
    window.location.href = `/team/${slug}.html`;
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
      {/* Selector de Roles - Estilo Minimalista */}
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
      ) : csvError ? (
        <p className="text-red-600 text-sm sm:text-lg text-center">{csvError}</p>
      ) : filteredMembers.length === 0 ? (
        <p className="text-gray-600 text-sm sm:text-lg text-center">No se encontraron miembros para este rol.</p>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence>
            {displayedMembers.map((member) => (
              <motion.div
                layout
                key={member['Nombre']}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group p-6 border border-gray-100 hover:border-[#007398]/30 hover:shadow-2xl hover:shadow-gray-200/50 transition-all duration-500 bg-white relative overflow-hidden"
              >
                <div className="flex items-center space-x-5">
                  <div className="relative">
                    {member['Imagen'] && (
                      <div className="w-20 h-20 overflow-hidden border border-gray-100 p-1 group-hover:border-[#007398] transition-colors duration-500">
                        <img
                          src={member['Imagen']}
                          alt={member['Nombre']}
                          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3
                      onClick={() => handleMemberClick(member['Nombre'])}
                      className="text-lg font-serif text-gray-900 group-hover:text-[#007398] cursor-pointer transition-colors"
                    >
                      {member['Nombre']}
                    </h3>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(member['Rol en la Revista'] || '').split(';').map((role) => role.trim()).filter((role) => role && role !== 'Autor').map((role) => (
                        <span key={role} className="text-[9px] uppercase tracking-tighter bg-gray-50 text-gray-500 px-2 py-0.5 border border-gray-100 italic">
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
      {/* Ver más */}
      {filteredMembers.length > 15 && (
        <div className="text-center mt-12">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-[11px] uppercase tracking-[0.2em] font-bold text-gray-400 hover:text-[#007398] transition-colors"
          >
            {showAll ? "[ — Ver Menos ]" : "[ + Ver Todo el Personal ]"}
          </button>
        </div>
      )}
      {/* Sección de Asesores Académicos - Diseño de Alta Jerarquía */}
      {asesoresData.length > 0 && (
        <section className="mt-24 pt-16 border-t border-gray-100">
          <h2 className="text-2xl font-serif text-center mb-12 text-gray-800 tracking-tight">Consejo Superior de Asesoría</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {asesoresData.map((member) => (
              <div key={member['Nombre']} className="text-center p-6 border border-gray-50 bg-gray-50/30 cursor-pointer" onClick={() => handleMemberClick(member['Nombre'])}>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full overflow-hidden border-2 border-white shadow-sm">
                  {member['Imagen'] && (
                    <img
                      src={member['Imagen']}
                      className="w-full h-full object-cover grayscale"
                      alt={member['Nombre']}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                </div>
                <h4 className="text-md font-serif text-gray-900 hover:text-[#007398] transition-colors">{member['Nombre']}</h4>
                <p className="text-[10px] text-[#007398] uppercase mt-1 tracking-widest font-bold">Asesor Académico</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {/* Sección de Instituciones Colaboradoras */}
      {institutionsData.length > 0 && (
        <section className="mt-24 pt-16 border-t border-gray-100">
          <h2 className="text-2xl font-serif text-center mb-12 text-gray-800 tracking-tight">Instituciones Colaboradoras</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {institutionsData.map((member) => (
              <div key={member['Nombre']} className="text-center p-6 border border-gray-50 bg-gray-50/30">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden border-2 border-white shadow-sm">
                  {member['Imagen'] && (
                    <img
                      src={member['Imagen']}
                      className="w-full h-full object-contain"
                      alt={member['Nombre']}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                </div>
                <a
                  href={member['Correo']}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-md font-serif text-gray-900 hover:text-[#007398] transition-colors"
                >
                  {member['Nombre']}
                </a>
                <p className="text-[10px] text-[#007398] uppercase mt-1 tracking-widest font-bold">Institución Colaboradora</p>
              </div>
            ))}
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