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
  ChevronUpIcon,
  BookOpenIcon
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
  const [autoTranslate, setAutoTranslate] = useState(false); // Cambiado a false por defecto
  
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
        [{ 'header': [2, 3, 4, false] }],
        ['bold', 'italic', 'underline'],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        [{ 'align': ['', 'center', 'justify'] }],
        ['blockquote', 'code-block'],
        ['link', 'image', 'formula'],
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
          const mathText = prompt(isSpanish ? 'Ingresa fórmula LaTeX:' : 'Enter LaTeX formula:');
          if (mathText) {
            const range = this.quill.getSelection();
            this.quill.insertEmbed(range.index, 'formula', mathText);
          }
        }
      }
    },
    imageResize: {
      parchment: Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize', 'Toolbar'],
    }
  }), [activeLanguage, isSpanish]);

  const formats = [
    'header', 'bold', 'italic', 'underline', 'script',
    'list', 'bullet', 'align', 'blockquote', 'code-block',
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
      
        let style = 'max-width:100%; height:auto; margin:2rem 0; display:block;';
        if (align === 'center') style += 'margin-left:auto; margin-right:auto;';
        else if (align === 'right') style += 'float:right; margin-left:2rem; margin-bottom:1.5rem;';
        else if (align === 'justify') style += 'width:100%;';
        else style += 'float:left; margin-right:2rem; margin-bottom:1.5rem;';
      
        if (img.style.width) style += `width:${img.style.width};`;
        if (img.style.height) style += `height:${img.style.height};`;
      
        img.setAttribute('style', style);
        img.setAttribute('loading', 'lazy');
        img.setAttribute('alt', 'Imagen del artículo');
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
    setStatus({ type: 'info', msg: isSpanish ? 'Procesando manuscrito...' : 'Processing manuscript...' });

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
          ? `¡Manuscrito publicado con éxito! Año: ${result.year}` 
          : `Manuscript published successfully! Year: ${result.year}` 
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
    <div className="max-w-5xl mx-auto bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden border border-slate-200 mt-12 font-sans rounded-sm">
      {/* Header Editorial */}
      <div className="border-b-[6px] border-[#EA580C]">
        <div className="bg-[#0F172A] px-12 py-14 text-white text-center">
          <span className="text-[#EA580C] text-xs font-bold tracking-[0.3em] uppercase mb-4 block">
            {isSpanish ? 'Sistema de Envío Editorial' : 'Editorial Submission System'}
          </span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold tracking-tight mb-4">
            {isSpanish ? 'Gestor de Artículos' : 'Article Manager'}
          </h2>
          <p className="text-sm text-slate-400 opacity-80 font-medium mt-4">
            {isSpanish 
              ? 'Sistema profesional de publicación bilingüe con metadatos completos' 
              : 'Professional bilingual publishing system with complete metadata'}
          </p>
          <div className="w-16 h-[1px] bg-slate-500 mx-auto mt-6"></div>
        </div>
      </div>

      <div className="p-10 md:p-14 space-y-12">
        {/* Alerta de preparación */}
        <AnimatePresence>
          {showWarning && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, height: 0 }}
              className="bg-slate-50 border border-slate-200 p-6 flex items-start gap-4"
            >
              <BookOpenIcon className="w-6 h-6 text-[#0F172A] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider mb-1">
                  {isSpanish ? 'Normas de Redacción' : 'Writing Guidelines'}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed font-serif">
                  {isSpanish 
                    ? 'Se recomienda redactar el cuerpo del texto en un procesador externo (Word, LaTeX o Docs) para garantizar el respaldo de la información antes de su vaciado en este sistema.'
                    : 'It is recommended to draft the body text in an external processor to guarantee data backup before submission.'}
                </p>
                <button 
                  onClick={() => setShowWarning(false)} 
                  className="mt-4 text-xs font-bold text-[#EA580C] uppercase tracking-widest hover:text-[#c24100] transition-colors"
                >
                  {isSpanish ? 'Ocultar aviso' : 'Dismiss notice'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Estado del mensaje */}
        {status.msg && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className={`p-5 flex items-center gap-4 border-l-4 ${
              status.type === 'error' ? 'bg-red-50 border-red-500 text-red-900' :
              status.type === 'success' ? 'bg-green-50 border-green-500 text-green-900' :
              'bg-slate-50 border-[#0F172A] text-[#0F172A]'
            }`}
          >
            {status.type === 'error' && <XCircleIcon className="w-5 h-5 flex-shrink-0" />}
            {status.type === 'success' && <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />}
            {status.type === 'info' && <InformationCircleIcon className="w-5 h-5 flex-shrink-0" />}
            <span className="text-sm font-medium tracking-wide">{status.msg}</span>
          </motion.div>
        )}

        {/* Selector de idioma activo */}
        <div className="flex items-center gap-4 border border-slate-200 p-1 max-w-md">
          <button
            onClick={() => setActiveLanguage('es')}
            className={`px-6 py-2 text-xs font-bold uppercase tracking-wider transition-colors flex-1 ${
              activeLanguage === 'es' 
                ? 'bg-[#0F172A] text-white' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {isSpanish ? 'Español' : 'Spanish'}
          </button>
          <button
            onClick={() => setActiveLanguage('en')}
            className={`px-6 py-2 text-xs font-bold uppercase tracking-wider transition-colors flex-1 ${
              activeLanguage === 'en' 
                ? 'bg-[#0F172A] text-white' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {isSpanish ? 'Inglés' : 'English'}
          </button>
        </div>

        {/* Form Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
          
          {/* Metadata Column */}
          <div className="space-y-8 col-span-1 md:col-span-2 border-b border-slate-200 pb-10">
            <h3 className="text-xs font-bold tracking-[0.2em] text-slate-400 uppercase mb-6 flex items-center gap-3">
              <span className="w-4 h-[1px] bg-slate-300"></span>
              {isSpanish ? 'Metadatos del Documento' : 'Document Metadata'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-xs font-bold text-[#0F172A] uppercase tracking-widest flex items-center gap-2">
                  <UserIcon className="w-4 h-4" />
                  {isSpanish ? 'Autoría' : 'Authorship'}
                </label>
                <input 
                  type="text" 
                  value={author} 
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-slate-200 px-0 py-2 focus:border-[#EA580C] outline-none transition-colors text-lg font-serif text-slate-800 placeholder-slate-300"
                  placeholder={isSpanish ? 'Nombre del investigador o periodista' : 'Researcher or journalist name'}
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-[#0F172A] uppercase tracking-widest">
                  {isSpanish ? 'Disciplina' : 'Discipline'}
                </label>
                <select 
                  value={areaId} 
                  onChange={(e) => setAreaId(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-slate-200 px-0 py-2 focus:border-[#EA580C] outline-none transition-colors text-lg font-serif text-slate-800 appearance-none cursor-pointer"
                >
                  <option value="" className="font-sans text-sm">{isSpanish ? 'Seleccionar disciplina...' : 'Select discipline...'}</option>
                  {AREAS.map(area => (
                    <option key={area.id} value={area.id} className="font-sans text-sm">
                      {isSpanish ? area.labelEs : area.labelEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Titles Section */}
          <div className="space-y-8 col-span-1 md:col-span-2 border-b border-slate-200 pb-10">
            <h3 className="text-xs font-bold tracking-[0.2em] text-slate-400 uppercase mb-6 flex items-center gap-3">
              <span className="w-4 h-[1px] bg-slate-300"></span>
              {isSpanish ? 'Encabezados' : 'Headings'}
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">
                  {isSpanish ? 'Título Principal (ES)' : 'Main Title (ES)'}
                </label>
                <textarea 
                  rows="2" 
                  value={titleEs} 
                  onChange={(e) => setTitleEs(e.target.value)}
                  className="w-full bg-transparent border-none px-0 py-2 outline-none resize-none text-3xl md:text-4xl font-serif font-bold text-[#0F172A] placeholder-slate-200 leading-tight"
                  placeholder={isSpanish ? 'Ingrese el título del manuscrito...' : 'Enter manuscript title...'}
                />
              </div>
              <div className="pl-4 border-l-2 border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                  {isSpanish ? 'Título Secundario (EN)' : 'Secondary Title (EN)'}
                </label>
                <textarea 
                  rows="2" 
                  value={titleEn} 
                  onChange={(e) => setTitleEn(e.target.value)}
                  className="w-full bg-transparent border-none px-0 py-1 outline-none resize-none text-xl font-serif text-slate-600 placeholder-slate-200 leading-tight"
                  placeholder={isSpanish ? 'Traducción al inglés (opcional)...' : 'English translation (optional)...'}
                />
              </div>
            </div>
          </div>

          {/* Text Editor */}
          <div className="col-span-1 md:col-span-2 space-y-6 pt-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-xs font-bold tracking-[0.2em] text-slate-400 uppercase flex items-center gap-3">
                <span className="w-4 h-[1px] bg-slate-300"></span>
                {activeLanguage === 'es' 
                  ? (isSpanish ? 'Cuerpo en Español' : 'Spanish Body')
                  : (isSpanish ? 'Cuerpo en Inglés' : 'English Body')}
              </h3>
            </div>

            <div className="editorial-editor-wrapper bg-[#fafafa] border border-slate-200">
              {activeLanguage === 'es' ? (
                <ReactQuill 
                  ref={(ref) => {
                    quillEsRef.current = ref;
                    editorEsRef.current = ref?.getEditor();
                  }}
                  value={bodyEs} 
                  onChange={setBodyEs} 
                  modules={modules} 
                  formats={formats}
                  placeholder={isSpanish ? 'Comience a redactar aquí...' : 'Start drafting here...'}
                />
              ) : (
                <ReactQuill 
                  ref={(ref) => {
                    quillEnRef.current = ref;
                    editorEnRef.current = ref?.getEditor();
                  }}
                  value={bodyEn} 
                  onChange={setBodyEn} 
                  modules={modules} 
                  formats={formats}
                  placeholder={isSpanish ? 'Cuerpo en inglés...' : 'English body...'}
                />
              )}
            </div>
          </div>

          {/* Media & Advanced Settings */}
          <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-slate-200">
            
            {/* Cover Image */}
            <div className="space-y-6">
              <h3 className="text-xs font-bold tracking-[0.2em] text-slate-400 uppercase flex items-center gap-3">
                <span className="w-4 h-[1px] bg-slate-300"></span>
                {isSpanish ? 'Material Gráfico' : 'Graphic Material'}
              </h3>
              
              <div className="space-y-4">
                {photo ? (
                  <div className="relative group">
                    <img 
                      src={photo} 
                      alt="Cover preview" 
                      className="w-full h-48 object-cover border border-slate-200 grayscale-[20%] group-hover:grayscale-0 transition-all duration-500" 
                    />
                    <button 
                      onClick={() => setPhoto('')} 
                      className="absolute top-3 right-3 bg-white/90 backdrop-blur text-[#0F172A] p-2 hover:text-red-600 transition-colors border border-slate-200"
                    >
                      <XCircleIcon className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <label className="w-full h-48 border border-dashed border-slate-300 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-slate-500">
                    <PhotoIcon className="w-8 h-8 mb-3 opacity-50" />
                    <span className="text-xs font-bold uppercase tracking-widest">
                      {isSpanish ? 'Seleccionar Archivo' : 'Select File'}
                    </span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handlePhotoUpload} 
                      className="hidden" 
                    />
                  </label>
                )}
                
                <input 
                  type="text" 
                  value={photo.startsWith('data:') ? '' : photo} 
                  onChange={(e) => setPhoto(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-slate-200 px-0 py-2 focus:border-[#EA580C] outline-none transition-colors text-sm font-sans text-slate-600 placeholder-slate-300"
                  placeholder={isSpanish ? 'O ingrese URL de la imagen externa' : 'Or enter external image URL'}
                />
              </div>
            </div>

            {/* Taxonomy */}
            <div className="space-y-6">
              <h3 className="text-xs font-bold tracking-[0.2em] text-slate-400 uppercase flex items-center gap-3">
                <span className="w-4 h-[1px] bg-slate-300"></span>
                {isSpanish ? 'Taxonomía' : 'Taxonomy'}
              </h3>
              
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {isSpanish ? 'Tipo de Artículo' : 'Article Type'}
                  </label>
                  <select 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-transparent border-b-2 border-slate-200 px-0 py-2 focus:border-[#EA580C] outline-none transition-colors text-sm font-serif text-slate-800 appearance-none cursor-pointer"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {isSpanish ? cat.labelEs : cat.labelEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <TagIcon className="w-3 h-3" />
                    {isSpanish ? 'Palabras Clave (Keywords)' : 'Keywords'}
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {tags.map((tag, index) => (
                      <span 
                        key={index} 
                        className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 text-slate-600 text-xs px-3 py-1 font-serif"
                      >
                        {tag}
                        <button 
                          onClick={() => removeTag(index)} 
                          className="hover:text-red-500"
                        >
                          <XCircleIcon className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <input 
                    type="text" 
                    value={tagInput} 
                    onChange={(e) => setTagInput(e.target.value)} 
                    onKeyDown={handleTagKeyDown}
                    className="w-full bg-transparent border-b-2 border-slate-200 px-0 py-2 focus:border-[#EA580C] outline-none transition-colors text-sm font-sans text-slate-600 placeholder-slate-300"
                    placeholder={isSpanish ? 'Presione ENTER para añadir' : 'Press ENTER to add'}
                  />
                </div>

                <div className="pt-4 flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="featured" 
                    checked={featured} 
                    onChange={(e) => setFeatured(e.target.checked)}
                    className="w-4 h-4 accent-[#EA580C]"
                  />
                  <label 
                    htmlFor="featured" 
                    className="text-sm font-serif text-slate-700 cursor-pointer"
                  >
                    {isSpanish ? 'Destacar manuscrito en portada' : 'Feature manuscript on front page'}
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Action */}
        <div className="pt-10 border-t border-slate-200 flex justify-end">
          <button 
            onClick={handleSubmit} 
            disabled={isLoading}
            className={`px-10 py-4 text-white font-bold uppercase tracking-[0.2em] text-sm transition-all ${
              isLoading 
                ? 'bg-slate-400 cursor-not-allowed' 
                : 'bg-[#EA580C] hover:bg-[#c24100] active:scale-[0.98]'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center gap-3">
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                {isSpanish ? 'Procesando...' : 'Processing...'}
              </span>
            ) : (
              isSpanish ? 'Someter Artículo' : 'Submit Article'
            )}
          </button>
        </div>
      </div>

      {/* Modal de Imagen */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[999] p-6">
          <div className="bg-white shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-8 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-[#0F172A] uppercase tracking-widest text-sm">
                {isSpanish ? 'GESTIÓN DE IMAGEN' : 'IMAGE MANAGEMENT'}
              </h3>
            </div>
            <div className="p-8 space-y-6">
              <input 
                type="text" 
                value={imageData.url} 
                onChange={(e)=>setImageData({...imageData, url: e.target.value})} 
                className="w-full p-3 bg-transparent border-b-2 border-slate-200 focus:border-[#EA580C] outline-none transition-colors" 
                placeholder={isSpanish ? 'URL de la imagen' : 'Image URL'} 
                disabled={isEditingImage} 
              />
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="text" 
                  placeholder={isSpanish ? 'Ancho (ej: 300px)' : 'Width (e.g., 300px)'} 
                  value={imageData.width} 
                  onChange={(e)=>setImageData({...imageData, width: e.target.value})} 
                  className="p-3 bg-transparent border-b-2 border-slate-200 focus:border-[#EA580C] outline-none transition-colors" 
                />
                <input 
                  type="text" 
                  placeholder={isSpanish ? 'Alto (ej: auto)' : 'Height (e.g., auto)'} 
                  value={imageData.height} 
                  onChange={(e)=>setImageData({...imageData, height: e.target.value})} 
                  className="p-3 bg-transparent border-b-2 border-slate-200 focus:border-[#EA580C] outline-none transition-colors" 
                />
              </div>
              <select 
                value={imageData.align} 
                onChange={(e)=>setImageData({...imageData, align: e.target.value})} 
                className="w-full p-3 bg-transparent border-b-2 border-slate-200 focus:border-[#EA580C] outline-none transition-colors font-medium cursor-pointer"
              >
                <option value="left">{isSpanish ? 'Izquierda' : 'Left'}</option>
                <option value="center">{isSpanish ? 'Centro' : 'Center'}</option>
                <option value="right">{isSpanish ? 'Derecha' : 'Right'}</option>
                <option value="justify">{isSpanish ? 'Ancho completo' : 'Full width'}</option>
              </select>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end gap-4 border-t border-slate-200">
              <button 
                onClick={() => setShowImageModal(false)} 
                className="font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-wider text-sm"
              >
                {isSpanish ? 'Cancelar' : 'Cancel'}
              </button>
              <button 
                onClick={handleImageModalSubmit} 
                className="px-8 py-3 bg-[#EA580C] text-white font-bold hover:bg-[#c24100] transition-all uppercase tracking-wider text-sm"
              >
                {isSpanish ? 'Confirmar' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS overrides for Quill to mimic a high-end editorial CMS */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600;700&display=swap');

        /* Editor Wrapper Styling */
        .editorial-editor-wrapper .ql-toolbar.ql-snow {
          border: none;
          border-bottom: 1px solid #e2e8f0;
          padding: 12px 20px;
          background: #ffffff;
          font-family: 'Inter', sans-serif;
          flex-wrap: wrap;
        }

        .editorial-editor-wrapper .ql-container.ql-snow {
          border: none;
          background: #ffffff;
          min-height: 500px;
          font-family: 'Playfair Display', serif;
        }

        .editorial-editor-wrapper .ql-editor {
          padding: 60px 80px;
          font-size: 19px;
          line-height: 1.8;
          color: #1e293b;
          max-width: 800px;
          margin: 0 auto;
        }

        .editorial-editor-wrapper .ql-editor p {
          margin-bottom: 1.5rem;
        }

        .editorial-editor-wrapper .ql-editor h2, 
        .editorial-editor-wrapper .ql-editor h3 {
          font-family: 'Inter', sans-serif;
          font-weight: 700;
          color: #0F172A;
          margin-top: 2.5rem;
          margin-bottom: 1rem;
        }

        .editorial-editor-wrapper .ql-editor blockquote {
          border-left: 2px solid #EA580C;
          padding-left: 24px;
          margin: 2.5rem 0;
          font-style: italic;
          color: #475569;
          font-size: 1.25rem;
          line-height: 1.6;
        }

        .editorial-editor-wrapper .ql-editor img {
          max-width: 100%;
          margin: 3rem 0;
        }

        .editorial-editor-wrapper .ql-editor video {
          max-width: 100%;
          margin: 2rem 0;
        }

        .editorial-editor-wrapper .ql-editor .ql-formula {
          display: inline-block;
          margin: 0 4px;
        }

        /* SVG Icon styling inside Quill Toolbar */
        .ql-snow .ql-stroke {
          stroke: #64748b !important;
          stroke-width: 1.5px;
        }
        .ql-snow .ql-fill {
          fill: #64748b !important;
        }
        .ql-snow .ql-picker {
          color: #64748b !important;
        }
        
        /* Active States */
        .ql-snow .ql-active .ql-stroke,
        .ql-snow .ql-picker-label:hover .ql-stroke,
        .ql-snow button:hover .ql-stroke {
          stroke: #0F172A !important;
        }
        .ql-snow .ql-active .ql-fill,
        .ql-snow .ql-picker-label:hover .ql-fill,
        .ql-snow button:hover .ql-fill {
          fill: #0F172A !important;
        }
        .ql-snow .ql-active,
        .ql-snow .ql-picker-label:hover {
          color: #0F172A !important;
        }

        @media (max-width: 768px) {
          .editorial-editor-wrapper .ql-editor {
            padding: 30px 20px;
            font-size: 17px;
          }
          
          .editorial-editor-wrapper .ql-toolbar.ql-snow {
            padding: 8px 12px;
          }
        }
      `}</style>
    </div>
  );
}