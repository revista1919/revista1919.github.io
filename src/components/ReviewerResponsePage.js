// src/components/ReviewerResponsePage.js
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import { useReviewerInvitation } from '../hooks/useReviewerInvitation';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const ReviewerResponsePage = () => {
  const [searchParams] = useSearchParams();
  const hash = searchParams.get('hash');
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  const [invitation, setInvitation] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState('');
  const [responseSent, setResponseSent] = useState(false);

  const { getInvitationByHash, respondToInvitation, loading: hookLoading } = useReviewerInvitation(null); // Pasamos null porque el user puede no estar logueado

  useEffect(() => {
    const loadInvitation = async () => {
      if (!hash) {
        setError(isSpanish ? 'Enlace de invitación inválido' : 'Invalid invitation link');
        setLoading(false);
        return;
      }

      const result = await getInvitationByHash(hash);
      if (result.success && result.found) {
        setInvitation(result.data);
        // Cargar detalles del artículo
        const submissionDoc = await getDoc(doc(db, 'submissions', result.data.submissionId));
        if (submissionDoc.exists()) {
          setSubmission(submissionDoc.data());
        }
      } else {
        setError(result.error || (isSpanish ? 'Invitación no encontrada' : 'Invitation not found'));
      }
      setLoading(false);
    };

    loadInvitation();
  }, [hash, getInvitationByHash, isSpanish]);

  const handleAccept = async () => {
    const result = await respondToInvitation(invitation.id, { accept: true, conflictOfInterest: conflict });
    if (result.success) {
      setResponseSent(true);
    } else {
      setError(result.error);
    }
  };

  const handleDecline = async () => {
    const result = await respondToInvitation(invitation.id, { accept: false });
    if (result.success) {
      setResponseSent(true);
    } else {
      setError(result.error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">{isSpanish ? 'Cargando invitación...' : 'Loading invitation...'}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-sm p-8 max-w-md text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="font-serif text-2xl font-bold text-gray-900 mb-2">
            {isSpanish ? 'Error' : 'Error'}
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-gray-900 text-white rounded-xl font-bold"
          >
            {isSpanish ? 'Volver al inicio' : 'Back to home'}
          </a>
        </div>
      </div>
    );
  }

  if (responseSent) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-sm p-8 max-w-md text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-serif text-2xl font-bold text-gray-900 mb-2">
            {isSpanish ? '¡Respuesta recibida!' : 'Response received!'}
          </h1>
          <p className="text-gray-600">
            {isSpanish 
              ? 'Gracias por tu respuesta. El equipo editorial será notificado.'
              : 'Thank you for your response. The editorial team will be notified.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[#fafafa] py-12 px-4"
    >
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-12">
        <h1 className="font-serif text-3xl font-bold text-gray-900 mb-2">
          {isSpanish ? 'Invitación a Revisión por Pares' : 'Peer Review Invitation'}
        </h1>
        <p className="text-gray-500 mb-8">
          {isSpanish 
            ? 'Has sido invitado a revisar el siguiente artículo para la Revista Nacional de las Ciencias para Estudiantes.'
            : 'You have been invited to review the following article for The National Review of Sciences for Students.'}
        </p>

        {submission && (
          <div className="bg-gray-50 rounded-2xl p-6 mb-8">
            <h2 className="font-serif text-xl font-bold text-gray-900 mb-3">
              {submission.title}
            </h2>
            <p className="text-sm text-gray-600 mb-4 line-clamp-4">
              {submission.abstract}
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-bold text-gray-700">{isSpanish ? 'Área:' : 'Area:'}</span>
                <span className="ml-2 text-gray-600">{submission.area}</span>
              </div>
              <div>
                <span className="font-bold text-gray-700">{isSpanish ? 'Idioma:' : 'Language:'}</span>
                <span className="ml-2 text-gray-600">
                  {submission.paperLanguage === 'es' ? 'Español' : 'English'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6 mb-8">
          <div>
            <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
              {isSpanish ? 'Conflicto de Intereses' : 'Conflict of Interest'}
            </label>
            <textarea
              value={conflict}
              onChange={(e) => setConflict(e.target.value)}
              rows="4"
              className="w-full p-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-emerald-300 text-sm"
              placeholder={isSpanish 
                ? 'Declara cualquier conflicto de interés (o escribe "Ninguno")' 
                : 'Declare any conflict of interest (or write "None")'}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleAccept}
              disabled={hookLoading}
              className="py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all disabled:bg-emerald-300"
            >
              {hookLoading ? (
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
              disabled={hookLoading}
              className="py-4 border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-bold rounded-2xl transition-all disabled:bg-gray-100"
            >
              {isSpanish ? 'RECHAZAR' : 'DECLINE'}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">
          {isSpanish 
            ? 'Al aceptar, te comprometes a mantener la confidencialidad del manuscrito y a proporcionar una revisión objetiva y constructiva dentro del plazo establecido.'
            : 'By accepting, you agree to maintain the confidentiality of the manuscript and to provide an objective and constructive review within the established deadline.'}
        </p>
      </div>
    </motion.div>
  );
};

export default ReviewerResponsePage;