// CollectionManager.js
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '../firebase';
import { 
  collection, onSnapshot, query, where, getDocs,
  doc as firestoreDoc, getDoc 
} from "firebase/firestore";
import {
  PlusIcon, PencilIcon, TrashIcon, CheckIcon, ExclamationTriangleIcon,
  DocumentTextIcon, ArrowPathIcon, BookOpenIcon, DocumentIcon,
  XMarkIcon, ChevronRightIcon, MagnifyingGlassIcon, PhotoIcon,
  ChevronDownIcon, GlobeAltIcon, FolderIcon, CodeBracketIcon,
  LanguageIcon, EyeIcon, EyeSlashIcon, CloudArrowUpIcon
} from '@heroicons/react/24/outline';

// Configuración
const DOMAIN = 'https://www.revistacienciasestudiantes.com';
const COLLECTIONS_JSON_URL = `${DOMAIN}/collections/collections.json`;
const REPO_OWNER = 'revista1919';
const REPO_NAME = 'revista1919.github.io';
const MANAGE_COLLECTIONS_URL = 'https://us-central1-usuarios-rnce.cloudfunctions.net/manageCollections';
const MANAGE_ARTICLES_COLLECTION_URL = 'https://managecollectionarticles-ggqsq2kkua-uc.a.run.app';
const REBUILD_URL = 'https://triggerrebuild-ggqsq2kkua-uc.a.run.app/';

// Estados iniciales
// En initialCollectionState, cambia 'idiom' por:
const initialCollectionState = {
  id: '',
  title: {
    spanish: '',
    english: ''
  },
  description: {
    spanish: '',
    english: ''
  },
  'carpet-name': '',
  image: '',
  languages: ['spanish'], // Array de idiomas soportados
  defaultLanguage: 'spanish', // Idioma por defecto
  status: 'active'
};

// En initialArticleState, actualiza los campos de texto:
const initialArticleState = {
  id: '',
  'name': {
    spanish: '',
    english: ''
  },
  author: [],
  date: '',
  'original-date': '',
  editor: [],
  colaboradores: [],
  abstract: {
    spanish: '',
    english: ''
  },
  keywords: {
    spanish: [],
    english: []
  },
  html: {
    spanish: '',
    english: ''
  },
  references: '',
  appendix: '',
  'editorial-note': '',
  'pdf-url': '',
  idioma: 'Latín',
  area: [],
  image: '',
  status: 'draft',
  language: 'spanish' // Idioma del contenido principal
};
const initialAuthorState = {
  name: '',
  'birth-date': '',
  'death-date': '',
  bio: '',
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
  role: '',
  uid: '',
  link: '',
  orcid: '',
  email: ''
};

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

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

