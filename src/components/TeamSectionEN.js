import React, { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv";
const DOMAIN = "https://www.revistacienciasestudiantes.com";

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
  const [authorsData, setAuthorsData] = useState([]);
  const [selectedRole, setSelectedRole] = useState("All");
  const [isLoading, setIsLoading] = useState(false);
  const [csvError, setCsvError] = useState(null);

  useEffect(() => {
    setIsLoading(true);
    setCsvError(null);
    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        const filtered = (result.data || []).filter((data) => {
          const memberRoles = (data["Rol en la Revista"] || "")
            .split(";")
            .map((role) => role.trim())
            .filter((role) => role);
          return !(memberRoles.length === 1 && memberRoles[0] === "Autor");
        });

        const enrichedData = await Promise.all(
          filtered.map(async (member) => {
            const spanishName = member["Nombre"]?.trim() || "";
            const slug = generateSlug(spanishName);
            const htmlUrl = `${DOMAIN}/team/${slug}.EN.html`;
            let name = spanishName; // Fallback to Spanish name
            let roles = member["Rol en la Revista"] || "Not specified"; // Fallback to CSV roles
            try {
              const response = await fetch(htmlUrl);
              if (!response.ok) throw new Error(`Failed to fetch HTML: ${htmlUrl}`);
              const htmlText = await response.text();
              const parser = new DOMParser();
              const doc = parser.parseFromString(htmlText, "text/html");
              const nameElement = doc.querySelector("h1");
              const roleElement = doc.querySelector(".role");
              name = nameElement ? nameElement.textContent : spanishName;
              roles = roleElement ? roleElement.textContent : roles;
            } catch (err) {
              console.error(`Error fetching HTML for ${slug}:`, err);
            }
            return {
              ...member,
              nombre: name,
              roles,
              slug,
            };
          })
        );

        setAuthorsData(enrichedData);
        setIsLoading(false);
      },
      error: (error) => {
        console.error("Error loading CSV:", error);
        setCsvError("Could not load team information.");
        setAuthorsData([]);
        setIsLoading(false);
      },
    });
  }, []);

  const roles = useMemo(() => {
    const allRoles = authorsData.flatMap((data) => {
      const rolesString = data.roles || "Not specified";
      return rolesString.split(",").map((role) => role.trim()).filter((role) => role);
    });
    const uniqueRoles = [...new Set(allRoles)];
    return ["All", ...uniqueRoles.sort()];
  }, [authorsData]);

  const filteredMembers = useMemo(() => {
    if (selectedRole === "All") return authorsData;

    return authorsData.filter((data) => {
      const memberRoles = (data.roles || "Not specified")
        .split(",")
        .map((role) => role.trim());
      return memberRoles.includes(selectedRole);
    });
  }, [authorsData, selectedRole]);

  const handleMemberClick = (memberSlug) => {
    if (!memberSlug) return;
    window.location.href = `/team/${memberSlug}.EN.html`;
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 bg-white">
      <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4 sm:mb-6 text-center">
        Our Team
      </h1>
      <p className="text-gray-600 text-sm sm:text-lg mb-6 sm:mb-8 text-center max-w-2xl mx-auto">
        Meet the team driving The National Review of Sciences for Students. Each member brings their passion and expertise to promote scientific outreach and support students on their research journey.
      </p>
      <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-6 sm:mb-8">
        {roles.map((role) => (
          <button
            key={role}
            className={`px-4 py-2 rounded-full text-sm sm:text-base font-semibold transition-colors ${
              selectedRole === role
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-blue-100"
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            onClick={() => setSelectedRole(role)}
            aria-label={`Filter by role ${role}`}
          >
            {role}
          </button>
        ))}
      </div>
      {isLoading ? (
        <p className="text-gray-600 text-sm sm:text-lg text-center">Loading...</p>
      ) : csvError ? (
        <p className="text-red-600 text-sm sm:text-lg text-center">{csvError}</p>
      ) : filteredMembers.length === 0 ? (
        <p className="text-gray-600 text-sm sm:text-lg text-center">
          No members found for this role.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredMembers.map((member) => (
            <div
              key={member.nombre}
              className="bg-gray-50 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <p
                className="text-base sm:text-lg font-semibold text-blue-600 cursor-pointer hover:underline"
                onClick={() => handleMemberClick(member.slug)}
                aria-label={`View information about ${member.nombre}`}
              >
                {member.nombre}
              </p>
              <p className="text-gray-600 text-sm sm:text-base">{member.roles}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-8 sm:mt-12 text-center">
        <p className="text-gray-600 text-sm sm:text-lg mb-4 sm:mb-6">
          Our team is constantly growing, and you could be part of it. If you share our passion for science and education, we invite you to join us. Submit your application through the{" "}
          <span
            className="text-blue-600 hover:underline font-semibold cursor-pointer"
            onClick={() => setActiveTab("admin")}
            aria-label="Go to Administration tab to apply"
          >
            Administration
          </span>{" "}
          tab.
        </p>
      </div>
    </div>
  );
}