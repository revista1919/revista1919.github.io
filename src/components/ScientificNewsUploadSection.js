// src/components/ScientificNewsUploadSection.jsx
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import ImageResize from 'quill-image-resize-module-react';
import { auth } from '../firebase';
import { debounce } from 'lodash';
import { useLanguage } from '../hooks/useLanguage';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DocumentIcon, 
  PhotoIcon, 
  TagIcon, 
  UserIcon,
  LanguageIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';

// ===================================================
// REGISTRO DE MÓDULOS ADICIONALES
// ===================================================
Quill.register('modules/imageResize', ImageResize);

// Para matemáticas
import katex from 'katex';
import 'katex/dist/katex.min.css';
window.katex = katex;

// Video personalizado
const BaseVideo = Quill.import('formats/video');
class CustomVideo extends BaseVideo {
  static create(value) {
    let node = super.create(value);
    node.setAttribute('controls', true);
    node.setAttribute('width', '100%');
    node.setAttribute('height', 'auto');
    return node;
  }
}
Quill.register('formats/video', CustomVideo, true);

// ===================================================
// CONFIGURACIÓN
// ===================================================
const NEWS_SCRIPT_URL = 'https://us-central1-usuarios-rnce.cloudfunctions.net/uploadScientificNews';

// Áreas disponibles (deben coincidir con el backend)
const AREAS = [
  { id: 'biologia', labelEs: 'Biología', labelEn: 'Biology' },
  { id: 'quimica', labelEs: 'Química', labelEn: 'Chemistry' },
  { id: 'fisica', labelEs: 'Física', labelEn: 'Physics' },
  { id: 'matematica', labelEs: 'Matemática', labelEn: 'Mathematics' },
  { id: 'computacion', labelEs: 'Computación', labelEn: 'Computer Science' },
  { id: 'astronomia', labelEs: 'Astronomía', labelEn: 'Astronomy' },
  { id: 'geologia', labelEs: 'Geología', labelEn: 'Geology' },
  { id: 'medicina', labelEs: 'Medicina', labelEn: 'Medicine' },
  { id: 'ingenieria', labelEs: 'Ingeniería', labelEn: 'Engineering' },
  { id: 'ciencias_sociales', labelEs: 'Ciencias Sociales', labelEn: 'Social Sciences' },
  { id: 'medio_ambiente', labelEs: 'Medio Ambiente', labelEn: 'Environment' },
  { id: 'neurociencia', labelEs: 'Neurociencia', labelEn: 'Neuroscience' },
  { id: 'logros_estudiantiles', labelEs: 'Logros Estudiantiles', labelEn: 'Student Achievements' }
];

// Categorías de noticias
const CATEGORIES = [
  { id: 'investigacion', labelEs: 'Investigación', labelEn: 'Research' },
  { id: 'descubrimiento', labelEs: 'Descubrimiento', labelEn: 'Discovery' },
  { id: 'evento', labelEs: 'Evento', labelEn: 'Event' },
  { id: 'premio', labelEs: 'Premio', labelEn: 'Award' },
  { id: 'entrevista', labelEs: 'Entrevista', labelEn: 'Interview' },
  { id: 'opinion', labelEs: 'Opinión', labelEn: 'Opinion' },
  { id: 'general', labelEs: 'General', labelEn: 'General' }
];

// ===================================================
// UTILIDADES
// ===================================================
const base64EncodeUnicode = (str) => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
};

const sanitizeInput = (input) => {
  if (!input) return '';
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
               .replace(/on\w+="[^"]*"/gi, '')
               .replace(/\s+/g, ' ')
               .trim();
};

