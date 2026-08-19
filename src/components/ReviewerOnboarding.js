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
  GlobeAltIcon,
  CheckBadgeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ShieldCheckIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as SolidCheck } from '@heroicons/react/24/solid';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { useLanguage } from '../hooks/useLanguage';

// ============================================================
// ÁREAS TEMÁTICAS (Mismas que en ReviewerProfilePanel)
// ============================================================
const AREAS_TEMATICAS = {
  es: {
    "Ciencias Exactas y Naturales": [
      "Matemáticas", "Física", "Química", "Biología", "Geología",
      "Astronomía y Astrofísica", "Ciencias Ambientales y Ecología",
      "Oceanografía", "Meteorología y Ciencias Atmosféricas", "Paleontología"
    ],
    "Ciencias de la Salud": [
      "Medicina General e Interna", "Salud Pública y Epidemiología",
      "Enfermería", "Nutrición y Dietética", "Farmacología y Farmacia",
      "Odontología", "Kinesiología y Fisioterapia", "Tecnología Médica y Bioanálisis", "Veterinaria"
    ],
    "Ingeniería y Tecnología": [
      "Ingeniería Civil", "Ingeniería Industrial y de Sistemas",
      "Ingeniería Mecánica", "Ingeniería Eléctrica y Electrónica",
      "Ingeniería Química y Biotecnología", "Ingeniería en Computación e Informática",
      "Ciencia de Datos e Inteligencia Artificial", "Robótica y Automatización",
      "Ingeniería de Materiales y Nanotecnología", "Ingeniería Aeroespacial", "Energías Renovables y Sostenibilidad"
    ],
    "Ciencias Sociales": [
      "Sociología", "Antropología y Arqueología", "Psicología",
      "Economía y Negocios", "Ciencias Políticas y Relaciones Internacionales",
      "Derecho", "Geografía Humana y Ordenamiento Territorial",
      "Estudios de Género", "Comunicación Social y Periodismo",
      "Educación y Pedagogía", "Trabajo Social"
    ],
    "Humanidades": [
      "Historia", "Filosofía", "Lingüística y Filología", "Literatura",
      "Estudios Clásicos", "Teología y Ciencias de la Religión",
      "Estudios Culturales", "Arte, Música y Cine", "Arquitectura y Urbanismo"
    ],
    "Ciencias Agropecuarias": [
      "Agronomía y Producción Agrícola", "Ciencias Forestales",
      "Acuicultura y Pesca", "Zootecnia y Producción Animal", "Ingeniería de Alimentos"
    ]
  },
  en: {
    "Exact and Natural Sciences": [
      "Mathematics", "Physics", "Chemistry", "Biology", "Geology",
      "Astronomy and Astrophysics", "Environmental Sciences and Ecology",
      "Oceanography", "Meteorology and Atmospheric Sciences", "Paleontology"
    ],
    "Health Sciences": [
      "General and Internal Medicine", "Public Health and Epidemiology",
      "Nursing", "Nutrition and Dietetics", "Pharmacology and Pharmacy",
      "Dentistry", "Kinesiology and Physical Therapy",
      "Medical Technology and Bioanalysis", "Veterinary Medicine"
    ],
    "Engineering and Technology": [
      "Civil Engineering", "Industrial and Systems Engineering",
      "Mechanical Engineering", "Electrical and Electronic Engineering",
      "Chemical Engineering and Biotechnology", "Computer Science and Informatics",
      "Data Science and Artificial Intelligence", "Robotics and Automation",
      "Materials Science and Nanotechnology", "Aerospace Engineering",
      "Renewable Energies and Sustainability"
    ],
    "Social Sciences": [
      "Sociology", "Anthropology and Archaeology", "Psychology",
      "Economics and Business", "Political Science and International Relations",
      "Law", "Human Geography and Land Planning",
      "Gender Studies", "Social Communication and Journalism",
      "Education and Pedagogy", "Social Work"
    ],
    "Humanities": [
      "History", "Philosophy", "Linguistics and Philology", "Literature",
      "Classical Studies", "Theology and Religious Studies",
      "Cultural Studies", "Art, Music and Film", "Architecture and Urbanism"
    ],
    "Agricultural Sciences": [
      "Agronomy and Agricultural Production", "Forestry Sciences",
      "Aquaculture and Fisheries", "Animal Science and Production", "Food Engineering"
    ]
  }
};

const MAX_EXPERTISE_AREAS = 5;

