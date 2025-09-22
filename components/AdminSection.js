'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export default function AdminSection() {
  const t = useTranslations();
  const [selectedRole, setSelectedRole] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const roles = [
    {
      name: t('roles.founder.name'),
      description: t('roles.founder.description'),
      isPostulable: false,
    },
    {
      name: t('roles.cofounder.name'),
      description: t('roles.cofounder.description'),
      isPostulable: false,
    },
    {
      name: t('roles.director.name'),
      description: t('roles.director.description'),
      isPostulable: false,
    },
    {
      name: t('roles.deputyDirector.name'),
      description: t('roles.deputyDirector.description'),
      isPostulable: false,
    },
    {
      name: t('roles.chiefEditor.name'),
      description: t('roles.chiefEditor.description'),
      isPostulable: true,
    },
    {
      name: t('roles.sectionEditor.name'),
      description: t('roles.sectionEditor.description'),
      isPostulable: true,
    },
    {
      name: t('roles.reviewer.name'),
      description: t('roles.reviewer.description'),
      isPostulable: true,
    },
    {
      name: t('roles.webDeveloper.name'),
      description: t('roles.webDeveloper.description'),
      isPostulable: false,
    },
    {
      name: t('roles.techSupport.name'),
      description: t('roles.techSupport.description'),
      isPostulable: true,
    },
    {
      name: t('roles.socialMedia.name'),
      description: t('roles.socialMedia.description'),
      isPostulable: false,
    },
    {
      name: t('roles.graphicDesigner.name'),
      description: t('roles.graphicDesigner.description'),
      isPostulable: true,
    },
    {
      name: t('roles.communityManager.name'),
      description: t('roles.communityManager.description'),
      isPostulable: true,
    },
    {
      name: t('roles.newCollaborators.name'),
      description: t('roles.newCollaborators.description'),
      isPostulable: true,
    },
    {
      name: t('roles.eventCoordinator.name'),
      description: t('roles.eventCoordinator.description'),
      isPostulable: true,
    },
    {
      name: t('roles.legalAdvisor.name'),
      description: t('roles.legalAdvisor.description'),
      isPostulable: true,
    },
    {
      name: t('roles.financeManager.name'),
      description: t('roles.financeManager.description'),
      isPostulable: true,
    },
  ];

  const handleRoleClick = (role) => {
    setSelectedRole(role);
    setIsModalOpen(true);
  };

  const handlePostulateClick = () => {
    window.open('https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform', '_blank');
    setIsModalOpen(false);
  };

  return (
    <div className="admin-section bg-white p-3 sm:p-6 rounded-lg shadow-md mt-3 sm:mt-6">
      <h2 className="text-lg sm:text-2xl font-semibold mb-3 sm:mb-4 text-gray-800 text-center">
        {t('joinTeam')}
      </h2>
      <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-6 text-center max-w-2xl mx-auto">
        {t('joinDesc')}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 mb-3 sm:mb-8">
        {roles.map((role) => (
          <div
            key={role.name}
            className={`p-3 sm:p-4 rounded-lg shadow-sm transition-shadow ${
              role.isPostulable ? 'bg-green-50 hover:shadow-md' : 'bg-gray-100 cursor-not-allowed'
            }`}
          >
            <p
              className={`text-sm sm:text-lg font-semibold ${
                role.isPostulable ? 'text-green-600 cursor-pointer hover:underline' : 'text-gray-500'
              }`}
              onClick={role.isPostulable ? () => handleRoleClick(role) : null}
              aria-label={t('roleDescriptionAria', { roleName: role.name })}
            >
              {role.name}
            </p>
            <p className="text-xs sm:text-base text-gray-600">
              {role.isPostulable ? t('cargoPostulable') : t('cargoDefinido')}
            </p>
            {role.isPostulable && (
              <button
                className="mt-2 bg-green-500 text-white px-3 py-2 rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-h-10 sm:text-base"
                onClick={handlePostulateClick}
                aria-label={t('applyToRoleAria', { roleName: role.name })}
              >
                {t('postular')}
              </button>
            )}
          </div>
        ))}
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-3 sm:p-6 rounded-lg max-w-[90vw] sm:max-w-lg max-h-[90vh] overflow-y-auto mx-2 shadow-lg">
            <div className="flex justify-between items-center mb-2 sm:mb-4 border-b border-gray-200 pb-2">
              <h3 className="text-sm sm:text-xl font-bold text-gray-800">{selectedRole.name}</h3>
              <button
                className="text-gray-500 hover:text-gray-700 text-lg sm:text-xl focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full w-8 h-8 flex items-center justify-center"
                onClick={() => setIsModalOpen(false)}
                aria-label={t('closeRoleModalAria')}
              >
                ×
              </button>
            </div>
            <div className="text-gray-700 text-sm sm:text-base">
              <p className="font-semibold text-blue-600 mb-2">{t('description')}</p>
              <p className="text-gray-600 mb-3 sm:mb-4">{selectedRole.description}</p>
              <p className="text-gray-600">
                {selectedRole.isPostulable ? t('roleOpenToApplications') : t('roleNotOpenToApplications')}
              </p>
              {selectedRole.isPostulable && (
                <button
                  className="mt-3 sm:mt-4 bg-green-500 text-white px-3 sm:px-4 py-2 rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm min-h-10 sm:text-base"
                  onClick={handlePostulateClick}
                  aria-label={t('applyToRoleAria', { roleName: selectedRole.name })}
                >
                  {t('postulateNow')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}