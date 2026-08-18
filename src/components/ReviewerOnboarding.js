// src/components/ReviewerOnboarding.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  CheckCircleIcon, 
  LockClosedIcon,
  XCircleIcon,
  ArrowRightIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
  CalendarIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as SolidCheck } from '@heroicons/react/24/solid';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { useLanguage } from '../hooks/useLanguage';

const ReviewerOnboarding = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const { language, setLanguage } = useLanguage();
  const isSpanish = language === 'es';
  
  // ================= ESTADOS DEL FLUJO =================
  const [step, setStep] = useState(1);
  const [invitationData, setInvitationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    institution: '',
    position: '',
    area: '',
    password: '',
    confirmPassword: '',
    availability: 'medium',
    maxReviews: 2,
    interests: [],
    reviewedBefore: null,
    orcid: ''
  });

  // ================= TEXTOS BILINGÜES =================
  const texts = {
    verifying: isSpanish ? 'Autenticando credenciales...' : 'Authenticating credentials...',
    invalidToken: isSpanish ? 'El token de acceso es inválido o ha expirado.' : 'Invalid or expired access token.',
    invitationInvalid: isSpanish ? 'Invitación no válida' : 'Invalid invitation',
    backHome: isSpanish ? 'Retornar al inicio' : 'Return to home',
    stepAccount: isSpanish ? 'Credenciales' : 'Credentials',
    stepProfile: isSpanish ? 'Perfil Académico' : 'Academic Profile',
    stepReview: isSpanish ? 'Completado' : 'Completed',
    
    // Paso 1
    step1Title: isSpanish ? 'Integración al Comité Revisor' : 'Editorial Board Integration',
    step1Subtitle: isSpanish ? 'Verifique su identidad académica y establezca sus credenciales de acceso.' : 'Verify your academic identity and establish your access credentials.',
    fullName: isSpanish ? 'Nombre completo' : 'Full name',
    email: isSpanish ? 'Correo institucional' : 'Institutional email',
    institution: isSpanish ? 'Institución de afiliación' : 'Affiliated institution',
    position: isSpanish ? 'Cargo académico' : 'Academic position',
    password: isSpanish ? 'Contraseña de acceso *' : 'Access password *',
    passwordPlaceholder: isSpanish ? 'Mínimo 6 caracteres' : 'Minimum 6 characters',
    confirmPassword: isSpanish ? 'Confirmar contraseña *' : 'Confirm password *',
    passwordError: isSpanish ? 'La contraseña requiere un mínimo de 6 caracteres.' : 'Password requires a minimum of 6 characters.',
    passwordMismatch: isSpanish ? 'Las contraseñas ingresadas no coinciden.' : 'The entered passwords do not match.',
    createAccount: isSpanish ? 'Guardar credenciales y continuar' : 'Save credentials and continue',
    
    // Paso 2
    step2Title: isSpanish ? 'Configuración de Par Evaluador' : 'Peer Reviewer Configuration',
    step2Subtitle: isSpanish ? 'Defina sus parámetros de disponibilidad para la asignación de manuscritos.' : 'Define your availability parameters for manuscript assignment.',
    availability: isSpanish ? 'Capacidad de revisión anual estimada' : 'Estimated annual review capacity',
    low: isSpanish ? 'Ocasional' : 'Occasional',
    lowDesc: isSpanish ? '1-2 revisiones/año' : '1-2 reviews/year',
    medium: isSpanish ? 'Regular' : 'Regular',
    mediumDesc: isSpanish ? '3-5 revisiones/año' : '3-5 reviews/year',
    high: isSpanish ? 'Frecuente' : 'Frequent',
    highDesc: isSpanish ? '6+ revisiones/año' : '6+ reviews/year',
    maxReviews: isSpanish ? 'Carga máxima de manuscritos simultáneos' : 'Maximum concurrent manuscripts load',
    reviewsLabel: isSpanish ? 'manuscritos' : 'manuscripts',
    previousExperience: isSpanish ? '¿Posee experiencia previa en revisión por pares (Peer Review)?' : 'Do you have previous Peer Review experience?',
    yesReviewed: isSpanish ? 'Sí, poseo experiencia' : 'Yes, I have experience',
    firstTime: isSpanish ? 'No, será mi primera vez' : 'No, this is my first time',
    saveProfile: isSpanish ? 'Consolidar perfil' : 'Consolidate profile',
    
    // Paso 3
    step3Title: isSpanish ? 'Registro Exitoso' : 'Successful Registration',
    step3Message: isSpanish ? 'Su perfil como par evaluador ha sido incorporado oficialmente a nuestros registros. Ya puede acceder al manuscrito asignado.' : 'Your peer reviewer profile has been officially incorporated into our records. You may now access the assigned manuscript.',
    goToReview: isSpanish ? 'Acceder al Centro de Evaluación' : 'Access Evaluation Center',
    
    // Errores
    errorVerifying: isSpanish ? 'Error de conexión al verificar la invitación.' : 'Connection error verifying invitation.',
    errorCreating: isSpanish ? 'Error en el sistema al procesar la cuenta.' : 'System error processing account.',
    errorSaving: isSpanish ? 'Error al guardar los metadatos del perfil.' : 'Error saving profile metadata.'
  };

  // ================= LÓGICA DE DATOS =================
  useEffect(() => {
    const loadInvitation = async () => {
      if (!token) {
        setError(texts.invalidToken);
        setLoading(false);
        return;
      }

      try {
        const verifyToken = httpsCallable(functions, 'verifyReviewerToken');
        const result = await verifyToken({ token });
        
        if (result.data.success) {
          setInvitationData(result.data.invitation);
          // Pre-rellenar formulario
          setFormData(prev => ({
            ...prev,
            name: result.data.invitation.prefillData?.name || '',
            email: result.data.invitation.prefillData?.email || '',
            institution: result.data.invitation.prefillData?.institution || '',
            position: result.data.invitation.prefillData?.position || '',
            area: result.data.invitation.prefillData?.area || ''
          }));
        } else {
          setError(result.data.error || texts.invalidToken);
        }
      } catch (err) {
        console.error('Error verificando token:', err);
        setError(texts.errorVerifying);
      } finally {
        setLoading(false);
      }
    };

    loadInvitation();
  }, [token, language]);

  // Paso 1: Crear cuenta
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (formData.password.length < 6) {
      setError(texts.passwordError);
      setIsSubmitting(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(texts.passwordMismatch);
      setIsSubmitting(false);
      return;
    }

    try {
      const completeOnboarding = httpsCallable(functions, 'completeReviewerOnboarding');
      const result = await completeOnboarding({
        token,
        ...formData,
        language: language
      });

      if (result.data.success) {
        setStep(2);
      } else {
        setError(result.data.error || texts.errorCreating);
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || texts.errorCreating);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Paso 2: Configurar perfil
  const handleProfileSetup = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    try {
      const saveProfile = httpsCallable(functions, 'saveReviewerProfile');
      const result = await saveProfile({
        token,
        profile: {
          availability: formData.availability,
          maxReviews: formData.maxReviews,
          interests: formData.interests,
          reviewedBefore: formData.reviewedBefore,
          orcid: formData.orcid
        },
        language: language
      });

      if (result.data.success) {
        setStep(3);
      } else {
        setError(result.data.error || texts.errorSaving);
      }
    } catch (err) {
      console.error('Error guardando perfil:', err);
      setError(texts.errorSaving);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Paso 3: Ir al panel
  const handleGoToReview = () => {
    navigate(`/reviewer-workspace/${invitationData.submissionId}`);
  };

  // Cambiar idioma
  const handleLanguageToggle = () => {
    setLanguage(isSpanish ? 'en' : 'es');
  };

  // ================= COMPONENTES UI =================
  const LanguageToggle = () => (
    <button
      onClick={handleLanguageToggle}
      className="fixed top-6 right-6 z-50 bg-white/80 backdrop-blur-md border border-slate-200 rounded-full py-2 px-4 shadow-sm hover:shadow-md transition-all flex items-center gap-2 text-[#003b5c]"
    >
      <GlobeAltIcon className="w-4 h-4" />
      <span className="text-xs font-bold tracking-widest">{isSpanish ? 'EN' : 'ES'}</span>
    </button>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <LanguageToggle />
        <div className="text-center space-y-6">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-[#003b5c] rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="text-slate-500 font-serif italic text-lg">{texts.verifying}</p>
        </div>
      </div>
    );
  }

  if (error && !invitationData) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <LanguageToggle />
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-10 text-center ring-1 ring-slate-100">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircleIcon className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-serif text-[#003b5c] mb-3">{texts.invitationInvalid}</h2>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed font-sans">{error}</p>
          <button 
            onClick={() => navigate('/')} 
            className="px-8 py-3.5 bg-[#003b5c] text-white rounded-xl font-bold text-sm tracking-wide hover:bg-[#00273f] transition-all w-full shadow-md"
          >
            {texts.backHome}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-16 px-4 font-sans selection:bg-[#003b5c] selection:text-white">
      <LanguageToggle />
      
      <div className="max-w-3xl mx-auto">
        {/* STEPPER ACADÉMICO */}
        <div className="mb-14 relative px-8">
          <div className="absolute top-5 left-16 right-16 h-0.5 bg-slate-200 -z-10 rounded-full"></div>
          <div 
            className="absolute top-5 left-16 h-0.5 bg-[#003b5c] -z-10 transition-all duration-700 ease-out rounded-full" 
            style={{ width: `${((step - 1) / 2) * 100}%` }}
          ></div>
          
          <div className="flex justify-between">
            {[
              { id: 1, title: texts.stepAccount },
              { id: 2, title: texts.stepProfile },
              { id: 3, title: texts.stepReview }
            ].map((s) => {
              const isActive = step === s.id;
              const isPast = step > s.id;
              return (
                <div key={s.id} className="flex flex-col items-center gap-3 relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 shadow-sm ring-4 ring-[#F8FAFC]
                    ${isActive ? 'bg-[#003b5c] text-white scale-110 shadow-md' : isPast ? 'bg-[#003b5c] text-white' : 'bg-white text-slate-400 border border-slate-300'}`}>
                    {isPast ? <SolidCheck className="w-5 h-5" /> : <span className="font-bold text-sm">{s.id}</span>}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest text-center transition-colors duration-300
                    ${isActive ? 'text-[#003b5c]' : isPast ? 'text-slate-700' : 'text-slate-400'}`}>
                    {s.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-100 overflow-hidden">
          <AnimatePresence mode="wait">
            
            {/* PASO 1: CREDENCIALES */}
            {step === 1 && (
              <motion.div 
                key="step1" 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="border-b border-slate-100 p-8 sm:px-12 sm:pt-12 sm:pb-8 bg-slate-50/50">
                  <h2 className="text-3xl font-serif text-[#003b5c] font-medium">{texts.step1Title}</h2>
                  <p className="text-slate-500 text-sm mt-2">{texts.step1Subtitle}</p>
                </div>

                <form onSubmit={handleCreateAccount} className="p-8 sm:p-12 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="group">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 transition-colors group-focus-within:text-[#003b5c]">
                        {texts.fullName}
                      </label>
                      <div className="relative">
                        <AcademicCapIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#003b5c] transition-colors" />
                        <input 
                          type="text" 
                          value={formData.name} 
                          onChange={(e) => setFormData({...formData, name: e.target.value})} 
                          required
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border-0 ring-1 ring-slate-200 rounded-xl text-sm font-sans text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#003b5c] transition-all shadow-sm" 
                        />
                      </div>
                    </div>
                    <div className="group">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                        {texts.email}
                      </label>
                      <input 
                        type="email" 
                        value={formData.email} 
                        disabled
                        className="w-full px-4 py-3.5 bg-slate-100 border-0 ring-1 ring-slate-200 rounded-xl text-sm font-sans text-slate-500 cursor-not-allowed" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="group">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 transition-colors group-focus-within:text-[#003b5c]">
                        {texts.institution}
                      </label>
                      <div className="relative">
                        <BuildingOfficeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#003b5c] transition-colors" />
                        <input 
                          type="text" 
                          value={formData.institution} 
                          onChange={(e) => setFormData({...formData, institution: e.target.value})}
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border-0 ring-1 ring-slate-200 rounded-xl text-sm font-sans text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#003b5c] transition-all shadow-sm" 
                        />
                      </div>
                    </div>
                    <div className="group">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 transition-colors group-focus-within:text-[#003b5c]">
                        {texts.position}
                      </label>
                      <div className="relative">
                        <BriefcaseIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#003b5c] transition-colors" />
                        <input 
                          type="text" 
                          value={formData.position} 
                          onChange={(e) => setFormData({...formData, position: e.target.value})}
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border-0 ring-1 ring-slate-200 rounded-xl text-sm font-sans text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#003b5c] transition-all shadow-sm" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="group">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 transition-colors group-focus-within:text-[#003b5c]">
                        {texts.password}
                      </label>
                      <div className="relative">
                        <LockClosedIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#003b5c] transition-colors" />
                        <input 
                          type="password" 
                          value={formData.password} 
                          onChange={(e) => setFormData({...formData, password: e.target.value})} 
                          placeholder={texts.passwordPlaceholder} 
                          required
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border-0 ring-1 ring-slate-200 rounded-xl text-sm font-sans text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#003b5c] transition-all shadow-sm" 
                        />
                      </div>
                    </div>
                    <div className="group">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 transition-colors group-focus-within:text-[#003b5c]">
                        {texts.confirmPassword}
                      </label>
                      <input 
                        type="password" 
                        value={formData.confirmPassword} 
                        onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})} 
                        required
                        className="w-full px-4 py-3.5 bg-slate-50/50 border-0 ring-1 ring-slate-200 rounded-xl text-sm font-sans text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#003b5c] transition-all shadow-sm" 
                      />
                    </div>
                  </div>

                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="bg-red-50 border-l-4 border-red-500 p-4 text-sm text-red-700 font-medium"
                    >
                      {error}
                    </motion.div>
                  )}

                  <div className="pt-4 flex justify-end">
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="px-8 py-3.5 bg-[#003b5c] text-white rounded-xl font-bold text-sm tracking-wide hover:bg-[#00273f] hover:shadow-lg hover:shadow-[#003b5c]/20 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          {isSpanish ? 'Procesando...' : 'Processing...'}
                        </>
                      ) : (
                        <>
                          {texts.createAccount} <ArrowRightIcon className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* PASO 2: PERFIL ACADÉMICO */}
            {step === 2 && (
              <motion.div 
                key="step2" 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="border-b border-slate-100 p-8 sm:px-12 sm:pt-12 sm:pb-8 bg-slate-50/50">
                  <h2 className="text-3xl font-serif text-[#003b5c] font-medium">{texts.step2Title}</h2>
                  <p className="text-slate-500 text-sm mt-2">{texts.step2Subtitle}</p>
                </div>

                <form onSubmit={handleProfileSetup} className="p-8 sm:p-12 space-y-10">
                  
                  {/* Disponibilidad (Tarjetas Editoriales) */}
                  <div>
                    <label className="block text-sm font-serif font-bold text-[#003b5c] mb-4">
                      {texts.availability}
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { value: 'low', label: texts.low, desc: texts.lowDesc },
                        { value: 'medium', label: texts.medium, desc: texts.mediumDesc },
                        { value: 'high', label: texts.high, desc: texts.highDesc }
                      ].map(option => {
                        const isSelected = formData.availability === option.value;
                        return (
                          <button 
                            key={option.value} 
                            type="button" 
                            onClick={() => setFormData({...formData, availability: option.value})}
                            className={`p-5 text-left rounded-xl border transition-all duration-300 relative overflow-hidden group
                              ${isSelected ? 'border-[#003b5c] bg-[#003b5c]/5 shadow-md' : 'border-slate-200 hover:border-[#003b5c]/30 hover:bg-slate-50'}`}
                          >
                            {isSelected && <div className="absolute top-0 left-0 w-1 h-full bg-[#003b5c]" />}
                            <div className={`font-bold text-sm tracking-wide mb-1 transition-colors ${isSelected ? 'text-[#003b5c]' : 'text-slate-700 group-hover:text-[#003b5c]'}`}>
                              {option.label}
                            </div>
                            <div className="text-xs text-slate-500 font-sans">{option.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Máximo de Revisiones */}
                  <div className="bg-slate-50 rounded-xl p-6 ring-1 ring-slate-100">
                    <label className="block text-sm font-serif font-bold text-[#003b5c] mb-4">
                      {texts.maxReviews}
                    </label>
                    <div className="flex items-center gap-6">
                      <input 
                        type="range" 
                        min="1" 
                        max="5" 
                        value={formData.maxReviews} 
                        onChange={(e) => setFormData({...formData, maxReviews: parseInt(e.target.value)})}
                        className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#003b5c]" 
                      />
                      <div className="bg-white px-4 py-2 rounded-lg ring-1 ring-slate-200 shadow-sm text-center min-w-[120px]">
                        <span className="text-xl font-bold text-[#003b5c]">{formData.maxReviews}</span>
                        <span className="text-xs text-slate-500 block">{texts.reviewsLabel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Experiencia */}
                  <div>
                    <label className="block text-sm font-serif font-bold text-[#003b5c] mb-4">
                      {texts.previousExperience}
                    </label>
                    <div className="flex flex-col sm:flex-row gap-4">
                      {[
                        { val: true, label: texts.yesReviewed },
                        { val: false, label: texts.firstTime }
                      ].map((opt, i) => {
                        const isSelected = formData.reviewedBefore === opt.val;
                        return (
                          <button 
                            key={i} 
                            type="button" 
                            onClick={() => setFormData({...formData, reviewedBefore: opt.val})}
                            className={`flex-1 py-4 rounded-xl border text-sm font-semibold tracking-wide transition-all
                              ${isSelected ? 'border-[#003b5c] bg-[#003b5c] text-white shadow-md' : 'border-slate-200 text-slate-600 hover:border-[#003b5c]/30 hover:bg-slate-50'}`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="bg-red-50 border-l-4 border-red-500 p-4 text-sm text-red-700 font-medium"
                    >
                      {error}
                    </motion.div>
                  )}

                  <div className="pt-4 flex justify-end border-t border-slate-100 mt-8">
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="px-8 py-3.5 bg-[#e86125] text-white rounded-xl font-bold text-sm tracking-wide hover:bg-[#c9521d] hover:shadow-lg hover:shadow-[#e86125]/20 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          {isSpanish ? 'Procesando...' : 'Processing...'}
                        </>
                      ) : (
                        <>
                          {texts.saveProfile} <ArrowRightIcon className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* PASO 3: ÉXITO */}
            {step === 3 && (
              <motion.div 
                key="step3" 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="text-center"
              >
                <div className="bg-gradient-to-br from-[#003b5c] to-[#001f30] p-16 relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-5 rounded-full blur-3xl"></div>
                  <SolidCheck className="w-24 h-24 text-white/90 mx-auto mb-6 drop-shadow-lg" />
                  <h2 className="text-4xl font-serif font-light text-white mb-4 tracking-tight">
                    {texts.step3Title}
                  </h2>
                  <p className="text-slate-300 text-sm font-sans tracking-wide max-w-md mx-auto leading-relaxed">
                    {texts.step3Message}
                  </p>
                </div>
                
                <div className="p-12 bg-white">
                  <button 
                    onClick={handleGoToReview} 
                    className="px-10 py-4 bg-gradient-to-r from-[#003b5c] to-[#005282] text-white rounded-xl font-bold text-sm tracking-wide hover:shadow-xl hover:shadow-[#003b5c]/30 transition-all active:scale-95 flex items-center gap-3 mx-auto"
                  >
                    <DocumentTextIcon className="w-5 h-5" />
                    {texts.goToReview}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ReviewerOnboarding;