// Footer.jsx (mejorado con animaciones y paleta)
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import logoIG from '/public/logoig.png';
import logoYT from '/public/logoyt.png';
import { useTranslation } from 'react-i18next';

function Footer() {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [enviado, setEnviado] = useState(false);

  const scriptURL = "https://script.google.com/macros/s/AKfycbzyyR93tD85nPprIKAR_IDoWYBSAnlFwVes09rJgOM3KQsByg_MgzafWDK1BcFhfVJHew/exec";

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new URLSearchParams();
    formData.append('nombre', nombre);
    formData.append('correo', correo);

    fetch(scriptURL, {
      method: "POST",
      body: formData
    })
      .then(() => {
        setEnviado(true);
        setNombre('');
        setCorreo('');
      })
      .catch(err => alert("Error al enviar: " + err));
  };

  return (
    <motion.footer
      className="bg-blue-900 text-white p-6 mt-6 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <p>© 2025 Revista Nacional de las Ciencias para Estudiantes. Todos los derechos reservados.</p>
      <p className="mt-2">
        Contáctanos: <a href="mailto:revistanacionalcienciae@gmail.com" className="text-blue-300 hover:text-blue-400 underline">revistanacionalcienciae@gmail.com</a>
      </p>
      <motion.div
        className="flex flex-col sm:flex-row justify-center items-center gap-6 mt-4"
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { staggerChildren: 0.2 } }
        }}
        initial="hidden"
        animate="show"
      >
        {/* Redes sociales con motion.a */}
        <motion.a variants={{ hidden: { y: 20, opacity: 0 }, show: { y: 0, opacity: 1 } }} href="..." className="...">
          {/* Contenido */}
        </motion.a>
        {/* Repite para cada red */}
      </motion.div>
      <div className="mt-6">
        {!enviado ? (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row justify-center items-center gap-3 max-w-xl mx-auto">
            <input type="text" placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required className="p-2 rounded border border-gray-300 flex-1 text-gray-800" />
            <input type="email" placeholder="Tu correo" value={correo} onChange={(e) => setCorreo(e.target.value)} required className="p-2 rounded border border-gray-300 flex-1 text-gray-800" />
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Suscribirse</button>
          </form>
        ) : (
          <p className="text-green-300 font-bold mt-2">¡Gracias por suscribirte!</p>
        )}
      </div>
    </motion.footer>
  );
}

export default Footer;