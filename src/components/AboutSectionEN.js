import React from 'react';
import { motion } from 'framer-motion';
import { AcademicCapIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

function AboutSection() {
  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  // Essential indexing platforms only
  const indexingPlatforms = [
    { name: 'ISSN', url: 'https://www.issn.org', logo: 'https://www.issn.org/wp-content/themes/themeissn/img/logo.jpg' },
    { name: 'Zenodo', url: 'https://zenodo.org', logo: 'https://about.zenodo.org/static/img/logos/zenodo-black-2500.png' },
    { name: 'OpenAIRE', url: 'https://www.openaire.eu', logo: 'https://tse4.mm.bing.net/th/id/OIP.Ok4TXwQO3PnlhTOywrfwggHaDx?r=0&pid=Api&h=220&P=0' },
    { name: 'Google Scholar', url: 'https://scholar.google.com', logo: 'https://images.seeklogo.com/logo-png/48/1/google-scholar-logo-png_seeklogo-484488.png' },
    { name: 'Latindex', url: 'https://www.latindex.org', logo: 'https://tse1.mm.bing.net/th/id/OIP.Kdslv0V6b9hey7IyvJyMdwHaEu?r=0&pid=Api&h=220&P=0' }
  ];

  return (
    <section className="py-24 md:py-32 bg-white text-[#002147] font-sans border-t border-slate-200">
      <div className="max-w-6xl mx-auto px-6 md:px-12">
        
        {/* Main Title */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-20 md:mb-28 border-b-2 border-[#002147] pb-10">
          <span className="text-[#e86125] font-bold text-[10px] tracking-[0.25em] uppercase mb-4 block">
            About the Journal
          </span>
          <h2 className="text-4xl md:text-6xl font-serif font-bold tracking-tight leading-[1.1] max-w-4xl text-[#002147]">
            Empowering the next generation of <span className="text-[#e86125] italic">scientific rigor.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 mb-24 md:mb-32">
          
          {/* Main Text Column */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="lg:col-span-7">
            <div className="prose prose-lg prose-slate text-slate-700 font-serif leading-relaxed">
              <p className="text-xl">
                The <strong className="text-[#002147] font-sans">National Review of Sciences for Students</strong> is an academic publication that democratizes access to science, demonstrating that early research talent possesses validity and empirical rigor.
              </p>
              
              <blockquote className="my-10 pl-6 border-l-4 border-[#e86125] text-2xl font-bold text-[#002147] italic">
                "We operate as an independent scientific initiative, with absolute editorial autonomy."
              </blockquote>
              
              <div className="flex items-start gap-3 mt-8">
                <AcademicCapIcon className="w-6 h-6 text-[#e86125] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-sm font-bold font-sans uppercase tracking-widest text-[#002147] mb-2">
                    Scientific Committee
                  </h3>
                  <p className="text-base">
                    Backed by active academics from leading universities. Each manuscript undergoes <strong className="text-[#002147] font-sans">double-blind peer review</strong>.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Side Column — PentaUC */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="lg:col-span-5">
            <div className="border border-slate-300 p-2 bg-slate-50 rounded-sm">
              <div className="bg-white border border-slate-200 p-8">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
                  <span className="text-[#e86125] font-bold text-[10px] tracking-widest uppercase">Press</span>
                  <img src="https://cdn.brandfetch.io/pentauc.cl/fallback/lettermark/theme/dark/h/256/w/256/icon?c=1bfwsmEH20zzEfSNTed" alt="Penta UC" className="h-6 w-6 grayscale opacity-80" />
                </div>
                
                <h4 className="text-2xl font-serif font-bold mb-4 text-[#002147] leading-tight">
                  Recognized by Penta UC
                </h4>
                
                <div className="aspect-[4/3] mb-6 overflow-hidden bg-slate-100 border border-slate-200 rounded-sm">
                  <img 
                    src="https://www.revistacienciasestudiantes.com/images/img-1787683945345-vfjy7c.webp"
                    alt="Penta UC"
                    className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                  />
                </div>
                
                <p className="text-sm text-slate-600 font-serif leading-relaxed mb-6">
                  The Penta UC Talent Academy highlighted our initiative for showcasing high school and university research.
                </p>
                
                <a href="https://academiadetalentos.uc.cl/2026/06/25/estudiantes-del-programa-penta-uc-crean-revista-de-ciencias-para-visibilizar-investigaciones-escolares-y-universitarias/" target="_blank" rel="noopener noreferrer" className="group block text-center bg-[#002147] text-white text-xs font-bold uppercase tracking-widest py-3 px-4 hover:bg-[#e86125] transition-colors rounded-sm">
                  <span className="inline-flex items-center gap-2">
                    Read Feature
                    <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </a>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Indexing Section */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="border-t border-slate-200 pt-16">
          <h3 className="text-2xl font-serif font-bold text-[#002147] mb-10">
            Indexing
          </h3>
          
          <div className="flex flex-wrap justify-center md:justify-start items-center gap-10 md:gap-16 opacity-70">
            {indexingPlatforms.map((platform) => (
              <a 
                key={platform.name}
                href={platform.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="grayscale hover:grayscale-0 transition-all duration-300"
                title={platform.name}
              >
                <img 
                  src={platform.logo} 
                  alt={platform.name} 
                  className="h-8 object-contain"
                />
              </a>
            ))}
          </div>
        </motion.div>

      </div>
    </section>
  );
}

export default AboutSection;