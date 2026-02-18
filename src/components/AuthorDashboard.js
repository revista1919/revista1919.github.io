import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import { getUserSubmissions } from '../firebase';

// Componente de estado con colores
const StatusBadge = ({ status, round }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  
  const statusConfig = {
    submitted: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      label: isSpanish ? 'Enviado' : 'Submitted',
      icon: '📤'
    },
    desk_review: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      label: isSpanish ? 'Revisión Editorial' : 'Desk Review',
      icon: '👁️'
    },
    desk_rejected: {
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200',
      label: isSpanish ? 'Rechazado' : 'Rejected',
      icon: '❌'
    },
    desk_accepted: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      label: isSpanish ? 'Aceptado para revisión' : 'Accepted for review',
      icon: '✅'
    },
    in_review: {
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      border: 'border-purple-200',
      label: isSpanish ? 'En revisión' : 'In Review',
      icon: '🔍'
    },
    reviews_completed: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      border: 'border-indigo-200',
      label: isSpanish ? 'Revisiones completadas' : 'Reviews completed',
      icon: '📋'
    },
    minor_revision: {
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      border: 'border-orange-200',
      label: isSpanish ? 'Cambios menores' : 'Minor revision',
      icon: '✏️'
    },
    major_revision: {
      bg: 'bg-orange-100',
      text: 'text-orange-800',
      border: 'border-orange-300',
      label: isSpanish ? 'Cambios mayores' : 'Major revision',
      icon: '📝'
    },
    accepted: {
      bg: 'bg-emerald-100',
      text: 'text-emerald-800',
      border: 'border-emerald-300',
      label: isSpanish ? 'Aceptado' : 'Accepted',
      icon: '🎉'
    },
    published: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-300',
      label: isSpanish ? 'Publicado' : 'Published',
      icon: '📰'
    },
    rejected: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-300',
      label: isSpanish ? 'Rechazado' : 'Rejected',
      icon: '🚫'
    }
  };

  const config = statusConfig[status] || statusConfig.submitted;
  
  let statusText = config.label;
  if (round && round > 1 && ['minor_revision', 'major_revision', 'in_review'].includes(status)) {
    statusText += ` (Ronda ${round})`;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
      <span>{config.icon}</span>
      {statusText}
    </span>
  );
};

// Tarjeta de envío individual
const SubmissionCard = ({ submission, onClick }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.01 }}
      onClick={() => onClick(submission)}
      className="group bg-white border border-gray-100 rounded-3xl p-6 hover:border-emerald-400 transition-all cursor-pointer shadow-sm hover:shadow-md"
    >
      <div className="flex justify-between items-start mb-4">
        <StatusBadge status={submission.status} round={submission.currentRound} />
        <span className="text-xs text-gray-400 font-mono">
          {submission.submissionId?.slice(-8)}
        </span>
      </div>

      <h3 className="font-serif text-xl font-bold text-gray-900 group-hover:text-emerald-800 transition-colors mb-3 line-clamp-2">
        {submission.title}
      </h3>

      <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
        <span className="px-2 py-1 bg-gray-50 rounded-lg text-xs">
          {submission.area}
        </span>
        <span className="text-gray-300">•</span>
        <span className="text-xs">
          {submission.paperLanguage === 'es' ? 'Español' : 'English'}
        </span>
      </div>

      <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center text-xs">
        <span className="text-gray-500">
          {isSpanish ? 'Enviado:' : 'Submitted:'} {formatDate(submission.createdAt)}
        </span>
        <span className="text-emerald-600 font-medium">
          {isSpanish ? 'Ver detalles →' : 'View details →'}
        </span>
      </div>
    </motion.div>
  );
};

