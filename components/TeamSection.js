'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { useTranslations } from 'next-intl';

export default function TeamSection({ setActiveTab }) {
  const t = useTranslations('TeamSection');
  const [authorsData, setAuthorsData] = useState([]);
  const [selectedRole, setSelectedRole] = useState('Todos');
  const [isLoading, setIsLoading] = useState(false);
  const [csvError, setCsvError] = useState(null);

  const csvUrl = process.env.NEXT_PUBLIC_TEAM_CSV_URL || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';

  useEffect(() => {
    setIsLoading(true);
    setCsvError(null);
    Papa.parse(csvUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
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
        setCsvError(t('errors.csvError'));
        setAuthorsData([]);
        setIsLoading(false);
      },
    });
  }, [t]);

  const roles = useMemo(() => {
    const allRoles = authorsData.flatMap((data) => {
      const rolesString = data['Rol en la Revista'] || t('noRole');
      return rolesString.split(';').map((role) => role.trim()).filter((role) => role);
    });
    const uniqueRoles = [...new Set(allRoles)];
    return [t('allRoles'), ...uniqueRoles.sort()];
  }, [authorsData, t]);

  const filteredMembers = useMemo(() => {
    if (selectedRole === t('allRoles')) return authorsData;
    return authorsData.filter((data) => {
      const memberRoles = (data['Rol en la Revista'] || t('noRole'))
        .split(';')
        .map((role) => role.trim());
      return memberRoles.includes(selectedRole);
    });
  }, [authorsData, selectedRole, t]);

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
    window.location.href = `/team/${slug}`;
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 bg-white">
      <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4 sm:mb-6 text-center">{t('title')}</h1>
      <p className="text-gray-600 text-sm sm:text-lg mb-6 sm:mb-8 text-center max-w-2xl mx-auto">{t('description')}</p>
      <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-6 sm:mb-8">
        {roles.map((role) => (
          <button
            key={role}
            className={`px-4 py-2 rounded-full text-sm sm:text-base font-semibold transition-colors ${
              selectedRole === role
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-blue-100'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            onClick={() => setSelectedRole(role)}
            aria-label={t('filterByRole', { role })}
          >
            {role}
          </button>
        ))}
      </div>
      {isLoading ? (
        <p className="text-gray-600 text-sm sm:text-lg text-center">{t('loading')}</p>
      ) : csvError ? (
        <p className="text-red-600 text-sm sm:text-lg text-center">{csvError}</p>
      ) : filteredMembers.length === 0 ? (
        <p className="text-gray-600 text-sm sm:text-lg text-center">{t('noMembers')}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredMembers.map((member) => (
            <div
              key={member['Nombre']}
              className="bg-gray-50 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <p
                className="text-base sm:text-lg font-semibold text-blue-600 cursor-pointer hover:underline"
                onClick={() => handleMemberClick(member['Nombre'])}
                aria-label={t('viewMemberInfo', { name: member['Nombre'] })}
              >
                {member['Nombre']}
              </p>
              <p className="text-gray-600 text-sm sm:text-base">{member['Rol en la Revista'] || t('noRole')}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-8 sm:mt-12 text-center">
        <p className="text-gray-600 text-sm sm:text-lg mb-4 sm:mb-6">
          {t('joinTeamText')}
          <span
            className="text-blue-600 hover:underline font-semibold cursor-pointer"
            onClick={() => setActiveTab('admin')}
            aria-label={t('goToAdminTab')}
          >
            {t('adminTab')}
          </span>
          {t('joinTeamTextEnd')}
        </p>
      </div>
    </div>
  );
}