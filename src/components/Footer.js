import React, { useState } from 'react';
import { motion } from 'framer-motion';

function Footer() {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [enviado, setEnviado] = useState(false);
  const scriptURL = "https://script.google.com/macros/s/AKfycbyAmrjSmCkMTeLhzrLbtPd46hO9-uEenRPcD2B_Jp52g3GSEDYQr1SezZnC9WoWfBySng/exec";
  
  // Obtener año actual para copyright dinámico
  const currentYear = new Date().getFullYear();

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new URLSearchParams();
    formData.append('nombre', nombre);
    formData.append('correo', correo);
    fetch(scriptURL, {
      method: "POST",
      body: formData
    })
      .then(r => r.text())
      .then(res => {
        setEnviado(true);
        setNombre('');
        setCorreo('');
      })
      .catch(err => alert("Error al enviar: " + err));
  };
  
  // Componente interno para iconos elegantes y uniformes
  const SocialIcon = ({ href, iconPath, label }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col items-center gap-2 text-gray-400 hover:text-white transition-all duration-300"
      title={label}
    >
      <svg className="w-5 h-5 fill-current transition-transform group-hover:-translate-y-1" viewBox="0 0 24 24">
        <path d={iconPath} />
      </svg>
      <span className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        {label}
      </span>
    </a>
  );

  return (
    <motion.footer
      className="bg-[#1a1a1a] text-white pt-16 pb-8 px-6 mt-12 border-t border-gray-800"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
    >
      <div className="max-w-6xl mx-auto">
      
        {/* Sección Superior: Newsletter */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16 items-center">
          <div className="text-left">
            <h3 className="text-xl font-serif mb-2 italic">Boletín Informativo</h3>
            <p className="text-gray-500 text-sm font-light">
              Reciba las últimas publicaciones y noticias científicas directamente en su bandeja de entrada.
            </p>
          </div>
          <div>
            {!enviado ? (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  placeholder="Nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  className="bg-transparent border-b border-gray-700 py-2 px-1 text-sm focus:border-[#007398] outline-none transition-colors flex-1"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  required
                  className="bg-transparent border-b border-gray-700 py-2 px-1 text-sm focus:border-[#007398] outline-none transition-colors flex-1"
                />
                <button
                  type="submit"
                  className="text-[10px] uppercase tracking-[0.2em] font-bold border border-gray-600 px-6 py-3 hover:bg-white hover:text-black transition-all"
                >
                  Suscribirse
                </button>
              </form>
            ) : (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[#007398] text-sm italic font-serif">
                ¡Gracias por suscribirte!
              </motion.p>
            )}
          </div>
        </div>
        <div className="h-[1px] bg-gradient-to-r from-transparent via-gray-800 to-transparent mb-12"></div>
        
        {/* Sección Media: Redes y Contacto */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-12">
        
          <div className="flex gap-8">
            <SocialIcon
              label="Instagram"
              href="https://www.instagram.com/revistanacionalcienciae"
              iconPath="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
            />
            <SocialIcon
              label="YouTube"
              href="https://www.youtube.com/@RevistaNacionaldelasCienciaspa"
              iconPath="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
            />
            <SocialIcon
              label="TikTok"
              href="https://www.tiktok.com/@revistacienciaestudiante"
              iconPath="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
            />
            <SocialIcon
              label="Spotify"
              href="https://open.spotify.com/show/6amsgUkNXgUTD219XpuqOe?si=LPzCNpusQjSLGBq_pPrVTw"
              iconPath="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.508 17.308c-.221.362-.689.473-1.05.252-2.983-1.823-6.738-2.237-11.162-1.226-.411.094-.823-.162-.917-.573-.094-.412.162-.823.573-.917 4.847-1.108 8.995-.635 12.305 1.386.36.221.472.69.251 1.05zm1.47-3.255c-.278.452-.865.594-1.317.316-3.414-2.098-8.62-2.706-12.657-1.479-.508.154-1.04-.136-1.194-.644-.154-.508.136-1.04.644-1.194 4.613-1.399 10.366-.719 14.256 1.67.452.278.594.865.316 1.317zm.126-3.374C14.653 7.64 7.29 7.394 3.05 8.681c-.604.183-1.246-.166-1.429-.77-.183-.604.166-1.246.77-1.429 4.883-1.482 13.014-1.201 18.238 1.902.544.323.72 1.034.397 1.578-.323.544-1.034.72-1.578.397z"
            />
          </div>
          <div className="text-center md:text-right">
            <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500 block mb-1">Contacto Oficial</span>
            <a href="mailto:contact@revistacienciasestudiantes.com" className="text-sm font-light hover:text-[#007398] transition-colors">
              contact@revistacienciasestudiantes.com
            </a>
          </div>
        </div>
        
        {/* Sección Inferior: Copyright con año dinámico y enlaces a los archivos HTML */}
        <div className="pt-8 border-t border-gray-900 flex flex-col items-center gap-4">
          <p className="text-[9px] text-gray-600 uppercase tracking-[0.4em] text-center">
            © {currentYear} Revista Nacional de las Ciencias para Estudiantes · ISSN 3087-2839. Todos los derechos reservados.
          </p>
          <div className="flex gap-4 text-[9px] text-gray-700 uppercase tracking-widest">
            <a href="/privacy.html" className="hover:text-white transition-colors">Privacidad</a>
            <span>|</span>
            <a href="/terms.html" className="hover:text-white transition-colors">Términos</a>
            <span>|</span>
            <a href="/credits.html" className="hover:text-white transition-colors">Créditos</a>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}

export default Footer;