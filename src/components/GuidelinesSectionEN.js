import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowRightIcon, 
  DocumentTextIcon, 
  CheckCircleIcon, 
  BookOpenIcon, 
  ScaleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlayIcon,
  ExternalLinkIcon
} from '@heroicons/react/24/outline';

function GuidelinesSection() {
  const [showAllCitations, setShowAllCitations] = useState(false);

  // Curated resources - only the most relevant for students
  const resources = [
    { name: 'Google Scholar', url: 'https://scholar.google.com/', desc: 'Essential academic search engine.' },
    { name: 'SciELO', url: 'https://scielo.org/es/', desc: 'Ibero-American open access.' },
    { name: 'Consensus', url: 'https://consensus.app/', desc: 'AI-powered scientific evidence.' }
  ];

  // Essential specifications only
  const keySpecs = [
    { label: 'Length', val: '1,000–10,000 words (including references)' },
    { label: 'Format', val: 'Microsoft Word (.docx) or LaTeX. Anonymized document (Double-blind).' },
    { label: 'Citation', val: 'Chicago 17th ed. (Author-Date)', link: 'https://www.chicagomanualofstyle.org/' },
    { label: 'Languages', val: 'Spanish and English (title, abstract, and keywords in both)' },
    { label: 'Keywords', val: '2–6 free terms + Controlled codes (JEL, MeSH, ACM, UNESCO)', link: '/policiesEN.html' },
    { label: 'Originality', val: 'Maximum similarity allowed: 15% (iThenticate/Turnitin)' }
  ];

  // The 4 most common citation types for students
  const citationExamples = [
    {
      title: 'Book',
      ref: 'Graeber, David. 2018. Bullshit Jobs: A Theory. Simon & Schuster.',
      text: '(Graeber 2018, 45-46)'
    },
    {
      title: 'Journal Article',
      ref: 'Dittmar, Emily, and Douglas Schemske. 2023. "Temporal Variation in Selection." American Naturalist 202 (4): 471–85. https://doi.org/10.1086/725865.',
      text: '(Dittmar and Schemske 2023, 480)',
      note: '3+ authors: (Snyder et al. 2025, 9-10)'
    },
    {
      title: 'Book Chapter',
      ref: 'Doyle, Kathleen. 2023. "The Queen Mary Psalter." In The Book by Design, edited by P. J. M. Marks and Stephen Parkin. University of Chicago Press.',
      text: '(Doyle 2023, 64)'
    },
    {
      title: 'Web Page',
      ref: 'Google. 2023. "Privacy Policy." Privacy & Terms. https://policies.google.com/privacy.',
      text: '(Google 2023)',
      note: 'No date: (Yale n.d.) + access date'
    }
  ];

  const fadeUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <section className="py-20 md:py-32 bg-[#fafafa] text-[#002147] font-sans border-t border-slate-200">
      <div className="max-w-6xl mx-auto px-6 md:px-12">
        
        {/* Section Header */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-20">
          <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#e86125] mb-4 block">
            Guidelines // Preparation
          </span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold tracking-tight mb-6 text-[#002147]">
            Author Guidelines
          </h2>
          <p className="text-slate-600 max-w-2xl text-lg font-serif leading-relaxed">
            Everything you need to prepare and submit your manuscript with clarity and editorial rigor.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          
          {/* Left Column */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="lg:col-span-5 space-y-12">
            
            {/* Quick Guide CTA */}
            <div className="bg-[#002147] text-white p-8 rounded-sm border-l-4 border-[#e86125]">
              <h3 className="text-xl font-serif font-bold mb-3">Quick Guide</h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-6 font-light">
                First time publishing? Take our 5-minute interactive checklist to ensure your document meets technical standards before submission.
              </p>
              <a href="/quickEN.html" className="inline-flex items-center gap-3 bg-[#e86125] text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-white hover:text-[#002147] transition-colors rounded-sm">
                Start Checklist
                <ArrowRightIcon className="w-4 h-4" />
              </a>
            </div>

            {/* Essential Documents */}
            <div>
              <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400 mb-4 border-b border-slate-200 pb-2">Essential Documents</h4>
              <ul className="space-y-0">
                {[
                  { href: '/authorEN.html', title: 'Complete Author Guidelines', icon: BookOpenIcon },
                  { href: '/practicesEN.html', title: 'Ethics & Best Practices', icon: ScaleIcon },
                  { href: '/open-accessEN.html', title: 'Open Access Policies', icon: DocumentTextIcon }
                ].map((item, idx) => (
                  <li key={idx}>
                    <a href={item.href} className="group flex items-center gap-3 py-4 border-b border-slate-200 hover:bg-slate-50 transition-colors px-2 -mx-2">
                      <item.icon className="w-5 h-5 text-[#e86125] flex-shrink-0" />
                      <span className="text-sm font-bold text-[#002147] group-hover:text-[#e86125] transition-colors flex-1">
                        {item.title}
                      </span>
                      <ArrowRightIcon className="w-4 h-4 text-slate-300 group-hover:text-[#e86125] group-hover:translate-x-1 transition-all" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Technical Specifications */}
            <div>
              <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400 mb-4 border-b border-slate-200 pb-2">Technical Specifications</h4>
              <dl className="divide-y divide-slate-200 text-sm">
                {keySpecs.map((item, i) => (
                  <div key={i} className="py-3 flex flex-col sm:flex-row sm:justify-between sm:gap-4">
                    <dt className="font-bold text-[#002147] min-w-[120px] uppercase text-[11px] tracking-wider mt-0.5">{item.label}</dt>
                    <dd className="text-slate-600 flex-1 font-serif text-[13px]">
                      {item.link ? (
                        <a href={item.link} target="_blank" rel="noopener noreferrer" className="hover:text-[#e86125] underline decoration-slate-300 underline-offset-4">
                          {item.val}
                        </a>
                      ) : item.val}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </motion.div>

          {/* Right Column */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="lg:col-span-7 space-y-16">
            
            {/* Citation System */}
            <div>
              <h3 className="text-2xl font-serif font-bold text-[#002147] mb-6 flex items-center gap-3">
                <span className="text-[#e86125]">/</span> Citation System
              </h3>
              <p className="text-sm text-slate-600 mb-8 font-serif leading-relaxed">
                We require strict use of the <strong className="text-[#002147]">Author-Date</strong> system from the <em>Chicago Manual of Style (17th ed.)</em>. Citations are integrated in-text with parentheses, and complete references are listed alphabetically at the end under "References."
              </p>
              
              <div className="bg-white border border-slate-300 p-6 md:p-8 rounded-sm">
                <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#002147] border-b border-slate-200 pb-3 mb-6">
                  Essential Examples (CMOS 17)
                </h4>
                
                <div className="space-y-6">
                  {citationExamples.map((ex) => (
                    <div key={ex.title} className="relative pl-4 border-l-2 border-[#e86125]">
                      <span className="absolute -left-2 top-0 bg-[#fafafa] text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">
                        {ex.title}
                      </span>
                      <p className="text-sm text-slate-800 font-serif leading-relaxed mt-3 mb-2">{ex.ref}</p>
                      <p className="text-xs text-slate-500 font-mono">In-text: {ex.text}</p>
                      {ex.note && (
                        <p className="text-[11px] text-slate-400 mt-2 leading-snug italic">{ex.note}</p>
                      )}
                    </div>
                  ))}
                </div>
                
                <a 
                  href="https://www.chicagomanualofstyle.org/tools_citationguide/citation-guide-2.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#e86125] hover:text-[#002147] transition-colors"
                >
                  Complete Citation Guide
                  <ArrowRightIcon className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Workshops */}
            <div>
              <h3 className="text-2xl font-serif font-bold text-[#002147] mb-6 flex items-center gap-3">
                <span className="text-[#e86125]">/</span> Workshops
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="group border border-slate-200 bg-white rounded-sm overflow-hidden">
                  <div className="aspect-video bg-slate-900 relative">
                    <iframe className="absolute inset-0 w-full h-full opacity-90 group-hover:opacity-100 transition-opacity" src="https://www.youtube.com/embed/wyPhAGW6-94" frameBorder="0" allowFullScreen title="Academic Writing Workshop"></iframe>
                  </div>
                  <p className="text-xs font-bold text-center py-3 text-[#002147] uppercase tracking-widest">Academic Writing</p>
                </div>
                <div className="group border border-slate-200 bg-white rounded-sm overflow-hidden">
                  <div className="aspect-video bg-slate-900 relative">
                    <iframe className="absolute inset-0 w-full h-full opacity-90 group-hover:opacity-100 transition-opacity" src="https://www.youtube.com/embed/videoseries?list=PL8yQlmhs7KsBerg9X63QnZnlNAopwzDmw" frameBorder="0" allowFullScreen title="Methodology Series"></iframe>
                  </div>
                  <p className="text-xs font-bold text-center py-3 text-[#002147] uppercase tracking-widest">Methodology Series</p>
                </div>
              </div>
            </div>

            {/* Academic Tools - Compact */}
            <div className="bg-[#002147] text-white flex items-center gap-4 border-l-4 border-[#e86125] p-5 rounded-sm">
              <DocumentTextIcon className="w-10 h-10 text-[#e86125] flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-base font-serif font-bold mb-1">Academic Tools</h4>
                <p className="text-xs text-slate-300 font-light">PDF management, automatic citation, and text analysis.</p>
              </div>
              <a href="https://www.revistacienciasestudiantes.com/academic-tools" className="text-[#e86125] text-xs uppercase font-bold tracking-widest hover:text-white transition-colors whitespace-nowrap">
                Access →
              </a>
            </div>

            {/* Resources - Curated */}
            <div>
              <h3 className="text-2xl font-serif font-bold text-[#002147] mb-6 flex items-center gap-3">
                <span className="text-[#e86125]">/</span> Resources
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {resources.map((resource) => (
                  <a
                    key={resource.name}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block p-4 bg-white border border-slate-200 rounded-sm hover:border-[#002147] transition-all"
                  >
                    <h4 className="text-sm font-bold text-[#002147] group-hover:text-[#e86125] transition-colors mb-1">
                      {resource.name}
                    </h4>
                    <p className="text-xs text-slate-500 font-serif">
                      {resource.desc}
                    </p>
                  </a>
                ))}
              </div>
            </div>
            
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default GuidelinesSection;