const ReviewerOnboarding = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const { language, setLanguage } = useLanguage();
  const isSpanish = language === 'es';
  
  // ================= ESTADOS DEL FLUJO =================
  const [step, setStep] = useState(1);
  const [invitationData, setInvitationData] = useState(null);
  const [assignmentId, setAssignmentId] = useState(null); // ✅ NUEVO: Capturar assignmentId
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);
  
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
    interests: [], // Áreas de expertise seleccionadas
    reviewedBefore: null,
    orcid: '',
    preferredLanguage: 'es',
    timeAvailablePerReview: '2-weeks',
    status: 'active',
    statusReason: ''
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
    step2Subtitle: isSpanish ? 'Defina sus áreas de expertise y parámetros de disponibilidad.' : 'Define your areas of expertise and availability parameters.',
    expertiseTitle: isSpanish ? 'Áreas de Especialización' : 'Areas of Expertise',
    expertiseSubtitle: isSpanish ? 'Seleccione hasta 5 áreas donde pueda evaluar manuscritos' : 'Select up to 5 areas where you can evaluate manuscripts',
    areasSelected: isSpanish ? 'áreas seleccionadas' : 'areas selected',
    limitReached: isSpanish ? 'Límite alcanzado' : 'Limit reached',
    selectAtLeastOne: isSpanish ? 'Seleccione al menos un área de especialización' : 'Select at least one area of expertise',
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
    profileReady: isSpanish ? 'Su perfil está listo' : 'Your profile is ready',
    
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
            area: result.data.invitation.prefillData?.area || '',
            preferredLanguage: result.data.invitation.language || 'es'
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

  // Toggle área de expertise
  const toggleExpertise = (area) => {
    setFormData(prev => {
      const current = [...prev.interests];
      const index = current.indexOf(area);
      
      if (index > -1) {
        current.splice(index, 1);
      } else {
        if (current.length >= MAX_EXPERTISE_AREAS) return prev; // Límite de 5
        current.push(area);
      }
      
      return { ...prev, interests: current };
    });
  };

  // Seleccionar todas las áreas de una categoría
  const selectAllInCategory = (categoryAreas) => {
    setFormData(prev => {
      const current = [...prev.interests];
      const allSelected = categoryAreas.every(area => current.includes(area));
      
      if (allSelected) {
        return { ...prev, interests: current.filter(area => !categoryAreas.includes(area)) };
      } else {
        categoryAreas.forEach(area => {
          if (!current.includes(area) && current.length < MAX_EXPERTISE_AREAS) {
            current.push(area);
          }
        });
        return { ...prev, interests: current };
      }
    });
  };

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
        // ✅ CAPTURAR EL ASSIGNMENT ID
        if (result.data.assignmentId) {
          setAssignmentId(result.data.assignmentId);
          console.log('✅ Assignment ID capturado:', result.data.assignmentId);
        }
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
    
    // Validar que haya al menos 1 área seleccionada
    if (formData.interests.length === 0) {
      setError(texts.selectAtLeastOne);
      setIsSubmitting(false);
      return;
    }
    
    try {
      const saveProfile = httpsCallable(functions, 'saveReviewerProfile');
      const result = await saveProfile({
        token,
        profile: {
          areasOfExpertise: formData.interests,
          availability: formData.availability,
          maxReviews: formData.maxReviews,
          reviewedBefore: formData.reviewedBefore,
          orcid: formData.orcid,
          preferredLanguage: formData.preferredLanguage,
          timeAvailablePerReview: '2-weeks',
          status: 'active',
          statusReason: ''
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

  // Paso 3: Ir al panel - ✅ CORREGIDO: Usar assignmentId
  const handleGoToReview = () => {
    if (assignmentId) {
      navigate(`/reviewer-workspace/${assignmentId}`);
    } else {
      // Fallback: ir al dashboard del revisor
      console.warn('⚠️ No se encontró assignmentId, redirigiendo al dashboard');
      navigate('/reviewer-dashboard');
    }
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

  const areasData = AREAS_TEMATICAS[language] || AREAS_TEMATICAS.es;

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
                <div className="border-b border-slate-100 p-8 sm:px-12 sm:pt-12 sm:pb-8 bg-gradient-to-br from-slate-50 to-white">
                  <div className="flex items-center gap-3 mb-2">
                    <ShieldCheckIcon className="w-8 h-8 text-[#003b5c]" />
                    <h2 className="text-3xl font-serif text-[#003b5c] font-medium">{texts.step1Title}</h2>
                  </div>
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
                      className="bg-red-50 border-l-4 border-red-500 p-4 text-sm text-red-700 font-medium rounded-r-lg"
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

            {/* PASO 2: PERFIL ACADÉMICO CON ÁREAS DE EXPERTISE */}
            {step === 2 && (
              <motion.div 
                key="step2" 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="border-b border-slate-100 p-8 sm:px-12 sm:pt-12 sm:pb-8 bg-gradient-to-br from-slate-50 to-white">
                  <div className="flex items-center gap-3 mb-2">
                    <SparklesIcon className="w-8 h-8 text-[#e86125]" />
                    <h2 className="text-3xl font-serif text-[#003b5c] font-medium">{texts.step2Title}</h2>
                  </div>
                  <p className="text-slate-500 text-sm mt-2">{texts.step2Subtitle}</p>
                </div>

                <form onSubmit={handleProfileSetup} className="p-8 sm:p-12 space-y-10">
                  
                  {/* ============ ÁREAS DE ESPECIALIZACIÓN ============ */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-serif font-bold text-[#003b5c]">
                          {texts.expertiseTitle}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {texts.expertiseSubtitle}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                        formData.interests.length >= MAX_EXPERTISE_AREAS 
                          ? 'bg-orange-50 text-orange-600 border border-orange-200' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {formData.interests.length} / {MAX_EXPERTISE_AREAS} {texts.areasSelected}
                      </span>
                    </div>

                    {/* Contenedor de categorías */}
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {Object.entries(areasData).map(([category, areas]) => {
                        const selectedInCategory = areas.filter(area => formData.interests.includes(area)).length;
                        const allSelectedInCategory = areas.every(area => formData.interests.includes(area));
                        const isExpanded = expandedCategory === category;
                        
                        return (
                          <div key={category} className="border border-slate-200 rounded-lg overflow-hidden transition-all duration-200 hover:border-[#003b5c]/30">
                            {/* Header de categoría */}
                            <button
                              type="button"
                              onClick={() => setExpandedCategory(isExpanded ? null : category)}
                              className="w-full px-4 py-3 flex items-center justify-between text-left bg-slate-50 hover:bg-slate-100 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-serif font-semibold text-sm text-[#003b5c]">{category}</span>
                                {selectedInCategory > 0 && (
                                  <span className="text-[10px] bg-[#003b5c] text-white font-bold px-2 py-0.5 rounded-full">
                                    {selectedInCategory}
                                  </span>
                                )}
                              </div>
                              {isExpanded ? (
                                <ChevronUpIcon className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronDownIcon className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                            
                            {/* Áreas de la categoría */}
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="p-4 bg-white"
                              >
                                <button
                                  type="button"
                                  onClick={() => selectAllInCategory(areas)}
                                  className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#003b5c] hover:text-[#e86125] transition-colors flex items-center gap-2"
                                >
                                  <CheckBadgeIcon className="w-4 h-4" />
                                  {allSelectedInCategory 
                                    ? (isSpanish ? 'Deseleccionar todas' : 'Deselect all') 
                                    : (isSpanish ? 'Seleccionar todas' : 'Select all')}
                                </button>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {areas.map(area => {
                                    const isSelected = formData.interests.includes(area);
                                    const isDisabled = !isSelected && formData.interests.length >= MAX_EXPERTISE_AREAS;
                                    
                                    return (
                                      <button
                                        key={area}
                                        type="button"
                                        onClick={() => toggleExpertise(area)}
                                        disabled={isDisabled}
                                        className={`flex items-start gap-2.5 p-2.5 rounded-lg text-xs text-left transition-all border ${
                                          isSelected
                                            ? 'bg-[#003b5c]/5 border-[#003b5c]/30 text-[#003b5c] font-medium shadow-sm'
                                            : isDisabled
                                            ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed'
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-[#003b5c]/30 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                                          isSelected 
                                            ? 'bg-[#003b5c] border-[#003b5c]' 
                                            : isDisabled 
                                            ? 'border-slate-200 bg-slate-100' 
                                            : 'border-slate-300'
                                        }`}>
                                          {isSelected && (
                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                            </svg>
                                          )}
                                        </span>
                                        <span>{area}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Separador elegante */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-white px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {isSpanish ? 'Disponibilidad' : 'Availability'}
                      </span>
                    </div>
                  </div>

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
                      className="bg-red-50 border-l-4 border-red-500 p-4 text-sm text-red-700 font-medium rounded-r-lg"
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
                  <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-white opacity-5 rounded-full blur-3xl"></div>
                  
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                  >
                    <SolidCheck className="w-24 h-24 text-white/90 mx-auto mb-6 drop-shadow-lg" />
                  </motion.div>
                  
                  <h2 className="text-4xl font-serif font-light text-white mb-4 tracking-tight">
                    {texts.step3Title}
                  </h2>
                  <p className="text-slate-300 text-sm font-sans tracking-wide max-w-md mx-auto leading-relaxed">
                    {texts.step3Message}
                  </p>
                  
                  {assignmentId && (
                    <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full border border-white/20">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      <span className="text-xs text-white/80 font-medium">
                        {texts.profileReady}
                      </span>
                    </div>
                  )}
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

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #F8FAFC;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94A3B8;
        }
      `}</style>
    </div>
  );
};

export default ReviewerOnboarding;