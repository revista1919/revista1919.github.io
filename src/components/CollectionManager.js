// CollectionManager.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '../firebase';
import {
  PlusIcon, PencilIcon, TrashIcon, CheckIcon, ExclamationTriangleIcon,
  DocumentTextIcon, ArrowPathIcon, FolderIcon,
  XMarkIcon, ChevronDownIcon, MagnifyingGlassIcon,
  ChevronRightIcon, LanguageIcon
} from '@heroicons/react/24/outline';

// ============================================
// CONFIGURACIÓN
// ============================================
const DOMAIN = 'https://www.revistacienciasestudiantes.com';
const COLLECTIONS_JSON_URL = `${DOMAIN}/collections/collections.json`;
const MANAGE_COLLECTIONS_URL = 'https://us-central1-usuarios-rnce.cloudfunctions.net/manageCollections';
const MANAGE_ARTICLES_COLLECTION_URL = 'https://managecollectionarticles-ggqsq2kkua-uc.a.run.app';
const REBUILD_URL = 'https://triggerrebuild-ggqsq2kkua-uc.a.run.app/';

// ============================================
// ESTADOS INICIALES (CORREGIDOS)
// ============================================
const initialCollectionState = {
  id: '',
  title: { spanish: '', english: '' },
  description: { spanish: '', english: '' },
  'carpet-name': '',
  image: '',
  languages: ['spanish'],
  defaultLanguage: 'spanish',
  status: 'active'
};

// ⚠️ ESTE ES EL ESTADO CORRECTO QUE COINCIDE CON TU JSON
const initialArticleState = {
  id: '',
  name: { spanish: '', english: '' },
  'name-translated': { spanish: '', english: '' },
  author: [],
  date: '',
  'original-date': '',
  editor: [],
  colaboradores: [],
  abstract: { spanish: '', english: '' },
  keywords: { spanish: [], english: [] },  // ¡OJO! Es un objeto con arrays
  html: { spanish: '', english: '' },
  references: { spanish: '', english: '' },
  appendix: { spanish: '', english: '' },
  'editorial-note': { spanish: '', english: '' },
  'pdf-url': '',
  idioma: 'Latín',
  area: [],
  image: '',
  language: 'spanish'
};

const initialAuthorState = {
  name: '',
  'birth-date': '',
  'death-date': '',
  bio: { spanish: '', english: '' }, // La bio también puede ser bilingüe
  link: ''
};

const initialEditorState = {
  name: '',
  website: '',
  orcid: '',
  email: ''
};

const initialColaboradorState = {
  name: '',
  role: { spanish: '', english: '' }, // El rol también puede ser bilingüe
  uid: '',
  link: '',
  orcid: '',
  email: ''
};

