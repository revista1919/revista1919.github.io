// src/components/ScientificNewsUploadSection.jsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import TableHandler, { rewirteFormats } from 'quill1.3.7-table-module';
import 'quill1.3.7-table-module/dist/index.css';
import ImageResize from 'quill-image-resize-module-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { auth } from '../firebase';
import { debounce } from 'lodash';
import { useLanguage } from '../hooks/useLanguage';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhotoIcon,
  TagIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  BookOpenIcon,
  PlayCircleIcon,
} from '@heroicons/react/24/outline';

// ===================================================
// REGISTRO GLOBAL (solo una vez)
// ===================================================
window.katex = katex;

Quill.register('modules/imageResize', ImageResize, true);
Quill.register({ [`modules/${TableHandler.moduleName}`]: TableHandler }, true);
rewirteFormats();

// Video nativo de Quill → iframe (YouTube / Vimeo / MP4)
const BlockEmbed = Quill.import('blots/block/embed');
class VideoBlot extends BlockEmbed {
  static create(value) {
    const node = super.create(value);
    let src = value;
    // Convertir URLs de YouTube a embed
    if (typeof value === 'string') {
      const yt =
        value.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/) ||
        value.match(/youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/);
      if (yt) {
        src = `https://www.youtube.com/embed/${yt[1]}?rel=0`;
      }
      const vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (vimeo) {
        src = `https://player.vimeo.com/video/${vimeo[1]}`;
      }
    }
    node.setAttribute('src', src);
    node.setAttribute('frameborder', '0');
    node.setAttribute('allowfullscreen', 'true');
    node.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    node.setAttribute('class', 'ql-video');
    return node;
  }

  static value(node) {
    return node.getAttribute('src');
  }
}
VideoBlot.blotName = 'video';
VideoBlot.tagName = 'iframe';
VideoBlot.className = 'ql-video';
Quill.register(VideoBlot, true);

// ===================================================
// CONSTANTES
// ===================================================
const NEWS_SCRIPT_URL = 'https://us-central1-usuarios-rnce.cloudfunctions.net/uploadScientificNews';

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
  { id: 'logros_estudiantiles', labelEs: 'Logros Estudiantiles', labelEn: 'Student Achievements' },
];

const CATEGORIES = [
  { id: 'investigacion', labelEs: 'Investigación', labelEn: 'Research' },
  { id: 'descubrimiento', labelEs: 'Descubrimiento', labelEn: 'Discovery' },
  { id: 'evento', labelEs: 'Evento', labelEn: 'Event' },
  { id: 'premio', labelEs: 'Premio', labelEn: 'Award' },
  { id: 'entrevista', labelEs: 'Entrevista', labelEn: 'Interview' },
  { id: 'opinion', labelEs: 'Opinión', labelEn: 'Opinion' },
  { id: 'general', labelEs: 'General', labelEn: 'General' },
];

// ===================================================
// UTILIDADES
// ===================================================
const base64EncodeUnicode = (str) => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
};

const sanitizeInput = (input) => {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const toYoutubeEmbed = (url) => {
  if (!url) return null;
  const m =
    url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/) ||
    url.match(/youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}?rel=0`;
  const v = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (v) return `https://player.vimeo.com/video/${v[1]}`;
  if (url.includes('youtube.com/embed') || url.includes('player.vimeo.com')) return url;
  return url; // mp4 u otras URLs directas
};

