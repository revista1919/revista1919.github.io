// src/components/ExternalReviewerInvite.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  EnvelopeIcon, 
  UserPlusIcon, 
  AcademicCapIcon,
  CheckCircleIcon,
  XCircleIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
  TagIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as SolidCheck } from '@heroicons/react/24/solid';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { useLanguage } from '../hooks/useLanguage';

const ExternalReviewerInviteModal = ({ 
  isOpen, 
  onClose, 
  submissionId, 
  currentUser,
  onSuccess 
}) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  
  // ================= TEXTOS BILINGÜES =================
  const texts = {
    title: isSpanish ? 'Invitar Revisor Externo' : 'Invite External Reviewer',
    subtitle: isSpanish ? 'Extienda una invitación formal a un colega o experto académico' : 'Extend a formal invitation to a colleague or academic expert',
    fullNameRequired: isSpanish ? 'Nombre completo *' : 'Full name *',
    emailRequired: isSpanish ? 'Email institucional *' : 'Institutional email *',
    institution: isSpanish ? 'Institución de afiliación' : 'Affiliated institution',
    position: isSpanish ? 'Cargo académico' : 'Academic position',
    area: isSpanish ? 'Área de especialidad' : 'Area of expertise',
    message: isSpanish ? 'Mensaje adjunto (opcional)' : 'Attached message (optional)',
    messagePlaceholder: isSpanish ? 'Redacte un mensaje personal para el revisor...' : 'Draft a personal message for the reviewer...',
    cancel: isSpanish ? 'Cancelar' : 'Cancel',
    send: isSpanish ? 'Extender Invitación' : 'Extend Invitation',
    sending: isSpanish ? 'Procesando...' : 'Processing...',
    successTitle: isSpanish ? 'Invitación Oficial Enviada' : 'Official Invitation Sent',
    successMessage: isSpanish ? 'El experto recibirá una notificación formal con las credenciales de acceso al portal.' : 'The expert will receive a formal notification with portal access credentials.',
    nameError: isSpanish ? 'El nombre y el correo electrónico son campos obligatorios.' : 'Name and email are required fields.',
    emailError: isSpanish ? 'El formato del correo institucional es inválido.' : 'The institutional email format is invalid.',
    generalError: isSpanish ? 'Se produjo un error al emitir la invitación.' : 'An error occurred while issuing the invitation.',
    namePlaceholder: isSpanish ? 'Ej: Dr. Juan Pérez' : 'e.g., Dr. John Smith',
    emailPlaceholder: isSpanish ? 'Ej: juan.perez@universidad.edu' : 'e.g., john.smith@university.edu',
    institutionPlaceholder: isSpanish ? 'Ej: Universidad de Chile' : 'e.g., University of Oxford',
    positionPlaceholder: isSpanish ? 'Ej: Profesor Titular' : 'e.g., Full Professor',
    areaPlaceholder: isSpanish ? 'Ej: Biología Molecular' : 'e.g., Molecular Biology'
  };

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    institution: '',
    position: '',
    area: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Reset del formulario cuando se cierra el modal
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      institution: '',
      position: '',
      area: '',
      message: ''
    });
    setError('');
    setSuccess(false);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validaciones
    if (!formData.name.trim() || !formData.email.trim()) {
      setError(texts.nameError);
      return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError(texts.emailError);
      return;
    }

    setIsSubmitting(true);

    try {
      const createExternalInvitation = httpsCallable(
        functions, 
        'createExternalReviewerInvitation'
      );
      
      const result = await createExternalInvitation({
        submissionId,
        reviewerName: formData.name.trim(),
        reviewerEmail: formData.email.trim().toLowerCase(),
        institution: formData.institution.trim(),
        position: formData.position.trim(),
        area: formData.area.trim(),
        message: formData.message.trim(),
        language: language, // Enviar idioma actual
        invitedBy: {
          name: currentUser.displayName,
          email: currentUser.email,
          uid: currentUser.uid
        }
      });

      if (result.data.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.(result.data.invitationId);
          onClose();
          resetForm();
        }, 2500);
      } else {
        throw new Error(result.data.error || texts.generalError);
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || texts.generalError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            
            {success ? (
              // ESTADO DE ÉXITO (Diseño Editorial Majestic)
              <div className="bg-gradient-to-br from-[#003b5c] to-[#001f30] p-16 text-center relative overflow-hidden rounded-2xl">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-5 rounded-full blur-3xl"></div>
                <motion.div 
                  initial={{ scale: 0 }} 
                  animate={{ scale: 1 }} 
                  transition={{ type: "spring", stiffness: 200, damping: 15 }} 
                  className="mb-6"
                >
                  <SolidCheck className="w-24 h-24 text-white/90 mx-auto drop-shadow-lg" />
                </motion.div>
                <h3 className="text-3xl font-serif font-light text-white mb-3 tracking-tight">
                  {texts.successTitle}
                </h3>
                <p className="text-slate-300 text-sm font-sans tracking-wide max-w-md mx-auto leading-relaxed">
                  {texts.successMessage}
                </p>
              </div>
            ) : (
              // FORMULARIO PRINCIPAL
              <>
                {/* Cabecera */}
                <div className="border-b border-slate-100 p-8 sm:px-10 sm:pt-10 sm:pb-8 bg-slate-50/50 relative overflow-hidden rounded-t-2xl">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#003b5c] to-[#e86125]" />
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-xl shadow-sm ring-1 ring-slate-200">
                      <UserPlusIcon className="w-6 h-6 text-[#003b5c]" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-serif text-[#003b5c] font-medium">
                        {texts.title}
                      </h2>
                      <p className="text-slate-500 text-sm mt-1">
                        {texts.subtitle}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cuerpo del Formulario */}
                <form onSubmit={handleSubmit} className="p-8 sm:p-10 space-y-8">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="group">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 transition-colors group-focus-within:text-[#003b5c]">
                        {texts.fullNameRequired}
                      </label>
                      <div className="relative">
                        <AcademicCapIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#003b5c] transition-colors" />
                        <input 
                          type="text" 
                          value={formData.name} 
                          onChange={(e) => setFormData({...formData, name: e.target.value})} 
                          placeholder={texts.namePlaceholder} 
                          required
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border-0 ring-1 ring-slate-200 rounded-xl text-sm font-sans text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#003b5c] transition-all shadow-sm" 
                        />
                      </div>
                    </div>

                    <div className="group">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 transition-colors group-focus-within:text-[#003b5c]">
                        {texts.emailRequired}
                      </label>
                      <div className="relative">
                        <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#003b5c] transition-colors" />
                        <input 
                          type="email" 
                          value={formData.email} 
                          onChange={(e) => setFormData({...formData, email: e.target.value})} 
                          placeholder={texts.emailPlaceholder} 
                          required
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border-0 ring-1 ring-slate-200 rounded-xl text-sm font-sans text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#003b5c] transition-all shadow-sm" 
                        />
                      </div>
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
                          placeholder={texts.institutionPlaceholder}
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
                          placeholder={texts.positionPlaceholder}
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border-0 ring-1 ring-slate-200 rounded-xl text-sm font-sans text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#003b5c] transition-all shadow-sm" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="group">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 transition-colors group-focus-within:text-[#003b5c]">
                      {texts.area}
                    </label>
                    <div className="relative">
                      <TagIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#003b5c] transition-colors" />
                      <input 
                        type="text" 
                        value={formData.area} 
                        onChange={(e) => setFormData({...formData, area: e.target.value})} 
                        placeholder={texts.areaPlaceholder}
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border-0 ring-1 ring-slate-200 rounded-xl text-sm font-sans text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#003b5c] transition-all shadow-sm" 
                      />
                    </div>
                  </div>

                  <div className="group">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 transition-colors group-focus-within:text-[#003b5c]">
                      {texts.message}
                    </label>
                    <textarea 
                      value={formData.message} 
                      onChange={(e) => setFormData({...formData, message: e.target.value})} 
                      placeholder={texts.messagePlaceholder} 
                      rows="3"
                      className="w-full p-4 bg-slate-50/50 border-0 ring-1 ring-slate-200 rounded-xl text-sm font-sans text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#003b5c] transition-all shadow-sm resize-none leading-relaxed" 
                    />
                  </div>

                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="bg-red-50 border-l-4 border-red-500 p-4 text-sm text-red-700 font-medium flex items-center gap-3"
                    >
                      <XCircleIcon className="w-5 h-5 flex-shrink-0" />
                      <p>{error}</p>
                    </motion.div>
                  )}

                  {/* Botonera */}
                  <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3 mt-8">
                    <button 
                      type="button" 
                      onClick={handleClose} 
                      disabled={isSubmitting}
                      className="px-6 py-3.5 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-xl tracking-wide hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {texts.cancel}
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="px-8 py-3.5 bg-[#003b5c] text-white rounded-xl font-bold text-sm tracking-wide hover:bg-[#00273f] hover:shadow-lg hover:shadow-[#003b5c]/20 transition-all flex items-center gap-2 disabled:bg-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {texts.sending}
                        </>
                      ) : (
                        <>
                          <EnvelopeIcon className="w-4 h-4" />
                          {texts.send}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExternalReviewerInviteModal;