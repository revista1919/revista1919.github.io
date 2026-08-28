// src/components/ScientificNewsUploadSection.jsx
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import 'quill-better-table/dist/quill-better-table.css'; // CSS para tablas
import QuillBetterTable from 'quill-better-table';
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
// Registrar ImageResize silenciosamente
Quill.register('modules/imageResize', ImageResize, true);

// Registrar BetterTable silenciosamente
Quill.register({
  'modules/better-table': QuillBetterTable
}, true);

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
  { id: 'biologia', labelEs: 'Biología', labelEn: 'Biology', color: '#059669' },
  { id: 'quimica', labelEs: 'Química', labelEn: 'Chemistry', color: '#7c3aed' },
  { id: 'fisica', labelEs: 'Física', labelEn: 'Physics', color: '#2563eb' },
  { id: 'matematica', labelEs: 'Matemática', labelEn: 'Mathematics', color: '#dc2626' },
  { id: 'computacion', labelEs: 'Computación', labelEn: 'Computer Science', color: '#0891b2' },
  { id: 'astronomia', labelEs: 'Astronomía', labelEn: 'Astronomy', color: '#4f46e5' },
  { id: 'geologia', labelEs: 'Geología', labelEn: 'Geology', color: '#b45309' },
  { id: 'medicina', labelEs: 'Medicina', labelEn: 'Medicine', color: '#e11d48' },
  { id: 'ingenieria', labelEs: 'Ingeniería', labelEn: 'Engineering', color: '#475569' },
  { id: 'ciencias_sociales', labelEs: 'Ciencias Sociales', labelEn: 'Social Sciences', color: '#9333ea' },
  { id: 'medio_ambiente', labelEs: 'Medio Ambiente', labelEn: 'Environment', color: '#16a34a' },
  { id: 'neurociencia', labelEs: 'Neurociencia', labelEn: 'Neuroscience', color: '#db2777' },
  { id: 'logros_estudiantiles', labelEs: 'Logros Estudiantiles', labelEn: 'Student Achievements', color: '#ea580c' }
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
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
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
    // ⚠️ Obligatorio: desactivar el módulo nativo de tablas
    table: false,

    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'font': [] }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        [{ 'indent': '-1' }, { 'indent': '+1' }],
        [{ 'align': [] }],
        ['blockquote', 'code-block'],
        ['link', 'image', 'video', 'formula'],
        ['table'], // Botón custom para insertar tabla
        ['clean']
      ],
      handlers: {
        image: function() {
          setActiveEditor(activeEditor);
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
        },
        // Handler para insertar tabla
        table: function() {
          const quill = this.quill;
          const tableModule = quill.getModule('better-table');
          if (tableModule) {
            const rows = prompt(isSpanish ? 'Número de filas:' : 'Number of rows:', '3');
            const cols = prompt(isSpanish ? 'Número de columnas:' : 'Number of columns:', '3');
            if (rows && cols) {
              tableModule.insertTable(parseInt(rows, 10), parseInt(cols, 10));
            }
          }
        }
      }
    },

    imageResize: {
      parchment: Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize', 'Toolbar'],
    },

    // Configuración de better-table
    'better-table': {
      operationMenu: {
        items: {
          insertColumnRight: { text: isSpanish ? 'Insertar columna derecha' : 'Insert column right' },
          insertColumnLeft: { text: isSpanish ? 'Insertar columna izquierda' : 'Insert column left' },
          insertRowUp: { text: isSpanish ? 'Insertar fila arriba' : 'Insert row up' },
          insertRowDown: { text: isSpanish ? 'Insertar fila abajo' : 'Insert row down' },
          mergeCells: { text: isSpanish ? 'Combinar celdas' : 'Merge cells' },
          unmergeCells: { text: isSpanish ? 'Separar celdas' : 'Unmerge cells' },
          deleteColumn: { text: isSpanish ? 'Eliminar columna' : 'Delete column' },
          deleteRow: { text: isSpanish ? 'Eliminar fila' : 'Delete row' },
          deleteTable: { text: isSpanish ? 'Eliminar tabla' : 'Delete table' }
        }
      }
    },

    // ⚠️ Obligatorio para evitar el error .pop()
    keyboard: {
      bindings: QuillBetterTable.keyboardBindings
    },

    clipboard: {
      matchVisual: false
    }
  }), [activeEditor, isSpanish]);

  const formats = [
    'header', 'bold', 'italic', 'underline', 'strike', 'script',
    'list', 'bullet', 'indent', 'align',
    'blockquote', 'code-block', 'link', 'image', 'video', 'formula',
    'color', 'background', 'font', 'size',
    // Formatos de better-table
    'table', 'table-cell', 'table-row', 'table-header-cell',
    'table-container', 'table-body', 'table-col', 'table-col-group'
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

      // Procesamiento de tablas
      const tables = tempDiv.querySelectorAll('table');
      tables.forEach(table => {
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
        table.style.margin = '2rem 0';
        
        const cells = table.querySelectorAll('td, th');
        cells.forEach(cell => {
          cell.style.border = '1px solid #ddd';
          cell.style.padding = '12px';
          cell.style.textAlign = 'left';
        });
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
    <div className="w-full bg-white text-[#222] min-h-screen pb-24">
      
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=PT+Serif:ital,wght@0,400;0,700;1,400&family=Roboto:wght@300;400;500;700&display=swap');
        
        .font-serif-nature { font-family: 'PT Serif', Georgia, serif; }
        .font-sans-nature { font-family: 'Roboto', Arial, sans-serif; }
        
        .editorial-editor-wrapper .ql-toolbar.ql-snow {
          border: none;
          border-bottom: 1px solid #d8d8d8;
          padding: 12px 20px;
          background: #ffffff;
          font-family: 'Roboto', Arial, sans-serif;
          flex-wrap: wrap;
        }

        .editorial-editor-wrapper .ql-container.ql-snow {
          border: none;
          background: #ffffff;
          min-height: 400px;
          font-family: 'PT Serif', Georgia, serif;
        }

        .editorial-editor-wrapper .ql-editor {
          padding: 40px 50px;
          font-size: 16px;
          line-height: 1.7;
          color: #333;
          min-height: 400px;
        }

        .editorial-editor-wrapper .ql-editor p {
          margin-bottom: 1rem;
          line-height: 1.5;
          color: #444;
          font-size: 0.95rem;
          font-weight: 300;
        }

        .editorial-editor-wrapper .ql-editor h1, 
        .editorial-editor-wrapper .ql-editor h2, 
        .editorial-editor-wrapper .ql-editor h3,
        .editorial-editor-wrapper .ql-editor h4,
        .editorial-editor-wrapper .ql-editor h5,
        .editorial-editor-wrapper .ql-editor h6 {
          font-family: 'Roboto', Arial, sans-serif;
          font-weight: 700;
          color: #222;
          margin-top: 2rem;
          margin-bottom: 1rem;
        }

        .editorial-editor-wrapper .ql-editor blockquote {
          border-left: 2px solid #EA580C;
          padding-left: 20px;
          margin: 2rem 0;
          font-style: italic;
          color: #555;
        }

        .editorial-editor-wrapper .ql-editor img {
          max-width: 100%;
          margin: 2rem 0;
        }

        .editorial-editor-wrapper .ql-editor table {
          border-collapse: collapse;
          width: 100%;
          margin: 2rem 0;
        }

        .editorial-editor-wrapper .ql-editor table td,
        .editorial-editor-wrapper .ql-editor table th {
          border: 1px solid #ddd;
          padding: 12px;
          text-align: left;
        }

        .editorial-editor-wrapper .ql-editor ol,
        .editorial-editor-wrapper .ql-editor ul {
          margin: 1rem 0;
          padding-left: 2rem;
        }

        .editorial-editor-wrapper .ql-editor ol ol,
        .editorial-editor-wrapper .ql-editor ul ul,
        .editorial-editor-wrapper .ql-editor ol ul,
        .editorial-editor-wrapper .ql-editor ul ol {
          margin: 0.5rem 0;
        }

        .ql-snow .ql-stroke {
          stroke: #666 !important;
          stroke-width: 1.5px;
        }
        .ql-snow .ql-fill {
          fill: #666 !important;
        }
        .ql-snow .ql-picker {
          color: #666 !important;
        }
        
        .ql-snow .ql-active .ql-stroke,
        .ql-snow .ql-picker-label:hover .ql-stroke,
        .ql-snow button:hover .ql-stroke {
          stroke: #222 !important;
        }
        .ql-snow .ql-active .ql-fill,
        .ql-snow .ql-picker-label:hover .ql-fill,
        .ql-snow button:hover .ql-fill {
          fill: #222 !important;
        }
        .ql-snow .ql-active,
        .ql-snow .ql-picker-label:hover {
          color: #222 !important;
        }

        @media (max-width: 768px) {
          .editorial-editor-wrapper .ql-editor {
            padding: 25px 20px;
            font-size: 15px;
          }
          
          .editorial-editor-wrapper .ql-toolbar.ql-snow {
            padding: 8px 12px;
          }
        }
      `}} />

      <div className="max-w-[1280px] mx-auto px-4 md:px-8 pt-8">
        
        {/* --- HEADER EDITORIAL --- */}
        <div className="border-b-2 border-gray-800 pb-4 mb-8">
          <h1 className="text-4xl md:text-5xl font-serif-nature font-bold text-black mb-2">
            {isSpanish ? 'Envío de Artículos' : 'Article Submission'}
          </h1>
          <p className="text-sm font-sans-nature text-gray-600">
            {isSpanish 
              ? 'Sistema editorial para publicación bilingüe de investigación y noticias científicas' 
              : 'Editorial system for bilingual publication of research and scientific news'}
          </p>
        </div>

        {/* Alerta de preparación */}
        <AnimatePresence>
          {showWarning && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, height: 0 }}
              className="bg-gray-50 border border-gray-300 p-5 mb-8 flex items-start gap-4"
            >
              <BookOpenIcon className="w-6 h-6 text-gray-800 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-1 font-sans-nature">
                  {isSpanish ? 'Normas de Redacción' : 'Writing Guidelines'}
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed font-serif-nature">
                  {isSpanish 
                    ? 'Se recomienda redactar el cuerpo del texto en un procesador externo (Word, LaTeX o Docs) para garantizar el respaldo de la información antes de su vaciado en este sistema.'
                    : 'It is recommended to draft the body text in an external processor to guarantee data backup before submission.'}
                </p>
                <button 
                  onClick={() => setShowWarning(false)} 
                  className="mt-3 text-xs font-bold text-gray-900 uppercase tracking-widest hover:text-gray-600 transition-colors font-sans-nature"
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
            className={`p-4 flex items-center gap-3 border-l-4 mb-8 font-sans-nature ${
              status.type === 'error' ? 'bg-red-50 border-red-500 text-red-900' :
              status.type === 'success' ? 'bg-green-50 border-green-500 text-green-900' :
              'bg-blue-50 border-blue-500 text-blue-900'
            }`}
          >
            {status.type === 'error' && <XCircleIcon className="w-5 h-5 flex-shrink-0" />}
            {status.type === 'success' && <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />}
            {status.type === 'info' && <InformationCircleIcon className="w-5 h-5 flex-shrink-0" />}
            <span className="text-sm font-medium">{status.msg}</span>
          </motion.div>
        )}

        {/* --- FORMULARIO PRINCIPAL --- */}
        <div className="grid grid-cols-1 gap-8">
          
          {/* Metadatos */}
          <section className="border-b border-gray-300 pb-8">
            <h2 className="text-xl font-serif-nature font-bold text-black mb-6">
              {isSpanish ? 'Metadatos del Documento' : 'Document Metadata'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans-nature">
                  {isSpanish ? 'Autoría' : 'Authorship'}
                </label>
                <input 
                  type="text" 
                  value={author} 
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 focus:border-black outline-none transition-colors text-base font-serif-nature bg-white"
                  placeholder={isSpanish ? 'Nombre del investigador o periodista' : 'Researcher or journalist name'}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans-nature">
                  {isSpanish ? 'Disciplina' : 'Discipline'}
                </label>
                <select 
                  value={areaId} 
                  onChange={(e) => setAreaId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 focus:border-black outline-none transition-colors text-base font-serif-nature bg-white cursor-pointer"
                >
                  <option value="">{isSpanish ? 'Seleccionar disciplina...' : 'Select discipline...'}</option>
                  {AREAS.map(area => (
                    <option key={area.id} value={area.id}>
                      {isSpanish ? area.labelEs : area.labelEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Títulos */}
          <section className="border-b border-gray-300 pb-8">
            <h2 className="text-xl font-serif-nature font-bold text-black mb-6">
              {isSpanish ? 'Encabezados' : 'Headings'}
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans-nature">
                  {isSpanish ? 'Título Principal (ES)' : 'Main Title (ES)'}
                </label>
                <textarea 
                  rows="2" 
                  value={titleEs} 
                  onChange={(e) => setTitleEs(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 focus:border-black outline-none resize-none text-2xl font-serif-nature font-bold bg-white"
                  placeholder={isSpanish ? 'Ingrese el título del manuscrito...' : 'Enter manuscript title...'}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans-nature">
                  {isSpanish ? 'Título Secundario (EN)' : 'Secondary Title (EN)'}
                </label>
                <textarea 
                  rows="2" 
                  value={titleEn} 
                  onChange={(e) => setTitleEn(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 focus:border-black outline-none resize-none text-xl font-serif-nature bg-white"
                  placeholder={isSpanish ? 'Traducción al inglés (opcional)...' : 'English translation (optional)...'}
                />
              </div>
            </div>
          </section>

          {/* Cuerpo del Documento */}
          <section className="border-b border-gray-300 pb-8">
            <h2 className="text-xl font-serif-nature font-bold text-black mb-6">
              {isSpanish ? 'Cuerpo del Documento' : 'Document Body'}
            </h2>
            
            {/* Editor Español */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans-nature">
                {isSpanish ? 'Contenido en Español' : 'Spanish Content'}
              </label>
              <div className="editorial-editor-wrapper border border-gray-300 bg-white">
                <ReactQuill 
                  ref={(ref) => {
                    quillEsRef.current = ref;
                    editorEsRef.current = ref?.getEditor();
                  }}
                  value={bodyEs} 
                  onChange={setBodyEs} 
                  modules={modules} 
                  formats={formats}
                  placeholder={isSpanish ? 'Escriba el contenido en español aquí...' : 'Write Spanish content here...'}
                />
              </div>
            </div>
            
            {/* Editor Inglés */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans-nature">
                {isSpanish ? 'Contenido en Inglés' : 'English Content'}
              </label>
              <div className="editorial-editor-wrapper border border-gray-300 bg-white">
                <ReactQuill 
                  ref={(ref) => {
                    quillEnRef.current = ref;
                    editorEnRef.current = ref?.getEditor();
                  }}
                  value={bodyEn} 
                  onChange={setBodyEn} 
                  modules={modules} 
                  formats={formats}
                  placeholder={isSpanish ? 'Escriba el contenido en inglés aquí...' : 'Write English content here...'}
                />
              </div>
            </div>
          </section>

          {/* Material Gráfico y Taxonomía */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-gray-300 pb-8">
            
            {/* Foto de Portada */}
            <div>
              <h2 className="text-xl font-serif-nature font-bold text-black mb-6 flex items-center gap-2">
                <PhotoIcon className="w-5 h-5" />
                {isSpanish ? 'Imagen de Portada' : 'Cover Image'}
              </h2>
              
              <div className="space-y-4">
                {photo ? (
                  <div className="relative">
                    <img 
                      src={photo} 
                      alt="Cover preview" 
                      className="w-full h-64 object-cover border border-gray-300" 
                    />
                    <button 
                      onClick={() => setPhoto('')} 
                      className="absolute top-3 right-3 bg-white/90 p-2 hover:bg-red-50 transition-colors border border-gray-300"
                    >
                      <XCircleIcon className="w-5 h-5 text-gray-700 hover:text-red-600" />
                    </button>
                  </div>
                ) : (
                  <label className="w-full h-64 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                    <PhotoIcon className="w-10 h-10 mb-3 text-gray-400" />
                    <span className="text-sm font-bold uppercase tracking-widest text-gray-600 font-sans-nature">
                      {isSpanish ? 'Subir Imagen' : 'Upload Image'}
                    </span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handlePhotoUpload} 
                      className="hidden" 
                    />
                  </label>
                )}
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-sans-nature">
                    {isSpanish ? 'O pegar URL:' : 'Or paste URL:'}
                  </span>
                  <input 
                    type="text" 
                    value={photo.startsWith('data:') ? '' : photo} 
                    onChange={(e) => setPhoto(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 focus:border-black outline-none text-sm"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            {/* Taxonomía */}
            <div>
              <h2 className="text-xl font-serif-nature font-bold text-black mb-6">
                {isSpanish ? 'Taxonomía' : 'Taxonomy'}
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans-nature">
                    {isSpanish ? 'Tipo de Artículo' : 'Article Type'}
                  </label>
                  <select 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 focus:border-black outline-none text-base font-serif-nature bg-white cursor-pointer"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {isSpanish ? cat.labelEs : cat.labelEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans-nature flex items-center gap-2">
                    <TagIcon className="w-4 h-4" />
                    {isSpanish ? 'Palabras Clave' : 'Keywords'}
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {tags.map((tag, index) => (
                      <span 
                        key={index} 
                        className="inline-flex items-center gap-2 bg-gray-100 border border-gray-300 text-gray-800 text-sm px-3 py-1.5 font-serif-nature"
                      >
                        {tag}
                        <button 
                          onClick={() => removeTag(index)} 
                          className="hover:text-red-600 transition-colors"
                        >
                          <XCircleIcon className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <input 
                    type="text" 
                    value={tagInput} 
                    onChange={(e) => setTagInput(e.target.value)} 
                    onKeyDown={handleTagKeyDown}
                    className="w-full px-4 py-2.5 border border-gray-300 focus:border-black outline-none text-base font-serif-nature bg-white"
                    placeholder={isSpanish ? 'Presione ENTER para añadir' : 'Press ENTER to add'}
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input 
                    type="checkbox" 
                    id="featured" 
                    checked={featured} 
                    onChange={(e) => setFeatured(e.target.checked)}
                    className="w-4 h-4 accent-black"
                  />
                  <label 
                    htmlFor="featured" 
                    className="text-sm text-gray-800 cursor-pointer font-serif-nature"
                  >
                    {isSpanish ? 'Destacar manuscrito en portada' : 'Feature manuscript on front page'}
                  </label>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* --- BOTÓN DE ENVÍO --- */}
        <div className="pt-8 flex justify-end">
          <button 
            onClick={handleSubmit} 
            disabled={isLoading}
            className={`px-10 py-3.5 text-white font-sans-nature font-bold uppercase tracking-wider text-sm transition-all ${
              isLoading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-black hover:bg-gray-800 active:scale-[0.98]'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                {isSpanish ? 'Procesando...' : 'Processing...'}
              </span>
            ) : (
              isSpanish ? 'Enviar Artículo' : 'Submit Article'
            )}
          </button>
        </div>
      </div>

      {/* Modal de Imagen para el Editor */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[999] p-6">
          <div className="bg-white shadow-2xl max-w-md w-full overflow-hidden border border-gray-300">
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <h3 className="font-sans-nature font-bold text-gray-900 uppercase tracking-widest text-sm">
                {isSpanish ? 'Insertar Imagen' : 'Insert Image'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans-nature">
                  {isSpanish ? 'URL de la imagen' : 'Image URL'}
                </label>
                <input 
                  type="text" 
                  value={imageData.url} 
                  onChange={(e)=>setImageData({...imageData, url: e.target.value})} 
                  className="w-full px-4 py-2.5 border border-gray-300 focus:border-black outline-none text-base"
                  placeholder={isSpanish ? 'https://ejemplo.com/imagen.jpg' : 'https://example.com/image.jpg'}
                  disabled={isEditingImage} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans-nature">
                    {isSpanish ? 'Ancho' : 'Width'}
                  </label>
                  <input 
                    type="text" 
                    placeholder={isSpanish ? '300px' : '300px'} 
                    value={imageData.width} 
                    onChange={(e)=>setImageData({...imageData, width: e.target.value})} 
                    className="w-full px-4 py-2.5 border border-gray-300 focus:border-black outline-none text-base" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans-nature">
                    {isSpanish ? 'Alto' : 'Height'}
                  </label>
                  <input 
                    type="text" 
                    placeholder={isSpanish ? 'auto' : 'auto'} 
                    value={imageData.height} 
                    onChange={(e)=>setImageData({...imageData, height: e.target.value})} 
                    className="w-full px-4 py-2.5 border border-gray-300 focus:border-black outline-none text-base" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans-nature">
                  {isSpanish ? 'Alineación' : 'Alignment'}
                </label>
                <select 
                  value={imageData.align} 
                  onChange={(e)=>setImageData({...imageData, align: e.target.value})} 
                  className="w-full px-4 py-2.5 border border-gray-300 focus:border-black outline-none text-base cursor-pointer"
                >
                  <option value="left">{isSpanish ? 'Izquierda' : 'Left'}</option>
                  <option value="center">{isSpanish ? 'Centro' : 'Center'}</option>
                  <option value="right">{isSpanish ? 'Derecha' : 'Right'}</option>
                  <option value="justify">{isSpanish ? 'Ancho completo' : 'Full width'}</option>
                </select>
              </div>
            </div>
            <div className="p-6 bg-gray-50 flex justify-end gap-4 border-t border-gray-200">
              <button 
                onClick={() => setShowImageModal(false)} 
                className="font-sans-nature font-bold text-gray-600 hover:text-gray-900 transition-colors uppercase tracking-wider text-sm"
              >
                {isSpanish ? 'Cancelar' : 'Cancel'}
              </button>
              <button 
                onClick={handleImageModalSubmit} 
                className="px-8 py-2.5 bg-black text-white font-sans-nature font-bold hover:bg-gray-800 transition-all uppercase tracking-wider text-sm"
              >
                {isSpanish ? 'Confirmar' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}