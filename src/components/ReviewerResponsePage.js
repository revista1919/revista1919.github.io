// src/components/ReviewerResponsePage.js (VERSIÓN CORREGIDA)
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import { useReviewerInvitation } from '../hooks/useReviewerInvitation';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const ReviewerResponsePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const hash = searchParams.get('hash');
  const urlLang = searchParams.get('lang') || 'es';
  
  const { language, switchLanguage } = useLanguage();
  const isSpanish = language === 'es';

  const [invitation, setInvitation] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState('');
  const [responseSent, setResponseSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- CORREGIDO: No pasar null como argumento ---
  const { getInvitationByHash, respondToInvitation, loading: hookLoading } = useReviewerInvitation();

  // Sincronizar idioma
  useEffect(() => {
    if (urlLang && urlLang !== language && (urlLang === 'es' || urlLang === 'en')) {
      switchLanguage(urlLang);
    }
  }, [urlLang, language, switchLanguage]);

  const handleLanguageChange = useCallback((newLang) => {
    if (newLang !== language) {
      switchLanguage(newLang);
      const newParams = new URLSearchParams(searchParams);
      newParams.set('lang', newLang);
      setSearchParams(newParams);
    }
  }, [language, switchLanguage, searchParams, setSearchParams]);

  useEffect(() => {
    const loadInvitation = async () => {
      if (!hash) {
        setError(isSpanish ? 'Enlace de invitación inválido' : 'Invalid invitation link');
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 Cargando invitación con hash:', hash);
        const result = await getInvitationByHash(hash);
        
        if (result?.success && result?.found) {
          console.log('✅ Invitación encontrada:', result.data);
          setInvitation(result.data);
          
          if (result.data?.submissionId) {
            try {
              const submissionDoc = await getDoc(doc(db, 'submissions', result.data.submissionId));
              if (submissionDoc.exists()) {
                const submissionData = submissionDoc.data();
                setSubmission({
                  id: submissionDoc.id,
                  title: submissionData.title,
                  abstract: submissionData.abstract,
                  area: submissionData.area,
                  paperLanguage: submissionData.paperLanguage,
                  driveFolderUrl: submissionData.driveFolderUrl,
                  authors: submissionData.authors
                });
              }
            } catch (subError) {
              console.warn('⚠️ Error cargando submission:', subError);
              // No detenemos el flujo principal
            }
          }
        } else {
          console.log('❌ Invitación no encontrada:', result?.error);
          setError(result?.error || (isSpanish ? 'Invitación no encontrada' : 'Invitation not found'));
        }
      } catch (err) {
        console.error('❌ Error cargando invitación:', err);
        setError(isSpanish ? 'Error al cargar la invitación' : 'Error loading invitation');
      } finally {
        setLoading(false);
      }
    };

    loadInvitation();
  }, [hash, getInvitationByHash, isSpanish]);

  const handleAccept = async () => {
    if (!invitation?.id) {
      setError(isSpanish ? 'ID de invitación no válido' : 'Invalid invitation ID');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      console.log('📝 Enviando respuesta ACEPTAR para invitación:', invitation.id);
      
      const result = await respondToInvitation(invitation.id, { 
        accept: true, 
        conflictOfInterest: conflict.trim() || (isSpanish ? 'Ninguno' : 'None')
      });
      
      if (result?.success) {
        console.log('✅ Respuesta enviada correctamente');
        setResponseSent(true);
      } else {
        console.log('❌ Error en respuesta:', result?.error);
        setError(result?.error || (isSpanish ? 'Error al procesar respuesta' : 'Error processing response'));
      }
    } catch (err) {
      console.error('❌ Error aceptando invitación:', err);
      setError(isSpanish ? 'Error al aceptar la invitación' : 'Error accepting invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!invitation?.id) {
      setError(isSpanish ? 'ID de invitación no válido' : 'Invalid invitation ID');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      console.log('📝 Enviando respuesta RECHAZAR para invitación:', invitation.id);
      
      const result = await respondToInvitation(invitation.id, { 
        accept: false 
      });
      
      if (result?.success) {
        console.log('✅ Respuesta enviada correctamente');
        setResponseSent(true);
      } else {
        console.log('❌ Error en respuesta:', result?.error);
        setError(result?.error || (isSpanish ? 'Error al procesar respuesta' : 'Error processing response'));
      }
    } catch (err) {
      console.error('❌ Error rechazando invitación:', err);
      setError(isSpanish ? 'Error al rechazar la invitación' : 'Error declining invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Renderizado condicional ---
  if (loading || hookLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#C0A86A] border-t-[#0A1929] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#5A6B7A] font-['Lora']">
            {isSpanish ? 'Cargando invitación...' : 'Loading invitation...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="font-['Playfair_Display'] text-2xl font-bold text-[#0A1929] mb-2">
            {isSpanish ? 'Error' : 'Error'}
          </h1>
          <p className="text-[#5A6B7A] font-['Lora'] mb-6">{error}</p>
          <a
            href={language === 'es' ? '/' : '/en'}
            className="inline-block px-6 py-3 bg-[#0A1929] text-white rounded-xl font-['Playfair_Display'] font-bold hover:bg-[#1E2F40] transition-colors"
          >
            {isSpanish ? 'Volver al inicio' : 'Back to home'}
          </a>
        </div>
      </div>
    );
  }

  if (responseSent) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-['Playfair_Display'] text-2xl font-bold text-[#0A1929] mb-2">
            {isSpanish ? '¡Respuesta recibida!' : 'Response received!'}
          </h1>
          <p className="text-[#5A6B7A] font-['Lora']">
            {isSpanish 
              ? 'Gracias por tu respuesta. El equipo editorial será notificado.'
              : 'Thank you for your response. The editorial team will be notified.'}
          </p>
        </motion.div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <p className="text-[#5A6B7A] font-['Lora']">
            {isSpanish ? 'Invitación no disponible' : 'Invitation not available'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[#F5F7FA] py-12 px-4"
    >
      <div className="max-w-3xl mx-auto">
        {/* Selector de idioma */}
        <div className="flex justify-end mb-4">
          <div className="flex bg-white rounded-xl shadow-sm p-1 border border-[#E5E9F0]">
            <button
              onClick={() => handleLanguageChange('es')}
              className={`px-4 py-2 rounded-lg text-xs font-['Playfair_Display'] font-semibold transition-all ${
                language === 'es' 
                  ? 'bg-[#0A1929] text-white' 
                  : 'text-[#5A6B7A] hover:text-[#0A1929]'
              }`}
            >
              ESPAÑOL
            </button>
            <button
              onClick={() => handleLanguageChange('en')}
              className={`px-4 py-2 rounded-lg text-xs font-['Playfair_Display'] font-semibold transition-all ${
                language === 'en' 
                  ? 'bg-[#0A1929] text-white' 
                  : 'text-[#5A6B7A] hover:text-[#0A1929]'
              }`}
            >
              ENGLISH
            </button>
          </div>
        </div>

        {/* Tarjeta principal */}
        <div className="bg-white rounded-2xl shadow-xl border border-[#E5E9F0] overflow-hidden">
          {/* Cabecera con patrón académico */}
          <div className="bg-[#0A1929] px-8 py-6">
            <h1 className="font-['Playfair_Display'] text-3xl font-bold text-white mb-2">
              {isSpanish ? 'Invitación a Revisión por Pares' : 'Peer Review Invitation'}
            </h1>
            <p className="text-[#C0A86A] font-['Lora'] text-lg">
              {isSpanish 
                ? 'Revista Nacional de las Ciencias para Estudiantes'
                : 'The National Review of Sciences for Students'}
            </p>
          </div>

          <div className="p-8">
            <p className="text-[#5A6B7A] font-['Lora'] mb-8">
              {isSpanish 
                ? 'Has sido invitado a revisar el siguiente artículo:'
                : 'You have been invited to review the following article:'}
            </p>

            {submission && (
              <div className="bg-[#F5F7FA] rounded-xl p-6 mb-8 border border-[#E5E9F0]">
                <h2 className="font-['Playfair_Display'] text-xl font-bold text-[#0A1929] mb-3">
                  {submission.title}
                </h2>
                <p className="text-[#5A6B7A] font-['Lora'] text-sm mb-4 leading-relaxed">
                  {submission.abstract}
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm border-t border-[#E5E9F0] pt-4">
                  <div>
                    <span className="font-['Playfair_Display'] font-bold text-[#0A1929]">
                      {isSpanish ? 'Área:' : 'Area:'}
                    </span>
                    <span className="ml-2 text-[#5A6B7A] font-['Lora']">{submission.area}</span>
                  </div>
                  <div>
                    <span className="font-['Playfair_Display'] font-bold text-[#0A1929]">
                      {isSpanish ? 'Idioma:' : 'Language:'}
                    </span>
                    <span className="ml-2 text-[#5A6B7A] font-['Lora']">
                      {submission.paperLanguage === 'es' ? 'Español' : 'English'}
                    </span>
                  </div>
                </div>
                {submission.driveFolderUrl && (
                  <div className="mt-4">
                    <a 
                      href={submission.driveFolderUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-[#C0A86A] hover:text-[#A58D4F] font-medium transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {isSpanish ? 'Ver documentos' : 'View documents'}
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Conflicto de intereses */}
            <div className="mb-8">
              <label className="block font-['Playfair_Display'] font-bold text-[#0A1929] mb-3">
                {isSpanish ? 'Conflicto de Intereses' : 'Conflict of Interest'}
              </label>
              <textarea
                value={conflict}
                onChange={(e) => setConflict(e.target.value)}
                rows="4"
                className="w-full p-4 bg-[#F5F7FA] border border-[#E5E9F0] rounded-xl focus:ring-2 focus:ring-[#C0A86A] focus:border-transparent font-['Lora'] text-sm"
                placeholder={isSpanish 
                  ? 'Declara cualquier conflicto de interés (o escribe "Ninguno")' 
                  : 'Declare any conflict of interest (or write "None")'}
              />
              <p className="text-xs text-[#5A6B7A] mt-2 font-['Lora']">
                {isSpanish 
                  ? 'Ejemplo: "Soy coinvestigador en el mismo proyecto" o "Ninguno"'
                  : 'Example: "I am co-investigator in the same project" or "None"'}
              </p>
            </div>

            {/* Botones de acción */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleAccept}
                disabled={hookLoading || isSubmitting || !invitation}
                className="py-4 bg-[#C0A86A] hover:bg-[#A58D4F] text-white font-['Playfair_Display'] font-bold rounded-xl transition-all disabled:bg-[#E5E9F0] disabled:text-[#5A6B7A] disabled:cursor-not-allowed"
              >
                {hookLoading || isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {isSpanish ? 'PROCESANDO...' : 'PROCESSING...'}
                  </span>
                ) : (
                  isSpanish ? 'ACEPTAR' : 'ACCEPT'
                )}
              </button>
              <button
                onClick={handleDecline}
                disabled={hookLoading || isSubmitting || !invitation}
                className="py-4 border-2 border-[#0A1929] text-[#0A1929] font-['Playfair_Display'] font-bold rounded-xl hover:bg-[#0A1929] hover:text-white transition-all disabled:border-[#E5E9F0] disabled:text-[#5A6B7A] disabled:hover:bg-transparent disabled:cursor-not-allowed"
              >
                {isSpanish ? 'RECHAZAR' : 'DECLINE'}
              </button>
            </div>

            {/* Nota de confidencialidad */}
            <p className="mt-6 text-xs text-[#5A6B7A] text-center font-['Lora']">
              {isSpanish 
                ? 'Al aceptar, te comprometes a mantener la confidencialidad del manuscrito y a proporcionar una revisión objetiva y constructiva.'
                : 'By accepting, you agree to maintain confidentiality and provide an objective and constructive review.'}
            </p>

            {/* Información de expiración si existe */}
            {invitation?.expiresAt && (
              <p className="mt-4 text-xs text-[#C0A86A] text-center font-['Lora']">
                {isSpanish 
                  ? `Esta invitación expira el ${new Date(invitation.expiresAt).toLocaleDateString('es-CL')}`
                  : `This invitation expires on ${new Date(invitation.expiresAt).toLocaleDateString('en-US')}`}
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ReviewerResponsePage;