// ============================================
// FUNCIONES UTILITARIAS
// ============================================
const generateSlug = (name) => {
  if (!name) return '';
  return name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const generateArticleId = (collectionId) => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const day = String(new Date().getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${collectionId}-${year}${month}${day}-${random}`;
};

// Helper para obtener texto localizado de forma segura
const getLocalizedText = (field, lang = 'spanish') => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field[lang] || field.spanish || field.english || '';
};

// Helper para arrays localizados (como keywords)
const getLocalizedArray = (field, lang = 'spanish') => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  return field[lang] || field.spanish || field.english || [];
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function CollectionManager({ user }) {
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [collectionArticles, setCollectionArticles] = useState({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCollections, setExpandedCollections] = useState({});
  const [expandedArticles, setExpandedArticles] = useState({});
  
  // Modales
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState(null);
  const [editingArticle, setEditingArticle] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Forms
  const [collectionForm, setCollectionForm] = useState(initialCollectionState);
  const [articleForm, setArticleForm] = useState(initialArticleState);

  // ========================================
  // CARGA DE DATOS
  // ========================================
  useEffect(() => {
    const fetchCollections = async () => {
      setLoading(true);
      try {
        const response = await fetch(COLLECTIONS_JSON_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        setCollections(data);
        
        // Cargar artículos de cada colección
        data.forEach(collection => {
          if (collection['carpet-name']) {
            fetchCollectionArticles(collection['carpet-name']);
          }
        });
      } catch (error) {
        console.error("Error fetching collections.json:", error);
        setStatus({ type: 'error', msg: 'Error al cargar las colecciones.' });
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchCollections();
    }
  }, [user]);

  const fetchCollectionArticles = async (carpetName) => {
    try {
      const response = await fetch(`${DOMAIN}/collections/${carpetName}/metadata.json`);
      if (!response.ok) {
        if (response.status === 404) {
          setCollectionArticles(prev => ({ ...prev, [carpetName]: [] }));
        }
        return;
      }
      const data = await response.json();
      setCollectionArticles(prev => ({ ...prev, [carpetName]: data }));
    } catch (error) {
      console.error(`Error fetching articles for ${carpetName}:`, error);
      setCollectionArticles(prev => ({ ...prev, [carpetName]: [] }));
    }
  };

  // ========================================
  // FUNCIONES DE GUARDADO
  // ========================================
  const triggerRebuild = async () => {
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(REBUILD_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: 'rebuild' }),
      });
      return response.ok;
    } catch (error) {
      console.error("Rebuild error:", error);
      return false;
    }
  };

  const handleSaveCollection = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setStatus(null);

    try {
      const token = await auth.currentUser.getIdToken();
      
      const collectionData = {
        ...collectionForm,
        'carpet-name': collectionForm['carpet-name'] || generateSlug(collectionForm.title.spanish || collectionForm.title.english)
      };

      const payload = {
        action: editingCollection ? 'edit' : 'add',
        collection: collectionData,
        id: editingCollection?.id
      };

      const response = await fetch(MANAGE_COLLECTIONS_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(await response.text());

      setShowCollectionModal(false);
      resetForms();
      await triggerRebuild();
      
      setStatus({ type: 'success', msg: '✅ Colección guardada exitosamente' });
      
      // Recargar después de 2 segundos
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (err) {
      console.error("Error saving collection:", err);
      setStatus({ type: 'error', msg: `❌ Error: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveArticle = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setStatus(null);

    try {
      const token = await auth.currentUser.getIdToken();
      
      // Preparar el artículo para guardar
      let articleData = { ...articleForm };
      
      // Generar ID si es nuevo
      if (!editingArticle && !articleData.id) {
        articleData.id = generateArticleId(selectedCollection.id);
      }

      // Asegurar estructura correcta de campos bilingües
      if (typeof articleData.abstract === 'string') {
        articleData.abstract = { spanish: articleData.abstract, english: '' };
      }
      if (typeof articleData.html === 'string') {
        articleData.html = { spanish: articleData.html, english: '' };
      }
      if (typeof articleData.references === 'string') {
        articleData.references = { spanish: articleData.references, english: '' };
      }
      if (typeof articleData.appendix === 'string') {
        articleData.appendix = { spanish: articleData.appendix, english: '' };
      }
      if (typeof articleData.keywords === 'string') {
        articleData.keywords = { spanish: articleData.keywords.split(',').map(k => k.trim()), english: [] };
      }

      const payload = {
        action: editingArticle ? 'edit' : 'add',
        collection: selectedCollection['carpet-name'],
        article: articleData,
        id: editingArticle?.id
      };

      const response = await fetch(MANAGE_ARTICLES_COLLECTION_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(await response.text());

      setShowArticleModal(false);
      resetForms();
      await triggerRebuild();
      
      // Recargar artículos de la colección
      fetchCollectionArticles(selectedCollection['carpet-name']);
      
      setStatus({ type: 'success', msg: '✅ Artículo guardado exitosamente' });
    } catch (err) {
      console.error("Error saving article:", err);
      setStatus({ type: 'error', msg: `❌ Error: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  // ========================================
  // FUNCIONES DE ELIMINACIÓN
  // ========================================
  const handleDeleteCollection = async (collection) => {
    const collectionName = typeof collection.title === 'string' 
      ? collection.title 
      : collection.title?.spanish || collection.title?.english;
    
    if (!confirm(`¿Estás seguro de eliminar la colección "${collectionName}"?`)) return;
    
    setIsProcessing(true);
    try {
      const token = await auth.currentUser.getIdToken();
      
      const response = await fetch(MANAGE_COLLECTIONS_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          action: 'delete', 
          id: collection.id,
          carpetName: collection['carpet-name']
        })
      });

      if (!response.ok) throw new Error(await response.text());

      await triggerRebuild();
      setStatus({ type: 'success', msg: '✅ Colección eliminada' });
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      setStatus({ type: 'error', msg: `❌ Error: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteArticle = async (article) => {
    const articleName = typeof article.name === 'string' 
      ? article.name 
      : article.name?.spanish || article.name?.english;
    
    if (!confirm(`¿Estás seguro de eliminar el artículo "${articleName}"?`)) return;
    
    setIsProcessing(true);
    try {
      const token = await auth.currentUser.getIdToken();
      
      const response = await fetch(MANAGE_ARTICLES_COLLECTION_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          action: 'delete',
          collection: selectedCollection['carpet-name'],
          id: article.id
        })
      });

      if (!response.ok) throw new Error(await response.text());

      await triggerRebuild();
      fetchCollectionArticles(selectedCollection['carpet-name']);
      setStatus({ type: 'success', msg: '✅ Artículo eliminado' });
    } catch (err) {
      setStatus({ type: 'error', msg: `❌ Error: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  // ========================================
  // UTILIDADES
  // ========================================
  const resetForms = () => {
    setCollectionForm(initialCollectionState);
    setArticleForm(initialArticleState);
    setEditingCollection(null);
    setEditingArticle(null);
  };

  const toggleCollectionExpand = (id) => 
    setExpandedCollections(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleArticleExpand = (id) => 
    setExpandedArticles(prev => ({ ...prev, [id]: !prev[id] }));

  // Filtro de colecciones
  const filteredCollections = collections.filter(c => {
    const titleSpanish = c.title?.spanish?.toLowerCase() || '';
    const titleEnglish = c.title?.english?.toLowerCase() || '';
    const descSpanish = c.description?.spanish?.toLowerCase() || '';
    const descEnglish = c.description?.english?.toLowerCase() || '';
    const searchLower = searchTerm.toLowerCase();
    
    return titleSpanish.includes(searchLower) ||
           titleEnglish.includes(searchLower) ||
           descSpanish.includes(searchLower) ||
           descEnglish.includes(searchLower);
  });

  // ========================================
  // RENDER
  // ========================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#001529]">Gestor de Colecciones</h2>
          <p className="text-sm text-gray-500">
            {collections.length} colecciones disponibles
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar colección..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <button
            onClick={() => {
              resetForms();
              setShowCollectionModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 font-medium transition-all"
          >
            <PlusIcon className="w-5 h-5" />
            Nueva Colección
          </button>
        </div>
      </div>

      {/* Notificaciones */}
      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl flex items-center justify-between ${
              status.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {status.type === 'success' ? 
                <CheckIcon className="w-5 h-5" /> : 
                <ExclamationTriangleIcon className="w-5 h-5" />
              }
              <span>{status.msg}</span>
            </div>
            <button onClick={() => setStatus(null)}>
              <XMarkIcon className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista de Colecciones */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <ArrowPathIcon className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Cargando colecciones...</p>
          </div>
        ) : filteredCollections.length === 0 ? (
          <div className="p-12 text-center">
            <FolderIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay colecciones</h3>
            <p className="text-gray-500">Comienza creando tu primera colección.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredCollections.map((collection) => (
              <CollectionItem
                key={collection.id}
                collection={collection}
                articles={collectionArticles[collection['carpet-name']] || []}
                expanded={expandedCollections[collection.id]}
                onToggle={() => toggleCollectionExpand(collection.id)}
                onEdit={() => {
                  setEditingCollection(collection);
                  setCollectionForm(collection);
                  setShowCollectionModal(true);
                }}
                onDelete={() => handleDeleteCollection(collection)}
                onAddArticle={() => {
                  setSelectedCollection(collection);
                  resetForms();
                  setShowArticleModal(true);
                }}
                onEditArticle={(article) => {
                  setSelectedCollection(collection);
                  setEditingArticle(article);
                  setArticleForm(article);
                  setShowArticleModal(true);
                }}
                onDeleteArticle={(article) => {
                  setSelectedCollection(collection);
                  handleDeleteArticle(article);
                }}
                expandedArticles={expandedArticles}
                onToggleArticle={toggleArticleExpand}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modales */}
      <CollectionModal
        show={showCollectionModal}
        onClose={() => setShowCollectionModal(false)}
        form={collectionForm}
        setForm={setCollectionForm}
        onSave={handleSaveCollection}
        isProcessing={isProcessing}
        isEditing={!!editingCollection}
      />

      {selectedCollection && (
        <ArticleModal
          show={showArticleModal}
          onClose={() => setShowArticleModal(false)}
          form={articleForm}
          setForm={setArticleForm}
          onSave={handleSaveArticle}
          isProcessing={isProcessing}
          isEditing={!!editingArticle}
          collection={selectedCollection}
        />
      )}
    </div>
  );
}

// ============================================
// COMPONENTE: CollectionItem
// ============================================
const CollectionItem = ({ 
  collection, articles, expanded, onToggle, onEdit, onDelete, 
  onAddArticle, onEditArticle, onDeleteArticle, expandedArticles, onToggleArticle 
}) => {
  const collectionTitle = typeof collection.title === 'string' 
    ? collection.title 
    : collection.title?.spanish || collection.title?.english;
  
  const collectionDesc = typeof collection.description === 'string'
    ? collection.description
    : collection.description?.spanish || collection.description?.english;

  return (
    <div className="hover:bg-gray-50 transition-colors">
      {/* Header de Colección */}
      <div 
        className="px-6 py-4 cursor-pointer flex justify-between items-center"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            {collection.image && (
              <img 
                src={collection.image} 
                alt={collectionTitle}
                className="w-10 h-10 rounded-lg object-cover"
              />
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-semibold text-[#001529]">
                  {collectionTitle}
                </h3>
                {collection.title?.english && collection.title.english !== collectionTitle && (
                  <span className="text-sm text-gray-500">
                    / {collection.title.english}
                  </span>
                )}
                <span className="text-sm font-normal text-gray-500">
                  ({collection.id})
                </span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-1">
                {collectionDesc}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                  {collection['carpet-name']}
                </span>
                <LanguageBadge languages={collection.languages || ['spanish']} />
                <span className="text-xs text-gray-500">
                  {articles.length} {articles.length === 1 ? 'artículo' : 'artículos'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onAddArticle}
            className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            title="Agregar artículo"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
          <button
            onClick={onEdit}
            className="p-2 text-yellow-600 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
            title="Editar colección"
          >
            <PencilIcon className="w-5 h-5" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            title="Eliminar colección"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
          <ChevronDownIcon 
            className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${
              expanded ? 'rotate-180' : ''
            }`} 
          />
        </div>
      </div>

      {/* Artículos de la Colección */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-50 border-t border-gray-200"
          >
            <div className="p-4">
              {articles.length === 0 ? (
                <div className="text-center py-8">
                  <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No hay artículos en esta colección</p>
                  <button
                    onClick={onAddArticle}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    + Agregar primer artículo
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {articles.map((article) => (
                    <ArticleItem
                      key={article.id}
                      article={article}
                      expanded={expandedArticles[article.id]}
                      onToggle={() => onToggleArticle(article.id)}
                      onEdit={() => onEditArticle(article)}
                      onDelete={() => onDeleteArticle(article)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// COMPONENTE: ArticleItem (CORREGIDO)
// ============================================
const ArticleItem = ({ article, expanded, onToggle, onEdit, onDelete }) => {
  // Obtener textos de forma segura
  const articleName = getLocalizedText(article.name);
  const translatedName = getLocalizedText(article['name-translated']);
  const abstract = getLocalizedText(article.abstract);
  const authorName = article.author?.[0]?.name || 'Autor desconocido';
  const keywords = getLocalizedArray(article.keywords);

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow">
      <div 
        className="px-4 py-3 cursor-pointer flex justify-between items-center"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <DocumentTextIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-gray-900">
                {articleName || 'Sin título'}
              </h4>
              {translatedName && translatedName !== articleName && (
                <p className="text-sm text-gray-500">
                  {translatedName}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  {article.id}
                </span>
                <span className="text-xs text-gray-500">
                  {authorName}
                </span>
                {article['pdf-url'] && (
                  <a
                    href={article['pdf-url']}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-600 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    PDF
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
            title="Editar artículo"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar artículo"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
          <ChevronDownIcon 
            className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${
              expanded ? 'rotate-180' : ''
            }`} 
          />
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-4 border-t border-gray-100"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 text-sm">
              <div>
                <h5 className="font-semibold text-gray-700 mb-1">Autores</h5>
                {article.author?.map((author, idx) => (
                  <div key={idx} className="text-gray-600">
                    {author.name}
                    {author.link && (
                      <a href={author.link} target="_blank" rel="noopener noreferrer" 
                         className="ml-2 text-blue-600 text-xs hover:underline">
                        (bio)
                      </a>
                    )}
                  </div>
                ))}
              </div>
              
              <div>
                <h5 className="font-semibold text-gray-700 mb-1">Editores</h5>
                {article.editor?.map((editor, idx) => (
                  <div key={idx} className="text-gray-600">
                    {editor.name}
                  </div>
                ))}
              </div>
              
              <div className="md:col-span-2">
                <h5 className="font-semibold text-gray-700 mb-1">Abstract</h5>
                <p className="text-gray-600 text-sm line-clamp-3">
                  {abstract || 'Sin abstract'}
                </p>
              </div>
              
              <div>
                <h5 className="font-semibold text-gray-700 mb-1">Fecha original</h5>
                <p className="text-gray-600">{article['original-date'] || 'No especificada'}</p>
              </div>
              
              <div>
                <h5 className="font-semibold text-gray-700 mb-1">Áreas</h5>
                <div className="flex flex-wrap gap-1">
                  {article.area?.map((a, idx) => (
                    <span key={idx} className="px-2 py-1 bg-gray-100 rounded-full text-xs">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="md:col-span-2">
                <h5 className="font-semibold text-gray-700 mb-1">Keywords</h5>
                <div className="flex flex-wrap gap-1">
                  {keywords.map((kw, idx) => (
                    <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// COMPONENTE: LanguageBadge
// ============================================
const LanguageBadge = ({ languages }) => {
  const config = {
    spanish: { label: 'Español', bg: 'bg-green-100', text: 'text-green-700', short: 'ES' },
    english: { label: 'English', bg: 'bg-blue-100', text: 'text-blue-700', short: 'EN' }
  };

  if (!languages || languages.length === 0) {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
        ES
      </span>
    );
  }

  if (languages.length === 1) {
    const lang = languages[0];
    const { label, bg, text } = config[lang] || config.spanish;
    return (
      <span className={`text-xs px-2 py-1 rounded-full ${bg} ${text}`}>
        {label}
      </span>
    );
  }

  return (
    <div className="flex gap-1">
      {languages.map(lang => (
        <span
          key={lang}
          className={`text-xs px-1.5 py-1 rounded-full ${
            lang === 'spanish' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
          }`}
        >
          {config[lang]?.short || lang.slice(0, 2).toUpperCase()}
        </span>
      ))}
    </div>
  );
};

// ============================================
// COMPONENTE: CollectionModal
// ============================================
const CollectionModal = ({ 
  show, onClose, form, setForm, onSave, isProcessing, isEditing 
}) => {
  const [activeLang, setActiveLang] = useState('spanish');
  
  const languages = [
    { value: 'spanish', label: 'Español' },
    { value: 'english', label: 'Inglés' }
  ];

  const handleTitleChange = (lang, value) => {
    setForm({
      ...form, 
      title: { ...form.title, [lang]: value }
    });
  };

  const handleDescriptionChange = (lang, value) => {
    setForm({
      ...form, 
      description: { ...form.description, [lang]: value }
    });
  };

  const handleLanguagesChange = (langValue) => {
    const currentLangs = form.languages || ['spanish'];
    let newLangs;
    
    if (currentLangs.includes(langValue)) {
      if (currentLangs.length === 1) return;
      newLangs = currentLangs.filter(l => l !== langValue);
    } else {
      newLangs = [...currentLangs, langValue];
    }
    
    setForm({...form, languages: newLangs});
  };

  return (
    <Modal show={show} onClose={onClose} title={isEditing ? "Editar Colección" : "Nueva Colección"}>
      <form onSubmit={onSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input 
            label="ID *" 
            value={form.id}
            onChange={(e) => setForm({...form, id: e.target.value})}
            required
            placeholder="Ej: CC"
          />
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
              Idiomas Soportados
            </label>
            <div className="space-y-2">
              {languages.map(lang => (
                <label key={lang.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.languages?.includes(lang.value)}
                    onChange={() => handleLanguagesChange(lang.value)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{lang.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Selector de idioma */}
        <div className="flex gap-2 border-b border-gray-200 pb-2">
          {(form.languages?.length > 0 ? form.languages : ['spanish']).map(lang => {
            const langConfig = languages.find(l => l.value === lang);
            return (
              <button
                key={lang}
                type="button"
                onClick={() => setActiveLang(lang)}
                className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                  activeLang === lang
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {langConfig?.label || lang}
              </button>
            );
          })}
        </div>

        <Input 
          label={`Título (${activeLang}) *`}
          value={form.title?.[activeLang] || ''}
          onChange={(e) => handleTitleChange(activeLang, e.target.value)}
          required
        />

        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
            Descripción ({activeLang})
          </label>
          <textarea
            value={form.description?.[activeLang] || ''}
            onChange={(e) => handleDescriptionChange(activeLang, e.target.value)}
            rows="3"
            className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input 
            label="Nombre de carpeta"
            value={form['carpet-name']}
            onChange={(e) => setForm({...form, 'carpet-name': e.target.value})}
            placeholder="auto-generado si se deja vacío"
          />
          <Input 
            label="URL de imagen"
            value={form.image}
            onChange={(e) => setForm({...form, image: e.target.value})}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 font-semibold text-gray-500 hover:bg-gray-100 rounded-xl"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isProcessing}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            {isProcessing ? (
              <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Guardando...</>
            ) : (
              <><CheckIcon className="w-4 h-4" /> Guardar</>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ============================================
// COMPONENTE: ArticleModal (COMPLETAMENTE REESCRITO)
// ============================================
const ArticleModal = ({ 
  show, onClose, form, setForm, onSave, isProcessing, isEditing, collection 
}) => {
  const [activeTab, setActiveTab] = useState('basic');
  const [activeLang, setActiveLang] = useState('spanish');
  
  const tabs = [
    { id: 'basic', label: 'Básico', icon: '📋' },
    { id: 'authors', label: 'Autores', icon: '👥' },
    { id: 'editors', label: 'Editores/Colab', icon: '✏️' },
    { id: 'content', label: 'Contenido', icon: '📄' },
    { id: 'metadata', label: 'Metadatos', icon: '🏷️' }
  ];

  const languages = [
    { value: 'spanish', label: 'Español' },
    { value: 'english', label: 'English' }
  ];

  // Handlers específicos para campos bilingües
  const handleTextChange = (field, lang, value) => {
    setForm({
      ...form,
      [field]: {
        ...(form[field] || {}),
        [lang]: value
      }
    });
  };

  const handleKeywordsChange = (lang, value) => {
    const keywordsArray = value.split(',').map(k => k.trim()).filter(Boolean);
    setForm({
      ...form,
      keywords: {
        ...(form.keywords || {}),
        [lang]: keywordsArray
      }
    });
  };

  const handleArrayChange = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(Boolean);
    setForm({...form, [field]: array});
  };

  // Handlers para autores
  const handleAuthorChange = (index, field, lang, value) => {
    const newAuthors = [...form.author];
    
    // Si el campo es bilingüe (bio)
    if (field === 'bio') {
      newAuthors[index] = {
        ...newAuthors[index],
        bio: {
          ...(newAuthors[index]?.bio || {}),
          [lang]: value
        }
      };
    } else {
      newAuthors[index] = { ...newAuthors[index], [field]: value };
    }
    
    setForm({...form, author: newAuthors});
  };

  const addAuthor = () => {
    setForm({...form, author: [...form.author, {...initialAuthorState}]});
  };

  const removeAuthor = (index) => {
    setForm({...form, author: form.author.filter((_, i) => i !== index)});
  };

  // Handlers para editores
  const handleEditorChange = (index, field, value) => {
    const newEditors = [...form.editor];
    newEditors[index] = { ...newEditors[index], [field]: value };
    setForm({...form, editor: newEditors});
  };

  const addEditor = () => {
    setForm({...form, editor: [...form.editor, {...initialEditorState}]});
  };

  const removeEditor = (index) => {
    setForm({...form, editor: form.editor.filter((_, i) => i !== index)});
  };

  // Handlers para colaboradores
  const handleColaboradorChange = (index, field, lang, value) => {
    const newColabs = [...form.colaboradores];
    
    if (field === 'role') {
      newColabs[index] = {
        ...newColabs[index],
        role: {
          ...(newColabs[index]?.role || {}),
          [lang]: value
        }
      };
    } else {
      newColabs[index] = { ...newColabs[index], [field]: value };
    }
    
    setForm({...form, colaboradores: newColabs});
  };

  const addColaborador = () => {
    setForm({...form, colaboradores: [...form.colaboradores, {...initialColaboradorState}]});
  };

  const removeColaborador = (index) => {
    setForm({...form, colaboradores: form.colaboradores.filter((_, i) => i !== index)});
  };

  // Obtener el título de la colección
  const collectionTitle = typeof collection.title === 'string' 
    ? collection.title 
    : collection.title?.spanish || collection.title?.english;

  return (
    <Modal 
      show={show} 
      onClose={onClose} 
      title={isEditing ? "Editar Artículo" : "Nuevo Artículo"}
      size="xl"
    >
      <form onSubmit={onSave} className="space-y-6">
        {/* Información de la colección */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Colección:</span> {collectionTitle} ({collection.id})
          </p>
        </div>

        {/* Selector de idioma para contenido bilingüe */}
        <div className="flex gap-2 border-b border-gray-200 pb-2">
          {languages.map(lang => (
            <button
              key={lang.value}
              type="button"
              onClick={() => setActiveLang(lang.value)}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                activeLang === lang.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto pb-2 border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="max-h-[60vh] overflow-y-auto pr-2">
          {/* TAB: BÁSICO */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <Input
                label="ID del Artículo"
                value={form.id}
                onChange={(e) => setForm({...form, id: e.target.value})}
                placeholder={!isEditing ? "Se generará automáticamente" : ""}
                disabled={!isEditing}
              />
              
              <Input
                label={`Nombre Original (${activeLang}) *`}
                value={getLocalizedText(form.name, activeLang)}
                onChange={(e) => handleTextChange('name', activeLang, e.target.value)}
                required
              />
              
              <Input
                label={`Nombre Traducido (${activeLang})`}
                value={getLocalizedText(form['name-translated'], activeLang)}
                onChange={(e) => handleTextChange('name-translated', activeLang, e.target.value)}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Fecha de publicación"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({...form, date: e.target.value})}
                />
                <Input
                  label="Fecha Original"
                  value={form['original-date']}
                  onChange={(e) => setForm({...form, 'original-date': e.target.value})}
                  placeholder="Ej: 01-01-1748"
                />
              </div>
              
              <Input
                label="Idioma del texto original"
                value={form.idioma}
                onChange={(e) => setForm({...form, idioma: e.target.value})}
                placeholder="Ej: Latín"
              />
            </div>
          )}

          {/* TAB: AUTORES */}
          {activeTab === 'authors' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">Autores</h4>
                <button
                  type="button"
                  onClick={addAuthor}
                  className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  + Agregar Autor
                </button>
              </div>
              
              {form.author.map((author, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <h5 className="font-medium">Autor {index + 1}</h5>
                    <button
                      type="button"
                      onClick={() => removeAuthor(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <Input
                    label="Nombre *"
                    value={author.name || ''}
                    onChange={(e) => handleAuthorChange(index, 'name', null, e.target.value)}
                    required
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Fecha Nacimiento"
                      value={author['birth-date'] || ''}
                      onChange={(e) => handleAuthorChange(index, 'birth-date', null, e.target.value)}
                      placeholder="dd-mm-yyyy"
                    />
                    <Input
                      label="Fecha Muerte"
                      value={author['death-date'] || ''}
                      onChange={(e) => handleAuthorChange(index, 'death-date', null, e.target.value)}
                      placeholder="dd-mm-yyyy"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                      Biografía ({activeLang})
                    </label>
                    <textarea
                      value={getLocalizedText(author.bio, activeLang)}
                      onChange={(e) => handleAuthorChange(index, 'bio', activeLang, e.target.value)}
                      rows="2"
                      className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  
                  <Input
                    label="Link (Wikipedia, etc.)"
                    value={author.link || ''}
                    onChange={(e) => handleAuthorChange(index, 'link', null, e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              ))}
              
              {form.author.length === 0 && (
                <p className="text-center text-gray-500 py-4">No hay autores agregados</p>
              )}
            </div>
          )}

          {/* TAB: EDITORES Y COLABORADORES */}
          {activeTab === 'editors' && (
            <div className="space-y-6">
              {/* Editores */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium">Editores</h4>
                  <button
                    type="button"
                    onClick={addEditor}
                    className="px-3 py-1 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
                  >
                    + Agregar Editor
                  </button>
                </div>
                
                {form.editor.map((editor, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3 mb-3">
                    <div className="flex justify-between items-center">
                      <h5 className="font-medium">Editor {index + 1}</h5>
                      <button
                        type="button"
                        onClick={() => removeEditor(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <Input
                      label="Nombre *"
                      value={editor.name || ''}
                      onChange={(e) => handleEditorChange(index, 'name', e.target.value)}
                      required
                    />
                    
                    <Input
                      label="Website"
                      value={editor.website || ''}
                      onChange={(e) => handleEditorChange(index, 'website', e.target.value)}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="ORCID"
                        value={editor.orcid || ''}
                        onChange={(e) => handleEditorChange(index, 'orcid', e.target.value)}
                      />
                      <Input
                        label="Email"
                        type="email"
                        value={editor.email || ''}
                        onChange={(e) => handleEditorChange(index, 'email', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Colaboradores */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium">Colaboradores</h4>
                  <button
                    type="button"
                    onClick={addColaborador}
                    className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                  >
                    + Agregar Colaborador
                  </button>
                </div>
                
                {form.colaboradores.map((colab, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3 mb-3">
                    <div className="flex justify-between items-center">
                      <h5 className="font-medium">Colaborador {index + 1}</h5>
                      <button
                        type="button"
                        onClick={() => removeColaborador(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <Input
                      label="Nombre *"
                      value={colab.name || ''}
                      onChange={(e) => handleColaboradorChange(index, 'name', null, e.target.value)}
                      required
                    />
                    
                    <Input
                      label={`Rol (${activeLang})`}
                      value={getLocalizedText(colab.role, activeLang)}
                      onChange={(e) => handleColaboradorChange(index, 'role', activeLang, e.target.value)}
                    />
                    
                    <Input
                      label="UID"
                      value={colab.uid || ''}
                      onChange={(e) => handleColaboradorChange(index, 'uid', null, e.target.value)}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="ORCID"
                        value={colab.orcid || ''}
                        onChange={(e) => handleColaboradorChange(index, 'orcid', null, e.target.value)}
                      />
                      <Input
                        label="Email"
                        type="email"
                        value={colab.email || ''}
                        onChange={(e) => handleColaboradorChange(index, 'email', null, e.target.value)}
                      />
                    </div>
                    
                    <Input
                      label="Link"
                      value={colab.link || ''}
                      onChange={(e) => handleColaboradorChange(index, 'link', null, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: CONTENIDO */}
          {activeTab === 'content' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Abstract ({activeLang})
                </label>
                <textarea
                  value={getLocalizedText(form.abstract, activeLang)}
                  onChange={(e) => handleTextChange('abstract', activeLang, e.target.value)}
                  rows="6"
                  className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  placeholder="Texto del abstract..."
                />
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  HTML Content ({activeLang})
                </label>
                <textarea
                  value={getLocalizedText(form.html, activeLang)}
                  onChange={(e) => handleTextChange('html', activeLang, e.target.value)}
                  rows="10"
                  className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  placeholder="<h2>Capítulo I...</h2>"
                />
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  References ({activeLang})
                </label>
                <textarea
                  value={getLocalizedText(form.references, activeLang)}
                  onChange={(e) => handleTextChange('references', activeLang, e.target.value)}
                  rows="6"
                  className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                />
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Appendix ({activeLang})
                </label>
                <textarea
                  value={getLocalizedText(form.appendix, activeLang)}
                  onChange={(e) => handleTextChange('appendix', activeLang, e.target.value)}
                  rows="6"
                  className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Nota Editorial ({activeLang})
                </label>
                <textarea
                  value={getLocalizedText(form['editorial-note'], activeLang)}
                  onChange={(e) => handleTextChange('editorial-note', activeLang, e.target.value)}
                  rows="4"
                  className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                />
              </div>
            </div>
          )}

          {/* TAB: METADATOS */}
          {activeTab === 'metadata' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Keywords ({activeLang}) (separar con comas)
                </label>
                <input
                  type="text"
                  value={(getLocalizedArray(form.keywords, activeLang) || []).join(', ')}
                  onChange={(e) => handleKeywordsChange(activeLang, e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Euler, matemáticas, física"
                />
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Áreas (separar con comas)
                </label>
                <input
                  type="text"
                  value={(form.area || []).join(', ')}
                  onChange={(e) => handleArrayChange('area', e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="matemáticas, física"
                />
              </div>
              
              <Input
                label="PDF URL"
                value={form['pdf-url'] || ''}
                onChange={(e) => setForm({...form, 'pdf-url': e.target.value})}
                placeholder="https://..."
              />
              
              <Input
                label="Image URL"
                value={form.image || ''}
                onChange={(e) => setForm({...form, image: e.target.value})}
              />
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 font-semibold text-gray-500 hover:bg-gray-100 rounded-xl"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isProcessing}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            {isProcessing ? (
              <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Guardando...</>
            ) : (
              <><CheckIcon className="w-4 h-4" /> Guardar</>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ============================================
// COMPONENTE: Input
// ============================================
const Input = ({ label, multiline, rows = 2, ...props }) => (
  <div>
    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
      {label}
    </label>
    {multiline ? (
      <textarea
        rows={rows}
        className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
        {...props}
      />
    ) : (
      <input
        className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
        {...props}
      />
    )}
  </div>
);

// ============================================
// COMPONENTE: Modal
// ============================================
const Modal = ({ show, onClose, title, children, size = 'lg' }) => {
  const sizeClasses = {
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
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
            className={`bg-white w-full ${sizeClasses[size]} rounded-2xl shadow-2xl relative z-10 max-h-[90vh] flex flex-col`}
          >
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 sticky top-0">
              <h3 className="text-xl font-bold font-serif">{title}</h3>
              <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};