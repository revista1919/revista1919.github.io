import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  CheckCircleIcon, 
  DocumentCheckIcon, 
  BookOpenIcon, 
  ArrowRightOnRectangleIcon, 
  ShieldExclamationIcon,
  LanguageIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

function SubmitSection() {
  const navigate = useNavigate();

  const handleSubmitClick = () => {
    navigate('/login/submit');
  };

  return (
    <motion.div
      className="max-w-6xl mx-auto mt-12 mb-20 px-4 sm:px-6 lg:px-8 font-sans"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* HEADER EDITORIAL */}
      <header className="mb-12 text-center">
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[11px] uppercase tracking-[0.3em] font-semibold text-[#002147] mb-4 block"
        >
          Sistema Editorial
        </motion.span>
        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-4xl md:text-5xl font-serif text-black mb-4"
        >
          Envío de Manuscritos
        </motion.h2>
        <div className="w-16 h-1 bg-[#FF7900] mx-auto mb-6"></div>
        <p className="text-slate-600 text-base leading-relaxed max-w-3xl mx-auto">
          El proceso de envío constituye un acto formal que implica la aceptación íntegra de nuestras normativas editoriales y éticas. Agradecemos su interés en publicar en nuestra revista.
        </p>
      </header>

      {/* AVISO PROMINENTE: Guía Rápida como primer paso */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-[#002147] text-white rounded-xl mb-12 shadow-xl overflow-hidden relative"
      >
        {/* Elemento decorativo */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-white opacity-5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#FF7900] opacity-10 rounded-full blur-2xl -ml-16 -mb-16 pointer-events-none"></div>
        
        <div className="p-8 sm:p-10 flex flex-col lg:flex-row items-start lg:items-center gap-8 relative z-10">
          {/* Icono */}
          <div className="flex-shrink-0 bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
            <DocumentCheckIcon className="w-12 h-12 text-[#FF7900]" />
          </div>
          
          <div className="flex-1">
            <h3 className="text-xl sm:text-2xl font-serif font-bold text-white mb-3">
              Verificación previa esencial
            </h3>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6 max-w-3xl">
              Para optimizar el proceso editorial, hemos diseñado una <strong className="text-white">Guía Rápida Interactiva</strong>. 
              Este checklist le permitirá confirmar, en menos de 5 minutos, si su manuscrito cumple con los requisitos 
              fundamentales antes del envío formal.
            </p>
            
            <div className="flex flex-wrap gap-3">
              <a
                href="/quick.html"
                className="inline-flex items-center gap-2 bg-[#FF7900] text-white px-6 py-3 text-xs uppercase font-bold tracking-wider hover:bg-[#E06A00] transition-all rounded-lg shadow-lg hover:shadow-[#FF7900]/30"
              >
                <CheckCircleIcon className="w-5 h-5" />
                Iniciar Checklist Rápido
              </a>
              <a
                href="https://www.revistacienciasestudiantes.com/policies.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-transparent border-2 border-white/30 text-white px-6 py-3 text-xs uppercase font-bold tracking-wider hover:bg-white hover:text-[#002147] hover:border-white transition-all rounded-lg"
              >
                <BookOpenIcon className="w-5 h-5" />
                Políticas Editoriales
              </a>
            </div>
          </div>
        </div>
      </motion.div>

      {/* SECCIÓN DE PREPARACIÓN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Checklist principal */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm p-8"
        >
          <div className="flex items-center mb-6">
            <ShieldExclamationIcon className="w-6 h-6 text-[#FF7900] mr-3" />
            <h3 className="text-lg font-serif font-bold text-black">
              Criterios de Rechazo Inmediato (Desk Reject)
            </h3>
          </div>
          
          <div className="space-y-6">
            {/* Item 1 - Crítico */}
            <div className="flex items-start p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
              <ShieldExclamationIcon className="w-6 h-6 text-red-600 mr-4 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">Doble ciego comprometido</h4>
                <p className="text-sm text-slate-700 leading-relaxed">
                  El manuscrito <strong className="text-red-600">no debe contener nombres, filiaciones institucionales ni agradecimientos</strong>. 
                  Cualquier dato que revele la identidad del autor anulará el envío de inmediato.
                </p>
              </div>
            </div>

            {/* Item 2 */}
            <div className="flex items-start p-4 bg-slate-50 border-l-4 border-slate-300 rounded-r-lg">
              <CheckCircleIcon className="w-6 h-6 text-slate-500 mr-4 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">Formato de citación estricto</h4>
                <p className="text-sm text-slate-700 leading-relaxed">
                  El documento debe adherirse rigurosamente al formato <strong>Chicago 17.ª ed. (autor-fecha)</strong> en texto y bibliografía.
                </p>
              </div>
            </div>

            {/* Item 3 */}
            <div className="flex items-start p-4 bg-slate-50 border-l-4 border-slate-300 rounded-r-lg">
              <CheckCircleIcon className="w-6 h-6 text-slate-500 mr-4 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">Palabras clave y Códigos</h4>
                <p className="text-sm text-slate-700 leading-relaxed">
                  Debe proporcionar de 3 a 5 palabras clave libres, y <strong>por separado</strong>, asignar los Códigos de 
                  Clasificación especializados de su disciplina (ej. códigos JEL o descriptores MeSH).
                </p>
              </div>
            </div>

            {/* Item 4 */}
            <div className="flex items-start p-4 bg-slate-50 border-l-4 border-slate-300 rounded-r-lg">
              <CheckCircleIcon className="w-6 h-6 text-slate-500 mr-4 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">Declaraciones obligatorias</h4>
                <p className="text-sm text-slate-700 leading-relaxed">
                  El artículo debe incluir al final: Financiamiento, Conflicto de intereses, Disponibilidad de datos y (si aplica) Aprobación ética.
                </p>
              </div>
            </div>

            {/* Item 5 - Crítico */}
            <div className="flex items-start p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
              <ShieldExclamationIcon className="w-6 h-6 text-red-600 mr-4 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">Umbral de similitud (Plagio)</h4>
                <p className="text-sm text-slate-700 leading-relaxed">
                  El índice de similitud <strong className="text-red-600">no puede superar el 15%</strong> (excluyendo bibliografía). 
                  Se verificará mediante software antiplagio antes de iniciar la revisión.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Panel lateral */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col justify-center bg-gradient-to-br from-[#F3F7F9] to-white p-8 rounded-xl border-2 border-[#002147]/10"
        >
          <div className="text-center mb-6">
            <SparklesIcon className="w-12 h-12 text-[#002147] mx-auto mb-4" />
            <h4 className="text-lg font-serif font-bold text-black mb-2">
              Guía Rápida Interactiva
            </h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              Complete el checklist visual de 5 minutos y confirme que su manuscrito está listo para enviar.
            </p>
          </div>
          
          <div className="space-y-3">
            <a
              href="/quick.html"
              className="block text-center text-sm font-bold uppercase tracking-wider text-white bg-[#002147] py-3 px-4 hover:bg-[#00152e] transition-colors rounded-lg shadow-md"
            >
              Abrir Guía Rápida
            </a>
            <a
              href="https://www.revistacienciasestudiantes.com/policies.html"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-sm font-bold uppercase tracking-wider text-[#002147] border-2 border-[#002147] py-3 px-4 hover:bg-[#002147] hover:text-white transition-colors rounded-lg"
            >
              Políticas Completas
            </a>
            <button
              onClick={() => navigate('/guidelines')}
              className="block w-full text-center text-sm font-bold uppercase tracking-wider text-[#FF7900] border-2 border-[#FF7900] py-3 px-4 hover:bg-[#FF7900] hover:text-white transition-colors rounded-lg"
            >
              Guía para Autores
            </button>
          </div>
        </motion.div>
      </div>

      {/* CALL TO ACTION: SISTEMA DE ENVÍO */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-lg"
      >
        <div className="bg-[#002147] px-6 py-4 flex justify-between items-center">
          <span className="text-xs font-bold text-white uppercase tracking-widest">
            Sistema de Envío
          </span>
          <LanguageIcon className="w-5 h-5 text-white/60" />
        </div>
        
        <div className="p-10 sm:p-14 text-center max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-[#F3F7F9] border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ArrowRightOnRectangleIcon className="w-10 h-10 text-[#002147]" />
          </div>
          
          <h3 className="text-2xl font-serif text-black mb-4">
            Acceso al Portal de Autores
          </h3>
          
          <p className="text-slate-600 mb-8 leading-relaxed">
            Para iniciar un nuevo envío o realizar seguimiento a un manuscrito en evaluación, debe autenticarse en el sistema editorial. 
            El proceso es gratuito y solo toma unos minutos.
          </p>

          <button
            onClick={handleSubmitClick}
            className="w-full sm:w-auto bg-[#002147] text-white px-10 py-4 rounded-lg font-bold text-sm tracking-wide hover:bg-[#00152e] hover:shadow-xl hover:shadow-[#002147]/20 transition-all flex items-center justify-center gap-3 mx-auto group"
          >
            <span>Iniciar Sesión / Crear Cuenta</span>
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              For English-language submissions, please access the{' '}
              <a 
                href="/en/login/submit" 
                className="text-[#002147] font-semibold hover:text-[#FF7900] transition-colors underline underline-offset-2"
              >
                English Editorial Portal
              </a>.
            </p>
          </div>
        </div>
      </motion.div>

      {/* FOOTER */}
      <footer className="mt-10 text-center">
        <p className="text-sm text-slate-400">
          ¿Requiere asistencia técnica?{' '}
          <a 
            href="mailto:soporte@revistacienciasestudiantes.com" 
            className="text-[#002147] hover:text-[#FF7900] transition-colors font-medium"
          >
            Contacte a soporte editorial
          </a>
        </p>
      </footer>
    </motion.div>
  );
}

export default SubmitSection;