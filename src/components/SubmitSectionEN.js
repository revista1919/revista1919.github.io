import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

function SubmitSection() {
  const navigate = useNavigate();

  return (
    <motion.div
      className="max-w-5xl mx-auto mt-8 mb-16 px-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Direct Header */}
      <header className="mb-10 border-b border-gray-100 pb-8">
        <h2 className="text-3xl font-serif font-bold text-gray-900 mb-2">
          Manuscript Submission
        </h2>
        <p className="text-gray-500 font-light">
          We appreciate your interest in publishing with us. Please follow the formal process below.
        </p>
      </header>

      {/* Preparation Section (Checklist/Guidelines) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="md:col-span-2 bg-gray-50 p-8 rounded-sm border-l-4 border-gray-900">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-900 mb-4">
            Before starting the submission
          </h3>
          <ul className="space-y-3 text-sm text-gray-700">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                It is strictly mandatory that the document is anonymized. 
                <strong className="text-red-700 font-semibold"> Do not include your name, affiliation or acknowledgments </strong> 
                within the uploaded file to ensure blind peer review.
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>The file format must comply with the journal's style guidelines.</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col justify-center bg-blue-50 p-8 rounded-sm border border-blue-100">
          <h4 className="text-xs font-bold text-blue-900 uppercase tracking-tighter mb-2">Fundamental Requirement</h4>
          <p className="text-xs text-blue-800 mb-4 leading-relaxed">
            Have you verified that your manuscript complies with all citation and formatting standards?
          </p>
          <button
            onClick={() => navigate('/en/guidelines')}
            className="text-xs font-bold uppercase tracking-widest text-blue-700 hover:text-blue-900 transition-colors flex items-center"
          >
            Consult Guidelines →
          </button>
        </div>
      </div>

      {/* Form Container */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-sm overflow-hidden">
        <div className="bg-gray-900 py-3 px-6">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">
            Official Reception Portal
          </span>
        </div>
        <div className="relative w-full h-[800px] bg-gray-50">
          <iframe
            src="https://docs.google.com/forms/d/e/1FAIpQLSf3oTgTOurPOKTmUeBMYxq1XtVLHkI6R0l9CoqFmMyLOlEefg/viewform?embedded=true"
            className="absolute inset-0 w-full h-full"
            frameBorder="0"
            marginHeight="0"
            marginWidth="0"
          >
            Loading form...
          </iframe>
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-gray-400">
        If you experience technical difficulties with the form, contact editorial support.
      </footer>
    </motion.div>
  );
}

export default SubmitSection;