// ===================================================
// COMPONENTE PRINCIPAL
// ===================================================
export default function ScientificNewsUploadSection({ userData }) {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  
  // Estados para los campos
  const [titleEs, setTitleEs] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [bodyEs, setBodyEs] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [author, setAuthor] = useState(userData?.displayName || '');
  const [areaId, setAreaId] = useState('');
  const [category, setCategory] = useState('general');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [photo, setPhoto] = useState('');
  const [featured, setFeatured] = useState(false);
  
  // Estados de UI
  const [activeLanguage, setActiveLanguage] = useState('es');
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(true);
  
  // Refs
  const quillEsRef = useRef(null);
  const quillEnRef = useRef(null);
  const editorEsRef = useRef(null);
  const editorEnRef = useRef(null);
  
  // Estados para modales de imagen
  const [showImageModal, setShowImageModal] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [imageData, setImageData] = useState({ url: '', width: '', height: '', align: 'left' });
  const [editingRange, setEditingRange] = useState(null);
  const [activeEditor, setActiveEditor] = useState('es');
  
  // ===================================================
  // PERSISTENCIA Y CLEANUP
  // ===================================================
  useEffect(() => {
    const savedDraft = localStorage.getItem('scientificNewsDraft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        setTitleEs(draft.titleEs || '');
        setTitleEn(draft.titleEn || '');
        setBodyEs(draft.bodyEs || '');
        setBodyEn(draft.bodyEn || '');
        setAuthor(draft.author || userData?.displayName || '');
        setAreaId(draft.areaId || '');
        setCategory(draft.category || 'general');
        setTags(draft.tags || []);
        setPhoto(draft.photo || '');
        setFeatured(draft.featured || false);
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    }
  }, [userData]);

  const debouncedSaveDraft = useMemo(() => 
    debounce((draft) => {
      localStorage.setItem('scientificNewsDraft', JSON.stringify(draft));
    }, 1000), []);

  useEffect(() => {
    debouncedSaveDraft({
      titleEs, titleEn, bodyEs, bodyEn, author, areaId, category, tags, photo, featured
    });
  }, [titleEs, titleEn, bodyEs, bodyEn, author, areaId, category, tags, photo, featured, debouncedSaveDraft]);

  useEffect(() => {
    return () => debouncedSaveDraft.cancel();
  }, [debouncedSaveDraft]);

  const clearDraft = () => localStorage.removeItem('scientificNewsDraft');

  // ===================================================
  // CONFIGURACIÓN DE TOOLBAR (para ambos editores)
  // ===================================================
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'list': 'check' }],
        [{ 'indent': '-1' }, { 'indent': '+1' }],
        [{ 'align': ['', 'center', 'right', 'justify'] }],
        ['table'],
        ['blockquote', 'code-block'],
        ['link', 'image', 'video', 'formula'],
        ['clean']
      ],
      handlers: {
        image: function() {
          setActiveEditor(activeLanguage);
          setIsEditingImage(false);
          setImageData({ url: '', width: '', height: '', align: 'left' });
          setEditingRange(null);
          setShowImageModal(true);
        },
        formula: function() {
          const mathText = prompt('Ingresa fórmula LaTeX (ej: E = mc^2):');
          if (mathText) {
            const range = this.quill.getSelection();
            this.quill.insertEmbed(range.index, 'formula', mathText);
          }
        },
        table: function() {
          const range = this.quill.getSelection();
          if (range) {
            const tableHTML = `
              <table style="width:100%; border-collapse: collapse; margin: 1rem 0;">
                <tbody>
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;"><br></td>
                    <td style="border: 1px solid #ddd; padding: 8px;"><br></td>
                    <td style="border: 1px solid #ddd; padding: 8px;"><br></td>
                  </tr>
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;"><br></td>
                    <td style="border: 1px solid #ddd; padding: 8px;"><br></td>
                    <td style="border: 1px solid #ddd; padding: 8px;"><br></td>
                  </tr>
                </tbody>
              </table>
            `;
            this.quill.clipboard.dangerouslyPasteHTML(range.index, tableHTML);
          }
        }
      }
    },
    imageResize: {
      parchment: Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize', 'Toolbar'],
    },
    keyboard: {
      bindings: {
        deleteImage: {
          key: ['Delete', 'Backspace'],
          handler: function(range) {
            if (!range) return true;
            const editor = this.quill;
            const imageResize = editor.getModule('imageResize');
            let isImage = false;
            let deleteIndex = range.index;
            let deleteLength = range.length || 1;

            if (range.length === 0) {
              if (this.key === 'Backspace') {
                const [prevLeaf] = editor.getLeaf(range.index - 1);
                if (prevLeaf?.domNode?.tagName === 'IMG') { 
                  isImage = true; 
                  deleteIndex = range.index - 1; 
                }
              } else if (this.key === 'Delete') {
                const [nextLeaf] = editor.getLeaf(range.index);
                if (nextLeaf?.domNode?.tagName === 'IMG') isImage = true;
              }
            } else {
              const [leaf] = editor.getLeaf(range.index);
              if (leaf?.domNode?.tagName === 'IMG') isImage = true;
            }

            if (isImage) {
              if (imageResize) imageResize.hide();
              editor.deleteText(deleteIndex, deleteLength, Quill.sources.USER);
              return false;
            }
            return true;
          },
        },
      },
    },
  }), [activeLanguage]);

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'script',
    'list', 'bullet', 'indent',
    'align',
    'table',
    'blockquote', 'code-block',
    'link', 'image', 'video', 'formula'
  ];

  // ===================================================
  // PROCESAMIENTO EDITORIAL
  // ===================================================
  const encodeBody = (html, editorRef) => {
    try {
      if (!html || html.trim() === '') return '';
      let cleanedHtml = sanitizeInput(html);
    
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cleanedHtml;

      // Procesamiento de Imágenes
      const images = tempDiv.querySelectorAll('img');
      images.forEach((img) => {
        let align = 'left';
        const blot = Quill.find(img);
        if (blot && editorRef.current) {
          const imgIndex = editorRef.current.getIndex(blot);
          align = editorRef.current.getFormat(imgIndex, 1).align || 'left';
        }
      
        let style = 'max-width:100%; height:auto; border-radius:10px; margin:2rem 0; display:block;';
        if (align === 'center') style += 'margin-left:auto; margin-right:auto;';
        else if (align === 'right') style += 'float:right; margin-left:1.5rem; margin-bottom:1rem;';
        else if (align === 'justify') style += 'width:100%;';
        else style += 'float:left; margin-right:1.5rem; margin-bottom:1rem;';
      
        if (img.style.width) style += `width:${img.style.width};`;
        if (img.style.height) style += `height:${img.style.height};`;
      
        img.setAttribute('style', style);
        img.setAttribute('loading', 'lazy');
        img.setAttribute('alt', 'Imagen de la noticia');
      });

      // Procesamiento de tablas
      const tables = tempDiv.querySelectorAll('table');
      tables.forEach((table) => {
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.margin = '2rem 0';
        
        const cells = table.querySelectorAll('td, th');
        cells.forEach(cell => {
          cell.style.border = '1px solid #ddd';
          cell.style.padding = '12px';
        });
        
        const headers = table.querySelectorAll('th');
        headers.forEach(header => {
          header.style.backgroundColor = '#f5f5f5';
          header.style.fontWeight = 'bold';
        });
      });

      // Procesamiento de videos
      const videos = tempDiv.querySelectorAll('video');
      videos.forEach(video => {
        video.setAttribute('controls', true);
        video.style.maxWidth = '100%';
        video.style.borderRadius = '8px';
        video.style.margin = '2rem 0';
      });

      // Procesamiento de fórmulas matemáticas
      const formulas = tempDiv.querySelectorAll('.ql-formula');
      formulas.forEach(formula => {
        formula.style.display = 'inline-block';
        formula.style.margin = '0 4px';
      });

      const finalHtml = `
        <div class="article">
          ${tempDiv.innerHTML}
        </div>
      `;

      return base64EncodeUnicode(finalHtml);
    } catch (err) {
      console.error('Error encoding body:', err);
      return base64EncodeUnicode(html);
    }
  };

  // ===================================================
  // MANEJO DE TAGS
  // ===================================================
  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const removeTag = (index) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  // ===================================================
  // MANEJO DE IMAGEN DE PORTADA
  // ===================================================
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setStatus({ 
        type: 'error', 
        msg: isSpanish ? 'La imagen no puede superar 5MB' : 'Image cannot exceed 5MB' 
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // ===================================================
  // MANEJO DE IMÁGENES EN EL EDITOR
  // ===================================================
  const handleImageModalSubmit = () => {
    const editor = activeEditor === 'es' ? editorEsRef.current : editorEnRef.current;
    let { url, width, height, align } = imageData;
    if (!url) return;

    if (width && !width.match(/%|px$/)) width += 'px';
    if (height && !height.match(/%|px$/)) height += 'px';

    if (isEditingImage && editingRange) {
      editor.setSelection(editingRange.index, 1);
      const [leaf] = editor.getLeaf(editingRange.index);
      if (leaf?.domNode.tagName === 'IMG') {
        if (width) leaf.domNode.style.width = width;
        if (height) leaf.domNode.style.height = height;
        editor.format('align', align);
      }
    } else {
      const range = editor.getSelection() || { index: editor.getLength() };
      editor.insertText(range.index, '\n');
      editor.insertEmbed(range.index + 1, 'image', url);
      const [leaf] = editor.getLeaf(range.index + 1);
      if (leaf?.domNode) {
        if (width) leaf.domNode.style.width = width;
        if (height) leaf.domNode.style.height = height;
      }
      editor.setSelection(range.index + 1, 1);
      editor.format('align', align);
      editor.setSelection(range.index + 2);
    }
    setShowImageModal(false);
  };

  // ===================================================
  // SUBMIT
  // ===================================================
  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user) {
      setStatus({ type: 'error', msg: isSpanish ? 'No autenticado' : 'Not authenticated' });
      return;
    }

    // Validaciones
    if (!titleEs.trim() && !titleEn.trim()) {
      setStatus({ type: 'error', msg: isSpanish ? 'Se requiere al menos un título' : 'At least one title is required' });
      return;
    }
    if (!bodyEs.trim() && !bodyEn.trim()) {
      setStatus({ type: 'error', msg: isSpanish ? 'Se requiere al menos un cuerpo' : 'At least one body is required' });
      return;
    }
    if (!author.trim()) {
      setStatus({ type: 'error', msg: isSpanish ? 'El autor es requerido' : 'Author is required' });
      return;
    }
    if (!areaId) {
      setStatus({ type: 'error', msg: isSpanish ? 'Selecciona el área de la noticia' : 'Select the news area' });
      return;
    }

    setIsLoading(true);
    setStatus({ type: 'info', msg: isSpanish ? 'Publicando noticia científica...' : 'Publishing scientific news...' });

    try {
      const token = await user.getIdToken();
      
      // Preparar datos
      const data = {
        title_es: titleEs ? sanitizeInput(titleEs) : null,
        title_en: titleEn ? sanitizeInput(titleEn) : null,
        body_es: bodyEs ? encodeBody(bodyEs, editorEsRef) : null,
        body_en: bodyEn ? encodeBody(bodyEn, editorEnRef) : null,
        author: sanitizeInput(author),
        area_id: areaId,
        category: category,
        tags: tags.map(tag => sanitizeInput(tag)),
        photo: photo || null,
        featured: featured
      };

      const res = await fetch(NEWS_SCRIPT_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Error en la respuesta');
      }

      const result = await res.json();

      setStatus({ 
        type: 'success', 
        msg: isSpanish 
          ? `¡Noticia publicada con éxito! Año: ${result.year}` 
          : `News published successfully! Year: ${result.year}` 
      });
      
      // Limpiar formulario
      setTitleEs('');
      setTitleEn('');
      setBodyEs('');
      setBodyEn('');
      setPhoto('');
      setTags([]);
      setAreaId('');
      setCategory('general');
      setFeatured(false);
      
      if (editorEsRef.current) editorEsRef.current.setText('');
      if (editorEnRef.current) editorEnRef.current.setText('');
      
      clearDraft();
      
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
      console.error('Error publishing news:', error);
      setStatus({ 
        type: 'error', 
        msg: error.message || (isSpanish ? 'Error al publicar' : 'Error publishing') 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ===================================================
  // RENDER
  // ===================================================
  return (
    <div className="max-w-7xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 mt-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a3a5c] to-[#004b87] p-10 text-white">
        <h2 className="text-3xl font-black tracking-tight mb-2 uppercase">
          {isSpanish ? 'Panel de Noticias Científicas' : 'Scientific News Panel'}
        </h2>
        <p className="text-sm opacity-80 font-medium">
          {isSpanish 
            ? 'Sistema profesional de publicación bilingüe con metadatos completos' 
            : 'Professional bilingual publishing system with complete metadata'}
        </p>
      </div>

      {/* Warning de preparación */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-amber-50 border-b border-amber-200"
          >
            <div className="p-6 flex items-start gap-4">
              <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-amber-800 mb-2">
                  {isSpanish ? '⚠️ Recomendación importante' : '⚠️ Important recommendation'}
                </h3>
                <p className="text-sm text-amber-700 leading-relaxed">
                  {isSpanish 
                    ? 'Prepare su noticia con anticipación en un documento Word o Google Docs. Esto evitará pérdida de información en caso de errores de conexión o cierre accidental del navegador.'
                    : 'Prepare your news in advance in a Word document or Google Docs. This will prevent information loss in case of connection errors or accidental browser closure.'}
                </p>
                <button
                  onClick={() => setShowWarning(false)}
                  className="mt-3 text-xs font-bold text-amber-600 hover:text-amber-800 underline"
                >
                  {isSpanish ? 'Entendido' : 'Understood'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-10 space-y-10">
        {/* Estado del mensaje */}
        {status.msg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-lg flex items-center gap-3 ${
              status.type === 'error' 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : status.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}
          >
            {status.type === 'error' && <XCircleIcon className="w-5 h-5" />}
            {status.type === 'success' && <CheckCircleIcon className="w-5 h-5" />}
            {status.type === 'info' && <InformationCircleIcon className="w-5 h-5" />}
            <span className="text-sm font-medium">{status.msg}</span>
          </motion.div>
        )}

        {/* Selector de idioma activo */}
        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg">
          <LanguageIcon className="w-5 h-5 text-gray-500" />
          <button
            onClick={() => setActiveLanguage('es')}
            className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${
              activeLanguage === 'es' 
                ? 'bg-[#004b87] text-white shadow-md' 
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            ESPAÑOL
          </button>
          <button
            onClick={() => setActiveLanguage('en')}
            className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${
              activeLanguage === 'en' 
                ? 'bg-[#004b87] text-white shadow-md' 
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            ENGLISH
          </button>
          
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600">
              {isSpanish ? 'Auto-traducir campos faltantes' : 'Auto-translate missing fields'}
            </label>
            <button
              onClick={() => setAutoTranslate(!autoTranslate)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                autoTranslate ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  autoTranslate ? 'translate-x-6' : 'translate-x-1'
                }`}
                style={{ top: '2px' }}
              />
            </button>
          </div>
        </div>

        {/* Información del autor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-[#004b87] uppercase tracking-widest ml-1 flex items-center gap-2">
              <UserIcon className="w-4 h-4" />
              {isSpanish ? 'Autor de la noticia' : 'News author'}
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#004b87] bg-gray-50/50 outline-none transition-all"
              placeholder={isSpanish ? 'Nombre del periodista o autor' : 'Journalist or author name'}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-[#004b87] uppercase tracking-widest ml-1">
              {isSpanish ? 'Área de la noticia' : 'News area'}
            </label>
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#004b87] bg-gray-50/50 outline-none transition-all"
            >
              <option value="">{isSpanish ? 'Seleccionar área...' : 'Select area...'}</option>
              {AREAS.map(area => (
                <option key={area.id} value={area.id}>
                  {isSpanish ? area.labelEs : area.labelEn}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Títulos */}
        <div className="space-y-4">
          <h3 className="font-bold text-lg text-[#004b87] border-b border-gray-200 pb-2">
            {isSpanish ? 'Títulos' : 'Titles'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider ml-1">
                {isSpanish ? 'Título en Español' : 'Spanish Title'}
              </label>
              <input
                type="text"
                value={titleEs}
                onChange={(e) => setTitleEs(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#004b87] bg-gray-50/50 outline-none transition-all"
                placeholder={isSpanish ? 'Título en español...' : 'Spanish title...'}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider ml-1">
                {isSpanish ? 'Título en Inglés' : 'English Title'}
              </label>
              <input
                type="text"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#004b87] bg-gray-50/50 outline-none transition-all"
                placeholder={isSpanish ? 'Título en inglés...' : 'English title...'}
              />
            </div>
          </div>
        </div>

        {/* Editor Quill activo */}
        <div className="space-y-4">
          <h3 className="font-bold text-lg text-[#004b87] border-b border-gray-200 pb-2">
            {activeLanguage === 'es' 
              ? (isSpanish ? 'Cuerpo en Español' : 'Spanish Body')
              : (isSpanish ? 'Cuerpo en Inglés' : 'English Body')}
          </h3>
          
          <div className="rounded-2xl border-2 border-gray-200 focus-within:border-[#004b87] overflow-hidden transition-all bg-gray-50/30">
            {activeLanguage === 'es' ? (
              <ReactQuill
                ref={quillEsRef}
                value={bodyEs}
                onChange={setBodyEs}
                modules={modules}
                formats={formats}
                className="editorial-quill"
                placeholder={isSpanish ? 'Escribe el contenido en español...' : 'Write content in Spanish...'}
              />
            ) : (
              <ReactQuill
                ref={quillEnRef}
                value={bodyEn}
                onChange={setBodyEn}
                modules={modules}
                formats={formats}
                className="editorial-quill"
                placeholder={isSpanish ? 'Escribe el contenido en inglés...' : 'Write content in English...'}
              />
            )}
          </div>
        </div>

        {/* Foto de portada */}
        <div className="space-y-4">
          <h3 className="font-bold text-lg text-[#004b87] border-b border-gray-200 pb-2 flex items-center gap-2">
            <PhotoIcon className="w-5 h-5" />
            {isSpanish ? 'Foto de Portada' : 'Cover Photo'}
          </h3>
          <div className="space-y-4">
            {photo && (
              <div className="relative inline-block">
                <img 
                  src={photo} 
                  alt="Cover preview" 
                  className="max-h-48 rounded-lg border border-gray-200"
                />
                <button
                  onClick={() => setPhoto('')}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                >
                  <XCircleIcon className="w-5 h-5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-4">
              <label className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors flex items-center gap-2">
                <PhotoIcon className="w-5 h-5" />
                <span className="text-sm font-medium">
                  {isSpanish ? 'Subir imagen' : 'Upload image'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
              <span className="text-xs text-gray-500">
                {isSpanish ? 'O pega una URL:' : 'Or paste a URL:'}
              </span>
              <input
                type="text"
                value={photo.startsWith('data:') ? '' : photo}
                onChange={(e) => setPhoto(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:border-[#004b87] outline-none"
                placeholder="https://..."
              />
            </div>
          </div>
        </div>

        {/* Opciones avanzadas */}
        <div className="space-y-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm font-bold text-[#004b87] hover:text-[#003666] transition-colors"
          >
            {showAdvanced ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
            {isSpanish ? 'Opciones avanzadas' : 'Advanced options'}
          </button>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-6 overflow-hidden"
              >
                {/* Categoría */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider ml-1">
                    {isSpanish ? 'Categoría' : 'Category'}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#004b87] bg-gray-50/50 outline-none transition-all"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {isSpanish ? cat.labelEs : cat.labelEn}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider ml-1 flex items-center gap-2">
                    <TagIcon className="w-4 h-4" />
                    {isSpanish ? 'Etiquetas' : 'Tags'}
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-2 bg-[#004b87]/10 text-[#004b87] text-xs font-bold px-3 py-1.5 rounded-lg"
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(index)}
                          className="text-[#004b87] hover:text-red-500 transition-colors"
                        >
                          <XCircleIcon className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:border-[#004b87] outline-none"
                      placeholder={isSpanish ? 'Añadir etiqueta...' : 'Add tag...'}
                    />
                    <button
                      onClick={addTag}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-bold transition-colors"
                    >
                      {isSpanish ? 'AÑADIR' : 'ADD'}
                    </button>
                  </div>
                </div>

                {/* Destacada */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(e) => setFeatured(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    {isSpanish ? 'Marcar como noticia destacada' : 'Mark as featured news'}
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Botón de publicar */}
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className={`w-full py-6 text-white font-black rounded-2xl transition-all shadow-xl text-lg tracking-widest ${
            isLoading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-[#004b87] to-[#1a3a5c] hover:from-[#003666] hover:to-[#0f2440] active:scale-[0.99]'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-3">
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
              {isSpanish ? 'PUBLICANDO...' : 'PUBLISHING...'}
            </span>
          ) : (
            isSpanish ? 'PUBLICAR NOTICIA CIENTÍFICA' : 'PUBLISH SCIENTIFIC NEWS'
          )}
        </button>
      </div>

      {/* Modal de Imagen */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[999] p-6">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-8 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-black text-[#004b87]">
                {isSpanish ? 'GESTIÓN DE IMAGEN' : 'IMAGE MANAGEMENT'}
              </h3>
            </div>
            <div className="p-8 space-y-6">
              <input 
                type="text" 
                value={imageData.url} 
                onChange={(e)=>setImageData({...imageData, url: e.target.value})} 
                className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-xl focus:border-[#004b87] outline-none" 
                placeholder={isSpanish ? 'URL de la imagen' : 'Image URL'} 
                disabled={isEditingImage} 
              />
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="text" 
                  placeholder={isSpanish ? 'Ancho (ej: 300px)' : 'Width (e.g., 300px)'} 
                  value={imageData.width} 
                  onChange={(e)=>setImageData({...imageData, width: e.target.value})} 
                  className="p-4 bg-gray-50 border rounded-xl outline-none" 
                />
                <input 
                  type="text" 
                  placeholder={isSpanish ? 'Alto (ej: auto)' : 'Height (e.g., auto)'} 
                  value={imageData.height} 
                  onChange={(e)=>setImageData({...imageData, height: e.target.value})} 
                  className="p-4 bg-gray-50 border rounded-xl outline-none" 
                />
              </div>
              <select 
                value={imageData.align} 
                onChange={(e)=>setImageData({...imageData, align: e.target.value})} 
                className="w-full p-4 bg-gray-50 border rounded-xl font-bold"
              >
                <option value="left">{isSpanish ? 'Izquierda' : 'Left'}</option>
                <option value="center">{isSpanish ? 'Centro' : 'Center'}</option>
                <option value="right">{isSpanish ? 'Derecha' : 'Right'}</option>
                <option value="justify">{isSpanish ? 'Ancho completo' : 'Full width'}</option>
              </select>
            </div>
            <div className="p-8 bg-gray-50 flex justify-end gap-4">
              <button 
                onClick={() => setShowImageModal(false)} 
                className="font-bold text-gray-400 hover:text-gray-600 transition-colors"
              >
                {isSpanish ? 'CANCELAR' : 'CANCEL'}
              </button>
              <button 
                onClick={handleImageModalSubmit} 
                className="px-8 py-3 bg-[#004b87] text-white rounded-xl font-black hover:bg-[#003666] transition-all"
              >
                {isSpanish ? 'CONFIRMAR' : 'CONFIRM'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estilos globales */}
      <style jsx global>{`
        .editorial-quill .ql-toolbar.ql-snow {
          border: none;
          padding: 25px;
          background: white;
          border-bottom: 2px solid #f8f9fa;
          flex-wrap: wrap;
        }

        .editorial-quill .ql-container.ql-snow {
          border: none;
          min-height: 500px;
        }

        .editorial-quill .ql-editor {
          padding: 40px;
          font-size: 16px;
          line-height: 1.8;
        }

        .editorial-quill .ql-editor table {
          width: 100%;
          border-collapse: collapse;
          margin: 2rem 0;
        }

        .editorial-quill .ql-editor td,
        .editorial-quill .ql-editor th {
          border: 1px solid #ddd;
          padding: 12px;
        }

        .editorial-quill .ql-editor th {
          background-color: #f5f5f5;
          font-weight: bold;
        }

        .editorial-quill .ql-editor video {
          max-width: 100%;
          border-radius: 8px;
          margin: 2rem 0;
        }

        .editorial-quill .ql-editor .ql-formula {
          display: inline-block;
          margin: 0 4px;
        }

        .editorial-quill .ql-editor blockquote {
          border-left: 4px solid #004b87;
          background: #f8f9fa;
          padding: 20px 30px;
          margin: 2rem 0;
          font-style: italic;
          color: #4a5568;
        }

        .editorial-quill .ql-editor pre {
          background: #2d3748;
          color: #e2e8f0;
          padding: 20px;
          border-radius: 12px;
          overflow-x: auto;
          font-family: 'Courier New', monospace;
          margin: 2rem 0;
        }

        .ql-snow .ql-stroke {
          stroke: #004b87 !important;
          stroke-width: 2px;
        }

        .ql-snow .ql-fill {
          fill: #004b87 !important;
        }

        .ql-snow .ql-picker {
          color: #004b87 !important;
          font-weight: bold;
        }

        .ql-snow .ql-picker-options {
          border-color: #004b87 !important;
        }

        .ql-snow .ql-picker:hover .ql-picker-label,
        .ql-snow .ql-picker:hover .ql-picker-label svg {
          color: #003666 !important;
          stroke: #003666 !important;
        }

        .ql-snow .ql-active .ql-stroke {
          stroke: #003666 !important;
        }

        @media (max-width: 768px) {
          .editorial-quill .ql-editor {
            padding: 20px;
          }
          
          .editorial-quill .ql-toolbar.ql-snow {
            padding: 15px;
          }
        }
      `}</style>
    </div>
  );
}