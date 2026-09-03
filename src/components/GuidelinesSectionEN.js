import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRightIcon, ArrowTopRightOnSquareIcon, DocumentTextIcon, PlayCircleIcon } from '@heroicons/react/24/outline';

function GuidelinesSection() {
  const resources = [
    { name: 'Google Scholar', url: 'https://scholar.google.com/', desc: 'Leading search engine for academic literature.' },
    { name: 'SciELO', url: 'https://scielo.org/es/', desc: 'Open access scientific library.' },
    { name: 'Consensus', url: 'https://consensus.app/', desc: 'AI-powered scientific evidence search engine.' }
  ];

  const keySpecs = [
    { label: 'Length', val: '1,000–10,000 words (including references)' },
    { label: 'Format', val: 'Microsoft Word (.docx). Anonymized document for double-blind peer review.' },
    { label: 'Citation', val: 'Chicago 17th ed. (Author-Date)', link: 'https://www.chicagomanualofstyle.org/tools_citationguide/citation-guide-2.html' },
    { label: 'Languages', val: 'Spanish and English (title, abstract, and keywords in both)' },
    { label: 'Keywords', val: '2–6 free terms + controlled vocabulary codes (JEL, MeSH, ACM, UNESCO)', link: 'https://www.revistacienciasestudiantes.com/policiesEN.html#tabla-vocabularios' },
    { label: 'Originality', val: 'Maximum similarity allowed: 15%' },
    { label: 'Ethics', val: 'Committee approval when applicable; statement in the manuscript.' }
  ];

  const fadeUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <section className="py-20 bg-[#f4f5f7]">
      <div className="max-w-5xl mx-auto px-6">
        
        {/* EDITORIAL HEADER */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl sm:text-4xl font-serif text-black mb-3 tracking-tight">
            Author Guidelines
          </h2>
          <p className="text-[15px] text-[#666666] max-w-2xl mx-auto font-sans">
            Formal instructions for the preparation, structuring, and submission of manuscripts. Adherence to these regulations is essential to pass the preliminary technical review.
          </p>
          <div className="h-[2px] w-16 bg-[#e86125] mx-auto mt-6"></div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* LEFT COLUMN */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="lg:col-span-5 space-y-8"
          >
            
            {/* Quick Guide - Editorial Banner */}
            <div className="bg-white border border-[#e6e8ea] border-l-4 border-l-[#002147] p-6 shadow-sm rounded-sm">
              <h3 className="text-[15px] font-bold font-sans text-black mb-2">
                Interactive Quick Guide
              </h3>
              <p className="text-[13px] text-[#666666] font-sans leading-relaxed mb-4">
                For first-time authors, we offer an <strong>Interactive Quick Guide</strong>. A visual checklist that consolidates essential requirements in less than 5 minutes.
              </p>
              <a 
                href="/quickEN.html" 
                className="inline-flex items-center gap-2 bg-[#002147] hover:bg-[#e86125] text-white px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors font-sans rounded-sm"
              >
                Open Quick Guide
                <ArrowRightIcon className="w-4 h-4" />
              </a>
            </div>

            {/* Normative Documents */}
<div className="bg-white border border-[#e6e8ea] rounded-sm shadow-sm">
  <h3 className="text-[13px] font-bold font-sans uppercase tracking-wider text-black px-6 pt-5 pb-3 border-b border-[#e6e8ea]">
    Normative Documents
  </h3>
  <div className="divide-y divide-[#e6e8ea]">
    {[
      { href: '/authorEN.html', title: 'Complete Author Guidelines' },
      { href: '/practicesEN.html', title: 'Good Practices and Ethics Guide' },
      { href: '/open-accessEN.html', title: 'Open Access Policies' },
      { href: '/copyright-and-licenseEN.html', title: 'License & Copyright' }  // ← NUEVO
    ].map((item) => (
      <a 
        key={item.href}
        href={item.href} 
        className="group flex items-center justify-between px-6 py-4 hover:bg-[#f8f9fa] transition-colors"
      >
        <span className="text-[14px] font-sans font-semibold text-[#2b2b2b] group-hover:text-[#e86125] transition-colors">
          {item.title}
        </span>
        <ArrowRightIcon className="w-4 h-4 text-[#a0a0a0] group-hover:text-[#e86125]" />
      </a>
    ))}
  </div>
</div>

            {/* Technical Specifications */}
            <div className="bg-white border border-[#e6e8ea] rounded-sm shadow-sm">
              <h3 className="text-[13px] font-bold font-sans uppercase tracking-wider text-black px-6 pt-5 pb-3 border-b border-[#e6e8ea]">
                Manuscript Specifications
              </h3>
              <div className="px-6 py-4">
                <dl className="space-y-5">
                  {keySpecs.map((item, i) => (
                    <div key={i} className="flex flex-col">
                      <dt className="text-[10px] uppercase font-bold tracking-wider text-[#a0a0a0] mb-1 font-sans">
                        {item.label}
                      </dt>
                      <dd className="text-[13px] text-[#2b2b2b] leading-relaxed font-sans">
                        {item.link ? (
                          <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-[#002147] hover:text-[#e86125] underline underline-offset-4 decoration-[#cbd0d5] transition-colors">
                            {item.val}
                          </a>
                        ) : (
                          item.val
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

          </motion.div>

          {/* RIGHT COLUMN */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="lg:col-span-7 space-y-8"
          >
            
            {/* Citation Manual */}
            <div className="bg-white border border-[#e6e8ea] rounded-sm shadow-sm">
              <div className="px-6 pt-5 pb-3 border-b border-[#e6e8ea]">
                <span className="text-[#e86125] text-[10px] font-bold uppercase tracking-widest block mb-1 font-sans">Style Manual</span>
                <h3 className="text-lg font-serif font-semibold text-black tracking-tight">Chicago 17th ed. (Author-Date)</h3>
                <p className="text-[13px] text-[#666666] mt-2 leading-relaxed font-sans">
                  Citations are integrated in-text with parentheses, and complete references are listed at the end. Consult the{' '}
                  <a href="https://www.chicagomanualofstyle.org/tools_citationguide/citation-guide-2.html" target="_blank" rel="noopener noreferrer" className="text-[#e86125] hover:underline">
                    official guide
                  </a>
                  {' '}for complex cases.
                </p>
              </div>

              <div className="px-6 py-5 space-y-6">
                {[
                  { title: 'Book', ref: 'Binder, Amy J., and Jeffrey L. Kidder. 2022. The Channels of Student Activism: How the Left and Right Are Winning (and Losing) in Campus Politics Today. University of Chicago Press.', text: '(Binder and Kidder 2022, 117–18)' },
                  { title: 'Book Chapter', ref: 'Doyle, Kathleen. 2023. "The Queen Mary Psalter." In The Book by Design: The Remarkable Story of the World\'s Greatest Invention, edited by P. J. M. Marks and Stephen Parkin. University of Chicago Press.', text: '(Doyle 2023, 64)' },
                  { title: 'Journal Article', ref: 'Dittmar, Emily L., and Douglas W. Schemske. 2023. "Temporal Variation in Selection Influences Microgeographic Local Adaptation." American Naturalist 202 (4): 471–85. https://doi.org/10.1086/725865.', text: '(Dittmar and Schemske 2023, 480)' },
                  { title: 'Web Page', ref: 'Google. 2023. "Privacy Policy." Privacy & Terms. Effective November 15. https://policies.google.com/privacy.', text: '(Google 2023)', note: 'No date: (Yale University n.d.) + access date.' }
                ].map((ex) => (
                  <div key={ex.title} className="pl-4 border-l-2 border-[#cbd0d5]">
                    <h4 className="text-[11px] font-bold tracking-wider uppercase text-black mb-2 font-sans">{ex.title}</h4>
                    <p className="text-xs text-[#2b2b2b] mb-2 leading-relaxed font-sans">{ex.ref}</p>
                    <p className="text-xs text-[#666666] font-mono bg-[#f8f9fa] p-1.5 inline-block rounded-sm">{ex.text}</p>
                    {ex.note && <span className="text-[10px] text-[#a0a0a0] ml-3 font-sans">{ex.note}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Academic Tools and Resources */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white border border-[#e6e8ea] p-6 rounded-sm shadow-sm">
                <DocumentTextIcon className="w-8 h-8 text-[#002147] mb-4" />
                <h4 className="font-serif text-lg font-semibold text-black mb-2 tracking-tight">Academic Tools Suite</h4>
                <p className="text-[13px] text-[#666666] mb-4 leading-relaxed font-sans">
                  Comprehensive proprietary platform for PDF management, automatic citation, and structured text analysis.
                </p>
                <a 
                  href="https://www.revistacienciasestudiantes.com/academic-tools" 
                  className="text-[11px] uppercase font-bold tracking-widest text-[#002147] hover:text-[#e86125] inline-flex items-center gap-1 font-sans"
                >
                  Access the tool <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                </a>
              </div>

              <div className="bg-white border border-[#e6e8ea] p-6 rounded-sm shadow-sm">
                <h4 className="text-[11px] font-bold tracking-wider uppercase text-black mb-4 font-sans">Recommended databases</h4>
                <ul className="space-y-4">
                  {resources.map((res) => (
                    <li key={res.name}>
                      <a href={res.url} target="_blank" rel="noopener noreferrer" className="block group">
                        <span className="text-[14px] font-semibold text-[#2b2b2b] group-hover:text-[#e86125] block mb-1 font-sans">{res.name}</span>
                        <span className="text-[12px] text-[#a0a0a0] font-sans">{res.desc}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Audiovisual Archive */}
            <div className="bg-white border border-[#e6e8ea] rounded-sm shadow-sm">
              <h3 className="text-[13px] font-bold font-sans uppercase tracking-wider text-black px-6 pt-5 pb-3 border-b border-[#e6e8ea] flex items-center justify-between">
                Audiovisual Archive
                <PlayCircleIcon className="w-5 h-5 text-[#a0a0a0]" />
              </h3>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="aspect-video bg-[#f4f5f7] border border-[#e6e8ea] relative group rounded-sm">
                    <iframe 
                      width="100%" 
                      height="100%" 
                      src="https://www.youtube.com/embed/wyPhAGW6-94" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen 
                      title="Workshop 1" 
                      className="absolute inset-0 z-10" 
                    />
                  </div>
                  <div className="aspect-video bg-[#f4f5f7] border border-[#e6e8ea] relative group rounded-sm">
                    <iframe 
                      width="100%" 
                      height="100%" 
                      src="https://www.youtube.com/embed/videoseries?list=PL8yQlmhs7KsBerg9X63QnZnlNAopwzDmw" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen 
                      title="Workshop Playlist" 
                      className="absolute inset-0 z-10" 
                    />
                  </div>
                </div>
              </div>
            </div>

          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default GuidelinesSection;