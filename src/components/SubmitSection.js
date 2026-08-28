import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowRightIcon, 
  DocumentCheckIcon, 
  ShieldExclamationIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

function SubmitSection() {
  const navigate = useNavigate();

  const handleSubmitClick = () => {
    navigate('/login/submit');
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } }
  };

  return (
    <div className="w-full bg-[#FCFCFB] text-[#111] min-h-screen pb-24">
      {/* INYECCIÓN TIPOGRÁFICA ESTRICTA */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700&family=Inter:wght@400;500;600;700;800&display=swap');
        
        .font-journal { font-family: 'Merriweather', serif; }
        .font-system { font-family: 'Inter', sans-serif; }
      `}} />

      <motion.div
        className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-16"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.12 } }
        }}
      >
        {/* --- HEADER EDITORIAL (Estilo Masthead) --- */}
        <motion.header variants={fadeUp} className="mb-16">
          <div className="border-b-[4px] border-[#002147] pb-6 mb-8">
            <h1 className="text-5xl md:text-7xl font-journal font-black tracking-tighter text-[#002147] leading-none">
              Envío de Manuscritos<span className="text-[#e86125]">.</span>
            </h1>
            <p className="font-system font-bold uppercase tracking-[0.25em] text-xs text-slate-500 mt-5">
              Portal Oficial de Autores y Normativas Editoriales
            </p>
          </div>
          <div className="max-w-3xl">
            <p className="font-journal text-lg md:text-xl text-[#475569] leading-relaxed">
              El proceso de envío constituye un acto formal que implica la aceptación íntegra de nuestras normativas editoriales y éticas. Agradecemos su interés en someter su investigación al arbitraje de nuestra revista.
            </p>
            <div className="flex items-center gap-4 mt-4">
              <div className="h-[2px] w-16 bg-[#e86125]"></div>
              <p className="font-system text-xs font-medium text-slate-400">
                Proceso de arbitraje por pares ciego
              </p>
            </div>
          </div>
        </motion.header>

        {/* --- AVISO PROMINENTE EDITORIAL --- */}
        <motion.div variants={fadeUp} className="mb-16 relative overflow-hidden">
          <div className="bg-[#002147] text-white border-l-[6px] border-[#e86125] flex flex-col md:flex-row">
            <div className="p-10 md:p-12 md:w-2/3 flex gap-6 items-start">
              <DocumentCheckIcon className="w-12 h-12 text-[#e86125] flex-shrink-0" />
              <div>
                <h3 className="text-2xl font-journal font-bold tracking-tight mb-3">
                  Verificación Previa Esencial
                </h3>
                <p className="text-sm font-system text-slate-300 leading-relaxed font-light">
                  Para optimizar el proceso editorial y evitar el rechazo por formato, hemos diseñado una <strong className="text-white font-semibold">Guía Rápida Interactiva</strong>. Este checklist le permitirá confirmar, en menos de 5 minutos, si su manuscrito cumple con los requisitos técnicos fundamentales antes de iniciar el envío formal.
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <ClockIcon className="w-4 h-4 text-[#e86125]" />
                  <span className="font-system text-xs text-slate-400">Tiempo estimado: 5 minutos</span>
                </div>
              </div>
            </div>
            <div className="p-10 md:p-12 md:w-1/3 bg-[#001833] border-t md:border-t-0 md:border-l border-white/10 flex flex-col justify-center gap-4">
              <a
                href="/quick.html"
                className="w-full text-center bg-[#e86125] text-white px-6 py-4 text-xs uppercase tracking-[0.2em] font-bold hover:bg-[#c9521e] transition-colors font-system"
              >
                Iniciar Checklist
              </a>
              <a
                href="https://www.revistacienciasestudiantes.com/policies.html"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center border border-white/20 text-white px-6 py-4 text-xs uppercase tracking-[0.2em] font-bold hover:bg-white hover:text-[#002147] transition-colors font-system"
              >
                Ver Políticas
              </a>
            </div>
          </div>
        </motion.div>

        {/* --- SECCIÓN DE PREPARACIÓN (Columnas tipo periódico) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 mb-20">
          
          {/* Columna Principal: Criterios de Rechazo */}
          <motion.div variants={fadeUp} className="lg:col-span-8">
            <div className="flex items-end justify-between border-b-2 border-[#002147] pb-4 mb-8">
              <h3 className="text-3xl font-journal font-bold text-[#002147] tracking-tight">
                Criterios de Rechazo Inmediato
              </h3>
              <span className="font-system text-[10px] font-black uppercase tracking-widest text-[#e86125] bg-[#e86125]/10 px-3 py-1">
                Desk Reject
              </span>
            </div>

            <div className="space-y-8 font-system">
              {/* Item I - CRÍTICO */}
              <div className="flex gap-6 border-b border-slate-200 pb-8">
                <span className="font-journal font-black text-3xl text-red-700 mt-1">I.</span>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-lg font-bold text-[#002147] flex items-center gap-2">
                      Doble Ciego Comprometido
                      <ShieldExclamationIcon className="w-5 h-5 text-red-700" />
                    </h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-50 px-2 py-1">
                      Crítico
                    </span>
                  </div>
                  <p className="text-sm text-[#475569] leading-relaxed">
                    El manuscrito principal no debe contener nombres, filiaciones institucionales ni agradecimientos. Cualquier dato que revele la identidad del autor anulará el envío de inmediato.
                  </p>
                </div>
              </div>

              {/* Item II */}
              <div className="flex gap-6 border-b border-slate-200 pb-8">
                <span className="font-journal font-black text-3xl text-slate-300 mt-1">II.</span>
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-[#002147] mb-2">Formato de Citación Estricto</h4>
                  <p className="text-sm text-[#475569] leading-relaxed">
                    El documento debe adherirse rigurosamente al formato <strong className="text-[#002147]">Chicago 17.ª ed. (autor-fecha)</strong> en el cuerpo del texto y en la bibliografía final.
                  </p>
                </div>
              </div>

              {/* Item III */}
              <div className="flex gap-6 border-b border-slate-200 pb-8">
                <span className="font-journal font-black text-3xl text-slate-300 mt-1">III.</span>
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-[#002147] mb-2">Taxonomía y Clasificación</h4>
                  <p className="text-sm text-[#475569] leading-relaxed">
                    Debe proporcionar de 3 a 5 palabras clave libres y, por separado, asignar los Códigos de Clasificación especializados de su disciplina (ej. códigos JEL, descriptores MeSH).
                  </p>
                </div>
              </div>

              {/* Item IV */}
              <div className="flex gap-6 border-b border-slate-200 pb-8">
                <span className="font-journal font-black text-3xl text-slate-300 mt-1">IV.</span>
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-[#002147] mb-2">Declaraciones Obligatorias</h4>
                  <p className="text-sm text-[#475569] leading-relaxed">
                    El artículo debe incluir al final las siguientes secciones: Financiamiento, Conflicto de Intereses, Disponibilidad de Datos y Aprobación Ética (si aplica).
                  </p>
                </div>
              </div>

              {/* Item V - CRÍTICO */}
              <div className="flex gap-6 pb-2">
                <span className="font-journal font-black text-3xl text-red-700 mt-1">V.</span>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-lg font-bold text-[#002147] flex items-center gap-2">
                      Umbral de Similitud (Plagio)
                      <ShieldExclamationIcon className="w-5 h-5 text-red-700" />
                    </h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-50 px-2 py-1">
                      Crítico
                    </span>
                  </div>
                  <p className="text-sm text-[#475569] leading-relaxed">
                    El índice de similitud no puede superar el <strong className="text-red-700">15%</strong> (excluyendo bibliografía). Se verificará mediante software antiplagio antes de iniciar la revisión de pares.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Sidebar lateral: Recursos */}
          <motion.div variants={fadeUp} className="lg:col-span-4 flex flex-col gap-8 pt-2">
            {/* Caja de Recursos */}
            <div>
              <div className="flex items-center justify-between border-b border-[#002147] pb-2 mb-6">
                <h3 className="font-system font-black uppercase tracking-[0.2em] text-sm text-[#002147]">Recursos Clave</h3>
              </div>
              
              <div className="flex flex-col gap-0 font-system">
                <a href="/guidelines" className="group flex items-center justify-between py-4 border-b border-slate-200 hover:bg-slate-50 transition-colors -mx-4 px-4">
                  <span className="text-sm font-bold text-[#002147] group-hover:text-[#e86125] transition-colors">Guía Integral para Autores</span>
                  <ArrowTopRightOnSquareIcon className="w-4 h-4 text-slate-400 group-hover:text-[#e86125]" />
                </a>
                <a href="https://www.revistacienciasestudiantes.com/policies.html" target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between py-4 border-b border-slate-200 hover:bg-slate-50 transition-colors -mx-4 px-4">
                  <span className="text-sm font-bold text-[#002147] group-hover:text-[#e86125] transition-colors">Políticas Editoriales Completas</span>
                  <ArrowTopRightOnSquareIcon className="w-4 h-4 text-slate-400 group-hover:text-[#e86125]" />
                </a>
                <a href="/templates" className="group flex items-center justify-between py-4 border-b border-slate-200 hover:bg-slate-50 transition-colors -mx-4 px-4">
                  <span className="text-sm font-bold text-[#002147] group-hover:text-[#e86125] transition-colors">Plantillas de Manuscrito (Word/LaTeX)</span>
                  <ArrowTopRightOnSquareIcon className="w-4 h-4 text-slate-400 group-hover:text-[#e86125]" />
                </a>
                <a href="/faq" className="group flex items-center justify-between py-4 hover:bg-slate-50 transition-colors -mx-4 px-4">
                  <span className="text-sm font-bold text-[#002147] group-hover:text-[#e86125] transition-colors">Preguntas Frecuentes de Envío</span>
                  <ArrowTopRightOnSquareIcon className="w-4 h-4 text-slate-400 group-hover:text-[#e86125]" />
                </a>
              </div>
            </div>

            {/* Cuadro de Advertencia */}
            <div className="bg-red-50/50 border border-red-100 p-6">
              <div className="flex items-center gap-3 mb-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-700" />
                <h5 className="font-system text-[11px] font-black uppercase tracking-widest text-red-900">Aviso Institucional</h5>
              </div>
              <p className="font-system text-xs text-red-800/80 leading-relaxed">
                El incumplimiento de los <strong className="text-red-900">Criterios I y V</strong> resultará en un rechazo definitivo y la inhabilitación para reenviar el mismo manuscrito durante la convocatoria en curso.
              </p>
            </div>

            {/* Mini checklist de preparación */}
            <div className="border border-slate-200 p-6">
              <h5 className="font-system text-[11px] font-black uppercase tracking-widest text-[#002147] mb-4">
                Antes de Enviar
              </h5>
              <ul className="space-y-3 font-system text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-[#e86125] flex-shrink-0 mt-0.5" />
                  Manuscrito anonimizado
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-[#e86125] flex-shrink-0 mt-0.5" />
                  Portada separada con datos del autor
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-[#e86125] flex-shrink-0 mt-0.5" />
                  Carta de presentación firmada
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-[#e86125] flex-shrink-0 mt-0.5" />
                  Declaración de originalidad
                </li>
              </ul>
            </div>
          </motion.div>
        </div>

        {/* --- CALL TO ACTION EDITORIAL --- */}
        <motion.div variants={fadeUp} className="border-t-[4px] border-[#002147] bg-white p-12 md:p-20 text-center relative shadow-sm">
          <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#FCFCFB] px-6 font-system text-[10px] font-black uppercase tracking-[0.25em] text-[#e86125]">
            Plataforma Segura
          </span>
          
          <h3 className="text-4xl font-journal font-black tracking-tight text-[#002147] mb-6">
            Portal Oficial de Autores
          </h3>
          
          <p className="font-system text-sm text-[#475569] mb-10 leading-relaxed max-w-2xl mx-auto">
            Para someter un nuevo manuscrito, adjuntar correcciones (<span className="italic font-journal">Revise & Resubmit</span>) o realizar el seguimiento del proceso de arbitraje, debe autenticarse en el sistema editorial. El registro es completamente gratuito.
          </p>

          <button
            onClick={handleSubmitClick}
            className="w-full sm:w-auto bg-[#002147] text-white px-12 py-5 text-xs font-system font-bold uppercase tracking-[0.2em] hover:bg-[#e86125] transition-colors inline-flex items-center justify-center gap-4"
          >
            <span>Iniciar Sesión / Registro</span>
            <ArrowRightIcon className="w-4 h-4 stroke-[3]" />
          </button>

          <div className="mt-12 pt-8 border-t border-slate-200 max-w-md mx-auto">
            <p className="font-system text-xs text-slate-500">
              For English-language submissions, please access the{' '}
              <a 
                href="/en/login/submit" 
                className="text-[#002147] font-bold hover:text-[#e86125] transition-colors underline underline-offset-4"
              >
                English Editorial Portal
              </a>.
            </p>
          </div>
        </motion.div>

        {/* --- FOOTER TÉCNICO --- */}
        <motion.footer variants={fadeUp} className="mt-20 text-center pb-8">
          <p className="font-system text-xs text-slate-400 font-medium tracking-wide">
            ¿Requiere asistencia técnica? Contacte a{' '}
            <a 
              href="mailto:contact@revistacienciasestudiantes.com" 
              className="text-[#002147] font-bold hover:text-[#e86125] transition-colors"
            >
              contact@revistacienciasestudiantes.com
            </a>
          </p>
        </motion.footer>

      </motion.div>
    </div>
  );
}

export default SubmitSection;