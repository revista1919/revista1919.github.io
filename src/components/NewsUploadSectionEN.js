import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import ImageResize from 'quill-image-resize-module-react';
import { auth } from '../firebase';
import { debounce } from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';

// ===================================================
// REGISTRO DE MÓDULOS ADICIONALES
// ===================================================

// Registrar módulos base
Quill.register('modules/imageResize', ImageResize);

// Módulos de matemáticas y fórmulas
import katex from 'katex';
import 'katex/dist/katex.min.css';
window.katex = katex;

// Módulo de video mejorado
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

// Tabla → BlockEmbed (Quill 1.3 no soporta tablas nativas)
const BlockEmbed = Quill.import('blots/block/embed');
class TableEmbedBlot extends BlockEmbed {
  static create(value) {
    const node = super.create();
    node.setAttribute('contenteditable', 'false');
    node.setAttribute('class', 'ql-table-embed');
    const html = typeof value === 'string' ? value : value?.html || '';
    node.innerHTML = html;
    // Celdas editables por dentro
    node.querySelectorAll('td, th').forEach((cell) => {
      cell.setAttribute('contenteditable', 'true');
    });
    return node;
  }

  static value(node) {
    const table = node.querySelector('table');
    return table ? table.outerHTML : node.innerHTML;
  }
}
TableEmbedBlot.blotName = 'tableEmbed';
TableEmbedBlot.tagName = 'div';
TableEmbedBlot.className = 'ql-table-embed';
Quill.register(TableEmbedBlot, true);

// ===================================================
// CONFIGURACIÓN COMPLETA
// ===================================================

const NEWS_SCRIPT_URL = 'https://uploadnews-ggqsq2kkua-uc.a.run.app';

// --- UTILIDADES ---
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

