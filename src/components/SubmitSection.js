import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

function SubmitSection() {
  const navigate = useNavigate();

  const handleSubmitClick = () => {
    navigate('/login');
  };

  return (
    <motion.div
      className="max-w-5xl mx-auto mt-8 mb-16 px-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Encabezado Directo */}
      <header className="mb-10 border-b border-gray-100 pb-8">
        <h2 className="text-3xl font-serif font-bold text-gray-900 mb-2">
          Envío de Manuscritos
        </h2>
        <p className="text-gray-500 font-light">
          Agradecemos su interés en publicar con nosotros. El envío es un acto formal que implica la aceptación de nuestras políticas editoriales.
        </p>
      </header>

      {/* AVISO PROMINENTE: Lectura obligatoria de Guías y Políticas */}
      <div className="bg-[#001f3f] text-white p-8 rounded-sm mb-10 shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          {/* Icono de advertencia / libro */}
          <div className="flex-shrink-0">
            <svg className="w-12 h-12 text-[#c0a86a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-serif font-bold text-[#c0a86a] mb-2">
              Lectura obligatoria antes de enviar
            </h3>
            <p className="text-sm text-gray-200 leading-relaxed mb-4">
              El envío de un manuscrito implica la <strong>aceptación íntegra</strong> de nuestras 
              Políticas Editoriales y el compromiso de cumplir con las Directrices para Autores. 
              El incumplimiento de cualquiera de sus disposiciones —incluyendo el estilo de citación 
              Chicago 17.ª ed. (autor-fecha), la anonimización del documento, la declaración ética, 
              las palabras clave con vocabulario controlado y los límites de similitud— podrá dar 
              lugar al <strong>rechazo inmediato</strong> del manuscrito, sin pasar a revisión por pares.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://www.revistacienciasestudiantes.com/policies.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#c0a86a] text-[#001f3f] px-5 py-2.5 text-xs uppercase font-bold tracking-[0.15em] hover:bg-white hover:text-[#001f3f] transition-colors rounded-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Políticas Editoriales Completas
              </a>
              <button
                onClick={() => navigate('/guidelines')}
                className="inline-flex items-center gap-2 bg-transparent border-2 border-white text-white px-5 py-2.5 text-xs uppercase font-bold tracking-[0.15em] hover:bg-white hover:text-[#001f3f] transition-colors rounded-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Guía para Autores
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sección de Preparación (Checklist/Directrices) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="md:col-span-2 bg-gray-50 p-8 rounded-sm border-l-4 border-gray-900">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-900 mb-4">
            Lista de verificación previa al envío
          </h3>
          <ul className="space-y-4 text-sm text-gray-700">
            <li className="flex items-start">
              <span className="mr-3 text-gray-900 font-bold">01.</span>
              <span>
                <strong>Anonimización estricta.</strong> Es obligatorio que el documento esté completamente anonimizado. 
                <span className="text-red-700 font-semibold"> No incluya su nombre, filiación institucional ni agradecimientos </span> 
                dentro del archivo cargado. La revisión por pares es doble ciego y cualquier dato identificativo 
                compromete el proceso.
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-3 text-gray-900 font-bold">02.</span>
              <span>
                <strong>Estilo Chicago 17.ª ed. (autor-fecha).</strong> Todas las citas y referencias deben ajustarse 
                estrictamente a este formato. Consulte la Guía para Autores para ver ejemplos precisos.
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-3 text-gray-900 font-bold">03.</span>
              <span>
                <strong>Palabras clave con vocabulario controlado.</strong> Debe incluir entre 2 y 6 palabras clave 
                utilizando el sistema de clasificación que corresponda a su área (JEL, MeSH, ACM o UNESCO). 
                Consulte las Políticas Editoriales para el mapeo completo.
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-3 text-gray-900 font-bold">04.</span>
              <span>
                <strong>Declaraciones obligatorias.</strong> Su manuscrito debe incluir: declaración de conflicto de intereses, 
                declaración de financiamiento, declaración de disponibilidad de datos y, cuando corresponda, 
                declaración de aprobación ética y consentimiento informado.
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-3 text-gray-900 font-bold">05.</span>
              <span>
                <strong>Similitud máxima: 15%.</strong> Los manuscritos con un porcentaje de similitud superior 
                serán devueltos sin revisión. Utilice PlagiarismGuard o una herramienta equivalente para verificarlo.
              </span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col justify-center bg-[#f0f4f8] p-8 rounded-sm border border-[#c0a86a]">
          <h4 className="text-xs font-bold text-[#001f3f] uppercase tracking-tighter mb-3">
            ¿Ha leído las políticas?
          </h4>
          <p className="text-xs text-gray-700 mb-5 leading-relaxed">
            Al marcar la casilla de aceptación en el formulario de envío, usted declara haber leído, 
            comprendido y aceptado en su totalidad las Políticas Editoriales de la Revista. 
            <strong className="text-[#001f3f]"> Este no es un trámite opcional.</strong>
          </p>
          <div className="space-y-2">
            <a
              href="https://www.revistacienciasestudiantes.com/policies.html"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-xs font-bold uppercase tracking-widest text-[#001f3f] border-2 border-[#001f3f] py-2.5 px-4 hover:bg-[#001f3f] hover:text-white transition-colors rounded-sm"
            >
              Leer Políticas Editoriales
            </a>
            <button
              onClick={() => navigate('/guidelines')}
              className="block w-full text-center text-xs font-bold uppercase tracking-widest text-[#c0a86a] border-2 border-[#c0a86a] py-2.5 px-4 hover:bg-[#c0a86a] hover:text-white transition-colors rounded-sm"
            >
              Consultar Guía para Autores
            </button>
          </div>
        </div>
      </div>

      {/* Nuevo Contenedor de Envío */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-sm overflow-hidden">
        <div className="bg-gray-900 py-3 px-6">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">
            Sistema de Envío de Manuscritos
          </span>
        </div>
        
        <div className="p-12 text-center">
          <div className="max-w-md mx-auto">
            <svg 
              className="w-16 h-16 mx-auto text-gray-400 mb-4" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
              />
            </svg>
            
            <h3 className="text-xl font-serif font-bold text-gray-900 mb-3">
              Envíe su manuscrito a través del portal
            </h3>
            
            <p className="text-gray-600 mb-6">
              Para realizar el envío, debe iniciar sesión o crear una cuenta en nuestro sistema editorial. 
              Una vez dentro, diríjase a la pestaña «Enviar manuscrito» para completar el proceso.
            </p>

            <div className="space-y-3">
              <button
                onClick={handleSubmitClick}
                className="w-full bg-gray-900 text-white py-3 px-6 rounded-sm hover:bg-gray-800 transition-colors font-medium"
              >
                Iniciar sesión o crear cuenta
              </button>
              
              <p className="text-sm text-gray-500">
                ¿Ya tiene cuenta?{' '}
                <button
                  onClick={handleSubmitClick}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Acceder ahora
                </button>
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Para envíos en inglés,{' '}
                <a 
                  href="/en/login" 
                  className="text-blue-600 hover:text-blue-800"
                >
                  acceda al portal en inglés
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-gray-400">
        ¿Necesita ayuda? Contacte a soporte editorial
      </footer>
    </motion.div>
  );
}

export default SubmitSection;