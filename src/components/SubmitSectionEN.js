import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowRightIcon, 
  ExclamationTriangleIcon,
  CheckIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  ScaleIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline';

function SubmitSection() {
  const navigate = useNavigate();

  const handleSubmitClick = () => {
    navigate('/en/login/submit');
  };

  // Subtle animation variants
  const fadeUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4 } }
  };

  return (
    <motion.div
      className="max-w-5xl mx-auto mt-16 mb-24 px-4 sm:px-6 lg:px-8 font-sans"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
      }}
    >
      {/* STRICT EDITORIAL HEADER */}
      <motion.header variants={fadeUp} className="mb-16 border-t-4 border-[#002147] pt-8">
        <div className="flex items-center justify-between mb-6">
          <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#e86125]">
            Editorial System // Author Portal
          </span>
          <GlobeAltIcon className="w-5 h-5 text-[#002147] hidden sm:block" />
        </div>
        <h1 className="text-4xl md:text-5xl font-serif text-[#002147] font-bold leading-tight mb-6 text-center md:text-left">
          Manuscript Submission
        </h1>
        <div className="w-20 h-1 bg-[#e86125] mb-6 mx-auto md:mx-0"></div>
        <p className="text-slate-600 text-lg leading-relaxed max-w-3xl font-serif text-center md:text-left">
          The submission process constitutes a formal act that implies full acceptance of our editorial and ethical guidelines. We appreciate your interest in submitting your research to the National Journal of Sciences for Students.
        </p>
      </motion.header>

      {/* VERIFICATION BLOCK (High Contrast) */}
      <motion.div variants={fadeUp} className="bg-[#002147] text-white mb-16 flex flex-col md:flex-row rounded-sm overflow-hidden">
        <div className="p-10 md:w-1/2 border-b md:border-b-0 md:border-r border-white/20 flex items-center">
          <div className="flex-1">
            <div className="flex items-center mb-4">
              <DocumentTextIcon className="w-8 h-8 text-[#e86125] mr-3" />
              <h2 className="text-2xl font-serif font-bold">Essential Pre-Verification</h2>
            </div>
            <p className="text-slate-300 leading-relaxed text-sm">
              To optimize the editorial workflow and avoid preliminary technical rejections, we have structured an <strong className="text-white">Interactive Quick Guide</strong>. This personalized evaluation process will allow you to confirm in less than 5 minutes whether your manuscript meets the fundamental standards before formal submission.
            </p>
          </div>
        </div>
        <div className="p-10 md:w-1/2 flex flex-col justify-center bg-[#001833]">
          <div className="space-y-4">
            <a
              href="/quickEN.html"
              className="w-full text-center bg-[#e86125] text-white px-6 py-4 text-xs uppercase font-bold tracking-widest hover:bg-[#c9521e] transition-colors rounded-sm flex items-center justify-center gap-2"
            >
              <CheckIcon className="w-4 h-4" />
              Start Checklist
            </a>
            <a
              href="https://www.revistacienciasestudiantes.com/policiesEN.html"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center border border-white/30 text-white px-6 py-3 text-xs uppercase font-bold tracking-widest hover:bg-white hover:text-[#002147] transition-colors rounded-sm flex items-center justify-center gap-2"
            >
              <AcademicCapIcon className="w-4 h-4" />
              Complete Policies
            </a>
          </div>
        </div>
      </motion.div>

      {/* SYMMETRIC GRID OF CRITERIA AND RESOURCES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-20">
        
        {/* Rejection Criteria (Left Column) */}
        <motion.div variants={fadeUp} className="bg-white border border-slate-200 rounded-sm p-8">
          <div className="border-b-2 border-[#002147] pb-4 mb-8 flex items-center justify-between">
            <h3 className="text-xl font-serif font-bold text-[#002147]">
              Immediate Rejection Criteria
            </h3>
            <ExclamationTriangleIcon className="w-6 h-6 text-[#e86125]" />
          </div>

          <div className="space-y-6">
            {/* ITEM 1 */}
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 bg-[#e86125] text-white rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold">01</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-[#002147] text-base mb-2">Compromised Double-Blind Review</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  The main manuscript must not contain names, institutional affiliations, biographies, or acknowledgments. Any metadata revealing the author's identity in the document will void the process.
                </p>
              </div>
            </div>

            {/* ITEM 2 */}
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold">02</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-[#002147] text-base mb-2">Citation Structure</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  The document must rigorously adhere to <strong>Chicago 17th ed. (author-date)</strong> or APA 7th ed. (depending on field) format in both the body text and final references.
                </p>
              </div>
            </div>

            {/* ITEM 3 */}
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold">03</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-[#002147] text-base mb-2">Academic Taxonomy</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Must provide a structured abstract, 3 to 5 keywords, and standardized Classification Codes for your discipline (e.g., JEL, MeSH).
                </p>
              </div>
            </div>

            {/* ITEM 4 */}
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold">04</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-[#002147] text-base mb-2">Mandatory Declarations</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  The article must include formal declarations of: Funding, Conflict of Interest, Data Availability, and Ethics Committee Approval (if involving human/animal subjects).
                </p>
              </div>
            </div>

            {/* ITEM 5 */}
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 bg-[#e86125] text-white rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold">05</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-[#002147] text-base mb-2">Similarity Threshold</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  The similarity index <strong className="text-[#e86125]">must not exceed 15%</strong> (excluding properly cited bibliography). This will be verified using iThenticate/Turnitin software before the first filter.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Resources (Right Column) */}
        <motion.div variants={fadeUp} className="bg-slate-50 border border-slate-200 rounded-sm p-8">
          <div className="border-b-2 border-[#002147] pb-4 mb-8 flex items-center justify-between">
            <h3 className="text-xl font-serif font-bold text-[#002147]">
              Documentation
            </h3>
            <DocumentTextIcon className="w-6 h-6 text-[#002147]" />
          </div>
          
          <ul className="space-y-4 mb-8">
            <li>
              <a href="/en/guidelines" className="group flex items-start gap-3 text-sm text-slate-700 hover:text-[#e86125] transition-colors p-4 bg-white rounded-sm border border-slate-200 hover:border-[#e86125]">
                <ArrowRightIcon className="w-5 h-5 mt-0.5 text-[#002147] group-hover:text-[#e86125] transition-colors" />
                <div>
                  <span className="font-semibold block mb-1">Complete Author Guidelines (PDF)</span>
                  <span className="text-xs text-slate-500">Comprehensive guide for manuscript preparation</span>
                </div>
              </a>
            </li>
            <li>
              <a href="/en/templates" className="group flex items-start gap-3 text-sm text-slate-700 hover:text-[#e86125] transition-colors p-4 bg-white rounded-sm border border-slate-200 hover:border-[#e86125]">
                <ArrowRightIcon className="w-5 h-5 mt-0.5 text-[#002147] group-hover:text-[#e86125] transition-colors" />
                <div>
                  <span className="font-semibold block mb-1">Official Word / LaTeX Template</span>
                  <span className="text-xs text-slate-500">Standardized formatting for submission</span>
                </div>
              </a>
            </li>
            <li>
              <a href="/en/ethics" className="group flex items-start gap-3 text-sm text-slate-700 hover:text-[#e86125] transition-colors p-4 bg-white rounded-sm border border-slate-200 hover:border-[#e86125]">
                <ArrowRightIcon className="w-5 h-5 mt-0.5 text-[#002147] group-hover:text-[#e86125] transition-colors" />
                <div>
                  <span className="font-semibold block mb-1">Ethics and Malpractice Statement</span>
                  <span className="text-xs text-slate-500">Publication ethics and policies</span>
                </div>
              </a>
            </li>
          </ul>

          <div className="bg-white border border-slate-200 p-6 rounded-sm">
            <div className="flex items-center mb-3">
              <ShieldCheckIcon className="w-6 h-6 text-[#002147] mr-2" />
              <h5 className="text-sm uppercase tracking-widest font-bold text-[#002147]">Open Access</h5>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              This journal operates under the Diamond Open Access model. There are no article processing charges (APC) or submission fees.
            </p>
          </div>
        </motion.div>
      </div>

      {/* ACCESS PORTAL (Minimalist and Institutional) */}
      <motion.div variants={fadeUp} className="max-w-2xl mx-auto">
        <div className="border-2 border-slate-300 p-1 bg-white rounded-sm">
          <div className="border border-slate-200 p-10 md:p-14 text-center bg-slate-50 rounded-sm">
            <div className="w-16 h-16 bg-white border border-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <EnvelopeIcon className="w-8 h-8 text-[#002147]" />
            </div>
            
            <h3 className="text-2xl font-serif text-[#002147] font-bold mb-4">
              Editorial System Access
            </h3>
            
            <p className="text-slate-600 mb-10 text-sm leading-relaxed max-w-lg mx-auto">
              To initiate a new submission, attach a revision (Revise & Resubmit), or check the status of a manuscript, please access the secure portal.
            </p>

            <button
              onClick={handleSubmitClick}
              className="w-full sm:w-auto bg-[#002147] text-white px-12 py-4 text-xs font-bold uppercase tracking-[0.15em] hover:bg-[#e86125] transition-colors rounded-sm inline-flex items-center justify-center gap-3 mb-6"
            >
              <span>Access Portal</span>
              <ArrowRightIcon className="w-4 h-4" />
            </button>

            <div className="pt-6 border-t border-slate-300">
              <p className="text-xs text-slate-500">
                Para envíos en español, por favor acceda al{' '}
                <a href="/login/submit" className="text-[#002147] font-bold hover:text-[#e86125] transition-colors underline underline-offset-4">
                  Portal Editorial en Español
                </a>.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* FOOTER */}
      <motion.footer variants={fadeUp} className="mt-16 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <ScaleIcon className="w-4 h-4 text-slate-400" />
          <p className="text-xs font-mono text-slate-400">
            Technical Support: <a href="mailto:support@revistacienciasestudiantes.com" className="text-[#002147] hover:underline">support@revistacienciasestudiantes.com</a>
          </p>
        </div>
      </motion.footer>
    </motion.div>
  );
}

export default SubmitSection;