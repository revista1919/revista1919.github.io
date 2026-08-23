// DirectorPanel.js (Componente completo - Nuevo Diseño Editorial + Lógicas Originales)
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '../firebase';
import ImageManager from './ImageManager';
import { 
  collection, onSnapshot, query, where, getDocs, 
  limit as firestoreLimit, doc as firestoreDoc, getDoc 
} from "firebase/firestore";
import Admissions from './Admissions';
import MailsTeam from './MailsTeam';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import CollectionManager from './CollectionManager';
import {
  PlusIcon, PencilIcon, TrashIcon, CheckIcon, ExclamationTriangleIcon,
  DocumentTextIcon, ArrowPathIcon, BookOpenIcon, DocumentIcon,
  XMarkIcon, ChevronRightIcon, MagnifyingGlassIcon, InboxIcon,
  UserGroupIcon, ChartBarIcon, CodeBracketIcon, PencilSquareIcon,
  GlobeAltIcon, PhotoIcon, ChevronDownIcon, UserIcon, EnvelopeIcon,
  IdentificationIcon, AcademicCapIcon, ArrowDownTrayIcon, InformationCircleIcon,
  FolderIcon  
} from '@heroicons/react/24/outline';

// --- Constantes de Configuración ---
const DOMAIN = 'https://www.revistacienciasestudiantes.com';
const ARTICLES_JSON_URL = `${DOMAIN}/articles.json`;
const MANAGE_ARTICLES_URL = 'https://managearticles-ggqsq2kkua-uc.a.run.app/manageArticles';
const MANAGE_VOLUMES_URL = 'https://managevolumes-ggqsq2kkua-uc.a.run.app/';
const REBUILD_URL = 'https://triggerrebuild-ggqsq2kkua-uc.a.run.app/';

const generateSlug = (name) => {
  if (!name) return '';
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^\w-]/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
};

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'script': 'sub' }, { 'script': 'super' }],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'list': 'check' }],
    [{ 'indent': '-1' }, { 'indent': '+1' }],
    [{ 'align': [] }],
    ['link', 'image', 'video', 'formula'],
    ['blockquote', 'code-block'],
    ['clean']
  ],
};

// --- Estructura para Autores ---
const initialAuthorState = {
  name: '',
  email: '',
  institution: '',
  orcid: '',
  authorId: null,
  isCorresponding: false,
  contribution: '',
};

// --- Estados Iniciales ---
const initialArticleState = {
  numeroArticulo: null,
  doi: '',
  titulo: '',
  tituloEnglish: '',
  autores: [],
  resumen: '',
  abstract: '',
  palabras_clave: '',
  keywords_english: '',
  specialized_codes: '',
  keywords_vocabulary: '',
  area: '',
  tipo: '',
  type: '',
  fecha: '',
  receivedDate: '',
  acceptedDate: '',
  volumen: '',
  numero: '',
  primeraPagina: '',
  ultimaPagina: '',
  conflicts: 'Los autores declaran no tener conflictos de interés.',
  conflictsEnglish: 'The authors declare no conflicts of interest.',
  funding: 'No declarada',
  fundingEnglish: 'Not declared',
  acknowledgments: '',
  acknowledgmentsEnglish: '',
  authorCredits: '',
  authorCreditsEnglish: '',
  dataAvailability: '',
  dataAvailabilityEnglish: '',
  submissionId: '',
  html_es: '',
  html_en: '',
  referencias: '',
  pdfFile: null,
  pdfUrl: null,
  htmlMode: 'code',
  lastVersionFileUrl: null,
};

const initialVolumeState = {
  volumen: '',
  numero: '',
  fecha: '',
  titulo: '',
  englishTitulo: '',
  issn: '',
  editorial: '',
  englishEditorial: '',
  portada: '',
  heroImage: '',
  pdfFile: null,
  pdf: null,
};

