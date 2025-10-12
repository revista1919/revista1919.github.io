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

export default function TeamSection({ setActiveTab }) {
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
        const allData = (result.data || []).filter((data) => {
          const memberRoles = (data["Rol en la Revista"] || "")
            .split(";")
            .map((role) => role.trim())
            .filter((role) => role);
          return !(memberRoles.length === 1 && memberRoles[0] === "Autor");
        });

        const mappedData = allData.map((member) => ({
          ...member,
          nombre: member["Nombre"]?.trim() || "",
          roles: member["Rol en la Revista"] || "No especificado",
          slug: generateSlug(member["Nombre"]),
        }));

        const advisors = mappedData.filter((data) => {
          const roles = (data.roles || "").split(";").map((r) => r.trim());
          return roles.includes("Consejero Académico");
        });

        const institutions = mappedData.filter((data) => {
          const roles = (data.roles || "").split(";").map((r) => r.trim());
          return roles.includes("Institución Asociada");
        });

        const mainMembers = mappedData.filter((data) => {
          const roles = (data.roles || "").split(";").map((r) => r.trim());
          return !roles.includes("Consejero Académico") && !roles.includes("Institución Asociada");
        });

        setMainData(mainMembers);
        setAdvisorsData(advisors);
        setInstitutionsData(institutions);
        setIsLoading(false);
      },
      error: (error) => {
        console.error("Error loading CSV:", error);
        setCsvError("No se pudo cargar la información del equipo.");
        setMainData([]);
        setAdvisorsData([]);
        setInstitutionsData([]);
        setIsLoading(false);
      },
    });
  }, []);

  const roles = useMemo(() => {
    const allRoles = mainData.flatMap((data) => {
      const rolesString = data.roles || "No especificado";
      return rolesString.split(";").map((role) => role.trim()).filter((role) => role);
    });
    const uniqueRoles = [...new Set(allRoles)];
    return ["Todos", ...uniqueRoles.sort()];
  }, [mainData]);

  const filteredMembers = useMemo(() => {
    if (selectedRole === "Todos") return mainData;

    return mainData.filter((data) => {
      const memberRoles = (data.roles || "No especificado")
        .split(";")
        .map((role) => role.trim());
      return memberRoles.includes(selectedRole);
    });
  }, [mainData, selectedRole]);

  const displayedMembers = showAll ? filteredMembers : filteredMembers.slice(0, 15);

  const handleMemberClick = (memberSlug) => {
    if (!memberSlug) return;
    window.location.href = `/team/${memberSlug}.html`;
  };

  const formatRoles = (rolesString) => {
    return (rolesString || "No especificado")
      .split(";")
      .map((role) => role.trim())
      .filter((role) => role)
      .join(", ");
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
      className="container mx-auto px-6 py-8 bg-white"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.h1
        className="text-4xl font-bold text-gray-800 mb-6 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        Nuestro Equipo
      </motion.h1>
      <motion.p
        className="text-gray-600 text-lg mb-8 text-center max-w-2xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        Conoce al equipo que impulsa la Revista Nacional de las Ciencias para Estudiantes. Cada miembro aporta su pasión y expertise para promover la divulgación científica y apoyar a los estudiantes en su camino hacia la investigación.
      </motion.p>
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        {roles.map((role) => (
          <button
            key={role}
            className={`px-4 py-2 rounded-full text-base font-semibold transition-colors ${
              selectedRole === role
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-blue-100"
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            onClick={() => setSelectedRole(role)}
            aria-label={`Filtrar por rol ${role}`}
          >
            {role}
          </button>
        ))}
      </div>
      {isLoading ? (
        <p className="text-gray-600 text-lg text-center">Cargando...</p>
      ) : csvError ? (
        <p className="text-red-600 text-lg text-center">{csvError}</p>
      ) : (
        <div>
          {filteredMembers.length === 0 ? (
            <p className="text-gray-600 text-lg text-center">
              No se encontraron miembros para este rol.
            </p>
          ) : (
            <div>
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {displayedMembers.map((member) => (
                  <motion.div
                    key={member.nombre}
                    className="bg-gray-50 p-4 rounded-xl shadow-md hover:shadow-lg transition-shadow flex items-center space-x-4"
                    variants={itemVariants}
                    whileHover={{ scale: 1.02 }}
                  >
                    {member["Imagen"] && (
                      <img
                        src={member["Imagen"]}
                        alt={`Foto de ${member.nombre}`}
                        className="w-12 h-12 rounded-full object-cover"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    )}
                    <div>
                      <p
                        className="text-lg font-semibold text-blue-600 cursor-pointer hover:underline"
                        onClick={() => handleMemberClick(member.slug)}
                        aria-label={`Ver información sobre ${member.nombre}`}
                      >
                        {member.nombre}
                      </p>
                      <p className="text-gray-600 text-base">{formatRoles(member.roles)}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
              {filteredMembers.length > 15 && (
                <div className="text-center mt-4">
                  <button
                    className="px-4 py-2 rounded-full text-base font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={() => setShowAll(!showAll)}
                  >
                    {showAll ? "Mostrar menos" : "Mostrar más"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {advisorsData.length > 0 && (
        <div className="mt-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
            Nuestro Consejo Asesor Académico
          </h2>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {advisorsData.map((member) => (
              <motion.div
                key={member.nombre}
                className="bg-gray-50 p-4 rounded-xl shadow-md hover:shadow-lg transition-shadow flex items-center space-x-4"
                variants={itemVariants}
                whileHover={{ scale: 1.02 }}
              >
                {member["Imagen"] && (
                  <img
                    src={member["Imagen"]}
                    alt={`Foto de ${member.nombre}`}
                    className="w-12 h-12 rounded-full object-cover"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                )}
                <div>
                  <p
                    className="text-lg font-semibold text-blue-600 cursor-pointer hover:underline"
                    onClick={() => handleMemberClick(member.slug)}
                    aria-label={`Ver información sobre ${member.nombre}`}
                  >
                    {member.nombre}
                  </p>
                  <p className="text-gray-600 text-base">{formatRoles(member.roles)}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}
      {institutionsData.length > 0 && (
        <div className="mt-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
            Instituciones Asociadas
          </h2>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {institutionsData.map((member) => (
              <motion.div
                key={member.nombre}
                className="bg-gray-50 p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow flex items-center space-x-6"
                variants={itemVariants}
                whileHover={{ scale: 1.02 }}
              >
                {member["Imagen"] && (
                  <img
                    src={member["Imagen"]}
                    alt={`Logo de ${member.nombre}`}
                    className="w-20 h-20 rounded-full object-contain"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                )}
                <div>
                  <a
                    href={member["Correo"]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xl font-semibold text-blue-600 hover:underline"
                    aria-label={`Visitar sitio web de ${member.nombre}`}
                  >
                    {member.nombre}
                  </a>
                  <p className="text-gray-600 text-base">{formatRoles(member.roles)}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}
      <div className="mt-12 text-center">
        <p className="text-gray-600 text-lg mb-6">
          Nuestro equipo está en constante crecimiento, y tú podrías ser parte de él. Si compartes nuestra pasión por la ciencia y la educación, te invitamos a unirte. Envía tu postulación a través de la página{' '}
          <a
            className="text-blue-600 hover:underline font-semibold"
            href="https://www.revistacienciasestudiantes.com/admin"
            aria-label="Ir a la página de Postular a un cargo"
          >
            ¡Postula a algún cargo!
          </a>
          .
        </p>
      </div>
    </motion.div>
  );
}