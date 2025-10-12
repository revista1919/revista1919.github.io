import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

function AdminSection() {
  const [selectedRole, setSelectedRole] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const roles = [
    {
      name: 'Founder',
      description: 'Person who started the project, defining its vision and initial goals. Oversees the strategic direction of the journal.',
      isPostulable: false,
    },
    {
      name: 'Co-Founder',
      description: 'Key collaborator in the project’s foundation, supporting the Founder in strategic decision-making.',
      isPostulable: false,
    },
    {
      name: 'General Director',
      description: 'Responsible for the overall vision, team coordination, external relations, and global oversight of the journal.',
      isPostulable: false,
    },
    {
      name: 'Deputy General Director',
      description: 'Assists the General Director in strategic decisions and assumes leadership in their absence.',
      isPostulable: false,
    },
    {
      name: 'Editor-in-Chief',
      description: 'Oversees all content and coordinates the editorial team. Ensures the quality of articles. Receives, organizes, and channels article submissions to reviewers.',
      isPostulable: true,
    },
    {
      name: 'Section Editor',
      description: 'Reviews and edits texts for a specific section (e.g., Opinion, Culture, News). Votes on whether to publish a work. Primarily applies corrections made by reviewers. Communicates with authors to request information and provide feedback.',
      isPostulable: true,
    },
    {
      name: 'Reviewer / Editorial Committee',
      description: 'Corrects style, spelling, and coherence of articles. Reviewers may also verify sources, assess their quality, and evaluate content. Provides feedback to authors and votes on whether to publish an article.',
      isPostulable: true,
    },
    {
      name: 'Web Development Manager',
      description: 'Manages the website, fixes technical issues, and implements design and functionality improvements.',
      isPostulable: false,
    },
    {
      name: 'Technical Support Manager',
      description: 'Resolves technical issues related to content uploads, forms, and emails.',
      isPostulable: true,
      
    },
    {
      name: 'Article Assignment Manager',
      description: 'Receives, organizes, and channels article submissions to reviewers and editors.',
      isPostulable: true,
    },
    {
      name: 'Social Media Manager',
      description: 'Manages social media platforms (Instagram, X, TikTok, etc.), publishes content, and promotes the journal.',
      isPostulable: false,
    },
    {
      name: 'Graphic Designer',
      description: 'Creates visual materials such as posters, covers, and templates for social media.',
      isPostulable: true,
    },
    {
      name: 'Community Manager',
      description: 'Interacts with the community, responds to messages, and encourages participation on the journal’s platforms.',
      isPostulable: true,
    },
    {
      name: 'New Collaborators Manager',
      description: 'Guides new applicants for administrative, reviewer, or editor roles.',
      isPostulable: true,
    },
    {
      name: 'Events or Calls Coordinator',
      description: 'Organizes talks, debates, contests, or other activities to promote the journal.',
      isPostulable: true,
    },
    {
      name: 'Editorial/Legal Advisor',
      description: 'Reviews legal terms, editorial standards, and copyright matters for the journal (NOT NECESSARY AT THE MOMENT).',
      isPostulable: true,
    },
    {
      name: 'Finance/Transparency Manager',
      description: 'Manages donations or budgets, ensuring transparency in finances (NOT NECESSARY AT THE MOMENT).',
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
      className="admin-section bg-white p-6 rounded-xl shadow-lg mt-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.h2
        className="text-2xl font-bold mb-4 text-gray-800 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        Join our team
      </motion.h2>
      <motion.p
        className="text-base text-gray-600 mb-6 text-center max-w-2xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        Be part of the National Review of Sciences for Students. Contribute your talent to scientific dissemination and support students on their path to research. Select a role to learn about its functions or apply for available positions. You can review the application policies at{' '}
        <a
          href="https://www.revistacienciasestudiantes.com/policiesAppEN.html"
          className="text-blue-600 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View application policies"
        >
          our application policies
        </a>
        .
      </motion.p>
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {roles.map((role) => (
          <motion.div
            key={role.name}
            className={`p-4 rounded-xl shadow-md transition-shadow hover:shadow-lg ${
              role.isPostulable ? 'bg-blue-50' : 'bg-gray-100 cursor-not-allowed'
            }`}
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
          >
            <p
              className={`text-lg font-semibold ${
                role.isPostulable ? 'text-blue-600 cursor-pointer hover:underline' : 'text-gray-500'
              }`}
              onClick={role.isPostulable ? () => handleRoleClick(role) : null}
              aria-label={`View description of the role ${role.name}`}
            >
              {role.name}
            </p>
            <p className="text-base text-gray-600">
              {role.isPostulable ? 'Position open for applications' : 'Position defined'}
            </p>
            {role.isPostulable && (
              <button
                className="mt-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                onClick={handlePostulateClick}
                aria-label={`Apply for the role ${role.name}`}
              >
                Apply
              </button>
            )}
          </motion.div>
        ))}
      </motion.div>
      {isModalOpen && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white p-6 rounded-xl max-w-lg max-h-[90vh] overflow-y-auto mx-4 shadow-xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-2">
              <h3 className="text-xl font-bold text-gray-800">{selectedRole.name}</h3>
              <button
                className="text-gray-500 hover:text-gray-700 text-xl focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full w-8 h-8 flex items-center justify-center"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close role description modal"
              >
                ×
              </button>
            </div>
            <div className="text-gray-700 text-base">
              <p className="font-semibold text-blue-600 mb-2">Description:</p>
              <p className="text-gray-600 mb-4">{selectedRole.description}</p>
              <p className="text-gray-600">
                {selectedRole.isPostulable ? 'This position is open for applications.' : 'This position is defined and does not accept applications.'}
              </p>
              {selectedRole.isPostulable && (
                <button
                  className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                  onClick={handlePostulateClick}
                  aria-label={`Apply for the role ${selectedRole.name}`}
                >
                  Apply now
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default AdminSection;