/** Genera HTML de tabla editorial */
function buildEditorialTable(rows, cols, caption = '') {
  const cell =
    'border:1px solid #94a3b8;padding:8px 12px;vertical-align:top;min-width:56px;word-break:break-word;font-size:14px;background:#fff;';
  const head =
    cell + 'background:#f1f5f9;font-weight:600;font-family:Roboto,Arial,sans-serif;';

  let html =
    '<table style="border-collapse:collapse;width:100%;max-width:100%;table-layout:fixed;border:1px solid #94a3b8;margin:0;">';
  
  if (caption?.trim()) {
    const safe = caption.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html += `<caption style="caption-side:top;text-align:left;font:600 13px Roboto,Arial,sans-serif;color:#334155;padding:0 0 8px 0;">${safe}</caption>`;
  }
  
  html += '<tbody>';
  for (let r = 0; r < rows; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) {
      const tag = r === 0 ? 'th' : 'td';
      html += `<${tag} style="${r === 0 ? head : cell}"><br></${tag}>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

/** Limpia tabla pegada (Word / HTML) */
function cleanPastedTable(tableNode) {
  const rows = tableNode.querySelectorAll('tr');
  if (!rows.length) return null;

  const cellStyle =
    'border:1px solid #94a3b8;padding:8px 12px;vertical-align:top;min-width:56px;word-break:break-word;font-size:14px;background:#fff;';
  const headStyle =
    cellStyle + 'background:#f1f5f9;font-weight:600;font-family:Roboto,Arial,sans-serif;';

  let html =
    '<table style="border-collapse:collapse;width:100%;max-width:100%;table-layout:fixed;border:1px solid #94a3b8;margin:0;"><tbody>';

  rows.forEach((tr, ri) => {
    html += '<tr>';
    const cells = tr.querySelectorAll('td, th');
    cells.forEach((cell) => {
      const isHeader = cell.tagName === 'TH' || ri === 0;
      const tag = isHeader ? 'th' : 'td';
      const style = isHeader ? headStyle : cellStyle;
      let text = (cell.innerText || cell.textContent || '').replace(/\r\n/g, '\n').trim();
      const content = text
        ? text
            .split(/\n+/)
            .map((line) => line.replace(/</g, '&lt;').replace(/>/g, '&gt;') || '<br>')
            .join('<br>')
        : '<br>';
      html += `<${tag} style="${style}">${content}</${tag}>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  return html;
}

export default function NewsUploadSection() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState('');
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [isLoading, setIsLoading] = useState(false);

  const quillRef = useRef(null);
  const editorRef = useRef(null);

  const [showImageModal, setShowImageModal] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [imageData, setImageData] = useState({ url: '', width: '280px', height: '', align: 'center' });
  const [editingRange, setEditingRange] = useState(null);

  const [showTableModal, setShowTableModal] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tableCaption, setTableCaption] = useState('');

  // --- PERSISTENCIA Y CLEANUP ---
  useEffect(() => {
    const savedDraft = localStorage.getItem('newsDraftES');
    if (savedDraft) {
      const { title: savedTitle, body: savedBody } = JSON.parse(savedDraft);
      setTitle(savedTitle);
      setBody(savedBody);
    }
  }, []);

  const debouncedSaveDraft = useMemo(() => 
    debounce((t, b) => {
      localStorage.setItem('newsDraftES', JSON.stringify({ title: t, body: b }));
    }, 1000), []);

  useEffect(() => {
    debouncedSaveDraft(title, body);
  }, [title, body, debouncedSaveDraft]);

  useEffect(() => {
    return () => debouncedSaveDraft.cancel();
  }, [debouncedSaveDraft]);

  const clearDraft = () => localStorage.removeItem('newsDraftES');

  // ===================================================
  // CLIPBOARD MATCHERS PARA TABLAS
  // ===================================================
  const attachTableClipboard = (quill) => {
    if (!quill || quill.__tableClipboardOk) return;
    quill.__tableClipboardOk = true;

    const Delta = Quill.import('delta');

    // <table> de Word/Docs/web → un solo embed
    quill.clipboard.addMatcher('TABLE', (node) => {
      const cleaned = cleanPastedTable(node);
      if (!cleaned) return new Delta();
      return new Delta().insert({ tableEmbed: cleaned }).insert('\n');
    });

    // Por si se copia/pega una tabla ya insertada en el editor
    quill.clipboard.addMatcher('DIV.ql-table-embed', (node) => {
      const table = node.querySelector('table');
      const html = table ? table.outerHTML : node.innerHTML;
      if (!html) return new Delta();
      return new Delta().insert({ tableEmbed: html }).insert('\n');
    });
  };

  // ===================================================
  // CONFIGURACIÓN COMPLETA DE TOOLBAR
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
        
        // TABLAS - Botón para crear tabla
        ['table'],
        
        // FORMATOS ESPECIALES
        ['blockquote', 'code-block'],
        ['link', 'image', 'video', 'formula'],
        
        // MATEMÁTICAS
        ['math'],
        
        // LIMPIEZA
        ['clean']
      ],
      handlers: {
        image: function() {
          setIsEditingImage(false);
          setImageData({ url: '', width: '280px', height: '', align: 'center' });
          setEditingRange(null);
          setShowImageModal(true);
        },
        formula: function() {
          const mathText = prompt('Enter LaTeX formula (e.g., E = mc^2):');
          if (mathText) {
            const range = this.quill.getSelection();
            this.quill.insertEmbed(range.index, 'formula', mathText);
          }
        },
        math: function() {
          const mathText = prompt('Enter LaTeX formula:');
          if (mathText) {
            const range = this.quill.getSelection();
            this.quill.insertEmbed(range.index, 'formula', mathText);
          }
        },
        table: function() {
          setTableRows(3);
          setTableCols(3);
          setTableCaption('');
          setShowTableModal(true);
        }
      }
    },
    
    // REDIMENSIONAMIENTO DE IMÁGENES
    imageResize: {
      parchment: Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize', 'Toolbar'],
    },
    
    // CONFIGURACIÓN DE TECLADO
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
  }), []);

  // ===================================================
  // FORMATOS DISPONIBLES
  // ===================================================
  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'script',
    'list', 'bullet', 'indent',
    'align',
    'blockquote', 'code-block',
    'link', 'image', 'video', 'formula',
    'tableEmbed'
  ];

  // --- INYECCIÓN DE BOTONES CUSTOM ---
  useEffect(() => {
    if (!quillRef.current) return;
    const editor = quillRef.current.getEditor();
    editorRef.current = editor;
    
    // Registrar clipboard matchers
    attachTableClipboard(editor);
    
    let attempts = 0;
    const addButtons = () => {
      const imageResize = editor.getModule('imageResize');
      if (imageResize?.toolbar) {
        if (imageResize.toolbar.querySelector('.ql-custom-group')) return;
        const buttonContainer = document.createElement('span');
        buttonContainer.className = 'ql-formats ql-custom-group';
        buttonContainer.style.cssText = "border-left: 1px solid #ccc; margin-left: 8px; padding-left: 8px; display: flex; align-items: center; gap: 4px;";
      
        buttonContainer.innerHTML = `
          <button type="button" class="ql-delete-image" style="color: #ef4444; width: 24px; height: 24px; cursor: pointer;">
            <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
          <button type="button" class="ql-edit-image" style="color: #3b82f6; width: 24px; height: 24px; cursor: pointer;">
            <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
        `;
        imageResize.toolbar.appendChild(buttonContainer);

        buttonContainer.querySelector('.ql-delete-image').onclick = () => {
          const range = editor.getSelection();
          if (range) {
            editor.deleteText(range.index, range.length || 1, Quill.sources.USER);
            imageResize.hide();
          }
        };

        buttonContainer.querySelector('.ql-edit-image').onclick = () => {
          const range = editor.getSelection();
          if (range) {
            const [leaf] = editor.getLeaf(range.index);
            if (leaf?.domNode?.tagName === 'IMG') {
              const img = leaf.domNode;
              const formats = editor.getFormat(range.index, 1);
              setImageData({
                url: img.src,
                width: img.style.width || img.width + 'px',
                height: img.style.height || img.height + 'px',
                align: formats.align || 'center'
              });
              setEditingRange(range);
              setIsEditingImage(true);
              setShowImageModal(true);
            }
          }
        };
      } else if (attempts < 10) {
        attempts++;
        setTimeout(addButtons, 100);
      }
    };
    addButtons();
  }, []);

  // --- PROCESAMIENTO EDITORIAL ---
  const encodeBody = (html) => {
    try {
      if (!html || html.trim() === '') return '';
      let cleanedHtml = sanitizeInput(html);
    
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cleanedHtml;

      // Procesamiento de Imágenes
      const images = tempDiv.querySelectorAll('img');
      images.forEach((img) => {
        let align = 'center';
        const blot = Quill.find(img);
        if (blot && editorRef.current) {
          const imgIndex = editorRef.current.getIndex(blot);
          align = editorRef.current.getFormat(imgIndex, 1).align || 'center';
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
        img.setAttribute('alt', 'News image');
      });

      // Convertir embeds de tabla a HTML real
      tempDiv.querySelectorAll('.ql-table-embed').forEach((wrap) => {
        const table = wrap.querySelector('table');
        if (table) {
          table.style.borderCollapse = 'collapse';
          table.style.width = '100%';
          table.style.margin = '1.5rem 0';
          table.querySelectorAll('td, th').forEach((cell) => {
            cell.style.border = '1px solid #94a3b8';
            cell.style.padding = '8px 12px';
            cell.removeAttribute('contenteditable');
          });
          wrap.replaceWith(table);
        }
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

  const handleTableSubmit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const r = Math.min(20, Math.max(1, parseInt(tableRows, 10) || 3));
    const c = Math.min(10, Math.max(1, parseInt(tableCols, 10) || 3));
    const tableHtml = buildEditorialTable(r, c, tableCaption);

    const range = editor.getSelection(true) || { index: editor.getLength() };
    editor.insertEmbed(range.index, 'tableEmbed', tableHtml, 'user');
    editor.insertText(range.index + 1, '\n', 'user');
    editor.setSelection(range.index + 2);
    setShowTableModal(false);
    setTableCaption('');
  };

  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user) return setStatus({ type: 'error', msg: 'Not authenticated' });
    if (!title.trim() || !body.trim()) return setStatus({ type: 'error', msg: 'Title and body are required' });

    setIsLoading(true);
    setStatus({ type: 'info', msg: 'Uploading news...' });

    try {
      const token = await user.getIdToken();
      const encodedBody = encodeBody(body);
      const data = { title: sanitizeInput(title), body: encodedBody, photo: sanitizeInput(photo) };

      const res = await fetch(NEWS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error();

      setStatus({ type: 'success', msg: 'Published successfully!' });
      setTitle(''); setBody(''); setPhoto('');
      editorRef.current?.setText('');
      clearDraft();
    } catch {
      setStatus({ type: 'error', msg: 'Error publishing' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageModalSubmit = () => {
    const editor = editorRef.current;
    let { url, width, height, align } = imageData;
    if (!url) return;

    if (!width) width = '280px';
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
        leaf.domNode.style.width = width;
        leaf.domNode.style.maxWidth = '100%';
        if (height) leaf.domNode.style.height = height;
      }
      editor.setSelection(range.index + 1, 1);
      editor.format('align', align);
      editor.setSelection(range.index + 2);
    }
    setShowImageModal(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f0ed] via-white to-[#f0ebe8] py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100"
        >
          {/* Header UI */}
          <div className="bg-gradient-to-r from-[#5a3e36] to-[#7a5a50] p-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-20 -translate-x-20"></div>
            <div className="relative">
              <h2 className="text-4xl font-black tracking-tight mb-2 uppercase">Article Editor</h2>
              <p className="text-sm opacity-80 font-medium">Professional format with tables, mathematics and multimedia</p>
            </div>
          </div>

          <div className="p-8 md:p-10 space-y-8">
            {/* Title */}
            <div className="space-y-3">
              <label className="text-xs font-black text-[#5a3e36] uppercase tracking-widest ml-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-[#5a3e36] rounded-full"></span>
                News Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-6 py-4 text-xl font-bold border-2 border-gray-100 rounded-2xl focus:border-[#5a3e36] bg-gray-50/50 outline-none transition-all placeholder-gray-300 hover:border-gray-200"
                placeholder="Enter the title..."
              />
            </div>

            {/* Cover Photo URL */}
            <div className="space-y-3">
              <label className="text-xs font-black text-[#5a3e36] uppercase tracking-widest ml-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-[#5a3e36] rounded-full"></span>
                Cover Photo URL
              </label>
              <input
                type="text"
                value={photo}
                onChange={(e) => setPhoto(e.target.value)}
                className="w-full px-6 py-4 border-2 border-gray-100 rounded-2xl focus:border-[#5a3e36] bg-gray-50/50 outline-none transition-all placeholder-gray-400 hover:border-gray-200"
                placeholder="https://example.com/main-image.jpg"
              />
            </div>

            {/* Quill Editor */}
            <div className="space-y-3">
              <label className="text-xs font-black text-[#5a3e36] uppercase tracking-widest ml-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-[#5a3e36] rounded-full"></span>
                Article Body
              </label>
              <div className="rounded-2xl border-2 border-gray-100 focus-within:border-[#5a3e36] overflow-hidden transition-all bg-white shadow-inner">
                <ReactQuill
                  ref={(ref) => {
                    quillRef.current = ref;
                    if (ref) {
                      const editor = ref.getEditor();
                      if (editor) {
                        editorRef.current = editor;
                        attachTableClipboard(editor);
                      }
                    }
                  }}
                  value={body}
                  onChange={setBody}
                  modules={modules}
                  formats={formats}
                  className="editorial-quill"
                  placeholder="Write your story here... (you can use tables, math formulas, videos, etc.)"
                />
              </div>
            </div>

            {/* Publish Button */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              disabled={isLoading}
              className={`w-full py-5 text-white font-black rounded-2xl transition-all shadow-xl text-lg tracking-widest ${
                isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-[#5a3e36] to-[#7a5a50] hover:shadow-2xl'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  UPLOADING...
                </span>
              ) : (
                'PUBLISH ARTICLE'
              )}
            </motion.button>

            {/* Status */}
            <AnimatePresence>
              {status.msg && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`p-5 rounded-2xl text-center font-bold text-sm flex items-center justify-center gap-2 ${
                    status.type === 'error' ? 'bg-red-50 text-red-600' : 
                    status.type === 'success' ? 'bg-green-50 text-green-600' : 
                    'bg-blue-50 text-blue-600'
                  }`}
                >
                  {status.type === 'info' && (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  )}
                  {status.msg}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Image Modal */}
      <AnimatePresence>
        {showImageModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[999] p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <h3 className="font-black text-[#5a3e36] text-lg">IMAGE MANAGEMENT</h3>
                <p className="text-xs text-gray-500 mt-1">Configure image properties</p>
              </div>
              <div className="p-8 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2">IMAGE URL</label>
                  <input 
                    type="text" 
                    value={imageData.url} 
                    onChange={(e)=>setImageData({...imageData, url: e.target.value})} 
                    className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-xl focus:border-[#5a3e36] outline-none transition-all" 
                    placeholder="https://example.com/image.jpg" 
                    disabled={isEditingImage} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-2">WIDTH</label>
                    <input 
                      type="text" 
                      placeholder="280px" 
                      value={imageData.width} 
                      onChange={(e)=>setImageData({...imageData, width: e.target.value})} 
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-xl focus:border-[#5a3e36] outline-none transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-2">HEIGHT</label>
                    <input 
                      type="text" 
                      placeholder="auto" 
                      value={imageData.height} 
                      onChange={(e)=>setImageData({...imageData, height: e.target.value})} 
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-xl focus:border-[#5a3e36] outline-none transition-all" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2">ALIGNMENT</label>
                  <select 
                    value={imageData.align} 
                    onChange={(e)=>setImageData({...imageData, align: e.target.value})} 
                    className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-xl focus:border-[#5a3e36] outline-none font-bold transition-all"
                  >
                    <option value="center">Center (standalone image)</option>
                    <option value="left">Left (text wraps around)</option>
                    <option value="right">Right (text wraps around)</option>
                    <option value="justify">Full width</option>
                  </select>
                </div>
              </div>
              <div className="p-6 bg-gray-50 flex justify-end gap-3">
                <button 
                  onClick={() => setShowImageModal(false)} 
                  className="px-6 py-3 font-bold text-gray-500 hover:text-gray-700 transition-colors"
                >
                  CANCEL
                </button>
                <button 
                  onClick={handleImageModalSubmit} 
                  className="px-8 py-3 bg-gradient-to-r from-[#5a3e36] to-[#7a5a50] text-white rounded-xl font-black hover:shadow-lg transition-all"
                >
                  CONFIRM
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table Modal */}
      <AnimatePresence>
        {showTableModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[999] p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <h3 className="font-black text-[#5a3e36] text-lg">INSERT TABLE</h3>
                <p className="text-xs text-gray-500 mt-1">First row as header</p>
              </div>
              <div className="p-8 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-2">ROWS</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={tableRows}
                      onChange={(e) => setTableRows(e.target.value)}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-xl focus:border-[#5a3e36] outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-2">COLUMNS</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={tableCols}
                      onChange={(e) => setTableCols(e.target.value)}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-xl focus:border-[#5a3e36] outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2">TABLE NAME / CAPTION (OPTIONAL)</label>
                  <input
                    type="text"
                    value={tableCaption}
                    onChange={(e) => setTableCaption(e.target.value)}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-xl focus:border-[#5a3e36] outline-none transition-all"
                    placeholder="e.g., Table 1. Results..."
                  />
                </div>
                {/* Mini Preview */}
                <div className="border border-gray-200 p-4 bg-gray-50 rounded-xl">
                  <div
                    className="grid gap-px bg-slate-300 rounded-lg overflow-hidden"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min(10, Math.max(1, parseInt(tableCols, 10) || 3))}, 1fr)`,
                    }}
                  >
                    {Array.from({
                      length:
                        Math.min(20, Math.max(1, parseInt(tableRows, 10) || 3)) *
                        Math.min(10, Math.max(1, parseInt(tableCols, 10) || 3)),
                    }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-4 ${i < (parseInt(tableCols, 10) || 3) ? 'bg-[#5a3e36]' : 'bg-white'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-6 bg-gray-50 flex justify-end gap-3">
                <button 
                  onClick={() => setShowTableModal(false)} 
                  className="px-6 py-3 font-bold text-gray-500 hover:text-gray-700 transition-colors"
                >
                  CANCEL
                </button>
                <button 
                  onClick={handleTableSubmit} 
                  className="px-8 py-3 bg-gradient-to-r from-[#5a3e36] to-[#7a5a50] text-white rounded-xl font-black hover:shadow-lg transition-all"
                >
                  INSERT
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        * {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .editorial-quill .ql-toolbar.ql-snow {
          border: none;
          padding: 20px;
          background: linear-gradient(to bottom, #fafafa, white);
          border-bottom: 2px solid #f0f0f0;
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
          color: #2d3748;
        }

        /* Table styles */
        .editorial-quill .ql-editor .ql-table-embed {
          display: block;
          width: 100%;
          max-width: 100%;
          margin: 1.25rem 0;
          overflow-x: auto;
        }

        .editorial-quill .ql-editor .ql-table-embed table {
          border-collapse: collapse !important;
          width: 100% !important;
          table-layout: fixed !important;
          border: 1px solid #94a3b8 !important;
        }

        .editorial-quill .ql-editor .ql-table-embed td,
        .editorial-quill .ql-editor .ql-table-embed th {
          border: 1px solid #94a3b8 !important;
          padding: 8px 12px !important;
          vertical-align: top !important;
          background: #fff !important;
        }

        .editorial-quill .ql-editor .ql-table-embed th {
          background: #f1f5f9 !important;
          font-weight: 600 !important;
        }

        .editorial-quill .ql-editor .ql-table-embed caption {
          caption-side: top !important;
          text-align: left !important;
          font-family: 'Inter', sans-serif !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          color: #334155 !important;
          padding: 0 0 8px 0 !important;
        }

        .editorial-quill .ql-editor .ql-table-embed td[contenteditable="true"],
        .editorial-quill .ql-editor .ql-table-embed th[contenteditable="true"] {
          outline: none;
          min-height: 1.4em;
        }

        .editorial-quill .ql-editor .ql-table-embed td[contenteditable="true"]:focus,
        .editorial-quill .ql-editor .ql-table-embed th[contenteditable="true"]:focus {
          background: #f8fafc !important;
          box-shadow: inset 0 0 0 2px #94a3b8;
        }

        /* Video styles */
        .editorial-quill .ql-editor video {
          max-width: 100%;
          border-radius: 8px;
          margin: 2rem 0;
        }

        /* Image styles */
        .editorial-quill .ql-editor img {
          max-width: 280px;
          width: auto;
          height: auto;
          margin: 0.75rem 0;
          border-radius: 4px;
          display: inline-block;
          vertical-align: middle;
        }

        /* Math formula styles */
        .editorial-quill .ql-editor .ql-formula {
          display: inline-block;
          margin: 0 4px;
        }

        /* Blockquote */
        .editorial-quill .ql-editor blockquote {
          border-left: 4px solid #5a3e36;
          background: #fdfaf9;
          padding: 20px 30px;
          margin: 2rem 0;
          font-style: italic;
          color: #4a5568;
        }

        /* Code block */
        .editorial-quill .ql-editor pre {
          background: #2d3748;
          color: #e2e8f0;
          padding: 20px;
          border-radius: 12px;
          overflow-x: auto;
          font-family: 'Courier New', monospace;
          margin: 2rem 0;
        }

        /* Toolbar styling */
        .ql-snow .ql-stroke {
          stroke: #5a3e36 !important;
          stroke-width: 2px;
        }

        .ql-snow .ql-fill {
          fill: #5a3e36 !important;
        }

        .ql-snow .ql-picker {
          color: #5a3e36 !important;
          font-weight: bold;
        }

        .ql-snow .ql-picker-options {
          border-color: #5a3e36 !important;
        }

        /* Table button icon */
        .ql-snow .ql-toolbar button.ql-table::before,
        .ql-toolbar.ql-snow button.ql-table::before {
          content: "⊞";
          font-size: 15px;
          line-height: 1;
          color: #5a3e36;
        }

        .ql-snow .ql-toolbar button.ql-table:hover::before {
          color: #462f29;
        }

        /* Hover effects */
        .ql-snow .ql-picker:hover .ql-picker-label,
        .ql-snow .ql-picker:hover .ql-picker-label svg {
          color: #462f29 !important;
          stroke: #462f29 !important;
        }

        .ql-snow .ql-active .ql-stroke {
          stroke: #462f29 !important;
        }

        .ql-snow .ql-active .ql-fill {
          fill: #462f29 !important;
        }

        /* Responsive */
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