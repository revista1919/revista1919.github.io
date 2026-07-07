// src/components/DeskReviewTab.js
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { useEditorialReview } from '../hooks/useEditorialReview';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// Componente auxiliar para etiquetas de estado
const StatusBadge = ({ condition, trueLabel, trueColor, falseLabel, falseColor }) => {
  const isTrue = condition;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
      isTrue ? trueColor : falseColor
    }`}>
      {isTrue ? '✓' : '—'} {isTrue ? trueLabel : falseLabel}
    </span>
  );
};

// Componente para cada bloque de información
const InfoBlock = ({ icon, title, children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-[#E5E9F0] overflow-hidden ${className}`}>
    <div className="bg-[#F5F7FA] px-5 py-3 border-b border-[#E5E9F0] flex items-center gap-2">
      {icon && <span className="text-[#C0A86A]">{icon}</span>}
      <h3 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-sm uppercase tracking-wide">
        {title}
      </h3>
    </div>
    <div className="p-5">
      {children}
    </div>
  </div>
);

// Campo individual dentro de un InfoBlock
const InfoField = ({ label, value, className = '' }) => (
  <div className={`${className}`}>
    <label className="block text-[10px] font-mono font-semibold uppercase tracking-[0.1em] text-[#5A6B7A] mb-1">
      {label}
    </label>
    <div className="text-[#0A1929] text-sm font-['Lora'] leading-relaxed">
      {value || '—'}
    </div>
  </div>
);

