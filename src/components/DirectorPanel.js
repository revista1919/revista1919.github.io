// DirectorPanel.js (Componente completo con flujo mejorado)
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '../firebase';
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
import {
  PlusIcon, PencilIcon, TrashIcon, CheckIcon, ExclamationTriangleIcon,
  DocumentTextIcon, ArrowPathIcon, BookOpenIcon, DocumentIcon,
  XMarkIcon, ChevronRightIcon, MagnifyingGlassIcon, InboxIcon,
  UserGroupIcon, ChartBarIcon, CodeBracketIcon, PencilSquareIcon,
  GlobeAltIcon, PhotoIcon, ChevronDownIcon, UserIcon, EnvelopeIcon,
  IdentificationIcon, AcademicCapIcon, ArrowDownTrayIcon, InformationCircleIcon
} from '@heroicons/react/24/outline';

// --- Constantes de Configuración ---
const DOMAIN = 'https://www.revistacienciasestudiantes.com';
const ARTICLES_JSON_URL = `${DOMAIN}/articles.json`;
const MANAGE_ARTICLES_URL = 'https://managearticles-ggqsq2kkua-uc.a.run.app/manageArticles';
const MANAGE_VOLUMES_URL = 'https://managevolumes-ggqsq2kkua-uc.a.run.app/';
const REBUILD_URL = 'https://triggerrebuild-ggqsq2kkua-uc.a.run.app/';
const REPO_OWNER = 'revista1919';
const REPO_NAME = 'revista1919.github.io';

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
  contribution: '', // Nuevo campo para CRediT
};