// ===================================================
// COMPONENTE
// ===================================================
export default function ScientificNewsUploadSection({ userData }) {
  const { language } = useLanguage();
  const isSpanish = language === 'es';

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

  const [status, setStatus] = useState({ type: '', msg: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(true);

  const quillEsRef = useRef(null);
  const quillEnRef = useRef(null);
  const editorEsRef = useRef(null);
  const editorEnRef = useRef(null);
  const activeEditorRef = useRef('es');

  const [showImageModal, setShowImageModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [imageData, setImageData] = useState({ url: '', width: '', height: '', align: 'center' });
  const [videoUrl, setVideoUrl] = useState('');

  // ---------- Draft ----------
  useEffect(() => {
    const saved = localStorage.getItem('scientificNewsDraft');
    if (saved) {
      try {
        const d = JSON.parse(saved);
        setTitleEs(d.titleEs || '');
        setTitleEn(d.titleEn || '');
        setBodyEs(d.bodyEs || '');
        setBodyEn(d.bodyEn || '');
        setAuthor(d.author || userData?.displayName || '');
        setAreaId(d.areaId || '');
        setCategory(d.category || 'general');
        setTags(d.tags || []);
        setPhoto(d.photo || '');
        setFeatured(d.featured || false);
      } catch (_) {}
    }
  }, [userData]);

  const debouncedSave = useMemo(
    () =>
      debounce((draft) => {
        localStorage.setItem('scientificNewsDraft', JSON.stringify(draft));
      }, 1000),
    []
  );

  useEffect(() => {
    debouncedSave({ titleEs, titleEn, bodyEs, bodyEn, author, areaId, category, tags, photo, featured });
  }, [titleEs, titleEn, bodyEs, bodyEn, author, areaId, category, tags, photo, featured, debouncedSave]);

  useEffect(() => () => debouncedSave.cancel(), [debouncedSave]);

  const clearDraft = () => localStorage.removeItem('scientificNewsDraft');

  // ---------- Modules (estable) ----------
  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, 4, 5, 6, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ script: 'sub' }, { script: 'super' }],
          [{ color: [] }, { background: [] }],
          [{ font: [] }],
          [{ size: ['small', false, 'large', 'huge'] }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ indent: '-1' }, { indent: '+1' }],
          [{ align: [] }],
          ['blockquote', 'code-block'],
          ['link', 'image', 'video', 'formula'],
          [TableHandler.toolName],
          ['clean'],
        ],
        handlers: {
          image() {
            activeEditorRef.current = this.quill === editorEsRef.current ? 'es' : 'en';
            setImageData({ url: '', width: '', height: '', align: 'center' });
            setShowImageModal(true);
          },
          video() {
            activeEditorRef.current = this.quill === editorEsRef.current ? 'es' : 'en';
            setVideoUrl('');
            setShowVideoModal(true);
          },
          formula() {
            const text = prompt(isSpanish ? 'Fórmula LaTeX:' : 'LaTeX formula:');
            if (text) {
              const range = this.quill.getSelection(true);
              this.quill.insertEmbed(range.index, 'formula', text, 'user');
            }
          },
        },
      },
      [TableHandler.moduleName]: {
        fullWidth: true,
        dragResize: true,
      },
      imageResize: {
        parchment: Quill.import('parchment'),
        modules: ['Resize', 'DisplaySize', 'Toolbar'],
      },
      clipboard: { matchVisual: false },
    }),
    [isSpanish]
  );

  const formats = [
    'header', 'bold', 'italic', 'underline', 'strike', 'script',
    'list', 'bullet', 'indent', 'align',
    'blockquote', 'code-block', 'link', 'image', 'video', 'formula',
    'color', 'background', 'font', 'size',
    // formatos del módulo de tablas
    'table', 'table-cell', 'table-row', 'table-body', 'table-container',
    'table-col', 'table-col-group', 'td', 'tr', 'th',
  ];

  // ---------- Encode body ----------
  const encodeBody = (html) => {
    try {
      if (!html?.trim()) return '';
      const cleaned = sanitizeInput(html);
      const temp = document.createElement('div');
      temp.innerHTML = cleaned;

      temp.querySelectorAll('img').forEach((img) => {
        let style = 'max-width:100%;height:auto;margin:1.5rem 0;display:block;';
        if (img.style.width) style += `width:${img.style.width};`;
        if (img.style.height) style += `height:${img.style.height};`;
        img.setAttribute('style', style);
        img.setAttribute('loading', 'lazy');
        if (!img.alt) img.alt = 'Imagen del artículo';
      });

      temp.querySelectorAll('iframe.ql-video, .ql-video').forEach((iframe) => {
        iframe.style.width = '100%';
        iframe.style.aspectRatio = '16/9';
        iframe.style.maxWidth = '100%';
        iframe.style.margin = '1.5rem 0';
        iframe.style.border = 'none';
        iframe.style.borderRadius = '8px';
      });

      temp.querySelectorAll('table').forEach((table) => {
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
        table.style.margin = '1.5rem 0';
        table.style.tableLayout = 'fixed';
        table.querySelectorAll('td, th').forEach((cell) => {
          cell.style.border = '1px solid #d1d5db';
          cell.style.padding = '10px 12px';
          cell.style.verticalAlign = 'top';
          cell.style.wordBreak = 'break-word';
        });
      });

      temp.querySelectorAll('.ql-formula').forEach((f) => {
        f.style.display = 'inline-block';
        f.style.margin = '0 3px';
      });

      return base64EncodeUnicode(`<div class="article">${temp.innerHTML}</div>`);
    } catch (err) {
      console.error(err);
      return base64EncodeUnicode(html);
    }
  };

  // ---------- Tags ----------
  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput('');
    }
  };

  const removeTag = (i) => setTags(tags.filter((_, idx) => idx !== i));

  // ---------- Portada ----------
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setStatus({ type: 'error', msg: isSpanish ? 'Máximo 5 MB' : 'Max 5 MB' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  // ---------- Insertar imagen ----------
  const handleImageSubmit = () => {
    const editor = activeEditorRef.current === 'es' ? editorEsRef.current : editorEnRef.current;
    if (!editor || !imageData.url) return;
    let { url, width, height, align } = imageData;
    if (width && !/%|px$/.test(width)) width += 'px';
    if (height && !/%|px$/.test(height)) height += 'px';

    const range = editor.getSelection(true) || { index: editor.getLength() };
    editor.insertEmbed(range.index, 'image', url, 'user');
    const [leaf] = editor.getLeaf(range.index);
    if (leaf?.domNode) {
      if (width) leaf.domNode.style.width = width;
      if (height) leaf.domNode.style.height = height;
    }
    editor.setSelection(range.index, 1);
    if (align) editor.format('align', align);
    editor.setSelection(range.index + 1);
    setShowImageModal(false);
  };

  // ---------- Insertar video ----------
  const handleVideoSubmit = () => {
    const editor = activeEditorRef.current === 'es' ? editorEsRef.current : editorEnRef.current;
    if (!editor || !videoUrl.trim()) return;
    const embed = toYoutubeEmbed(videoUrl.trim());
    const range = editor.getSelection(true) || { index: editor.getLength() };
    editor.insertEmbed(range.index, 'video', embed, 'user');
    editor.setSelection(range.index + 1);
    setShowVideoModal(false);
    setVideoUrl('');
  };

  // ---------- Submit ----------
  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user) {
      setStatus({ type: 'error', msg: isSpanish ? 'No autenticado' : 'Not authenticated' });
      return;
    }
    if (!titleEs.trim() && !titleEn.trim()) {
      setStatus({ type: 'error', msg: isSpanish ? 'Se requiere al menos un título' : 'At least one title required' });
      return;
    }
    if (!bodyEs.trim() && !bodyEn.trim()) {
      setStatus({ type: 'error', msg: isSpanish ? 'Se requiere al menos un cuerpo' : 'At least one body required' });
      return;
    }
    if (!author.trim()) {
      setStatus({ type: 'error', msg: isSpanish ? 'El autor es requerido' : 'Author required' });
      return;
    }
    if (!areaId) {
      setStatus({ type: 'error', msg: isSpanish ? 'Selecciona el área' : 'Select the area' });
      return;
    }

    setIsLoading(true);
    setStatus({ type: 'info', msg: isSpanish ? 'Procesando...' : 'Processing...' });

    try {
      const token = await user.getIdToken();
      const data = {
        title_es: titleEs ? sanitizeInput(titleEs) : null,
        title_en: titleEn ? sanitizeInput(titleEn) : null,
        body_es: bodyEs ? encodeBody(bodyEs) : null,
        body_en: bodyEn ? encodeBody(bodyEn) : null,
        author: sanitizeInput(author),
        area_id: areaId,
        category,
        tags: tags.map(sanitizeInput),
        photo: photo || null,
        featured,
      };

      const res = await fetch(NEWS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Error');
      }

      const result = await res.json();
      setStatus({
        type: 'success',
        msg: isSpanish
          ? `¡Publicado con éxito! Año: ${result.year}`
          : `Published successfully! Year: ${result.year}`,
      });

      setTitleEs('');
      setTitleEn('');
      setBodyEs('');
      setBodyEn('');
      setPhoto('');
      setTags([]);
      setAreaId('');
      setCategory('general');
      setFeatured(false);
      editorEsRef.current?.setText('');
      editorEnRef.current?.setText('');
      clearDraft();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', msg: e.message || (isSpanish ? 'Error al publicar' : 'Publish error') });
    } finally {
      setIsLoading(false);
    }
  };

  // ---------- Render ----------
  return (
    <div className="w-full bg-white text-[#222] min-h-screen pb-24">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=PT+Serif:ital,wght@0,400;0,700;1,400&family=Roboto:wght@300;400;500;700&display=swap');

        .font-serif-nature { font-family: 'PT Serif', Georgia, serif; }
        .font-sans-nature { font-family: 'Roboto', Arial, sans-serif; }

        /* Toolbar */
        .editorial-editor-wrapper .ql-toolbar.ql-snow {
          border: none;
          border-bottom: 1px solid #e5e7eb;
          padding: 10px 16px;
          background: #fafafa;
          font-family: 'Roboto', sans-serif;
          flex-wrap: wrap;
          gap: 2px;
        }
        .editorial-editor-wrapper .ql-container.ql-snow {
          border: none;
          background: #fff;
          min-height: 420px;
          font-family: 'PT Serif', Georgia, serif;
        }
        .editorial-editor-wrapper .ql-editor {
          padding: 36px 44px;
          font-size: 16px;
          line-height: 1.75;
          color: #333;
          min-height: 420px;
          overflow-x: auto;
        }
        .editorial-editor-wrapper .ql-editor p {
          margin-bottom: 0.9rem;
          line-height: 1.65;
          color: #444;
        }
        .editorial-editor-wrapper .ql-editor h1,
        .editorial-editor-wrapper .ql-editor h2,
        .editorial-editor-wrapper .ql-editor h3,
        .editorial-editor-wrapper .ql-editor h4,
        .editorial-editor-wrapper .ql-editor h5,
        .editorial-editor-wrapper .ql-editor h6 {
          font-family: 'Roboto', sans-serif;
          font-weight: 700;
          color: #111;
          margin-top: 1.75rem;
          margin-bottom: 0.75rem;
        }
        .editorial-editor-wrapper .ql-editor blockquote {
          border-left: 3px solid #ea580c;
          padding-left: 18px;
          margin: 1.5rem 0;
          font-style: italic;
          color: #555;
        }
        .editorial-editor-wrapper .ql-editor img {
          max-width: 100%;
          height: auto;
          margin: 1.25rem 0;
          border-radius: 4px;
        }

        /* ===== TABLAS (clave para que se vean bien) ===== */
        .editorial-editor-wrapper .ql-editor table,
        .editorial-editor-wrapper .ql-editor .ql-table,
        .editorial-editor-wrapper .ql-editor .ql-table-wrapper table {
          border-collapse: collapse !important;
          width: 100% !important;
          max-width: 100% !important;
          margin: 1.5rem 0 !important;
          table-layout: fixed !important;
          display: table !important;
        }
        .editorial-editor-wrapper .ql-editor .ql-table-wrapper {
          overflow-x: auto !important;
          max-width: 100% !important;
          margin: 1.5rem 0 !important;
          display: block !important;
        }
        .editorial-editor-wrapper .ql-editor td,
        .editorial-editor-wrapper .ql-editor th {
          border: 1px solid #d1d5db !important;
          padding: 10px 12px !important;
          vertical-align: top !important;
          word-break: break-word !important;
          min-width: 48px !important;
          background: #fff !important;
          position: relative !important;
        }
        .editorial-editor-wrapper .ql-editor th {
          background: #f3f4f6 !important;
          font-weight: 600 !important;
        }
        /* Contener herramientas flotantes del módulo de tablas */
        .editorial-editor-wrapper .ql-editor .ql-table-selection,
        .editorial-editor-wrapper .ql-editor .ql-table-operate-line,
        .editorial-editor-wrapper .ql-table-tool {
          max-width: 100% !important;
        }
        .editorial-editor-wrapper {
          position: relative;
          overflow: hidden;
        }

        /* Videos embebidos */
        .editorial-editor-wrapper .ql-editor iframe.ql-video,
        .editorial-editor-wrapper .ql-editor .ql-video {
          width: 100% !important;
          max-width: 100% !important;
          aspect-ratio: 16 / 9;
          height: auto !important;
          min-height: 280px;
          margin: 1.5rem 0 !important;
          border: none !important;
          border-radius: 8px;
          display: block;
        }

        .editorial-editor-wrapper .ql-editor .ql-formula {
          display: inline-block;
          margin: 0 3px;
        }

        .editorial-editor-wrapper .ql-editor ol,
        .editorial-editor-wrapper .ql-editor ul {
          margin: 0.75rem 0;
          padding-left: 1.75rem;
        }

        .ql-snow .ql-stroke { stroke: #555 !important; stroke-width: 1.4px; }
        .ql-snow .ql-fill { fill: #555 !important; }
        .ql-snow .ql-picker { color: #555 !important; }
        .ql-snow .ql-active .ql-stroke,
        .ql-snow button:hover .ql-stroke { stroke: #111 !important; }
        .ql-snow .ql-active .ql-fill,
        .ql-snow button:hover .ql-fill { fill: #111 !important; }

        @media (max-width: 768px) {
          .editorial-editor-wrapper .ql-editor {
            padding: 22px 16px;
            font-size: 15px;
          }
          .editorial-editor-wrapper .ql-toolbar.ql-snow {
            padding: 8px 10px;
          }
        }
      `,
        }}
      />

      <div className="max-w-[1280px] mx-auto px-4 md:px-8 pt-8">
        {/* Header */}
        <div className="border-b-2 border-gray-800 pb-4 mb-8">
          <h1 className="text-4xl md:text-5xl font-serif-nature font-bold text-black mb-2">
            {isSpanish ? 'Envío de Artículos' : 'Article Submission'}
          </h1>
          <p className="text-sm font-sans-nature text-gray-600">
            {isSpanish
              ? 'Sistema editorial bilingüe para investigación y noticias científicas'
              : 'Bilingual editorial system for research and scientific news'}
          </p>
        </div>

        {/* Aviso */}
        <AnimatePresence>
          {showWarning && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
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
                    ? 'Se recomienda redactar el cuerpo en un procesador externo (Word, LaTeX o Docs) antes de pegarlo aquí, para asegurar respaldo.'
                    : 'Draft the body in an external processor before pasting here to ensure backup.'}
                </p>
                <button
                  onClick={() => setShowWarning(false)}
                  className="mt-3 text-xs font-bold text-gray-900 uppercase tracking-widest hover:text-gray-600 font-sans-nature"
                >
                  {isSpanish ? 'Ocultar aviso' : 'Dismiss'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status */}
        {status.msg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`p-4 flex items-center gap-3 border-l-4 mb-8 font-sans-nature ${
              status.type === 'error'
                ? 'bg-red-50 border-red-500 text-red-900'
                : status.type === 'success'
                ? 'bg-green-50 border-green-500 text-green-900'
                : 'bg-blue-50 border-blue-500 text-blue-900'
            }`}
          >
            {status.type === 'error' && <XCircleIcon className="w-5 h-5 flex-shrink-0" />}
            {status.type === 'success' && <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />}
            {status.type === 'info' && <InformationCircleIcon className="w-5 h-5 flex-shrink-0" />}
            <span className="text-sm font-medium">{status.msg}</span>
          </motion.div>
        )}

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
                  className="w-full px-4 py-2.5 border border-gray-300 focus:border-black outline-none text-base font-serif-nature bg-white"
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
                  className="w-full px-4 py-2.5 border border-gray-300 focus:border-black outline-none text-base font-serif-nature bg-white cursor-pointer"
                >
                  <option value="">{isSpanish ? 'Seleccionar disciplina...' : 'Select discipline...'}</option>
                  {AREAS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {isSpanish ? a.labelEs : a.labelEn}
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
                  rows={2}
                  value={titleEs}
                  onChange={(e) => setTitleEs(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 focus:border-black outline-none resize-none text-2xl font-serif-nature font-bold bg-white"
                  placeholder={isSpanish ? 'Título del manuscrito...' : 'Manuscript title...'}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans-nature">
                  {isSpanish ? 'Título Secundario (EN)' : 'Secondary Title (EN)'}
                </label>
                <textarea
                  rows={2}
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 focus:border-black outline-none resize-none text-xl font-serif-nature bg-white"
                  placeholder={isSpanish ? 'Traducción al inglés (opcional)...' : 'English translation (optional)...'}
                />
              </div>
            </div>
          </section>

          {/* Cuerpo */}
          <section className="border-b border-gray-300 pb-8">
            <h2 className="text-xl font-serif-nature font-bold text-black mb-6">
              {isSpanish ? 'Cuerpo del Documento' : 'Document Body'}
            </h2>

            <div className="mb-8">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans-nature">
                {isSpanish ? 'Contenido en Español' : 'Spanish Content'}
              </label>
              <div className="editorial-editor-wrapper border border-gray-300 bg-white rounded-sm shadow-sm">
                <ReactQuill
                  ref={(ref) => {
                    quillEsRef.current = ref;
                    editorEsRef.current = ref?.getEditor() || null;
                  }}
                  theme="snow"
                  value={bodyEs}
                  onChange={setBodyEs}
                  modules={modules}
                  formats={formats}
                  placeholder={isSpanish ? 'Escriba el contenido en español...' : 'Write Spanish content...'}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans-nature">
                {isSpanish ? 'Contenido en Inglés' : 'English Content'}
              </label>
              <div className="editorial-editor-wrapper border border-gray-300 bg-white rounded-sm shadow-sm">
                <ReactQuill
                  ref={(ref) => {
                    quillEnRef.current = ref;
                    editorEnRef.current = ref?.getEditor() || null;
                  }}
                  theme="snow"
                  value={bodyEn}
                  onChange={setBodyEn}
                  modules={modules}
                  formats={formats}
                  placeholder={isSpanish ? 'Escriba el contenido en inglés...' : 'Write English content...'}
                />
              </div>
            </div>
          </section>

          {/* Portada + Taxonomía */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-gray-300 pb-8">
            <div>
              <h2 className="text-xl font-serif-nature font-bold text-black mb-6 flex items-center gap-2">
                <PhotoIcon className="w-5 h-5" />
                {isSpanish ? 'Imagen de Portada' : 'Cover Image'}
              </h2>
              <div className="space-y-4">
                {photo ? (
                  <div className="relative">
                    <img src={photo} alt="Cover" className="w-full h-64 object-cover border border-gray-300" />
                    <button
                      type="button"
                      onClick={() => setPhoto('')}
                      className="absolute top-3 right-3 bg-white/90 p-2 border border-gray-300 hover:bg-red-50"
                    >
                      <XCircleIcon className="w-5 h-5 text-gray-700 hover:text-red-600" />
                    </button>
                  </div>
                ) : (
                  <label className="w-full h-64 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 cursor-pointer">
                    <PhotoIcon className="w-10 h-10 mb-3 text-gray-400" />
                    <span className="text-sm font-bold uppercase tracking-widest text-gray-600 font-sans-nature">
                      {isSpanish ? 'Subir Imagen' : 'Upload Image'}
                    </span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
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
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {isSpanish ? c.labelEs : c.labelEn}
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
                    {tags.map((tag, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-2 bg-gray-100 border border-gray-300 text-gray-800 text-sm px-3 py-1.5 font-serif-nature"
                      >
                        {tag}
                        <button type="button" onClick={() => removeTag(i)} className="hover:text-red-600">
                          <XCircleIcon className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 focus:border-black outline-none text-base font-serif-nature bg-white"
                    placeholder={isSpanish ? 'ENTER para añadir' : 'Press ENTER to add'}
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
                  <label htmlFor="featured" className="text-sm text-gray-800 cursor-pointer font-serif-nature">
                    {isSpanish ? 'Destacar en portada' : 'Feature on front page'}
                  </label>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="pt-8 flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className={`px-10 py-3.5 text-white font-sans-nature font-bold uppercase tracking-wider text-sm transition-all ${
              isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800 active:scale-[0.98]'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                {isSpanish ? 'Procesando...' : 'Processing...'}
              </span>
            ) : isSpanish ? (
              'Enviar Artículo'
            ) : (
              'Submit Article'
            )}
          </button>
        </div>
      </div>

      {/* Modal Imagen */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[999] p-6">
          <div className="bg-white shadow-2xl max-w-md w-full border border-gray-300">
            <div className="p-5 border-b border-gray-200 bg-gray-50">
              <h3 className="font-sans-nature font-bold text-gray-900 uppercase tracking-widest text-sm">
                {isSpanish ? 'Insertar Imagen' : 'Insert Image'}
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans-nature">
                  URL
                </label>
                <input
                  type="text"
                  value={imageData.url}
                  onChange={(e) => setImageData({ ...imageData, url: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 focus:border-black outline-none text-base"
                  placeholder="https://..."
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans-nature">
                    {isSpanish ? 'Ancho' : 'Width'}
                  </label>
                  <input
                    type="text"
                    placeholder="100% o 400px"
                    value={imageData.width}
                    onChange={(e) => setImageData({ ...imageData, width: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 focus:border-black outline-none text-base"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 font-sans-nature">
                    {isSpanish ? 'Alto' : 'Height'}
                  </label>
                  <input
                    type="text"
                    placeholder="auto"
                    value={imageData.height}
                    onChange={(e) => setImageData({ ...imageData, height: e.target.value })}
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
                  onChange={(e) => setImageData({ ...imageData, align: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 focus:border-black outline-none text-base cursor-pointer"
                >
                  <option value="left">{isSpanish ? 'Izquierda' : 'Left'}</option>
                  <option value="center">{isSpanish ? 'Centro' : 'Center'}</option>
                  <option value="right">{isSpanish ? 'Derecha' : 'Right'}</option>
                  <option value="justify">{isSpanish ? 'Ancho completo' : 'Full width'}</option>
                </select>
              </div>
            </div>
            <div className="p-5 bg-gray-50 flex justify-end gap-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="font-sans-nature font-bold text-gray-600 hover:text-gray-900 uppercase tracking-wider text-sm"
              >
                {isSpanish ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleImageSubmit}
                className="px-8 py-2.5 bg-black text-white font-sans-nature font-bold hover:bg-gray-800 uppercase tracking-wider text-sm"
              >
                {isSpanish ? 'Insertar' : 'Insert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Video (YouTube / Vimeo / MP4) */}
      {showVideoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[999] p-6">
          <div className="bg-white shadow-2xl max-w-md w-full border border-gray-300">
            <div className="p-5 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
              <PlayCircleIcon className="w-5 h-5 text-gray-700" />
              <h3 className="font-sans-nature font-bold text-gray-900 uppercase tracking-widest text-sm">
                {isSpanish ? 'Insertar Video' : 'Insert Video'}
              </h3>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-600 font-serif-nature">
                {isSpanish
                  ? 'Pega una URL de YouTube, Vimeo o un enlace directo a un MP4.'
                  : 'Paste a YouTube, Vimeo or direct MP4 URL.'}
              </p>
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 focus:border-black outline-none text-base"
                placeholder="https://www.youtube.com/watch?v=..."
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleVideoSubmit()}
              />
            </div>
            <div className="p-5 bg-gray-50 flex justify-end gap-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowVideoModal(false)}
                className="font-sans-nature font-bold text-gray-600 hover:text-gray-900 uppercase tracking-wider text-sm"
              >
                {isSpanish ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleVideoSubmit}
                className="px-8 py-2.5 bg-black text-white font-sans-nature font-bold hover:bg-gray-800 uppercase tracking-wider text-sm"
              >
                {isSpanish ? 'Insertar' : 'Insert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}