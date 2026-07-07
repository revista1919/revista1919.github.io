import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

function SubmitSection() {
  const navigate = useNavigate();

  const handleSubmitClick = () => {
    navigate('/en/login');
  };

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
          We appreciate your interest in publishing with us. Submission is a formal act that implies acceptance of our editorial policies.
        </p>
      </header>

      {/* PROMINENT NOTICE: Mandatory reading of Guidelines and Policies */}
      <div className="bg-[#001f3f] text-white p-8 rounded-sm mb-10 shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          {/* Book / Warning Icon */}
          <div className="flex-shrink-0">
            <svg className="w-12 h-12 text-[#c0a86a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-serif font-bold text-[#c0a86a] mb-2">
              Mandatory reading before submitting
            </h3>
            <p className="text-sm text-gray-200 leading-relaxed mb-4">
              Submitting a manuscript implies <strong>full acceptance</strong> of our 
              Editorial Policies and a commitment to comply with the Author Guidelines. 
              Failure to comply with any of their provisions —including Chicago 17th ed. 
              (author-date) citation style, document anonymization, ethical declaration, 
              controlled vocabulary keywords, and similarity limits— may result in the 
              <strong> immediate rejection</strong> of the manuscript, without peer review.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://www.revistacienciasestudiantes.com/policiesEN.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#c0a86a] text-[#001f3f] px-5 py-2.5 text-xs uppercase font-bold tracking-[0.15em] hover:bg-white hover:text-[#001f3f] transition-colors rounded-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Full Editorial Policies
              </a>
              <button
                onClick={() => navigate('/en/guidelines')}
                className="inline-flex items-center gap-2 bg-transparent border-2 border-white text-white px-5 py-2.5 text-xs uppercase font-bold tracking-[0.15em] hover:bg-white hover:text-[#001f3f] transition-colors rounded-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Author Guidelines
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preparation Section (Checklist) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="md:col-span-2 bg-gray-50 p-8 rounded-sm border-l-4 border-gray-900">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-900 mb-4">
            Pre-Submission Checklist
          </h3>
          <ul className="space-y-4 text-sm text-gray-700">
            <li className="flex items-start">
              <span className="mr-3 text-gray-900 font-bold">01.</span>
              <span>
                <strong>Strict anonymization.</strong> The document must be completely anonymized. 
                <span className="text-red-700 font-semibold"> Do not include your name, institutional affiliation, or acknowledgments </span> 
                within the uploaded file. Peer review is double-blind, and any identifying information 
                compromises the process.
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-3 text-gray-900 font-bold">02.</span>
              <span>
                <strong>Chicago 17th ed. (author-date) style.</strong> All citations and references must strictly 
                follow this format. Consult the Author Guidelines for precise examples.
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-3 text-gray-900 font-bold">03.</span>
              <span>
                <strong>Keywords with controlled vocabulary.</strong> You must include between 2 and 6 keywords 
                using the classification system corresponding to your area (JEL, MeSH, ACM, or UNESCO). 
                Consult the Editorial Policies for the complete mapping.
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-3 text-gray-900 font-bold">04.</span>
              <span>
                <strong>Mandatory declarations.</strong> Your manuscript must include: conflict of interest statement, 
                funding statement, data availability statement, and, where applicable, ethics approval 
                and informed consent statements.
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-3 text-gray-900 font-bold">05.</span>
              <span>
                <strong>Maximum similarity: 15%.</strong> Manuscripts exceeding this percentage will be returned 
                without review. Use PlagiarismGuard or an equivalent tool to verify this.
              </span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col justify-center bg-[#f0f4f8] p-8 rounded-sm border border-[#c0a86a]">
          <h4 className="text-xs font-bold text-[#001f3f] uppercase tracking-tighter mb-3">
            Have you read the policies?
          </h4>
          <p className="text-xs text-gray-700 mb-5 leading-relaxed">
            By checking the acceptance box on the submission form, you declare that you have read, 
            understood, and fully accepted the Journal's Editorial Policies. 
            <strong className="text-[#001f3f]"> This is not optional.</strong>
          </p>
          <div className="space-y-2">
            <a
              href="https://www.revistacienciasestudiantes.com/policiesEN.html"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-xs font-bold uppercase tracking-widest text-[#001f3f] border-2 border-[#001f3f] py-2.5 px-4 hover:bg-[#001f3f] hover:text-white transition-colors rounded-sm"
            >
              Read Editorial Policies
            </a>
            <button
              onClick={() => navigate('/en/guidelines')}
              className="block w-full text-center text-xs font-bold uppercase tracking-widest text-[#c0a86a] border-2 border-[#c0a86a] py-2.5 px-4 hover:bg-[#c0a86a] hover:text-white transition-colors rounded-sm"
            >
              Consult Author Guidelines
            </button>
          </div>
        </div>
      </div>

      {/* New Submission Container */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-sm overflow-hidden">
        <div className="bg-gray-900 py-3 px-6">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">
            Manuscript Submission System
          </span>
        </div>
        
        <div className="p-12 text-center">
          <div className="max-w-md mx-auto">
            <svg 
              className="w-16 h-16 mx-auto text-gray-400 mb-4" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
              />
            </svg>
            
            <h3 className="text-xl font-serif font-bold text-gray-900 mb-3">
              Submit your manuscript through the portal
            </h3>
            
            <p className="text-gray-600 mb-6">
              To submit your manuscript, you must log in or create an account in our editorial system. 
              Once inside, go to the "Submit Manuscript" tab to complete the process.
            </p>

            <div className="space-y-3">
              <button
                onClick={handleSubmitClick}
                className="w-full bg-gray-900 text-white py-3 px-6 rounded-sm hover:bg-gray-800 transition-colors font-medium"
              >
                Log in or create account
              </button>
              
              <p className="text-sm text-gray-500">
                Already have an account?{' '}
                <button
                  onClick={handleSubmitClick}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Sign in now
                </button>
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Para envíos en español,{' '}
                <a 
                  href="/login" 
                  className="text-blue-600 hover:text-blue-800"
                >
                  acceda al portal en español
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-gray-400">
        Need help? Contact editorial support
      </footer>
    </motion.div>
  );
}

export default SubmitSection;