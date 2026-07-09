import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { getFunctions, httpsCallable } from 'firebase/functions';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { 
  XMarkIcon, 
  CheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const decisionOptions = [
  { value: 'accept', label: 'Aceptar', color: 'green', description: 'El artículo es aceptado para publicación sin cambios o con cambios menores ya realizados.' },
  { value: 'minor', label: 'Revisiones Menores', color: 'yellow', description: 'Se requieren cambios menores; el autor debe corregir y enviar una nueva versión.' },
  { value: 'major', label: 'Revisiones Mayores', color: 'orange', description: 'Se requieren cambios sustanciales; se abrirá una nueva ronda de revisión.' },
  { value: 'reject', label: 'Rechazar', color: 'red', description: 'El artículo no es aceptable para publicación.' }
];

export default function DecisionPanel({ submission, round, onClose, onDecisionMade }) {
  const [decision, setDecision] = useState('');
  const [commentsToAuthor, setCommentsToAuthor] = useState('');
  const [commentsToEditor, setCommentsToEditor] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!decision) {
      setError('Debe seleccionar una decisión');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const functions = getFunctions();
      const editorDecision = httpsCallable(functions, 'editorDecision');
      
      const result = await editorDecision({
        submissionId: submission.id,
        round,
        decision,
        commentsToAuthor,
        commentsToEditor
      });

      if (result.data.success) {
        onDecisionMade(result.data);
      } else {
        setError('Error al registrar la decisión');
      }
    } catch (err) {
      console.error('Error in decision:', err);
      setError(err.message || 'Error al registrar la decisión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedOption = decisionOptions.find(opt => opt.value === decision);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="font-serif text-2xl font-bold text-gray-900">
                Decisión Editorial
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {submission.title} • Ronda {round}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <XMarkIcon className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Opciones de decisión */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
                Decisión *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {decisionOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDecision(opt.value)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                      decision === opt.value
                        ? `border-${opt.color}-600 bg-${opt.color}-50`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-bold text-${opt.color}-600`}>
                        {opt.label}
                      </span>
                      {decision === opt.value && (
                        <CheckIcon className={`w-5 h-5 text-${opt.color}-600`} />
                      )}
                    </div>
                    <p className="text-xs text-gray-600">
                      {opt.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Comentarios para el autor */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                Comentarios para el autor
              </label>
              <ReactQuill
                theme="snow"
                value={commentsToAuthor}
                onChange={setCommentsToAuthor}
                className="bg-white rounded-lg border border-gray-200"
                placeholder="Escriba aquí los comentarios que verá el autor..."
                modules={{
                  toolbar: [
                    ['bold', 'italic', 'underline'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    ['link']
                  ]
                }}
              />
            </div>

            {/* Comentarios confidenciales para el equipo editorial */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                Comentarios confidenciales (solo para editores)
              </label>
              <ReactQuill
                theme="snow"
                value={commentsToEditor}
                onChange={setCommentsToEditor}
                className="bg-white rounded-lg border border-gray-200"
                placeholder="Opcional: comentarios solo para el equipo editorial..."
                modules={{
                  toolbar: [
                    ['bold', 'italic', 'underline'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    ['link']
                  ]
                }}
              />
            </div>

            {selectedOption && (
              <div className={`p-4 rounded-2xl bg-${selectedOption.color}-50 border border-${selectedOption.color}-200`}>
                <p className={`text-sm text-${selectedOption.color}-800`}>
                  <strong>Confirmación:</strong> {selectedOption.label}. 
                  {decision === 'major' && ' Se abrirá una nueva ronda de revisión.'}
                  {decision === 'accept' && ' El artículo pasará a estado "aceptado" y estará listo para publicación.'}
                  {decision === 'reject' && ' El artículo será rechazado y el autor será notificado.'}
                </p>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-start gap-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
{/* ===== DOCUMENTO FINAL CON REVISIONES ===== */}
{submission.finalReviewDocUrl && (
  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
    <h3 className="font-['Playfair_Display'] font-bold text-emerald-800 mb-3 flex items-center gap-2">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Documento Final con Revisiones
    </h3>
    <p className="text-sm text-emerald-700 mb-4 font-['Lora']">
      Revisa el documento consolidado con todos los comentarios de los revisores antes de tomar tu decisión.
    </p>
    <div className="flex flex-wrap gap-3">
      {/* Ver en Google Docs */}
      <a
        href={submission.finalReviewDocUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        Ver en Google Docs
      </a>
      
      {/* Descargar como DOCX */}
      <button
        onClick={async () => {
          try {
            const match = submission.finalReviewDocUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
              const downloadUrl = `https://docs.google.com/document/d/${match[1]}/export?format=docx`;
              const fileName = `Revisiones_${submission.submissionId || 'final'}.docx`;
              
              const link = document.createElement('a');
              link.href = downloadUrl;
              link.download = fileName;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          } catch (error) {
            console.error('❌ Error descargando:', error);
          }
        }}
        className="flex items-center gap-2 bg-[#002147] hover:bg-[#001A38] text-white px-5 py-3 rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Descargar DOCX
      </button>
    </div>
  </div>
)}
            {/* Botones */}
            <div className="flex justify-end gap-4 pt-4 border-t border-gray-100">
              <button
                onClick={onClose}
                className="px-6 py-3 border border-gray-200 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-gray-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !decision}
                className="px-8 py-3 bg-gray-900 text-white rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    PROCESANDO...
                  </>
                ) : (
                  'REGISTRAR DECISIÓN'
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}