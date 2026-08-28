import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowRightIcon, 
  DocumentCheckIcon, 
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  InformationCircleIcon
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
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        
        {/* ENCABEZADO EDITORIAL */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-12 text-center"
        >
          <h2 className="text-4xl sm:text-5xl font-serif text-black mb-3 tracking-tight">
            Envío de <span className="italic text-[#001833]">Manuscritos.</span>
          </h2>
          <p className="text-[15px] text-[#666666] max-w-2xl mx-auto font-sans">
            El proceso de envío constituye un acto formal que implica la aceptación íntegra de nuestras normativas editoriales y éticas.
          </p>
          <div className="h-[2px] w-16 bg-[#e86125] mx-auto mt-6"></div>
        </motion.div>

        {/* TARJETA DE VERIFICACIÓN */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-12"
        >
          <div className="bg-white border border-[#e6e8ea] rounded-sm shadow-sm p-6 sm:p-8 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Icono */}
              <div className="flex-shrink-0 bg-[#f4f5f7] text-[#002147] p-4 rounded-full flex items-center justify-center">
                <DocumentCheckIcon className="h-8 w-8" />
              </div>

              {/* Contenido */}
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg font-serif font-semibold text-black tracking-tight mb-2">
                  Verificación Previa Recomendada
                </h3>
                <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
                  Para optimizar el proceso editorial y facilitar la revisión de su manuscrito, le recomendamos completar nuestra <strong className="text-black">Guía Rápida Interactiva</strong>. Este checklist le ayudará a confirmar que su trabajo cumple con los requisitos técnicos fundamentales antes de iniciar el envío.
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
                  <ClockIcon className="w-4 h-4 text-[#e86125]" />
                  <span className="font-sans text-[12px] text-[#a0a0a0]">Tiempo estimado: 5 minutos</span>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex flex-col gap-3 w-full sm:w-auto flex-shrink-0">
                <a
                  href="/quick.html"
                  className="w-full sm:w-auto px-6 py-3 bg-[#e86125] hover:bg-[#c9521e] text-white text-[11px] font-bold uppercase tracking-widest rounded-sm transition-colors text-center font-sans"
                >
                  Iniciar Checklist
                </a>
                <a
                  href="https://www.revistacienciasestudiantes.com/policies.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-6 py-3 border border-[#e6e8ea] text-[#002147] text-[11px] font-bold uppercase tracking-widest hover:bg-[#f8f9fa] transition-colors rounded-sm text-center font-sans"
                >
                  Ver Políticas
                </a>
              </div>
            </div>
          </div>
        </motion.div>

        {/* GUÍA DE PREPARACIÓN */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mb-12">
          
          {/* Columna Principal: Requisitos de Preparación */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="lg:col-span-7"
          >
            <div className="flex items-end justify-between border-b-2 border-[#e6e8ea] pb-4 mb-8">
              <h3 className="text-2xl font-serif font-semibold text-black tracking-tight">
                Requisitos de Preparación
              </h3>
              <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#e86125] bg-[#e86125]/10 px-3 py-1 rounded-sm">
                Checklist
              </span>
            </div>

            <div className="space-y-6">
              {/* Item I */}
              <div className="flex gap-4 border-b border-[#e6e8ea] pb-6">
                <span className="font-serif font-bold text-xl text-black mt-1">I.</span>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-[14px] font-bold text-black flex items-center gap-2 font-sans">
                      Anonimización del Manuscrito
                      <InformationCircleIcon className="w-4 h-4 text-[#e86125]" />
                    </h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#e86125] bg-[#e86125]/5 px-2 py-1 rounded-sm font-sans">
                      Importante
                    </span>
                  </div>
                  <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
                    Para garantizar la integridad del proceso de revisión por pares doble ciego, le solicitamos que el manuscrito principal no contenga nombres, filiaciones institucionales ni agradecimientos. Estos datos deben incluirse únicamente en la portada separada.
                  </p>
                </div>
              </div>

              {/* Item II */}
              <div className="flex gap-4 border-b border-[#e6e8ea] pb-6">
                <span className="font-serif font-bold text-xl text-black mt-1">II.</span>
                <div className="flex-1">
                  <h4 className="text-[14px] font-bold text-black mb-2 font-sans">Formato de Citación</h4>
                  <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
                    Recomendamos adherirse al formato <strong className="text-black">Chicago 17.ª ed. (autor-fecha)</strong> tanto en el cuerpo del texto como en la bibliografía final para mantener la consistencia editorial.
                  </p>
                </div>
              </div>

              {/* Item III */}
              <div className="flex gap-4 border-b border-[#e6e8ea] pb-6">
                <span className="font-serif font-bold text-xl text-black mt-1">III.</span>
                <div className="flex-1">
                  <h4 className="text-[14px] font-bold text-black mb-2 font-sans">Palabras Clave y Clasificación</h4>
                  <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
                    Le solicitamos proporcionar de 3 a 5 palabras clave libres y, adicionalmente, asignar los Códigos de Clasificación especializados de su disciplina (ej. códigos JEL, descriptores MeSH) para facilitar la indexación.
                  </p>
                </div>
              </div>

              {/* Item IV */}
              <div className="flex gap-4 border-b border-[#e6e8ea] pb-6">
                <span className="font-serif font-bold text-xl text-black mt-1">IV.</span>
                <div className="flex-1">
                  <h4 className="text-[14px] font-bold text-black mb-2 font-sans">Declaraciones de Transparencia</h4>
                  <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
                    Para cumplir con los estándares éticos de publicación, le recomendamos incluir al final del artículo las secciones de: Financiamiento, Conflicto de Intereses, Disponibilidad de Datos y Aprobación Ética (cuando corresponda).
                  </p>
                </div>
              </div>

              {/* Item V */}
              <div className="flex gap-4">
                <span className="font-serif font-bold text-xl text-black mt-1">V.</span>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-[14px] font-bold text-black flex items-center gap-2 font-sans">
                      Originalidad del Trabajo
                      <InformationCircleIcon className="w-4 h-4 text-[#e86125]" />
                    </h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#e86125] bg-[#e86125]/5 px-2 py-1 rounded-sm font-sans">
                      Importante
                    </span>
                  </div>
                  <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
                    Valoramos la originalidad en todas las contribuciones. Le recomendamos verificar que el índice de similitud de su manuscrito se mantenga por debajo del <strong className="text-black">15%</strong> (excluyendo bibliografía) para facilitar el proceso de revisión.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Sidebar: Recursos */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="lg:col-span-5"
          >
            <div className="space-y-6">
              {/* Recursos Clave */}
              <div className="bg-white border border-[#e6e8ea] rounded-sm shadow-sm">
                <h3 className="text-[13px] font-bold font-sans uppercase tracking-wider text-black px-6 pt-5 pb-3 border-b border-[#e6e8ea]">
                  Recursos Clave
                </h3>
                <div className="px-6 py-4 space-y-0 divide-y divide-[#e6e8ea]">
                  <a href="/guidelines" className="group flex items-center justify-between py-3 hover:bg-[#f8f9fa] transition-colors px-2 -mx-2">
                    <span className="text-[14px] text-[#2b2b2b] font-medium group-hover:text-[#e86125] transition-colors font-sans">Guía Integral para Autores</span>
                    <ArrowTopRightOnSquareIcon className="w-4 h-4 text-[#a0a0a0] group-hover:text-[#e86125]" />
                  </a>
                  <a href="https://www.revistacienciasestudiantes.com/policies.html" target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between py-3 hover:bg-[#f8f9fa] transition-colors px-2 -mx-2">
                    <span className="text-[14px] text-[#2b2b2b] font-medium group-hover:text-[#e86125] transition-colors font-sans">Políticas Editoriales Completas</span>
                    <ArrowTopRightOnSquareIcon className="w-4 h-4 text-[#a0a0a0] group-hover:text-[#e86125]" />
                  </a>
                  <a href="/faq" className="group flex items-center justify-between py-3 hover:bg-[#f8f9fa] transition-colors px-2 -mx-2">
                    <span className="text-[14px] text-[#2b2b2b] font-medium group-hover:text-[#e86125] transition-colors font-sans">Preguntas Frecuentes de Envío</span>
                    <ArrowTopRightOnSquareIcon className="w-4 h-4 text-[#a0a0a0] group-hover:text-[#e86125]" />
                  </a>
                </div>
              </div>

              {/* Cuadro Informativo */}
              <div className="bg-[#f8f9fa] border border-[#e6e8ea] rounded-sm p-6">
                <div className="flex items-center gap-2 mb-2">
                  <InformationCircleIcon className="w-4 h-4 text-[#e86125]" />
                  <h5 className="text-[11px] font-bold uppercase tracking-widest text-black font-sans">Recomendación</h5>
                </div>
                <p className="text-[12px] text-[#666666] leading-relaxed font-sans">
                  Prestar especial atención a los <strong className="text-black">puntos I y V</strong> facilitará significativamente el proceso de revisión y evitará demoras innecesarias.
                </p>
              </div>

              {/* Mini checklist de preparación */}
              <div className="bg-white border border-[#e6e8ea] rounded-sm shadow-sm">
                <h3 className="text-[13px] font-bold font-sans uppercase tracking-wider text-black px-6 pt-5 pb-3 border-b border-[#e6e8ea]">
                  Antes de Enviar
                </h3>
                <div className="px-6 py-4">
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <CheckCircleIcon className="w-4 h-4 text-[#e86125] flex-shrink-0 mt-0.5" />
                      <span className="text-[13px] text-[#666666] font-sans">Manuscrito anonimizado</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircleIcon className="w-4 h-4 text-[#e86125] flex-shrink-0 mt-0.5" />
                      <span className="text-[13px] text-[#666666] font-sans">Portada separada con datos del autor</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircleIcon className="w-4 h-4 text-[#e86125] flex-shrink-0 mt-0.5" />
                      <span className="text-[13px] text-[#666666] font-sans">Breve texto al editor explicando el valor y aporte de su artículo</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircleIcon className="w-4 h-4 text-[#e86125] flex-shrink-0 mt-0.5" />
                      <span className="text-[13px] text-[#666666] font-sans">Declaración de originalidad</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* CALL TO ACTION */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="max-w-3xl mx-auto"
        >
          <div className="bg-white border border-[#e6e8ea] p-10 sm:p-14 text-center rounded-sm shadow-sm relative">
            <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#e86125] font-sans">
              Plataforma Segura
            </span>
            
            <h3 className="text-2xl font-serif font-semibold tracking-tight text-black mb-4">
              Portal Oficial de Autores
            </h3>
            
            <p className="text-[14px] text-[#666666] mb-8 leading-relaxed max-w-lg mx-auto font-sans">
              Para someter un nuevo manuscrito, adjuntar correcciones (<span className="italic">Revise & Resubmit</span>) o realizar el seguimiento del proceso de arbitraje, debe autenticarse en el sistema editorial. El registro es completamente gratuito.
            </p>

            <button
              onClick={handleSubmitClick}
              className="w-full sm:w-auto bg-[#002147] text-white px-10 py-3 text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-[#e86125] transition-colors rounded-sm inline-flex items-center justify-center gap-3 mb-6 font-sans"
            >
              <span>Iniciar Sesión / Registro</span>
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
        <motion.footer 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mt-12 text-center border-t border-[#e6e8ea] pt-8"
        >
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

      </div>
    </section>
  );
}

export default SubmitSection;