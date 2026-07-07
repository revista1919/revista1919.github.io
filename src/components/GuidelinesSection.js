import React from 'react';
import { motion } from 'framer-motion';

function GuidelinesSection() {
  const resources = [
    { name: 'Google Scholar', url: 'https://scholar.google.com/', desc: 'Buscador líder para literatura académica.' },
    { name: 'SciELO', url: 'https://scielo.org/es/', desc: 'Biblioteca científica de acceso abierto.' },
    { name: 'Consensus', url: 'https://consensus.app/', desc: 'Buscador de evidencia científica con IA.' }
  ];

  return (
    <section className="py-20 bg-[#fafafa]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          {/* Normas Editoriales */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-1"
          >
            <h2 className="text-3xl font-serif font-bold mb-8">Guía para Autores</h2>
            
            {/* Aviso de Políticas */}
            <div className="bg-[#001f3f] text-white p-6 rounded-lg mb-8">
              <p className="text-sm font-serif italic leading-relaxed mb-4">
                El envío de un manuscrito implica la aceptación íntegra de nuestras Políticas Editoriales. 
                Le instamos a leerlas detenidamente antes de preparar su contribución. El incumplimiento 
                de cualquiera de sus disposiciones podrá dar lugar a la desestimación del envío.
              </p>
              <a 
                href="https://www.revistacienciasestudiantes.com/policies.html" 
                className="inline-block bg-white text-[#001f3f] px-6 py-3 text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-[#c0a86a] hover:text-white transition-colors"
              >
                Leer Políticas Editoriales Completas →
              </a>
            </div>

            <ul className="space-y-6">
              {[
                { label: 'Extensión', val: '1.000–10.000 palabras (incluyendo referencias)' },
                { label: 'Formato', val: 'Microsoft Word (.docx). Documento anonimizado para revisión doble ciego.' },
                { label: 'Citación', val: 'Chicago 17.ª ed. (Autor-Fecha)', link: 'https://www.chicagomanualofstyle.org/tools_citationguide/citation-guide-2.html' },
                { label: 'Idiomas', val: 'Español e Inglés (título, resumen y palabras clave en ambos)' },
                { label: 'Palabras clave', val: '2–6, con vocabulario controlado (JEL, MeSH, ACM, UNESCO)', link: 'https://www.revistacienciasestudiantes.com/policies.html#clasificacion' },
                { label: 'Originalidad', val: 'Similitud máxima permitida: 15%' },
                { label: 'Ética', val: 'Aprobación de comité cuando corresponda; declaración en el manuscrito.' }
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

          {/* Videos, Recursos y Guía de Citación */}
          <div className="lg:col-span-2 space-y-12">
            
            {/* Guía de Citación Chicago (Autor-Fecha) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h3 className="text-xs uppercase tracking-[0.3em] font-black text-gray-400 mb-6 italic underline">
                Estilo de Citación: Chicago 17.ª ed. (Autor-Fecha)
              </h3>
              <p className="text-sm text-gray-600 mb-6 font-serif leading-relaxed">
                La Revista exige el uso del sistema <strong>autor-fecha</strong> del <em>Chicago Manual of Style</em>, 
                17.ª edición. Las citas se insertan en el texto entre paréntesis (Autor Año, página) y la lista 
                completa de referencias se incluye al final del manuscrito bajo el título «Referencias». 
                A continuación se presentan ejemplos de los tipos documentales más frecuentes, basados 
                directamente en la guía oficial. Para casos no contemplados, consulte el manual completo 
                en <a href="https://www.chicagomanualofstyle.org/tools_citationguide/citation-guide-2.html" target="_blank" rel="noopener noreferrer" className="text-[#007398] underline">Chicago Manual of Style Online</a>.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Libro */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#001f3f] mb-3">Libro</h4>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">Referencia</p>
                  <p className="text-sm text-gray-800 mb-3 font-serif leading-relaxed">
                    Binder, Amy J., y Jeffrey L. Kidder. 2022. <em>The Channels of Student Activism: How the Left and Right Are Winning (and Losing) in Campus Politics Today</em>. University of Chicago Press.
                  </p>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">En el texto</p>
                  <p className="text-sm text-gray-800 font-serif">(Binder y Kidder 2022, 117–18)</p>
                </div>

                {/* Capítulo de libro editado */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#001f3f] mb-3">Capítulo de libro editado</h4>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">Referencia</p>
                  <p className="text-sm text-gray-800 mb-3 font-serif leading-relaxed">
                    Doyle, Kathleen. 2023. «The Queen Mary Psalter». En <em>The Book by Design: The Remarkable Story of the World's Greatest Invention</em>, editado por P. J. M. Marks y Stephen Parkin. University of Chicago Press.
                  </p>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">En el texto</p>
                  <p className="text-sm text-gray-800 font-serif">(Doyle 2023, 64)</p>
                </div>

                {/* Artículo de revista */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#001f3f] mb-3">Artículo de revista</h4>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">Referencia</p>
                  <p className="text-sm text-gray-800 mb-3 font-serif leading-relaxed">
                    Dittmar, Emily L., y Douglas W. Schemske. 2023. «Temporal Variation in Selection Influences Microgeographic Local Adaptation». <em>American Naturalist</em> 202 (4): 471–85. https://doi.org/10.1086/725865.
                  </p>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">En el texto</p>
                  <p className="text-sm text-gray-800 font-serif">(Dittmar y Schemske 2023, 480)</p>
                  <p className="text-[11px] text-gray-400 mt-2">Para 3 o más autores: (Snyder et al. 2025, 9–10)</p>
                </div>

                {/* Tesis o disertación */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#001f3f] mb-3">Tesis o disertación</h4>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">Referencia</p>
                  <p className="text-sm text-gray-800 mb-3 font-serif leading-relaxed">
                    Blajer de la Garza, Yuna. 2019. «A House Is Not a Home: Citizenship and Belonging in Contemporary Democracies». PhD diss., University of Chicago. ProQuest (13865986).
                  </p>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">En el texto</p>
                  <p className="text-sm text-gray-800 font-serif">(Blajer de la Garza 2019, 66–67)</p>
                </div>

                {/* Página web */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#001f3f] mb-3">Página web</h4>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">Referencia</p>
                  <p className="text-sm text-gray-800 mb-3 font-serif leading-relaxed">
                    Google. 2023. «Privacy Policy». Privacy & Terms. Effective November 15. https://policies.google.com/privacy.
                  </p>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">En el texto</p>
                  <p className="text-sm text-gray-800 font-serif">(Google 2023)</p>
                  <p className="text-[11px] text-gray-400 mt-2">Sin fecha: (Yale University n.d.) y añadir fecha de acceso.</p>
                </div>

                {/* Noticia o revista */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#001f3f] mb-3">Artículo de prensa o revista</h4>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">Referencia</p>
                  <p className="text-sm text-gray-800 mb-3 font-serif leading-relaxed">
                    Blum, Dani. 2023. «Are Flax Seeds All That?» <em>New York Times</em>, December 13. https://www.nytimes.com/2023/12/13/well/eat/flax-seeds-benefits.html.
                  </p>
                  <p className="text-[11px] text-gray-500 mb-2 font-mono uppercase">En el texto</p>
                  <p className="text-sm text-gray-800 font-serif">(Blum 2023)</p>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-[#f0f4f8] rounded-lg border-l-4 border-[#001f3f]">
                <p className="text-xs text-gray-600 font-serif leading-relaxed">
                  <strong>Nota importante:</strong> El lugar de publicación ya no es obligatorio para libros 
                  (CMOS 14.30). Para artículos con más de seis autores, liste los tres primeros seguidos de 
                  «et al.» en la referencia. En el texto, use «et al.» desde tres autores. 
                  Las comunicaciones personales (correos, mensajes) se citan solo en el texto y no se incluyen 
                  en las referencias. Para cualquier otro tipo documental, remítase a las 
                  <a href="https://www.revistacienciasestudiantes.com/policies.html" target="_blank" rel="noopener noreferrer" className="text-[#007398] underline"> Políticas Editoriales completas</a> y al 
                  <a href="https://www.chicagomanualofstyle.org/tools_citationguide/citation-guide-2.html" target="_blank" rel="noopener noreferrer" className="text-[#007398] underline"> manual oficial de Chicago</a>.
                </p>
              </div>
            </motion.div>

            {/* Talleres Audiovisuales */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h3 className="text-xs uppercase tracking-[0.3em] font-black text-gray-400 mb-6 italic underline">Talleres Audiovisuales</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="aspect-video bg-black rounded-sm overflow-hidden shadow-xl">
                  <iframe width="100%" height="100%" src="https://www.youtube.com/embed/wyPhAGW6-94" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="Taller 1" />
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
                Recomendado
              </div>
              <img src="https://www.revistacienciasestudiantes.com/academic-tools/assets/logoP.png" className="w-24 h-24 object-contain grayscale hover:grayscale-0 transition-all" alt="Logo" />
              <div>
                <h4 className="text-xl font-serif font-bold mb-2">Academic Tools</h4>
                <p className="text-sm text-gray-500 mb-4 font-serif italic">Plataforma integral para gestión de PDFs, citación automática y procesamiento de texto académico.</p>
                <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase text-[#007398]">
                  <span>• Gestión PDF</span> <span>• Generador Citas</span> <span>• Análisis de Texto</span>
                </div>
                <a href="https://www.revistacienciasestudiantes.com/academic-tools" className="mt-6 inline-block text-[11px] font-black uppercase tracking-widest border-b-2 border-black pb-1 hover:border-[#007398] hover:text-[#007398] transition-all">
                  Acceder a la Suite →
                </a>
              </div>
            </motion.div>

            {/* Recursos Recomendados */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <h3 className="text-xs uppercase tracking-[0.3em] font-black text-gray-400 mb-6 italic underline">Recursos Recomendados</h3>
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