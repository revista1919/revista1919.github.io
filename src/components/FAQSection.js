import React from 'react';
import { motion } from 'framer-motion';

function FAQSection() {
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
      className="faq-section bg-white p-6 rounded-xl shadow-lg mt-6"
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
        Preguntas Frecuentes
      </motion.h2>
      <motion.ul
        className="list-disc pl-5 text-base"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.li variants={itemVariants} className="mb-3">
          <strong>¿Quién puede publicar?</strong> Cualquier estudiante escolar o universitario del mundo.
        </motion.li>
        <motion.li variants={itemVariants} className="mb-3">
          <strong>¿Se puede usar IA para ayudarme a escribir?</strong> No. Será rechazado automáticamente.
        </motion.li>
        <motion.li variants={itemVariants} className="mb-3">
          <strong>¿Cuánto se demoran en responder?</strong> Entre 1 y 3 semanas, dependiendo del volumen de solicitudes.
        </motion.li>
        <motion.li variants={itemVariants} className="mb-3">
          <strong>¿Cómo se revisa un artículo?</strong> Revisión doble ciego, sin nombre del autor. Hay alumnos y profesores que revisarán tu artículo según tu área.
        </motion.li>
        <motion.li variants={itemVariants} className="mb-3">
          <strong>¿Cómo es el proceso editorial?</strong> Cuando nos envías tu artículo se le asignan revisores y un editor, este último se comunicará contigo cuando termine la revisión de tu artículo, para disutir cambios u otros temas.
        </motion.li>
        <motion.li variants={itemVariants} className="mb-3">
          <strong>¿Qué pasará cuando mi artículo se publique?</strong> El artículo aparecerá en nuestra página web y será indexado en Google Académico. Estamos haciendo los procedimientos para conseguir nuestro ISSN. También es posible que te invitemos a nuestro podcast, además de difundirlo en nuestras Redes Sociales
        </motion.li>
        <motion.li variants={itemVariants} className="mb-3">
          <strong>¿En qué formato envío el artículo?</strong> Word (.docx), estilo Chicago, 2.000–10.000 palabras.
        </motion.li>
        <motion.li variants={itemVariants} className="mb-3">
          <strong>¿Cómo puedo postular a algún cargo?</strong> Desde la pestaña "¡Postula a algún cargo!".
        </motion.li>
      </motion.ul>
    </motion.div>
  );
}

export default FAQSection;