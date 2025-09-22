import { useTranslation } from 'react-i18next';
import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';

function TeamSectionEN({ setActiveTab }) {
  const [authorsData, setAuthorsData] = useState([]);
  const [selectedRole, setSelectedRole] = useState('All');
  const [isLoading, setIsLoading] = useState(false);
  const [csvError, setCsvError] = useState(null);

  const csvUrl =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';

  // Load CSV data
  useEffect(() => {
    setIsLoading(true);
    setCsvError(null);
    Papa.parse(csvUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        // Filter here: exclude if the only role is "Author"
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
        console.error('Error loading CSV:', error);
        setCsvError('Could not load team information.');
        setAuthorsData([]);
        setIsLoading(false);
      },
    });
  }, []);

  // Extract unique roles (without pure "Author")
  const roles = useMemo(() => {
    const allRoles = authorsData.flatMap((data) => {
      const rolesString = data['Rol en la Revista'] || 'Not specified';
      return rolesString.split(';').map((role) => role.trim()).filter((role) => role);
    });
    const uniqueRoles = [...new Set(allRoles)];
    return ['All', ...uniqueRoles.sort()];
  }, [authorsData]);

  // Filter members by role
  const filteredMembers = useMemo(() => {
    if (selectedRole === 'All') return authorsData;

    return authorsData.filter((data) => {
      const memberRoles = (data['Rol en la Revista'] || 'Not specified')
        .split(';')
        .map((role) => role.trim());
      return memberRoles.includes(selectedRole);
    });
  }, [authorsData, selectedRole]);

  // Generate slug for name
  const generateSlug = (name) => {
    if (!name) return '';
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  };

  // Handle member click: redirect to English HTML page
  const handleMemberClick = (memberName) => {
    if (!memberName) return;
    const slug = generateSlug(memberName);
    window.location.href = `/team/${slug}.EN.html`;
  };

  return React.createElement(
    'div',
    { className: 'container mx-auto px-4 sm:px-6 py-8 bg-white' },
    // Header
    React.createElement(
      'h1',
      { className: 'text-3xl sm:text-4xl font-bold text-gray-800 mb-4 sm:mb-6 text-center' },
      'Our Team'
    ),
    React.createElement(
      'p',
      { className: 'text-gray-600 text-sm sm:text-lg mb-6 sm:mb-8 text-center max-w-2xl mx-auto' },
      'Meet the team driving The National Review of Sciences for Students. Each member brings their passion and expertise to promote scientific outreach and support students on their research journey.'
    ),
    // Filter buttons
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
            'aria-label': `Filter by role ${role}`,
          },
          role
        )
      )
    ),
    // Members list
    isLoading
      ? React.createElement('p', { className: 'text-gray-600 text-sm sm:text-lg text-center' }, 'Loading...')
      : csvError
      ? React.createElement('p', { className: 'text-red-600 text-sm sm:text-lg text-center' }, csvError)
      : filteredMembers.length === 0
      ? React.createElement(
          'p',
          { className: 'text-gray-600 text-sm sm:text-lg text-center' },
          'No members found for this role.'
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
                  'aria-label': `View information about ${member['Nombre']}`,
                },
                member['Nombre']
              ),
              React.createElement(
                'p',
                { className: 'text-gray-600 text-sm sm:text-base' },
                member['Rol en la Revista'] || 'Not specified'
              )
            )
          )
        ),
    // Application message
    React.createElement(
      'div',
      { className: 'mt-8 sm:mt-12 text-center' },
      React.createElement(
        'p',
        { className: 'text-gray-600 text-sm sm:text-lg mb-4 sm:mb-6' },
        'Our team is constantly growing, and you could be part of it. If you share our passion for science and education, we invite you to join us. Submit your application through the ',
        React.createElement(
          'span',
          {
            className: 'text-blue-600 hover:underline font-semibold cursor-pointer',
            onClick: () => setActiveTab('admin'),
            'aria-label': 'Go to Administration tab to apply',
          },
          'Administration'
        ),
        ' tab.'
      )
    )
  );
}

export default TeamSectionEN;