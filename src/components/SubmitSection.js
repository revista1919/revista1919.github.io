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
          Agradecemos su interés en publicar con nosotros. Por favor, siga el proceso formal a continuación.
        </p>
      </header>

      {/* Sección de Preparación (Checklist/Directrices) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="md:col-span-2 bg-gray-50 p-8 rounded-sm border-l-4 border-gray-900">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-900 mb-4">
            Antes de iniciar el envío
          </h3>
          <ul className="space-y-3 text-sm text-gray-700">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                Es estrictamente obligatorio que el documento esté anonimizado. 
                <strong className="text-red-700 font-semibold"> No incluya su nombre, filiación o agradecimientos </strong> 
                dentro del archivo cargado para garantizar la revisión ciega por pares.
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>El formato del archivo debe ajustarse a las normas de estilo de la revista.</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col justify-center bg-blue-50 p-8 rounded-sm border border-blue-100">
          <h4 className="text-xs font-bold text-blue-900 uppercase tracking-tighter mb-2">Requisito Fundamental</h4>
          <p className="text-xs text-blue-800 mb-4 leading-relaxed">
            ¿Ha verificado que su manuscrito cumple con todas las normas de citación y formato?
          </p>
          <button
            onClick={() => navigate('/guidelines')}
            className="text-xs font-bold uppercase tracking-widest text-blue-700 hover:text-blue-900 transition-colors flex items-center"
          >
            Consultar Directrices →
          </button>
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
              Para realizar el envío de su manuscrito, debe iniciar sesión o crear una cuenta en nuestro sistema editorial. Una vez dentro, diríjase a la pestaña "Enviar manuscrito" para completar el proceso.
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