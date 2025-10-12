import React, { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
import { motion } from 'framer-motion';

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv";

function generateSlug(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function TeamSectionEN({ setActiveTab }) {
  const [mainData, setMainData] = useState([]);
  const [advisorsData, setAdvisorsData] = useState([]);
  const [institutionsData, setInstitutionsData] = useState([]);
  const [selectedRole, setSelectedRole] = useState("All");
  const [isLoading, setIsLoading] = useState(false);
  const [csvError, setCsvError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setCsvError(null);
    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        // Filtrar aquí: excluir si el único rol es "Autor"
        const allData = (result.data || []).filter((data) => {
          const memberRoles = (data["Rol en la Revista"] || "")
            .split(";")
            .map((role) => role.trim())
            .filter((role) => role);
          return !(memberRoles.length === 1 && memberRoles[0] === "Autor");
        });

        // Mapear datos usando campos en inglés donde disponible
        const mappedData = allData.map((member) => ({
          ...member,
          nombre: member["Nombre"]?.trim() || "",
          roles: member["Role in the Journal"] || member["Rol en la Revista"] || "Not specified",
          slug: generateSlug(member["Nombre"]),
        }));

        // Separar datos especiales
        const advisors = mappedData.filter((data) => {
          const roles = (data.roles || "").split(";").map((r) => r.trim());
          return roles.includes("Academic Advisor");
        });

        const institutions = mappedData.filter((data) => {
          const roles = (data.roles || "").split(";").map((r) => r.trim());
          return roles.includes("Partner Institution");
        });

        const mainMembers = mappedData.filter((data) => {
          const roles = (data.roles || "").split(";").map((r) => r.trim());
          return !roles.includes("Academic Advisor") && !roles.includes("Partner Institution");
        });

        setMainData(mainMembers);
        setAdvisorsData(advisors);
        setInstitutionsData(institutions);
        setIsLoading(false);
      },
      error: (error) => {
        console.error("Error loading CSV:", error);
        setCsvError("Could not load team information.");
        setMainData([]);
        setAdvisorsData([]);
        setInstitutionsData([]);
        setIsLoading(false);
      },
    });
  }, []);

  // Extraer roles únicos (sin roles especiales)
  const roles = useMemo(() => {
    const allRoles = mainData.flatMap((data) => {
      const rolesString = data.roles || "Not specified";
      return rolesString.split(";").map((role) => role.trim()).filter((role) => role);
    });
    const uniqueRoles = [...new Set(allRoles)];
    return ["All", ...uniqueRoles.sort()];
  }, [mainData]);

  // Filtrar miembros por rol (solo main)
  const filteredMembers = useMemo(() => {
    if (selectedRole === "All") return mainData;

    return mainData.filter((data) => {
      const memberRoles = (data.roles || "Not specified")
        .split(";")
        .map((role) => role.trim());
      return memberRoles.includes(selectedRole);
    });
  }, [mainData, selectedRole]);

  // Miembros a mostrar en main (con límite)
  const displayedMembers = showAll ? filteredMembers : filteredMembers.slice(0, 15);

  const handleMemberClick = (memberSlug) => {
    if (!memberSlug) return;
    window.location.href = `/team/${memberSlug}.EN.html`;
  };

  const formatRoles = (rolesString) => {
    return (rolesString || "Not specified")
      .split(";")
      .map((role) => role.trim())
      .filter((role) => role)
      .join(", ");
  };

  // Variantes para animaciones
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, duration: 0.5, ease: 'easeOut' },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  const headerVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  const loadingVariants = {
    animate: { opacity: [1, 0.5, 1], transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } },
  };

  return (
    <motion.div
      className="container mx-auto px-4 sm:px-6 py-8 bg-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <motion.h1
        className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4 sm:mb-6 text-center"
        variants={headerVariants}
        initial="hidden"
        animate="visible"
      >
        Our Team
      </motion.h1>
      <motion.p
        className="text-gray-600 text-sm sm:text-lg mb-6 sm:mb-8 text-center max-w-2xl mx-auto"
        variants={headerVariants}
        initial="hidden"
        animate="visible"
      >
        Meet the team driving The National Review of Sciences for Students. Each member brings their passion and expertise to promote scientific outreach and support students on their research journey.
      </motion.p>
      <motion.div
        className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-6 sm:mb-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {roles.map((role) => (
          <motion.button
            key={role}
            className={`px-4 py-2 rounded-full text-sm sm:text-base font-semibold transition-colors ${
              selectedRole === role
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-blue-100"
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            onClick={() => setSelectedRole(role)}
            aria-label={`Filter by role ${role}`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300 }}
            variants={itemVariants}
          >
            {role}
          </motion.button>
        ))}
      </motion.div>
      {isLoading ? (
        <motion.p
          className="text-gray-600 text-sm sm:text-lg text-center"
          variants={loadingVariants}
          animate="animate"
        >
          Loading...
        </motion.p>
      ) : csvError ? (
        <p className="text-red-600 text-sm sm:text-lg text-center">{csvError}</p>
      ) : (
        <div>
          {filteredMembers.length === 0 ? (
            <p className="text-gray-600 text-sm sm:text-lg text-center">
              No members found for this role.
            </p>
          ) : (
            <div>
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {displayedMembers.map((member) => (
                  <motion.div
                    key={member.nombre}
                    className="bg-gray-50 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center space-x-4"
                    variants={itemVariants}
                    whileHover={{ scale: 1.02, boxShadow: '0px 5px 10px rgba(0,0,0,0.1)' }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  >
                    {member["Imagen"] && (
                      <motion.img
                        src={member["Imagen"]}
                        alt={`Photo of ${member.nombre}`}
                        className="w-12 h-12 rounded-full object-cover"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                      />
                    )}
                    <div>
                      <p
                        className="text-base sm:text-lg font-semibold text-blue-600 cursor-pointer hover:underline"
                        onClick={() => handleMemberClick(member.slug)}
                        aria-label={`View information about ${member.nombre}`}
                      >
                        {member.nombre}
                      </p>
                      <p className="text-gray-600 text-sm sm:text-base">{formatRoles(member.roles)}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
              {filteredMembers.length > 15 && (
                <div className="text-center mt-4">
                  <motion.button
                    className="px-4 py-2 rounded-full text-sm sm:text-base font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={() => setShowAll(!showAll)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    {showAll ? "Show less" : "Show more"}
                  </motion.button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {advisorsData.length > 0 && (
        <motion.div
          className="mt-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <motion.h2
            className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-6 text-center"
            variants={headerVariants}
            initial="hidden"
            animate="visible"
          >
            Our Academic Advisory Council
          </motion.h2>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {advisorsData.map((member) => (
              <motion.div
                key={member.nombre}
                className="bg-gray-50 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center space-x-4"
                variants={itemVariants}
                whileHover={{ scale: 1.02, boxShadow: '0px 5px 10px rgba(0,0,0,0.1)' }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                {member["Imagen"] && (
                  <motion.img
                    src={member["Imagen"]}
                    alt={`Photo of ${member.nombre}`}
                    className="w-12 h-12 rounded-full object-cover"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                  />
                )}
                <div>
                  <p
                    className="text-base sm:text-lg font-semibold text-blue-600 cursor-pointer hover:underline"
                    onClick={() => handleMemberClick(member.slug)}
                    aria-label={`View information about ${member.nombre}`}
                  >
                    {member.nombre}
                  </p>
                  <p className="text-gray-600 text-sm sm:text-base">{formatRoles(member.roles)}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}
      {institutionsData.length > 0 && (
        <motion.div
          className="mt-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <motion.h2
            className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-6 text-center"
            variants={headerVariants}
            initial="hidden"
            animate="visible"
          >
            Partner Institutions
          </motion.h2>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {institutionsData.map((member) => (
              <motion.div
                key={member.nombre}
                className="bg-gray-50 p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center space-x-6"
                variants={itemVariants}
                whileHover={{ scale: 1.02, boxShadow: '0px 5px 10px rgba(0,0,0,0.1)' }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                {member["Imagen"] && (
                  <motion.img
                    src={member["Imagen"]}
                    alt={`Logo of ${member.nombre}`}
                    className="w-20 h-20 rounded-full object-contain"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                    initial={{ opacity: 0, rotate: -10 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    transition={{ duration: 0.5 }}
                  />
                )}
                <div>
                  <a
                    href={member["Correo"]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg sm:text-xl font-semibold text-blue-600 hover:underline"
                    aria-label={`Visit website of ${member.nombre}`}
                  >
                    {member.nombre}
                  </a>
                  <p className="text-gray-600 text-sm sm:text-base">{formatRoles(member.roles)}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}
      <motion.div
        className="mt-8 sm:mt-12 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <p className="text-gray-600 text-sm sm:text-lg mb-4 sm:mb-6">
          Our team is constantly growing, and you could be part of it. If you share our passion for science and education, we invite you to join us. Submit your application through the{" "}
          <a
            className="text-blue-600 hover:underline font-semibold"
            href="https://www.revistacienciasestudiantes.com/en/admin"
            aria-label="Go to Apply for a position page to apply"
          >
            Apply for a Position!
          </a>{" "}
          page.
        </p>
      </motion.div>
    </motion.div>
  );
}