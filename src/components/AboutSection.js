import React from 'react';
import { motion } from 'framer-motion';

function AboutSection() {
  return (
    <section className="py-24 md:py-32 bg-white text-[#002147] font-sans overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 md:px-12">
        
        {/* Título Principal */}
        <motion.div 
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true }}
          className="mb-20 md:mb-24 md:text-center"
        >
          <div className="w-14 h-[3px] bg-[#FF5722] mb-8 md:mx-auto rounded-full" />
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold tracking-tight mb-6 leading-[1.15]">
            Impulsando a la próxima generación <br className="hidden md:block" />
            del <span className="italic text-[#FF5722]">rigor científico</span>
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl md:mx-auto font-light leading-relaxed">
            Una revista científica arbitrada por pares, dedicada a difundir e impulsar la investigación temprana a nivel escolar y universitario.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 xl:gap-20 mb-24 md:mb-32">
          
          {/* Columna de Texto Principal */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="lg:col-span-7 space-y-8 text-[17px] leading-relaxed text-gray-700"
          >
            <p>
              La <strong className="text-[#002147] font-semibold">Revista Nacional de las Ciencias para Estudiantes</strong> es una publicación académica de alto estándar. Nuestro propósito es democratizar el acceso a la publicación científica y demostrar que el talento investigativo no tiene por qué esperar a un posgrado.
            </p>
            
            {/* Cita de Independencia */}
            <div className="relative border-l-[3px] border-[#FF5722] pl-7 py-1 my-10">
              <p className="font-serif italic text-[22px] md:text-2xl text-[#002147] leading-snug tracking-tight">
                “Operamos como una iniciativa científica independiente, libre de afiliaciones institucionales restrictivas, lo que nos garantiza una autonomía editorial total.”
              </p>
            </div>
            
            <div>
              <h3 className="text-xl md:text-2xl font-serif font-bold text-[#002147] mb-4 flex items-center gap-3">
                <span className="w-2.5 h-2.5 bg-[#FF5722] rounded-full flex-shrink-0" />
                Comité Científico de Excelencia
              </h3>
              <p>
                El rigor de nuestras publicaciones está respaldado por un <strong className="text-[#002147]">Comité Científico en constante crecimiento</strong>, integrado por destacados académicos y profesores de las principales universidades del país. Ellos garantizan que cada artículo cumpla estrictamente con los estándares internacionales de evaluación mediante <span className="font-semibold text-[#002147]">revisión doble ciego (peer-review)</span>.
              </p>
            </div>
          </motion.div>

          {/* Columna Lateral — PentaUC (rediseñada) */}
          <motion.div 
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            viewport={{ once: true }}
            className="lg:col-span-5"
          >
            <div className="group relative bg-[#002147] text-white rounded-2xl overflow-hidden shadow-2xl shadow-[#002147]/25">
              
              {/* Imagen de portada */}
              <div className="relative h-52 md:h-56 overflow-hidden">
                <img 
                  src="https://academiadetalentos.uc.cl/wp-content/uploads/2026/06/IMG_20251114_185713582_HDR-1-1024x768.jpg"
                  alt="Academia de Talentos Penta UC"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#002147] via-[#002147]/40 to-transparent" />
                
                {/* Logo Penta UC */}
                <div className="absolute top-5 left-5">
                  <img 
                    src="https://cdn.brandfetch.io/pentauc.cl/fallback/lettermark/theme/dark/h/256/w/256/icon?c=1bfwsmEH20zzEfSNTed"
                    alt="Penta UC"
                    className="h-11 w-11 object-contain drop-shadow-md"
                  />
                </div>
              </div>

              {/* Contenido */}
              <div className="p-7 md:p-8 relative">
                <span className="text-white/60 font-semibold text-[11px] tracking-[0.22em] uppercase mb-3 block">
                  Aparición en Prensa
                </span>
                
                <h4 className="text-2xl md:text-[26px] font-serif font-bold mb-4 leading-tight">
                  Reconocidos por PentaUC
                </h4>
                
                <p className="text-white/75 text-[15px] font-light leading-relaxed mb-7">
                  La Academia de Talentos de la Pontificia Universidad Católica de Chile destacó nuestra iniciativa por visibilizar investigaciones escolares y universitarias a nivel nacional.
                </p>
                
                <a 
                  href="https://academiadetalentos.uc.cl/2026/06/25/estudiantes-del-programa-penta-uc-crean-revista-de-ciencias-para-visibilizar-investigaciones-escolares-y-universitarias/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 text-[#FF5722] hover:text-white transition-colors duration-300 font-semibold text-sm tracking-wide group/link"
                >
                  Leer reportaje completo
                  <svg 
                    className="w-4 h-4 transform transition-transform duration-300 group-hover/link:translate-x-1" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </a>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Sección de Indexación */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          viewport={{ once: true }}
          className="border-t border-gray-100 pt-16 md:pt-20"
        >
          <div className="text-center mb-14">
            <span className="text-[#FF5722] font-semibold text-xs tracking-[0.25em] uppercase block mb-3">
              Visibilidad Global
            </span>
            <h3 className="text-2xl md:text-3xl font-serif font-bold text-[#002147]">
              Indexación y Repositorios
            </h3>
          </div>
          
          {/* Logos reales */}
          <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-10 md:gap-x-16 lg:gap-x-20">
            
            {/* ISSN */}
            <a href="https://www.issn.org" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 transition-opacity duration-300">
              <img 
                src="https://www.issn.org/wp-content/themes/themeissn/img/logo.jpg" 
                alt="ISSN" 
                className="h-10 md:h-12 object-contain"
              />
            </a>
            
            {/* Zenodo */}
            <a href="https://zenodo.org" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 transition-opacity duration-300">
              <img 
                src="https://about.zenodo.org/static/img/logos/zenodo-black-2500.png" 
                alt="Zenodo" 
                className="h-8 md:h-9 object-contain"
              />
            </a>
            
            {/* OpenAIRE */}
            <a href="https://www.openaire.eu" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 transition-opacity duration-300">
              <img 
                src="https://tse4.mm.bing.net/th/id/OIP.Ok4TXwQO3PnlhTOywrfwggHaDx?r=0&pid=Api&h=220&P=0" 
                alt="OpenAIRE" 
                className="h-9 md:h-10 object-contain"
              />
            </a>
            
            {/* Google Scholar */}
            <a href="https://scholar.google.com" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 transition-opacity duration-300">
              <img 
                src="https://images.seeklogo.com/logo-png/48/1/google-scholar-logo-png_seeklogo-484488.png" 
                alt="Google Scholar" 
                className="h-9 md:h-10 object-contain"
              />
            </a>
            
            {/* Latindex */}
            <a href="https://www.latindex.org" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 transition-opacity duration-300">
              <img 
                src="https://tse1.mm.bing.net/th/id/OIP.Kdslv0V6b9hey7IyvJyMdwHaEu?r=0&pid=Api&h=220&P=0" 
                alt="Latindex" 
                className="h-10 md:h-11 object-contain"
              />
            </a>
            
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default AboutSection;