import React from 'react';
import { motion } from 'framer-motion';

function GuidelinesSection() {
  const resources = [
    { name: 'Google Scholar', url: 'https://scholar.google.com/', desc: 'Leading search engine for academic literature.' },
    { name: 'SciELO', url: 'https://scielo.org/en/', desc: 'Open access scientific library.' },
    { name: 'Consensus', url: 'https://consensus.app/', desc: 'AI-powered scientific evidence search.' }
  ];

  return (
    <section className="py-20 bg-[#fafafa]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          {/* Editorial Guidelines */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-1"
          >
            <h2 className="text-3xl font-serif font-bold mb-8">Editorial Guidelines</h2>
            <ul className="space-y-6">
              {[
                { label: 'Length', val: '1,000–10,000 words' },
                { label: 'Format', val: 'Word (.docx) anonymous' },
                { label: 'Citation', val: 'Chicago Style (Exclusive)', link: 'https://www.chicagomanualofstyle.org' },
                { label: 'Languages', val: 'Spanish and English' }
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
            <a href="https://www.revistacienciasestudiantes.com/policiesEN.html" className="mt-8 inline-block bg-black text-white px-6 py-3 text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-[#007398] transition-colors">
              Full Policies
            </a>
          </motion.div>
          {/* Videos and Resources */}
          <div className="lg:col-span-2 space-y-12">
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