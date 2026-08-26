import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRightIcon, DocumentTextIcon, CheckCircleIcon, BookOpenIcon, AcademicCapIcon, ScaleIcon } from '@heroicons/react/24/outline';

function GuidelinesSection() {
  const resources = [
    { name: 'Google Scholar', url: 'https://scholar.google.com/', desc: 'Buscador líder para literatura académica.' },
    { name: 'SciELO', url: 'https://scielo.org/es/', desc: 'Biblioteca científica de acceso abierto.' },
    { name: 'Consensus', url: 'https://consensus.app/', desc: 'Buscador de evidencia científica con IA.' }
  ];

  const keySpecs = [
    { label: 'Extensión', val: '1.000–10.000 palabras (incluyendo referencias)' },
    { label: 'Formato', val: 'Microsoft Word (.docx) o LaTeX. Documento anonimizado (Double-blind).' },
    { label: 'Citación', val: 'Chicago 17.ª ed. (Autor-Fecha)', link: 'https://www.chicagomanualofstyle.org/' },
    { label: 'Idiomas', val: 'Español e Inglés (Metadatos en ambos idiomas obligatorios)' },
    { label: 'Keywords', val: '2–6 libres + Códigos controlados (JEL, MeSH, ACM)', link: '/policies.html' },
    { label: 'Originalidad', val: 'Índice de similitud máximo: 15% (iThenticate/Turnitin)' }
  ];

  const fadeUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <section className="py-20 md:py-32 bg-[#fafafa] text-[#002147] font-sans border-t border-slate-200">
      <div className="max-w-6xl mx-auto px-6 md:px-12">
        
        {/* HEADER DE SECCIÓN */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-20">
          <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#e86125] mb-4 block">
            Directrices // Preparación
          </span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold tracking-tight mb-6 text-[#002147]">
            Guía para Autores
          </h2>
          <p className="text-slate-600 max-w-2xl text-lg font-serif leading-relaxed">
            Instrucciones formales para la preparación, estructuración y envío de manuscritos. El cumplimiento de estas directrices es requisito para superar el <em>Desk Review</em>.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          
          {/* COLUMNA IZQUIERDA (Specs & Enlaces) */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="lg:col-span-5 space-y-12">
            
            {/* CTA Guía Rápida (Estilo Bloque Editorial) */}
            <div className="bg-[#002147] text-white p-8 rounded-sm border-l-4 border-[#e86125]">
              <h3 className="text-xl font-serif font-bold mb-3">Guía Rápida Interactiva</h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-6 font-light">
                Herramienta de pre-evaluación. Un checklist visual de 5 minutos para garantizar que su documento cumple con los estándares técnicos antes del envío.
              </p>
              <a href="/quick.html" className="inline-flex items-center gap-3 bg-[#e86125] text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-white hover:text-[#002147] transition-colors rounded-sm">
                Iniciar Checklist
                <ArrowRightIcon className="w-4 h-4" />
              </a>
            </div>

            {/* Documentos Normativos */}
            <div>
              <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400 mb-4 border-b border-slate-200 pb-2">Documentos Normativos</h4>
              <ul className="space-y-0">
                {[
                  { href: '/author.html', title: 'Manual Completo para Autores', desc: 'Instrucciones detalladas de formato y estilo.', icon: BookOpenIcon },
                  { href: '/practices.html', title: 'Declaración de Ética (COPE)', desc: 'Estándares contra plagio, autoría fantasma y conflictos.', icon: ScaleIcon },
                  { href: '/open-access.html', title: 'Licenciamiento Open Access', desc: 'Términos CC-BY 4.0 y retención de derechos.', icon: CheckCircleIcon }
                ].map((item, idx) => (
                  <li key={idx}>
                    <a href={item.href} className="group flex items-start gap-4 py-4 border-b border-slate-200 hover:bg-slate-50 transition-colors px-2 -mx-2">
                      <item.icon className="w-5 h-5 text-[#e86125] mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h5 className="text-sm font-bold text-[#002147] group-hover:text-[#e86125] transition-colors mb-1">
                          {item.title}
                        </h5>
                        <p className="text-xs text-slate-500 font-serif italic">{item.desc}</p>
                      </div>
                      <ArrowRightIcon className="w-4 h-4 text-slate-300 group-hover:text-[#e86125] group-hover:translate-x-1 transition-all mt-1" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Especificaciones Técnicas (Estilo Tabla) */}
            <div>
              <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400 mb-4 border-b border-slate-200 pb-2">Especificaciones Técnicas</h4>
              <dl className="divide-y divide-slate-200 text-sm">
                {keySpecs.map((item, i) => (
                  <div key={i} className="py-3 flex flex-col sm:flex-row sm:justify-between sm:gap-4">
                    <dt className="font-bold text-[#002147] min-w-[120px] uppercase text-[11px] tracking-wider mt-0.5">{item.label}</dt>
                    <dd className="text-slate-600 flex-1 font-serif">
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

          {/* COLUMNA DERECHA (Citas & Multimedia) */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="lg:col-span-7 space-y-16">
            
            {/* Estilo de Citación (Estilo Manual de Estilo) */}
            <div>
              <h3 className="text-2xl font-serif font-bold text-[#002147] mb-6 flex items-center gap-3">
                <span className="text-[#e86125]">/</span> Sistema de Referencias
              </h3>
              <p className="text-sm text-slate-600 mb-8 font-serif leading-relaxed">
                Requerimos el uso estricto del sistema <strong className="text-[#002147]">Autor-Fecha</strong> del <em>Chicago Manual of Style (17.ª ed.)</em>. Las citas se integran en el texto entre paréntesis y las referencias completas se listan alfabéticamente al final del manuscrito.
              </p>
              
              <div className="bg-white border border-slate-300 p-6 md:p-8 rounded-sm">
                <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#002147] border-b border-slate-200 pb-3 mb-6">Ejemplos Tipificados (CMOS 17)</h4>
                <div className="space-y-8">
                  {[
                    { title: 'Libro de un autor', ref: 'Graeber, David. 2018. Bullshit Jobs: A Theory. Simon & Schuster.', text: '(Graeber 2018, 45-46)' },
                    { title: 'Artículo de Revista Académica', ref: 'Dittmar, Emily, y Douglas Schemske. 2023. «Temporal Variation in Selection». American Naturalist 202 (4): 471–85. https://doi.org/10.1086/725865.', text: '(Dittmar y Schemske 2023, 480)' },
                    { title: 'Página Web Institucional', ref: 'Yale University. n.d. «About Yale: Discover». Accedido 15 de marzo de 2023. https://www.yale.edu/about-yale.', text: '(Yale University n.d.)' }
                  ].map((ex) => (
                    <div key={ex.title} className="relative pl-4 border-l-2 border-[#e86125]">
                      <span className="absolute -left-2 top-0 bg-[#fafafa] text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">{ex.title}</span>
                      <p className="text-sm text-slate-800 font-serif leading-relaxed mt-3 mb-2">{ex.ref}</p>
                      <p className="text-xs text-slate-500 font-mono">Cita en texto: {ex.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Talleres Audiovisuales (Diseño Estricto) */}
            <div>
              <h3 className="text-2xl font-serif font-bold text-[#002147] mb-6 flex items-center gap-3">
                <span className="text-[#e86125]">/</span> Talleres Metodológicos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="group border border-slate-200 bg-white p-2 rounded-sm">
                  <div className="aspect-video bg-slate-900 relative overflow-hidden flex items-center justify-center">
                    <iframe className="absolute inset-0 w-full h-full opacity-90 group-hover:opacity-100 transition-opacity" src="https://www.youtube.com/embed/wyPhAGW6-94" frameBorder="0" allowFullScreen title="Taller 1"></iframe>
                  </div>
                  <p className="text-xs font-bold text-center py-3 text-[#002147] uppercase tracking-widest">Taller de Escritura</p>
                </div>
                <div className="group border border-slate-200 bg-white p-2 rounded-sm">
                  <div className="aspect-video bg-slate-900 relative overflow-hidden flex items-center justify-center">
                    <iframe className="absolute inset-0 w-full h-full opacity-90 group-hover:opacity-100 transition-opacity" src="https://www.youtube.com/embed/videoseries?list=PL8yQlmhs7KsBerg9X63QnZnlNAopwzDmw" frameBorder="0" allowFullScreen title="Playlist"></iframe>
                  </div>
                  <p className="text-xs font-bold text-center py-3 text-[#002147] uppercase tracking-widest">Metodología (Serie)</p>
                </div>
              </div>
            </div>

            {/* Academic Tools Block */}
            <div className="bg-[#002147] text-white flex flex-col sm:flex-row items-center border-l-4 border-[#e86125] p-6 rounded-sm">
              <div className="p-4 bg-white/5 mr-0 sm:mr-6 mb-4 sm:mb-0 rounded-sm">
                <DocumentTextIcon className="w-12 h-12 text-[#e86125]" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h4 className="text-lg font-serif font-bold mb-2">Suite de Herramientas (Academic Tools)</h4>
                <p className="text-sm text-slate-300 font-light mb-4">Gestione sus PDFs, formatee bibliografía en Chicago 17.ª ed. y analice métricas de texto con nuestra plataforma gratuita.</p>
                <a href="https://www.revistacienciasestudiantes.com/academic-tools" className="text-[#e86125] text-xs uppercase font-bold tracking-widest hover:text-white transition-colors">Acceder a la Suite →</a>
              </div>
            </div>

            {/* Recursos Recomendados (Grid minimalista) */}
            <div>
              <h3 className="text-2xl font-serif font-bold text-[#002147] mb-6 flex items-center gap-3">
                <span className="text-[#e86125]">/</span> Recursos Externos
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {resources.map((resource) => (
                  <a
                    key={resource.name}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block p-5 bg-white border border-slate-200 rounded-sm hover:border-[#002147] transition-all duration-300"
                  >
                    <h4 className="text-sm font-bold text-[#002147] group-hover:text-[#e86125] transition-colors mb-2">
                      {resource.name}
                    </h4>
                    <p className="text-xs text-slate-500 font-serif leading-relaxed">
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