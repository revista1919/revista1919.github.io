import React from 'react';
import { motion } from 'framer-motion';

function GuidelinesSection() {
  const resources = [
    { name: 'Google Scholar', url: 'https://scholar.google.com/', desc: 'Buscador líder para literatura académica.' },
    { name: 'SciELO', url: 'https://scielo.org/es/', desc: 'Biblioteca científica de acceso abierto.' },
    { name: 'Consensus', url: 'https://consensus.app/', desc: 'Buscador de evidencia científica con IA.' }
  ];

  const keySpecs = [
    { label: 'Extensión', val: '1.000–10.000 palabras (incluyendo referencias)' },
    { label: 'Formato', val: 'Microsoft Word (.docx). Documento anonimizado para revisión doble ciego.' },
    { label: 'Citación', val: 'Chicago 17.ª ed. (Autor-Fecha)', link: 'https://www.chicagomanualofstyle.org/tools_citationguide/citation-guide-2.html' },
    { label: 'Idiomas', val: 'Español e Inglés (título, resumen y palabras clave en ambos)' },
    { label: 'Palabras clave', val: '2–6 libres + códigos de vocabulario controlado (JEL, MeSH, ACM, UNESCO)', link: 'https://www.revistacienciasestudiantes.com/policies.html#tabla-vocabularios' },
    { label: 'Originalidad', val: 'Similitud máxima permitida: 15%' },
    { label: 'Ética', val: 'Aprobación de comité cuando corresponda; declaración en el manuscrito.' }
  ];

  return (
    <section className="py-24 md:py-32 bg-[#fafafa] text-[#002147] font-sans overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 md:px-12">
        
        {/* Título de sección */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-16 md:mb-20"
        >
          <div className="w-14 h-[3px] bg-[#FF5722] mb-6 rounded-full" />
          <h2 className="text-3xl md:text-4xl font-serif font-bold tracking-tight">
            Guía para Autores
          </h2>
          <p className="mt-4 text-gray-600 max-w-2xl text-lg font-light leading-relaxed">
            Todo lo necesario para preparar y enviar tu manuscrito con claridad y rigor editorial.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          
          {/* ——— Columna izquierda ——— */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="lg:col-span-5 space-y-10"
          >
            {/* CTA Guía Rápida */}
            <div className="bg-[#002147] text-white p-7 md:p-8 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#FF5722] rounded-full translate-x-10 -translate-y-10 opacity-80" />
              <p className="relative z-10 text-[15px] font-light leading-relaxed mb-6">
                ¿Primera vez publicando? Tenemos una <strong className="font-semibold">Guía Rápida Interactiva</strong> con checklist visual. 
                Te toma 5 minutos y te indica exactamente qué necesitas.
              </p>
              <a 
                href="/quick.html" 
                className="relative z-10 inline-flex items-center gap-2 bg-[#FF5722] text-white px-5 py-3 text-xs font-semibold tracking-wide uppercase hover:bg-white hover:text-[#002147] transition-colors duration-300"
              >
                Abrir Guía Rápida
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </div>

            {/* Enlaces a guías */}
            <div className="space-y-3">
              <a 
                href="/quick.html" 
                className="group block p-5 bg-white border border-[#FF5722]/40 rounded-xl hover:border-[#FF5722] hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <h3 className="text-sm font-semibold text-[#002147] group-hover:text-[#FF5722] transition-colors">
                    Guía Rápida Interactiva
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-[#FF5722] px-2.5 py-1 rounded-full flex-shrink-0">
                    Recomendado
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Checklist visual con lo esencial. Incluye enlaces a vocabularios controlados.
                </p>
              </a>

              {[
                { href: '/author.html', title: 'Guía Completa para Autores', desc: 'Instrucciones detalladas para la preparación y envío de manuscritos.' },
                { href: '/practices.html', title: 'Guía de Buenas Prácticas', desc: 'Estándares éticos y mejores prácticas para la publicación académica.' },
                { href: '/open-access.html', title: 'Políticas de Open Access', desc: 'Licencias, derechos de autor y acceso abierto.' }
              ].map((item) => (
                <a 
                  key={item.href}
                  href={item.href} 
                  className="group block p-5 bg-white border border-gray-200 rounded-xl hover:border-[#002147]/30 hover:shadow-sm transition-all duration-300"
                >
                  <h3 className="text-sm font-semibold text-[#002147] group-hover:text-[#FF5722] transition-colors mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {item.desc}
                  </p>
                </a>
              ))}
            </div>

            {/* Especificaciones clave */}
            <div>
              <h3 className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-400 mb-5">
                Requisitos esenciales
              </h3>
              <ul className="space-y-5">
                {keySpecs.map((item, i) => (
                  <li key={i} className="border-b border-gray-200 pb-4 last:border-0">
                    <span className="text-[11px] uppercase font-semibold tracking-wider text-gray-400 block mb-1">
                      {item.label}
                    </span>
                    {item.link ? (
                      <a 
                        href={item.link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[15px] text-[#002147] font-medium hover:text-[#FF5722] underline decoration-gray-300 underline-offset-2 transition-colors"
                      >
                        {item.val}
                      </a>
                    ) : (
                      <span className="text-[15px] text-[#002147] font-medium">
                        {item.val}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* ——— Columna derecha ——— */}
          <div className="lg:col-span-7 space-y-14">
            
            {/* Estilo de citación Chicago */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="w-2 h-2 bg-[#FF5722] rounded-full" />
                <h3 className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-500">
                  Estilo de citación · Chicago 17.ª ed. (Autor-Fecha)
                </h3>
              </div>

              <p className="text-[15px] text-gray-600 mb-8 leading-relaxed">
                Se utiliza el sistema <strong className="text-[#002147]">autor-fecha</strong> del <em>Chicago Manual of Style</em>. 
                Las citas van entre paréntesis en el texto y las referencias completas al final bajo el título «Referencias». 
                Consulta la{' '}
                <a 
                  href="https://www.chicagomanualofstyle.org/tools_citationguide/citation-guide-2.html" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[#FF5722] underline underline-offset-2 hover:text-[#002147] transition-colors"
                >
                  guía oficial
                </a>
                {' '}para casos no contemplados.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  {
                    title: 'Libro',
                    ref: 'Binder, Amy J., y Jeffrey L. Kidder. 2022. The Channels of Student Activism: How the Left and Right Are Winning (and Losing) in Campus Politics Today. University of Chicago Press.',
                    text: '(Binder y Kidder 2022, 117–18)'
                  },
                  {
                    title: 'Capítulo de libro editado',
                    ref: 'Doyle, Kathleen. 2023. «The Queen Mary Psalter». En The Book by Design: The Remarkable Story of the World’s Greatest Invention, editado por P. J. M. Marks y Stephen Parkin. University of Chicago Press.',
                    text: '(Doyle 2023, 64)'
                  },
                  {
                    title: 'Artículo de revista',
                    ref: 'Dittmar, Emily L., y Douglas W. Schemske. 2023. «Temporal Variation in Selection Influences Microgeographic Local Adaptation». American Naturalist 202 (4): 471–85. https://doi.org/10.1086/725865.',
                    text: '(Dittmar y Schemske 2023, 480)',
                    note: '3 o más autores: (Snyder et al. 2025, 9–10)'
                  },
                  {
                    title: 'Tesis o disertación',
                    ref: 'Blajer de la Garza, Yuna. 2019. «A House Is Not a Home: Citizenship and Belonging in Contemporary Democracies». PhD diss., University of Chicago. ProQuest (13865986).',
                    text: '(Blajer de la Garza 2019, 66–67)'
                  },
                  {
                    title: 'Página web',
                    ref: 'Google. 2023. «Privacy Policy». Privacy & Terms. Effective November 15. https://policies.google.com/privacy.',
                    text: '(Google 2023)',
                    note: 'Sin fecha: (Yale University n.d.) + fecha de acceso.'
                  },
                  {
                    title: 'Artículo de prensa',
                    ref: 'Blum, Dani. 2023. «Are Flax Seeds All That?» New York Times, December 13. https://www.nytimes.com/2023/12/13/well/eat/flax-seeds-benefits.html.',
                    text: '(Blum 2023)'
                  }
                ].map((ex) => (
                  <div 
                    key={ex.title}
                    className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300"
                  >
                    <h4 className="text-[11px] font-semibold tracking-wider uppercase text-[#002147] mb-3">
                      {ex.title}
                    </h4>
                    <p className="text-[11px] text-gray-400 mb-1.5 uppercase tracking-wide">Referencia</p>
                    <p className="text-[13px] text-gray-700 mb-3 leading-relaxed font-serif">
                      {ex.ref}
                    </p>
                    <p className="text-[11px] text-gray-400 mb-1.5 uppercase tracking-wide">En el texto</p>
                    <p className="text-[13px] text-gray-800 font-medium">
                      {ex.text}
                    </p>
                    {ex.note && (
                      <p className="text-[11px] text-gray-400 mt-2 leading-snug">
                        {ex.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Nota importante */}
              <div className="mt-6 p-5 bg-white border-l-[3px] border-[#FF5722] rounded-r-xl">
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  <strong className="text-[#002147]">Nota:</strong> El lugar de publicación ya no es obligatorio para libros (CMOS 14.30). 
                  Para más de seis autores, liste los tres primeros seguidos de «et al.». 
                  Las comunicaciones personales se citan solo en el texto. 
                  Consulta las{' '}
                  <a href="https://www.revistacienciasestudiantes.com/policies.html" className="text-[#FF5722] underline underline-offset-2 hover:text-[#002147]">
                    Políticas Editoriales
                  </a>
                  {' '}y el{' '}
                  <a href="https://www.chicagomanualofstyle.org/tools_citationguide/citation-guide-2.html" target="_blank" rel="noopener noreferrer" className="text-[#FF5722] underline underline-offset-2 hover:text-[#002147]">
                    manual oficial
                  </a>.
                </p>
              </div>
            </motion.div>

            {/* Talleres Audiovisuales */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="w-2 h-2 bg-[#FF5722] rounded-full" />
                <h3 className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-500">
                  Talleres Audiovisuales
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="aspect-video bg-[#002147] rounded-xl overflow-hidden shadow-lg">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    src="https://www.youtube.com/embed/wyPhAGW6-94" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen 
                    title="Taller 1"
                    className="w-full h-full"
                  />
                </div>
                <div className="aspect-video bg-[#002147] rounded-xl overflow-hidden shadow-lg">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    src="https://www.youtube.com/embed/videoseries?list=PL8yQlmhs7KsBerg9X63QnZnlNAopwzDmw" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen 
                    title="Playlist de talleres"
                    className="w-full h-full"
                  />
                </div>
              </div>
            </motion.div>

            {/* Academic Tools */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              viewport={{ once: true }}
              className="bg-white border border-gray-100 p-7 md:p-8 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-6 relative"
            >
              <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider text-white bg-[#FF5722] px-2.5 py-1 rounded-full">
                Recomendado
              </span>
              
              <img 
                src="https://www.revistacienciasestudiantes.com/academic-tools/assets/logoP.png" 
                className="w-20 h-20 object-contain flex-shrink-0" 
                alt="Academic Tools" 
              />
              
              <div className="flex-1">
                <h4 className="text-xl font-serif font-bold text-[#002147] mb-1.5">
                  Academic Tools
                </h4>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                  Plataforma integral para gestión de PDFs, citación automática y procesamiento de texto académico.
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] font-semibold uppercase tracking-wide text-[#002147]/70 mb-5">
                  <span>Gestión PDF</span>
                  <span>Generador de citas</span>
                  <span>Análisis de texto</span>
                </div>
                <a 
                  href="https://www.revistacienciasestudiantes.com/academic-tools" 
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#FF5722] hover:text-[#002147] transition-colors"
                >
                  Acceder a la suite
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </a>
              </div>
            </motion.div>

            {/* Recursos recomendados */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="w-2 h-2 bg-[#FF5722] rounded-full" />
                <h3 className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-500">
                  Recursos recomendados
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {resources.map((resource) => (
                  <a
                    key={resource.name}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block p-5 bg-white border border-gray-100 rounded-xl hover:border-[#002147]/20 hover:shadow-md transition-all duration-300"
                  >
                    <h4 className="text-sm font-semibold text-[#002147] group-hover:text-[#FF5722] transition-colors mb-1.5">
                      {resource.name}
                    </h4>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {resource.desc}
                    </p>
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