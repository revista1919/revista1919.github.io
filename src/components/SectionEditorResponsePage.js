// src/components/SectionEditorResponsePage.js
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import { useSectionEditorInvitation } from '../hooks/useSectionEditorInvitation';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

const SectionEditorResponsePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hash = searchParams.get('hash');
  const urlLang = searchParams.get('lang') || 'es';
  
  const { language, switchLanguage } = useLanguage();
  const isSpanish = language === 'es';

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [responseSent, setResponseSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const { getInvitationByHash, respondToInvitation } = useSectionEditorInvitation(null);

  // Sincronizar idioma
  useEffect(() => {
    if (urlLang && urlLang !== language && (urlLang === 'es' || urlLang === 'en')) {
      switchLanguage(urlLang);
    }
  }, [urlLang, language, switchLanguage]);

  useEffect(() => {
    const loadInvitation = async () => {
      if (!hash) {
        setError(isSpanish ? 'Enlace de invitación inválido' : 'Invalid invitation link');
        setLoading(false);
        return;
      }

      try {
        const result = await getInvitationByHash(hash);
        if (result?.success && result?.found) {
          setInvitation(result.data);
        } else {
          setError(result?.error || (isSpanish ? 'Invitación no encontrada' : 'Invitation not found'));
        }
      } catch (err) {
        console.error('Error cargando invitación:', err);
        setError(isSpanish ? 'Error al cargar la invitación' : 'Error loading invitation');
      } finally {
        setLoading(false);
      }
    };

    loadInvitation();
  }, [hash, getInvitationByHash, isSpanish]);

  const handleAccept = async () => {
    if (!invitation?.id) return;

    // Si el usuario no está logueado, mostrar login
    if (!auth.currentUser) {
      setShowLogin(true);
      return;
    }

    await processResponse(true);
  };

  const processResponse = async (accept) => {
    setIsSubmitting(true);
    setLoginError('');

    try {
      const result = await respondToInvitation(invitation.id, accept);
      
      if (result?.success) {
        setResponseSent(true);
      } else {
        setError(result?.error || (isSpanish ? 'Error al procesar respuesta' : 'Error processing response'));
      }
    } catch (err) {
      console.error('Error:', err);
      setError(isSpanish ? 'Error al procesar respuesta' : 'Error processing response');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      setShowLogin(false);
      await processResponse(true);
    } catch (err) {
      console.error('Login error:', err);
      setLoginError(isSpanish 
        ? 'Credenciales inválidas' 
        : 'Invalid credentials');
    }
  };

  const handleDecline = async () => {
    if (!invitation?.id) return;
    await processResponse(false);
  };

  if (loading) {
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
          <button
            onClick={() => navigate('/')}
            className="inline-block px-6 py-3 bg-[#0A1929] text-white rounded-xl font-['Playfair_Display'] font-bold hover:bg-[#1E2F40] transition-colors"
          >
            {isSpanish ? 'Volver al inicio' : 'Back to home'}
          </button>
        </div>
      </div>
    );
  }

  if (responseSent) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
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
          <button
            onClick={() => navigate('/')}
            className="mt-6 px-6 py-3 bg-[#0A1929] text-white rounded-xl font-['Playfair_Display'] font-bold hover:bg-[#1E2F40] transition-colors"
          >
            {isSpanish ? 'Volver al inicio' : 'Back to home'}
          </button>
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
        {/* Tarjeta principal */}
        <div className="bg-white rounded-2xl shadow-xl border border-[#E5E9F0] overflow-hidden">
          <div className="bg-[#0A1929] px-8 py-6">
            <h1 className="font-['Playfair_Display'] text-3xl font-bold text-white mb-2">
              {isSpanish ? 'Invitación a Editor de Sección' : 'Section Editor Invitation'}
            </h1>
            <p className="text-[#C0A86A] font-['Lora'] text-lg">
              {isSpanish 
                ? 'Revista Nacional de las Ciencias para Estudiantes'
                : 'The National Review of Sciences for Students'}
            </p>
          </div>

          <div className="p-8">
            {showLogin ? (
              // Formulario de login
              <div className="mb-8">
                <h2 className="font-['Playfair_Display'] text-xl font-bold text-[#0A1929] mb-4">
                  {isSpanish ? 'Inicia sesión para aceptar' : 'Login to accept'}
                </h2>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#0A1929] mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full p-3 bg-[#F5F7FA] border border-[#E5E9F0] rounded-xl focus:ring-2 focus:ring-[#C0A86A] focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#0A1929] mb-1">
                      {isSpanish ? 'Contraseña' : 'Password'}
                    </label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full p-3 bg-[#F5F7FA] border border-[#E5E9F0] rounded-xl focus:ring-2 focus:ring-[#C0A86A] focus:border-transparent"
                      required
                    />
                  </div>
                  {loginError && (
                    <p className="text-red-600 text-sm">{loginError}</p>
                  )}
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-[#0A1929] text-white rounded-xl font-['Playfair_Display'] font-bold hover:bg-[#1E2F40] transition-colors"
                    >
                      {isSpanish ? 'INICIAR SESIÓN' : 'LOGIN'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLogin(false)}
                      className="px-4 py-3 border border-[#E5E9F0] text-[#5A6B7A] rounded-xl hover:bg-[#F5F7FA] transition-colors"
                    >
                      {isSpanish ? 'Cancelar' : 'Cancel'}
                    </button>
                  </div>
                </form>
                <p className="mt-4 text-sm text-[#5A6B7A] text-center">
                  {isSpanish 
                    ? '¿No tienes cuenta? Debes crear una cuenta con el mismo email al que recibiste la invitación.'
                    : 'Don\'t have an account? You need to create an account with the same email you received the invitation.'}
                </p>
              </div>
            ) : (
              <>
                {/* Detalles de la invitación */}
                <div className="mb-8">
                  <p className="text-[#5A6B7A] font-['Lora'] mb-4">
                    {isSpanish 
                      ? 'Has sido invitado a unirte al equipo editorial como Editor de Sección:'
                      : 'You have been invited to join the editorial team as Section Editor:'}
                  </p>

                  <div className="bg-[#F5F7FA] rounded-xl p-6 border border-[#E5E9F0]">
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <span className="font-['Playfair_Display'] font-bold text-[#0A1929] block mb-1">
                          {isSpanish ? 'Área:' : 'Area:'}
                        </span>
                        <span className="text-[#5A6B7A] font-['Lora']">
                          {invitation?.canHandleAllAreas 
                            ? (isSpanish ? 'Todas las áreas' : 'All areas')
                            : invitation?.area}
                        </span>
                      </div>
                      
                      <div>
                        <span className="font-['Playfair_Display'] font-bold text-[#0A1929] block mb-1">
                          {isSpanish ? 'Invitado por:' : 'Invited by:'}
                        </span>
                        <span className="text-[#5A6B7A] font-['Lora']">
                          {invitation?.invitedByEmail}
                        </span>
                      </div>

                      <div>
                        <span className="font-['Playfair_Display'] font-bold text-[#0A1929] block mb-1">
                          {isSpanish ? 'Fecha de invitación:' : 'Invitation date:'}
                        </span>
                        <span className="text-[#5A6B7A] font-['Lora']">
                          {invitation?.createdAt?.toLocaleDateString()}
                        </span>
                      </div>

                      <div>
                        <span className="font-['Playfair_Display'] font-bold text-[#0A1929] block mb-1">
                          {isSpanish ? 'Expira:' : 'Expires:'}
                        </span>
                        <span className="text-[#5A6B7A] font-['Lora']">
                          {invitation?.expiresAt?.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Responsabilidades */}
                <div className="mb-8">
                  <h3 className="font-['Playfair_Display'] font-bold text-[#0A1929] mb-3">
                    {isSpanish ? 'Responsabilidades:' : 'Responsibilities:'}
                  </h3>
                  <ul className="list-disc list-inside space-y-2 text-[#5A6B7A] font-['Lora']">
                    <li>{isSpanish 
                      ? 'Realizar revisión editorial inicial de artículos' 
                      : 'Perform initial editorial review of articles'}</li>
                    <li>{isSpanish 
                      ? 'Decidir sobre aceptación, rechazo o envío a revisión por pares' 
                      : 'Decide on acceptance, rejection, or sending to peer review'}</li>
                    <li>{isSpanish 
                      ? 'Seleccionar y gestionar revisores' 
                      : 'Select and manage reviewers'}</li>
                    <li>{isSpanish 
                      ? 'Tomar decisiones finales en su área' 
                      : 'Make final decisions in your area'}</li>
                  </ul>
                </div>

                {/* Botones de acción */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={handleAccept}
                    disabled={isSubmitting}
                    className="py-4 bg-[#C0A86A] hover:bg-[#A58D4F] text-white font-['Playfair_Display'] font-bold rounded-xl transition-all disabled:bg-[#E5E9F0] disabled:text-[#5A6B7A]"
                  >
                    {isSubmitting ? (
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
                    disabled={isSubmitting}
                    className="py-4 border-2 border-[#0A1929] text-[#0A1929] font-['Playfair_Display'] font-bold rounded-xl hover:bg-[#0A1929] hover:text-white transition-all disabled:border-[#E5E9F0] disabled:text-[#5A6B7A] disabled:hover:bg-transparent"
                  >
                    {isSpanish ? 'RECHAZAR' : 'DECLINE'}
                  </button>
                </div>

                <p className="mt-6 text-xs text-[#5A6B7A] text-center font-['Lora']">
                  {isSpanish 
                    ? 'Al aceptar, obtendrás acceso al panel editorial para gestionar artículos en tu área.'
                    : 'By accepting, you will get access to the editorial panel to manage articles in your area.'}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SectionEditorResponsePage;