// Modal de detalles del envío
const SubmissionDetailModal = ({ submission, onClose }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  if (!submission) return null;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusMessage = (status) => {
    const messages = {
      submitted: isSpanish 
        ? 'Tu artículo ha sido recibido y está pendiente de revisión editorial.'
        : 'Your article has been received and is pending editorial review.',
      desk_review: isSpanish
        ? 'El equipo editorial está revisando tu artículo.'
        : 'The editorial team is reviewing your article.',
      desk_rejected: isSpanish
        ? 'El artículo no ha pasado la revisión editorial inicial.'
        : 'The article did not pass the initial editorial review.',
      desk_accepted: isSpanish
        ? 'El artículo ha sido aceptado para revisión por pares.'
        : 'The article has been accepted for peer review.',
      in_review: isSpanish
        ? `Tu artículo está siendo evaluado por revisores externos (Ronda ${submission.currentRound}).`
        : `Your article is being evaluated by external reviewers (Round ${submission.currentRound}).`,
      reviews_completed: isSpanish
        ? 'Las revisiones están completadas, pendiente de decisión editorial.'
        : 'Reviews are completed, pending editorial decision.',
      minor_revision: isSpanish
        ? `Se requieren cambios menores. Por favor, revisa los comentarios.`
        : `Minor revisions required. Please check the comments.`,
      major_revision: isSpanish
        ? `Se requieren cambios mayores. Por favor, revisa los comentarios.`
        : `Major revisions required. Please check the comments.`,
      accepted: isSpanish
        ? '¡Felicidades! Tu artículo ha sido aceptado para publicación.'
        : 'Congratulations! Your article has been accepted for publication.',
      rejected: isSpanish
        ? 'El artículo no ha sido aceptado para publicación.'
        : 'The article has not been accepted for publication.',
      published: isSpanish
        ? 'Tu artículo ha sido publicado. ¡Gracias por contribuir!'
        : 'Your article has been published. Thank you for contributing!'
    };
    return messages[status] || messages.submitted;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex justify-between items-center">
          <div>
            <StatusBadge status={submission.status} round={submission.currentRound} />
            <h2 className="font-serif text-2xl font-bold text-gray-900 mt-3">
              {submission.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Status Message */}
          <div className="bg-gray-50 rounded-2xl p-6">
            <p className="text-gray-700 leading-relaxed">
              {getStatusMessage(submission.status)}
            </p>
          </div>

          {/* Timeline */}
          <div>
            <h3 className="font-serif text-lg font-bold text-gray-900 mb-4">
              {isSpanish ? 'Línea de tiempo' : 'Timeline'}
            </h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 bg-emerald-600 rounded-full" />
                  <div className="w-0.5 h-12 bg-gray-200 mt-2" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {isSpanish ? 'Envío inicial' : 'Initial submission'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatDate(submission.createdAt)}
                  </p>
                </div>
              </div>
              
              {submission.deskReviewAt && (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 bg-blue-600 rounded-full" />
                    {submission.status !== 'desk_review' && <div className="w-0.5 h-12 bg-gray-200 mt-2" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {isSpanish ? 'Revisión editorial' : 'Editorial review'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDate(submission.deskReviewAt)}
                    </p>
                  </div>
                </div>
              )}

              {/* Mostrar más eventos según estado */}
            </div>
          </div>

          {/* Documentos */}
          <div>
            <h3 className="font-serif text-lg font-bold text-gray-900 mb-4">
              {isSpanish ? 'Documentos' : 'Documents'}
            </h3>
            <div className="space-y-3">
              <a
                href={submission.originalFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors"
              >
                <span className="text-2xl">📄</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {isSpanish ? 'Manuscrito original' : 'Original manuscript'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {submission.originalFileName}
                  </p>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>

              {submission.consentFiles?.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    {isSpanish ? 'Consentimientos:' : 'Consent files:'}
                  </p>
                  {submission.consentFiles.map((file, idx) => (
                    <a
                      key={idx}
                      href={file.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors mb-2"
                    >
                      <span className="text-xl">📋</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-900">
                          {file.author}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Acciones según estado */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            {submission.status === 'minor_revision' && (
              <button className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all">
                {isSpanish ? 'Subir revisión' : 'Upload revision'}
              </button>
            )}
            {submission.status === 'major_revision' && (
              <button className="flex-1 py-4 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all">
                {isSpanish ? 'Subir revisión' : 'Upload revision'}
              </button>
            )}
            <a
              href={submission.driveFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all text-center"
            >
              {isSpanish ? 'Carpeta Drive' : 'Drive folder'}
            </a>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Componente principal
export default function AuthorDashboard({ user }) {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    inReview: 0,
    accepted: 0,
    published: 0
  });

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await getUserSubmissions({ limit: 50 });
      
      if (result.success) {
        setSubmissions(result.submissions);
        
        // Calcular estadísticas
        const newStats = {
          total: result.submissions.length,
          inReview: result.submissions.filter(s => 
            ['submitted', 'desk_review', 'in_review', 'minor_revision', 'major_revision'].includes(s.status)
          ).length,
          accepted: result.submissions.filter(s => 
            ['accepted', 'published'].includes(s.status)
          ).length,
          published: result.submissions.filter(s => s.status === 'published').length
        };
        setStats(newStats);
      }
    } catch (err) {
      console.error('Error loading submissions:', err);
      setError(isSpanish 
        ? 'Error al cargar tus envíos. Intenta nuevamente.'
        : 'Error loading your submissions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
        <p className="mt-6 text-gray-500 font-medium">
          {isSpanish ? 'Cargando tus envíos...' : 'Loading your submissions...'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400 mb-2">
            {isSpanish ? 'TOTAL ENVÍOS' : 'TOTAL SUBMISSIONS'}
          </p>
          <p className="text-3xl font-serif font-bold text-gray-900">{stats.total}</p>
        </div>
        
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400 mb-2">
            {isSpanish ? 'EN REVISIÓN' : 'IN REVIEW'}
          </p>
          <p className="text-3xl font-serif font-bold text-amber-600">{stats.inReview}</p>
        </div>
        
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400 mb-2">
            {isSpanish ? 'ACEPTADOS' : 'ACCEPTED'}
          </p>
          <p className="text-3xl font-serif font-bold text-emerald-600">{stats.accepted}</p>
        </div>
        
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400 mb-2">
            {isSpanish ? 'PUBLICADOS' : 'PUBLISHED'}
          </p>
          <p className="text-3xl font-serif font-bold text-blue-600">{stats.published}</p>
        </div>
      </div>

      {/* Lista de envíos */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-8 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadSubmissions}
            className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
          >
            {isSpanish ? 'Reintentar' : 'Retry'}
          </button>
        </div>
      ) : submissions.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">📝</span>
          </div>
          <h3 className="font-serif text-2xl font-bold text-gray-900 mb-2">
            {isSpanish ? 'No tienes envíos aún' : 'No submissions yet'}
          </h3>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            {isSpanish 
              ? 'Comienza enviando tu primer artículo a través del formulario de envío.'
              : 'Start by submitting your first article through the submission form.'}
          </p>
          <button
            onClick={() => window.location.hash = '#submit'}
            className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
          >
            {isSpanish ? 'Enviar artículo' : 'Submit article'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {submissions.map((submission) => (
            <SubmissionCard
              key={submission.id}
              submission={submission}
              onClick={setSelectedSubmission}
            />
          ))}
        </div>
      )}

      {/* Modal de detalles */}
      <AnimatePresence>
        {selectedSubmission && (
          <SubmissionDetailModal
            submission={selectedSubmission}
            onClose={() => setSelectedSubmission(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}