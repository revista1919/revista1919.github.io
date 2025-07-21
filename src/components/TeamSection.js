import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';

function TeamSection() {
  const [authorsData, setAuthorsData] = useState([]);
  const [selectedRole, setSelectedRole] = useState('Todos');
  const [isLoading, setIsLoading] = useState(false);
  const [csvError, setCsvError] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);

  const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';

  // Cargar datos del CSV
  useEffect(() => {
    setIsLoading(true);
    setCsvError(null);
    Papa.parse(csvUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setAuthorsData(result.data || []);
        setIsLoading(false);
      },
      error: (error) => {
        console.error('Error al cargar el CSV:', error);
        setCsvError('No se pudo cargar la información del equipo.');
        setAuthorsData([]);
        setIsLoading(false);
      },
    });
  }, []);

  // Extraer roles únicos
  const roles = useMemo(() => {
    const allRoles = authorsData.flatMap((data) => {
      const rolesString = data['Rol en la Revista'] || 'No especificado';
      return rolesString.split(';').map((role) => role.trim()).filter((role) => role);
    });
    const uniqueRoles = [...new Set(allRoles)];
    return ['Todos', ...uniqueRoles.sort()];
  }, [authorsData]);

  // Filtrar miembros por rol
  const filteredMembers = useMemo(() => {
    if (selectedRole === 'Todos') return authorsData;
    return authorsData.filter((data) => {
      const memberRoles = (data['Rol en la Revista'] || 'No especificado')
        .split(';')
        .map((role) => role.trim());
      return memberRoles.includes(selectedRole);
    });
  }, [authorsData, selectedRole]);

  // Manejar clic en un miembro
  const handleMemberClick = (memberName) => {
    if (!memberName) return;
    setIsLoading(true);
    const member = authorsData.find((data) => data['Nombre'] === memberName) || {
      Nombre: memberName,
      Descripción: 'Información no disponible',
      'Áreas de interés': 'No especificadas',
      'Rol en la Revista': 'No especificado',
    };
    setSelectedMember(member);
    setIsMemberModalOpen(true);
    setIsLoading(false);
  };

  return React.createElement(
    'div',
    { className: 'container mx-auto px-4 sm:px-6 py-8 bg-white' },
    // Encabezado
    React.createElement(
      'h1',
      { className: 'text-3xl sm:text-4xl font-bold text-gray-800 mb-4 sm:mb-6 text-center' },
      'Nuestro Equipo'
    ),
    React.createElement(
      'p',
      { className: 'text-gray-600 text-sm sm:text-lg mb-6 sm:mb-8 text-center max-w-2xl mx-auto' },
      'Conoce al equipo que impulsa la Revista Nacional de las Ciencias para Estudiantes. Cada miembro aporta su pasión y experiencia para fomentar la divulgación científica y apoyar a los estudiantes en su camino hacia la investigación.'
    ),
    // Botones de filtro
    React.createElement(
      'div',
      { className: 'flex flex-wrap justify-center gap-2 sm:gap-4 mb-6 sm:mb-8' },
      roles.map((role) =>
        React.createElement(
          'button',
          {
            key: role,
            className: `px-4 py-2 rounded-full text-sm sm:text-base font-semibold transition-colors ${
              selectedRole === role
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-blue-100'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`,
            onClick: () => setSelectedRole(role),
            'aria-label': `Filtrar por rol ${role}`,
          },
          role
        )
      )
    ),
    // Lista de miembros
    isLoading
      ? React.createElement('p', { className: 'text-gray-600 text-sm sm:text-lg text-center' }, 'Cargando...')
      : csvError
        ? React.createElement('p', { className: 'text-red-600 text-sm sm:text-lg text-center' }, csvError)
        : filteredMembers.length === 0
          ? React.createElement(
              'p',
              { className: 'text-gray-600 text-sm sm:text-lg text-center' },
              'No se encontraron miembros para este rol.'
            )
          : React.createElement(
              'div',
              { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6' },
              filteredMembers.map((member) =>
                React.createElement(
                  'div',
                  {
                    key: member['Nombre'],
                    className: 'bg-gray-50 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow',
                  },
                  React.createElement(
                    'p',
                    {
                      className: 'text-base sm:text-lg font-semibold text-blue-600 cursor-pointer hover:underline',
                      onClick: () => handleMemberClick(member['Nombre']),
                      'aria-label': `Ver información de ${member['Nombre']}`,
                    },
                    member['Nombre']
                  ),
                  React.createElement(
                    'p',
                    { className: 'text-gray-600 text-sm sm:text-base' },
                    member['Rol en la Revista'] || 'No especificado'
                  )
                )
              )
            ),
    // Mensaje de postulación
    React.createElement(
      'div',
      { className: 'mt-8 sm:mt-12 text-center' },
      React.createElement(
        'p',
        { className: 'text-gray-600 text-sm sm:text-lg mb-4 sm:mb-6' },
        'Nuestro equipo está en constante crecimiento, y tú puedes ser parte de él. Si compartes nuestra pasión por la ciencia y la educación, te invitamos a unirte. Envía tu candidatura a través de la pestaña ',
        React.createElement(
          'span',
          {
            className: 'text-blue-600 hover:underline font-semibold cursor-pointer',
            onClick: () => window.location.href = '#admin',
            'aria-label': 'Ir a la pestaña de Administración para postular',
          },
          'Administración'
        ),
        '.'
      )
    ),
    // Modal para información del miembro
    isMemberModalOpen &&
      React.createElement(
        'div',
        { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50' },
        React.createElement(
          'div',
          { className: 'bg-white p-4 sm:p-8 rounded-lg max-w-[90vw] sm:max-w-lg max-h-[90vh] overflow-y-auto mx-2 shadow-lg' },
          isLoading
            ? React.createElement('p', { className: 'text-gray-600 text-sm sm:text-lg' }, 'Cargando...')
            : React.createElement(
                'div',
                null,
                React.createElement(
                  'div',
                  { className: 'flex justify-between items-center mb-4 sm:mb-5 border-b border-gray-200 pb-2' },
                  React.createElement(
                    'h2',
                    { className: 'text-lg sm:text-xl font-bold text-gray-800' },
                    selectedMember['Nombre'] || 'Miembro desconocido'
                  ),
                  React.createElement(
                    'button',
                    {
                      className: 'text-gray-500 hover:text-gray-700 text-xl focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full w-8 h-8 flex items-center justify-center',
                      onClick: () => setIsMemberModalOpen(false),
                      'aria-label': 'Cerrar modal de miembro',
                    },
                    '×'
                  )
                ),
                React.createElement(
                  'div',
                  { className: 'text-gray-700 text-sm sm:text-lg space-y-4 sm:space-y-5' },
                  React.createElement(
                    'div',
                    null,
                    React.createElement('p', { className: 'font-semibold text-blue-600' }, 'Descripción:'),
                    React.createElement('p', { className: 'text-gray-600' }, selectedMember['Descripción'] || 'Información no disponible')
                  ),
                  React.createElement(
                    'div',
                    null,
                    React.createElement('p', { className: 'font-semibold text-blue-600' }, 'Áreas de interés:'),
                    React.createElement('p', { className: 'text-gray-600' }, selectedMember['Áreas de interés'] || 'No especificadas')
                  ),
                  React.createElement(
                    'div',
                    null,
                    React.createElement('p', { className: 'font-semibold text-blue-600' }, 'Rol en la Revista:'),
                    React.createElement(
                      'p',
                      { className: 'text-gray-600' },
                      (selectedMember['Rol en la Revista'] || 'No especificado')
                        .split(';')
                        .map((role) => role.trim())
                        .filter((role) => role)
                        .join(', ') || 'No especificado'
                    )
                  )
                )
              )
        )
      )
  );
}

export default TeamSection;