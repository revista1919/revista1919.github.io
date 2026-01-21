import React from 'react';
import { motion } from 'framer-motion';

function AboutSection() {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="py-20 border-t border-b border-gray-200 bg-gradient-to-b from-white to-gray-50"
    >
      <div className="max-w-4xl mx-auto px-6">
        <span className="text-xs uppercase tracking-widest font-bold text-[#007398] block mb-6 text-center">
          Nuestra Identidad
        </span>
        <h2 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 mb-8 text-center leading-tight">
          Fomentando la próxima generación de rigor científico
        </h2>
        <div className="space-y-6 text-lg leading-relaxed text-gray-700 font-serif italic">
          <p>
            La <span className="font-bold text-gray-900 not-italic">Revista Nacional de las Ciencias para Estudiantes</span> es una publicación interdisciplinaria revisada por pares, curada por una comunidad global de académicos y estudiantes.
          </p>
          <p className="border-l-4 border-[#007398] pl-6 py-3 bg-white shadow-md rounded-md">
            "Nuestro objetivo es democratizar el acceso a la publicación científica seria, permitiendo que estudiantes de todos los niveles experimenten el rigor de la investigación real."
          </p>
          <p className="text-base not-italic text-gray-600 font-sans">
            Operamos como una iniciativa <span className="text-gray-900 font-medium text-sm tracking-wide uppercase">independiente y gratuita</span>, sin afiliaciones institucionales restrictivas, garantizando total autonomía editorial.
          </p>
        </div>
      </div>
    </motion.section>
  );
}