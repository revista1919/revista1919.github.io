import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '../firebase';
import { collection, onSnapshot } from "firebase/firestore";
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
  GlobeAltIcon, PhotoIcon, ChevronDownIcon
} from '@heroicons/react/24/outline';

// --- Constantes de Configuración ---
const DOMAIN = 'https://www.revistacienciasestudiantes.com';
const MANAGE_ARTICLES_URL = 'https://managearticles-ggqsq2kkua-uc.a.run.app';
const MANAGE_VOLUMES_URL = 'https://managevolumes-ggqsq2kkua-uc.a.run.app';
const REBUILD_URL = 'https://triggerrebuild-ggqsq2kkua-uc.a.run.app';
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

// --- ESTADOS INICIALES ---
const initialArticleState = {
  titulo: '',
  tituloEnglish: '',
  autores: '',
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
  authorId: '',
  html_es: '',
  html_en: '',
  pdfFile: null,
  pdf: null,
  htmlMode: 'visual',
  rawHtml: ''
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

  // Forms
  const [articleForm, setArticleForm] = useState(initialArticleState);
  const [volumeForm, setVolumeForm] = useState(initialVolumeState);

  // --- Lógica de Acceso y Datos ---
  const hasAccess = useMemo(() => user?.roles?.includes('Director General'), [user]);

  useEffect(() => {
    if (!hasAccess) return;
    
    setLoading(true);
    const unsubArticles = onSnapshot(collection(db, 'articles'), (snapshot) => {
      const arts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setArticles(arts);
      setLoading(false);
    });

    const unsubVolumes = onSnapshot(collection(db, 'volumes'), (snapshot) => {
      const vols = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setVolumes(vols);
    });

    return () => {
      unsubArticles();
      unsubVolumes();
    };
  }, [hasAccess]);

  // Persist drafts in localStorage
  useEffect(() => {
    if (showArticleModal && !editingItem) {
      const savedDraft = localStorage.getItem('draftNewArticle');
      if (savedDraft) setArticleForm(JSON.parse(savedDraft));
    }
  }, [showArticleModal, editingItem]);

  useEffect(() => {
    if (showArticleModal && editingItem) {
      const key = `draftEditArticle_${editingItem.id}`;
      const savedDraft = localStorage.getItem(key);
      if (savedDraft) setArticleForm(JSON.parse(savedDraft));
    }
  }, [showArticleModal, editingItem]);

  useEffect(() => {
    if (showVolumeModal && !editingItem) {
      const savedDraft = localStorage.getItem('draftNewVolume');
      if (savedDraft) setVolumeForm(JSON.parse(savedDraft));
    }
  }, [showVolumeModal, editingItem]);

  // Save drafts
  useEffect(() => {
    if (showArticleModal && !editingItem) {
      localStorage.setItem('draftNewArticle', JSON.stringify(articleForm));
    } else if (showArticleModal && editingItem) {
      const key = `draftEditArticle_${editingItem.id}`;
      localStorage.setItem(key, JSON.stringify(articleForm));
    }
  }, [articleForm, showArticleModal, editingItem]);

  useEffect(() => {
    if (showVolumeModal && !editingItem) {
      localStorage.setItem('draftNewVolume', JSON.stringify(volumeForm));
    } else if (showVolumeModal && editingItem) {
      const key = `draftEditVolume_${editingItem.id}`;
      localStorage.setItem(key, JSON.stringify(volumeForm));
    }
  }, [volumeForm, showVolumeModal, editingItem]);

  // --- Filtrado ---
  const filteredArticles = articles.filter(a => 
    a.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.autores?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Handlers ---
  const triggerRebuild = async () => {
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(REBUILD_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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

  const handleSaveArticle = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setStatus(null);

    try {
      const token = await auth.currentUser.getIdToken();
      const pdfBase64 = articleForm.pdfFile ? await toBase64(articleForm.pdfFile) : null;
      
      // Preparar el HTML según el modo seleccionado
      let htmlContent = articleForm.html_es;
      if (articleForm.htmlMode === 'code' && articleForm.rawHtml) {
        htmlContent = articleForm.rawHtml;
      }

      const articleData = {
        titulo: articleForm.titulo,
        tituloEnglish: articleForm.tituloEnglish,
        autores: articleForm.autores,
        resumen: articleForm.resumen,
        abstract: articleForm.abstract,
        palabras_clave: articleForm.palabras_clave ? articleForm.palabras_clave.split(';').map(k => k.trim()).filter(k => k) : [],
        keywords_english: articleForm.keywords_english ? articleForm.keywords_english.split(';').map(k => k.trim()).filter(k => k) : [],
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
        authorId: articleForm.authorId,
        html_es: htmlContent,
        html_en: articleForm.html_en,
      };

      const payload = {
        action: editingItem ? 'edit' : 'add',
        article: articleData,
        pdfBase64,
        id: editingItem?.id,
      };

      const response = await fetch(MANAGE_ARTICLES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }

      // Limpiar drafts
      if (!editingItem) {
        localStorage.removeItem('draftNewArticle');
      } else {
        localStorage.removeItem(`draftEditArticle_${editingItem.id}`);
      }

      setShowArticleModal(false);
      resetForms();
      await triggerRebuild();
      setStatus({ type: 'success', msg: '✅ Artículo guardado exitosamente' });
    } catch (err) {
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }

      // Limpiar drafts
      if (!editingItem) {
        localStorage.removeItem('draftNewVolume');
      } else {
        localStorage.removeItem(`draftEditVolume_${editingItem.id}`);
      }

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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'delete', id }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }

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
  };

  const toggleArticleExpand = (id) => {
    setExpandedArticles(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleVolumeExpand = (id) => {
    setExpandedVolumes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!hasAccess) return <AccessDenied />;
  if (loading) return <LoadingScreen />;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#f4f7f9] text-[#1a1a1a]">
      {/* Mobile Header */}
      <div className="lg:hidden bg-[#001529] text-white p-4 flex justify-between items-center sticky top-0 z-30">
        <div>
          <h1 className="text-xl font-bold">RNCPE Admin</h1>
          <p className="text-xs text-gray-400">Director General</p>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 hover:bg-white/10 rounded-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            className="lg:hidden fixed inset-0 z-40 bg-[#001529] w-64 pt-20"
          >
            <nav className="p-4 space-y-2">
              <SidebarItemMobile 
                active={activeTab === 'articles'} 
                onClick={() => { setActiveTab('articles'); setMobileMenuOpen(false); }}
                icon={<DocumentTextIcon />} 
                label="Artículos" 
              />
              <SidebarItemMobile 
                active={activeTab === 'volumes'} 
                onClick={() => { setActiveTab('volumes'); setMobileMenuOpen(false); }}
                icon={<BookOpenIcon />} 
                label="Volúmenes" 
              />
              <SidebarItemMobile 
                active={activeTab === 'team'} 
                onClick={() => { setActiveTab('team'); setMobileMenuOpen(false); }}
                icon={<UserGroupIcon />} 
                label="Equipo / Mails" 
              />
              <SidebarItemMobile 
                active={activeTab === 'admissions'} 
                onClick={() => { setActiveTab('admissions'); setMobileMenuOpen(false); }}
                icon={<InboxIcon />} 
                label="Admisiones" 
              />
            </nav>
            <div className="absolute bottom-4 left-4 right-4">
              <button onClick={handleRebuild} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all font-medium text-sm shadow-lg">
                <ArrowPathIcon className="w-4 h-4" /> Rebuild Site
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
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
        </nav>

        <div className="p-4 border-t border-white/10">
          <button onClick={handleRebuild} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all font-medium text-sm shadow-lg">
            <ArrowPathIcon className="w-4 h-4" /> Rebuild Site
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        {/* Header Bar */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-[#001529] font-serif">
              {activeTab === 'articles' ? 'Gestión Editorial' : activeTab === 'volumes' ? 'Archivo de Volúmenes' : 'Administración'}
            </h2>
            <p className="text-sm lg:text-base text-gray-500">Hola {user.displayName || 'Director'}, tienes {articles.length} artículos publicados.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Buscar..." 
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-full focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {activeTab === 'articles' && (
              <button 
                onClick={() => { resetForms(); setShowArticleModal(true); }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full flex items-center justify-center gap-2 font-medium shadow-md transition-all active:scale-95 text-sm"
              >
                <PlusIcon className="w-5 h-5" /> Nuevo Artículo
              </button>
            )}
            {activeTab === 'volumes' && (
              <button 
                onClick={() => { resetForms(); setShowVolumeModal(true); }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full flex items-center justify-center gap-2 font-medium shadow-md transition-all active:scale-95 text-sm"
              >
                <PlusIcon className="w-5 h-5" /> Nuevo Volumen
              </button>
            )}
          </div>
        </header>

        {/* Notificaciones */}
        <AnimatePresence>
          {status && <Notification status={status} clear={() => setStatus(null)} />}
        </AnimatePresence>

        {/* Content Render */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[60vh] overflow-hidden">
          {activeTab === 'articles' && (
            <ArticleList 
              articles={filteredArticles}
              expandedArticles={expandedArticles}
              onToggleExpand={toggleArticleExpand}
              onEdit={(article) => { 
                setEditingItem(article); 
                setArticleForm({
                  ...article,
                  palabras_clave: article.palabras_clave ? article.palabras_clave.join('; ') : '',
                  keywords_english: article.keywords_english ? article.keywords_english.join('; ') : '',
                  htmlMode: 'visual',
                  rawHtml: article.html_es || '',
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
              onEdit={(volume) => { 
                setEditingItem(volume); 
                setVolumeForm({
                  ...volume,
                  pdfFile: null,
                }); 
                setShowVolumeModal(true); 
              }}
              onDelete={(id) => handleDelete(id, 'volume')}
              formatDate={formatDate}
            />
          )}
          {activeTab === 'team' && (
            <div className="p-4 lg:p-6">
              <MailsTeam />
            </div>
          )}
          {activeTab === 'admissions' && (
            <div className="p-4 lg:p-6">
              <Admissions />
            </div>
          )}
        </div>
      </main>

      {/* MODAL ARTÍCULOS */}
      <Modal 
        show={showArticleModal} 
        onClose={() => setShowArticleModal(false)}
        title={editingItem ? "Editar Artículo Académico" : "Publicar Nuevo Artículo"}
        isProcessing={isProcessing}
        onSave={handleSaveArticle}
      >
        <ArticleForm formData={articleForm} setFormData={setArticleForm} />
      </Modal>

      {/* MODAL VOLÚMENES */}
      <Modal 
        show={showVolumeModal} 
        onClose={() => setShowVolumeModal(false)}
        title={editingItem ? "Editar Volumen" : "Nuevo Volumen"}
        isProcessing={isProcessing}
        onSave={handleSaveVolume}
      >
        <VolumeForm formData={volumeForm} setFormData={setVolumeForm} />
      </Modal>
    </div>
  );
}

// --- COMPONENTES DE FORMULARIO ---

const ArticleForm = ({ formData, setFormData }) => {
  const [activeStep, setActiveStep] = useState(0);
  
  const steps = [
    { id: 0, name: 'Identidad', icon: '📋' },
    { id: 1, name: 'Publicación', icon: '📅' },
    { id: 2, name: 'Contenido HTML', icon: '🔧' },
    { id: 3, name: 'Metadatos', icon: '📎' },
    { id: 4, name: 'Archivos', icon: '📁' }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="flex flex-col h-[70vh] lg:h-[60vh]">
      {/* Progress Steps - Mobile Optimized */}
      <div className="flex overflow-x-auto pb-2 mb-4 lg:mb-6 scrollbar-hide border-b border-gray-100">
        <div className="flex space-x-2 lg:space-x-0 lg:grid lg:grid-cols-5 lg:w-full">
          {steps.map((step) => (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={`
                flex items-center space-x-2 px-4 py-2 rounded-full whitespace-nowrap transition-all
                lg:flex-col lg:space-x-0 lg:space-y-1 lg:rounded-lg lg:py-3
                ${activeStep === step.id 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
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
            <Input 
              label="Título Original (ES) *" 
              name="titulo" 
              value={formData.titulo} 
              onChange={handleChange}
              required
            />
            <Input 
              label="Título (EN)" 
              name="tituloEnglish" 
              value={formData.tituloEnglish} 
              onChange={handleChange} 
            />
            <Input 
              label="Autores * (Separar por ;)" 
              name="autores" 
              value={formData.autores} 
              onChange={handleChange} 
              placeholder="Ej: Javier Vergara; Francisco Correa"
              required
            />
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
              <Input label="DOI (Opcional)" name="doi" value={formData.doi} onChange={handleChange} />
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
              <button
                onClick={() => setFormData({...formData, htmlMode: 'visual'})}
                className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center space-x-2 text-sm font-medium transition-all ${
                  formData.htmlMode === 'visual' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <PencilSquareIcon className="w-4 h-4" />
                <span>Editor Visual</span>
              </button>
              <button
                onClick={() => setFormData({...formData, htmlMode: 'code'})}
                className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center space-x-2 text-sm font-medium transition-all ${
                  formData.htmlMode === 'code' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <CodeBracketIcon className="w-4 h-4" />
                <span>Editor HTML</span>
              </button>
            </div>

            {formData.htmlMode === 'visual' ? (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  HTML Completo (ES) - Editor Visual
                </label>
                <div className="border rounded-xl overflow-hidden">
                  <ReactQuill 
                    theme="snow" 
                    modules={quillModules} 
                    value={formData.html_es} 
                    onChange={(v) => setFormData({...formData, html_es: v, rawHtml: v})} 
                    className="h-64 mb-12 lg:mb-16"
                    placeholder="Escribe o pega el contenido aquí..."
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  HTML Completo (ES) - Editor Directo
                </label>
                <div className="border rounded-xl overflow-hidden">
                  <CodeMirror
                    value={formData.rawHtml || formData.html_es || ''}
                    height="300px"
                    extensions={[html()]}
                    theme={oneDark}
                    onChange={(value) => setFormData({...formData, rawHtml: value, html_es: value})}
                    className="text-sm"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Puedes pegar código HTML directamente. Incluye etiquetas completas para tablas, footnotes, etc.
                </p>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                HTML Completo (EN) - Versión Inglés
              </label>
              <ReactQuill 
                theme="snow" 
                modules={quillModules} 
                value={formData.html_en} 
                onChange={(v) => setFormData({...formData, html_en: v})} 
                className="h-64 mb-12 lg:mb-16 border rounded-xl"
                placeholder="HTML version in English..."
              />
            </div>
          </div>
        )}

        {activeStep === 3 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                Palabras Clave (ES) * (separar con ;)
              </label>
              <input
                type="text"
                name="palabras_clave"
                value={formData.palabras_clave}
                onChange={handleChange}
                placeholder="Ej: ciencia; investigación; método"
                className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm text-sm"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                Keywords (EN) (separar con ;)
              </label>
              <input
                type="text"
                name="keywords_english"
                value={formData.keywords_english}
                onChange={handleChange}
                placeholder="Ej: science; research; method"
                className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                Resumen (ES)
              </label>
              <textarea 
                className="w-full p-3 border rounded-xl h-24 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={formData.resumen}
                onChange={(e) => setFormData({...formData, resumen: e.target.value})}
                placeholder="Resumen en español..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                Abstract (EN)
              </label>
              <textarea 
                className="w-full p-3 border rounded-xl h-24 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={formData.abstract}
                onChange={(e) => setFormData({...formData, abstract: e.target.value})}
                placeholder="English abstract..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                Conflictos de Interés (ES)
              </label>
              <textarea 
                className="w-full p-3 border rounded-xl h-20 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                name="conflicts"
                value={formData.conflicts}
                onChange={handleChange}
                placeholder="Declaración de conflictos de interés..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                Conflicts of Interest (EN)
              </label>
              <textarea 
                className="w-full p-3 border rounded-xl h-20 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                name="conflictsEnglish"
                value={formData.conflictsEnglish}
                onChange={handleChange}
                placeholder="Conflicts of interest statement..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                Financiación (ES)
              </label>
              <textarea 
                className="w-full p-3 border rounded-xl h-20 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                name="funding"
                value={formData.funding}
                onChange={handleChange}
                placeholder="Información de financiamiento..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                Funding (EN)
              </label>
              <textarea 
                className="w-full p-3 border rounded-xl h-20 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                name="fundingEnglish"
                value={formData.fundingEnglish}
                onChange={handleChange}
                placeholder="Funding information..."
              />
            </div>
          </div>
        )}

        {activeStep === 4 && (
          <div className="space-y-6">
            <div className="p-6 border-2 border-dashed border-gray-200 rounded-2xl text-center">
              <DocumentIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Sube el manuscrito final en formato PDF</p>
              <input 
                type="file" 
                accept=".pdf" 
                className="hidden" 
                id="pdf-upload" 
                onChange={(e) => setFormData({...formData, pdfFile: e.target.files[0]})} 
              />
              <label 
                htmlFor="pdf-upload" 
                className="bg-white border border-gray-300 px-6 py-2 rounded-full cursor-pointer hover:bg-gray-50 shadow-sm transition-all inline-block text-sm"
              >
                {formData.pdfFile ? formData.pdfFile.name : "Seleccionar Archivo"}
              </label>
              {formData.pdf && !formData.pdfFile && (
                <p className="text-xs text-gray-400 mt-2">PDF actual: {formData.pdf.split('/').pop()}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                Agradecimientos (ES)
              </label>
              <textarea 
                className="w-full p-3 border rounded-xl h-20 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                name="acknowledgments"
                value={formData.acknowledgments}
                onChange={handleChange}
                placeholder="Agradecimientos..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                Acknowledgments (EN)
              </label>
              <textarea 
                className="w-full p-3 border rounded-xl h-20 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                name="acknowledgmentsEnglish"
                value={formData.acknowledgmentsEnglish}
                onChange={handleChange}
                placeholder="Acknowledgments..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                Créditos de Autores (ES)
              </label>
              <textarea 
                className="w-full p-3 border rounded-xl h-20 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                name="authorCredits"
                value={formData.authorCredits}
                onChange={handleChange}
                placeholder="CRediT - Contribuciones de autores..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                Author Credits (EN)
              </label>
              <textarea 
                className="w-full p-3 border rounded-xl h-20 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                name="authorCreditsEnglish"
                value={formData.authorCreditsEnglish}
                onChange={handleChange}
                placeholder="CRediT - Author contributions..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                Disponibilidad de Datos (ES)
              </label>
              <textarea 
                className="w-full p-3 border rounded-xl h-20 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                name="dataAvailability"
                value={formData.dataAvailability}
                onChange={handleChange}
                placeholder="Declaración de disponibilidad de datos..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                Data Availability (EN)
              </label>
              <textarea 
                className="w-full p-3 border rounded-xl h-20 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                name="dataAvailabilityEnglish"
                value={formData.dataAvailabilityEnglish}
                onChange={handleChange}
                placeholder="Data availability statement..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input 
                label="Submission ID" 
                name="submissionId" 
                value={formData.submissionId} 
                onChange={handleChange}
                placeholder="ID del envío"
              />
              <Input 
                label="Author ID" 
                name="authorId" 
                value={formData.authorId} 
                onChange={handleChange}
                placeholder="ID del autor"
              />
            </div>
          </div>
        )}
      </div>

      {/* Step Navigation */}
      <div className="flex justify-between mt-4 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
          disabled={activeStep === 0}
          className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={() => setActiveStep(Math.min(4, activeStep + 1))}
          disabled={activeStep === 4}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

const VolumeForm = ({ formData, setFormData }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // Auto-generate titles if fecha and volumen are present
      if (name === 'fecha' || name === 'volumen') {
        const year = new Date(newData.fecha).getFullYear();
        if (newData.volumen && year && !isNaN(year)) {
          if (!newData.titulo || name === 'fecha' || name === 'volumen') {
            newData.titulo = `Volumen ${newData.volumen} (${year})`;
          }
          if (!newData.englishTitulo || name === 'fecha' || name === 'volumen') {
            newData.englishTitulo = `Volume ${newData.volumen} (${year})`;
          }
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
      
      <Input 
        label="Título del Volumen (ES)" 
        name="titulo" 
        value={formData.titulo} 
        onChange={handleChange}
        placeholder="Ej: Volumen 1 (2024)" 
      />
      
      <Input 
        label="Título del Volumen (EN)" 
        name="englishTitulo" 
        value={formData.englishTitulo} 
        onChange={handleChange}
        placeholder="Ej: Volume 1 (2024)" 
      />
      
      <Input label="ISSN" name="issn" value={formData.issn} onChange={handleChange} />
      
      <Input label="URL de Portada" name="portada" value={formData.portada} onChange={handleChange} />
      
      <div>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
          Editorial Note (Español)
        </label>
        <textarea 
          className="w-full p-3 border rounded-xl h-24 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          name="editorial"
          value={formData.editorial}
          onChange={handleChange}
          placeholder="Nota editorial en español..."
        />
      </div>
      
      <div>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
          Editorial Note (English)
        </label>
        <textarea 
          className="w-full p-3 border rounded-xl h-24 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          name="englishEditorial"
          value={formData.englishEditorial}
          onChange={handleChange}
          placeholder="Editorial note in English..."
        />
      </div>
      
      <div className="p-6 border-2 border-dashed border-gray-200 rounded-2xl text-center">
        <DocumentIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 mb-4">PDF del volumen completo (opcional)</p>
        <input 
          type="file" 
          accept=".pdf" 
          className="hidden" 
          id="volume-pdf-upload" 
          onChange={(e) => setFormData({...formData, pdfFile: e.target.files[0]})} 
        />
        <label 
          htmlFor="volume-pdf-upload" 
          className="bg-white border border-gray-300 px-6 py-2 rounded-full cursor-pointer hover:bg-gray-50 shadow-sm transition-all inline-block text-sm"
        >
          {formData.pdfFile ? formData.pdfFile.name : "Seleccionar Archivo"}
        </label>
        {formData.pdf && !formData.pdfFile && (
          <p className="text-xs text-gray-400 mt-2">PDF actual: {formData.pdf.split('/').pop()}</p>
        )}
      </div>
    </div>
  );
};

// --- COMPONENTES DE LISTA ---

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
          <motion.div
            key={article.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="hover:bg-gray-50 transition-colors"
          >
            <div
              className="px-4 lg:px-6 py-4 cursor-pointer flex justify-between items-center"
              onClick={() => onToggleExpand(article.id)}
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-base lg:text-lg font-semibold text-[#001529] truncate" title={article.titulo}>
                  {article.titulo}
                </h3>
                <p className="mt-1 text-xs lg:text-sm text-gray-600 truncate" title={article.autores}>
                  {article.autores}
                </p>
                <div className="mt-2 flex items-center space-x-2">
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    Vol. {article.volumen} N° {article.numero}
                  </span>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium hidden sm:inline-block">
                    {article.area}
                  </span>
                </div>
              </div>
              <ChevronDownIcon
                className={`w-5 h-5 lg:w-6 lg:h-6 text-gray-400 transition-transform duration-300 flex-shrink-0 ${expandedArticles[article.id] ? 'rotate-180' : ''}`}
              />
            </div>

            <AnimatePresence>
              {expandedArticles[article.id] && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 lg:px-6 pb-6 bg-gray-50"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Resumen</h4>
                        <div className="text-gray-700 prose prose-sm max-w-none" 
                          dangerouslySetInnerHTML={{ __html: article.resumen || 'No disponible' }} 
                        />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Abstract</h4>
                        <div className="text-gray-700 prose prose-sm max-w-none" 
                          dangerouslySetInnerHTML={{ __html: article.abstract || 'No disponible' }} 
                        />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Palabras Clave</h4>
                        <p className="text-gray-700">{article.palabras_clave?.join(', ') || 'No disponible'}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Keywords</h4>
                        <p className="text-gray-700">{article.keywords_english?.join(', ') || 'No disponible'}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-gray-500 text-xs">Fecha de publicación</p>
                          <p className="font-medium">{formatDate(article.fecha)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Volumen/Número</p>
                          <p className="font-medium">{article.volumen}/{article.numero}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Páginas</p>
                          <p className="font-medium">{article.primeraPagina}-{article.ultimaPagina}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Área</p>
                          <p className="font-medium">{article.area}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Tipo</p>
                          <p className="font-medium">{article.tipo}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Type</p>
                          <p className="font-medium">{article.type || 'N/A'}</p>
                        </div>
                      </div>

                      {article.submissionId && (
                        <div>
                          <p className="text-gray-500 text-xs">Submission ID</p>
                          <p className="font-medium text-xs">{article.submissionId}</p>
                        </div>
                      )}

                      {article.authorId && (
                        <div>
                          <p className="text-gray-500 text-xs">Author ID</p>
                          <p className="font-medium text-xs">{article.authorId}</p>
                        </div>
                      )}

                      {article.conflicts && article.conflicts !== 'Los autores declaran no tener conflictos de interés.' && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">Conflictos de Interés</h4>
                          <div className="text-gray-700 prose prose-sm max-w-none" 
                            dangerouslySetInnerHTML={{ __html: article.conflicts }} 
                          />
                        </div>
                      )}

                      {article.funding && article.funding !== 'No declarada' && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">Financiación</h4>
                          <div className="text-gray-700 prose prose-sm max-w-none" 
                            dangerouslySetInnerHTML={{ __html: article.funding }} 
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                        {article.pdf && (
                          <a
                            href={article.pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                          >
                            <DocumentIcon className="w-4 h-4 mr-2" />
                            Ver PDF
                          </a>
                        )}
                        <div className="flex space-x-2 ml-auto">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(article);
                            }}
                            className="p-2 text-yellow-600 bg-yellow-100 rounded-lg hover:bg-yellow-200 transition-colors"
                          >
                            <PencilIcon className="w-4 h-4 lg:w-5 lg:h-5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(article.id);
                            }}
                            className="p-2 text-red-600 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
                          >
                            <TrashIcon className="w-4 h-4 lg:w-5 lg:h-5" />
                          </button>
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
          <motion.div
            key={volume.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="hover:bg-gray-50 transition-colors"
          >
            <div
              className="px-4 lg:px-6 py-4 cursor-pointer flex justify-between items-center"
              onClick={() => onToggleExpand(volume.id)}
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-base lg:text-lg font-semibold text-[#001529] truncate" title={volume.titulo}>
                  {volume.titulo}
                </h3>
                <p className="mt-1 text-xs lg:text-sm text-gray-600">
                  Volumen {volume.volumen}, Número {volume.numero}
                </p>
                <div className="mt-2 flex items-center space-x-2">
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    {formatDate(volume.fecha)}
                  </span>
                  {volume.issn && (
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium hidden sm:inline-block">
                      ISSN: {volume.issn}
                    </span>
                  )}
                </div>
              </div>
              <ChevronDownIcon
                className={`w-5 h-5 lg:w-6 lg:h-6 text-gray-400 transition-transform duration-300 flex-shrink-0 ${expandedVolumes[volume.id] ? 'rotate-180' : ''}`}
              />
            </div>

            <AnimatePresence>
              {expandedVolumes[volume.id] && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 lg:px-6 pb-6 bg-gray-50"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {volume.editorial && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Nota Editorial</h4>
                        <div className="text-gray-700 prose prose-sm max-w-none" 
                          dangerouslySetInnerHTML={{ __html: volume.editorial }} 
                        />
                      </div>
                    )}
                    {volume.englishEditorial && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Editorial Note</h4>
                        <div className="text-gray-700 prose prose-sm max-w-none" 
                          dangerouslySetInnerHTML={{ __html: volume.englishEditorial }} 
                        />
                      </div>
                    )}
                    
                    <div className="lg:col-span-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-gray-500 text-xs">Volumen</p>
                          <p className="font-medium">{volume.volumen}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Número</p>
                          <p className="font-medium">{volume.numero}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Fecha</p>
                          <p className="font-medium">{formatDate(volume.fecha)}</p>
                        </div>
                        {volume.issn && (
                          <div>
                            <p className="text-gray-500 text-xs">ISSN</p>
                            <p className="font-medium">{volume.issn}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {volume.portada && (
                      <div className="lg:col-span-2">
                        <h4 className="font-semibold text-gray-900 mb-2">Portada</h4>
                        <img 
                          src={volume.portada} 
                          alt={volume.titulo}
                          className="max-h-48 rounded-lg shadow-md"
                        />
                      </div>
                    )}

                    <div className="lg:col-span-2 flex items-center justify-between pt-4 border-t border-gray-200">
                      {volume.pdf && (
                        <a
                          href={volume.pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          <DocumentIcon className="w-4 h-4 mr-2" />
                          Ver PDF del Volumen
                        </a>
                      )}
                      <div className="flex space-x-2 ml-auto">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(volume);
                          }}
                          className="p-2 text-yellow-600 bg-yellow-100 rounded-lg hover:bg-yellow-200 transition-colors"
                        >
                          <PencilIcon className="w-4 h-4 lg:w-5 lg:h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(volume.id);
                          }}
                          className="p-2 text-red-600 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          <TrashIcon className="w-4 h-4 lg:w-5 lg:h-5" />
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

// --- COMPONENTES ATÓMICOS ---

const Input = ({ label, ...props }) => (
  <div>
    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">{label}</label>
    <input 
      className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm text-sm" 
      {...props} 
    />
  </div>
);

const Modal = ({ show, onClose, title, children, onSave, isProcessing }) => (
  <AnimatePresence>
    {show && (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-2 lg:p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="absolute inset-0 bg-[#001529]/60 backdrop-blur-sm" 
          onClick={onClose} 
        />
        <motion.div 
          initial={{ scale: 0.9, y: 20 }} 
          animate={{ scale: 1, y: 0 }} 
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white w-full max-w-4xl rounded-2xl lg:rounded-3xl shadow-2xl relative z-10 overflow-hidden max-h-[90vh] flex flex-col"
        >
          <div className="px-4 lg:px-8 py-4 lg:py-6 border-b flex justify-between items-center bg-gray-50 sticky top-0">
            <h3 className="text-lg lg:text-xl font-bold font-serif truncate pr-4">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full flex-shrink-0">
              <XMarkIcon className="w-5 h-5 lg:w-6 lg:h-6" />
            </button>
          </div>
          
          <div className="p-4 lg:p-8 overflow-y-auto flex-1">
            {children}
          </div>
          
          <div className="px-4 lg:px-8 py-4 lg:py-6 bg-gray-50 border-t flex justify-end gap-3 sticky bottom-0">
            <button 
              onClick={onClose} 
              className="px-4 lg:px-6 py-2 font-semibold text-gray-500 text-sm lg:text-base"
              disabled={isProcessing}
            >
              Cancelar
            </button>
            <button 
              onClick={onSave} 
              disabled={isProcessing}
              className="bg-blue-600 text-white px-6 lg:px-8 py-2 rounded-xl font-bold hover:bg-blue-700 shadow-lg flex items-center gap-2 disabled:opacity-50 text-sm lg:text-base"
            >
              {isProcessing ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 lg:w-5 lg:h-5 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4 lg:w-5 lg:h-5" />
                  Guardar
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

const Notification = ({ status, clear }) => (
  <motion.div 
    initial={{ x: 100, opacity: 0 }} 
    animate={{ x: 0, opacity: 1 }} 
    exit={{ x: 100, opacity: 0 }}
    className={`fixed top-4 right-4 lg:top-8 lg:right-8 z-[2000] p-4 rounded-2xl shadow-2xl border-l-4 min-w-[280px] lg:min-w-[300px] flex items-center justify-between ${
      status.type === 'success' ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 
      status.type === 'error' ? 'bg-red-50 border-red-500 text-red-800' : 'bg-blue-50 border-blue-500 text-blue-800'
    }`}
  >
    <div className="flex items-center gap-3">
      {status.type === 'success' ? <CheckIcon className="w-5 h-5 lg:w-6 lg:h-6" /> : <ExclamationTriangleIcon className="w-5 h-5 lg:w-6 lg:h-6" />}
      <span className="font-medium text-sm lg:text-base">{status.msg}</span>
    </div>
    <button onClick={clear} className="p-1 hover:bg-black/5 rounded-full">
      <XMarkIcon className="w-4 h-4" />
    </button>
  </motion.div>
);

const SidebarItem = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
      active ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white/5 hover:text-white'
    }`}
  >
    {React.cloneElement(icon, { className: "w-5 h-5" })}
    <span className="font-medium">{label}</span>
  </button>
);

const SidebarItemMobile = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
      active ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white/5 hover:text-white'
    }`}
  >
    {React.cloneElement(icon, { className: "w-5 h-5" })}
    <span className="font-medium">{label}</span>
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