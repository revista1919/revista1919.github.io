import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '../firebase';
import { useLanguage } from '../hooks/useLanguage';

// Componente de Tooltip/Cápsula explicativa (estilo Oxford)
const HelpCapsule = ({ text, textEn }) => {
  const [show, setShow] = useState(false);
  const { language } = useLanguage();
  const displayText = language === 'es' ? text : textEn;

  return (
    <div className="relative inline-block ml-1.5 align-middle">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="w-4 h-4 rounded-full border border-zinc-300 text-zinc-400 text-xs flex items-center justify-center hover:border-[#0A1929] hover:text-[#0A1929] hover:bg-[#E5E9F0] transition-all duration-200 font-serif"
        aria-label="Ayuda"
      >
        i
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            className="absolute z-50 bottom-full mb-3 left-1/2 -translate-x-1/2 w-72 p-4 bg-[#0A1929] text-white text-xs rounded-2xl shadow-2xl leading-relaxed font-serif"
          >
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#0A1929]" />
            {displayText}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Componente para Keywords con chips (estilo Oxford)
const KeywordInput = ({ value, onChange, placeholder, label, helpText, helpTextEn }) => {
  const [inputValue, setInputValue] = useState('');
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const keywords = value ? value.split(';').filter(k => k.trim()) : [];

  const addKeyword = () => {
    if (inputValue.trim()) {
      const newKeywords = [...keywords, inputValue.trim()];
      onChange(newKeywords.join('; '));
      setInputValue('');
    }
  };

  const removeKeyword = (indexToRemove) => {
    const newKeywords = keywords.filter((_, index) => index !== indexToRemove);
    onChange(newKeywords.join('; '));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword();
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-[10px] font-mono font-semibold uppercase tracking-[0.125em] text-[#546E7A] flex items-center">
        {label}
        <HelpCapsule text={helpText} textEn={helpTextEn} />
      </label>

      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          className="flex-1 p-3.5 bg-white border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] focus:ring-1 focus:ring-[#0A1929] outline-none transition-all font-serif"
        />
        <button
          type="button"
          onClick={addKeyword}
          className="px-5 py-3 bg-[#E5E9F0] text-[#0A1929] rounded-2xl text-sm font-medium hover:bg-[#CCD4E0] transition-colors font-serif"
        >
          {isSpanish ? 'Agregar' : 'Add'}
        </button>
      </div>

      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#E5E9F0] text-[#0A1929] rounded-2xl text-xs font-medium font-serif"
            >
              {keyword}
              <button
                type="button"
                onClick={() => removeKeyword(index)}
                className="text-[#546E7A] hover:text-[#B22234] transition-colors"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// Componente para manejo de autores menores
const MinorConsentSection = ({ author, index, onUpdate }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const consentMethod = author.consentMethod || 'none';

  const consentUrls = {
    es: 'https://www.revistacienciasestudiantes.com/consent.pdf',
    en: 'https://www.revistacienciasestudiantes.com/consentEN.pdf'
  };

  const handleConsentChange = (method) => {
    onUpdate(index, 'consentMethod', method);
    if (method !== 'upload') {
      onUpdate(index, 'consentFile', null);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      onUpdate(index, 'consentFile', {
        name: file.name,
        data: reader.result.split(',')[1],
        type: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-6 pt-6 border-t border-[#E0E7E9] space-y-5 bg-[#F5F7FA] rounded-2xl p-5"
    >
      <div className="flex items-center gap-2 text-[#B22234]">
        <span className="text-lg">📋</span>
        <p className="text-sm font-medium font-serif">
          {isSpanish
            ? 'Autor menor de edad: se requiere consentimiento legal'
            : 'Minor author: legal guardian consent required'}
        </p>
      </div>

      {/* Nombre del tutor */}
      <div>
        <label className="block text-xs font-medium text-[#1A2B3C] mb-1.5 font-serif">
          {isSpanish ? 'Nombre completo del tutor legal *' : 'Legal guardian full name *'}
        </label>
        <input
          type="text"
          value={author.guardianName || ''}
          onChange={(e) => onUpdate(index, 'guardianName', e.target.value)}
          className="w-full p-3.5 bg-white border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
          placeholder={isSpanish ? 'Juan Pérez López' : 'John Doe Smith'}
        />
      </div>

      {/* Método de consentimiento */}
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-widest text-[#546E7A] font-mono">Método de consentimiento</p>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name={`consent-${index}`}
            value="email"
            checked={consentMethod === 'email'}
            onChange={() => handleConsentChange('email')}
            className="mt-0.5 w-4 h-4 text-[#0A1929]"
          />
          <div>
            <span className="text-sm text-[#1A2B3C] block font-serif">
              {isSpanish ? 'Enviar por correo electrónico' : 'Send by email'}
            </span>
            <span className="text-xs text-[#546E7A] font-serif">contact@revistacienciasestudiantes.com</span>
          </div>
        </label>

        {consentMethod === 'email' && (
          <div className="ml-7 p-4 bg-white border border-[#E0E7E9] rounded-xl text-xs text-[#1A2B3C] font-serif">
            {isSpanish ? (
              <>
                <p className="font-medium mb-2">El correo debe contener:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Nombre del autor menor</li>
                  <li>Nombre completo del tutor</li>
                  <li>Documento de identidad del tutor</li>
                  <li>Frase: "Autorizo la publicación en Revista Nacional de las Ciencias"</li>
                </ul>
              </>
            ) : (
              <>
                <p className="font-medium mb-2">Email must include:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Minor author name</li>
                  <li>Guardian full name</li>
                  <li>Guardian ID document</li>
                  <li>Phrase: "I authorize publication in National Review of Sciences"</li>
                </ul>
              </>
            )}
          </div>
        )}

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name={`consent-${index}`}
            value="upload"
            checked={consentMethod === 'upload'}
            onChange={() => handleConsentChange('upload')}
            className="mt-0.5 w-4 h-4 text-[#0A1929]"
          />
          <span className="text-sm text-[#1A2B3C] font-serif">
            {isSpanish ? 'Subir formulario firmado' : 'Upload signed form'}
          </span>
        </label>

        {consentMethod === 'upload' && (
          <div className="ml-7 space-y-4">
            <a
              href={consentUrls[language]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[#0A1929] hover:text-[#B22234] text-sm underline-offset-4 hover:underline font-serif"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v-4m0 0l4 4m-4-4l4-4m12 4v4m0-4l-4 4m4-4l-4-4" />
              </svg>
              {isSpanish ? 'Descargar formulario' : 'Download form'}
            </a>

            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileUpload}
              className="block w-full text-sm text-[#546E7A] file:mr-4 file:py-3 file:px-6 file:rounded-2xl file:border-0 file:text-sm file:font-medium file:bg-[#E5E9F0] file:text-[#0A1929] hover:file:bg-[#CCD4E0] font-serif"
            />

            {author.consentFile && (
              <div className="flex items-center gap-2 text-[#0A1929] text-xs font-serif">
                <span>✅</span>
                <span>{author.consentFile.name}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Componente principal COMPLETO - ESTILO OXFORD
export default function SubmissionForm({ user, onSuccess }) {
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  const [currentStep, setCurrentStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState('');
  const [driveFolderId, setDriveFolderId] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    titleEn: '',
    abstract: '',
    abstractEn: '',
    keywords: '',
    keywordsEn: '',
    area: '',
    paperLanguage: 'es',
    articleType: '',
    acknowledgments: '',

    authors: [{
      firstName: '',
      lastName: '',
      email: '',
      institution: '',
      orcid: '',
      contribution: '',
      isMinor: false,
      guardianName: '',
      consentMethod: 'none',
      consentFile: null,
      isCorresponding: true
    }],

    funding: {
      hasFunding: false,
      sources: '',
      grantNumbers: ''
    },

    conflictOfInterest: '',

    // NUEVO: Disponibilidad de datos y código
    dataAvailability: '',
    dataAvailabilityEn: '',
    codeAvailability: '',
    codeAvailabilityEn: '',

    declarations: {
      original: false,
      notSubmitted: false,
      dataAuthentic: false,
      informedConsent: false,
      aiDisclosure: false,
      conflicts: false,
      ccByLicense: false
    },

    excludedReviewers: '',
    manuscript: null,
    manuscriptName: ''
  });

  // Opciones de tipo de artículo
  const articleTypeOptions = {
    es: [
      { value: 'research', label: 'Artículo de Investigación Original' },
      { value: 'review', label: 'Artículo de Revisión Sistemática' },
      { value: 'short', label: 'Comunicación Corta' },
      { value: 'case', label: 'Reporte de Caso' },
      { value: 'letter', label: 'Carta al Editor' },
      { value: 'other', label: 'Otro (especificar)' }
    ],
    en: [
      { value: 'research', label: 'Original Research Article' },
      { value: 'review', label: 'Systematic Review Article' },
      { value: 'short', label: 'Short Communication' },
      { value: 'case', label: 'Case Report' },
      { value: 'letter', label: 'Letter to the Editor' },
      { value: 'other', label: 'Other (specify)' }
    ]
  };

  // Opciones para disponibilidad de datos y código
  const availabilityOptions = {
    es: [
      { value: 'public_repo', label: 'Disponible en repositorio público (enlace en el manuscrito)' },
      { value: 'upon_request', label: 'Disponible bajo solicitud razonable' },
      { value: 'not_available', label: 'No disponible (especificar razón)' },
      { value: 'supplementary', label: 'En material suplementario' }
    ],
    en: [
      { value: 'public_repo', label: 'Available in public repository (link in manuscript)' },
      { value: 'upon_request', label: 'Available upon reasonable request' },
      { value: 'not_available', label: 'Not available (specify reason)' },
      { value: 'supplementary', label: 'In supplementary material' }
    ]
  };

  // Persistencia de borrador
  useEffect(() => {
    const savedData = localStorage.getItem('submissionFormDraft');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData(prev => ({
          ...prev,
          ...parsed,
          manuscript: null,
          manuscriptName: ''
        }));
      } catch (e) {
        console.error('Error loading draft:', e);
      }
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const dataToSave = {
        ...formData,
        manuscript: null,
        manuscriptName: formData.manuscriptName
      };
      localStorage.setItem('submissionFormDraft', JSON.stringify(dataToSave));
    }, 30000);
    return () => clearInterval(interval);
  }, [formData]);

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
    });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAuthorChange = (index, field, value) => {
    const newAuthors = [...formData.authors];
    newAuthors[index][field] = value;
    setFormData(prev => ({ ...prev, authors: newAuthors }));
  };

  const addAuthor = () => {
    setFormData(prev => ({
      ...prev,
      authors: [...prev.authors, {
        firstName: '',
        lastName: '',
        email: '',
        institution: '',
        orcid: '',
        contribution: '',
        isMinor: false,
        guardianName: '',
        consentMethod: 'none',
        consentFile: null,
        isCorresponding: false
      }]
    }));
  };

  const removeAuthor = (index) => {
    if (formData.authors.length > 1) {
      const newAuthors = formData.authors.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, authors: newAuthors }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.match(/\.(doc|docx)$/i)) {
      alert(isSpanish ? 'Solo archivos Word (.doc, .docx)' : 'Only Word files (.doc, .docx)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert(isSpanish ? 'Máximo 10 MB' : 'Maximum 10 MB');
      return;
    }

    setFormData(prev => ({
      ...prev,
      manuscript: file,
      manuscriptName: file.name
    }));
  };

  const handleDeclarationChange = (key) => {
    setFormData(prev => ({
      ...prev,
      declarations: {
        ...prev.declarations,
        [key]: !prev.declarations[key]
      }
    }));
  };

  const allDeclarationsAccepted = () => Object.values(formData.declarations).every(Boolean);

  // VALIDACIÓN MEJORADA (incluye disponibilidad de datos en step3)
  const validateStep = (step) => {
    switch (step) {
      case 1:
        return formData.title.trim() &&
               formData.abstract.trim() &&
               formData.keywords.trim() &&
               formData.area.trim() &&
               formData.articleType;
      case 2:
        const basicOk = formData.authors.every(a =>
          a.firstName.trim() && a.lastName.trim() && a.email.trim() && a.institution.trim()
        );
        const minorsOk = formData.authors
          .filter(a => a.isMinor)
          .every(a =>
            a.guardianName.trim() &&
            a.consentMethod !== 'none' &&
            (a.consentMethod !== 'upload' || !!a.consentFile)
          );
        return basicOk && minorsOk;
      case 3:
        // Validación incluye disponibilidad de datos
        return allDeclarationsAccepted() && 
               formData.manuscript && 
               formData.dataAvailability.trim(); // Obligatorio declarar disponibilidad de datos
      default:
        return true;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep(3)) {
      alert(isSpanish ? 'Completa todos los campos requeridos, incluyendo disponibilidad de datos' : 'Complete all required fields, including data availability');
      return;
    }

    setUploading(true);
    setSubmitStatus(isSpanish ? 'Enviando artículo...' : 'Submitting article...');

    try {
      const token = await auth.currentUser.getIdToken();
      const manuscriptBase64 = await toBase64(formData.manuscript);

      const response = await fetch('https://submitarticle-ggqsq2kkua-uc.a.run.app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title,
          titleEn: formData.titleEn,
          abstract: formData.abstract,
          abstractEn: formData.abstractEn,
          keywords: formData.keywords,
          keywordsEn: formData.keywordsEn,
          area: formData.area,
          paperLanguage: formData.paperLanguage,
          articleType: formData.articleType,
          acknowledgments: formData.acknowledgments,

          // NUEVO: Disponibilidad de datos y código
          dataAvailability: formData.dataAvailability,
          dataAvailabilityEn: formData.dataAvailabilityEn,
          codeAvailability: formData.codeAvailability,
          codeAvailabilityEn: formData.codeAvailabilityEn,

          authors: formData.authors.map(a => ({
            firstName: a.firstName,
            lastName: a.lastName,
            email: a.email,
            institution: a.institution,
            orcid: a.orcid || null,
            contribution: a.contribution,
            isMinor: a.isMinor,
            guardianName: a.guardianName,
            isCorresponding: a.isCorresponding
          })),

          funding: formData.funding,
          conflictOfInterest: formData.conflictOfInterest,
          excludedReviewers: formData.excludedReviewers,

          minorAuthors: formData.authors
            .filter(a => a.isMinor)
            .map(a => ({
              name: `${a.firstName} ${a.lastName}`,
              guardianName: a.guardianName,
              consentMethod: a.consentMethod,
              consentFile: a.consentFile
            })),

          manuscriptBase64,
          manuscriptName: formData.manuscript.name,

          authorUID: user.uid,
          authorEmail: user.email,
          authorName: user.displayName || `${formData.authors[0].firstName} ${formData.authors[0].lastName}`.trim()
        })
      });

      if (!response.ok) throw new Error(await response.text());

      const result = await response.json();

      localStorage.removeItem('submissionFormDraft');
      setSubmissionId(result.submissionId);
      setDriveFolderId(result.driveFolderId); // NUEVO - guardar el ID de la carpeta
      setSubmitStatus(isSpanish ? '✅ Artículo enviado con éxito' : '✅ Article submitted successfully');
      setSubmitted(true);

      if (onSuccess) onSuccess(result.submissionId);

    } catch (error) {
      console.error('Error:', error);
      setSubmitStatus(isSpanish ? `❌ Error: ${error.message}` : `❌ Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    } else {
      alert(isSpanish ? 'Completa los campos requeridos antes de continuar' : 'Complete required fields before continuing');
    }
  };

  const prevStep = () => setCurrentStep(prev => prev - 1);

  const steps = [
    { id: 1, title: isSpanish ? 'INFORMACIÓN DEL ARTÍCULO' : 'ARTICLE INFORMATION' },
    { id: 2, title: isSpanish ? 'AUTORES Y ÉTICA' : 'AUTHORS & ETHICS' },
    { id: 3, title: isSpanish ? 'DATOS Y DECLARACIONES' : 'DATA & DECLARATIONS' }
  ];

  // Pantalla de éxito final (con información de carpetas)
  // Pantalla de éxito final (CORREGIDA)
if (submitted) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-2xl mx-auto py-16 px-4"
    >
      <div className="bg-white border border-[#E0E7E9] shadow-2xl rounded-3xl overflow-hidden">
        <div className="bg-[#0A1929] p-12 text-center">
          <div className="mx-auto w-24 h-24 bg-[#E5E9F0] rounded-full flex items-center justify-center mb-6">
            <span className="text-5xl">📮</span>
          </div>
          <h2 className="text-3xl font-light text-white mb-3 font-serif">
            {isSpanish ? '¡Gracias por tu envío!' : 'Thank you for your submission!'}
          </h2>
          <p className="text-[#E0E7E9] font-serif">
            {isSpanish
              ? 'Tu artículo ha sido recibido y será revisado por el equipo editorial.'
              : 'Your article has been received and will be reviewed by the editorial team.'}
          </p>
        </div>
        
        <div className="p-12 space-y-8">
          <div className="bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl p-6">
            <p className="text-xs font-mono text-[#546E7A] mb-2">SUBMISSION ID</p>
            <p className="text-2xl font-serif text-[#0A1929] tracking-wider">{submissionId}</p>
          </div>

          {/* SOLO UNA CARPETA - La del autor */}
          <div className="border border-[#E0E7E9] rounded-2xl p-8 hover:border-[#0A1929] transition-colors">
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 bg-[#E5E9F0] rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">📁</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-serif text-[#0A1929] mb-2">
                  {isSpanish ? 'Tu carpeta de documentos' : 'Your documents folder'}
                </h3>
                <p className="text-sm text-[#546E7A] mb-4 font-serif">
                  {isSpanish 
                    ? 'Aquí puedes ver los documentos que subiste (solo lectura)' 
                    : 'Here you can view the documents you uploaded (read-only)'}
                </p>
                <a 
                  href={`https://drive.google.com/drive/folders/${driveFolderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[#0A1929] text-sm font-medium hover:text-[#B22234] transition-colors"
                >
                  {isSpanish ? 'Abrir en Google Drive' : 'Open in Google Drive'} →
                </a>
              </div>
            </div>
          </div>

          {/* Información sobre seguimiento - REEMPLAZADO */}
          <div className="bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl p-8">
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 border border-[#E0E7E9]">
                <span className="text-3xl">📋</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-serif text-[#0A1929] mb-2">
                  {isSpanish ? 'Seguimiento del envío' : 'Submission tracking'}
                </h3>
                <p className="text-sm text-[#546E7A] mb-4 font-serif">
                  {isSpanish 
                    ? 'Puedes ver el estado de tu artículo en la pestaña "Mis envíos" del portal' 
                    : 'You can check your article status in the "My submissions" tab on the portal'}
                </p>
                <div className="inline-flex items-center gap-2 text-sm text-[#0A1929] font-medium">
                  <span className="text-[#B22234]">⬤</span>
                  {isSpanish ? 'Estado actual: Recibido' : 'Current status: Received'}
                </div>
              </div>
            </div>
          </div>

          <div className="text-center pt-6 border-t border-[#E0E7E9]">
            <p className="text-xs text-[#546E7A] font-serif">
              {isSpanish 
                ? 'Recibirás un correo con los detalles del envío' 
                : 'You will receive an email with submission details'}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto px-4 pb-20"
    >
      <div className="bg-white border border-[#E0E7E9] shadow-2xl shadow-[#0A1929]/5 rounded-3xl overflow-hidden">

        {/* Header estilo Oxford */}
        <div className="bg-[#0A1929] border-b border-[#1A2B3C] p-12 text-center">
          <div className="flex justify-center items-center gap-3 mb-4">
            <div className="h-px w-8 bg-[#B22234]" />
            <span className="uppercase text-[10px] font-mono tracking-[0.2em] text-[#E5E9F0]">Revista Nacional de las Ciencias para Estudiantes</span>
            <div className="h-px w-8 bg-[#B22234]" />
          </div>
          <h1 className="font-serif text-5xl font-light tracking-tight text-white">
            {isSpanish ? 'Envío de Manuscrito' : 'Manuscript Submission'}
          </h1>
          <p className="text-[#E0E7E9] text-sm mt-3 font-serif">Sistema seguro • Borrador guardado automáticamente</p>
        </div>

        {/* Stepper moderno */}
        <div className="px-8 py-7 bg-white border-b border-[#E0E7E9]">
          <div className="flex justify-between items-center relative">
            <div className="absolute top-5 left-0 w-full h-px bg-[#E0E7E9] z-0" />
            {steps.map((step, idx) => (
              <div key={step.id} className="relative z-10 flex flex-col items-center">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-mono text-base font-semibold transition-all shadow-sm
                  ${currentStep >= step.id
                    ? 'bg-[#0A1929] text-white'
                    : 'bg-white border-2 border-[#E0E7E9] text-[#546E7A]'}`}>
                  {step.id}
                </div>
                <span className={`mt-3 text-[10px] font-mono font-bold uppercase tracking-widest text-center max-w-[90px]
                  ${currentStep >= step.id ? 'text-[#0A1929]' : 'text-[#546E7A]'}`}>
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-16">

          <AnimatePresence mode="wait">
            {/* STEP 1 */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="space-y-12"
              >
                {/* Título */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-2">
                    {isSpanish ? 'Título del artículo' : 'Article title'} *
                    <HelpCapsule text="Claro, conciso y representativo. Máximo 20 palabras." textEn="Clear, concise and representative. Max 20 words." />
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-lg font-serif focus:border-[#0A1929] outline-none"
                    placeholder={isSpanish ? 'Ejemplo: Impacto de la inteligencia artificial...' : 'Example: Impact of artificial intelligence...'}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-2">
                    {isSpanish ? 'Título en inglés (recomendado)' : 'English title (recommended)'}
                  </label>
                  <input
                    type="text"
                    name="titleEn"
                    value={formData.titleEn}
                    onChange={handleInputChange}
                    className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-lg font-serif focus:border-[#0A1929] outline-none"
                  />
                </div>

                {/* Resumen */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-2">
                    {isSpanish ? 'Resumen' : 'Abstract'} *
                    <HelpCapsule text="Máximo 250 palabras. Estructurado: introducción, métodos, resultados, conclusiones." textEn="Max 250 words. Structured: introduction, methods, results, conclusions." />
                  </label>
                  <textarea
                    name="abstract"
                    value={formData.abstract}
                    onChange={handleInputChange}
                    required
                    rows={7}
                    className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-2">
                    {isSpanish ? 'Abstract en inglés' : 'English abstract'}
                  </label>
                  <textarea
                    name="abstractEn"
                    value={formData.abstractEn}
                    onChange={handleInputChange}
                    rows={7}
                    className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                  />
                </div>

                {/* Tipo de artículo */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-2">
                    {isSpanish ? 'Tipo de artículo' : 'Article type'} *
                  </label>
                  <select
                    name="articleType"
                    value={formData.articleType}
                    onChange={handleInputChange}
                    className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                  >
                    <option value="">— Selecciona tipo —</option>
                    {articleTypeOptions[isSpanish ? 'es' : 'en'].map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Keywords */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <KeywordInput
                    value={formData.keywords}
                    onChange={(val) => setFormData(prev => ({ ...prev, keywords: val }))}
                    label={isSpanish ? 'Palabras clave' : 'Keywords'}
                    placeholder={isSpanish ? 'educación; inteligencia artificial' : 'education; artificial intelligence'}
                    helpText="Mínimo 3, máximo 6. Separa con punto y coma."
                    helpTextEn="Minimum 3, maximum 6. Separate with semicolon."
                  />
                  <KeywordInput
                    value={formData.keywordsEn}
                    onChange={(val) => setFormData(prev => ({ ...prev, keywordsEn: val }))}
                    label={isSpanish ? 'Keywords en inglés' : 'English keywords'}
                    placeholder="education; artificial intelligence"
                    helpText="Recomendado para indexación internacional."
                    helpTextEn="Recommended for international indexing."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-2">
                      {isSpanish ? 'Área temática' : 'Subject area'} *
                    </label>
                    <input
                      type="text"
                      name="area"
                      value={formData.area}
                      onChange={handleInputChange}
                      required
                      className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                      placeholder={isSpanish ? 'Ciencias de la Educación' : 'Education Sciences'}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-2">
                      {isSpanish ? 'Idioma del manuscrito' : 'Manuscript language'} *
                    </label>
                    <select
                      name="paperLanguage"
                      value={formData.paperLanguage}
                      onChange={handleInputChange}
                      className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                    >
                      <option value="es">Español</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2 */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="space-y-14"
              >
                {/* Autores */}
                <div>
                  <h3 className="font-serif text-2xl font-light text-[#0A1929] mb-6 border-b border-[#E0E7E9] pb-4">
                    {isSpanish ? 'Autores' : 'Authors'}
                  </h3>

                  {formData.authors.map((author, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-8 bg-white border border-[#E0E7E9] rounded-3xl p-8 relative"
                    >
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => removeAuthor(index)}
                          className="absolute top-6 right-6 text-[#546E7A] hover:text-[#B22234]"
                        >
                          ✕
                        </button>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-xs text-[#546E7A] mb-1 block font-serif">Nombre *</label>
                          <input
                            type="text"
                            value={author.firstName}
                            onChange={(e) => handleAuthorChange(index, 'firstName', e.target.value)}
                            className="w-full p-3.5 border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[#546E7A] mb-1 block font-serif">Apellido *</label>
                          <input
                            type="text"
                            value={author.lastName}
                            onChange={(e) => handleAuthorChange(index, 'lastName', e.target.value)}
                            className="w-full p-3.5 border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="text-xs text-[#546E7A] mb-1 block font-serif">Correo electrónico *</label>
                          <input
                            type="email"
                            value={author.email}
                            onChange={(e) => handleAuthorChange(index, 'email', e.target.value)}
                            className="w-full p-3.5 border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="text-xs text-[#546E7A] mb-1 block font-serif">Institución / Afiliación *</label>
                          <input
                            type="text"
                            value={author.institution}
                            onChange={(e) => handleAuthorChange(index, 'institution', e.target.value)}
                            className="w-full p-3.5 border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="text-xs text-[#546E7A] mb-1 block flex items-center font-serif">
                            ORCID
                            <HelpCapsule text="0000-0000-0000-0000" textEn="0000-0000-0000-0000" />
                          </label>
                          <input
                            type="text"
                            value={author.orcid}
                            onChange={(e) => handleAuthorChange(index, 'orcid', e.target.value)}
                            placeholder="0000-0000-0000-0000"
                            className="w-full p-3.5 border border-[#E0E7E9] rounded-2xl text-sm font-mono focus:border-[#0A1929] outline-none"
                          />
                        </div>

                        {/* Contribución por autor */}
                        <div className="md:col-span-2">
                          <label className="text-xs text-[#546E7A] mb-1 block font-serif">
                            {isSpanish ? 'Contribución del autor (CRediT)' : 'Author contribution (CRediT)'}
                            <HelpCapsule
                              text="Describe el rol específico (Conceptualización, Metodología, Análisis, Escritura, etc.)"
                              textEn="Describe specific role (Conceptualization, Methodology, Analysis, Writing, etc.)"
                            />
                          </label>
                          <textarea
                            value={author.contribution}
                            onChange={(e) => handleAuthorChange(index, 'contribution', e.target.value)}
                            rows={2}
                            className="w-full p-3.5 border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                            placeholder={isSpanish ? 'Conceptualización, análisis de datos y redacción' : 'Conceptualization, data analysis and writing'}
                          />
                        </div>
                      </div>

                      {/* Menor de edad */}
                      <div className="mt-8 border-t border-[#E0E7E9] pt-6">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={author.isMinor}
                            onChange={(e) => {
                              handleAuthorChange(index, 'isMinor', e.target.checked);
                              if (!e.target.checked) {
                                handleAuthorChange(index, 'guardianName', '');
                                handleAuthorChange(index, 'consentMethod', 'none');
                                handleAuthorChange(index, 'consentFile', null);
                              }
                            }}
                            className="w-4 h-4 text-[#0A1929]"
                          />
                          <span className="text-sm text-[#1A2B3C] font-serif">
                            {isSpanish ? 'Este autor es menor de edad' : 'This author is a minor'}
                          </span>
                        </label>

                        {author.isMinor && (
                          <MinorConsentSection
                            author={author}
                            index={index}
                            onUpdate={handleAuthorChange}
                          />
                        )}
                      </div>

                      {/* Autor de correspondencia */}
                      <div className="mt-6">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={author.isCorresponding}
                            onChange={(e) => handleAuthorChange(index, 'isCorresponding', e.target.checked)}
                            className="w-4 h-4 text-[#0A1929]"
                          />
                          <span className="text-sm text-[#1A2B3C] font-serif">
                            {isSpanish ? 'Autor de correspondencia' : 'Corresponding author'}
                          </span>
                        </label>
                      </div>
                    </motion.div>
                  ))}

                  <button
                    type="button"
                    onClick={addAuthor}
                    className="w-full py-5 border-2 border-dashed border-[#E0E7E9] rounded-3xl text-[#546E7A] hover:text-[#0A1929] hover:border-[#0A1929] flex items-center justify-center gap-3 transition-all font-serif"
                  >
                    <span className="text-2xl">+</span>
                    {isSpanish ? 'Agregar otro autor' : 'Add another author'}
                  </button>
                </div>

                {/* Financiación */}
                <div className="space-y-6">
                  <h3 className="font-serif text-2xl font-light text-[#0A1929] border-b border-[#E0E7E9] pb-4">
                    {isSpanish ? 'Financiación' : 'Funding'}
                  </h3>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      name="funding.hasFunding"
                      checked={formData.funding.hasFunding}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-[#0A1929]"
                    />
                    <span className="text-sm text-[#1A2B3C] font-serif">
                      {isSpanish ? 'Este trabajo recibió financiación externa' : 'This work received external funding'}
                    </span>
                  </label>

                  {formData.funding.hasFunding && (
                    <div className="pl-8 space-y-6">
                      <div>
                        <label className="text-xs text-[#546E7A] mb-1 block font-serif">Fuentes</label>
                        <input
                          type="text"
                          name="funding.sources"
                          value={formData.funding.sources}
                          onChange={handleInputChange}
                          className="w-full p-3.5 border border-[#E0E7E9] rounded-2xl font-serif"
                          placeholder={isSpanish ? 'FONDECYT, ANID...' : 'NSF, NIH...'}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#546E7A] mb-1 block font-serif">Números de grant</label>
                        <input
                          type="text"
                          name="funding.grantNumbers"
                          value={formData.funding.grantNumbers}
                          onChange={handleInputChange}
                          className="w-full p-3.5 border border-[#E0E7E9] rounded-2xl font-serif"
                          placeholder="123456, 789012"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Conflicto de intereses */}
                <div>
                  <h3 className="font-serif text-2xl font-light text-[#0A1929] border-b border-[#E0E7E9] pb-4 flex items-center gap-2">
                    {isSpanish ? 'Conflicto de intereses' : 'Conflict of interest'}
                    <HelpCapsule
                      text="Declara cualquier relación que pueda influir en la interpretación de los resultados."
                      textEn="Declare any relationship that may influence the interpretation of results."
                    />
                  </h3>
                  <textarea
                    name="conflictOfInterest"
                    value={formData.conflictOfInterest}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full p-4 border border-[#E0E7E9] rounded-2xl text-sm mt-4 font-serif"
                    placeholder={isSpanish ? 'Los autores declaran no tener conflictos de interés.' : 'The authors declare no conflicts of interest.'}
                  />
                </div>
              </motion.div>
            )}

            {/* STEP 3 */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="space-y-14"
              >
                {/* NUEVA SECCIÓN: DISPONIBILIDAD DE DATOS Y CÓDIGO */}
                <div className="space-y-8">
                  <h3 className="font-serif text-2xl font-light text-[#0A1929] border-b border-[#E0E7E9] pb-4">
                    {isSpanish ? 'Disponibilidad de Datos y Código' : 'Data and Code Availability'}
                  </h3>
                  
                  {/* Disponibilidad de datos */}
                  <div>
                    <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-3">
                      {isSpanish ? 'Disponibilidad de los datos' : 'Data availability'} *
                      <HelpCapsule
                        text="Declara cómo se puede acceder a los datos que respaldan tu investigación"
                        textEn="Declare how the data supporting your research can be accessed"
                      />
                    </label>
                    <select
                      name="dataAvailability"
                      value={formData.dataAvailability}
                      onChange={handleInputChange}
                      required
                      className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif mb-4"
                    >
                      <option value="">— {isSpanish ? 'Selecciona una opción' : 'Select an option'} —</option>
                      {availabilityOptions[isSpanish ? 'es' : 'en'].map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      name="dataAvailabilityEn"
                      value={formData.dataAvailabilityEn}
                      onChange={handleInputChange}
                      placeholder={isSpanish ? 'Especificar en inglés (si aplica)' : 'Specify in English (if applicable)'}
                      className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                    />
                  </div>

                  {/* Disponibilidad de código */}
                  <div>
                    <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-3">
                      {isSpanish ? 'Disponibilidad del código' : 'Code availability'}
                      <HelpCapsule
                        text="Declara si el código utilizado está disponible y cómo acceder a él"
                        textEn="Declare if the code used is available and how to access it"
                      />
                    </label>
                    <select
                      name="codeAvailability"
                      value={formData.codeAvailability}
                      onChange={handleInputChange}
                      className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif mb-4"
                    >
                      <option value="">— {isSpanish ? 'Selecciona una opción (opcional)' : 'Select an option (optional)'} —</option>
                      {availabilityOptions[isSpanish ? 'es' : 'en'].map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      name="codeAvailabilityEn"
                      value={formData.codeAvailabilityEn}
                      onChange={handleInputChange}
                      placeholder={isSpanish ? 'Especificar en inglés (si aplica)' : 'Specify in English (if applicable)'}
                      className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                    />
                  </div>
                </div>

                {/* Declaraciones */}
                <div>
                  <h3 className="font-serif text-2xl font-light text-[#0A1929] border-b border-[#E0E7E9] pb-4">
                    {isSpanish ? 'Declaraciones obligatorias' : 'Mandatory declarations'}
                  </h3>
                  <div className="mt-8 space-y-5">
                    {[
                      { key: 'original', text: 'El trabajo es original y no ha sido publicado previamente', textEn: 'The work is original and has not been previously published' },
                      { key: 'notSubmitted', text: 'No está siendo considerado simultáneamente en otra revista', textEn: 'It is not being considered simultaneously in another journal' },
                      { key: 'dataAuthentic', text: 'Los datos presentados son auténticos y verificables', textEn: 'The presented data is authentic and verifiable' },
                      { key: 'informedConsent', text: 'Se obtuvo consentimiento informado cuando fue necesario', textEn: 'Informed consent was obtained when necessary' },
                      { key: 'aiDisclosure', text: 'Cualquier uso de IA ha sido declarado en el manuscrito', textEn: 'Any use of AI has been disclosed in the manuscript' },
                      { key: 'conflicts', text: 'Los conflictos de interés están declarados', textEn: 'Conflicts of interest are declared' }
                    ].map(d => (
                      <label key={d.key} className="flex gap-4 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={formData.declarations[d.key]}
                          onChange={() => handleDeclarationChange(d.key)}
                          className="mt-1 w-5 h-5 text-[#0A1929] rounded"
                        />
                        <span className="text-sm text-[#1A2B3C] group-hover:text-[#0A1929] font-serif">
                          {isSpanish ? d.text : d.textEn}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Licencia CC-BY */}
                <div className="bg-[#E5E9F0] border border-[#0A1929] rounded-3xl p-8">
                  <label className="flex gap-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.declarations.ccByLicense}
                      onChange={() => handleDeclarationChange('ccByLicense')}
                      className="mt-1 w-5 h-5 text-[#0A1929] rounded"
                    />
                    <div>
                      <div className="font-medium text-[#0A1929] font-serif">Licencia Creative Commons CC-BY</div>
                      <p className="text-xs text-[#1A2B3C] mt-1 font-serif">
                        {isSpanish
                          ? 'Autorizo la publicación bajo licencia CC-BY (open access). No cedo derechos de autor.'
                          : 'I authorize publication under CC-BY license (open access). I do not transfer copyright.'}
                      </p>
                    </div>
                  </label>
                </div>

                {/* Agradecimientos */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-3">
                    {isSpanish ? 'Agradecimientos' : 'Acknowledgments'} (opcional)
                    <HelpCapsule
                      text="Agradecimientos a personas o entidades que apoyaron el trabajo pero no cumplen criterios de autoría. NO incluir en el manuscrito anonimizado."
                      textEn="Acknowledgments to people or entities that supported the work but do not meet authorship criteria. Do NOT include in the anonymized manuscript."
                    />
                  </label>
                  <textarea
                    name="acknowledgments"
                    value={formData.acknowledgments}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full p-4 border border-[#E0E7E9] rounded-2xl text-sm font-serif"
                    placeholder={isSpanish ? 'Agradecemos a la Universidad X por el financiamiento...' : 'We thank University X for funding...'}
                  />
                </div>

                {/* Revisores excluidos */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-3">
                    {isSpanish ? 'Revisores sugeridos a excluir (opcional)' : 'Reviewers to exclude (optional)'}
                    <HelpCapsule
                      text="Nombres completos separados por punto y coma. No es una garantía absoluta."
                      textEn="Full names separated by semicolon. Not an absolute guarantee."
                    />
                  </label>
                  <input
                    type="text"
                    name="excludedReviewers"
                    value={formData.excludedReviewers}
                    onChange={handleInputChange}
                    className="w-full p-4 border border-[#E0E7E9] rounded-2xl text-sm font-serif"
                    placeholder={isSpanish ? 'Dra. Ana López; Dr. Carlos Mendoza' : 'Dr. Jane Smith; Prof. Michael Brown'}
                  />
                </div>

                {/* Archivo manuscrito */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-3">
                    {isSpanish ? 'Manuscrito anonimizado' : 'Anonymized manuscript'} *
                    <HelpCapsule
                      text="Obligatorio: formato Word (.doc/.docx), máximo 10 MB, SIN nombres, afiliaciones ni agradecimientos."
                      textEn="Required: Word format (.doc/.docx), max 10 MB, WITHOUT names, affiliations or acknowledgments."
                    />
                  </label>
                  <div className="border border-[#E0E7E9] rounded-3xl p-8 bg-[#F5F7FA]">
                    <input
                      type="file"
                      accept=".doc,.docx"
                      onChange={handleFileChange}
                      className="block w-full text-sm text-[#546E7A] file:py-4 file:px-8 file:rounded-2xl file:border-0 file:bg-white file:text-[#0A1929] file:font-medium font-serif"
                    />
                    {formData.manuscriptName && (
                      <div className="mt-6 flex items-center gap-3 text-[#0A1929] text-sm font-serif">
                        <span>📄</span>
                        {formData.manuscriptName}
                      </div>
                    )}
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>

          {/* Navegación */}
          <div className="flex justify-between items-center pt-8 border-t border-[#E0E7E9]">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="px-7 py-3.5 text-sm font-medium text-[#546E7A] hover:text-[#0A1929] flex items-center gap-2 transition-colors font-serif"
              >
                ← {isSpanish ? 'Anterior' : 'Previous'}
              </button>
            )}

            <div className="ml-auto">
              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-10 py-4 bg-[#0A1929] text-white rounded-2xl text-sm font-semibold hover:bg-[#B22234] transition-all flex items-center gap-3 shadow-lg font-serif"
                >
                  {isSpanish ? 'Continuar' : 'Continue'}
                  <span>→</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={uploading || !allDeclarationsAccepted() || !formData.manuscript || !formData.dataAvailability}
                  className="px-12 py-4 bg-[#0A1929] text-white rounded-2xl text-sm font-bold hover:bg-[#B22234] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-3 shadow-xl font-serif"
                >
                  {uploading
                    ? (isSpanish ? 'Enviando...' : 'Submitting...')
                    : (isSpanish ? 'ENVIAR PARA REVISIÓN' : 'SUBMIT FOR REVIEW')}
                </button>
              )}
            </div>
          </div>

          {submitStatus && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-sm font-medium mt-4 font-serif"
            >
              {submitStatus}
            </motion.p>
          )}

          <p className="text-center text-[10px] text-[#546E7A] font-mono tracking-widest">
            ⏺ {isSpanish ? 'Borrador guardado automáticamente cada 30 segundos' : 'Draft auto-saved every 30 seconds'}
          </p>
        </form>
      </div>
    </motion.div>
  );
}