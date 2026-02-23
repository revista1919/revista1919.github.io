// src/components/ReviewerWorkspace.js (VERSIÓN CORREGIDA)
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useLanguage } from '../hooks/useLanguage';
import { useReviewerAssignment } from '../hooks/useReviewerAssignment';
import { db } from '../firebase';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';

const REVIEW_CRITERIA = {
  relevance: {
    label: { es: 'Relevancia del tema', en: 'Topic Relevance' },
    description: {
      es: '¿El tema es relevante para el área y la revista?',
      en: 'Is the topic relevant to the field and journal?'
    },
    levels: [
      { value: 0, label: { es: 'Bajo', en: 'Low' }, desc: { es: 'Tema poco relevante o fuera de alcance', en: 'Topic has low relevance or is out of scope' } },
      { value: 1, label: { es: 'Medio', en: 'Medium' }, desc: { es: 'Tema relevante pero con limitaciones', en: 'Topic is relevant but has limitations' } },
      { value: 2, label: { es: 'Alto', en: 'High' }, desc: { es: 'Tema muy relevante y de interés', en: 'Topic is highly relevant and of interest' } }
    ]
  },
  methodology: {
    label: { es: 'Metodología / Rigor', en: 'Methodology / Rigor' },
    description: {
      es: '¿La metodología es sólida y apropiada?',
      en: 'Is the methodology sound and appropriate?'
    },
    levels: [
      { value: 0, label: { es: 'Débil', en: 'Weak' }, desc: { es: 'Metodología inapropiada o mal aplicada', en: 'Methodology is inappropriate or poorly applied' } },
      { value: 1, label: { es: 'Aceptable', en: 'Acceptable' }, desc: { es: 'Metodología adecuada pero con debilidades', en: 'Methodology is adequate but has weaknesses' } },
      { value: 2, label: { es: 'Sólida', en: 'Sound' }, desc: { es: 'Metodología rigurosa y bien aplicada', en: 'Methodology is rigorous and well-applied' } }
    ]
  },
  clarity: {
    label: { es: 'Claridad y organización', en: 'Clarity and Organization' },
    description: {
      es: '¿El texto es claro, coherente y bien estructurado?',
      en: 'Is the text clear, coherent, and well-structured?'
    },
    levels: [
      { value: 0, label: { es: 'Confuso', en: 'Confusing' }, desc: { es: 'Difícil de seguir, desorganizado', en: 'Difficult to follow, disorganized' } },
      { value: 1, label: { es: 'Aceptable', en: 'Acceptable' }, desc: { es: 'Comprensible pero mejorable', en: 'Understandable but could be improved' } },
      { value: 2, label: { es: 'Excelente', en: 'Excellent' }, desc: { es: 'Claro, bien estructurado', en: 'Clear, well-structured' } }
    ]
  },
  originality: {
    label: { es: 'Originalidad / Aporte', en: 'Originality / Contribution' },
    description: {
      es: '¿El artículo aporta ideas originales o novedosas?',
      en: 'Does the article contribute original or novel ideas?'
    },
    levels: [
      { value: 0, label: { es: 'Bajo', en: 'Low' }, desc: { es: 'Poco original, repetitivo', en: 'Not original, repetitive' } },
      { value: 1, label: { es: 'Moderado', en: 'Moderate' }, desc: { es: 'Alguna originalidad, aporte limitado', en: 'Some originality, limited contribution' } },
      { value: 2, label: { es: 'Alto', en: 'High' }, desc: { es: 'Altamente original, aporte significativo', en: 'Highly original, significant contribution' } }
    ]
  }
};

