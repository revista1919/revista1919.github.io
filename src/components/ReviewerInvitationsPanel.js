import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  EnvelopeIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { db, doc, updateDoc, getUserInvitations } from '../firebase';
import { useLanguage } from '../hooks/useLanguage';

// Constantes
const RESPONSE_DEADLINE_DAYS = 7;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

export default function ReviewerInvitationsPanel({ user, onAccept }) {
  // Estados principales
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(null);
  
  // Estados para depuración (solo en desarrollo)
  const [debugInfo, setDebugInfo] = useState(null);
  
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  // Memoizar textos para evitar recreaciones
  const texts = useMemo(() => ({
    loading: isSpanish ? 'Cargando invitaciones...' : 'Loading invitations...',
    error: isSpanish ? 'Error cargando invitaciones' : 'Error loading invitations',
    retry: isSpanish ? 'Reintentar' : 'Retry',
    noInvitations: isSpanish ? 'No hay invitaciones pendientes' : 'No pending invitations',
    pendingInvitations: isSpanish ? 'Invitaciones Pendientes' : 'Pending Invitations',
    invitedBy: isSpanish ? 'Invitado por:' : 'Invited by:',
    round: isSpanish ? 'Ronda:' : 'Round:',
    date: isSpanish ? 'Fecha:' : 'Date:',
    area: isSpanish ? 'Área:' : 'Area:',
    respond: isSpanish ? 'RESPONDER' : 'RESPOND',
    accept: isSpanish ? 'ACEPTAR' : 'ACCEPT',
    decline: isSpanish ? 'RECHAZAR' : 'DECLINE',
    cancel: isSpanish ? 'Cancelar' : 'Cancel',
    openOriginal: isSpanish ? 'Abrir enlace original' : 'Open original link',
    conflictLabel: isSpanish ? 'CONFLICTO DE INTERÉS (OPCIONAL)' : 'CONFLICT OF INTEREST (OPTIONAL)',
    commentsLabel: isSpanish ? 'COMENTARIOS (OPCIONAL)' : 'COMMENTS (OPTIONAL)',
    conflictPlaceholder: isSpanish 
      ? 'Si tienes algún conflicto, descríbelo aquí...' 
      : 'If you have any conflict, describe it here...',
    commentsPlaceholder: isSpanish 
      ? 'Comentarios adicionales...' 
      : 'Additional comments...',
    deadlineMessage: isSpanish 
      ? `Responde dentro de los próximos ${RESPONSE_DEADLINE_DAYS} días` 
      : `Respond within the next ${RESPONSE_DEADLINE_DAYS} days`,
    invitationDescription: isSpanish
      ? 'Has sido invitado/a a revisar este artículo. Por favor, responde a esta invitación para continuar.'
      : 'You have been invited to review this article. Please respond to this invitation to continue.',
    unexpectedError: isSpanish
      ? 'Error inesperado. Por favor, intenta nuevamente.'
      : 'Unexpected error. Please try again.',
    sessionExpired: isSpanish
      ? 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
      : 'Your session has expired. Please log in again.',
    networkError: isSpanish
      ? 'Error de conexión. Verifica tu internet.'
      : 'Network error. Check your internet connection.'
  }), [isSpanish]);

  // Cargar invitaciones con manejo robusto
  const loadInvitations = useCallback(async (isRetry = false) => {
    // Validar usuario
    if (!user?.email) {
      console.warn('❌ [ReviewerInvitationsPanel] No user email available');
      setError(texts.sessionExpired);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    // Logging detallado
    console.group('📬 [ReviewerInvitationsPanel] Loading invitations');
    console.log('User:', { uid: user.uid, email: user.email });
    console.log('Retry:', isRetry ? `Attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS}` : 'Initial load');
    
    try {
      // Timeout para la petición
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );
      
      const response = await getUserInvitations();
      console.log('📦 Raw response:', response);
      
      // ✅ Firebase Callable Functions siempre envuelven en 'data'
      const result = response.data || response;
      console.log('📦 Processed result:', result);
      
      if (result && result.success) {
        // Asegurar que invitations sea un array
        const invitationsArray = Array.isArray(result.invitations) 
          ? result.invitations 
          : [];
        
        console.log(`✅ Invitaciones válidas: ${invitationsArray.length}`);
        
        // Validar y normalizar invitaciones
        const validInvitations = invitationsArray.filter(inv => {
          const isValid = inv && inv.id && inv.submissionId;
          if (!isValid) {
            console.warn('⚠️ Invalid invitation skipped:', inv);
          }
          return isValid;
        });
        
        console.log(`✅ Valid invitations: ${validInvitations.length}/${invitationsArray.length}`);
        
        setInvitations(validInvitations);
        setLastRefresh(new Date().toISOString());
        setRetryCount(0); // Resetear contador en éxito
        
        // Guardar debug info en desarrollo
        if (process.env.NODE_ENV === 'development') {
          setDebugInfo({
            raw: invitationsArray,
            valid: validInvitations,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        // Si success es false, mostrar el error
        const errorMsg = result?.error || texts.error;
        console.error('❌ Error en respuesta:', result);
        throw new Error(errorMsg);
      }
      
    } catch (err) {
      console.error('❌ Error loading invitations:', err);
      
      // Clasificar errores
      let errorMessage = texts.error;
      let shouldRetry = true;
      
      if (err.message.includes('timeout')) {
        errorMessage = isSpanish 
          ? 'La petición está tardando demasiado. Reintentando...'
          : 'Request is taking too long. Retrying...';
      } else if (err.message.includes('network') || err.message.includes('Failed to fetch')) {
        errorMessage = texts.networkError;
      } else if (err.message.includes('permission') || err.message.includes('unauthenticated')) {
        errorMessage = texts.sessionExpired;
        shouldRetry = false;
      } else if (err.code === 'permission-denied') {
        errorMessage = texts.sessionExpired;
        shouldRetry = false;
      }
      
      setError(errorMessage);
      
      // Sistema de reintentos
      if (shouldRetry && retryCount < MAX_RETRY_ATTEMPTS - 1) {
        console.log(`🔄 Scheduling retry ${retryCount + 1}/${MAX_RETRY_ATTEMPTS}...`);
        setRetryCount(prev => prev + 1);
        
        setTimeout(() => {
          loadInvitations(true);
        }, RETRY_DELAY_MS * (retryCount + 1)); // Backoff exponencial
      } else if (retryCount >= MAX_RETRY_ATTEMPTS - 1) {
        console.log('❌ Max retry attempts reached');
        // Mantener el error, no reintentar más
      }
      
      // Guardar error en debug
      if (process.env.NODE_ENV === 'development') {
        setDebugInfo({
          error: err.message,
          stack: err.stack,
          retryCount,
          timestamp: new Date().toISOString()
        });
      }
      
    } finally {
      setLoading(false);
      console.groupEnd();
    }
  }, [user, retryCount, texts, isSpanish]);

  // Efecto para carga inicial
  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      if (mounted) {
        await loadInvitations();
      }
    };
    
    init();
    
    return () => {
      mounted = false;
    };
  }, [loadInvitations]); // Dependencia estable gracias a useCallback

  // Handler para respuesta a invitación
  const handleResponse = useCallback(async (invitationId, status, conflictOfInterest = '', responseComments = '') => {
    if (!invitationId || !status) {
      console.error('❌ Missing required parameters');
      return;
    }
    
    setProcessingId(invitationId);
    setError(null);
    
    console.log(`📝 [ReviewerInvitationsPanel] Responding to invitation:`, {
      invitationId,
      status,
      hasConflict: !!conflictOfInterest,
      hasComments: !!responseComments
    });
    
    try {
      // Validar que existe la invitación
      const invitation = invitations.find(i => i.id === invitationId);
      if (!invitation) {
        throw new Error('Invitation not found in state');
      }
      
      const invitationRef = doc(db, 'reviewerInvitations', invitationId);
      
      // Timeout para la operación
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Update timeout')), 10000)
      );
      
      await Promise.race([
        updateDoc(invitationRef, {
          status: status,
          respondedAt: new Date().toISOString(),
          conflictOfInterest: conflictOfInterest?.trim() || '',
          responseComments: responseComments?.trim() || '',
          updatedAt: new Date().toISOString()
        }),
        timeoutPromise
      ]);
      
      console.log(`✅ Response recorded successfully for ${invitationId}`);
      
      // Si acepta y hay callback
      if (status === 'accepted' && onAccept) {
        const acceptedInv = invitations.find(i => i.id === invitationId);
        if (acceptedInv) {
          // Pequeño delay para asegurar que Firestore actualizó
          setTimeout(() => {
            onAccept(acceptedInv);
          }, 500);
        }
      }
      
      // Recargar lista después de responder
      // Mayor delay si aceptó para dar tiempo al trigger
      const reloadDelay = status === 'accepted' ? 3000 : 1500;
      
      setTimeout(() => {
        loadInvitations();
      }, reloadDelay);
      
    } catch (err) {
      console.error('❌ Error responding to invitation:', err);
      
      let errorMessage = isSpanish 
        ? 'Error al procesar tu respuesta. Por favor, intenta nuevamente.'
        : 'Error processing your response. Please try again.';
      
      if (err.message.includes('timeout')) {
        errorMessage = isSpanish
          ? 'La operación está tomando demasiado tiempo. Por favor, intenta nuevamente.'
          : 'The operation is taking too long. Please try again.';
      } else if (err.message.includes('permission')) {
        errorMessage = texts.sessionExpired;
      }
      
      setError(errorMessage);
      
      // Reintentar después de error
      setTimeout(() => {
        setError(null);
      }, 5000);
      
    } finally {
      setProcessingId(null);
    }
  }, [invitations, onAccept, loadInvitations, texts, isSpanish]);

  // Componente de tarjeta de invitación
  const InvitationCard = useCallback(({ invitation }) => {
    const [showForm, setShowForm] = useState(false);
    const [conflict, setConflict] = useState('');
    const [comments, setComments] = useState('');
    const [localError, setLocalError] = useState(null);
    
    // Validar datos de invitación
    if (!invitation?.id) {
      console.warn('⚠️ Invalid invitation card data:', invitation);
      return null;
    }
    
    const formatDate = (dateStr) => {
      if (!dateStr) return isSpanish ? 'Fecha no disponible' : 'Date not available';
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString(isSpanish ? 'es-CL' : 'en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch {
        return dateStr;
      }
    };
    
    const handleLocalResponse = async (status) => {
      setLocalError(null);
      try {
        await handleResponse(invitation.id, status, conflict, comments);
        if (status !== 'accepted') {
          setShowForm(false); // Solo cerrar si no es aceptado (el aceptado redirige)
        }
      } catch (err) {
        setLocalError(err.message);
      }
    };
    
    const isProcessing = processingId === invitation.id;
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-white border border-amber-200 rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
      >
        {/* Cabecera */}
        <div className="bg-amber-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-amber-200 flex items-center gap-2 sm:gap-3">
          <EnvelopeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 flex-shrink-0" />
          <span className="text-amber-800 font-semibold text-xs sm:text-sm uppercase tracking-wider">
            {isSpanish ? 'INVITACIÓN PENDIENTE' : 'PENDING INVITATION'}
          </span>
        </div>
        
        {/* Cuerpo */}
        <div className="p-4 sm:p-6">
          {/* Título */}
          <h3 className="font-serif text-lg sm:text-xl font-bold text-gray-900 mb-3 break-words">
            {invitation.submission?.title || 
             invitation.articleTitle || 
             (isSpanish ? 'Artículo sin título' : 'Untitled article')}
          </h3>
          
          {/* Grid de información */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-xs sm:text-sm">
            <div>
              <span className="text-gray-500 block text-xs">
                {texts.invitedBy}
              </span>
              <span className="font-medium text-gray-900 break-words">
                {invitation.invitedByEmail || 'No especificado'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">
                {texts.round}
              </span>
              <span className="font-medium text-gray-900">
                {invitation.round || 1}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">
                {texts.date}
              </span>
              <span className="font-medium text-gray-900">
                {formatDate(invitation.createdAt)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">
                {texts.area}
              </span>
              <span className="font-medium text-gray-900">
                {invitation.submission?.area || invitation.area || 'N/A'}
              </span>
            </div>
          </div>
          
          {/* Descripción */}
          <div className="bg-gray-50 p-3 sm:p-4 rounded-xl mb-4 text-xs sm:text-sm text-gray-600">
            <p className="leading-relaxed">
              {texts.invitationDescription}
            </p>
          </div>
          
          {/* Error local */}
          {localError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <ExclamationTriangleIcon className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">{localError}</p>
            </div>
          )}
          
          {/* Formulario de respuesta */}
          <AnimatePresence mode="wait">
            {!showForm ? (
              <motion.div
                key="buttons"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col sm:flex-row gap-2 sm:gap-3"
              >
                <button
                  onClick={() => setShowForm(true)}
                  disabled={isProcessing}
                  className="w-full sm:flex-1 py-2.5 sm:py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
                >
                  <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  {texts.respond}
                </button>
                
                <a
                  href={`/reviewer-response?hash=${invitation.inviteHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-3 border border-gray-300 hover:bg-gray-50 rounded-xl transition-all flex items-center justify-center gap-2 text-xs sm:text-sm text-gray-700"
                  title={texts.openOriginal}
                >
                  <DocumentTextIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                </a>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="space-y-4"
              >
                {/* Campo conflicto de interés */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                    {texts.conflictLabel}
                  </label>
                  <textarea
                    value={conflict}
                    onChange={(e) => setConflict(e.target.value)}
                    disabled={isProcessing}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-amber-400 focus:ring-0 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    rows="2"
                    placeholder={texts.conflictPlaceholder}
                  />
                </div>
                
                {/* Campo comentarios */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                    {texts.commentsLabel}
                  </label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    disabled={isProcessing}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-amber-400 focus:ring-0 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    rows="2"
                    placeholder={texts.commentsPlaceholder}
                  />
                </div>
                
                {/* Botones de acción */}
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    onClick={() => handleLocalResponse('accepted')}
                    disabled={isProcessing}
                    className="w-full sm:flex-1 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
                  >
                    {isProcessing ? (
                      <ArrowPathIcon className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    ) : (
                      <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                    {texts.accept}
                  </button>
                  
                  <button
                    onClick={() => handleLocalResponse('declined')}
                    disabled={isProcessing}
                    className="w-full sm:flex-1 py-2.5 sm:py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
                  >
                    <XCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    {texts.decline}
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setConflict('');
                      setComments('');
                      setLocalError(null);
                    }}
                    disabled={isProcessing}
                    className="w-full sm:w-auto px-4 py-2.5 sm:py-3 border border-gray-300 hover:bg-gray-50 rounded-xl transition-all text-xs sm:text-sm text-gray-700"
                  >
                    {texts.cancel}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Footer con fecha límite */}
        <div className="bg-gray-50 px-4 sm:px-6 py-2.5 sm:py-3 border-t border-gray-200 flex items-center gap-2 text-xs sm:text-sm text-gray-500">
          <ClockIcon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
          <span>{texts.deadlineMessage}</span>
        </div>
      </motion.div>
    );
  }, [isSpanish, texts, processingId, handleResponse]);

  // Renderizado condicional con manejo de estados
  if (loading && invitations.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 sm:p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-amber-200 border-t-amber-600 mb-4"></div>
        <p className="text-gray-500 text-sm sm:text-base">
          {texts.loading}
        </p>
        {retryCount > 0 && (
          <p className="text-xs text-amber-600 mt-2">
            {isSpanish 
              ? `Reintentando (${retryCount}/${MAX_RETRY_ATTEMPTS})...` 
              : `Retrying (${retryCount}/${MAX_RETRY_ATTEMPTS})...`}
          </p>
        )}
      </div>
    );
  }

  if (error && invitations.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 sm:p-8 text-center">
        <ExclamationTriangleIcon className="w-10 h-10 sm:w-12 sm:h-12 text-red-600 mx-auto mb-3" />
        <p className="text-red-600 text-sm sm:text-base mb-4">{error}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => {
              setRetryCount(0);
              loadInvitations();
            }}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            {texts.retry}
          </button>
          {lastRefresh && (
            <p className="text-xs text-gray-500 self-center">
              {isSpanish ? 'Último intento: ' : 'Last attempt: '}
              {new Date(lastRefresh).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (invitations.length === 0) {
    // No mostrar nada si no hay invitaciones (estado normal)
    return null;
  }

  return (
    <div className="mb-6 sm:mb-8">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <EnvelopeIcon className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
          {texts.pendingInvitations}
        </h2>
        <div className="flex items-center gap-3">
          <span className="bg-amber-100 text-amber-800 text-xs sm:text-sm font-bold px-2.5 sm:px-3 py-1 rounded-full">
            {invitations.length}
          </span>
          <button
            onClick={() => loadInvitations()}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
            title={isSpanish ? 'Actualizar' : 'Refresh'}
          >
            <ArrowPathIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {/* Lista de invitaciones */}
      <div className="space-y-3 sm:space-y-4">
        <AnimatePresence mode="popLayout">
          {invitations.map(invitation => (
            <InvitationCard key={invitation.id} invitation={invitation} />
          ))}
        </AnimatePresence>
      </div>

      {/* Debug info en desarrollo */}
      {process.env.NODE_ENV === 'development' && debugInfo && (
        <div className="mt-4 p-4 bg-gray-900 text-gray-100 rounded-xl text-xs overflow-auto">
          <p className="font-mono mb-2">🔧 Debug Info:</p>
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}