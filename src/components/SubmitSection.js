import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowRightIcon, 
  DocumentCheckIcon, 
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';

function SubmitSection() {
  const navigate = useNavigate();

  const handleSubmitClick = () => {
    navigate('/login/submit');
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <motion.div
      className="max-w-5xl mx-auto mt-20 mb-24 px-4 sm:px-6 lg:px-8 font-sans"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
      }}
    >
      {/* HEADER EDITORIAL - Centrado estilo FAQ */}
      <motion.header variants={fadeUp} className="mb-12 text-center">
        <h2 className="text-3xl sm:text-4xl font-serif text-black mb-3 tracking-tight">
          Envío de Manuscritos
        </h2>
        <p className="text-[15px] text-[#666666] max-w-2xl mx-auto font-sans">
          El proceso de envío constituye un acto formal que implica la aceptación íntegra de nuestras normativas editoriales y éticas. Agradecemos su interés en someter su investigación al arbitraje de nuestra revista.
        </p>
        <div className="h-[2px] w-16 bg-[#e86125] mx-auto mt-6"></div>
      </motion.header>

      {/* AVISO PROMINENTE */}
      <motion.div variants={fadeUp} className="bg-[#002147] text-white flex flex-col md:flex-row mb-12 rounded-sm shadow-sm">
        <div className="p-8 md:w-2/3 border-b md:border-b-0 md:border-r border-white/10 flex gap-6 items-start">
          <DocumentCheckIcon className="w-10 h-10 text-[#e86125] flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-xl font-serif font-semibold tracking-tight mb-3">
              Verificación Previa Esencial
            </h3>
            <p className="text-[13px] text-slate-300 leading-relaxed font-sans">
              Para optimizar el proceso editorial y evitar el rechazo por formato, hemos diseñado una <strong className="text-white">Guía Rápida Interactiva</strong>. Este checklist le permitirá confirmar, en menos de 5 minutos, si su manuscrito cumple con los requisitos técnicos fundamentales antes de iniciar el envío formal.
            </p>
          </div>
        </div>
        <div className="p-8 md:w-1/3 bg-[#001833] flex flex-col justify-center gap-3">
          <a
            href="/quick.html"
            className="w-full text-center bg-[#e86125] text-white px-6 py-3 text-[11px] uppercase tracking-widest font-bold hover:bg-[#c9521e] transition-colors rounded-sm font-sans"
          >
            Iniciar Checklist Rápido
          </a>
          <a
            href="https://www.revistacienciasestudiantes.com/policies.html"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full text-center border border-white/20 text-white px-6 py-3 text-[11px] uppercase tracking-widest font-bold hover:bg-white hover:text-[#002147] transition-colors rounded-sm font-sans"
          >
            Políticas Editoriales
          </a>
        </div>
      </motion.div>

      {/* SECCIÓN DE PREPARACIÓN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mb-12">
        
        {/* Criterios de Rechazo */}
        <motion.div variants={fadeUp} className="lg:col-span-8">
          <div className="bg-white border border-[#e6e8ea] rounded-sm shadow-sm">
            <div className="px-6 pt-5 pb-3 border-b border-[#e6e8ea] flex items-center justify-between">
              <h3 className="text-lg font-serif font-semibold text-black tracking-tight">
                Criterios de Rechazo Inmediato
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#e86125] font-sans">Desk Reject</span>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Item I - CRÍTICO */}
              <div className="flex gap-4 pl-4 border-l-2 border-red-600">
                <span className="text-red-600 font-serif font-bold text-xl w-6">I.</span>
                <div>
                  <h4 className="text-[14px] font-bold text-black mb-1 flex items-center gap-2 font-sans">
                    Doble Ciego Comprometido
                    <ShieldExclamationIcon className="w-4 h-4 text-red-600" />
                  </h4>
                  <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
                    El manuscrito principal no debe contener nombres, filiaciones institucionales ni agradecimientos. Cualquier dato que revele la identidad del autor anulará el envío de inmediato.
                  </p>
                </div>
              </div>

              {/* Item II */}
              <div className="flex gap-4 pl-4 border-l-2 border-[#cbd0d5]">
                <span className="text-[#a0a0a0] font-serif font-bold text-xl w-6">II.</span>
                <div>
                  <h4 className="text-[14px] font-bold text-black mb-1 font-sans">Formato de Citación Estricto</h4>
                  <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
                    El documento debe adherirse rigurosamente al formato <strong>Chicago 17.ª ed. (autor-fecha)</strong> en el cuerpo del texto y en la bibliografía final.
                  </p>
                </div>
              </div>

              {/* Item III */}
              <div className="flex gap-4 pl-4 border-l-2 border-[#cbd0d5]">
                <span className="text-[#a0a0a0] font-serif font-bold text-xl w-6">III.</span>
                <div>
                  <h4 className="text-[14px] font-bold text-black mb-1 font-sans">Taxonomía y Clasificación</h4>
                  <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
                    Debe proporcionar de 3 a 5 palabras clave libres y, por separado, asignar los Códigos de Clasificación especializados de su disciplina (ej. códigos JEL, descriptores MeSH).
                  </p>
                </div>
              </div>

              {/* Item IV */}
              <div className="flex gap-4 pl-4 border-l-2 border-[#cbd0d5]">
                <span className="text-[#a0a0a0] font-serif font-bold text-xl w-6">IV.</span>
                <div>
                  <h4 className="text-[14px] font-bold text-black mb-1 font-sans">Declaraciones Obligatorias</h4>
                  <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
                    El artículo debe incluir al final las siguientes secciones: Financiamiento, Conflicto de Intereses, Disponibilidad de Datos y Aprobación Ética (si aplica).
                  </p>
                </div>
              </div>

              {/* Item V - CRÍTICO */}
              <div className="flex gap-4 pl-4 border-l-2 border-red-600">
                <span className="text-red-600 font-serif font-bold text-xl w-6">V.</span>
                <div>
                  <h4 className="text-[14px] font-bold text-black mb-1 flex items-center gap-2 font-sans">
                    Umbral de Similitud (Plagio)
                    <ShieldExclamationIcon className="w-4 h-4 text-red-600" />
                  </h4>
                  <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
                    El índice de similitud no puede superar el <strong className="text-red-600">15%</strong> (excluyendo bibliografía). Se verificará mediante software antiplagio antes de iniciar la revisión de pares.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Panel lateral de recursos */}
        <motion.div variants={fadeUp} className="lg:col-span-4">
          <div className="bg-white border border-[#e6e8ea] rounded-sm shadow-sm p-6 sticky top-8">
            <h4 className="text-[13px] font-bold font-sans uppercase tracking-wider text-black mb-4 border-b border-[#e6e8ea] pb-3">
              Recursos de Envío
            </h4>
            
            <div className="space-y-0 mb-6 divide-y divide-[#e6e8ea]">
              <a href="/guidelines" className="group flex items-start justify-between py-3 hover:bg-[#f8f9fa] transition-colors px-2 -mx-2">
                <span className="text-[14px] text-[#2b2b2b] font-medium group-hover:text-[#e86125] transition-colors font-sans">Guía para Autores</span>
                <ArrowTopRightOnSquareIcon className="w-4 h-4 text-[#a0a0a0] group-hover:text-[#e86125]" />
              </a>
              <a href="https://www.revistacienciasestudiantes.com/policies.html" target="_blank" rel="noopener noreferrer" className="group flex items-start justify-between py-3 hover:bg-[#f8f9fa] transition-colors px-2 -mx-2">
                <span className="text-[14px] text-[#2b2b2b] font-medium group-hover:text-[#e86125] transition-colors font-sans">Políticas Completas</span>
                <ArrowTopRightOnSquareIcon className="w-4 h-4 text-[#a0a0a0] group-hover:text-[#e86125]" />
              </a>
            </div>

            <div className="bg-[#f8f9fa] border border-[#e6e8ea] p-4 rounded-sm">
              <div className="flex items-center gap-2 mb-2">
                <ExclamationTriangleIcon className="w-4 h-4 text-[#e86125]" />
                <h5 className="text-[11px] font-bold uppercase tracking-widest text-black font-sans">Aviso Importante</h5>
              </div>
              <p className="text-[12px] text-[#666666] leading-relaxed font-sans">
                El incumplimiento de los Criterios I y V resultará en un rechazo definitivo y la inhabilitación para reenviar el mismo manuscrito en la convocatoria actual.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* CALL TO ACTION */}
      <motion.div variants={fadeUp} className="max-w-3xl mx-auto">
        <div className="bg-white border border-[#e6e8ea] p-10 sm:p-14 text-center rounded-sm shadow-sm relative">
          <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#e86125] font-sans">
            Plataforma Segura
          </span>
          
          <h3 className="text-2xl font-serif font-semibold tracking-tight text-black mb-4">
            Acceso al Portal de Autores
          </h3>
          
          <p className="text-[14px] text-[#666666] mb-8 leading-relaxed max-w-lg mx-auto font-sans">
            Para someter un nuevo manuscrito, adjuntar correcciones (<span className="italic">Revise & Resubmit</span>) o realizar el seguimiento del proceso de arbitraje, debe autenticarse en el sistema editorial. El registro es completamente gratuito.
          </p>

          <button
            onClick={handleSubmitClick}
            className="w-full sm:w-auto bg-[#002147] text-white px-10 py-3 text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-[#e86125] transition-colors rounded-sm inline-flex items-center justify-center gap-3 mb-6 font-sans"
          >
            <span>Iniciar Sesión / Crear Cuenta</span>
            <ArrowRightIcon className="w-4 h-4" />
          </button>

          <div className="pt-6 border-t border-[#e6e8ea] max-w-sm mx-auto">
            <p className="text-[12px] text-[#a0a0a0] font-sans">
              For English-language submissions, please access the{' '}
              <a 
                href="/en/login/submit" 
                className="text-[#002147] font-bold hover:text-[#e86125] transition-colors underline underline-offset-4"
              >
                English Editorial Portal
              </a>.
            </p>
          </div>
        </div>
      </motion.div>

      {/* FOOTER TÉCNICO */}
      <motion.footer variants={fadeUp} className="mt-12 text-center border-t border-[#e6e8ea] pt-8">
        <p className="text-[12px] text-[#a0a0a0] font-sans">
          ¿Requiere asistencia técnica? Contacte a{' '}
          <a 
            href="mailto:contact@revistacienciasestudiantes.com" 
            className="text-[#002147] hover:text-[#e86125] transition-colors font-medium border-b border-transparent hover:border-[#e86125]"
          >
            contact@revistacienciasestudiantes.com
          </a>
        </p>
      </motion.footer>
    </motion.div>
  );
}

export default SubmitSection;