const generateArticleId = (collectionId, date) => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const day = String(new Date().getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${collectionId}-${year}${month}${day}-${random}`;
};

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

  // Idiomas disponibles
  const languages = [
    { value: 'spanish', label: 'Español' },
    { value: 'english', label: 'Inglés' },
    { value: 'both', label: 'Bilingüe' }
  ];

  // Cargar colecciones
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
          fetchCollectionArticles(collection['carpet-name']);
        });
      } catch (error) {
        console.error("Error fetching collections.json:", error);
        setStatus({ type: 'error', msg: 'Error al cargar las colecciones.' });
      } finally {
        setLoading(false);
      }
    };

    fetchCollections();
  }, []);

  // Cargar artículos de una colección específica
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

  // Trigger rebuild
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
      throw error;
    }
  };

  // Guardar colección
  const handleSaveCollection = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setStatus(null);

    try {
      const token = await auth.currentUser.getIdToken();
      
      const collectionData = {
        ...collectionForm,
        'carpet-name': collectionForm['carpet-name'] || generateSlug(collectionForm.title)
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
      
      // Recargar colecciones
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
      setStatus({ type: 'success', msg: '✅ Colección guardada exitosamente' });
    } catch (err) {
      console.error("Error saving collection:", err);
      setStatus({ type: 'error', msg: `❌ Error: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  // Guardar artículo de colección
  const handleSaveArticle = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setStatus(null);

    try {
      const token = await auth.currentUser.getIdToken();
      
      // Generar ID automático si es nuevo
      let articleData = { ...articleForm };
      if (!editingArticle && !articleData.id) {
        articleData.id = generateArticleId(selectedCollection.id, articleData.date);
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

  // Eliminar colección
  const handleDeleteCollection = async (collection) => {
    if (!confirm(`¿Estás seguro de eliminar la colección "${typeof collection.title === 'string' ? collection.title : collection.title?.spanish}"?`)) return;
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
      
      // Recargar
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      setStatus({ type: 'error', msg: `❌ Error: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  // Eliminar artículo
  const handleDeleteArticle = async (article) => {
    if (!confirm(`¿Estás seguro de eliminar el artículo "${article['name-original']}"?`)) return;
    
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
      
      // Recargar artículos
      fetchCollectionArticles(selectedCollection['carpet-name']);
      
      setStatus({ type: 'success', msg: '✅ Artículo eliminado' });
    } catch (err) {
      setStatus({ type: 'error', msg: `❌ Error: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

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

 // Filtrar colecciones - Versión corregida para estructura multilingüe
const filteredCollections = collections.filter(c => {
  // Buscar en título español
  const titleSpanish = c.title?.spanish?.toLowerCase() || '';
  // Buscar en título inglés (si existe)
  const titleEnglish = c.title?.english?.toLowerCase() || '';
  // Buscar en descripción español
  const descSpanish = c.description?.spanish?.toLowerCase() || '';
  // Buscar en descripción inglés (si existe)
  const descEnglish = c.description?.english?.toLowerCase() || '';
  
  const searchLower = searchTerm.toLowerCase();
  
  return titleSpanish.includes(searchLower) ||
         titleEnglish.includes(searchLower) ||
         descSpanish.includes(searchLower) ||
         descEnglish.includes(searchLower);
});

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

      {/* Modal de Colección */}
      <CollectionModal
        show={showCollectionModal}
        onClose={() => setShowCollectionModal(false)}
        form={collectionForm}
        setForm={setCollectionForm}
        onSave={handleSaveCollection}
        isProcessing={isProcessing}
        isEditing={!!editingCollection}
        languages={languages}
      />

      {/* Modal de Artículo */}
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

// Componente de Item de Colección actualizado
const CollectionItem = ({ 
  collection, articles, expanded, onToggle, onEdit, onDelete, 
  onAddArticle, onEditArticle, onDeleteArticle, expandedArticles, onToggleArticle 
}) => {
  const languages = [
    { value: 'spanish', label: 'Español', flag: '🇪🇸' },
    { value: 'english', label: 'English', flag: '🇬🇧' }
  ];

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
                alt={typeof collection.title === 'string' ? collection.title : collection.title?.spanish || ''}
                className="w-10 h-10 rounded-lg object-cover"
              />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-[#001529]">
  {typeof collection.title === 'string' ? collection.title : collection.title?.spanish}
</h3>
                {collection.title?.english && (
                  <span className="text-sm text-gray-500">
                    / {collection.title.english}
                  </span>
                )}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({collection.id})
                </span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-1">
                {typeof collection.description === 'string' ? collection.description : collection.description?.spanish}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                  {collection['carpet-name']}
                </span>
                <LanguageBadge languages={collection.languages || ['spanish']} />
                <span className="text-xs text-gray-500">
                  {articles.length} artículos
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
          >
            <PencilIcon className="w-5 h-5" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
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

      {/* Artículos de la Colección - sin cambios */}
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

// Componente de Item de Artículo
const ArticleItem = ({ article, expanded, onToggle, onEdit, onDelete }) => {
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
                {article['name-original']}
              </h4>
              <p className="text-sm text-gray-500">
                {article['name-translated']}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  {article.id}
                </span>
                <span className="text-xs text-gray-500">
                  {article.author?.[0]?.name}
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
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                      <a href={author.link} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 text-xs">
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
                <p className="text-gray-600 text-sm line-clamp-3">{article.abstract}</p>
              </div>
              
              <div>
                <h5 className="font-semibold text-gray-700 mb-1">Fecha original</h5>
                <p className="text-gray-600">{article['original-date']}</p>
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
                  {article.keywords?.map((kw, idx) => (
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

// Badge de idiomas actualizado
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

  // Mostrar banderas para múltiples idiomas
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
// Modal de Colección actualizado
const CollectionModal = ({ 
  show, onClose, form, setForm, onSave, isProcessing, isEditing, languages 
}) => {
  const [activeLang, setActiveLang] = useState('spanish');

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
      // No permitir eliminar el último idioma
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

        {/* Selector de idioma para edición */}
        {(form.languages?.length > 1 || isEditing) && (
          <div className="flex gap-2 border-b border-gray-200 pb-2">
            {form.languages?.map(lang => {
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
        )}

        {/* Campos bilingües */}
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

// Modal de Artículo
const ArticleModal = ({ 
  show, onClose, form, setForm, onSave, isProcessing, isEditing, collection 
}) => {
  const [activeTab, setActiveTab] = useState('basic');
  
  const tabs = [
    { id: 'basic', label: 'Básico', icon: '📋' },
    { id: 'authors', label: 'Autores', icon: '👥' },
    { id: 'editors', label: 'Editores', icon: '✏️' },
    { id: 'content', label: 'Contenido', icon: '📄' },
    { id: 'metadata', label: 'Metadatos', icon: '🏷️' }
  ];

  const handleAuthorChange = (index, field, value) => {
    const newAuthors = [...form.author];
    newAuthors[index] = { ...newAuthors[index], [field]: value };
    setForm({...form, author: newAuthors});
  };

  const addAuthor = () => {
    setForm({...form, author: [...form.author, {...initialAuthorState}]});
  };

  const removeAuthor = (index) => {
    setForm({...form, author: form.author.filter((_, i) => i !== index)});
  };

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

  const handleColaboradorChange = (index, field, value) => {
    const newColabs = [...form.colaboradores];
    newColabs[index] = { ...newColabs[index], [field]: value };
    setForm({...form, colaboradores: newColabs});
  };

  const addColaborador = () => {
    setForm({...form, colaboradores: [...form.colaboradores, {...initialColaboradorState}]});
  };

  const removeColaborador = (index) => {
    setForm({...form, colaboradores: form.colaboradores.filter((_, i) => i !== index)});
  };

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
  <span className="font-medium">Colección:</span> {typeof collection.title === 'string' ? collection.title : collection.title?.spanish} ({collection.id})
</p>
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
                label="Nombre Original *"
                value={form['name-original']}
                onChange={(e) => setForm({...form, 'name-original': e.target.value})}
                required
              />
              
              <Input
                label="Nombre Traducido"
                value={form['name-translated']}
                onChange={(e) => setForm({...form, 'name-translated': e.target.value})}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Fecha"
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
                label="Idioma del texto"
                value={form.idioma}
                onChange={(e) => setForm({...form, idioma: e.target.value})}
                placeholder="Ej: Latín"
              />
            </div>
          )}

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
                    value={author.name}
                    onChange={(e) => handleAuthorChange(index, 'name', e.target.value)}
                    required
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Fecha Nacimiento"
                      value={author['birth-date']}
                      onChange={(e) => handleAuthorChange(index, 'birth-date', e.target.value)}
                      placeholder="dd-mm-yyyy"
                    />
                    <Input
                      label="Fecha Muerte"
                      value={author['death-date']}
                      onChange={(e) => handleAuthorChange(index, 'death-date', e.target.value)}
                      placeholder="dd-mm-yyyy"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                      Biografía
                    </label>
                    <textarea
                      value={author.bio}
                      onChange={(e) => handleAuthorChange(index, 'bio', e.target.value)}
                      rows="2"
                      className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  
                  <Input
                    label="Link"
                    value={author.link}
                    onChange={(e) => handleAuthorChange(index, 'link', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              ))}
              
              {form.author.length === 0 && (
                <p className="text-center text-gray-500 py-4">No hay autores agregados</p>
              )}

              {/* Editores */}
              <div className="mt-6">
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
                      value={editor.name}
                      onChange={(e) => handleEditorChange(index, 'name', e.target.value)}
                      required
                    />
                    
                    <Input
                      label="Website"
                      value={editor.website}
                      onChange={(e) => handleEditorChange(index, 'website', e.target.value)}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="ORCID"
                        value={editor.orcid}
                        onChange={(e) => handleEditorChange(index, 'orcid', e.target.value)}
                      />
                      <Input
                        label="Email"
                        type="email"
                        value={editor.email}
                        onChange={(e) => handleEditorChange(index, 'email', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Colaboradores */}
              <div className="mt-6">
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
                      value={colab.name}
                      onChange={(e) => handleColaboradorChange(index, 'name', e.target.value)}
                      required
                    />
                    
                    <Input
                      label="Rol"
                      value={colab.role}
                      onChange={(e) => handleColaboradorChange(index, 'role', e.target.value)}
                    />
                    
                    <Input
                      label="UID"
                      value={colab.uid}
                      onChange={(e) => handleColaboradorChange(index, 'uid', e.target.value)}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="ORCID"
                        value={colab.orcid}
                        onChange={(e) => handleColaboradorChange(index, 'orcid', e.target.value)}
                      />
                      <Input
                        label="Email"
                        type="email"
                        value={colab.email}
                        onChange={(e) => handleColaboradorChange(index, 'email', e.target.value)}
                      />
                    </div>
                    
                    <Input
                      label="Link"
                      value={colab.link}
                      onChange={(e) => handleColaboradorChange(index, 'link', e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'content' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Abstract
                </label>
                <textarea
                  value={form.abstract}
                  onChange={(e) => setForm({...form, abstract: e.target.value})}
                  rows="6"
                  className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  placeholder="Texto del abstract..."
                />
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  HTML Content
                </label>
                <textarea
                  value={form.html}
                  onChange={(e) => setForm({...form, html: e.target.value})}
                  rows="10"
                  className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  placeholder="<h2>Capítulo I...</h2>"
                />
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  References
                </label>
                <textarea
                  value={form.references}
                  onChange={(e) => setForm({...form, references: e.target.value})}
                  rows="6"
                  className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                />
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Appendix
                </label>
                <textarea
                  value={form.appendix}
                  onChange={(e) => setForm({...form, appendix: e.target.value})}
                  rows="6"
                  className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                />
              </div>
            </div>
          )}

          {activeTab === 'metadata' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Keywords (separar con comas)
                </label>
                <input
                  type="text"
                  value={form.keywords?.join(', ')}
                  onChange={(e) => setForm({...form, keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean)})}
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
                  value={form.area?.join(', ')}
                  onChange={(e) => setForm({...form, area: e.target.value.split(',').map(k => k.trim()).filter(Boolean)})}
                  className="w-full px-4 py-2.5 bg-[#f8f9fa] border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="matemáticas, física"
                />
              </div>
              
              <Input
                label="Editorial Note"
                value={form['editorial-note']}
                onChange={(e) => setForm({...form, 'editorial-note': e.target.value})}
                multiline
                rows="3"
              />
              
              <Input
                label="PDF URL"
                value={form['pdf-url']}
                onChange={(e) => setForm({...form, 'pdf-url': e.target.value})}
                placeholder="https://..."
              />
              
              <Input
                label="Image URL"
                value={form.image}
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

// Componentes atómicos
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

export { CollectionManager };