const RECOMMENDATION_OPTIONS = [
  { 
    value: 'accept', 
    label: { es: 'Aceptar', en: 'Accept' }, 
    color: 'green',
    description: { es: 'El artículo es publicable en su forma actual', en: 'The article is publishable in its current form' },
    nextStep: { es: 'El editor tomará la decisión final', en: 'The editor will make the final decision' }
  },
  { 
    value: 'minor-revisions', 
    label: { es: 'Revisiones menores', en: 'Minor revisions' }, 
    color: 'blue',
    description: { es: 'Requiere cambios menores antes de publicación', en: 'Requires minor changes before publication' },
    nextStep: { es: 'El editor considerará tu recomendación', en: 'The editor will consider your recommendation' }
  },
  { 
    value: 'major-revisions', 
    label: { es: 'Revisiones mayores', en: 'Major revisions' }, 
    color: 'yellow',
    description: { es: 'Requiere cambios sustanciales y nueva revisión', en: 'Requires substantial changes and re-review' },
    nextStep: { es: 'El autor deberá realizar cambios significativos', en: 'The author will need to make significant changes' }
  },
  { 
    value: 'reject', 
    label: { es: 'Rechazar', en: 'Reject' }, 
    color: 'red',
    description: { es: 'No apto para publicación', en: 'Not suitable for publication' },
    nextStep: { es: 'El editor revisará tu recomendación', en: 'The editor will review your recommendation' }
  }
];

