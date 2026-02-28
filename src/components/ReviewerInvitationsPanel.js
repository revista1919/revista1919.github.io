import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  EnvelopeIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ClockIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { db, doc, updateDoc, getUserInvitations } from '../firebase';
import { useLanguage } from '../hooks/useLanguage';

export default function ReviewerInvitationsPanel({ user, onAccept }) {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState('');
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  // Cargar invitaciones al montar
  useEffect(() => {
    loadInvitations();
  }, [user?.email]);

  const loadInvitations = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await getUserInvitations();
      if (result.success) {
        setInvitations(result.invitations);
      } else {
        setError(isSpanish ? 'Error cargando invitaciones' : 'Error loading invitations');
      }
    } catch (err) {
      console.error('Error loading invitations:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (invitationId, status, conflictOfInterest = '', responseComments = '') => {
    setProcessingId(invitationId);
    setError('');
    
    try {
      const invitationRef = doc(db, 'reviewerInvitations', invitationId);
      
      await updateDoc(invitationRef, {
        status: status,
        respondedAt: new Date().toISOString(),
        conflictOfInterest: conflictOfInterest || '',
        responseComments: responseComments || ''
      });
      
      // Si acepta, redirigir o notificar
      if (status === 'accepted') {
        // Opción 1: Redirigir directamente (si queremos mandarlo al workspace)
        if (onAccept) {
          const acceptedInv = invitations.find(i => i.id === invitationId);
          onAccept(acceptedInv);
        }
        
        // Opción 2: Mostrar mensaje de éxito y recargar
        setTimeout(() => {
          loadInvitations();
        }, 2000);
      } else {
        // Si rechaza, simplemente recargar la lista
        loadInvitations();
      }
      
    } catch (err) {
      console.error('Error responding to invitation:', err);
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const InvitationCard = ({ invitation }) => {
    const [showForm, setShowForm] = useState(false);
    const [conflict, setConflict] = useState('');
    const [comments, setComments] = useState('');
    
    const formatDate = (dateStr) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString(isSpanish ? 'es-CL' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-white border border-amber-200 rounded-2xl shadow-lg overflow-hidden"
      >
        {/* Cabecera con color distintivo */}
        <div className="bg-amber-50 px-6 py-4 border-b border-amber-200 flex items-center gap-3">
          <EnvelopeIcon className="w-5 h-5 text-amber-600" />
          <span className="text-amber-800 font-semibold">
            {isSpanish ? 'INVITACIÓN PENDIENTE' : 'PENDING INVITATION'}
          </span>
        </div>
        
        {/* Cuerpo */}
        <div className="p-6">
          <h3 className="font-serif text-xl font-bold text-gray-900 mb-3">
            {invitation.submission?.title || 'Artículo sin título'}
          </h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div>
              <span className="text-gray-500 block">
                {isSpanish ? 'Invitado por:' : 'Invited by:'}
              </span>
              <span className="font-medium">{invitation.invitedByEmail}</span>
            </div>
            <div>
              <span className="text-gray-500 block">
                {isSpanish ? 'Ronda:' : 'Round:'}
              </span>
              <span className="font-medium">{invitation.round || 1}</span>
            </div>
            <div>
              <span className="text-gray-500 block">
                {isSpanish ? 'Fecha:' : 'Date:'}
              </span>
              <span className="font-medium">{formatDate(invitation.createdAt)}</span>
            </div>
            <div>
              <span className="text-gray-500 block">
                {isSpanish ? 'Área:' : 'Area:'}
              </span>
              <span className="font-medium">{invitation.submission?.area || 'N/A'}</span>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-xl mb-6 text-sm text-gray-600">
            <p>
              {isSpanish 
                ? 'Has sido invitado/a a revisar este artículo. Por favor, responde a esta invitación para continuar.'
                : 'You have been invited to review this article. Please respond to this invitation to continue.'}
            </p>
          </div>
          
          <AnimatePresence mode="wait">
            {!showForm ? (
              <motion.div
                key="buttons"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex gap-3"
              >
                <button
                  onClick={() => setShowForm(true)}
                  disabled={processingId === invitation.id}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircleIcon className="w-5 h-5" />
                  {isSpanish ? 'RESPONDER' : 'RESPOND'}
                </button>
                
                <a
                  href={`/reviewer-response?hash=${invitation.inviteHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 border border-gray-300 hover:bg-gray-50 rounded-xl transition-all flex items-center gap-2"
                  title={isSpanish ? 'Abrir enlace original' : 'Open original link'}
                >
                  <DocumentTextIcon className="w-5 h-5 text-gray-500" />
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
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                    {isSpanish ? 'CONFLICTO DE INTERÉS (OPCIONAL)' : 'CONFLICT OF INTEREST (OPTIONAL)'}
                  </label>
                  <textarea
                    value={conflict}
                    onChange={(e) => setConflict(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-amber-400 focus:ring-0 text-sm"
                    rows="2"
                    placeholder={isSpanish 
                      ? 'Si tienes algún conflicto, descríbelo aquí...' 
                      : 'If you have any conflict, describe it here...'}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                    {isSpanish ? 'COMENTARIOS (OPCIONAL)' : 'COMMENTS (OPTIONAL)'}
                  </label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-amber-400 focus:ring-0 text-sm"
                    rows="2"
                    placeholder={isSpanish 
                      ? 'Comentarios adicionales...' 
                      : 'Additional comments...'}
                  />
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleResponse(invitation.id, 'accepted', conflict, comments)}
                    disabled={processingId === invitation.id}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {processingId === invitation.id ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircleIcon className="w-5 h-5" />
                        {isSpanish ? 'ACEPTAR' : 'ACCEPT'}
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => handleResponse(invitation.id, 'declined', conflict, comments)}
                    disabled={processingId === invitation.id}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <XCircleIcon className="w-5 h-5" />
                    {isSpanish ? 'RECHAZAR' : 'DECLINE'}
                  </button>
                  
                  <button
                    onClick={() => setShowForm(false)}
                    className="px-4 py-3 border border-gray-300 hover:bg-gray-50 rounded-xl transition-all"
                  >
                    <span className="text-gray-600">
                      {isSpanish ? 'Cancelar' : 'Cancel'}
                    </span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Footer con fecha límite */}
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center gap-2 text-sm text-gray-500">
          <ClockIcon className="w-4 h-4" />
          <span>
            {isSpanish 
              ? 'Responde dentro de los próximos 7 días' 
              : 'Respond within the next 7 days'}
          </span>
        </div>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-200 border-t-amber-600 mb-4"></div>
        <p className="text-gray-500">
          {isSpanish ? 'Cargando invitaciones...' : 'Loading invitations...'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
        <p className="text-red-600 mb-3">{error}</p>
        <button
          onClick={loadInvitations}
          className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all"
        >
          {isSpanish ? 'Reintentar' : 'Retry'}
        </button>
      </div>
    );
  }

  if (invitations.length === 0) {
    return null; // No mostrar nada si no hay invitaciones
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-2xl font-bold text-gray-900">
          {isSpanish ? 'Invitaciones Pendientes' : 'Pending Invitations'}
        </h2>
        <span className="bg-amber-100 text-amber-800 text-sm font-bold px-3 py-1 rounded-full">
          {invitations.length}
        </span>
      </div>
      
      <div className="space-y-4">
        <AnimatePresence>
          {invitations.map(inv => (
            <InvitationCard key={inv.id} invitation={inv} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}