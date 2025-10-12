import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

function SubmitSection() {
  return (
    <motion.div
      className="submit-section bg-white p-6 rounded-xl shadow-lg mt-6"
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
        Send your paper
      </motion.h2>
      <motion.p
        className="text-base mb-4 text-gray-600"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <strong>Important: do not include your name in any part of your paper</strong> - only in the form below.
      </motion.p>
      <div className="relative w-full h-[600px]">
        <iframe
          src="https://docs.google.com/forms/d/e/1FAIpQLSf3oTgTOurPOKTmUeBMYxq1XtVLHkI6R0l9CoqFmMyLOlEefg/viewform?embedded=true"
          className="w-full h-full"
          frameBorder="0"
          marginHeight="0"
          marginWidth="0"
        >
          Loading...
        </iframe>
      </div>
    </motion.div>
  );
}

export default SubmitSection;