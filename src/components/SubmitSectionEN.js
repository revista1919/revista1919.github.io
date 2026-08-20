import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  CheckCircleIcon, 
  DocumentCheckIcon, 
  BookOpenIcon, 
  ArrowRightOnRectangleIcon, 
  ShieldExclamationIcon,
  LanguageIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

function SubmitSection() {
  const navigate = useNavigate();

  const handleSubmitClick = () => {
    navigate('/en/login/submit');
  };

  return (
    <motion.div
      className="max-w-6xl mx-auto mt-12 mb-20 px-4 sm:px-6 lg:px-8 font-sans"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* EDITORIAL HEADER */}
      <header className="mb-12 text-center">
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[11px] uppercase tracking-[0.3em] font-semibold text-[#002147] mb-4 block"
        >
          Editorial System
        </motion.span>
        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-4xl md:text-5xl font-serif text-black mb-4"
        >
          Manuscript Submission
        </motion.h2>
        <div className="w-16 h-1 bg-[#FF7900] mx-auto mb-6"></div>
        <p className="text-slate-600 text-base leading-relaxed max-w-3xl mx-auto">
          The submission process constitutes a formal act that implies full acceptance of our editorial and ethical guidelines. We appreciate your interest in publishing with our journal.
        </p>
      </header>

      {/* PROMINENT NOTICE: Quick Guide as First Step */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-[#002147] text-white rounded-xl mb-12 shadow-xl overflow-hidden relative"
      >
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-white opacity-5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#FF7900] opacity-10 rounded-full blur-2xl -ml-16 -mb-16 pointer-events-none"></div>
        
        <div className="p-8 sm:p-10 flex flex-col lg:flex-row items-start lg:items-center gap-8 relative z-10">
          {/* Icon */}
          <div className="flex-shrink-0 bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
            <DocumentCheckIcon className="w-12 h-12 text-[#FF7900]" />
          </div>
          
          <div className="flex-1">
            <h3 className="text-xl sm:text-2xl font-serif font-bold text-white mb-3">
              Essential Pre-Submission Check
            </h3>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6 max-w-3xl">
              To optimize the editorial process, we have designed an <strong className="text-white">Interactive Quick Guide</strong>. 
              This checklist will allow you to confirm, in less than 5 minutes, whether your manuscript meets the 
              fundamental requirements before formal submission.
            </p>
            
            <div className="flex flex-wrap gap-3">
              <a
                href="/quickEN.html"
                className="inline-flex items-center gap-2 bg-[#FF7900] text-white px-6 py-3 text-xs uppercase font-bold tracking-wider hover:bg-[#E06A00] transition-all rounded-lg shadow-lg hover:shadow-[#FF7900]/30"
              >
                <CheckCircleIcon className="w-5 h-5" />
                Start Quick Checklist
              </a>
              <a
                href="https://www.revistacienciasestudiantes.com/policiesEN.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-transparent border-2 border-white/30 text-white px-6 py-3 text-xs uppercase font-bold tracking-wider hover:bg-white hover:text-[#002147] hover:border-white transition-all rounded-lg"
              >
                <BookOpenIcon className="w-5 h-5" />
                Editorial Policies
              </a>
            </div>
          </div>
        </div>
      </motion.div>

      {/* PREPARATION SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Main Checklist */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm p-8"
        >
          <div className="flex items-center mb-6">
            <ShieldExclamationIcon className="w-6 h-6 text-[#FF7900] mr-3" />
            <h3 className="text-lg font-serif font-bold text-black">
              Immediate Rejection Criteria (Desk Reject)
            </h3>
          </div>
          
          <div className="space-y-6">
            {/* Item 1 - Critical */}
            <div className="flex items-start p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
              <ShieldExclamationIcon className="w-6 h-6 text-red-600 mr-4 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">Compromised Double-Blind Review</h4>
                <p className="text-sm text-slate-700 leading-relaxed">
                  The manuscript <strong className="text-red-600">must not contain names, institutional affiliations, or acknowledgments</strong>. 
                  Any identifying information will immediately void the submission.
                </p>
              </div>
            </div>

            {/* Item 2 */}
            <div className="flex items-start p-4 bg-slate-50 border-l-4 border-slate-300 rounded-r-lg">
              <CheckCircleIcon className="w-6 h-6 text-slate-500 mr-4 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">Strict Citation Format</h4>
                <p className="text-sm text-slate-700 leading-relaxed">
                  The document must strictly adhere to <strong>Chicago 17th ed. (author-date)</strong> format in both 
                  in-text citations and bibliography.
                </p>
              </div>
            </div>

            {/* Item 3 */}
            <div className="flex items-start p-4 bg-slate-50 border-l-4 border-slate-300 rounded-r-lg">
              <CheckCircleIcon className="w-6 h-6 text-slate-500 mr-4 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">Keywords and Classification Codes</h4>
                <p className="text-sm text-slate-700 leading-relaxed">
                  You must provide 3 to 5 free keywords, and <strong>separately</strong>, assign the specialized 
                  Classification Codes for your discipline (e.g., JEL codes or MeSH descriptors).
                </p>
              </div>
            </div>

            {/* Item 4 */}
            <div className="flex items-start p-4 bg-slate-50 border-l-4 border-slate-300 rounded-r-lg">
              <CheckCircleIcon className="w-6 h-6 text-slate-500 mr-4 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">Mandatory Declarations</h4>
                <p className="text-sm text-slate-700 leading-relaxed">
                  The article must include at the end: Funding, Conflict of Interest, Data Availability, and 
                  (if applicable) Ethics Approval statements.
                </p>
              </div>
            </div>

            {/* Item 5 - Critical */}
            <div className="flex items-start p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
              <ShieldExclamationIcon className="w-6 h-6 text-red-600 mr-4 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">Similarity Threshold (Plagiarism)</h4>
                <p className="text-sm text-slate-700 leading-relaxed">
                  The similarity index <strong className="text-red-600">must not exceed 15%</strong> (excluding bibliography). 
                  This will be verified using anti-plagiarism software before the review begins.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Sidebar Panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col justify-center bg-gradient-to-br from-[#F3F7F9] to-white p-8 rounded-xl border-2 border-[#002147]/10"
        >
          <div className="text-center mb-6">
            <SparklesIcon className="w-12 h-12 text-[#002147] mx-auto mb-4" />
            <h4 className="text-lg font-serif font-bold text-black mb-2">
              Interactive Quick Guide
            </h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              Complete the 5-minute visual checklist and confirm that your manuscript is ready for submission.
            </p>
          </div>
          
          <div className="space-y-3">
            <a
              href="/quickEN.html"
              className="block text-center text-sm font-bold uppercase tracking-wider text-white bg-[#002147] py-3 px-4 hover:bg-[#00152e] transition-colors rounded-lg shadow-md"
            >
              Open Quick Guide
            </a>
            <a
              href="https://www.revistacienciasestudiantes.com/policiesEN.html"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-sm font-bold uppercase tracking-wider text-[#002147] border-2 border-[#002147] py-3 px-4 hover:bg-[#002147] hover:text-white transition-colors rounded-lg"
            >
              Full Policies
            </a>
            <button
              onClick={() => navigate('/en/guidelines')}
              className="block w-full text-center text-sm font-bold uppercase tracking-wider text-[#FF7900] border-2 border-[#FF7900] py-3 px-4 hover:bg-[#FF7900] hover:text-white transition-colors rounded-lg"
            >
              Author Guidelines
            </button>
          </div>
        </motion.div>
      </div>

      {/* CALL TO ACTION: SUBMISSION SYSTEM */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-lg"
      >
        <div className="bg-[#002147] px-6 py-4 flex justify-between items-center">
          <span className="text-xs font-bold text-white uppercase tracking-widest">
            Submission System
          </span>
          <LanguageIcon className="w-5 h-5 text-white/60" />
        </div>
        
        <div className="p-10 sm:p-14 text-center max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-[#F3F7F9] border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ArrowRightOnRectangleIcon className="w-10 h-10 text-[#002147]" />
          </div>
          
          <h3 className="text-2xl font-serif text-black mb-4">
            Author Portal Access
          </h3>
          
          <p className="text-slate-600 mb-8 leading-relaxed">
            To initiate a new submission or track a manuscript under review, you must authenticate 
            through the editorial system. The process is free and takes only a few minutes.
          </p>

          <button
            onClick={handleSubmitClick}
            className="w-full sm:w-auto bg-[#002147] text-white px-10 py-4 rounded-lg font-bold text-sm tracking-wide hover:bg-[#00152e] hover:shadow-xl hover:shadow-[#002147]/20 transition-all flex items-center justify-center gap-3 mx-auto group"
          >
            <span>Sign In / Create Account</span>
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              Para envíos en español, por favor acceda al{' '}
              <a 
                href="/login/submit" 
                className="text-[#002147] font-semibold hover:text-[#FF7900] transition-colors underline underline-offset-2"
              >
                Portal Editorial en Español
              </a>.
            </p>
          </div>
        </div>
      </motion.div>

      {/* FOOTER */}
      <footer className="mt-10 text-center">
        <p className="text-sm text-slate-400">
          Need technical assistance?{' '}
          <a 
            href="mailto:support@revistacienciasestudiantes.com" 
            className="text-[#002147] hover:text-[#FF7900] transition-colors font-medium"
          >
            Contact editorial support
          </a>
        </p>
      </footer>
    </motion.div>
  );
}

export default SubmitSection;