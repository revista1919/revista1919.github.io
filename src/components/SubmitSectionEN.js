import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowRightIcon, 
  DocumentCheckIcon, 
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

function SubmitSection() {
  const navigate = useNavigate();

  const handleSubmitClick = () => {
    navigate('/en/login/submit');
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        
        {/* EDITORIAL HEADER */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-12 text-center"
        >
          <h2 className="text-4xl sm:text-5xl font-serif text-black mb-3 tracking-tight">
            Manuscript <span className="italic text-[#001833]">Submission.</span>
          </h2>
          <p className="text-[15px] text-[#666666] max-w-2xl mx-auto font-sans">
            The submission process constitutes a formal act that implies full acceptance of our editorial and ethical regulations.
          </p>
          <div className="h-[2px] w-16 bg-[#e86125] mx-auto mt-6"></div>
        </motion.div>

        {/* VERIFICATION CARD */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-12"
        >
          <div className="bg-white border border-[#e6e8ea] rounded-sm shadow-sm p-6 sm:p-8 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Icon */}
              <div className="flex-shrink-0 bg-[#f4f5f7] text-[#002147] p-4 rounded-full flex items-center justify-center">
                <DocumentCheckIcon className="h-8 w-8" />
              </div>

              {/* Content */}
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg font-serif font-semibold text-black tracking-tight mb-2">
                  Recommended Pre-Verification
                </h3>
                <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
                  To optimize the editorial process and facilitate the review of your manuscript, we recommend completing our <strong className="text-black">Interactive Quick Guide</strong>. This checklist will help you confirm that your work meets the fundamental technical requirements before initiating submission.
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
                  <ClockIcon className="w-4 h-4 text-[#e86125]" />
                  <span className="font-sans text-[12px] text-[#a0a0a0]">Estimated time: 5 minutes</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-3 w-full sm:w-auto flex-shrink-0">
                <a
                  href="/quickEN.html"
                  className="w-full sm:w-auto px-6 py-3 bg-[#e86125] hover:bg-[#c9521e] text-white text-[11px] font-bold uppercase tracking-widest rounded-sm transition-colors text-center font-sans"
                >
                  Start Checklist
                </a>
                <a
                  href="https://www.revistacienciasestudiantes.com/policiesEN.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-6 py-3 border border-[#e6e8ea] text-[#002147] text-[11px] font-bold uppercase tracking-widest hover:bg-[#f8f9fa] transition-colors rounded-sm text-center font-sans"
                >
                  View Policies
                </a>
              </div>
            </div>
          </div>
        </motion.div>

        {/* PREPARATION GUIDE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mb-12">
          
          {/* Main Column: Preparation Requirements */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="lg:col-span-7"
          >
            <div className="flex items-end justify-between border-b-2 border-[#e6e8ea] pb-4 mb-8">
              <h3 className="text-2xl font-serif font-semibold text-black tracking-tight">
                Preparation Requirements
              </h3>
              <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#e86125] bg-[#e86125]/10 px-3 py-1 rounded-sm">
                Checklist
              </span>
            </div>

            <div className="space-y-6">
              {/* Item I */}
              <div className="flex gap-4 border-b border-[#e6e8ea] pb-6">
                <span className="font-serif font-bold text-xl text-black mt-1">I.</span>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-[14px] font-bold text-black flex items-center gap-2 font-sans">
                      Manuscript Anonymization
                      <InformationCircleIcon className="w-4 h-4 text-[#e86125]" />
                    </h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#e86125] bg-[#e86125]/5 px-2 py-1 rounded-sm font-sans">
                      Important
                    </span>
                  </div>
                  <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
                    To ensure the integrity of the double-blind peer review process, we ask that the main manuscript not contain names, institutional affiliations, or acknowledgments. This information should only be included on a separate title page.
                  </p>
                </div>
              </div>

              {/* Item II */}
              <div className="flex gap-4 border-b border-[#e6e8ea] pb-6">
                <span className="font-serif font-bold text-xl text-black mt-1">II.</span>
                <div className="flex-1">
                  <h4 className="text-[14px] font-bold text-black mb-2 font-sans">Citation Format</h4>
                  <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
                    We recommend adhering to <strong className="text-black">Chicago 17th ed. (author-date)</strong> format in both the body text and final bibliography to maintain editorial consistency.
                  </p>
                </div>
              </div>

              {/* Item III */}
              <div className="flex gap-4 border-b border-[#e6e8ea] pb-6">
                <span className="font-serif font-bold text-xl text-black mt-1">III.</span>
                <div className="flex-1">
                  <h4 className="text-[14px] font-bold text-black mb-2 font-sans">Keywords and Classification</h4>
                  <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
                    We ask you to provide 3 to 5 free keywords and, additionally, assign specialized Classification Codes from your discipline (e.g., JEL codes, MeSH descriptors) to facilitate indexing.
                  </p>
                </div>
              </div>

              {/* Item IV */}
              <div className="flex gap-4 border-b border-[#e6e8ea] pb-6">
                <span className="font-serif font-bold text-xl text-black mt-1">IV.</span>
                <div className="flex-1">
                  <h4 className="text-[14px] font-bold text-black mb-2 font-sans">Transparency Declarations</h4>
                  <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
                    To comply with ethical publication standards, we recommend including the following sections at the end of the article: Funding, Conflict of Interest, Data Availability, and Ethical Approval (when applicable).
                  </p>
                </div>
              </div>

              {/* Item V */}
              <div className="flex gap-4">
                <span className="font-serif font-bold text-xl text-black mt-1">V.</span>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-[14px] font-bold text-black flex items-center gap-2 font-sans">
                      Originality of Work
                      <InformationCircleIcon className="w-4 h-4 text-[#e86125]" />
                    </h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#e86125] bg-[#e86125]/5 px-2 py-1 rounded-sm font-sans">
                      Important
                    </span>
                  </div>
                  <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
                    We value originality in all contributions. We recommend verifying that the similarity index of your manuscript remains below <strong className="text-black">15%</strong> (excluding bibliography) to facilitate the review process.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Sidebar: Resources */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="lg:col-span-5"
          >
            <div className="space-y-6">
              {/* Key Resources */}
              <div className="bg-white border border-[#e6e8ea] rounded-sm shadow-sm">
                <h3 className="text-[13px] font-bold font-sans uppercase tracking-wider text-black px-6 pt-5 pb-3 border-b border-[#e6e8ea]">
                  Key Resources
                </h3>
                <div className="px-6 py-4 space-y-0 divide-y divide-[#e6e8ea]">
                  <a href="/en/guidelines" className="group flex items-center justify-between py-3 hover:bg-[#f8f9fa] transition-colors px-2 -mx-2">
                    <span className="text-[14px] text-[#2b2b2b] font-medium group-hover:text-[#e86125] transition-colors font-sans">Comprehensive Author Guidelines</span>
                    <ArrowTopRightOnSquareIcon className="w-4 h-4 text-[#a0a0a0] group-hover:text-[#e86125]" />
                  </a>
                  <a href="https://www.revistacienciasestudiantes.com/policiesEN.html" target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between py-3 hover:bg-[#f8f9fa] transition-colors px-2 -mx-2">
                    <span className="text-[14px] text-[#2b2b2b] font-medium group-hover:text-[#e86125] transition-colors font-sans">Complete Editorial Policies</span>
                    <ArrowTopRightOnSquareIcon className="w-4 h-4 text-[#a0a0a0] group-hover:text-[#e86125]" />
                  </a>
                  <a href="/en/faq" className="group flex items-center justify-between py-3 hover:bg-[#f8f9fa] transition-colors px-2 -mx-2">
                    <span className="text-[14px] text-[#2b2b2b] font-medium group-hover:text-[#e86125] transition-colors font-sans">Submission FAQs</span>
                    <ArrowTopRightOnSquareIcon className="w-4 h-4 text-[#a0a0a0] group-hover:text-[#e86125]" />
                  </a>
                </div>
              </div>

              {/* Informational Box */}
              <div className="bg-[#f8f9fa] border border-[#e6e8ea] rounded-sm p-6">
                <div className="flex items-center gap-2 mb-2">
                  <InformationCircleIcon className="w-4 h-4 text-[#e86125]" />
                  <h5 className="text-[11px] font-bold uppercase tracking-widest text-black font-sans">Recommendation</h5>
                </div>
                <p className="text-[12px] text-[#666666] leading-relaxed font-sans">
                  Paying special attention to <strong className="text-black">points I and V</strong> will significantly facilitate the review process and avoid unnecessary delays.
                </p>
              </div>

              {/* Pre-submission Checklist */}
              <div className="bg-white border border-[#e6e8ea] rounded-sm shadow-sm">
                <h3 className="text-[13px] font-bold font-sans uppercase tracking-wider text-black px-6 pt-5 pb-3 border-b border-[#e6e8ea]">
                  Before Submitting
                </h3>
                <div className="px-6 py-4">
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <CheckCircleIcon className="w-4 h-4 text-[#e86125] flex-shrink-0 mt-0.5" />
                      <span className="text-[13px] text-[#666666] font-sans">Anonymized manuscript</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircleIcon className="w-4 h-4 text-[#e86125] flex-shrink-0 mt-0.5" />
                      <span className="text-[13px] text-[#666666] font-sans">Separate title page with author details</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircleIcon className="w-4 h-4 text-[#e86125] flex-shrink-0 mt-0.5" />
                      <span className="text-[13px] text-[#666666] font-sans">Brief note to the editor explaining the value and contribution of your article</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircleIcon className="w-4 h-4 text-[#e86125] flex-shrink-0 mt-0.5" />
                      <span className="text-[13px] text-[#666666] font-sans">Declaration of originality</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* CALL TO ACTION */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="max-w-3xl mx-auto"
        >
          <div className="bg-white border border-[#e6e8ea] p-10 sm:p-14 text-center rounded-sm shadow-sm relative">
            <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#e86125] font-sans">
              Secure Platform
            </span>
            
            <h3 className="text-2xl font-serif font-semibold tracking-tight text-black mb-4">
              Official Author Portal
            </h3>
            
            <p className="text-[14px] text-[#666666] mb-8 leading-relaxed max-w-lg mx-auto font-sans">
              To submit a new manuscript, attach corrections (<span className="italic">Revise & Resubmit</span>), or track the peer review process, you must authenticate in the editorial system. Registration is completely free.
            </p>

            <button
              onClick={handleSubmitClick}
              className="w-full sm:w-auto bg-[#002147] text-white px-10 py-3 text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-[#e86125] transition-colors rounded-sm inline-flex items-center justify-center gap-3 mb-6 font-sans"
            >
              <span>Login / Register</span>
              <ArrowRightIcon className="w-4 h-4" />
            </button>

            <div className="pt-6 border-t border-[#e6e8ea] max-w-sm mx-auto">
              <p className="text-[12px] text-[#a0a0a0] font-sans">
                Para envíos en español, acceda al{' '}
                <a 
                  href="/login/submit" 
                  className="text-[#002147] font-bold hover:text-[#e86125] transition-colors underline underline-offset-4"
                >
                  Portal Editorial en Español
                </a>.
              </p>
            </div>
          </div>
        </motion.div>

        {/* TECHNICAL FOOTER */}
        <motion.footer 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mt-12 text-center border-t border-[#e6e8ea] pt-8"
        >
          <p className="text-[12px] text-[#a0a0a0] font-sans">
            Need technical assistance? Contact{' '}
            <a 
              href="mailto:contact@revistacienciasestudiantes.com" 
              className="text-[#002147] hover:text-[#e86125] transition-colors font-medium border-b border-transparent hover:border-[#e86125]"
            >
              contact@revistacienciasestudiantes.com
            </a>
          </p>
        </motion.footer>

      </div>
    </section>
  );
}

export default SubmitSection;