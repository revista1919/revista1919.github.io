import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

function GuidelinesSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      className="guidelines-section bg-white p-6 rounded-xl shadow-lg mt-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.h2
        className="text-2xl font-bold mb-4 text-gray-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        Normas Editoriales
      </motion.h2>
      <motion.ul
        className="list-disc pl-5 text-base"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.li variants={itemVariants} className="mb-3">Extensión: 1.000–10.000 palabras (tablas no cuentan como palabras)</motion.li>
        <motion.li variants={itemVariants} className="mb-3">Formato: Word (.docx), sin nombre del autor en el documento</motion.li>
        <motion.li variants={itemVariants} className="mb-3">Originalidad: El artículo debe ser inédito, no publicado ni enviado a otro medio, y no puede usar IA para redactar</motion.li>
        <motion.li variants={itemVariants} className="mb-3">
          Citación: Exclusivamente{' '}
          <a
            href="https://www.chicagomanualofstyle.org/tools_citationguide.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            estilo Chicago
          </a>
        </motion.li>
        <motion.li variants={itemVariants} className="mb-3">Aceptamos artículos en español y en inglés</motion.li>
        <motion.li variants={itemVariants} className="mb-3">Elementos permitidos: Gráficas, ecuaciones, imágenes, tablas (fuera del conteo de palabras)</motion.li>
        <motion.li variants={itemVariants} className="mb-3">
          Políticas de Envío de Artículos: Consulte las políticas completas{' '}
          <a
            href="https://www.revistacienciasestudiantes.com/policies.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            aquí
          </a>
        </motion.li>
      </motion.ul>
      <motion.h3
        className="text-xl font-bold mt-6 mb-3 text-gray-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        Para aprender a hacer un artículo científico, te recomendamos los siguientes videos:
      </motion.h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <iframe
          width="100%"
          height="200"
          src="https://www.youtube.com/embed/wyPhAGW6-94"
          title="Video 1"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        <iframe
          width="100%"
          height="200"
          src="https://www.youtube.com/embed/videoseries?list=PL8yQlmhs7KsBerg9X63QnZnlNAopwzDmw"
          title="Playlist"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <motion.h3
        className="text-xl font-bold mt-8 mb-4 text-gray-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        Para investigar, te recomendamos los siguientes sitios:
      </motion.h3>
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {[
          { name: 'Google Scholar', url: 'https://scholar.google.com/', desc: 'Buscador académico de Google con millones de artículos científicos.' },
          { name: 'SciELO', url: 'https://scielo.org/es/', desc: 'Biblioteca científica en línea de acceso abierto en español y portugués.' },
          { name: 'Consensus', url: 'https://consensus.app/', desc: 'Plataforma impulsada por IA para encontrar y resumir artículos científicos.' }
        ].map((site, index) => (
          <motion.a
            key={index}
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 bg-gray-50 rounded-xl shadow hover:shadow-md transition"
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
          >
            <h4 className="text-lg font-bold text-gray-800 mb-2">{site.name}</h4>
            <p className="text-sm text-gray-600">{site.desc}</p>
          </motion.a>
        ))}
      </motion.div>
    </motion.div>
  );
}

export default GuidelinesSection;