export default function DirectorPanel({ user }) {
  const [articles, setArticles] = useState([]);
  const [volumes, setVolumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('articles');
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedArticles, setExpandedArticles] = useState({});
  const [expandedVolumes, setExpandedVolumes] = useState({});

  const [showArticleModal, setShowArticleModal] = useState(false);
  const [showVolumeModal, setShowVolumeModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [showSubmissionSelector, setShowSubmissionSelector] = useState(false);
  const [submissionSearchTerm, setSubmissionSearchTerm] = useState('');
  const [readySubmissions, setReadySubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [importSummary, setImportSummary] = useState(null);

  const [articleForm, setArticleForm] = useState(initialArticleState);
  const [volumeForm, setVolumeForm] = useState(initialVolumeState);

  const hasAccess = useMemo(() => user?.roles?.includes('Director General'), [user]);

  useEffect(() => {
    if (showArticleModal && editingItem) {
      setArticleForm(prev => ({
        ...prev,
        ...editingItem,
        autores: Array.isArray(editingItem.autores) ? editingItem.autores : [],
      }));
    }
  }, [showArticleModal, editingItem]);

  useEffect(() => {
    if (showArticleModal && editingItem) {
      localStorage.setItem('draftEditArticle', JSON.stringify(articleForm));
    }
  }, [articleForm, showArticleModal, editingItem]);

  useEffect(() => {
    if (!hasAccess) return;

    const fetchArticles = async () => {
      setLoading(true);
      try {
        const response = await fetch(ARTICLES_JSON_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const processedArticles = data.map(article => ({
          ...article,
          autores: Array.isArray(article.autores) ? article.autores : 
                   (typeof article.autores === 'string' ? article.autores.split(';').map(name => ({ name: name.trim(), authorId: null })) : []),
          palabras_clave: Array.isArray(article.palabras_clave) ? article.palabras_clave : 
                          (typeof article.palabras_clave === 'string' ? article.palabras_clave.split(';').map(k => k.trim()).filter(k => k) : []),
          keywords_english: Array.isArray(article.keywords_english) ? article.keywords_english : 
                            (typeof article.keywords_english === 'string' ? article.keywords_english.split(';').map(k => k.trim()).filter(k => k) : []),
          specialized_codes: Array.isArray(article.specialized_codes) ? article.specialized_codes :
                            (typeof article.specialized_codes === 'string' ? article.specialized_codes.split(';').map(c => c.trim()).filter(Boolean) : []),
          keywords_vocabulary: article.keywords_vocabulary || '',
        }));
        setArticles(processedArticles);
      } catch (error) {
        console.error("Error fetching articles.json:", error);
        setStatus({ type: 'error', msg: 'Error al cargar los artículos desde el JSON.' });
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();

    const unsubVolumes = onSnapshot(collection(db, 'volumes'), (snapshot) => {
      const vols = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setVolumes(vols);
    });

    return () => unsubVolumes();
  }, [hasAccess]);

  const loadReadySubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const submissionsRef = collection(db, 'submissions');
      const q = query(submissionsRef, where('publicationReady', '==', true));
      const querySnapshot = await getDocs(q);
      const submissions = [];
      
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        const versionsRef = collection(db, 'submissions', doc.id, 'versions');
        const versionsSnap = await getDocs(query(versionsRef, firestoreLimit(1)));
        let lastVersionFileUrl = null;
        versionsSnap.forEach(versionDoc => {
          const versionData = versionDoc.data();
          if (versionData.fileUrl) lastVersionFileUrl = versionData.fileUrl;
        });

        submissions.push({
          id: doc.id,
          title: data.title || 'Sin título',
          submissionId: data.submissionId || doc.id,
          authors: data.authors || [],
          authorName: data.authorName || 'Autor no especificado',
          currentMetadata: data.currentMetadata || data.originalSubmission || {},
          paperLanguage: data.paperLanguage || 'es',
          driveFolderUrl: data.driveFolderUrl || null,
          editorialFolderUrl: data.editorialFolderUrl || null,
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          createdAt: data.createdAt?.toDate?.() || null,
          publicationReadyAt: data.publicationReadyAt?.toDate?.() || null,
          decisionMadeAt: data.decisionMadeAt?.toDate?.() || null,
          lastVersionFileUrl,
        });
      }
      
      submissions.sort((a, b) => b.updatedAt - a.updatedAt);
      setReadySubmissions(submissions);
    } catch (error) {
      console.error("Error loading ready submissions:", error);
      setStatus({ type: 'error', msg: 'Error al cargar los envíos listos para publicación.' });
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleOpenSubmissionSelector = () => {
    loadReadySubmissions();
    setSubmissionSearchTerm('');
    setSelectedSubmission(null);
    setImportSummary(null);
    setShowSubmissionSelector(true);
  };

  const importFromSubmission = async (submission) => {
  if (!submission) return;
  setIsProcessing(true);
  setStatus({ type: 'info', msg: 'Importando datos del envío...' });

  try {
    // ✅ CORREGIDO: getMeta busca en TODAS las ubicaciones posibles
    const getMeta = (field) => {
      // 1. Buscar en currentMetadata (prioridad)
      if (submission.currentMetadata && submission.currentMetadata[field] !== undefined && submission.currentMetadata[field] !== null) {
        return submission.currentMetadata[field];
      }
      // 2. Buscar en metadataBeforeConsolidation
      if (submission.metadataBeforeConsolidation && submission.metadataBeforeConsolidation[field] !== undefined && submission.metadataBeforeConsolidation[field] !== null) {
        return submission.metadataBeforeConsolidation[field];
      }
      // 3. Buscar directamente en submission (nivel raíz)
      if (submission[field] !== undefined && submission[field] !== null) {
        return submission[field];
      }
      // 4. Buscar en correspondingAuthor
      if (submission.correspondingAuthor && submission.correspondingAuthor[field] !== undefined && submission.correspondingAuthor[field] !== null) {
        return submission.correspondingAuthor[field];
      }
      return null;
    };

    // ✅ CORREGIDO: Obtener autores desde MÚLTIPLES fuentes
    let authorsSource = getMeta('authors') || [];
    
    // Si no hay autores en currentMetadata, buscar en metadataBeforeConsolidation
    if ((!authorsSource || authorsSource.length === 0) && submission.metadataBeforeConsolidation?.authors) {
      authorsSource = submission.metadataBeforeConsolidation.authors;
    }
    
    // Si aún no hay autores, buscar en el nivel raíz
    if ((!authorsSource || authorsSource.length === 0) && submission.authors) {
      authorsSource = submission.authors;
    }

    const importedAuthors = (Array.isArray(authorsSource) ? authorsSource : []).map(author => ({
      name: author.name || `${author.firstName || ''} ${author.lastName || ''}`.trim() || '',
      email: author.email || '',
      institution: author.institution || '', // ✅ Institución del autor
      orcid: author.orcid || '',
      authorId: author.uid || author.authorId || null,
      isCorresponding: author.isCorresponding || false,
      contribution: author.contribution || '',
    }));

    // ✅ Si no hay autores, usar correspondingAuthor
    if (importedAuthors.length === 0 && submission.correspondingAuthor) {
      const ca = submission.correspondingAuthor;
      importedAuthors.push({
        name: `${ca.firstName || ''} ${ca.lastName || ''}`.trim(),
        email: ca.email || '',
        institution: ca.institution || '', // ✅ Institución del corresponding author
        orcid: ca.orcid || '',
        authorId: submission.authorUID || submission.uid || null,
        isCorresponding: true,
        contribution: '',
      });
    }

    // ✅ CORREGIDO: Keywords Especializadas
    let specializedCodesStr = '';
    const specializedCodes = getMeta('specializedCodes') || submission.specializedCodes || [];
    if (Array.isArray(specializedCodes) && specializedCodes.length > 0) {
      specializedCodesStr = specializedCodes.join('; ');
    } else if (typeof specializedCodes === 'string' && specializedCodes.trim()) {
      specializedCodesStr = specializedCodes;
    } else if (submission.specializedCodesSerialized) {
      specializedCodesStr = submission.specializedCodesSerialized;
    }

    // ✅ CORREGIDO: Vocabulario Controlado
    const keywordsVocabularyStr = getMeta('keywordsVocabulario') || 
                                   getMeta('keywords_vocabulary') || 
                                   submission.keywordsVocabulario || 
                                   '';

    // ✅ CORREGIDO: Funding
    let fundingText = 'No declarada';
    const fundingData = getMeta('funding') || submission.funding;
    if (fundingData) {
      if (typeof fundingData === 'object' && !Array.isArray(fundingData)) {
        const sources = fundingData.sources || '';
        const grants = fundingData.grantNumbers || '';
        fundingText = [sources, grants].filter(Boolean).join(' - ') || 'No declarada';
      } else if (typeof fundingData === 'string') {
        fundingText = fundingData;
      }
    }

    // ✅ CORREGIDO: Keywords ES
    let palabrasClaveStr = '';
    const keywordsEs = getMeta('keywordsEs') || submission.keywordsEs || [];
    if (Array.isArray(keywordsEs) && keywordsEs.length > 0) {
      palabrasClaveStr = keywordsEs.join('; ');
    } else if (typeof keywordsEs === 'string' && keywordsEs.trim()) {
      palabrasClaveStr = keywordsEs;
    }

    // ✅ CORREGIDO: Keywords EN
    let keywordsEnglishStr = '';
    const keywordsEn = getMeta('keywordsEn') || submission.keywordsEn || [];
    if (Array.isArray(keywordsEn) && keywordsEn.length > 0) {
      keywordsEnglishStr = keywordsEn.join('; ');
    } else if (typeof keywordsEn === 'string' && keywordsEn.trim()) {
      keywordsEnglishStr = keywordsEn;
    } else if (!keywordsEnglishStr && palabrasClaveStr) {
      keywordsEnglishStr = palabrasClaveStr;
    }

    const authorCreditsText = importedAuthors
      .filter(a => a.contribution)
      .map(a => `${a.name}: ${a.contribution}`)
      .join('\n');

    const receivedDate = submission.createdAt ? 
      (submission.createdAt.toDate ? submission.createdAt.toDate().toISOString().split('T')[0] : 
       new Date(submission.createdAt).toISOString().split('T')[0]) : '';
    
    const acceptedDate = submission.publicationReadyAt ? 
      (submission.publicationReadyAt.toDate ? submission.publicationReadyAt.toDate().toISOString().split('T')[0] : 
       new Date(submission.publicationReadyAt).toISOString().split('T')[0]) : 
      (submission.decisionMadeAt ? 
        (submission.decisionMadeAt.toDate ? submission.decisionMadeAt.toDate().toISOString().split('T')[0] : 
         new Date(submission.decisionMadeAt).toISOString().split('T')[0]) : '');

    const articleType = getMeta('articleType') || '';
    const articleTypeMap = {
      'research': { es: 'Artículo de Investigación', en: 'Research Article' },
      'review': { es: 'Artículo de Revisión', en: 'Review Article' },
      'case': { es: 'Reporte de Caso', en: 'Case Report' },
      'essay': { es: 'Ensayo Académico', en: 'Academic Essay' },
      'book_review': { es: 'Reseña de Libros', en: 'Book Review' },
    };
    
    const tipoMapped = articleTypeMap[articleType] || { es: articleType || '', en: articleType || '' };

    const importedData = {
      titulo: getMeta('title') || '',
      tituloEnglish: getMeta('titleEn') || '',
      autores: importedAuthors,
      resumen: getMeta('abstract') || '',
      abstract: getMeta('abstractEn') || '',
      palabras_clave: palabrasClaveStr,
      keywords_english: keywordsEnglishStr,
      specialized_codes: specializedCodesStr,  // ✅ Códigos especializados
      keywords_vocabulary: keywordsVocabularyStr,  // ✅ Vocabulario controlado
      area: getMeta('area') || '',
      tipo: tipoMapped.es,
      type: tipoMapped.en,
      acknowledgments: getMeta('acknowledgments') || '',
      acknowledgmentsEnglish: getMeta('acknowledgmentsEn') || getMeta('acknowledgmentsEnglish') || '',
      conflicts: getMeta('conflictOfInterest') || 'Los autores declaran no tener conflictos de interés.',
      conflictsEnglish: getMeta('conflictsEnglish') || 'The authors declare no conflicts of interest.',
      funding: fundingText,
      fundingEnglish: getMeta('fundingEnglish') || fundingText,
      dataAvailability: getMeta('dataAvailability') || '',
      dataAvailabilityEnglish: getMeta('dataAvailabilityEn') || getMeta('dataAvailabilityEnglish') || '',
      authorCredits: authorCreditsText,
      authorCreditsEnglish: getMeta('authorCreditsEnglish') || authorCreditsText,
      receivedDate: receivedDate,
      acceptedDate: acceptedDate,
      submissionId: submission.submissionId || submission.id,
      lastVersionFileUrl: submission.lastVersionFileUrl || null,
      driveFolderUrl: submission.driveFolderUrl || null,
      editorialFolderUrl: submission.editorialFolderUrl || null,
    };

    setArticleForm(prev => ({ ...prev, ...importedData }));

    const importedFields = [];
    if (importedData.titulo) importedFields.push('título');
    if (importedData.tituloEnglish) importedFields.push('título inglés');
    if (importedData.resumen) importedFields.push('resumen');
    if (importedData.abstract) importedFields.push('abstract');
    if (importedData.palabras_clave) importedFields.push('palabras clave');
    if (importedData.keywords_english) importedFields.push('keywords');
    if (importedData.specialized_codes) importedFields.push('códigos especializados');
    if (importedData.keywords_vocabulary) importedFields.push('vocabulario controlado');
    if (importedData.area) importedFields.push('área');
    if (importedData.tipo) importedFields.push('tipo de artículo');
    if (importedData.autores.length > 0) importedFields.push(`autores (${importedData.autores.length})`);
    if (importedData.authorCredits) importedFields.push('contribuciones');
    if (importedData.conflicts) importedFields.push('conflictos');
    if (importedData.funding && importedData.funding !== 'No declarada') importedFields.push('financiamiento');
    if (importedData.acknowledgments) importedFields.push('agradecimientos');
    if (importedData.dataAvailability) importedFields.push('disponibilidad de datos');
    if (importedData.receivedDate) importedFields.push('fecha recepción');
    if (importedData.acceptedDate) importedFields.push('fecha aceptación');
    if (importedData.submissionId) importedFields.push('submission ID');

    setImportSummary({
      fields: importedFields,
      lastVersionFileUrl: submission.lastVersionFileUrl,
      driveFolderUrl: submission.driveFolderUrl,
      editorialFolderUrl: submission.editorialFolderUrl,
    });

    setStatus({ type: 'success', msg: `Datos importados correctamente. Revise y complete los que faltan.` });
    
    setShowSubmissionSelector(false);
    setSelectedSubmission(submission);
    setShowArticleModal(true);
    
  } catch (error) {
    console.error("Error importing submission:", error);
    setStatus({ type: 'error', msg: `Error al importar: ${error.message}` });
  } finally {
    setIsProcessing(false);
  }
};

  const filteredReadySubmissions = useMemo(() => {
    if (!submissionSearchTerm.trim()) return readySubmissions;
    const term = submissionSearchTerm.toLowerCase();
    return readySubmissions.filter(sub => 
      sub.title.toLowerCase().includes(term) ||
      sub.submissionId.toLowerCase().includes(term) ||
      sub.authorName.toLowerCase().includes(term)
    );
  }, [readySubmissions, submissionSearchTerm]);

  const filteredArticles = articles.filter(a => 
    a.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.autores?.some(author => author.name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const triggerRebuild = async () => {
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(REBUILD_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: 'rebuild' }),
      });
      if (!response.ok) throw new Error(`Rebuild failed: ${response.status}`);
      return true;
    } catch (error) {
      throw error;
    }
  };

  const handleRebuild = async () => {
    try {
      setStatus({ type: 'info', msg: 'Iniciando reconstrucción del sitio...' });
      await triggerRebuild();
      setStatus({ type: 'success', msg: 'Sitio web actualizándose en segundo plano.' });
    } catch (e) { 
      setStatus({ type: 'error', msg: 'Error al reconstruir: ' + e.message }); 
    }
  };

  const handleSaveArticle = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setStatus(null);

    try {
      const token = await auth.currentUser.getIdToken();
      const pdfBase64 = articleForm.pdfFile ? await toBase64(articleForm.pdfFile) : null;
      
      let html_es = articleForm.html_es;
      let html_en = articleForm.html_en;
      
      if (articleForm.htmlMode === 'code') {
        html_es = articleForm.html_es || '';
        html_en = articleForm.html_en || '';
      }

      const autoresParaBackend = articleForm.autores.map(autor => ({
        name: autor.name,
        authorId: autor.authorId,
        email: autor.email,
        institution: autor.institution,
        orcid: autor.orcid,
        contribution: autor.contribution,
        isCorresponding: autor.isCorresponding || false,
      }));

      const processKeywordString = (input) => {
        if (!input) return [];
        if (Array.isArray(input)) return input.map(k => typeof k === 'string' ? k.trim() : String(k)).filter(Boolean);
        if (typeof input === 'string') return input.split(';').map(k => k.trim()).filter(Boolean);
        return [];
      };

      const palabrasClaveArray = processKeywordString(articleForm.palabras_clave);
      const keywordsArray = processKeywordString(articleForm.keywords_english);

      // VERIFICAR que articleData incluya TODOS estos campos (ya deberían estar, pero confirma):
const articleData = {
  titulo: articleForm.titulo,
  tituloEnglish: articleForm.tituloEnglish,
  doi: articleForm.doi,
  autores: autoresParaBackend,  // ✅ Ya incluye authorId
  resumen: articleForm.resumen,
  abstract: articleForm.abstract,
  palabras_clave: palabrasClaveArray,
  keywords_english: keywordsArray,
  specialized_codes: articleForm.specialized_codes,
  keywords_vocabulary: articleForm.keywords_vocabulary,
  area: articleForm.area,
  tipo: articleForm.tipo,
  type: articleForm.type,
  fecha: articleForm.fecha,
  receivedDate: articleForm.receivedDate || null,
  acceptedDate: articleForm.acceptedDate || null,
  volumen: articleForm.volumen,
  numero: articleForm.numero,
  primeraPagina: articleForm.primeraPagina,
  ultimaPagina: articleForm.ultimaPagina,
  conflicts: articleForm.conflicts,
  conflictsEnglish: articleForm.conflictsEnglish,
  funding: articleForm.funding,
  fundingEnglish: articleForm.fundingEnglish,
  acknowledgments: articleForm.acknowledgments,
  acknowledgmentsEnglish: articleForm.acknowledgmentsEnglish,  // ✅ Asegurar que esté
  authorCredits: articleForm.authorCredits,
  authorCreditsEnglish: articleForm.authorCreditsEnglish,      // ✅ Asegurar que esté
  dataAvailability: articleForm.dataAvailability,
  dataAvailabilityEnglish: articleForm.dataAvailabilityEnglish, // ✅ Asegurar que esté
  submissionId: articleForm.submissionId,
  html_es: html_es,
  html_en: html_en,
  referencias: articleForm.referencias,
};

      let action = 'edit';
      if (!editingItem && articleForm.submissionId) {
        action = 'publish';
      } else if (!editingItem) {
        action = 'add';
      }

      const payload = {
        action: action,
        article: articleData,
        pdfBase64,
        id: editingItem?.numeroArticulo?.toString(),
      };

      const response = await fetch(MANAGE_ARTICLES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(await response.text());

      if (!editingItem) localStorage.removeItem('draftNewArticle');
      setShowArticleModal(false);
      resetForms();
      await triggerRebuild();
      
      setStatus({ type: 'success', msg: action === 'publish' ? 'Artículo publicado exitosamente.' : 'Artículo guardado exitosamente.' });
      
    } catch (err) {
      console.error("Error saving article:", err);
      setStatus({ type: 'error', msg: `Error: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveVolume = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setStatus(null);

    try {
      const token = await auth.currentUser.getIdToken();
      const pdfBase64 = volumeForm.pdfFile ? await toBase64(volumeForm.pdfFile) : null;

      const year = new Date(volumeForm.fecha).getFullYear();
      const autoTituloEs = volumeForm.volumen && year ? `Volumen ${volumeForm.volumen} (${year})` : volumeForm.titulo;
      const autoTituloEn = volumeForm.volumen && year ? `Volume ${volumeForm.volumen} (${year})` : volumeForm.englishTitulo;

      const volumeData = {
        titulo: autoTituloEs,
        englishTitulo: autoTituloEn,
        fecha: volumeForm.fecha,
        volumen: volumeForm.volumen,
        numero: volumeForm.numero,
        portada: volumeForm.portada,
        heroImage: volumeForm.heroImage, 
        issn: volumeForm.issn || null,
        editorial: volumeForm.editorial || null,
        englishEditorial: volumeForm.englishEditorial || null,
      };

      const payload = {
        action: editingItem ? 'edit' : 'add',
        volume: volumeData,
        pdfBase64,
        id: editingItem?.id,
      };

      const response = await fetch(MANAGE_VOLUMES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(await response.text());

      if (!editingItem) localStorage.removeItem('draftNewVolume');
      setShowVolumeModal(false);
      resetForms();
      await triggerRebuild();
      setStatus({ type: 'success', msg: 'Volumen guardado exitosamente.' });
    } catch (err) {
      setStatus({ type: 'error', msg: `Error: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id, type) => {
    if (!confirm(`¿Estás seguro de eliminar este ${type === 'article' ? 'artículo' : 'volumen'}? Esta acción es irreversible.`)) return;
    
    try {
      setStatus({ type: 'info', msg: 'Eliminando registro...' });
      const token = await auth.currentUser.getIdToken();
      const url = type === 'article' ? MANAGE_ARTICLES_URL : MANAGE_VOLUMES_URL;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'delete', id }),
      });

      if (!response.ok) throw new Error(await response.text());

      await triggerRebuild();
      setStatus({ type: 'success', msg: 'Registro eliminado exitosamente.' });
    } catch (err) {
      setStatus({ type: 'error', msg: `Error: ${err.message}` });
    }
  };

  const resetForms = () => {
    setArticleForm(initialArticleState);
    setVolumeForm(initialVolumeState);
    setEditingItem(null);
    setImportSummary(null);
  };

  const toggleArticleExpand = (id) => setExpandedArticles(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleVolumeExpand = (id) => setExpandedVolumes(prev => ({ ...prev, [id]: !prev[id] }));

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (!hasAccess) return <AccessDenied />;
  if (loading) return <LoadingScreen />;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Mobile Header */}
      <div className="lg:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-30 shadow-md">
        <div>
          <h1 className="text-xl font-bold font-serif tracking-tight">RNCPE</h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Editorial Dashboard</p>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 hover:bg-slate-800 rounded-md transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} className="lg:hidden fixed inset-0 z-40 bg-slate-900 w-64 pt-20 shadow-2xl">
            <nav className="p-4 space-y-1">
              <SidebarItemMobile active={activeTab === 'articles'} onClick={() => { setActiveTab('articles'); setMobileMenuOpen(false); }} icon={<DocumentTextIcon />} label="Artículos" />
              <SidebarItemMobile active={activeTab === 'volumes'} onClick={() => { setActiveTab('volumes'); setMobileMenuOpen(false); }} icon={<BookOpenIcon />} label="Volúmenes" />
              <SidebarItemMobile active={activeTab === 'team'} onClick={() => { setActiveTab('team'); setMobileMenuOpen(false); }} icon={<UserGroupIcon />} label="Equipo / Mails" />
              <SidebarItemMobile active={activeTab === 'admissions'} onClick={() => { setActiveTab('admissions'); setMobileMenuOpen(false); }} icon={<InboxIcon />} label="Admisiones" />
              <SidebarItemMobile active={activeTab === 'usersearch'} onClick={() => { setActiveTab('usersearch'); setMobileMenuOpen(false); }} icon={<MagnifyingGlassIcon />} label="Buscador" />
              <SidebarItemMobile active={activeTab === 'images'} onClick={() => { setActiveTab('images'); setMobileMenuOpen(false); }} icon={<PhotoIcon />} label="Imágenes" />
              <SidebarItemMobile active={activeTab === 'collections'} onClick={() => { setActiveTab('collections'); setMobileMenuOpen(false); }} icon={<FolderIcon />} label="Colecciones" />
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <aside className="hidden lg:flex w-72 bg-slate-900 text-slate-300 flex-col sticky h-screen top-0 border-r border-slate-800 shadow-xl">
        <div className="p-8 border-b border-slate-800 bg-slate-950">
          <h1 className="text-2xl font-bold font-serif text-white tracking-tight">RNCPE</h1>
          <p className="text-xs text-indigo-400 mt-2 uppercase tracking-widest font-semibold">Director Panel</p>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <p className="px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 mt-4">Publicación</p>
          <SidebarItem active={activeTab === 'articles'} onClick={() => setActiveTab('articles')} icon={<DocumentTextIcon />} label="Gestión de Artículos" />
          <SidebarItem active={activeTab === 'volumes'} onClick={() => setActiveTab('volumes')} icon={<BookOpenIcon />} label="Archivo de Volúmenes" />
          <SidebarItem active={activeTab === 'collections'} onClick={() => setActiveTab('collections')} icon={<FolderIcon />} label="Colecciones Especiales" />
          
          <p className="px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 mt-8">Administración</p>
          <SidebarItem active={activeTab === 'admissions'} onClick={() => setActiveTab('admissions')} icon={<InboxIcon />} label="Centro de Admisiones" />
          <SidebarItem active={activeTab === 'team'} onClick={() => setActiveTab('team')} icon={<UserGroupIcon />} label="Directorio y Correos" />
          <SidebarItem active={activeTab === 'usersearch'} onClick={() => setActiveTab('usersearch')} icon={<MagnifyingGlassIcon />} label="Buscador de Autores" />
          <SidebarItem active={activeTab === 'images'} onClick={() => setActiveTab('images')} icon={<PhotoIcon />} label="Repositorio Gráfico" />
        </nav>
        <div className="p-6 border-t border-slate-800 bg-slate-950">
          <button onClick={handleRebuild} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-indigo-600 text-white rounded-md transition-all font-medium text-sm border border-slate-700 hover:border-indigo-500">
            <ArrowPathIcon className="w-4 h-4" /> Reconstruir Sitio
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 lg:p-10 overflow-y-auto bg-slate-50">
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 font-serif tracking-tight">
              {activeTab === 'articles' ? 'Gestión Editorial de Artículos' : 
               activeTab === 'volumes' ? 'Archivo de Volúmenes' : 
               activeTab === 'usersearch' ? 'Directorio de Usuarios' : 'Panel de Administración'}
            </h2>
            <p className="text-sm text-slate-500 mt-2 font-medium">Panel principal del Director General. Total publicados: {articles.length}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 min-w-[250px]">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Buscar registros..." className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm text-sm transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            
            {activeTab === 'articles' && (
              <button onClick={handleOpenSubmissionSelector} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-md flex items-center justify-center gap-2 font-medium shadow-sm transition-all text-sm whitespace-nowrap">
                <PlusIcon className="w-4 h-4" /> Nuevo Artículo
              </button>
            )}
            {activeTab === 'volumes' && (
              <button onClick={() => { resetForms(); setShowVolumeModal(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-md flex items-center justify-center gap-2 font-medium shadow-sm transition-all text-sm whitespace-nowrap">
                <PlusIcon className="w-4 h-4" /> Registrar Volumen
              </button>
            )}
          </div>
        </header>

        <AnimatePresence>{status && <Notification status={status} clear={() => setStatus(null)} />}</AnimatePresence>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 min-h-[65vh] overflow-hidden">
          {activeTab === 'articles' && (
            <ArticleList 
              articles={filteredArticles}
              expandedArticles={expandedArticles}
              onToggleExpand={toggleArticleExpand}
              onEdit={(article) => { 
                setEditingItem(article); 
                const autoresParaEdicion = Array.isArray(article.autores) ? article.autores : 
                                            (typeof article.autores === 'string' ? article.autores.split(';').map(name => ({ name: name.trim(), authorId: null })) : []);
                const arrayToString = (value) => Array.isArray(value) ? value.join('; ') : value || '';
                setArticleForm({
                  ...article,
                  autores: autoresParaEdicion,
                  palabras_clave: arrayToString(article.palabras_clave),
                  keywords_english: arrayToString(article.keywords_english),
                  specialized_codes: arrayToString(article.specialized_codes),
                  keywords_vocabulary: article.keywords_vocabulary || '',
                  htmlMode: 'code',
                  html_es: article.html_es || '',
                  html_en: article.html_en || '',
                  referencias: article.referencias || '',
                  pdfFile: null,
                }); 
                setShowArticleModal(true); 
              }}
              onDelete={(id) => handleDelete(id, 'article')}
              formatDate={formatDate}
            />
          )}
          {activeTab === 'volumes' && (
            <VolumeList 
              volumes={volumes}
              expandedVolumes={expandedVolumes}
              onToggleExpand={toggleVolumeExpand}
              onEdit={(volume) => { setEditingItem(volume); setVolumeForm({ ...volume, pdfFile: null }); setShowVolumeModal(true); }}
              onDelete={(id) => handleDelete(id, 'volume')}
              formatDate={formatDate}
            />
          )}
          {activeTab === 'collections' && <div className="p-6"><CollectionManager user={user} /></div>}
          {activeTab === 'team' && <div className="p-6"><MailsTeam /></div>}
          {activeTab === 'admissions' && <div className="p-6"><Admissions /></div>}
          {activeTab === 'usersearch' && <div className="p-6"><UserSearch /></div>}
          {activeTab === 'images' && <div className="p-6"><ImageManager user={user} onClose={() => {}} allowSelection={false} /></div>}
        </div>
      </main>

      {/* Selectores y Modales */}
      <Modal 
        show={showSubmissionSelector} 
        onClose={() => setShowSubmissionSelector(false)}
        title="Repositorio de Manuscritos Aprobados"
        isProcessing={loadingSubmissions}
        hideSaveButton={true}
        size="lg"
      >
        <SubmissionSelector 
          submissions={filteredReadySubmissions}
          searchTerm={submissionSearchTerm}
          setSearchTerm={setSubmissionSearchTerm}
          onSelect={importFromSubmission}
          loading={loadingSubmissions}
          onRefresh={loadReadySubmissions}
        />
      </Modal>

      <Modal 
        show={showArticleModal} 
        onClose={() => setShowArticleModal(false)}
        title={editingItem ? "Edición de Metadatos del Artículo" : "Publicación de Nuevo Manuscrito"}
        isProcessing={isProcessing}
        onSave={handleSaveArticle}
        size="xl" 
      >
        {importSummary && !editingItem && (
          <div className="mb-6 p-4 bg-indigo-50/50 rounded-md border border-indigo-100 flex items-start gap-3">
            <InformationCircleIcon className="w-5 h-5 text-indigo-700 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-indigo-900">
              <p className="font-semibold mb-1">Migración de metadatos completada</p>
              <p className="text-indigo-800">Campos integrados: <span className="font-medium">{importSummary.fields.join(', ')}</span>.</p>
              {importSummary.lastVersionFileUrl && (
                <p className="mt-2">
                  <a href={importSummary.lastVersionFileUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline decoration-indigo-300 hover:decoration-indigo-600 flex items-center gap-1">
                    <DocumentIcon className="w-4 h-4" /> Acceder al archivo original para maquetación final
                  </a>
                </p>
              )}
            </div>
          </div>
        )}
        <ArticleForm 
          formData={articleForm} 
          setFormData={setArticleForm}
          isProcessing={isProcessing}
          isEditing={!!editingItem}
          submissionId={articleForm.submissionId}
        />
      </Modal>

      <Modal 
        show={showVolumeModal} 
        onClose={() => setShowVolumeModal(false)}
        title={editingItem ? "Modificar Volumen Editorial" : "Registro de Nuevo Volumen"}
        isProcessing={isProcessing}
        onSave={handleSaveVolume}
      >
        <VolumeForm formData={volumeForm} setFormData={setVolumeForm} isEditing={!!editingItem} />
      </Modal>
      
      <Modal
        show={showImageModal}
        onClose={() => setShowImageModal(false)}
        title="Repositorio Gráfico Global"
        hideSaveButton={true}
        size="xl"
      >
        <ImageManager user={user} onClose={() => setShowImageModal(false)} allowSelection={false} />
      </Modal>
    </div>
  );
}

// ==================== SUBCOMPONENTES ====================

const SubmissionSelector = ({ submissions, searchTerm, setSearchTerm, onSelect, loading, onRefresh }) => {
  return (
    <div className="space-y-5 min-h-[400px] flex flex-col">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar manuscrito por título, ID o autor principal..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>
        <button onClick={onRefresh} disabled={loading} className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-md flex items-center gap-2 text-slate-700 transition-colors shadow-sm" title="Actualizar repositorio">
          <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto border border-slate-200 rounded-md bg-slate-50 p-3 min-h-[300px] max-h-[500px]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <ArrowPathIcon className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <DocumentTextIcon className="w-10 h-10 mb-3 text-slate-300" />
            <p className="font-medium text-sm text-slate-600">No hay manuscritos en cola de publicación</p>
            <p className="text-xs mt-1">Los trabajos deben ser marcados como aprobados por el comité.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((sub) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-white rounded-md border border-slate-200 hover:border-indigo-400 hover:shadow-md cursor-pointer transition-all"
                onClick={() => onSelect(sub)}
              >
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-serif font-bold text-slate-900 text-base leading-tight pr-4">{sub.title}</h4>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-1 rounded">Aprobado</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <div><span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[10px]">ID Ref</span> <span className="font-mono">{sub.submissionId}</span></div>
                  <div><span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[10px]">Contacto</span> <span className="font-medium">{sub.authorName}</span></div>
                  <div><span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[10px]">Idioma</span> <span>{sub.paperLanguage === 'es' ? 'Español' : 'Inglés'}</span></div>
                  <div><span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[10px]">Aprobación</span> <span>{sub.updatedAt.toLocaleDateString()}</span></div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ArticleForm = ({ formData, setFormData, isProcessing, isEditing, submissionId }) => {
  const [activeStep, setActiveStep] = useState(0);
  
  const steps = [
    { id: 0, name: 'Identidad y Autoría' },
    { id: 1, name: 'Datos de Publicación' },
    { id: 2, name: 'Maquetación HTML (ES)' },
    { id: 3, name: 'Maquetación HTML (EN)' },
    { id: 4, name: 'Bibliografía' },
    { id: 5, name: 'Indexación y Metadatos' },
    { id: 6, name: 'Manuscrito y Créditos' }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const addAuthor = () => {
    setFormData(prev => ({ ...prev, autores: [...prev.autores, { ...initialAuthorState }] }));
  };

  const removeAuthor = (index) => {
    setFormData(prev => ({ ...prev, autores: prev.autores.filter((_, i) => i !== index) }));
  };

  const updateAuthor = (index, field, value) => {
    setFormData(prev => {
      const updatedAutores = [...prev.autores];
      updatedAutores[index] = { ...updatedAutores[index], [field]: value };
      return { ...prev, autores: updatedAutores };
    });
  };
// AGREGAR DESPUÉS de la función updateAuthor dentro de ArticleForm
const [showAuthorSearch, setShowAuthorSearch] = useState(false);
const [authorSearchTerm, setAuthorSearchTerm] = useState('');
const [authorSearchResults, setAuthorSearchResults] = useState([]);
const [searchingAuthors, setSearchingAuthors] = useState(false);
const [activeAuthorIndex, setActiveAuthorIndex] = useState(null);

const searchUsers = async (searchTerm) => {
  if (!searchTerm || searchTerm.trim().length < 2) return;
  setSearchingAuthors(true);
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, firestoreLimit(50));
    const querySnapshot = await getDocs(q);
    const results = [];
    
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.toLowerCase();
      const displayName = (userData.displayName || '').toLowerCase();
      const email = (userData.email || '').toLowerCase();
      const term = searchTerm.toLowerCase();
      
      if (fullName.includes(term) || displayName.includes(term) || email.includes(term)) {
        results.push({
          uid: doc.id,
          name: displayName || fullName || 'Sin nombre',
          email: userData.email || '',
          institution: userData.institution || '',
          orcid: userData.orcid || '',
        });
      }
    });
    
    setAuthorSearchResults(results.slice(0, 10));
  } catch (error) {
    console.error("Error searching users:", error);
  } finally {
    setSearchingAuthors(false);
  }
};

const assignUserToAuthor = (userData) => {
  if (activeAuthorIndex === null) return;
  
  setFormData(prev => {
    const updatedAutores = [...prev.autores];
    updatedAutores[activeAuthorIndex] = {
      ...updatedAutores[activeAuthorIndex],
      name: userData.name,
      email: userData.email,
      institution: userData.institution || updatedAutores[activeAuthorIndex].institution,
      orcid: userData.orcid || updatedAutores[activeAuthorIndex].orcid,
      authorId: userData.uid,
    };
    return { ...prev, autores: updatedAutores };
  });
  
  setShowAuthorSearch(false);
  setAuthorSearchTerm('');
  setAuthorSearchResults([]);
  setActiveAuthorIndex(null);
};
  return (
    <div className="flex flex-col h-[75vh]">
      {submissionId && (
        <div className="mb-4 text-xs font-mono text-slate-500 flex items-center gap-2 pb-2 border-b border-slate-100">
          <IdentificationIcon className="w-4 h-4" /> ID de Trazabilidad: {submissionId}
        </div>
      )}

      <div className="mb-8 border-b border-slate-200">
        <div className="flex overflow-x-auto scrollbar-hide space-x-1 pb-px">
          {steps.map((step, idx) => (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={`
                px-4 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-colors border-b-2
                ${activeStep === step.id 
                  ? 'border-indigo-600 text-indigo-700 bg-indigo-50/30' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
              `}
            >
              {idx + 1}. {step.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-4 space-y-8 pb-10">
        {activeStep === 0 && (
          <div className="space-y-6">
            <Input label="Título Original (ES) *" name="titulo" value={formData.titulo} onChange={handleChange} required className="font-serif text-lg" />
            <Input label="Título Traducido (EN)" name="tituloEnglish" value={formData.tituloEnglish} onChange={handleChange} className="font-serif text-lg" />
            <Input label="Identificador de Objeto Digital (DOI)" name="doi" value={formData.doi} onChange={handleChange} placeholder="Ej: 10.1234/revista.2024.001" className="font-mono text-sm" />
            
            <div className="pt-4 border-t border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">Filiación y Autores *</label>
              </div>
              
              <div className="space-y-4">
                {formData.autores.map((autor, index) => (
                  <div key={index} className="p-5 border border-slate-200 rounded-md bg-white shadow-sm space-y-4 relative">
                    <div className="absolute top-4 right-4">
                      {formData.autores.length > 1 && (
                        <button type="button" onClick={() => removeAuthor(index)} className="text-slate-400 hover:text-red-600 transition-colors">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 block w-full">Autor {index + 1}</span>
                    
                    // REEMPLAZAR el bloque que muestra los campos de autor por este:
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div className="relative">
    <Input 
      label="Nombre Completo *" 
      value={autor.name} 
      onChange={(e) => updateAuthor(index, 'name', e.target.value)} 
    />
    <button
      type="button"
      onClick={() => {
        setActiveAuthorIndex(index);
        setShowAuthorSearch(true);
        setAuthorSearchTerm('');
        setAuthorSearchResults([]);
      }}
      className="absolute right-2 top-8 p-1 text-indigo-600 hover:text-indigo-800"
      title="Buscar usuario"
    >
      <MagnifyingGlassIcon className="w-4 h-4" />
    </button>
  </div>
  <Input label="Correo Electrónico *" type="email" value={autor.email} onChange={(e) => updateAuthor(index, 'email', e.target.value)} />
  <Input label="Institución Académica" value={autor.institution} onChange={(e) => updateAuthor(index, 'institution', e.target.value)} />
  <div>
    <Input label="ID ORCID" value={autor.orcid} onChange={(e) => updateAuthor(index, 'orcid', e.target.value)} placeholder="0000-0000-0000-0000" className="font-mono text-sm" />
    {autor.authorId && (
      <p className="text-[10px] text-emerald-600 mt-1 font-mono">UID: {autor.authorId}</p>
    )}
  </div>
</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <Input label="Taxonomía CRediT" value={autor.contribution || ''} onChange={(e) => updateAuthor(index, 'contribution', e.target.value)} placeholder="Conceptualización, Metodología..." />
                      <div className="flex flex-col justify-end gap-2">
                         <label className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 cursor-pointer">
                          <input type="checkbox" checked={autor.isCorresponding} onChange={(e) => updateAuthor(index, 'isCorresponding', e.target.checked)} className="rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                          <EnvelopeIcon className="w-4 h-4 text-slate-400" /> Designar como Correspondencia
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Modal de búsqueda de usuarios */}
<AnimatePresence>
  {showAuthorSearch && (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-slate-900/50" onClick={() => setShowAuthorSearch(false)} />
      <motion.div 
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white w-full max-w-md rounded-lg shadow-xl relative z-10 p-6"
      >
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-bold text-slate-900">Buscar Usuario Registrado</h4>
          <button onClick={() => setShowAuthorSearch(false)} className="p-1 hover:bg-slate-100 rounded">
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <div className="relative mb-4">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none text-sm"
            value={authorSearchTerm}
            onChange={(e) => {
              setAuthorSearchTerm(e.target.value);
              searchUsers(e.target.value);
            }}
            autoFocus
          />
        </div>
        
        <div className="max-h-64 overflow-y-auto space-y-2">
          {searchingAuthors ? (
            <div className="flex justify-center py-4">
              <ArrowPathIcon className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : authorSearchResults.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              {authorSearchTerm.length < 2 ? 'Escribe al menos 2 caracteres...' : 'No se encontraron usuarios'}
            </p>
          ) : (
            authorSearchResults.map((user) => (
              <button
                key={user.uid}
                type="button"
                onClick={() => assignUserToAuthor(user)}
                className="w-full p-3 text-left border border-slate-200 rounded-md hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{user.uid.substring(0, 8)}...</span>
                </div>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
                <button type="button" onClick={addAuthor} className="w-full py-3 border border-dashed border-slate-300 rounded-md text-slate-600 hover:border-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 text-sm font-medium">
                  <PlusIcon className="w-4 h-4" /> Registrar Coautor
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <Input label="Disciplina Académica" name="area" value={formData.area} onChange={handleChange} />
              <Input label="Clasificación (ES)" name="tipo" value={formData.tipo} onChange={handleChange} placeholder="Ej: Artículo de Investigación" />
            </div>
            <Input label="Classification (EN)" name="type" value={formData.type} onChange={handleChange} />
          </div>
        )}

        {activeStep === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <Input label="Volumen" name="volumen" value={formData.volumen} onChange={handleChange} />
              <Input label="Número (Issue)" name="numero" value={formData.numero} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <Input label="Fecha Publicación" name="fecha" type="date" value={formData.fecha} onChange={handleChange} />
              <Input label="Paginación Inicial" name="primeraPagina" value={formData.primeraPagina} onChange={handleChange} placeholder="01" />
              <Input label="Paginación Final" name="ultimaPagina" value={formData.ultimaPagina} onChange={handleChange} placeholder="15" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-200">
              <Input label="Recepción (Historial)" name="receivedDate" type="date" value={formData.receivedDate} onChange={handleChange} />
              <Input label="Aceptación (Historial)" name="acceptedDate" type="date" value={formData.acceptedDate} onChange={handleChange} />
            </div>
          </div>
        )}

        {activeStep === 2 && (
          <div className="space-y-4">
            <div className="flex space-x-1 mb-4 bg-slate-100 p-1 rounded-md max-w-fit">
              <button type="button" onClick={() => setFormData({...formData, htmlMode: 'visual'})} className={`py-1.5 px-4 rounded flex items-center gap-2 text-xs font-semibold uppercase tracking-wider transition-all ${formData.htmlMode === 'visual' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                <PencilSquareIcon className="w-4 h-4" /> WYSIWYG
              </button>
              <button type="button" onClick={() => setFormData({...formData, htmlMode: 'code'})} className={`py-1.5 px-4 rounded flex items-center gap-2 text-xs font-semibold uppercase tracking-wider transition-all ${formData.htmlMode === 'code' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                <CodeBracketIcon className="w-4 h-4" /> Fuente HTML
              </button>
            </div>
            {formData.htmlMode === 'visual' ? (
              <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                <ReactQuill theme="snow" modules={quillModules} value={formData.html_es} onChange={(v) => setFormData({...formData, html_es: v})} className="h-80" />
              </div>
            ) : (
              <div className="border border-slate-300 rounded-md overflow-hidden">
                <CodeMirror value={formData.html_es || ''} height="400px" extensions={[html()]} theme={oneDark} onChange={(value) => setFormData({...formData, html_es: value})} className="text-sm font-mono" />
              </div>
            )}
          </div>
        )}

        {activeStep === 3 && (
          <div className="space-y-4">
             <label className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 block">Cuerpo del Artículo (Inglés)</label>
            <div className="border border-slate-300 rounded-md overflow-hidden">
              <CodeMirror value={formData.html_en || ''} height="400px" extensions={[html()]} theme={oneDark} onChange={(value) => setFormData({...formData, html_en: value})} className="text-sm font-mono" />
            </div>
          </div>
        )}

        {activeStep === 4 && (
          <div className="space-y-4">
             <label className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 block">Referencias Bibliográficas (Formato HTML)</label>
            <div className="border border-slate-300 rounded-md overflow-hidden">
              <CodeMirror value={formData.referencias || ''} height="400px" extensions={[html()]} theme={oneDark} onChange={(value) => setFormData({...formData, referencias: value})} className="text-sm font-mono" />
            </div>
          </div>
        )}

        {activeStep === 5 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Input label="Descriptores (ES)" name="palabras_clave" value={formData.palabras_clave} onChange={handleChange} placeholder="Ej: marxismo; sociología" />
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Separadas por punto y coma (;)</p>
              </div>
              <div>
                <Input label="Keywords (EN)" name="keywords_english" value={formData.keywords_english} onChange={handleChange} placeholder="Ej: marxism; sociology" />
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Separated by semicolons (;)</p>
              </div>
              <div>
                <Input label="Clasificación JEL / Códigos" name="specialized_codes" value={formData.specialized_codes} onChange={handleChange} placeholder="Ej: B14; Z13" className="font-mono text-sm" />
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Códigos alfanuméricos (;)</p>
              </div>
              <div>
                <Input label="Sistema de Vocabulario" name="keywords_vocabulary" value={formData.keywords_vocabulary} onChange={handleChange} placeholder="Ej: JEL, MeSH" />
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Taxonomía utilizada</p>
              </div>
            </div>
            
            <div className="pt-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Resumen Documental (ES)</label>
                <textarea className="w-full p-3 border border-slate-300 rounded-md h-32 focus:ring-1 focus:ring-indigo-500 outline-none text-sm leading-relaxed resize-y" value={formData.resumen} onChange={(e) => setFormData({...formData, resumen: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Abstract (EN)</label>
                <textarea className="w-full p-3 border border-slate-300 rounded-md h-32 focus:ring-1 focus:ring-indigo-500 outline-none text-sm leading-relaxed resize-y" value={formData.abstract} onChange={(e) => setFormData({...formData, abstract: e.target.value})} />
              </div>
            </div>
          </div>
        )}

        {activeStep === 6 && (
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-md p-6 flex flex-col items-center justify-center text-center">
              <DocumentTextIcon className="w-10 h-10 text-slate-400 mb-3" />
              <p className="text-sm font-medium text-slate-800 mb-1">Versión Final PDF (Galley)</p>
              <p className="text-xs text-slate-500 mb-4">Sube el documento maquetado para la lectura pública</p>
              <input type="file" accept=".pdf" className="hidden" id="pdf-upload" onChange={(e) => setFormData({...formData, pdfFile: e.target.files[0]})} />
              <label htmlFor="pdf-upload" className="bg-white border border-slate-300 px-4 py-2 rounded text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50 shadow-sm transition-all">
                {formData.pdfFile ? formData.pdfFile.name : "Examinar Archivos"}
              </label>
              {formData.pdfUrl && !formData.pdfFile && <p className="text-[10px] text-slate-400 mt-3 font-mono">Galley actual: {formData.pdfUrl.split('/').pop()}</p>}
            </div>

            // REEMPLAZAR la sección de "Declaración de Financiación" y siguientes por:
<div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
  <div>
    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Declaración de Financiación (ES)</label>
    <textarea className="w-full p-3 border border-slate-300 rounded-md h-20 text-sm" name="funding" value={formData.funding} onChange={handleChange} />
  </div>
  <div>
    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Funding Statement (EN)</label>
    <textarea className="w-full p-3 border border-slate-300 rounded-md h-20 text-sm" name="fundingEnglish" value={formData.fundingEnglish} onChange={handleChange} />
  </div>
  <div>
    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Conflictos de Interés (ES)</label>
    <textarea className="w-full p-3 border border-slate-300 rounded-md h-20 text-sm" name="conflicts" value={formData.conflicts} onChange={handleChange} />
  </div>
  <div>
    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Conflicts of Interest (EN)</label>
    <textarea className="w-full p-3 border border-slate-300 rounded-md h-20 text-sm" name="conflictsEnglish" value={formData.conflictsEnglish} onChange={handleChange} />
  </div>
  <div>
    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Disponibilidad de Datos (ES)</label>
    <textarea className="w-full p-3 border border-slate-300 rounded-md h-20 text-sm" name="dataAvailability" value={formData.dataAvailability} onChange={handleChange} />
  </div>
  <div>
    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Data Availability (EN)</label>
    <textarea className="w-full p-3 border border-slate-300 rounded-md h-20 text-sm" name="dataAvailabilityEnglish" value={formData.dataAvailabilityEnglish} onChange={handleChange} />
  </div>
  <div>
    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Agradecimientos (ES)</label>
    <textarea className="w-full p-3 border border-slate-300 rounded-md h-20 text-sm" name="acknowledgments" value={formData.acknowledgments} onChange={handleChange} />
  </div>
  <div>
    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Acknowledgments (EN)</label>
    <textarea className="w-full p-3 border border-slate-300 rounded-md h-20 text-sm" name="acknowledgmentsEnglish" value={formData.acknowledgmentsEnglish} onChange={handleChange} />
  </div>
  <div>
    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Créditos de Autoría (ES)</label>
    <textarea className="w-full p-3 border border-slate-300 rounded-md h-20 text-sm" name="authorCredits" value={formData.authorCredits} onChange={handleChange} />
  </div>
  <div>
    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Author Credits (EN)</label>
    <textarea className="w-full p-3 border border-slate-300 rounded-md h-20 text-sm" name="authorCreditsEnglish" value={formData.authorCreditsEnglish} onChange={handleChange} />
  </div>
</div>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-auto pt-4 border-t border-slate-200">
        <button type="button" onClick={() => setActiveStep(Math.max(0, activeStep - 1))} disabled={activeStep === 0} className="px-5 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-md disabled:opacity-40 disabled:bg-slate-50 transition-colors">Anterior</button>
        <button type="button" onClick={() => setActiveStep(Math.min(6, activeStep + 1))} disabled={activeStep === 6} className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md disabled:opacity-40 hover:bg-indigo-700 shadow-sm transition-colors">Siguiente Etapa</button>
      </div>
    </div>
  );
};

// ==================== COMPONENTES DE LISTA ====================

const ArticleList = ({ articles, expandedArticles, onToggleExpand, onEdit, onDelete, formatDate }) => (
  <div className="divide-y divide-slate-100">
    {articles.length === 0 ? (
      <div className="px-8 py-20 text-center bg-slate-50">
        <DocumentTextIcon className="mx-auto h-12 w-12 text-slate-300" />
        <h3 className="mt-4 text-sm font-bold uppercase tracking-widest text-slate-600">No hay registros</h3>
      </div>
    ) : (
      <div className="max-h-[70vh] overflow-y-auto bg-white">
        {articles.map((article) => (
          <motion.div key={article.numeroArticulo || article.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-slate-50/50 transition-colors">
            <div className="px-6 py-5 cursor-pointer flex justify-between items-start" onClick={() => onToggleExpand(article.numeroArticulo)}>
              <div className="flex-1 min-w-0 pr-4">
                <h3 className="text-lg font-bold text-slate-900 font-serif leading-snug" title={article.titulo}>{article.titulo}</h3>
                <p className="mt-1.5 text-sm text-slate-600 truncate" title={article.autores?.map(a => a.name).join('; ')}>{article.autores?.map(a => a.name).join('; ')}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 border border-slate-200 text-slate-700 rounded text-[10px] font-bold uppercase tracking-wider">Vol. {article.volumen} ({article.numero})</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">{article.area}</span>
                  {article.doi && (
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[10px] font-mono">
                      DOI: {article.doi?.substring(0, 20)}...
                    </span>
                  )}
                </div>
              </div>
              <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform duration-300 mt-1 ${expandedArticles[article.numeroArticulo] ? 'rotate-180' : ''}`} />
            </div>
            
            <AnimatePresence>
              {expandedArticles[article.numeroArticulo] && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-6 pb-6 bg-slate-50 border-t border-slate-100">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-6 text-sm">
                    <div className="lg:col-span-2 space-y-6">
                      <div>
                        <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs mb-2">Resumen</h4>
                        <div className="text-slate-700 leading-relaxed text-sm text-justify" dangerouslySetInnerHTML={{ __html: article.resumen || 'No disponible' }} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs mb-2">Abstract</h4>
                        <div className="text-slate-700 leading-relaxed text-sm text-justify" dangerouslySetInnerHTML={{ __html: article.abstract || 'No disponible' }} />
                      </div>
                      
                      {article.specialized_codes && (Array.isArray(article.specialized_codes) ? article.specialized_codes : 
                        (typeof article.specialized_codes === 'string' ? article.specialized_codes.split(';').map(c => c.trim()).filter(Boolean) : [])
                      ).length > 0 && (
                        <div>
                          <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs mb-2">
                            Códigos Especializados
                            {article.keywords_vocabulary && <span className="text-xs font-normal text-slate-500 ml-2">({article.keywords_vocabulary})</span>}
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {(Array.isArray(article.specialized_codes) ? article.specialized_codes : 
                              (typeof article.specialized_codes === 'string' ? article.specialized_codes.split(';').map(c => c.trim()).filter(Boolean) : [])
                            ).map((code, idx) => (
                              <span key={idx} className="inline-flex items-center px-2 py-0.5 bg-amber-50 border border-amber-300 rounded-full text-xs font-mono font-bold text-amber-800">
                                {code}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs mb-2">Palabras Clave (ES)</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {(Array.isArray(article.palabras_clave) ? article.palabras_clave : 
                            (typeof article.palabras_clave === 'string' ? article.palabras_clave.split(';').map(k => k.trim()).filter(Boolean) : [])
                          ).map((kw, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs mb-2">Keywords (EN)</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {(Array.isArray(article.keywords_english) ? article.keywords_english : 
                            (typeof article.keywords_english === 'string' ? article.keywords_english.split(';').map(k => k.trim()).filter(Boolean) : [])
                          ).map((kw, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      {article.referencias && (
                        <div>
                          <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs mb-2">Referencias</h4>
                          <div className="text-slate-700 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: article.referencias }} />
                        </div>
                      )}
                    </div>

                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div><p className="text-slate-500 text-[10px] uppercase tracking-wider">Publicación</p><p className="font-medium text-sm">{formatDate(article.fecha)}</p></div>
                        <div><p className="text-slate-500 text-[10px] uppercase tracking-wider">Vol/Núm</p><p className="font-medium text-sm">{article.volumen}/{article.numero}</p></div>
                        <div><p className="text-slate-500 text-[10px] uppercase tracking-wider">Páginas</p><p className="font-medium text-sm">{article.primeraPagina}-{article.ultimaPagina}</p></div>
                        <div><p className="text-slate-500 text-[10px] uppercase tracking-wider">Área</p><p className="font-medium text-sm">{article.area}</p></div>
                        <div><p className="text-slate-500 text-[10px] uppercase tracking-wider">Tipo</p><p className="font-medium text-sm">{article.tipo}</p></div>
                        <div><p className="text-slate-500 text-[10px] uppercase tracking-wider">Type</p><p className="font-medium text-sm">{article.type || 'N/A'}</p></div>
                        {article.doi && (
                          <div className="col-span-2">
                            <p className="text-slate-500 text-[10px] uppercase tracking-wider">DOI</p>
                            <a href={`https://doi.org/${article.doi}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline text-sm font-medium">{article.doi}</a>
                          </div>
                        )}
                      </div>

                      {article.autores && article.autores.length > 0 && (
                        <div>
                          <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs mb-2">Detalle de Autores</h4>
                          <div className="space-y-2">
                            {article.autores.map((autor, idx) => (
                              <div key={idx} className="text-xs bg-white p-3 rounded border border-slate-200">
                                <p className="font-bold text-sm">{autor.name}</p>
                                <div className="grid grid-cols-2 gap-2 mt-2 text-slate-600">
                                  {autor.email && <p className="flex items-center gap-1"><EnvelopeIcon className="w-3 h-3" /> {autor.email}</p>}
                                  {autor.institution && <p className="flex items-center gap-1"><AcademicCapIcon className="w-3 h-3" /> {autor.institution}</p>}
                                  {autor.orcid && <p className="flex items-center gap-1 font-mono text-[10px]">{autor.orcid}</p>}
                                  {autor.contribution && <p className="col-span-2 flex items-start gap-1"><PencilIcon className="w-3 h-3 mt-0.5" /> {autor.contribution}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {article.submissionId && (
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase tracking-wider">Submission ID</p>
                          <p className="font-mono text-xs text-slate-700">{article.submissionId}</p>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                        {article.pdfUrl && (
                          <a href={article.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 transition-colors text-xs">
                            <DocumentIcon className="w-4 h-4 mr-2" /> PDF Galley
                          </a>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); onEdit(article); }} className="px-4 py-2 text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md hover:bg-indigo-100 font-medium text-xs transition-colors">
                          Editar Metadatos
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(article.numeroArticulo); }} className="px-4 py-2 text-red-700 bg-red-50 border border-red-100 rounded-md hover:bg-red-100 font-medium text-xs transition-colors ml-auto">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    )}
  </div>
);

const VolumeList = ({ volumes, expandedVolumes, onToggleExpand, onEdit, onDelete, formatDate }) => (
  <div className="divide-y divide-slate-100">
    {volumes.length === 0 ? (
      <div className="px-8 py-16 text-center">
        <BookOpenIcon className="mx-auto h-16 w-16 text-slate-400" />
        <h3 className="mt-4 text-lg font-medium text-slate-900">No hay volúmenes</h3>
        <p className="mt-2 text-slate-500">Comienza agregando tu primer volumen.</p>
      </div>
    ) : (
      <div className="max-h-[600px] overflow-y-auto">
        {volumes.map((volume) => (
          <motion.div key={volume.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-slate-50 transition-colors">
            <div className="px-6 py-4 cursor-pointer flex justify-between items-center" onClick={() => onToggleExpand(volume.id)}>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-slate-900 truncate" title={volume.titulo}>{volume.titulo}</h3>
                <p className="mt-1 text-sm text-slate-600">Volumen {volume.volumen}, Número {volume.numero}</p>
                <div className="mt-2 flex items-center space-x-2">
                  <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">{formatDate(volume.fecha)}</span>
                  {volume.issn && <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-medium hidden sm:inline-block">ISSN: {volume.issn}</span>}
                </div>
              </div>
              <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform duration-300 flex-shrink-0 ${expandedVolumes[volume.id] ? 'rotate-180' : ''}`} />
            </div>
            <AnimatePresence>
              {expandedVolumes[volume.id] && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-6 pb-6 bg-slate-50">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {volume.editorial && <div><h4 className="font-semibold text-slate-900 mb-2">Nota Editorial</h4><div className="text-slate-700 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: volume.editorial }} /></div>}
                    {volume.englishEditorial && <div><h4 className="font-semibold text-slate-900 mb-2">Editorial Note</h4><div className="text-slate-700 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: volume.englishEditorial }} /></div>}
                    <div className="lg:col-span-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div><p className="text-slate-500 text-xs">Volumen</p><p className="font-medium">{volume.volumen}</p></div>
                        <div><p className="text-slate-500 text-xs">Número</p><p className="font-medium">{volume.numero}</p></div>
                        <div><p className="text-slate-500 text-xs">Fecha</p><p className="font-medium">{formatDate(volume.fecha)}</p></div>
                        {volume.issn && <div><p className="text-slate-500 text-xs">ISSN</p><p className="font-medium">{volume.issn}</p></div>}
                      </div>
                    </div>
                    {volume.portada && <div className="lg:col-span-2"><h4 className="font-semibold text-slate-900 mb-2">Portada</h4><img src={volume.portada} alt={volume.titulo} className="max-h-48 rounded-lg shadow-md" /></div>}
                    {volume.heroImage && (
                      <div className="lg:col-span-2">
                        <h4 className="font-semibold text-slate-900 mb-2">Imagen Hero</h4>
                        <img src={volume.heroImage} alt={`Hero de ${volume.titulo}`} className="max-h-48 rounded-lg shadow-md" />
                      </div>
                    )}
                    <div className="lg:col-span-2 flex items-center justify-between pt-4 border-t border-slate-200">
                      {volume.pdf && <a href={volume.pdf} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"><DocumentIcon className="w-4 h-4 mr-2" /> Ver PDF del Volumen</a>}
                      <div className="flex space-x-2 ml-auto">
                        <button onClick={(e) => { e.stopPropagation(); onEdit(volume); }} className="p-2 text-amber-600 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors"><PencilIcon className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(volume.id); }} className="p-2 text-red-600 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    )}
  </div>
);

// ==================== COMPONENTES ATÓMICOS Y AUXILIARES ====================

const UserSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchPerformed(true);
    setSearchResults([]);
    try {
      const usersRef = collection(db, 'users');
      const emailQuery = query(usersRef, where('email', '==', searchQuery.trim()), firestoreLimit(20));
      const emailSnapshot = await getDocs(emailQuery);
      let results = [];
      emailSnapshot.forEach((docSnapshot) => results.push({ id: docSnapshot.id, ...docSnapshot.data() }));
      if (results.length === 0) {
        const allUsersQuery = query(usersRef, firestoreLimit(100));
        const allSnapshot = await getDocs(allUsersQuery);
        allSnapshot.forEach((docSnapshot) => {
          const userData = docSnapshot.data();
          const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.toLowerCase();
          const displayName = userData.displayName?.toLowerCase() || '';
          const queryLower = searchQuery.toLowerCase();
          if (fullName.includes(queryLower) || displayName.includes(queryLower)) results.push({ id: docSnapshot.id, ...userData });
        });
        results = results.slice(0, 20);
      }
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleUserExpand = (userId) => setExpandedUser(expandedUser === userId ? null : userId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <input type="text" placeholder="Buscar por email o nombre..." className="flex-1 px-4 py-3 bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
        <button onClick={handleSearch} disabled={isSearching} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-md flex items-center justify-center gap-2 font-medium shadow-sm transition-all disabled:opacity-50 text-sm">
          {isSearching ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <MagnifyingGlassIcon className="w-4 h-4" />} Buscar
        </button>
      </div>
      {searchPerformed && (
        <div className="mt-4">
          <p className="text-sm text-slate-500 mb-3">{searchResults.length === 0 ? 'No se encontraron usuarios.' : `Se encontraron ${searchResults.length} usuario(s).`}</p>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {searchResults.map((user) => (
              <div key={user.id} className="border border-slate-200 rounded-md overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 cursor-pointer flex justify-between items-center hover:bg-slate-100 transition-colors" onClick={() => toggleUserExpand(user.id)}>
                  <div className="flex items-center gap-3">
                    <UserIcon className="w-5 h-5 text-slate-400" />
                    <div>
                      <h4 className="font-medium text-slate-900">{user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Sin nombre'}</h4>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform ${expandedUser === user.id ? 'rotate-180' : ''}`} />
                </div>
                <AnimatePresence>
                  {expandedUser === user.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-4 py-4 bg-white border-t border-slate-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Datos Personales</h5>
                          <ul className="space-y-1">
                            <li><span className="font-medium">UID:</span> <span className="text-slate-600 font-mono text-xs">{user.id}</span></li>
                            <li><span className="font-medium">Email:</span> {user.email}</li>
                            <li><span className="font-medium">Teléfono:</span> {user.phoneNumber || 'No disponible'}</li>
                            <li><span className="font-medium">Verificado:</span> {user.emailVerified ? 'Sí' : 'No'}</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Roles</h5>
                          <div className="flex flex-wrap gap-1">
                            {user.roles && user.roles.length > 0 ? user.roles.map((role, idx) => <span key={idx} className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs">{role}</span>) : <span className="text-slate-400">Sin roles</span>}
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Metadatos</h5>
                          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <li><span className="font-medium">Creado:</span> {user.createdAt?.toDate?.()?.toLocaleString() || user.createdAt || 'N/A'}</li>
                            <li><span className="font-medium">Último acceso:</span> {user.lastLoginAt?.toDate?.()?.toLocaleString() || user.lastLoginAt || 'N/A'}</li>
                            <li><span className="font-medium">Última actualización:</span> {user.updatedAt?.toDate?.()?.toLocaleString() || user.updatedAt || 'N/A'}</li>
                            <li><span className="font-medium">Envíos totales:</span> {user.totalSubmissions || 0}</li>
                          </ul>
                        </div>
                        {user.claimedAnonymousUid && (
                          <div className="md:col-span-2 bg-amber-50 p-2 rounded border border-amber-100">
                            <p className="text-xs text-amber-800"><span className="font-bold">Perfil anónimo reclamado:</span> {user.claimedAnonymousName} ({user.claimedAnonymousUid})</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const VolumeForm = ({ formData, setFormData, isEditing }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      if (name === 'fecha' || name === 'volumen') {
        const year = new Date(newData.fecha).getFullYear();
        if (newData.volumen && year && !isNaN(year)) {
          if (!newData.titulo || name === 'fecha' || name === 'volumen') newData.titulo = `Volumen ${newData.volumen} (${year})`;
          if (!newData.englishTitulo || name === 'fecha' || name === 'volumen') newData.englishTitulo = `Volume ${newData.volumen} (${year})`;
        }
      }
      return newData;
    });
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Volumen *" name="volumen" value={formData.volumen} onChange={handleChange} required />
        <Input label="Número *" name="numero" value={formData.numero} onChange={handleChange} required />
      </div>
      <Input label="Fecha" name="fecha" type="date" value={formData.fecha} onChange={handleChange} />
      <Input label="Título del Volumen (ES)" name="titulo" value={formData.titulo} onChange={handleChange} placeholder="Ej: Volumen 1 (2024)" />
      <Input label="Título del Volumen (EN)" name="englishTitulo" value={formData.englishTitulo} onChange={handleChange} placeholder="Ej: Volume 1 (2024)" />
      <Input label="ISSN" name="issn" value={formData.issn} onChange={handleChange} />
      <Input label="URL de Portada" name="portada" value={formData.portada} onChange={handleChange} />
      <Input label="URL de Imagen Hero" name="heroImage" value={formData.heroImage} onChange={handleChange} placeholder="URL para la imagen de fondo del hero" />
      <div><label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">Editorial Note (Español)</label><textarea className="w-full p-3 border border-slate-300 rounded-md h-24 focus:ring-1 focus:ring-indigo-500 outline-none text-sm" name="editorial" value={formData.editorial} onChange={handleChange} placeholder="Nota editorial en español..." /></div>
      <div><label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">Editorial Note (English)</label><textarea className="w-full p-3 border border-slate-300 rounded-md h-24 focus:ring-1 focus:ring-indigo-500 outline-none text-sm" name="englishEditorial" value={formData.englishEditorial} onChange={handleChange} placeholder="Editorial note in English..." /></div>
      <div className="p-6 border-2 border-dashed border-slate-200 rounded-md text-center">
        <DocumentIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500 mb-4">PDF del volumen completo (opcional)</p>
        <input type="file" accept=".pdf" className="hidden" id="volume-pdf-upload" onChange={(e) => setFormData({...formData, pdfFile: e.target.files[0]})} />
        <label htmlFor="volume-pdf-upload" className="bg-white border border-slate-300 px-6 py-2 rounded-md cursor-pointer hover:bg-slate-50 shadow-sm transition-all inline-block text-sm">
          {formData.pdfFile ? formData.pdfFile.name : "Seleccionar Archivo"}
        </label>
        {formData.pdf && !formData.pdfFile && <p className="text-xs text-slate-400 mt-2">PDF actual: {formData.pdf.split('/').pop()}</p>}
      </div>
    </div>
  );
};

const Input = ({ label, className, ...props }) => (
  <div>
    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">{label}</label>
    <input className={`w-full px-3 py-2 bg-white border border-slate-300 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm text-sm text-slate-800 ${className || ''}`} {...props} />
  </div>
);

const Modal = ({ show, onClose, title, children, onSave, isProcessing, hideSaveButton = false, size = 'lg' }) => {
  const sizeClasses = { sm: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };
  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className={`bg-white w-full ${sizeClasses[size]} rounded-lg shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]`}>
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold font-serif text-slate-900">{title}</h3>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded text-slate-500"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto">{children}</div>
            {!hideSaveButton && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                <button onClick={onClose} className="px-4 py-2 font-medium text-slate-600 hover:text-slate-900 text-sm">Cancelar</button>
                <button onClick={onSave} disabled={isProcessing} className="bg-indigo-600 text-white px-6 py-2 rounded-md font-semibold hover:bg-indigo-700 shadow-sm flex items-center gap-2 text-sm">
                  {isProcessing ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />} {isProcessing ? 'Guardando...' : 'Confirmar Cambios'}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const Notification = ({ status, clear }) => (
  <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} className="fixed bottom-6 right-6 z-[2000] p-4 rounded-md shadow-lg border-l-4 min-w-[300px] flex items-center justify-between bg-white border-slate-200">
    <div className="flex items-center gap-3">
      {status.type === 'success' ? <CheckIcon className="w-5 h-5 text-emerald-600" /> : <ExclamationTriangleIcon className="w-5 h-5 text-rose-600" />}
      <span className="font-medium text-sm text-slate-800">{status.msg}</span>
    </div>
    <button onClick={clear} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-4 h-4" /></button>
  </motion.div>
);

const SidebarItem = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md transition-all text-sm font-medium ${active ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
    {React.cloneElement(icon, { className: "w-5 h-5" })} <span>{label}</span>
  </button>
);

const SidebarItemMobile = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all text-sm font-medium ${active ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
    {React.cloneElement(icon, { className: "w-5 h-5" })} <span>{label}</span>
  </button>
);

const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
    <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
    <p className="font-bold text-[10px] uppercase tracking-widest text-slate-400">Iniciando Portal Editorial...</p>
  </div>
);

const AccessDenied = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="text-center p-10 bg-white rounded-lg shadow-sm border border-slate-200 max-w-sm">
      <ExclamationTriangleIcon className="w-12 h-12 text-rose-500 mx-auto mb-4" />
      <h2 className="text-lg font-bold text-slate-900 font-serif mb-2">Acceso Denegado</h2>
      <p className="text-sm text-slate-500">Credenciales insuficientes para la capa directiva.</p>
    </div>
  </div>
);