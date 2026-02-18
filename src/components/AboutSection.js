import React from 'react';
import { motion } from 'framer-motion';

function AboutSection() {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="py-20 border-t border-b border-gray-100 bg-[#fdfdfd]"
    >
      <div className="max-w-4xl mx-auto px-6">
        <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#007398] block mb-6 text-center">
          Nuestra identidad
        </span>
        <h2 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 mb-8 text-center leading-tight">
          Impulsando a la próxima generación del rigor científico
        </h2>
        <div className="space-y-6 text-lg leading-relaxed text-gray-700 font-serif italic">
          <p>
            La <span className="font-bold text-gray-900 not-italic">Revista Nacional de las Ciencias para Estudiantes</span> es una publicación interdisciplinaria revisada por pares, curada por una comunidad global de académicos y estudiantes.
          </p>
          <p className="border-l-4 border-[#007398] pl-6 py-2 bg-white shadow-sm">
            "Nuestro objetivo es democratizar el acceso a la publicación científica rigurosa, permitiendo que estudiantes de todos los niveles experimenten el rigor de la investigación real."
          </p>
          <p className="text-base not-italic text-gray-500 font-sans">
            Operamos como una iniciativa <span className="text-gray-900 font-medium text-sm tracking-wide uppercase">independiente y libre</span>, sin afiliaciones institucionales restrictivas, garantizando una autonomía editorial total.
          </p>
        </div>
      </div>
    </motion.section>
  );
}

export default AboutSection;