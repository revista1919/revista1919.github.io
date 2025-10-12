import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

function AboutSection() {
  return (
    <motion.div
      className="about-section bg-white p-6 rounded-xl shadow-lg mt-6"
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
        Who We Are
      </motion.h2>
      <motion.p
        className="text-base mb-3 text-gray-600"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        The National Review of Sciences for Students is an interdisciplinary, peer-reviewed publication written, edited, and curated by students and teachers, both from schools and universities. It is open to everyone, though it especially encourages participation from Chileans, but it is open to all the world. Its goal is to foster critical thinking and scientific research among young people through a serious, accessible, and rigorous publication system.
      </motion.p>
      <motion.p
        className="text-base text-gray-600"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <em>It is not associated with any specific institution, program, or school. It is an independent initiative, open to all students. There is no cost; it is completely free and operates thanks to the commitment of our contributors.</em>
      </motion.p>
    </motion.div>
  );
}

export default AboutSection;