// --- Estados Iniciales ---
const initialArticleState = {
  numeroArticulo: null,
  titulo: '',
  tituloEnglish: '',
  autores: [],
  resumen: '',
  abstract: '',
  palabras_clave: '',
  keywords_english: '',
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
  lastVersionFileUrl: null, // Para guardar el enlace al último archivo de versión
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

  // Modales
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [showVolumeModal, setShowVolumeModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Modal de búsqueda de submissions (nuevo paso inicial)
  const [showSubmissionSelector, setShowSubmissionSelector] = useState(false);
  const [submissionSearchTerm, setSubmissionSearchTerm] = useState('');
  const [readySubmissions, setReadySubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [importSummary, setImportSummary] = useState(null); // Para mostrar resumen después de importar

  // Forms
  const [articleForm, setArticleForm] = useState(initialArticleState);
  const [volumeForm, setVolumeForm] = useState(initialVolumeState);

  // --- Lógica de Acceso y Datos ---
  const hasAccess = useMemo(() => user?.roles?.includes('Director General'), [user]);

  // --- Cargar borradores SOLO al abrir modal (ahora solo cuando se edita, no al crear nuevo porque primero pasa por selector) ---
  useEffect(() => {
    if (showArticleModal && editingItem) {
      setArticleForm(prev => ({
        ...prev,
        ...editingItem,
        autores: Array.isArray(editingItem.autores) ? editingItem.autores : [],
      }));
    }
  }, [showArticleModal, editingItem]);

  // --- Guardar borradores solo para edición ---
  useEffect(() => {
    if (showArticleModal && editingItem) {
      localStorage.setItem('draftEditArticle', JSON.stringify(articleForm));
    }
  }, [articleForm, showArticleModal, editingItem]);

  // --- Cargar artículos desde JSON ---
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
                            (typeof article.keywords_english === 'string' ? article.keywords_english.split(';').map(k => k.trim()).filter(k => k) : [])
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

  // --- Cargar submissions listos (publicationReady = true) ---
  const loadReadySubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const submissionsRef = collection(db, 'submissions');
      const q = query(submissionsRef, where('publicationReady', '==', true));
      const querySnapshot = await getDocs(q);
      const submissions = [];
      
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        // Obtener la última versión de archivo (subcolección 'versions')
        const versionsRef = collection(db, 'submissions', doc.id, 'versions');
        const versionsSnap = await getDocs(query(versionsRef, firestoreLimit(1)));
        let lastVersionFileUrl = null;
        versionsSnap.forEach(versionDoc => {
          const versionData = versionDoc.data();
          // Tomar el archivo más reciente (asumiendo que están ordenados por versión)
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
          lastVersionFileUrl, // Guardamos el enlace
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

  // --- Abrir selector de envíos (primer paso) ---
  const handleOpenSubmissionSelector = () => {
    loadReadySubmissions();
    setSubmissionSearchTerm('');
    setSelectedSubmission(null);
    setImportSummary(null);
    setShowSubmissionSelector(true);
  };

  // --- IMPORTAR TODOS LOS DATOS DESDE LA SUBMISSION SELECCIONADA ---
  const importFromSubmission = async (submission) => {
    if (!submission) return;

    setIsProcessing(true);
    setStatus({ type: 'info', msg: 'Importando datos del envío...' });

    try {
      // Usar currentMetadata si existe, si no, los datos principales
      const metadata = submission.currentMetadata || submission;
      
      // 1. Procesar autores con sus contribuciones
      const importedAuthors = (metadata.authors || submission.authors || []).map(author => ({
        name: author.name || `${author.firstName || ''} ${author.lastName || ''}`.trim(),
        email: author.email || '',
        institution: author.institution || '',
        orcid: author.orcid || '',
        authorId: author.uid || author.authorId || null,
        isCorresponding: author.isCorresponding || false,
        contribution: author.contribution || '', // CRediT
      }));

      // 2. Consolidar contribuciones en authorCredits
      const authorCreditsText = importedAuthors
        .map(a => `${a.name}: ${a.contribution || 'Sin contribución especificada'}`)
        .join('\n');
      
      // 3. Financiamiento: combinar sources y grantNumbers
      let fundingText = 'No declarada';
      if (metadata.funding) {
        const sources = metadata.funding.sources || '';
        const grants = metadata.funding.grantNumbers || '';
        fundingText = [sources, grants].filter(Boolean).join(' - ') || 'No declarada';
      }

      // 4. Palabras clave
      const palabrasClave = metadata.keywords || metadata.palabras_clave || [];
      const keywordsEnglish = metadata.keywordsEn || metadata.keywords_english || [];

      // 5. Fechas aproximadas
      const receivedDate = submission.createdAt ? submission.createdAt.toISOString().split('T')[0] : '';
      const acceptedDate = submission.publicationReadyAt ? submission.publicationReadyAt.toISOString().split('T')[0] : 
                           (submission.decisionMadeAt ? submission.decisionMadeAt.toISOString().split('T')[0] : '');

      // 6. Construir objeto con todos los campos
      const importedData = {
        titulo: metadata.title || submission.title || '',
        tituloEnglish: metadata.titleEn || submission.titleEn || '',
        autores: importedAuthors,
        resumen: metadata.abstract || '',
        abstract: metadata.abstractEn || '',
        palabras_clave: Array.isArray(palabrasClave) ? palabrasClave.join('; ') : palabrasClave || '',
        keywords_english: Array.isArray(keywordsEnglish) ? keywordsEnglish.join('; ') : keywordsEnglish || '',
        area: metadata.area || '',
        tipo: metadata.articleType || metadata.tipo || '',
        type: metadata.type || metadata.articleType || '',
        acknowledgments: metadata.acknowledgments || '',
        acknowledgmentsEnglish: metadata.acknowledgmentsEn || '',
        conflicts: metadata.conflictOfInterest || metadata.conflicts || 'Los autores declaran no tener conflictos de interés.',
        conflictsEnglish: metadata.conflictsEnglish || 'The authors declare no conflicts of interest.',
        funding: fundingText,
        fundingEnglish: metadata.fundingEnglish || fundingText,
        dataAvailability: metadata.dataAvailability || '',
        dataAvailabilityEnglish: metadata.dataAvailabilityEn || '',
        authorCredits: authorCreditsText,
        authorCreditsEnglish: metadata.authorCreditsEnglish || authorCreditsText,
        receivedDate: receivedDate,
        acceptedDate: acceptedDate,
        submissionId: submission.submissionId || submission.id,
        lastVersionFileUrl: submission.lastVersionFileUrl || null,
        // Links de Drive para referencia
        driveFolderUrl: submission.driveFolderUrl,
        editorialFolderUrl: submission.editorialFolderUrl,
      };

      setArticleForm(prev => ({ ...prev, ...importedData }));

      // Guardar resumen de importación
      setImportSummary({
        fields: [
          'título', 'título inglés', 'resumen', 'abstract', 'palabras clave', 'keywords',
          'área', 'tipo de artículo', 'autores', 'contribuciones', 'conflictos', 'financiamiento',
          'agradecimientos', 'disponibilidad de datos', 'fechas aproximadas', 'submission ID'
        ],
        lastVersionFileUrl: submission.lastVersionFileUrl,
        driveFolderUrl: submission.driveFolderUrl,
        editorialFolderUrl: submission.editorialFolderUrl,
      });

      setStatus({ type: 'success', msg: '✅ Datos importados correctamente. Revise los campos y complete los que faltan.' });
      
      // Cerrar selector y abrir modal de artículo
      setShowSubmissionSelector(false);
      setShowArticleModal(true);
      
    } catch (error) {
      console.error("Error importing submission:", error);
      setStatus({ type: 'error', msg: `❌ Error al importar: ${error.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Filtrado de submissions ---
  const filteredReadySubmissions = useMemo(() => {
    if (!submissionSearchTerm.trim()) return readySubmissions;
    const term = submissionSearchTerm.toLowerCase();
    return readySubmissions.filter(sub => 
      sub.title.toLowerCase().includes(term) ||
      sub.submissionId.toLowerCase().includes(term) ||
      sub.authorName.toLowerCase().includes(term)
    );
  }, [readySubmissions, submissionSearchTerm]);

  // --- Filtrado de artículos publicados ---
  const filteredArticles = articles.filter(a => 
    a.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.autores?.some(author => author.name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // --- Rebuild ---
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
      setStatus({ type: 'success', msg: '✅ Sitio web actualizándose en segundo plano.' });
    } catch (e) { 
      setStatus({ type: 'error', msg: 'Error al reconstruir: ' + e.message }); 
    }
  };

  // --- Guardar artículo ---
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
        contribution: autor.contribution, // Incluir contribution
      }));

      // Procesar palabras clave
      let palabrasClaveArray = [];
      if (articleForm.palabras_clave) {
        if (Array.isArray(articleForm.palabras_clave)) {
          palabrasClaveArray = articleForm.palabras_clave;
        } else if (typeof articleForm.palabras_clave === 'string') {
          palabrasClaveArray = articleForm.palabras_clave.split(';').map(k => k.trim()).filter(k => k);
        }
      }

      let keywordsArray = [];
      if (articleForm.keywords_english) {
        if (Array.isArray(articleForm.keywords_english)) {
          keywordsArray = articleForm.keywords_english;
        } else if (typeof articleForm.keywords_english === 'string') {
          keywordsArray = articleForm.keywords_english.split(';').map(k => k.trim()).filter(k => k);
        }
      }

      const articleData = {
        titulo: articleForm.titulo,
        tituloEnglish: articleForm.tituloEnglish,
        autores: autoresParaBackend,
        resumen: articleForm.resumen,
        abstract: articleForm.abstract,
        palabras_clave: palabrasClaveArray,
        keywords_english: keywordsArray,
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
        acknowledgmentsEnglish: articleForm.acknowledgmentsEnglish,
        authorCredits: articleForm.authorCredits,
        authorCreditsEnglish: articleForm.authorCreditsEnglish,
        dataAvailability: articleForm.dataAvailability,
        dataAvailabilityEnglish: articleForm.dataAvailabilityEnglish,
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
      
      setStatus({ type: 'success', msg: action === 'publish' ? '✅ Artículo publicado exitosamente' : '✅ Artículo guardado exitosamente' });
      
    } catch (err) {
      console.error("Error saving article:", err);
      setStatus({ type: 'error', msg: `❌ Error: ${err.message}` });
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
      setStatus({ type: 'success', msg: '✅ Volumen guardado exitosamente' });
    } catch (err) {
      setStatus({ type: 'error', msg: `❌ Error: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id, type) => {
    if (!confirm(`¿Estás seguro de eliminar este ${type === 'article' ? 'artículo' : 'volumen'}?`)) return;
    
    try {
      setStatus({ type: 'info', msg: 'Eliminando...' });
      const token = await auth.currentUser.getIdToken();
      const url = type === 'article' ? MANAGE_ARTICLES_URL : MANAGE_VOLUMES_URL;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'delete', id }),
      });

      if (!response.ok) throw new Error(await response.text());

      await triggerRebuild();
      setStatus({ type: 'success', msg: '✅ Eliminado exitosamente' });
    } catch (err) {
      setStatus({ type: 'error', msg: `❌ Error: ${err.message}` });
    }
  };

  // --- UI Helpers ---
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
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#f4f7f9] text-[#1a1a1a]">
      {/* Mobile Header y Sidebar (igual que antes) */}
      <div className="lg:hidden bg-[#001529] text-white p-4 flex justify-between items-center sticky top-0 z-30">
        <div>
          <h1 className="text-xl font-bold">RNCPE Admin</h1>
          <p className="text-xs text-gray-400">Director General</p>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 hover:bg-white/10 rounded-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} className="lg:hidden fixed inset-0 z-40 bg-[#001529] w-64 pt-20">
            <nav className="p-4 space-y-2">
              <SidebarItemMobile active={activeTab === 'articles'} onClick={() => { setActiveTab('articles'); setMobileMenuOpen(false); }} icon={<DocumentTextIcon />} label="Artículos" />
              <SidebarItemMobile active={activeTab === 'volumes'} onClick={() => { setActiveTab('volumes'); setMobileMenuOpen(false); }} icon={<BookOpenIcon />} label="Volúmenes" />
              <SidebarItemMobile active={activeTab === 'team'} onClick={() => { setActiveTab('team'); setMobileMenuOpen(false); }} icon={<UserGroupIcon />} label="Equipo / Mails" />
              <SidebarItemMobile active={activeTab === 'admissions'} onClick={() => { setActiveTab('admissions'); setMobileMenuOpen(false); }} icon={<InboxIcon />} label="Admisiones" />
              <SidebarItemMobile active={activeTab === 'usersearch'} onClick={() => { setActiveTab('usersearch'); setMobileMenuOpen(false); }} icon={<MagnifyingGlassIcon />} label="Buscar Usuarios" />
            </nav>
            <div className="absolute bottom-4 left-4 right-4">
              <button onClick={handleRebuild} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all font-medium text-sm shadow-lg">
                <ArrowPathIcon className="w-4 h-4" /> Rebuild Site
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <aside className="hidden lg:flex w-64 bg-[#001529] text-white flex-col sticky h-screen top-0">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-bold tracking-tight">RNCPE <span className="text-blue-400">Admin</span></h1>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">Director General</p>
        </div>
        <nav className="flex-1 p-4 space-y-2 mt-4">
          <SidebarItem active={activeTab === 'articles'} onClick={() => setActiveTab('articles')} icon={<DocumentTextIcon />} label="Artículos" />
          <SidebarItem active={activeTab === 'volumes'} onClick={() => setActiveTab('volumes')} icon={<BookOpenIcon />} label="Volúmenes" />
          <SidebarItem active={activeTab === 'team'} onClick={() => setActiveTab('team')} icon={<UserGroupIcon />} label="Equipo / Mails" />
          <SidebarItem active={activeTab === 'admissions'} onClick={() => setActiveTab('admissions')} icon={<InboxIcon />} label="Admisiones" />
          <SidebarItem active={activeTab === 'usersearch'} onClick={() => setActiveTab('usersearch')} icon={<MagnifyingGlassIcon />} label="Buscar Usuarios" />
        </nav>
        <div className="p-4 border-t border-white/10">
          <button onClick={handleRebuild} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all font-medium text-sm shadow-lg">
            <ArrowPathIcon className="w-4 h-4" /> Rebuild Site
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-[#001529] font-serif">
              {activeTab === 'articles' ? 'Gestión Editorial' : 
               activeTab === 'volumes' ? 'Archivo de Volúmenes' : 
               activeTab === 'usersearch' ? 'Buscador de Usuarios' : 'Administración'}
            </h2>
            <p className="text-sm lg:text-base text-gray-500">Hola {user.displayName || 'Director'}, tienes {articles.length} artículos publicados.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Buscar..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-full focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            {activeTab === 'articles' && (
              <button onClick={handleOpenSubmissionSelector} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full flex items-center justify-center gap-2 font-medium shadow-md transition-all active:scale-95 text-sm">
                <PlusIcon className="w-5 h-5" /> Subir nuevo
              </button>
            )}
            {activeTab === 'volumes' && (
              <button onClick={() => { resetForms(); setShowVolumeModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full flex items-center justify-center gap-2 font-medium shadow-md transition-all active:scale-95 text-sm">
                <PlusIcon className="w-5 h-5" /> Nuevo Volumen
              </button>
            )}
          </div>
        </header>

        <AnimatePresence>{status && <Notification status={status} clear={() => setStatus(null)} />}</AnimatePresence>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[60vh] overflow-hidden">
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
          {activeTab === 'team' && <div className="p-4 lg:p-6"><MailsTeam /></div>}
          {activeTab === 'admissions' && <div className="p-4 lg:p-6"><Admissions /></div>}
          {activeTab === 'usersearch' && <div className="p-4 lg:p-6"><UserSearch /></div>}
        </div>
      </main>

      {/* SELECTOR DE ENVÍOS (primer paso) */}
      <Modal 
        show={showSubmissionSelector} 
        onClose={() => setShowSubmissionSelector(false)}
        title="Seleccionar Envío Listo para Publicación"
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

      {/* MODAL ARTÍCULO (segundo paso) - ahora con más espacio */}
      <Modal 
        show={showArticleModal} 
        onClose={() => setShowArticleModal(false)}
        title={editingItem ? "Editar Artículo Académico" : "Publicar Nuevo Artículo"}
        isProcessing={isProcessing}
        onSave={handleSaveArticle}
        size="xl" // Modal más grande
      >
        {importSummary && !editingItem && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200 flex items-start gap-3">
            <InformationCircleIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">✅ Importación completada:</p>
              <p>Se importaron: {importSummary.fields.join(', ')}.</p>
              {importSummary.lastVersionFileUrl && (
                <p className="mt-1">
                  <a href={importSummary.lastVersionFileUrl} target="_blank" rel="noopener noreferrer" className="underline flex items-center gap-1">
                    <DocumentIcon className="w-4 h-4" /> Último archivo de versión (para generar PDF)
                  </a>
                </p>
              )}
              <p className="mt-1 text-blue-600">Revise los campos y complete los que faltan (volumen, número, páginas, fechas exactas, etc.)</p>
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

      {/* MODAL VOLÚMENES */}
      <Modal 
        show={showVolumeModal} 
        onClose={() => setShowVolumeModal(false)}
        title={editingItem ? "Editar Volumen" : "Nuevo Volumen"}
        isProcessing={isProcessing}
        onSave={handleSaveVolume}
      >
        <VolumeForm formData={volumeForm} setFormData={setVolumeForm} isEditing={!!editingItem} />
      </Modal>
    </div>
  );
}

// --- COMPONENTE SELECTOR DE ENVÍOS ---
const SubmissionSelector = ({ submissions, searchTerm, setSearchTerm, onSelect, loading, onRefresh }) => {
  return (
    <div className="space-y-4 min-h-[400px] flex flex-col">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por título, ID o autor..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center gap-2 text-gray-700 transition-colors"
          title="Actualizar lista"
        >
          <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto border border-gray-200 rounded-xl bg-gray-50 p-2 min-h-[300px] max-h-[500px]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <DocumentTextIcon className="w-12 h-12 text-gray-300 mb-2" />
            <p>No hay envíos listos para publicación</p>
            <p className="text-xs mt-1">Los artículos deben estar marcados como "Listos" por el editor</p>
          </div>
        ) : (
          <div className="space-y-2">
            {submissions.map((sub) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all"
                onClick={() => onSelect(sub)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900 flex-1">{sub.title}</h4>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full ml-2">Listo</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <div><span className="font-medium">ID:</span> {sub.submissionId}</div>
                  <div><span className="font-medium">Autor:</span> {sub.authorName}</div>
                  <div><span className="font-medium">Idioma:</span> {sub.paperLanguage === 'es' ? 'Español' : 'Inglés'}</div>
                  <div><span className="font-medium">Actualizado:</span> {sub.updatedAt.toLocaleDateString()}</div>
                </div>
                {sub.driveFolderUrl && (
                  <a href={sub.driveFolderUrl} target="_blank" rel="noopener noreferrer" className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <DocumentIcon className="w-3 h-3" /> Ver carpeta en Drive
                  </a>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 text-center">Selecciona un envío para importar todos los metadatos automáticamente</p>
    </div>
  );
};

// --- COMPONENTE DE FORMULARIO DE ARTÍCULO (sin botón de importar) ---
const ArticleForm = ({ formData, setFormData, isProcessing, isEditing, submissionId }) => {
  const [activeStep, setActiveStep] = useState(0);
  
  const steps = [
    { id: 0, name: 'Identidad', icon: '📋' },
    { id: 1, name: 'Publicación', icon: '📅' },
    { id: 2, name: 'Contenido HTML (ES)', icon: '🇪🇸' },
    { id: 3, name: 'Contenido HTML (EN)', icon: '🇬🇧' },
    { id: 4, name: 'Referencias', icon: '📚' },
    { id: 5, name: 'Metadatos', icon: '📎' },
    { id: 6, name: 'Archivos', icon: '📁' }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const addAuthor = () => {
    setFormData(prev => ({
      ...prev,
      autores: [...prev.autores, { ...initialAuthorState }]
    }));
  };

  const removeAuthor = (index) => {
    setFormData(prev => ({
      ...prev,
      autores: prev.autores.filter((_, i) => i !== index)
    }));
  };

  const updateAuthor = (index, field, value) => {
    setFormData(prev => {
      const updatedAutores = [...prev.autores];
      updatedAutores[index] = { ...updatedAutores[index], [field]: value };
      return { ...prev, autores: updatedAutores };
    });
  };

  return (
    <div className="flex flex-col h-[80vh] lg:h-[75vh]">
      {/* Indicador de Submission ID */}
      {submissionId && (
        <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200 flex items-center gap-2">
          <CheckIcon className="w-5 h-5 text-green-600" />
          <span className="text-sm text-green-700"><strong>Submission ID:</strong> {submissionId}</span>
        </div>
      )}

      {/* Progress Steps */}
      <div className="flex overflow-x-auto pb-2 mb-4 lg:mb-6 scrollbar-hide border-b border-gray-100">
        <div className="flex space-x-2 lg:space-x-0 lg:grid lg:grid-cols-7 lg:w-full">
          {steps.map((step) => (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={`
                flex items-center space-x-2 px-4 py-2 rounded-full whitespace-nowrap transition-all
                lg:flex-col lg:space-x-0 lg:space-y-1 lg:rounded-lg lg:py-3
                ${activeStep === step.id 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
              `}
            >
              <span className="text-lg">{step.icon}</span>
              <span className="text-sm font-medium lg:text-xs">{step.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-6">
        {activeStep === 0 && (
          <div className="space-y-4">
            <Input label="Título Original (ES) *" name="titulo" value={formData.titulo} onChange={handleChange} required />
            <Input label="Título (EN)" name="tituloEnglish" value={formData.tituloEnglish} onChange={handleChange} />

            {/* AUTORES */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Autores *</label>
              {formData.autores.map((autor, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-xl bg-gray-50 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">Autor #{index + 1}</span>
                    {formData.autores.length > 1 && (
                      <button type="button" onClick={() => removeAuthor(index)} className="text-red-600 hover:text-red-800 p-1">
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input label="Nombre Completo *" value={autor.name} onChange={(e) => updateAuthor(index, 'name', e.target.value)} placeholder="Ej: Javier Vergara" />
                    <Input label="Email *" type="email" value={autor.email} onChange={(e) => updateAuthor(index, 'email', e.target.value)} placeholder="autor@email.com" />
                    <Input label="Institución" value={autor.institution} onChange={(e) => updateAuthor(index, 'institution', e.target.value)} placeholder="Afiliación institucional" />
                    <Input label="ORCID" value={autor.orcid} onChange={(e) => updateAuthor(index, 'orcid', e.target.value)} placeholder="0000-0002-1825-0097" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input label="Contribución (CRediT)" value={autor.contribution || ''} onChange={(e) => updateAuthor(index, 'contribution', e.target.value)} placeholder="Ej: Conceptualización, metodología..." />
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={autor.isCorresponding} onChange={(e) => updateAuthor(index, 'isCorresponding', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        Autor de Correspondencia
                      </label>
                      <Input label="ID de Autor" value={autor.authorId || ''} onChange={(e) => updateAuthor(index, 'authorId', e.target.value)} placeholder="ID" className="flex-1" />
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addAuthor} className="mt-2 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2 text-sm">
                <PlusIcon className="w-5 h-5" /> Añadir otro autor
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Área de estudio" name="area" value={formData.area} onChange={handleChange} />
              <Input label="Tipo de Artículo (ES)" name="tipo" value={formData.tipo} onChange={handleChange} />
            </div>
            <Input label="Type of Article (EN)" name="type" value={formData.type} onChange={handleChange} />
          </div>
        )}

        {activeStep === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Volumen" name="volumen" value={formData.volumen} onChange={handleChange} />
              <Input label="Número" name="numero" value={formData.numero} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Fecha Publicación" name="fecha" type="date" value={formData.fecha} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Primera Página" name="primeraPagina" value={formData.primeraPagina} onChange={handleChange} />
              <Input label="Última Página" name="ultimaPagina" value={formData.ultimaPagina} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Fecha de Recepción" name="receivedDate" type="date" value={formData.receivedDate} onChange={handleChange} />
              <Input label="Fecha de Aceptación" name="acceptedDate" type="date" value={formData.acceptedDate} onChange={handleChange} />
            </div>
          </div>
        )}

        {activeStep === 2 && (
          <div className="space-y-6">
            <div className="flex space-x-2 mb-4">
              <button onClick={() => setFormData({...formData, htmlMode: 'visual'})} className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center space-x-2 text-sm font-medium transition-all ${formData.htmlMode === 'visual' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                <PencilSquareIcon className="w-4 h-4" /><span>Editor Visual</span>
              </button>
              <button onClick={() => setFormData({...formData, htmlMode: 'code'})} className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center space-x-2 text-sm font-medium transition-all ${formData.htmlMode === 'code' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                <CodeBracketIcon className="w-4 h-4" /><span>Editor HTML</span>
              </button>
            </div>
            {formData.htmlMode === 'visual' ? (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">HTML Completo (ES) - Editor Visual</label>
                <div className="border rounded-xl overflow-hidden">
                  <ReactQuill theme="snow" modules={quillModules} value={formData.html_es} onChange={(v) => setFormData({...formData, html_es: v})} className="h-64 mb-12 lg:mb-16" placeholder="Escribe o pega el contenido aquí..." />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">HTML Completo (ES) - Editor Directo</label>
                <div className="border rounded-xl overflow-hidden">
                  <CodeMirror value={formData.html_es || ''} height="300px" extensions={[html()]} theme={oneDark} onChange={(value) => setFormData({...formData, html_es: value})} className="text-sm" />
                </div>
                <p className="text-xs text-gray-500 mt-2">Puedes pegar código HTML directamente.</p>
              </div>
            )}
          </div>
        )}

        {activeStep === 3 && (
          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">HTML Completo (EN) - Versión Inglés</label>
              <div className="border rounded-xl overflow-hidden">
                <CodeMirror value={formData.html_en || ''} height="300px" extensions={[html()]} theme={oneDark} onChange={(value) => setFormData({...formData, html_en: value})} className="text-sm" />
              </div>
            </div>
          </div>
        )}

        {activeStep === 4 && (
          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Referencias (Único campo para ambos idiomas)</label>
              <div className="border rounded-xl overflow-hidden">
                <CodeMirror value={formData.referencias || ''} height="300px" extensions={[html()]} theme={oneDark} onChange={(value) => setFormData({...formData, referencias: value})} className="text-sm" />
              </div>
            </div>
          </div>
        )}

        {activeStep === 5 && (
          <div className="space-y-4">
            <Input label="Palabras Clave (ES) * (separar con ;)" name="palabras_clave" value={formData.palabras_clave} onChange={handleChange} placeholder="Ej: ciencia; investigación; método" />
            <Input label="Keywords (EN) (separar con ;)" name="keywords_english" value={formData.keywords_english} onChange={handleChange} placeholder="Ej: science; research; method" />
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Resumen (ES)</label><textarea className="w-full p-3 border rounded-xl h-24 outline-none focus:ring-2 focus:ring-blue-500 text-sm" value={formData.resumen} onChange={(e) => setFormData({...formData, resumen: e.target.value})} placeholder="Resumen en español..." /></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Abstract (EN)</label><textarea className="w-full p-3 border rounded-xl h-24 outline-none focus:ring-2 focus:ring-blue-500 text-sm" value={formData.abstract} onChange={(e) => setFormData({...formData, abstract: e.target.value})} placeholder="English abstract..." /></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Conflictos de Interés (ES)</label><textarea className="w-full p-3 border rounded-xl h-20 outline-none focus:ring-2 focus:ring-blue-500 text-sm" name="conflicts" value={formData.conflicts} onChange={handleChange} placeholder="Declaración de conflictos de interés..." /></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Conflicts of Interest (EN)</label><textarea className="w-full p-3 border rounded-xl h-20 outline-none focus:ring-2 focus:ring-blue-500 text-sm" name="conflictsEnglish" value={formData.conflictsEnglish} onChange={handleChange} placeholder="Conflicts of interest statement..." /></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Financiación (ES)</label><textarea className="w-full p-3 border rounded-xl h-20 outline-none focus:ring-2 focus:ring-blue-500 text-sm" name="funding" value={formData.funding} onChange={handleChange} placeholder="Información de financiamiento..." /></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Funding (EN)</label><textarea className="w-full p-3 border rounded-xl h-20 outline-none focus:ring-2 focus:ring-blue-500 text-sm" name="fundingEnglish" value={formData.fundingEnglish} onChange={handleChange} placeholder="Funding information..." /></div>
          </div>
        )}

        {activeStep === 6 && (
          <div className="space-y-6">
            <div className="p-6 border-2 border-dashed border-gray-200 rounded-2xl text-center">
              <DocumentIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Sube el manuscrito final en formato PDF</p>
              <input type="file" accept=".pdf" className="hidden" id="pdf-upload" onChange={(e) => setFormData({...formData, pdfFile: e.target.files[0]})} />
              <label htmlFor="pdf-upload" className="bg-white border border-gray-300 px-6 py-2 rounded-full cursor-pointer hover:bg-gray-50 shadow-sm transition-all inline-block text-sm">
                {formData.pdfFile ? formData.pdfFile.name : "Seleccionar Archivo"}
              </label>
              {formData.pdfUrl && !formData.pdfFile && <p className="text-xs text-gray-400 mt-2">PDF actual: {formData.pdfUrl.split('/').pop()}</p>}
            </div>

            {formData.lastVersionFileUrl && (
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-sm font-medium text-yellow-800 mb-1">📄 Última versión del archivo (importado)</p>
                <a href={formData.lastVersionFileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm flex items-center gap-1">
                  <DocumentIcon className="w-4 h-4" /> Abrir en Google Docs
                </a>
                <p className="text-xs text-gray-500 mt-1">Puedes usarlo para generar el PDF final.</p>
              </div>
            )}

            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Agradecimientos (ES)</label><textarea className="w-full p-3 border rounded-xl h-20 outline-none focus:ring-2 focus:ring-blue-500 text-sm" name="acknowledgments" value={formData.acknowledgments} onChange={handleChange} placeholder="Agradecimientos..." /></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Acknowledgments (EN)</label><textarea className="w-full p-3 border rounded-xl h-20 outline-none focus:ring-2 focus:ring-blue-500 text-sm" name="acknowledgmentsEnglish" value={formData.acknowledgmentsEnglish} onChange={handleChange} placeholder="Acknowledgments..." /></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Créditos de Autores (ES)</label><textarea className="w-full p-3 border rounded-xl h-20 outline-none focus:ring-2 focus:ring-blue-500 text-sm" name="authorCredits" value={formData.authorCredits} onChange={handleChange} placeholder="CRediT - Contribuciones de autores..." /></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Author Credits (EN)</label><textarea className="w-full p-3 border rounded-xl h-20 outline-none focus:ring-2 focus:ring-blue-500 text-sm" name="authorCreditsEnglish" value={formData.authorCreditsEnglish} onChange={handleChange} placeholder="CRediT - Author contributions..." /></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Disponibilidad de Datos (ES)</label><textarea className="w-full p-3 border rounded-xl h-20 outline-none focus:ring-2 focus:ring-blue-500 text-sm" name="dataAvailability" value={formData.dataAvailability} onChange={handleChange} placeholder="Declaración de disponibilidad de datos..." /></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Data Availability (EN)</label><textarea className="w-full p-3 border rounded-xl h-20 outline-none focus:ring-2 focus:ring-blue-500 text-sm" name="dataAvailabilityEnglish" value={formData.dataAvailabilityEnglish} onChange={handleChange} placeholder="Data availability statement..." /></div>
          </div>
        )}
      </div>

      {/* Step Navigation */}
      <div className="flex justify-between mt-4 pt-4 border-t border-gray-100">
        <button type="button" onClick={() => setActiveStep(Math.max(0, activeStep - 1))} disabled={activeStep === 0} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">Anterior</button>
        <button type="button" onClick={() => setActiveStep(Math.min(6, activeStep + 1))} disabled={activeStep === 6} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">Siguiente</button>
      </div>
    </div>
  );
};

// --- COMPONENTE DE BÚSQUEDA DE USUARIOS (sin cambios, pero incluido por completitud) ---
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
        <input type="text" placeholder="Buscar por email o nombre..." className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-base" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
        <button onClick={handleSearch} disabled={isSearching} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 font-medium shadow-md transition-all disabled:opacity-50">
          {isSearching ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <MagnifyingGlassIcon className="w-5 h-5" />} Buscar
        </button>
      </div>
      {searchPerformed && (
        <div className="mt-4">
          <p className="text-sm text-gray-500 mb-3">{searchResults.length === 0 ? 'No se encontraron usuarios.' : `Se encontraron ${searchResults.length} usuario(s).`}</p>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {searchResults.map((user) => (
              <div key={user.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 cursor-pointer flex justify-between items-center hover:bg-gray-100 transition-colors" onClick={() => toggleUserExpand(user.id)}>
                  <div className="flex items-center gap-3">
                    <UserIcon className="w-5 h-5 text-gray-500" />
                    <div>
                      <h4 className="font-medium text-gray-900">{user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Sin nombre'}</h4>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${expandedUser === user.id ? 'rotate-180' : ''}`} />
                </div>
                <AnimatePresence>
                  {expandedUser === user.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-4 py-4 bg-white border-t border-gray-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Datos Personales</h5>
                          <ul className="space-y-1">
                            <li><span className="font-medium">UID:</span> <span className="text-gray-600 font-mono text-xs">{user.id}</span></li>
                            <li><span className="font-medium">Email:</span> {user.email}</li>
                            <li><span className="font-medium">Teléfono:</span> {user.phoneNumber || 'No disponible'}</li>
                            <li><span className="font-medium">Verificado:</span> {user.emailVerified ? 'Sí' : 'No'}</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Roles</h5>
                          <div className="flex flex-wrap gap-1">
                            {user.roles && user.roles.length > 0 ? user.roles.map((role, idx) => <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">{role}</span>) : <span className="text-gray-400">Sin roles</span>}
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Metadatos</h5>
                          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <li><span className="font-medium">Creado:</span> {user.createdAt?.toDate?.()?.toLocaleString() || user.createdAt || 'N/A'}</li>
                            <li><span className="font-medium">Último acceso:</span> {user.lastLoginAt?.toDate?.()?.toLocaleString() || user.lastLoginAt || 'N/A'}</li>
                            <li><span className="font-medium">Última actualización:</span> {user.updatedAt?.toDate?.()?.toLocaleString() || user.updatedAt || 'N/A'}</li>
                            <li><span className="font-medium">Envíos totales:</span> {user.totalSubmissions || 0}</li>
                          </ul>
                        </div>
                        {user.claimedAnonymousUid && (
                          <div className="md:col-span-2 bg-yellow-50 p-2 rounded-lg">
                            <p className="text-xs text-yellow-800"><span className="font-bold">Perfil anónimo reclamado:</span> {user.claimedAnonymousName} ({user.claimedAnonymousUid})</p>
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

// --- COMPONENTE VOLUME FORM (sin cambios) ---
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
      <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Editorial Note (Español)</label><textarea className="w-full p-3 border rounded-xl h-24 outline-none focus:ring-2 focus:ring-blue-500 text-sm" name="editorial" value={formData.editorial} onChange={handleChange} placeholder="Nota editorial en español..." /></div>
      <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Editorial Note (English)</label><textarea className="w-full p-3 border rounded-xl h-24 outline-none focus:ring-2 focus:ring-blue-500 text-sm" name="englishEditorial" value={formData.englishEditorial} onChange={handleChange} placeholder="Editorial note in English..." /></div>
      <div className="p-6 border-2 border-dashed border-gray-200 rounded-2xl text-center">
        <DocumentIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 mb-4">PDF del volumen completo (opcional)</p>
        <input type="file" accept=".pdf" className="hidden" id="volume-pdf-upload" onChange={(e) => setFormData({...formData, pdfFile: e.target.files[0]})} />
        <label htmlFor="volume-pdf-upload" className="bg-white border border-gray-300 px-6 py-2 rounded-full cursor-pointer hover:bg-gray-50 shadow-sm transition-all inline-block text-sm">
          {formData.pdfFile ? formData.pdfFile.name : "Seleccionar Archivo"}
        </label>
        {formData.pdf && !formData.pdfFile && <p className="text-xs text-gray-400 mt-2">PDF actual: {formData.pdf.split('/').pop()}</p>}
      </div>
    </div>
  );
};

// --- COMPONENTES DE LISTA (sin cambios significativos) ---
const ArticleList = ({ articles, expandedArticles, onToggleExpand, onEdit, onDelete, formatDate }) => (
  <div className="divide-y divide-gray-200">
    {articles.length === 0 ? (
      <div className="px-8 py-16 text-center">
        <DocumentTextIcon className="mx-auto h-16 w-16 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">No hay artículos</h3>
        <p className="mt-2 text-gray-500">Comienza agregando tu primer artículo.</p>
      </div>
    ) : (
      <div className="max-h-[600px] overflow-y-auto">
        {articles.map((article) => (
          <motion.div key={article.numeroArticulo || article.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-gray-50 transition-colors">
            <div className="px-4 lg:px-6 py-4 cursor-pointer flex justify-between items-center" onClick={() => onToggleExpand(article.numeroArticulo)}>
              <div className="flex-1 min-w-0">
                <h3 className="text-base lg:text-lg font-semibold text-[#001529] truncate" title={article.titulo}>{article.titulo}</h3>
                <p className="mt-1 text-xs lg:text-sm text-gray-600 truncate" title={article.autores?.map(a => a.name).join('; ')}>{article.autores?.map(a => a.name).join('; ')}</p>
                <div className="mt-2 flex items-center space-x-2">
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">Vol. {article.volumen} N° {article.numero}</span>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium hidden sm:inline-block">{article.area}</span>
                  {article.status === 'published' && <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Publicado</span>}
                </div>
              </div>
              <ChevronDownIcon className={`w-5 h-5 lg:w-6 lg:h-6 text-gray-400 transition-transform duration-300 flex-shrink-0 ${expandedArticles[article.numeroArticulo] ? 'rotate-180' : ''}`} />
            </div>
            <AnimatePresence>
              {expandedArticles[article.numeroArticulo] && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-4 lg:px-6 pb-6 bg-gray-50">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
                    <div className="space-y-4">
                      <div><h4 className="font-semibold text-gray-900 mb-2">Resumen</h4><div className="text-gray-700 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: article.resumen || 'No disponible' }} /></div>
                      <div><h4 className="font-semibold text-gray-900 mb-2">Abstract</h4><div className="text-gray-700 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: article.abstract || 'No disponible' }} /></div>
                      <div><h4 className="font-semibold text-gray-900 mb-2">Palabras Clave</h4><p className="text-gray-700">{article.palabras_clave?.join(', ') || 'No disponible'}</p></div>
                      <div><h4 className="font-semibold text-gray-900 mb-2">Keywords</h4><p className="text-gray-700">{article.keywords_english?.join(', ') || 'No disponible'}</p></div>
                      {article.referencias && <div><h4 className="font-semibold text-gray-900 mb-2">Referencias</h4><div className="text-gray-700 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: article.referencias }} /></div>}
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div><p className="text-gray-500 text-xs">Fecha de publicación</p><p className="font-medium">{formatDate(article.fecha)}</p></div>
                        <div><p className="text-gray-500 text-xs">Volumen/Número</p><p className="font-medium">{article.volumen}/{article.numero}</p></div>
                        <div><p className="text-gray-500 text-xs">Páginas</p><p className="font-medium">{article.primeraPagina}-{article.ultimaPagina}</p></div>
                        <div><p className="text-gray-500 text-xs">Área</p><p className="font-medium">{article.area}</p></div>
                        <div><p className="text-gray-500 text-xs">Tipo</p><p className="font-medium">{article.tipo}</p></div>
                        <div><p className="text-gray-500 text-xs">Type</p><p className="font-medium">{article.type || 'N/A'}</p></div>
                      </div>
                      {article.autores && article.autores.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">Detalle de Autores</h4>
                          <div className="space-y-2">
                            {article.autores.map((autor, idx) => (
                              <div key={idx} className="text-xs bg-white p-2 rounded-lg border border-gray-100">
                                <p className="font-medium">{autor.name}</p>
                                <div className="grid grid-cols-2 gap-2 mt-1 text-gray-600">
                                  {autor.email && <p>📧 {autor.email}</p>}
                                  {autor.institution && <p>🏛️ {autor.institution}</p>}
                                  {autor.orcid && <p>🆔 {autor.orcid}</p>}
                                  {autor.authorId && <p className="font-mono">🔑 {autor.authorId}</p>}
                                  {autor.contribution && <p className="col-span-2">📝 {autor.contribution}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {article.submissionId && <div><p className="text-gray-500 text-xs">Submission ID</p><p className="font-medium text-xs">{article.submissionId}</p></div>}
                      {article.conflicts && article.conflicts !== 'Los autores declaran no tener conflictos de interés.' && <div><h4 className="font-semibold text-gray-900 mb-2">Conflictos de Interés</h4><div className="text-gray-700 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: article.conflicts }} /></div>}
                      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                        {article.pdfUrl && <a href={article.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"><DocumentIcon className="w-4 h-4 mr-2" /> Ver PDF</a>}
                        <div className="flex space-x-2 ml-auto">
                          <button onClick={(e) => { e.stopPropagation(); onEdit(article); }} className="p-2 text-yellow-600 bg-yellow-100 rounded-lg hover:bg-yellow-200 transition-colors"><PencilIcon className="w-4 h-4 lg:w-5 lg:h-5" /></button>
                          <button onClick={(e) => { e.stopPropagation(); onDelete(article.numeroArticulo); }} className="p-2 text-red-600 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"><TrashIcon className="w-4 h-4 lg:w-5 lg:h-5" /></button>
                        </div>
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
  <div className="divide-y divide-gray-200">
    {volumes.length === 0 ? (
      <div className="px-8 py-16 text-center">
        <BookOpenIcon className="mx-auto h-16 w-16 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">No hay volúmenes</h3>
        <p className="mt-2 text-gray-500">Comienza agregando tu primer volumen.</p>
      </div>
    ) : (
      <div className="max-h-[600px] overflow-y-auto">
        {volumes.map((volume) => (
          <motion.div key={volume.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-gray-50 transition-colors">
            <div className="px-4 lg:px-6 py-4 cursor-pointer flex justify-between items-center" onClick={() => onToggleExpand(volume.id)}>
              <div className="flex-1 min-w-0">
                <h3 className="text-base lg:text-lg font-semibold text-[#001529] truncate" title={volume.titulo}>{volume.titulo}</h3>
                <p className="mt-1 text-xs lg:text-sm text-gray-600">Volumen {volume.volumen}, Número {volume.numero}</p>
                <div className="mt-2 flex items-center space-x-2">
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">{formatDate(volume.fecha)}</span>
                  {volume.issn && <span className="px-2.5 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium hidden sm:inline-block">ISSN: {volume.issn}</span>}
                </div>
              </div>
              <ChevronDownIcon className={`w-5 h-5 lg:w-6 lg:h-6 text-gray-400 transition-transform duration-300 flex-shrink-0 ${expandedVolumes[volume.id] ? 'rotate-180' : ''}`} />
            </div>
            <AnimatePresence>
              {expandedVolumes[volume.id] && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-4 lg:px-6 pb-6 bg-gray-50">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {volume.editorial && <div><h4 className="font-semibold text-gray-900 mb-2">Nota Editorial</h4><div className="text-gray-700 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: volume.editorial }} /></div>}
                    {volume.englishEditorial && <div><h4 className="font-semibold text-gray-900 mb-2">Editorial Note</h4><div className="text-gray-700 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: volume.englishEditorial }} /></div>}
                    <div className="lg:col-span-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div><p className="text-gray-500 text-xs">Volumen</p><p className="font-medium">{volume.volumen}</p></div>
                        <div><p className="text-gray-500 text-xs">Número</p><p className="font-medium">{volume.numero}</p></div>
                        <div><p className="text-gray-500 text-xs">Fecha</p><p className="font-medium">{formatDate(volume.fecha)}</p></div>
                        {volume.issn && <div><p className="text-gray-500 text-xs">ISSN</p><p className="font-medium">{volume.issn}</p></div>}
                      </div>
                    </div>
                    {volume.portada && <div className="lg:col-span-2"><h4 className="font-semibold text-gray-900 mb-2">Portada</h4><img src={volume.portada} alt={volume.titulo} className="max-h-48 rounded-lg shadow-md" /></div>}
                    <div className="lg:col-span-2 flex items-center justify-between pt-4 border-t border-gray-200">
                      {volume.pdf && <a href={volume.pdf} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"><DocumentIcon className="w-4 h-4 mr-2" /> Ver PDF del Volumen</a>}
                      <div className="flex space-x-2 ml-auto">
                        <button onClick={(e) => { e.stopPropagation(); onEdit(volume); }} className="p-2 text-yellow-600 bg-yellow-100 rounded-lg hover:bg-yellow-200 transition-colors"><PencilIcon className="w-4 h-4 lg:w-5 lg:h-5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(volume.id); }} className="p-2 text-red-600 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"><TrashIcon className="w-4 h-4 lg:w-5 lg:h-5" /></button>
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

// --- COMPONENTES ATÓMICOS ---
const Input = ({ label, ...props }) => (
  <div>
    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">{label}</label>
    <input className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm text-sm" {...props} />
  </div>
);

const Modal = ({ show, onClose, title, children, onSave, isProcessing, hideSaveButton = false, size = 'lg' }) => {
  const sizeClasses = {
    sm: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };
  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-2 lg:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#001529]/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className={`bg-white w-full ${sizeClasses[size]} rounded-2xl lg:rounded-3xl shadow-2xl relative z-10 overflow-hidden max-h-[95vh] flex flex-col`}>
            <div className="px-4 lg:px-8 py-4 lg:py-6 border-b flex justify-between items-center bg-gray-50 sticky top-0">
              <h3 className="text-lg lg:text-xl font-bold font-serif truncate pr-4">{title}</h3>
              <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full flex-shrink-0"><XMarkIcon className="w-5 h-5 lg:w-6 lg:h-6" /></button>
            </div>
            <div className="p-4 lg:p-8 overflow-y-auto flex-1">{children}</div>
            {!hideSaveButton && (
              <div className="px-4 lg:px-8 py-4 lg:py-6 bg-gray-50 border-t flex justify-end gap-3 sticky bottom-0">
                <button onClick={onClose} className="px-4 lg:px-6 py-2 font-semibold text-gray-500 text-sm lg:text-base" disabled={isProcessing}>Cancelar</button>
                <button onClick={onSave} disabled={isProcessing} className="bg-blue-600 text-white px-6 lg:px-8 py-2 rounded-xl font-bold hover:bg-blue-700 shadow-lg flex items-center gap-2 disabled:opacity-50 text-sm lg:text-base">
                  {isProcessing ? <><ArrowPathIcon className="w-4 h-4 lg:w-5 lg:h-5 animate-spin" /> Procesando...</> : <><CheckIcon className="w-4 h-4 lg:w-5 lg:h-5" /> Guardar</>}
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
  <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} className={`fixed top-4 right-4 lg:top-8 lg:right-8 z-[2000] p-4 rounded-2xl shadow-2xl border-l-4 min-w-[280px] lg:min-w-[300px] flex items-center justify-between ${status.type === 'success' ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : status.type === 'error' ? 'bg-red-50 border-red-500 text-red-800' : 'bg-blue-50 border-blue-500 text-blue-800'}`}>
    <div className="flex items-center gap-3">
      {status.type === 'success' ? <CheckIcon className="w-5 h-5 lg:w-6 lg:h-6" /> : <ExclamationTriangleIcon className="w-5 h-5 lg:w-6 lg:h-6" />}
      <span className="font-medium text-sm lg:text-base">{status.msg}</span>
    </div>
    <button onClick={clear} className="p-1 hover:bg-black/5 rounded-full"><XMarkIcon className="w-4 h-4" /></button>
  </motion.div>
);

const SidebarItem = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
    {React.cloneElement(icon, { className: "w-5 h-5" })}<span className="font-medium">{label}</span>
  </button>
);

const SidebarItemMobile = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
    {React.cloneElement(icon, { className: "w-5 h-5" })}<span className="font-medium">{label}</span>
  </button>
);

// --- LOADING & ACCESS COMPONENTS ---
const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="font-serif italic text-gray-400 tracking-widest uppercase text-xs">Cargando Editorial...</p>
    </div>
  </div>
);

const AccessDenied = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div className="text-center p-8 lg:p-12 bg-white rounded-3xl shadow-xl border border-gray-100 max-w-sm">
      <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mx-auto mb-6" />
      <h2 className="text-xl lg:text-2xl font-bold text-[#001529] mb-2">Acceso Restringido</h2>
      <p className="text-sm lg:text-base text-gray-500">Esta área es exclusiva para la Dirección General de la Revista.</p>
    </div>
  </div>
);