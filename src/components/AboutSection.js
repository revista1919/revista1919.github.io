// AboutSection.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

function AboutSection() {
  return (
    <motion.div
      className="about-section bg-gray-50 p-6 rounded-xl shadow-lg mt-6"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.h2
        className="text-2xl font-bold mb-4 text-blue-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Quiénes Somos
      </motion.h2>
      <motion.p
        className="text-base mb-3 text-gray-700"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        La Revista Nacional de las Ciencias para Estudiantes es una publicación interdisciplinaria revisada por pares, escrita, editada y curada por estudiantes y profesores, escolares y universitarios. Está abierta a todo el mundo, aunque fomenta especialmente la participación de chilenos, pero está abierta a todo el mundo. Su objetivo es fomentar el pensamiento crítico y la investigación científica entre jóvenes, mediante un sistema de publicación serio, accesible y riguroso.
      </motion.p>
      <motion.p
        className="text-base text-gray-700"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <em>No está asociada a ninguna institución, programa ni colegio en particular. Es una iniciativa independiente, abierta a todos los estudiantes. No hay ningún costo, es completamente gratuita y opera gracias al compromiso de nuestros colaboradores.</em>
      </motion.p>
    </motion.div>
  );
}

export default AboutSection;