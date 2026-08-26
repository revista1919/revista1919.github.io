import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowRightIcon, 
  ExclamationTriangleIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

function SubmitSection() {
  const navigate = useNavigate();

  const handleSubmitClick = () => {
    navigate('/login/submit');
  };

  // Variantes de animación sobrias
  const fadeUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <motion.div
      className="max-w-5xl mx-auto mt-16 mb-24 px-4 sm:px-6 lg:px-8 font-sans"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
      }}
    >
      {/* HEADER EDITORIAL ESTRICTO */}
      <motion.header variants={fadeUp} className="mb-16 border-t-4 border-[#002147] pt-8">
        <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#e86125] mb-4 block">
          Sistema Editorial
        </span>
        <h1 className="text-4xl md:text-5xl font-serif text-[#002147] font-bold leading-tight mb-6">
          Envío de Manuscritos
        </h1>
        <p className="text-slate-600 text-lg leading-relaxed max-w-3xl font-serif">
          El proceso de envío constituye un acto formal que implica la aceptación íntegra de nuestras normativas editoriales y éticas. Agradecemos su interés en someter su investigación a la Revista Nacional de las Ciencias para Estudiantes.
        </p>
      </motion.header>

      {/* BLOQUE DE VERIFICACIÓN (Alto Contraste) */}
      <motion.div variants={fadeUp} className="bg-[#002147] text-white mb-16 flex flex-col md:flex-row">
        <div className="p-10 md:w-2/3 border-b md:border-b-0 md:border-r border-white/20">
          <h2 className="text-2xl font-serif font-bold mb-4">Verificación Previa Esencial</h2>
          <p className="text-slate-300 leading-relaxed text-sm">
            Para optimizar el flujo editorial y evitar rechazos técnicos preliminares, hemos estructurado una <strong className="text-white">Guía Rápida Interactiva</strong>. Este proceso de evaluación personal le permitirá confirmar en menos de 5 minutos si su manuscrito cumple con los estándares fundamentales antes del envío formal.
          </p>
        </div>
        <div className="p-10 md:w-1/3 flex flex-col justify-center items-start bg-[#001833]">
          <a
            href="/quick.html"
            className="w-full text-center bg-[#e86125] text-white px-6 py-4 text-xs uppercase font-bold tracking-widest hover:bg-[#c9521e] transition-colors rounded-sm mb-4"
          >
            Iniciar Checklist
          </a>
          <a
            href="https://www.revistacienciasestudiantes.com/policies.html"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full text-center border border-white/30 text-white px-6 py-3 text-xs uppercase font-bold tracking-widest hover:bg-white hover:text-[#002147] transition-colors rounded-sm"
          >
            Políticas Completas
          </a>
        </div>
      </motion.div>

      {/* GRID DE CRITERIOS Y RECURSOS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20">
        
        {/* Criterios de Rechazo (Izquierda, 8 columnas) */}
        <motion.div variants={fadeUp} className="lg:col-span-8">
          <div className="border-b-2 border-[#002147] pb-4 mb-8 flex items-center justify-between">
            <h3 className="text-2xl font-serif font-bold text-[#002147]">
              Criterios de Rechazo Inmediato (Desk Reject)
            </h3>
            <ExclamationTriangleIcon className="w-6 h-6 text-[#e86125]" />
          </div>

          <div className="space-y-0">
            {/* ITEM 1 */}
            <div className="border-b border-slate-200 py-5 flex gap-5">
              <div className="text-[#e86125] font-serif font-bold text-xl">01.</div>
              <div>
                <h4 className="font-bold text-[#002147] text-base mb-1">Doble Ciego Comprometido</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  El manuscrito principal no debe contener nombres, filiaciones institucionales, biografías ni agradecimientos. Cualquier metadato que revele la identidad del autor en el documento anulará el proceso.
                </p>
              </div>
            </div>

            {/* ITEM 2 */}
            <div className="border-b border-slate-200 py-5 flex gap-5">
              <div className="text-slate-400 font-serif font-bold text-xl">02.</div>
              <div>
                <h4 className="font-bold text-[#002147] text-base mb-1">Estructura de Citación</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  El documento debe adherirse rigurosamente al formato <strong>Chicago 17.ª ed. (autor-fecha)</strong> o APA 7.ª ed. (según área) tanto en el cuerpo del texto como en las referencias finales.
                </p>
              </div>
            </div>

            {/* ITEM 3 */}
            <div className="border-b border-slate-200 py-5 flex gap-5">
              <div className="text-slate-400 font-serif font-bold text-xl">03.</div>
              <div>
                <h4 className="font-bold text-[#002147] text-base mb-1">Taxonomía Académica</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Debe proporcionar un resumen estructurado (abstract), de 3 a 5 palabras clave, y los Códigos de Clasificación estandarizados de su disciplina (ej. JEL, MeSH).
                </p>
              </div>
            </div>

            {/* ITEM 4 */}
            <div className="border-b border-slate-200 py-5 flex gap-5">
              <div className="text-slate-400 font-serif font-bold text-xl">04.</div>
              <div>
                <h4 className="font-bold text-[#002147] text-base mb-1">Declaraciones Obligatorias</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  El artículo debe incluir declaraciones formales de: Financiamiento, Conflicto de Intereses, Disponibilidad de Datos y Aprobación de Comité Ético (si involucra sujetos humanos/animales).
                </p>
              </div>
            </div>

            {/* ITEM 5 */}
            <div className="border-b border-slate-200 py-5 flex gap-5">
              <div className="text-[#e86125] font-serif font-bold text-xl">05.</div>
              <div>
                <h4 className="font-bold text-[#002147] text-base mb-1">Umbral de Similitud</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  El índice de similitud <strong className="text-[#e86125]">no puede superar el 15%</strong> (excluyendo bibliografía debidamente citada). Se verificará mediante software iThenticate/Turnitin antes del primer filtro.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Recursos (Derecha, 4 columnas) */}
        <motion.div variants={fadeUp} className="lg:col-span-4">
          <div className="bg-slate-50 border border-slate-200 p-8 rounded-sm sticky top-6">
            <h4 className="font-serif font-bold text-[#002147] text-lg mb-6 border-b border-slate-300 pb-3">
              Documentación
            </h4>
            
            <ul className="space-y-4 mb-8">
              <li>
                <a href="/guidelines" className="group flex items-start gap-3 text-sm text-slate-700 hover:text-[#e86125] transition-colors">
                  <ArrowRightIcon className="w-4 h-4 mt-0.5 text-[#002147] group-hover:text-[#e86125]" />
                  <span>Guía Completa para Autores (PDF)</span>
                </a>
              </li>
              <li>
                <a href="/templates" className="group flex items-start gap-3 text-sm text-slate-700 hover:text-[#e86125] transition-colors">
                  <ArrowRightIcon className="w-4 h-4 mt-0.5 text-[#002147] group-hover:text-[#e86125]" />
                  <span>Plantilla Word / LaTeX oficial</span>
                </a>
              </li>
              <li>
                <a href="/ethics" className="group flex items-start gap-3 text-sm text-slate-700 hover:text-[#e86125] transition-colors">
                  <ArrowRightIcon className="w-4 h-4 mt-0.5 text-[#002147] group-hover:text-[#e86125]" />
                  <span>Declaración de Ética y Malas Prácticas</span>
                </a>
              </li>
            </ul>

            <div className="bg-white border border-slate-200 p-5 rounded-sm">
              <h5 className="text-xs uppercase tracking-widest font-bold text-[#002147] mb-2">Open Access</h5>
              <p className="text-xs text-slate-500 leading-relaxed">
                Esta revista opera bajo el modelo Diamond Open Access. No existen cargos por procesamiento de artículos (APC) ni por envío.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* PORTAL DE ACCESO (Minimalista e Institucional) */}
      <motion.div variants={fadeUp} className="max-w-2xl mx-auto">
        <div className="border border-slate-300 p-1 bg-white">
          <div className="border border-slate-200 p-10 md:p-14 text-center bg-slate-50">
            <h3 className="text-2xl font-serif text-[#002147] font-bold mb-4">
              Acceso al Sistema Editorial
            </h3>
            
            <p className="text-slate-600 mb-10 text-sm leading-relaxed max-w-lg mx-auto">
              Para iniciar un nuevo envío, adjuntar una revisión (Revise & Resubmit) o verificar el estado de un manuscrito, ingrese al portal seguro.
            </p>

            <button
              onClick={handleSubmitClick}
              className="w-full sm:w-auto bg-[#002147] text-white px-12 py-4 text-xs font-bold uppercase tracking-[0.15em] hover:bg-[#e86125] transition-colors rounded-sm inline-flex items-center justify-center gap-3 mb-6"
            >
              <span>Acceder al Portal</span>
              <ArrowRightIcon className="w-4 h-4" />
            </button>

            <div className="pt-6 border-t border-slate-300">
              <p className="text-xs text-slate-500">
                For English-language submissions, please access the{' '}
                <a href="/en/login/submit" className="text-[#002147] font-bold hover:text-[#e86125] transition-colors underline underline-offset-4">
                  English Editorial Portal
                </a>.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* FOOTER */}
      <motion.footer variants={fadeUp} className="mt-16 text-center">
        <p className="text-xs font-mono text-slate-400">
          Soporte Técnico: <a href="mailto:soporte@revistacienciasestudiantes.com" className="text-[#002147] hover:underline">soporte@revistacienciasestudiantes.com</a>
        </p>
      </motion.footer>
    </motion.div>
  );
}

export default SubmitSection;