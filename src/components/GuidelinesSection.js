// GuidelinesSection.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

function GuidelinesSection() {
  return (
    <motion.div
      className="guidelines-section bg-gray-50 p-6 rounded-xl shadow-lg mt-6"
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
        Normas Editoriales
      </motion.h2>
      <motion.ul
        className="list-disc pl-5 text-base text-gray-700"
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { staggerChildren: 0.1 } }
        }}
        initial="hidden"
        animate="show"
      >
        {[
          'Extensión: 1.000–10.000 palabras (tablas no cuentan como palabras)',
          'Formato: Word (.docx), sin nombre del autor en el documento',
          'Originalidad: El artículo debe ser inédito, no publicado ni enviado a otro medio, y no puede usar IA para redactar',
          <>
            Citación: Exclusivamente{' '}
            <a
              href="https://www.chicagomanualofstyle.org/tools_citationguide.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              estilo Chicago
            </a>
          </>,
          'Aceptamos artículos en español y en inglés',
          'Elementos permitidos: Gráficas, ecuaciones, imágenes, tablas (fuera del conteo de palabras)',
          <>
            Políticas de Envío de Artículos: Consulte las políticas completas{' '}
            <a
              href="https://www.revistacienciasestudiantes.com/policies.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              aquí
            </a>
          </>,
        ].map((item, index) => (
          <motion.li
            key={index}
            className="mb-3"
            variants={{
              hidden: { opacity: 0, x: -20 },
              show: { opacity: 1, x: 0 }
            }}
          >
            {item}
          </motion.li>
        ))}
      </motion.ul>
      <motion.h3
        className="text-xl font-bold mt-6 mb-4 text-blue-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        Para aprender a hacer un artículo científico, te recomendamos los siguientes videos:
      </motion.h3>
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { staggerChildren: 0.2 } }
        }}
        initial="hidden"
        animate="show"
      >
        {[
          { src: 'https://www.youtube.com/embed/wyPhAGW6-94', title: 'Video 1' },
          { src: 'https://www.youtube.com/embed/videoseries?list=PL8yQlmhs7KsBerg9X63QnZnlNAopwzDmw', title: 'Playlist' },
        ].map((video, index) => (
          <motion.iframe
            key={index}
            width="100%"
            height="200"
            src={video.src}
            title={video.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            variants={{
              hidden: { opacity: 0, scale: 0.95 },
              show: { opacity: 1, scale: 1 }
            }}
            className="rounded-lg shadow-md"
          />
        ))}
      </motion.div>
      <motion.h3
        className="text-xl font-bold mt-8 mb-4 text-blue-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        Para investigar, te recomendamos los siguientes sitios:
      </motion.h3>
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { staggerChildren: 0.1 } }
        }}
        initial="hidden"
        animate="show"
      >
        {[
          { name: 'Google Scholar', url: 'https://scholar.google.com/', desc: 'Buscador académico de Google con millones de artículos científicos.' },
          { name: 'SciELO', url: 'https://scielo.org/es/', desc: 'Biblioteca científica en línea de acceso abierto en español y portugués.' },
          { name: 'Consensus', url: 'https://consensus.app/', desc: 'Plataforma impulsada por IA para encontrar y resumir artículos científicos.' },
        ].map((site, index) => (
          <motion.a
            key={index}
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-all hover:bg-blue-50"
            variants={{
              hidden: { opacity: 0, y: 20 },
              show: { opacity: 1, y: 0 }
            }}
          >
            <h4 className="text-lg font-bold text-blue-800 mb-2">{site.name}</h4>
            <p className="text-gray-700">{site.desc}</p>
          </motion.a>
        ))}
      </motion.div>
    </motion.div>
  );
}

export default GuidelinesSection;