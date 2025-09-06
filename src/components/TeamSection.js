// TeamSection actualizado
import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';

function TeamSection({ setActiveTab }) {
  const [authorsData, setAuthorsData] = useState([]);
  const [selectedRole, setSelectedRole] = useState('Todos');
  const [isLoading, setIsLoading] = useState(false);
  const [csvError, setCsvError] = useState(null);

  const csvUrl =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';

  // Cargar datos del CSV
  useEffect(() => {
    setIsLoading(true);
    setCsvError(null);
    Papa.parse(csvUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        // Filtrar aquí: excluir si el único rol es "Autor"
        const filtered = (result.data || []).filter((data) => {
          const memberRoles = (data['Rol en la Revista'] || '')
            .split(';')
            .map((role) => role.trim())
            .filter((role) => role);
          return !(memberRoles.length === 1 && memberRoles[0] === 'Autor');
        });

        setAuthorsData(filtered);
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

  // Extraer roles únicos (sin "Autor" puro)
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

  // Generar slug para el nombre
  const generateSlug = (name) => {
    if (!name) return '';
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  };

  // Manejar clic en un miembro: redirigir a página HTML
  const handleMemberClick = (memberName) => {
    if (!memberName) return;
    const slug = generateSlug(memberName);
    window.location.href = `/team/${slug}.html`;
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
            onClick: () => setActiveTab('admin'),
            'aria-label': 'Ir a la pestaña de Administración para postular',
          },
          'Administración'
        ),
        '.'
      )
    )
  );
}

export default TeamSection;