export const DeskReviewTab = ({ task, user, onComplete, loading: externalLoading }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  
  // Estados para el formulario
  const [decision, setDecision] = useState('');
  const [feedback, setFeedback] = useState('');
  const [internalComments, setInternalComments] = useState('');
  
  // Estados para datos adicionales
  const [editorialReview, setEditorialReview] = useState(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [latestRevisionUrl, setLatestRevisionUrl] = useState(null);
  
  // Usar el hook para manejar la revisión editorial
  const { loading: hookLoading, error, submitDeskReviewDecision } = useEditorialReview(user);
  
  const submission = task.submission || {};
  
  // Combinar el loading externo con el del hook
  const isLoading = externalLoading || hookLoading || loadingReview;

  // Cargar la revisión editorial
  useEffect(() => {
    const loadEditorialReview = async () => {
      if (!task.editorialReviewId) return;
      setLoadingReview(true);
      try {
        const reviewSnap = await getDoc(doc(db, 'editorialReviews', task.editorialReviewId));
        if (reviewSnap.exists()) {
          const data = reviewSnap.data();
          setEditorialReview(data);
          setDecision(data.decision || '');
          setFeedback(data.feedbackToAuthor || '');
          setInternalComments(data.commentsToEditorial || '');
        }
      } catch (error) {
        console.error('Error loading editorial review:', error);
      } finally {
        setLoadingReview(false);
      }
    };
    loadEditorialReview();
  }, [task.editorialReviewId]);

  // Cargar la última revisión del submission
  useEffect(() => {
    const fetchLatestRevision = async () => {
      if (!task.submissionId) return;
      try {
        const versionsRef = collection(db, 'submissions', task.submissionId, 'versions');
        const q = query(versionsRef, where('type', '==', 'revision'), orderBy('uploadedAt', 'desc'), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          setLatestRevisionUrl(data.fileUrl);
        }
      } catch (error) {
        console.error('Error fetching latest revision:', error);
      }
    };
    fetchLatestRevision();
  }, [task.submissionId]);

  // Función handleSubmit
  const handleSubmit = async () => {
    try {
      if (!decision) {
        alert(isSpanish ? 'Debes seleccionar una decisión' : 'You must select a decision');
        return;
      }

      if (!task.editorialReviewId) {
        console.error('No editorialReviewId found in task');
        alert(isSpanish ? 'Error: ID de revisión no encontrado' : 'Error: Review ID not found');
        return;
      }

      const decisionData = {
        decision,
        feedbackToAuthor: feedback,
        commentsToEditorial: internalComments
      };

      const result = await submitDeskReviewDecision(task.editorialReviewId, decisionData);
      
      if (result.success) {
        if (onComplete) {
          onComplete({
            decision,
            feedback,
            internalComments,
            reviewId: task.editorialReviewId
          });
        }
        alert(result.message || (isSpanish ? 'Decisión guardada exitosamente' : 'Decision saved successfully'));
      } else {
        alert(result.error || (isSpanish ? 'Error al guardar la decisión' : 'Error saving decision'));
      }
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      alert(isSpanish ? 'Error al procesar la solicitud' : 'Error processing request');
    }
  };

  // Función para traducir disponibilidad de datos
  const translateAvailability = (value) => {
    const translations = {
      public_repo: isSpanish ? 'Repositorio público' : 'Public repository',
      supplementary: isSpanish ? 'Material suplementario' : 'Supplementary material',
      upon_request: isSpanish ? 'Bajo solicitud razonable' : 'Upon reasonable request',
      not_available: isSpanish ? 'No disponible' : 'Not available',
      not_applicable: isSpanish ? 'No aplica' : 'Not applicable',
    };
    return translations[value] || value || '—';
  };

  // Función para traducir tipo de artículo
  const translateArticleType = (value) => {
    const translations = {
      research: isSpanish ? 'Artículo de Investigación Original' : 'Original Research Article',
      review: isSpanish ? 'Revisión Sistemática' : 'Systematic Review',
      essay: isSpanish ? 'Ensayo Académico y Reflexivo' : 'Academic and Reflective Essay',
      case: isSpanish ? 'Reporte de Caso' : 'Case Report',
      book_review: isSpanish ? 'Reseña de Libros' : 'Book Review',
    };
    return translations[value] || value || '—';
  };

  // Datos derivados
  const correspondingAuthor = submission.correspondingAuthor || 
    (submission.authors && submission.authors.length > 0 ? submission.authors.find(a => a.isCorresponding) || submission.authors[0] : null);
  
  const minorAuthorsList = submission.authors?.filter(a => a.isMinor) || [];
  const nonMinorAuthors = submission.authors?.filter(a => !a.isMinor) || [];
  
  const hasFunding = submission.funding?.hasFunding;
  const aiUsed = submission.aiUsed;
  const aiTools = submission.aiTools || [];
  const requiresEthics = submission.requiresEthicsApproval;

  // Mostrar loader mientras se carga la revisión
  if (loadingReview) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#C0A86A] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#5A6B7A] font-['Lora']">
            {isSpanish ? 'Cargando revisión editorial...' : 'Loading editorial review...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Mostrar error si existe */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg font-['Lora'] text-sm">
          {error}
        </div>
      )}
      
      {/* ==================== ENCABEZADO PRINCIPAL ==================== */}
      <div className="bg-gradient-to-r from-[#0A1929] to-[#1E2F40] text-white rounded-xl p-6 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-block px-3 py-1 bg-[#C0A86A] text-[#0A1929] text-xs font-bold rounded-full font-mono">
                {submission.submissionId || 'Sin ID'}
              </span>
              <span className="inline-block px-3 py-1 bg-white/15 text-white text-xs rounded-full font-mono">
                {translateArticleType(submission.articleType)}
              </span>
              <span className="inline-block px-3 py-1 bg-white/10 text-white text-xs rounded-full font-mono">
                {isSpanish ? 'Idioma:' : 'Language:'} {submission.paperLanguage === 'en' ? 'English' : 'Español'}
              </span>
              <span className="inline-block px-3 py-1 bg-white/10 text-white text-xs rounded-full font-mono">
                {isSpanish ? 'Ronda:' : 'Round:'} {submission.currentRound || 1}
              </span>
            </div>
            <h2 className="font-['Playfair_Display'] text-xl lg:text-2xl font-bold mb-2 leading-tight">
              {isSpanish ? submission.title : submission.titleEn || submission.title}
            </h2>
            {submission.titleEn && isSpanish && (
              <p className="text-[#E5E9F0] text-sm italic mb-2 font-['Lora']">
                EN: {submission.titleEn}
              </p>
            )}
            <div className="flex flex-wrap gap-3 text-[#E5E9F0] text-sm mt-3">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                {submission.area || '—'}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {submission.status || '—'}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {submission.createdAt?.toDate?.() 
                  ? new Date(submission.createdAt.toDate()).toLocaleDateString(isSpanish ? 'es-CL' : 'en-US')
                  : '—'}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {submission.originalFileUrl && (
              <a 
                href={submission.originalFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors text-sm whitespace-nowrap font-['Lora']"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                {isSpanish ? 'Manuscrito original' : 'Original manuscript'}
              </a>
            )}
            {latestRevisionUrl && (
              <a 
                href={latestRevisionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm whitespace-nowrap font-['Lora']"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {isSpanish ? 'Última revisión' : 'Latest revision'}
              </a>
            )}
            <div className="flex gap-1">
              <a 
                href={submission.driveFolderUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg transition-colors text-sm whitespace-nowrap font-['Lora']"
                title={isSpanish ? 'Carpeta del autor' : 'Author folder'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Autor
              </a>
              {submission.editorialFolderUrl && (
                <a 
                  href={submission.editorialFolderUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg transition-colors text-sm whitespace-nowrap font-['Lora']"
                  title={isSpanish ? 'Carpeta editorial' : 'Editorial folder'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Editorial
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ==================== GRID DE 2 COLUMNAS ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* COLUMNA IZQUIERDA */}
        <div className="space-y-6">
          
          {/* AUTOR DE CORRESPONDENCIA */}
          <InfoBlock 
            icon="✉️" 
            title={isSpanish ? 'Autor de Correspondencia' : 'Corresponding Author'}
          >
            {correspondingAuthor ? (
              <div className="space-y-3">
                <InfoField 
                  label={isSpanish ? 'Nombre completo' : 'Full name'}
                  value={`${correspondingAuthor.firstName || ''} ${correspondingAuthor.lastName || ''}`.trim()}
                />
                <InfoField label="Email" value={correspondingAuthor.email} />
                <div className="grid grid-cols-2 gap-3">
                  <InfoField label="ORCID" value={correspondingAuthor.orcid} />
                  <InfoField 
                    label={isSpanish ? 'Institución' : 'Institution'} 
                    value={correspondingAuthor.institution} 
                  />
                </div>
                {correspondingAuthor.contribution && (
                  <InfoField 
                    label={isSpanish ? 'Contribución (CRediT)' : 'Contribution (CRediT)'} 
                    value={correspondingAuthor.contribution} 
                  />
                )}
              </div>
            ) : (
              <p className="text-[#5A6B7A] text-sm italic font-['Lora']">
                {isSpanish ? 'No especificado' : 'Not specified'}
              </p>
            )}
          </InfoBlock>

          {/* COAUTORES (si hay más de uno) */}
          {nonMinorAuthors.length > 1 && (
            <InfoBlock 
              icon="👥" 
              title={`${isSpanish ? 'Coautores' : 'Co-authors'} (${nonMinorAuthors.length - 1})`}
            >
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {nonMinorAuthors.filter(a => !a.isCorresponding).map((author, index) => (
                  <div key={index} className="bg-[#F5F7FA] rounded-lg p-4 border border-[#E5E9F0]">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-medium text-[#0A1929] font-['Lora']">
                        {author.firstName} {author.lastName}
                      </p>
                      {author.isCorresponding && (
                        <span className="text-[#C0A86A] text-sm" title="Corresponding author">✉️</span>
                      )}
                      {author.isMinor && (
                        <span className="text-[#B22234] text-sm" title="Minor author">👶</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <InfoField label="Email" value={author.email} />
                      <InfoField label="ORCID" value={author.orcid} />
                    </div>
                    <InfoField 
                      label={isSpanish ? 'Institución' : 'Institution'} 
                      value={author.institution} 
                      className="mt-2"
                    />
                    {author.contribution && (
                      <InfoField 
                        label={isSpanish ? 'Contribución (CRediT)' : 'Contribution (CRediT)'} 
                        value={author.contribution} 
                        className="mt-2"
                      />
                    )}
                  </div>
                ))}
              </div>
            </InfoBlock>
          )}

          {/* RESUMEN BILINGÜE */}
          <InfoBlock 
            icon="📝" 
            title={isSpanish ? 'Resumen / Abstract' : 'Abstract / Resumen'}
          >
            <div className="space-y-4">
              <div>
                <span className="inline-block px-2 py-0.5 bg-[#E5E9F0] text-[#0A1929] text-[10px] font-mono rounded mb-2">ES</span>
                <p className="text-[#0A1929] text-sm leading-relaxed whitespace-pre-wrap font-['Lora']">
                  {submission.abstract || '—'}
                </p>
              </div>
              <div className="border-t border-[#E5E9F0] pt-4">
                <span className="inline-block px-2 py-0.5 bg-[#E5E9F0] text-[#0A1929] text-[10px] font-mono rounded mb-2">EN</span>
                <p className="text-[#0A1929] text-sm leading-relaxed whitespace-pre-wrap font-['Lora']">
                  {submission.abstractEn || submission.abstract || '—'}
                </p>
              </div>
            </div>
          </InfoBlock>

          {/* PALABRAS CLAVE BILINGÜE */}
          <InfoBlock 
            icon="🏷️" 
            title={isSpanish ? 'Palabras Clave / Keywords' : 'Keywords / Palabras Clave'}
          >
            <div className="space-y-3">
              <div>
                <span className="inline-block px-2 py-0.5 bg-[#E5E9F0] text-[#0A1929] text-[10px] font-mono rounded mb-2">ES</span>
                <div className="flex flex-wrap gap-2">
                  {submission.keywords?.map((keyword, index) => (
                    <span key={index} className="px-3 py-1 bg-white border border-[#C0A86A] text-[#0A1929] rounded-full text-xs font-['Lora']">
                      {keyword}
                    </span>
                  )) || <span className="text-[#5A6B7A] text-sm italic font-['Lora']">—</span>}
                </div>
              </div>
              <div className="border-t border-[#E5E9F0] pt-3">
                <span className="inline-block px-2 py-0.5 bg-[#E5E9F0] text-[#0A1929] text-[10px] font-mono rounded mb-2">EN</span>
                <div className="flex flex-wrap gap-2">
                  {(submission.keywordsEn?.length > 0 ? submission.keywordsEn : submission.keywords)?.map((keyword, index) => (
                    <span key={index} className="px-3 py-1 bg-white border border-[#C0A86A] text-[#0A1929] rounded-full text-xs font-['Lora']">
                      {keyword}
                    </span>
                  )) || <span className="text-[#5A6B7A] text-sm italic font-['Lora']">—</span>}
                </div>
              </div>
            </div>
          </InfoBlock>
        </div>

        {/* COLUMNA DERECHA */}
        <div className="space-y-6">
          
          {/* ÉTICA */}
          <InfoBlock 
            icon="⚖️" 
            title={isSpanish ? 'Ética de la Investigación' : 'Research Ethics'}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#0A1929] font-['Lora']">
                  {isSpanish ? '¿Requiere aprobación ética?' : 'Requires ethics approval?'}
                </span>
                <StatusBadge 
                  condition={requiresEthics}
                  trueLabel={isSpanish ? 'Sí' : 'Yes'}
                  trueColor="bg-yellow-100 text-yellow-800"
                  falseLabel={isSpanish ? 'No / Exento' : 'No / Exempt'}
                  falseColor="bg-green-100 text-green-800"
                />
              </div>
              {requiresEthics && (
                <InfoField 
                  label={isSpanish ? 'Comité y código de aprobación' : 'Committee and approval code'}
                  value={submission.ethicsCommitteeName}
                />
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#0A1929] font-['Lora']">
                  {isSpanish ? '¿Incluye autores menores?' : 'Includes minor authors?'}
                </span>
                <StatusBadge 
                  condition={submission.hasMinorAuthors}
                  trueLabel={isSpanish ? 'Sí' : 'Yes'}
                  trueColor="bg-orange-100 text-orange-800"
                  falseLabel={isSpanish ? 'No' : 'No'}
                  falseColor="bg-gray-100 text-gray-600"
                />
              </div>
            </div>
          </InfoBlock>

          {/* AUTORES MENORES (si existen) */}
          {minorAuthorsList.length > 0 && (
            <InfoBlock 
              icon="👶" 
              title={`${isSpanish ? 'Autores Menores de Edad' : 'Minor Authors'} (${minorAuthorsList.length})`}
            >
              <div className="space-y-3">
                {minorAuthorsList.map((author, index) => (
                  <div key={index} className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                    <p className="font-medium text-[#0A1929] font-['Lora']">
                      {author.firstName} {author.lastName}
                    </p>
                    <InfoField 
                      label={isSpanish ? 'Tutor legal' : 'Legal guardian'} 
                      value={author.guardianName} 
                    />
                    <InfoField 
                      label={isSpanish ? 'Método de consentimiento' : 'Consent method'} 
                      value={
                        author.consentMethod === 'upload' ? (isSpanish ? 'Formulario subido' : 'Form uploaded') :
                        author.consentMethod === 'email' ? (isSpanish ? 'Enviado por correo' : 'Sent by email') :
                        '—'
                      } 
                    />
                  </div>
                ))}
              </div>
            </InfoBlock>
          )}

          {/* USO DE IA */}
          <InfoBlock 
            icon="🤖" 
            title={isSpanish ? 'Uso de Inteligencia Artificial' : 'Use of Artificial Intelligence'}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#0A1929] font-['Lora']">
                  {isSpanish ? '¿Se utilizó IA?' : 'Was AI used?'}
                </span>
                <StatusBadge 
                  condition={aiUsed}
                  trueLabel={isSpanish ? 'Sí' : 'Yes'}
                  trueColor="bg-purple-100 text-purple-800"
                  falseLabel={isSpanish ? 'No' : 'No'}
                  falseColor="bg-gray-100 text-gray-600"
                />
              </div>
              {aiUsed && aiTools.length > 0 && (
                <div className="mt-3 space-y-2">
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-[0.1em] text-[#5A6B7A]">
                    {isSpanish ? 'Herramientas declaradas' : 'Declared tools'}
                  </label>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#F5F7FA]">
                          <th className="text-left p-2 text-[10px] font-mono text-[#5A6B7A] uppercase tracking-wider">
                            {isSpanish ? 'Herramienta' : 'Tool'}
                          </th>
                          <th className="text-left p-2 text-[10px] font-mono text-[#5A6B7A] uppercase tracking-wider">
                            {isSpanish ? 'Versión' : 'Version'}
                          </th>
                          <th className="text-left p-2 text-[10px] font-mono text-[#5A6B7A] uppercase tracking-wider">
                            {isSpanish ? 'Propósito' : 'Purpose'}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiTools.map((tool, index) => (
                          <tr key={index} className="border-t border-[#E5E9F0]">
                            <td className="p-2 font-['Lora'] text-[#0A1929]">{tool.name}</td>
                            <td className="p-2 font-['Lora'] text-[#0A1929]">{tool.version || '—'}</td>
                            <td className="p-2 font-['Lora'] text-[#0A1929] text-xs">{tool.purpose}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </InfoBlock>

          {/* DISPONIBILIDAD DE DATOS Y CÓDIGO */}
          <InfoBlock 
            icon="📊" 
            title={isSpanish ? 'Disponibilidad de Datos y Código' : 'Data & Code Availability'}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-semibold uppercase tracking-[0.1em] text-[#5A6B7A] mb-1">
                  {isSpanish ? 'Datos' : 'Data'}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[#0A1929] font-['Lora'] text-sm font-medium">
                    {translateAvailability(submission.dataAvailability)}
                  </span>
                </div>
                {submission.dataAvailabilityEn && (
                  <p className="text-[#5A6B7A] text-xs mt-1 font-['Lora'] italic">
                    EN: {submission.dataAvailabilityEn}
                  </p>
                )}
              </div>
              {submission.codeAvailability && (
                <div className="border-t border-[#E5E9F0] pt-4">
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-[0.1em] text-[#5A6B7A] mb-1">
                    {isSpanish ? 'Código' : 'Code'}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[#0A1929] font-['Lora'] text-sm font-medium">
                      {translateAvailability(submission.codeAvailability)}
                    </span>
                  </div>
                  {submission.codeAvailabilityEn && (
                    <p className="text-[#5A6B7A] text-xs mt-1 font-['Lora'] italic">
                      EN: {submission.codeAvailabilityEn}
                    </p>
                  )}
                </div>
              )}
            </div>
          </InfoBlock>

          {/* FINANCIAMIENTO */}
          <InfoBlock 
            icon="💰" 
            title={isSpanish ? 'Financiamiento' : 'Funding'}
          >
            {hasFunding ? (
              <div className="space-y-3">
                <InfoField 
                  label={isSpanish ? 'Entidad financiadora' : 'Funding entity'} 
                  value={submission.funding?.sources} 
                />
                <InfoField 
                  label={isSpanish ? 'Código(s) de subvención' : 'Grant number(s)'} 
                  value={submission.funding?.grantNumbers} 
                />
              </div>
            ) : (
              <p className="text-[#5A6B7A] text-sm italic font-['Lora']">
                {isSpanish ? 'Sin financiamiento externo declarado' : 'No external funding declared'}
              </p>
            )}
          </InfoBlock>

          {/* CONFLICTO DE INTERESES */}
          <InfoBlock 
            icon="⚠️" 
            title={isSpanish ? 'Conflicto de Intereses' : 'Conflict of Interest'}
          >
            <p className="text-[#0A1929] text-sm leading-relaxed whitespace-pre-wrap font-['Lora']">
              {submission.conflictOfInterest || '—'}
            </p>
          </InfoBlock>

          {/* AGRADECIMIENTOS */}
          {submission.acknowledgments && (
            <InfoBlock 
              icon="🙏" 
              title={isSpanish ? 'Agradecimientos' : 'Acknowledgments'}
            >
              <p className="text-[#0A1929] text-sm leading-relaxed whitespace-pre-wrap font-['Lora']">
                {submission.acknowledgments}
              </p>
            </InfoBlock>
          )}

          {/* REVISORES EXCLUIDOS */}
          {submission.excludedReviewers && submission.excludedReviewers.length > 0 && (
            <InfoBlock 
              icon="🚫" 
              title={isSpanish ? 'Revisores Excluidos' : 'Excluded Reviewers'}
            >
              <ul className="space-y-1">
                {submission.excludedReviewers.map((reviewer, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-[#0A1929] font-['Lora']">
                    <span className="w-1.5 h-1.5 bg-[#B22234] rounded-full"></span>
                    {reviewer}
                  </li>
                ))}
              </ul>
            </InfoBlock>
          )}

          {/* INFORMACIÓN DEL ARCHIVO */}
          <InfoBlock 
            icon="📄" 
            title={isSpanish ? 'Información del Archivo' : 'File Information'}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <InfoField 
                  label={isSpanish ? 'Nombre del archivo' : 'File name'} 
                  value={submission.originalFileName} 
                />
                <InfoField 
                  label={isSpanish ? 'Tamaño' : 'Size'} 
                  value={submission.originalFileSize 
                    ? `${(submission.originalFileSize / 1024).toFixed(2)} KB` 
                    : '—'
                  } 
                />
              </div>
              <InfoField 
                label="SHA-256" 
                value={submission.originalFileHash ? `${submission.originalFileHash.substring(0, 16)}...` : '—'} 
              />
            </div>
          </InfoBlock>
        </div>
      </div>

      {/* ==================== DECLARACIONES ACEPTADAS ==================== */}
      {submission.declarations && Object.keys(submission.declarations).length > 0 && (
        <InfoBlock 
          icon="✅" 
          title={isSpanish ? 'Declaraciones Aceptadas por el Autor' : 'Declarations Accepted by Author'}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { key: 'originalAndSimilarity', label: isSpanish ? 'Originalidad y <15% similitud' : 'Originality and <15% similarity' },
              { key: 'exclusiveSubmission', label: isSpanish ? 'Envío exclusivo' : 'Exclusive submission' },
              { key: 'authorshipCriteria', label: isSpanish ? 'Criterios de autoría ICMJE' : 'ICMJE authorship criteria' },
              { key: 'dataAuthentic', label: isSpanish ? 'Datos auténticos' : 'Authentic data' },
              { key: 'informedConsent', label: isSpanish ? 'Consentimiento informado' : 'Informed consent' },
              { key: 'aiDisclosure', label: isSpanish ? 'Declaración de IA' : 'AI disclosure' },
              { key: 'conflicts', label: isSpanish ? 'Conflictos declarados' : 'Conflicts declared' },
              { key: 'ccByLicense', label: isSpanish ? 'Licencia CC-BY 4.0' : 'CC-BY 4.0 License' },
            ].map(d => (
              <div key={d.key} className="flex items-center gap-2 text-sm">
                <span className={submission.declarations[d.key] ? 'text-green-600' : 'text-red-400'}>
                  {submission.declarations[d.key] ? '✓' : '✗'}
                </span>
                <span className={`font-['Lora'] ${submission.declarations[d.key] ? 'text-[#0A1929]' : 'text-[#5A6B7A]'}`}>
                  {d.label}
                </span>
              </div>
            ))}
          </div>
        </InfoBlock>
      )}

      {/* ==================== DECISIÓN EDITORIAL ==================== */}
      <div className="mt-8 pt-6 border-t-2 border-[#C0A86A]">
        <h3 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-lg mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[#C0A86A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {isSpanish ? 'Decisión Editorial' : 'Editorial Decision'}
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { value: 'reject', label: isSpanish ? 'Rechazar' : 'Reject', bg: 'bg-red-50 hover:bg-red-100', border: 'border-red-200', icon: '✕' },
            { value: 'minor-revision', label: isSpanish ? 'Revisión menor' : 'Minor revision', bg: 'bg-yellow-50 hover:bg-yellow-100', border: 'border-yellow-200', icon: '🔧' },
            { value: 'revision-required', label: isSpanish ? 'Enviar a revisión' : 'Send to review', bg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200', icon: '📤' },
            { value: 'accept', label: isSpanish ? 'Aceptar' : 'Accept', bg: 'bg-green-50 hover:bg-green-100', border: 'border-green-200', icon: '✓' }
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setDecision(opt.value)}
              className={`p-4 rounded-xl border-2 font-['Lora'] transition-all text-center ${
                decision === opt.value
                  ? 'border-[#C0A86A] bg-[#FBF9F3] text-[#0A1929] shadow-md'
                  : `${opt.bg} ${opt.border} text-[#5A6B7A] hover:text-[#0A1929]`
              }`}
            >
              <span className="text-xl block mb-1">{opt.icon}</span>
              <span className="text-sm font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* FEEDBACK */}
      <div>
        <label className="block font-['Playfair_Display'] font-semibold text-[#0A1929] mb-3">
          {isSpanish ? 'Feedback para el Autor' : 'Feedback to Author'}
        </label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows="5"
          className="w-full p-4 bg-[#F5F7FA] border border-[#E5E9F0] rounded-xl focus:ring-2 focus:ring-[#C0A86A] focus:border-transparent font-['Lora'] text-sm"
          placeholder={isSpanish ? 'Explica tu decisión al autor...' : 'Explain your decision to the author...'}
        />
      </div>

      {/* COMENTARIOS INTERNOS */}
      <div>
        <label className="block font-['Playfair_Display'] font-semibold text-[#0A1929] mb-3">
          {isSpanish ? 'Comentarios Internos' : 'Internal Comments'}
        </label>
        <textarea
          value={internalComments}
          onChange={(e) => setInternalComments(e.target.value)}
          rows="3"
          className="w-full p-4 bg-[#F5F7FA] border border-[#E5E9F0] rounded-xl focus:ring-2 focus:ring-[#C0A86A] focus:border-transparent font-['Lora'] text-sm"
          placeholder={isSpanish ? 'Notas para el equipo editorial...' : 'Notes for the editorial team...'}
        />
      </div>

      {/* BOTÓN DE GUARDAR */}
      <button
        onClick={handleSubmit}
        disabled={isLoading || !decision}
        className="w-full py-4 bg-[#0A1929] hover:bg-[#1E2F40] text-white font-['Playfair_Display'] font-bold rounded-xl transition-all disabled:bg-[#E5E9F0] disabled:text-[#5A6B7A] disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {isSpanish ? 'GUARDANDO...' : 'SAVING...'}
          </span>
        ) : (
          isSpanish ? 'GUARDAR DECISIÓN' : 'SAVE DECISION'
        )}
      </button>
    </div>
  );
};