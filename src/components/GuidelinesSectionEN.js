import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

function GuidelinesSection() {
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
      className="guidelines-section bg-white p-6 rounded-xl shadow-lg mt-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.h2
        className="text-2xl font-bold mb-4 text-gray-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        Editorial Guidelines
      </motion.h2>
      <motion.ul
        className="list-disc pl-5 text-base"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.li variants={itemVariants} className="mb-3">Length: 1,000–10,000 words (tables do not count as words)</motion.li>
        <motion.li variants={itemVariants} className="mb-3">Format: Word (.docx), without the author’s name in the document</motion.li>
        <motion.li variants={itemVariants} className="mb-3">Originality: The article must be unpublished, not submitted elsewhere, and cannot use AI for writing</motion.li>
        <motion.li variants={itemVariants} className="mb-3">
          Citation: Exclusively{' '}
          <a
            href="https://www.chicagomanualofstyle.org/tools_citationguide.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Chicago style
          </a>
        </motion.li>
        <motion.li variants={itemVariants} className="mb-3">We accept articles in Spanish and English</motion.li>
        <motion.li variants={itemVariants} className="mb-3">Permitted elements: Graphs, equations, images, tables (not counted in word count)</motion.li>
        <motion.li variants={itemVariants} className="mb-3">
          Article Submission Policies: See the full policies{' '}
          <a
            href="https://www.revistacienciasestudiantes.com/policiesEN.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            here
          </a>
        </motion.li>
      </motion.ul>
      <motion.h3
        className="text-xl font-bold mt-6 mb-3 text-gray-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        To learn how to write a scientific article, we recommend the following videos:
      </motion.h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <iframe
          width="100%"
          height="200"
          src="https://www.youtube.com/embed/-kguiI17880?si=zy1QYpbgBc787vfP"
          title="Video 1"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        <iframe
          width="100%"
          height="200"
          src="https://www.youtube.com/embed/videoseries?list=PL_ctsbuZQZeyezIbWex0bUvbRNdIFlWdK&si=i4Scy8gnP8bGfOC3"
          title="Playlist"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <motion.h3
        className="text-xl font-bold mt-8 mb-4 text-gray-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        For research, we recommend the following sites:
      </motion.h3>
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {[
          { name: 'Google Scholar', url: 'https://scholar.google.com/', desc: 'Google’s academic search engine with millions of scientific articles.' },
          { name: 'SciELO', url: 'https://scielo.org/en/', desc: 'Open-access online scientific library in Spanish and Portuguese.' },
          { name: 'Consensus', url: 'https://consensus.app/', desc: 'AI-powered platform for finding and summarizing scientific articles.' }
        ].map((site, index) => (
          <motion.a
            key={index}
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 bg-gray-50 rounded-xl shadow hover:shadow-md transition"
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
          >
            <h4 className="text-lg font-bold text-gray-800 mb-2">{site.name}</h4>
            <p className="text-sm text-gray-600">{site.desc}</p>
          </motion.a>
        ))}
      </motion.div>{/* Academic Tools Recommendation */}
<motion.h3
  className="text-xl font-bold mt-10 mb-4 text-gray-800"
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ delay: 0.7, duration: 0.5 }}
>
  Recommended academic tools
</motion.h3>

<motion.div
  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
  variants={containerVariants}
  initial="hidden"
  animate="visible"
>
  <motion.a
    href="https://www.revistacienciasestudiantes.com/academic-tools"
    target="_blank"
    rel="noopener noreferrer"
    className="flex flex-col sm:flex-row items-center gap-4 p-5 bg-gray-50 rounded-xl shadow hover:shadow-md transition"
    variants={itemVariants}
    whileHover={{ scale: 1.02 }}
  >
    <img
      src="https://www.revistacienciasestudiantes.com/academic-tools/assets/logoP.png"
      alt="Academic Tools logo"
      className="w-20 h-20 object-contain"
    />

    <div>
      <h4 className="text-lg font-bold text-gray-800 mb-1">
        Academic Tools
      </h4>
      <p className="text-sm text-gray-600 mb-2">
        A free platform offering essential tools for students, researchers,
        and academics.
      </p>
      <ul className="text-sm text-gray-600 list-disc pl-5">
        <li>Merge and manage PDF files</li>
        <li>Generate academic citations automatically</li>
        <li>Analyze and process academic text</li>
        <li>Quick utilities for common research tasks</li>
      </ul>
      <span className="inline-block mt-3 text-blue-600 font-medium">
        Visit Academic Tools →
      </span>
    </div>
  </motion.a>
</motion.div>


    </motion.div>
  );
}

export default GuidelinesSection;