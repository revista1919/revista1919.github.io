import React from 'react';
import { motion } from 'framer-motion';

function AboutSection() {
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
          <h2 className="text-3xl sm:text-4xl font-serif text-black mb-3 tracking-tight">
            Empowering the next generation of <span className="italic text-[#e86125]">scientific rigor.</span>
          </h2>
          <p className="text-[15px] text-[#666666] max-w-2xl mx-auto font-sans">
            A peer-reviewed scientific journal dedicated to disseminating and promoting early research at both high school and university levels.
          </p>
          <div className="h-[2px] w-16 bg-[#e86125] mx-auto mt-6"></div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mb-12">
          
          {/* Institutional Text */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="lg:col-span-7 space-y-8"
          >
            <p className="text-[15px] text-[#2b2b2b] leading-relaxed font-sans">
              The <strong className="text-black">National Review of Sciences for Students</strong> is a high-standard academic publication. Our purpose is to democratize access to scientific publishing and demonstrate that research talent does not have to wait for graduate school.
            </p>
            
            {/* Pull Quote */}
            <blockquote className="border-l-4 border-[#e86125] pl-6 py-2">
              <p className="font-serif text-xl md:text-2xl font-light text-black leading-snug">
                "We operate as an independent scientific initiative, free from restrictive institutional affiliations, ensuring total editorial autonomy."
              </p>
            </blockquote>
            
            <div className="bg-white border border-[#e6e8ea] rounded-sm shadow-sm">
              <h3 className="text-[13px] font-bold font-sans uppercase tracking-wider text-black px-6 pt-5 pb-3 border-b border-[#e6e8ea]">
                Scientific Committee
              </h3>
              <div className="px-6 py-4">
                <p className="text-[14px] text-[#2b2b2b] leading-relaxed font-sans">
                  The rigor of our publications is backed by a Scientific Committee comprised of distinguished academics from the country's leading universities. They ensure that each article strictly meets international standards through <span className="italic">double-blind peer review</span>.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Press Box (Penta UC) */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="lg:col-span-5"
          >
            <div className="bg-white border border-[#e6e8ea] rounded-sm shadow-sm">
              <div className="relative aspect-[4/3] bg-[#f4f5f7] overflow-hidden rounded-t-sm">
                <img 
                  src="https://www.revistacienciasestudiantes.com/images/img-1787683945345-vfjy7c.webp"
                  alt="Penta UC Talent Academy"
                  className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                />
                <div className="absolute top-0 left-0 bg-white p-3 border-r border-b border-[#e6e8ea]">
                  <img 
                    src="https://cdn.brandfetch.io/pentauc.cl/fallback/lettermark/theme/dark/h/256/w/256/icon?c=1bfwsmEH20zzEfSNTed"
                    alt="Penta UC"
                    className="h-8 w-8 object-contain"
                  />
                </div>
              </div>
              
              <div className="p-6">
                <span className="text-[#e86125] font-bold text-[10px] tracking-[0.2em] uppercase mb-2 block font-sans">
                  Press Feature
                </span>
                <h4 className="text-lg font-serif font-semibold text-black mb-3 tracking-tight">
                  Recognized by Penta UC
                </h4>
                <p className="text-[13px] text-[#666666] leading-relaxed mb-5 font-sans">
                  The Talent Academy of the Pontifical Catholic University of Chile highlighted our initiative for showcasing high school research nationwide.
                </p>
                <a 
                  href="https://academiadetalentos.uc.cl/2026/06/25/estudiantes-del-programa-penta-uc-crean-revista-de-ciencias-para-visibilizar-investigaciones-escolares-y-universitarias/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold uppercase tracking-widest text-[#002147] border-b border-[#002147] pb-1 hover:text-[#e86125] hover:border-[#e86125] transition-colors font-sans"
                >
                  Read Original Document
                </a>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Indexing Section */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="border-t-2 border-[#e6e8ea] pt-10"
        >
          <div className="text-center mb-8">
            <h3 className="text-[13px] font-bold font-sans uppercase tracking-[0.2em] text-[#a0a0a0]">
              Indexing and Databases
            </h3>
          </div>
          
          <div className="flex flex-wrap justify-center items-center gap-10 md:gap-16 opacity-70">
            {[
              { url: 'https://www.issn.org', img: 'https://www.issn.org/wp-content/themes/themeissn/img/logo.jpg', alt: 'ISSN' },
              { url: 'https://zenodo.org', img: 'https://about.zenodo.org/static/img/logos/zenodo-black-2500.png', alt: 'Zenodo' },
              { url: 'https://www.openaire.eu', img: 'https://tse4.mm.bing.net/th/id/OIP.Ok4TXwQO3PnlhTOywrfwggHaDx?r=0&pid=Api&h=220&P=0', alt: 'OpenAIRE' },
              { url: 'https://scholar.google.com', img: 'https://images.seeklogo.com/logo-png/48/1/google-scholar-logo-png_seeklogo-484488.png', alt: 'Google Scholar' },
              { url: 'https://www.latindex.org', img: 'https://tse1.mm.bing.net/th/id/OIP.Kdslv0V6b9hey7IyvJyMdwHaEu?r=0&pid=Api&h=220&P=0', alt: 'Latindex' }
            ].map((logo) => (
              <a 
                key={logo.alt}
                href={logo.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-300"
              >
                <img src={logo.img} alt={logo.alt} className="h-8 md:h-10 object-contain mix-blend-multiply" />
              </a>
            ))}
          </div>
        </motion.div>
        
      </div>
    </section>
  );
}

export default AboutSection;