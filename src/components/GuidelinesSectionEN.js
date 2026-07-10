import React from 'react';
import { motion } from 'framer-motion';

function GuidelinesSection() {
  const resources = [
    { name: 'Google Scholar', url: 'https://scholar.google.com/', desc: 'Leading search engine for academic literature.' },
    { name: 'SciELO', url: 'https://scielo.org/es/', desc: 'Open access scientific library.' },
    { name: 'Consensus', url: 'https://consensus.app/', desc: 'AI-powered scientific evidence search engine.' }
  ];

  return (
    <section className="py-20 bg-[#fafafa]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          {/* Author Guidelines */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-1"
          >
            <h2 className="text-3xl font-serif font-bold mb-8">Author Guidelines</h2>
            
            {/* Policy Notice */}
            <div className="bg-[#001f3f] text-white p-6 rounded-lg mb-8">
              <p className="text-sm font-serif italic leading-relaxed mb-4">
                Submitting a manuscript implies full acceptance of our Editorial Policies. 
                We urge you to read them carefully before preparing your contribution. Failure 
                to comply with any of its provisions may result in the rejection of the submission.
              </p>
              <a 
                href="https://www.revistacienciasestudiantes.com/policies.html" 
                className="inline-block bg-white text-[#001f3f] px-6 py-3 text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-[#c0a86a] hover:text-white transition-colors"
              >
                Read Full Editorial Policies →
              </a>
            </div>

            <ul className="space-y-6">
              {[
                { label: 'Length', val: '1,000–10,000 words (including references)' },
                { label: 'Format', val: 'Microsoft Word (.docx). Anonymized document for double-blind peer review.' },
                { label: 'Citation', val: 'Chicago 17th ed. (Author-Date)', link: 'https://www.chicagomanualofstyle.org/tools_citationguide/citation-guide-2.html' },
                { label: 'Languages', val: 'Spanish and English (title, abstract, and keywords in both)' },
                { label: 'Keywords', val: '2–6, with controlled vocabulary (JEL, MeSH, ACM, UNESCO)', link: 'https://www.revistacienciasestudiantes.com/policies.html#clasificacion' },
                { label: 'Originality', val: 'Maximum similarity allowed: 15%' },
                { label: 'Ethics', val: 'Committee approval when applicable; statement in the manuscript.' }
              ].map((item, i) => (
                <li key={i} className="border-b border-gray-200 pb-2">
                  <span className="text-[10px] uppercase font-black text-gray-400 block tracking-widest">{item.label}</span>
                  {item.link ? (
                    <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-gray-900 font-medium hover:text-[#007398] underline decoration-gray-300">
                      {item.val}
                    </a>
                  ) : (
                    <span className="text-gray-900 font-medium">{item.val}</span>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Videos, Resources, and Citation Guide */}
          <div className="lg:col-span-2 space-y-12">
            
            {/* Chicago Citation Guide (Author-Date) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h3 className="text-xs uppercase tracking-[0.3em] font-black text-gray-400 mb-6 italic underline">
                Citation Style: Chicago 17th ed. (Author-Date)
              </h3>
              <p className="text-sm text-gray-600 mb-6 font-serif leading-relaxed">
                The Journal requires the use of the <strong>author-date</strong> system from the <em>Chicago Manual of Style</em>, 
                17th edition. Citations are inserted in the text in parentheses (Author Year, page) and the complete 
                list of references is included at the end of the manuscript under the heading "References." 
                Below are examples of the most common document types, based 
                directly on the official guide. For cases not covered, consult the complete manual 
                at <a href="https://www.chicagomanualofstyle.org/tools_citationguide/citation-guide-2.html" target="_blank" rel="noopener noreferrer" className="text-[#007398] underline">Chicago Manual of Style Online</a>.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Book */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#001f3f] mb-3">Book</h4>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">Reference</p>
                  <p className="text-sm text-gray-800 mb-3 font-serif leading-relaxed">
                    Binder, Amy J., and Jeffrey L. Kidder. 2022. <em>The Channels of Student Activism: How the Left and Right Are Winning (and Losing) in Campus Politics Today</em>. University of Chicago Press.
                  </p>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">In-text</p>
                  <p className="text-sm text-gray-800 font-serif">(Binder and Kidder 2022, 117–18)</p>
                </div>

                {/* Edited Book Chapter */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#001f3f] mb-3">Edited Book Chapter</h4>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">Reference</p>
                  <p className="text-sm text-gray-800 mb-3 font-serif leading-relaxed">
                    Doyle, Kathleen. 2023. "The Queen Mary Psalter." In <em>The Book by Design: The Remarkable Story of the World's Greatest Invention</em>, edited by P. J. M. Marks and Stephen Parkin. University of Chicago Press.
                  </p>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">In-text</p>
                  <p className="text-sm text-gray-800 font-serif">(Doyle 2023, 64)</p>
                </div>

                {/* Journal Article */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#001f3f] mb-3">Journal Article</h4>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">Reference</p>
                  <p className="text-sm text-gray-800 mb-3 font-serif leading-relaxed">
                    Dittmar, Emily L., and Douglas W. Schemske. 2023. "Temporal Variation in Selection Influences Microgeographic Local Adaptation." <em>American Naturalist</em> 202 (4): 471–85. https://doi.org/10.1086/725865.
                  </p>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">In-text</p>
                  <p className="text-sm text-gray-800 font-serif">(Dittmar and Schemske 2023, 480)</p>
                  <p className="text-[11px] text-gray-400 mt-2">For 3 or more authors: (Snyder et al. 2025, 9–10)</p>
                </div>

                {/* Thesis or Dissertation */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#001f3f] mb-3">Thesis or Dissertation</h4>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">Reference</p>
                  <p className="text-sm text-gray-800 mb-3 font-serif leading-relaxed">
                    Blajer de la Garza, Yuna. 2019. "A House Is Not a Home: Citizenship and Belonging in Contemporary Democracies." PhD diss., University of Chicago. ProQuest (13865986).
                  </p>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">In-text</p>
                  <p className="text-sm text-gray-800 font-serif">(Blajer de la Garza 2019, 66–67)</p>
                </div>

                {/* Web Page */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#001f3f] mb-3">Web Page</h4>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">Reference</p>
                  <p className="text-sm text-gray-800 mb-3 font-serif leading-relaxed">
                    Google. 2023. "Privacy Policy." Privacy & Terms. Effective November 15. https://policies.google.com/privacy.
                  </p>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">In-text</p>
                  <p className="text-sm text-gray-800 font-serif">(Google 2023)</p>
                  <p className="text-[11px] text-gray-400 mt-2">No date: (Yale University n.d.) and add access date.</p>
                </div>

                {/* News or Magazine Article */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#001f3f] mb-3">Press or Magazine Article</h4>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">Reference</p>
                  <p className="text-sm text-gray-800 mb-3 font-serif leading-relaxed">
                    Blum, Dani. 2023. "Are Flax Seeds All That?" <em>New York Times</em>, December 13. https://www.nytimes.com/2023/12/13/well/eat/flax-seeds-benefits.html.
                  </p>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">In-text</p>
                  <p className="text-sm text-gray-800 font-serif">(Blum 2023)</p>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-[#f0f4f8] rounded-lg border-l-4 border-[#001f3f]">
                <p className="text-xs text-gray-600 font-serif leading-relaxed">
                  <strong>Important note:</strong> Place of publication is no longer required for books 
                  (CMOS 14.30). For articles with more than six authors, list the first three followed by 
                  "et al." in the reference. In-text, use "et al." from three authors. 
                  Personal communications (emails, messages) are cited only in the text and not included 
                  in the references. For any other document type, refer to the 
                  <a href="https://www.revistacienciasestudiantes.com/policies.html" target="_blank" rel="noopener noreferrer" className="text-[#007398] underline"> Full Editorial Policies</a> and the 
                  <a href="https://www.chicagomanualofstyle.org/tools_citationguide/citation-guide-2.html" target="_blank" rel="noopener noreferrer" className="text-[#007398] underline"> official Chicago manual</a>.
                </p>
              </div>
            </motion.div>

            {/* Audiovisual Workshops */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h3 className="text-xs uppercase tracking-[0.3em] font-black text-gray-400 mb-6 italic underline">Audiovisual Workshops</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="aspect-video bg-black rounded-sm overflow-hidden shadow-xl">
                  <iframe width="100%" height="100%" src="https://www.youtube.com/embed/wyPhAGW6-94" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="Workshop 1" />
                </div>
                <div className="aspect-video bg-black rounded-sm overflow-hidden shadow-xl">
                  <iframe width="100%" height="100%" src="https://www.youtube.com/embed/videoseries?list=PL8yQlmhs7KsBerg9X63QnZnlNAopwzDmw" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="Playlist" />
                </div>
              </div>
            </motion.div>

            {/* Academic Tools Highlight */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white border border-gray-200 p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden rounded-lg shadow-md"
            >
              <div className="absolute top-0 right-0 bg-[#007398] text-white text-[8px] font-bold px-3 py-1 uppercase tracking-tighter">
                Recommended
              </div>
              <img src="https://www.revistacienciasestudiantes.com/academic-tools/assets/logoP.png" className="w-24 h-24 object-contain grayscale hover:grayscale-0 transition-all" alt="Logo" />
              <div>
                <h4 className="text-xl font-serif font-bold mb-2">Academic Tools</h4>
                <p className="text-sm text-gray-500 mb-4 font-serif italic">Comprehensive platform for PDF management, automatic citation, and academic text processing.</p>
                <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase text-[#007398]">
                  <span>• PDF Management</span> <span>• Citation Generator</span> <span>• Text Analysis</span>
                </div>
                <a href="https://www.revistacienciasestudiantes.com/academic-tools" className="mt-6 inline-block text-[11px] font-black uppercase tracking-widest border-b-2 border-black pb-1 hover:border-[#007398] hover:text-[#007398] transition-all">
                  Access the Suite →
                </a>
              </div>
            </motion.div>

            {/* Recommended Resources */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <h3 className="text-xs uppercase tracking-[0.3em] font-black text-gray-400 mb-6 italic underline">Recommended Resources</h3>
              <div className="grid grid-cols-1 gap-4">
                {resources.map((resource, i) => (
                  <a
                    key={i}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
                  >
                    <h4 className="text-sm font-bold text-[#007398] mb-1">{resource.name}</h4>
                    <p className="text-gray-600 text-xs">{resource.desc}</p>
                  </a>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default GuidelinesSection;