export const ReviewerWorkspace = ({ assignmentId, onClose, readOnly = false }) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isSpanish = language === 'es';
  
  const [assignment, setAssignment] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [deadline, setDeadline] = useState(null);
  const [scores, setScores] = useState({});
  const [commentsToAuthor, setCommentsToAuthor] = useState('');
  const [commentsToEditor, setCommentsToEditor] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('evaluation');
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  const [validationErrors, setValidationErrors] = useState({});

  const { getReviewerAssignmentById, submitReview, autoSaveReview } = useReviewerAssignment(user);

  // Cargar datos y suscribirse a cambios en tiempo real
  useEffect(() => {
    if (!assignmentId) return;

    const loadData = async () => {
      const result = await getReviewerAssignmentById(assignmentId);
      if (result.success) {
        setAssignment(result.assignment);
        
        // Cargar datos guardados
        setScores(result.assignment.scores || {});
        setCommentsToAuthor(result.assignment.commentsToAuthor || '');
        setCommentsToEditor(result.assignment.commentsToEditor || '');
        setRecommendation(result.assignment.recommendation || '');

        // Cargar submission
        const submissionDoc = await getDoc(doc(db, 'submissions', result.assignment.submissionId));
        if (submissionDoc.exists()) {
          setSubmission({ id: submissionDoc.id, ...submissionDoc.data() });
        }

        // Cargar deadline - CORREGIDO: usar query en lugar de db.collection
        const deadlinesQuery = query(
          collection(db, 'deadlines'),
          where('targetId', '==', assignmentId),
          where('type', '==', 'review-submission')
        );
        const deadlinesSnapshot = await getDocs(deadlinesQuery);
        
        if (!deadlinesSnapshot.empty) {
          setDeadline(deadlinesSnapshot.docs[0].data());
        }
      }
    };

    loadData();

    // Suscribirse a cambios en la asignación
    const unsubscribe = onSnapshot(doc(db, 'reviewerAssignments', assignmentId), (doc) => {
      if (doc.exists()) {
        setAssignment(prev => ({ ...prev, ...doc.data() }));
      }
    });

    return () => unsubscribe();
  }, [assignmentId, getReviewerAssignmentById]);

  // Auto-save cada 30 segundos
  useEffect(() => {
    if (!assignment || assignment.status === 'submitted' || readOnly) return;

    const timer = setInterval(async () => {
      if (Object.keys(scores).length > 0 || commentsToAuthor || commentsToEditor || recommendation) {
        setAutoSaveStatus('saving');
        const result = await autoSaveReview(assignmentId, {
          scores,
          commentsToAuthor,
          commentsToEditor,
          recommendation
        });
        setAutoSaveStatus(result.success ? 'saved' : 'error');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [assignment, assignmentId, scores, commentsToAuthor, commentsToEditor, recommendation, autoSaveReview, readOnly]);

  // Validación antes de enviar
  const validateSubmission = () => {
    const errors = {};
    
    Object.keys(REVIEW_CRITERIA).forEach(key => {
      if (scores[key] === undefined || scores[key] === null) {
        errors[key] = isSpanish ? 'Requerido' : 'Required';
      }
    });
    
    if (!commentsToAuthor || commentsToAuthor.replace(/<[^>]*>/g, '').trim() === '') {
      errors.commentsToAuthor = isSpanish ? 'Los comentarios para el autor son requeridos' : 'Comments for author are required';
    }
    
    if (!commentsToEditor || commentsToEditor.replace(/<[^>]*>/g, '').trim() === '') {
      errors.commentsToEditor = isSpanish ? 'Los comentarios confidenciales son requeridos' : 'Confidential comments are required';
    }
    
    if (!recommendation) {
      errors.recommendation = isSpanish ? 'Debes seleccionar una recomendación' : 'You must select a recommendation';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleScoreChange = (criterion, value) => {
    setScores(prev => ({ ...prev, [criterion]: value }));
    if (validationErrors[criterion]) {
      setValidationErrors(prev => ({ ...prev, [criterion]: null }));
    }
  };

  const handleSubmit = async () => {
    if (!validateSubmission()) {
      alert(isSpanish ? 'Por favor completa todos los campos requeridos' : 'Please complete all required fields');
      return;
    }

    setIsSubmitting(true);
    const result = await submitReview(assignmentId, {
      scores,
      commentsToAuthor,
      commentsToEditor,
      recommendation
    });
    
    if (result.success) {
      alert(isSpanish ? 'Revisión enviada con éxito' : 'Review submitted successfully');
      if (onClose) onClose();
    } else {
      alert(isSpanish ? 'Error al enviar la revisión: ' + result.error : 'Error submitting review: ' + result.error);
    }
    setIsSubmitting(false);
  };

  const modules = useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ]
  }), []);

  const formats = ['bold', 'italic', 'underline', 'strike', 'list', 'bullet', 'link'];

  const getProgress = () => {
    const criteriaProgress = Object.keys(REVIEW_CRITERIA).filter(k => scores[k] !== undefined).length;
    const totalCriteria = Object.keys(REVIEW_CRITERIA).length;
    
    let progress = (criteriaProgress / totalCriteria) * 40;
    if (commentsToAuthor && commentsToAuthor.replace(/<[^>]*>/g, '').trim() !== '') progress += 20;
    if (commentsToEditor && commentsToEditor.replace(/<[^>]*>/g, '').trim() !== '') progress += 20;
    if (recommendation) progress += 20;
    
    return Math.min(progress, 100);
  };

  const getDaysRemaining = () => {
    if (!deadline?.dueDate) return null;
    const now = new Date();
    const due = deadline.dueDate.toDate();
    const diffTime = due - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (!assignment || !submission) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{isSpanish ? 'Cargando...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  const isSubmitted = assignment.status === 'submitted';
  const isEditable = !isSubmitted && !readOnly;
  const daysRemaining = getDaysRemaining();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-white z-50 flex flex-col"
    >
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 line-clamp-1">{submission.title}</h1>
            <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
              <span>{isSpanish ? `Ronda ${assignment.round}` : `Round ${assignment.round}`}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {daysRemaining !== null && (
                  daysRemaining > 0 
                    ? (isSpanish ? `${daysRemaining} días restantes` : `${daysRemaining} days left`)
                    : (isSpanish ? 'Vencido' : 'Overdue')
                )}
              </span>
              {readOnly && (
                <span className="ml-4 px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                  {isSpanish ? 'Solo lectura' : 'Read-only'}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {autoSaveStatus === 'saving' && (
            <span className="text-sm text-gray-400 flex items-center gap-1">
              <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              {isSpanish ? 'Guardando...' : 'Saving...'}
            </span>
          )}
          {autoSaveStatus === 'saved' && (
            <span className="text-sm text-green-600">✓ {isSpanish ? 'Guardado' : 'Saved'}</span>
          )}
          {isSubmitted ? (
            <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium">
              {isSpanish ? 'Revisión Enviada' : 'Review Submitted'}
            </span>
          ) : isEditable && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {isSpanish ? 'Enviando...' : 'Submitting...'}
                </>
              ) : (
                isSpanish ? 'Enviar Revisión' : 'Submit Review'
              )}
            </button>
          )}
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-gray-50 px-6 py-2 border-b border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>{isSpanish ? 'Progreso' : 'Progress'}</span>
          <span>{Math.round(getProgress())}%</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${getProgress()}%` }}
            className="h-full bg-emerald-600"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Article Info */}
        <div className="w-2/5 border-r border-gray-200 bg-gray-50 overflow-y-auto p-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              {isSpanish ? 'Información del Artículo' : 'Article Information'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">{isSpanish ? 'Título' : 'Title'}</h3>
                <p className="text-gray-900">{submission.title}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">{isSpanish ? 'Autores' : 'Authors'}</h3>
                <p className="text-gray-900">
                  {submission.authors?.map(a => `${a.firstName} ${a.lastName}`).join(', ')}
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">{isSpanish ? 'Área' : 'Area'}</h3>
                <p className="text-gray-900">{submission.area}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">{isSpanish ? 'Tipo de Artículo' : 'Article Type'}</h3>
                <p className="text-gray-900">{submission.articleType || 'No especificado'}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">{isSpanish ? 'Resumen' : 'Abstract'}</h3>
                <p className="text-gray-700 text-sm leading-relaxed">{submission.abstract}</p>
              </div>
              
              {submission.keywords?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">{isSpanish ? 'Palabras Clave' : 'Keywords'}</h3>
                  <div className="flex flex-wrap gap-2">
                    {submission.keywords.map((kw, i) => (
                      <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="pt-4">
                <a
                  href={submission.driveFolderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors w-full justify-center"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {isSpanish ? 'Ver documento completo en Drive' : 'View full document in Drive'}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Evaluation */}
        <div className="w-3/5 bg-white overflow-y-auto p-6">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            {[
              { id: 'evaluation', label: isSpanish ? 'Evaluación' : 'Evaluation' },
              { id: 'comments', label: isSpanish ? 'Comentarios para autor' : 'Comments for author' },
              { id: 'confidential', label: isSpanish ? 'Confidencial' : 'Confidential' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 font-medium text-sm transition-colors relative ${
                  activeTab === tab.id 
                    ? 'text-emerald-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* Evaluation Tab */}
            {activeTab === 'evaluation' && (
              <motion.div
                key="evaluation"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  {isSpanish ? 'Criterios de evaluación' : 'Evaluation criteria'}
                </h3>
                
                {Object.entries(REVIEW_CRITERIA).map(([key, criterion]) => (
                  <div key={key} className={`border rounded-lg p-4 ${
                    validationErrors[key] ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}>
                    <div className="mb-3">
                      <h4 className="font-semibold text-gray-900">{criterion.label[language]}</h4>
                      <p className="text-sm text-gray-500">{criterion.description[language]}</p>
                      {validationErrors[key] && (
                        <p className="text-xs text-red-600 mt-1">{validationErrors[key]}</p>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      {criterion.levels.map((level) => (
                        <button
                          key={level.value}
                          onClick={() => isEditable && handleScoreChange(key, level.value)}
                          disabled={!isEditable}
                          className={`p-3 text-left rounded-lg border transition-all ${
                            scores[key] === level.value
                              ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600'
                              : 'border-gray-200 hover:border-emerald-300 bg-white'
                          } ${!isEditable ? 'cursor-default opacity-75' : 'cursor-pointer'}`}
                        >
                          <div className="text-xs font-semibold text-gray-500 mb-1">
                            {level.label[language].toUpperCase()}
                          </div>
                          <div className="text-sm text-gray-700">
                            {level.desc[language]}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Recommendation */}
                <div className={`border rounded-lg p-4 ${
                  validationErrors.recommendation ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}>
                  <h4 className="font-semibold text-gray-900 mb-3">
                    {isSpanish ? 'Recomendación final' : 'Final recommendation'}
                    {validationErrors.recommendation && (
                      <span className="text-xs text-red-600 ml-2">{validationErrors.recommendation}</span>
                    )}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {RECOMMENDATION_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => isEditable && setRecommendation(option.value)}
                        disabled={!isEditable}
                        className={`p-4 text-left rounded-lg border transition-all ${
                          recommendation === option.value
                            ? `border-${option.color}-600 bg-${option.color}-50 ring-1 ring-${option.color}-600`
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        } ${!isEditable ? 'cursor-default opacity-75' : 'cursor-pointer'}`}
                      >
                        <div className={`text-sm font-bold text-${option.color}-600 mb-1`}>
                          {option.label[language].toUpperCase()}
                        </div>
                        <div className="text-xs text-gray-600">
                          {option.description[language]}
                        </div>
                        <div className="text-xs text-gray-400 mt-2 italic">
                          {option.nextStep[language]}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Comments for Author Tab */}
            {activeTab === 'comments' && (
              <motion.div
                key="comments"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  {isSpanish ? 'Comentarios para el autor' : 'Comments for the author'}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {isSpanish 
                    ? 'Estos comentarios serán visibles para el autor. Sea constructivo y específico. Utilice un tono respetuoso y académico.'
                    : 'These comments will be visible to the author. Be constructive and specific. Use a respectful and academic tone.'}
                </p>
                {validationErrors.commentsToAuthor && (
                  <p className="text-xs text-red-600 mb-2">{validationErrors.commentsToAuthor}</p>
                )}
                <div className={`border rounded-lg ${validationErrors.commentsToAuthor ? 'border-red-300' : 'border-gray-200'}`}>
                  <ReactQuill
                    theme="snow"
                    value={commentsToAuthor}
                    onChange={setCommentsToAuthor}
                    modules={modules}
                    formats={formats}
                    readOnly={!isEditable}
                    className="bg-white rounded-lg"
                    placeholder={isSpanish ? 'Escriba sus comentarios para el autor...' : 'Write your comments for the author...'}
                  />
                </div>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-700">
                    <strong>{isSpanish ? 'Consejo:' : 'Tip:'}</strong>{' '}
                    {isSpanish 
                      ? 'Estructura tus comentarios: señala fortalezas, luego áreas de mejora, y termina con un resumen constructivo.'
                      : 'Structure your comments: point out strengths, then areas for improvement, and end with a constructive summary.'}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Confidential Comments Tab */}
            {activeTab === 'confidential' && (
              <motion.div
                key="confidential"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  {isSpanish ? 'Comentarios confidenciales para el editor' : 'Confidential comments for the editor'}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {isSpanish 
                    ? 'Estos comentarios solo serán visibles para el editor. Úselos para explicar su decisión, señalar problemas éticos, o hacer recomendaciones específicas.'
                    : 'These comments are only visible to the editor. Use them to explain your decision, point out ethical issues, or make specific recommendations.'}
                </p>
                {validationErrors.commentsToEditor && (
                  <p className="text-xs text-red-600 mb-2">{validationErrors.commentsToEditor}</p>
                )}
                <div className={`border rounded-lg ${validationErrors.commentsToEditor ? 'border-red-300' : 'border-gray-200'}`}>
                  <ReactQuill
                    theme="snow"
                    value={commentsToEditor}
                    onChange={setCommentsToEditor}
                    modules={modules}
                    formats={formats}
                    readOnly={!isEditable}
                    className="bg-white rounded-lg"
                    placeholder={isSpanish ? 'Escriba sus comentarios confidenciales...' : 'Write your confidential comments...'}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};