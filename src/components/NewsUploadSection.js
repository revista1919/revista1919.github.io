import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import ImageResize from 'quill-image-resize-module-react';
import { auth } from '../firebase';
import { debounce } from 'lodash';

// Registrar el módulo de resize
Quill.register('modules/imageResize', ImageResize);

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
  // Mantenemos etiquetas estructurales pero eliminamos scripts y eventos maliciosos
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
               .replace(/on\w+="[^"]*"/gi, '')
               .replace(/\s+/g, ' ')
               .trim();
};

export default function NewsUploadSection() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState(''); // ✅ Sincrónico para evitar saltos de cursor
  const [photo, setPhoto] = useState('');
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  const quillRef = useRef(null);
  const editorRef = useRef(null);

  const [showImageModal, setShowImageModal] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [imageData, setImageData] = useState({ url: '', width: '', height: '', align: 'left' });
  const [editingRange, setEditingRange] = useState(null);

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
    return () => debouncedSaveDraft.cancel(); // ✅ Prevención de memory leak
  }, [debouncedSaveDraft]);

  const clearDraft = () => localStorage.removeItem('newsDraftES');

  // --- CONFIGURACIÓN DE BARRA DE HERRAMIENTAS Y MÓDULOS ---
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [2, 3, false] }], // ✅ Soporte para títulos H2 y H3
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['link', 'image', 'blockquote'],
        [{ 'align': ['', 'center', 'right', 'justify'] }],
        ['clean']
      ],
      handlers: {
        image: function() {
          setIsEditingImage(false);
          setImageData({ url: '', width: '', height: '', align: 'left' });
          setEditingRange(null);
          setShowImageModal(true);
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
            let deleteLength = range.length || 1; // ✅ Borrado corregido

            if (range.length === 0) {
              if (this.key === 'Backspace') {
                const [prevLeaf] = editor.getLeaf(range.index - 1);
                if (prevLeaf?.domNode?.tagName === 'IMG') { isImage = true; deleteIndex = range.index - 1; }
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

  // --- INYECCIÓN DE BOTONES CUSTOM EN EL RESIZE ---
  useEffect(() => {
    if (!quillRef.current) return;
    const editor = quillRef.current.getEditor();
    editorRef.current = editor;
    
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
                align: formats.align || 'left'
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

  // --- PROCESAMIENTO EDITORIAL (ESTILOS ARTICLE) ---
  const encodeBody = (html) => {
    try {
      if (!html || html.trim() === '') return '';
      let cleanedHtml = sanitizeInput(html);
    
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cleanedHtml;

      // ✅ Procesamiento de Imágenes con estilos embebidos y alineación real
      const images = tempDiv.querySelectorAll('img');
      images.forEach((img) => {
        let align = 'left';
        const blot = Quill.find(img); // ✅ API correcta
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

      // ✅ Envolver en estructura de artículo
      const finalHtml = `
  <div class="article">
    ${tempDiv.innerHTML}
  </div>
`;


      return base64EncodeUnicode(finalHtml);
    } catch (err) {
      return base64EncodeUnicode(html);
    }
  };

  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user) return setStatus({ type: 'error', msg: 'No autenticado' });
    if (!title.trim() || !body.trim()) return setStatus({ type: 'error', msg: 'Título y cuerpo obligatorios' });

    setIsLoading(true);
    setStatus({ type: 'info', msg: 'Subiendo noticia...' });

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

      setStatus({ type: 'success', msg: '¡Publicado con éxito!' });
      setTitle(''); setBody(''); setPhoto('');
      editorRef.current.setText('');
      clearDraft();
    } catch {
      setStatus({ type: 'error', msg: 'Error al publicar' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageModalSubmit = () => {
    const editor = editorRef.current;
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

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 mt-10">
      {/* Header UI */}
      <div className="bg-[#5a3e36] p-10 text-white">
        <h2 className="text-3xl font-black tracking-tight mb-1 uppercase">Editor de Artículos</h2>
        <p className="text-sm opacity-60 font-medium">Formato editorial profesional habilitado</p>
      </div>

      <div className="p-10 space-y-10">
        {/* Título */}
        <div className="space-y-2">
          <label className="text-xs font-black text-[#5a3e36] uppercase tracking-widest ml-1">Título de la noticia</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-8 py-5 text-2xl font-bold border-2 border-gray-50 rounded-2xl focus:border-[#5a3e36] bg-gray-50/50 outline-none transition-all placeholder-gray-300"
            placeholder="Introduce el título..."
          />
        </div>

        {/* URL Portada */}
        <div className="space-y-2">
          <label className="text-xs font-black text-[#5a3e36] uppercase tracking-widest ml-1">URL Foto de Portada</label>
          <input
            type="text"
            value={photo}
            onChange={(e) => setPhoto(e.target.value)}
            className="w-full px-8 py-5 border-2 border-gray-50 rounded-2xl focus:border-[#5a3e36] bg-gray-50/50 outline-none transition-all"
            placeholder="Enlace de la imagen principal..."
          />
        </div>

        {/* Editor Quill */}
        <div className="space-y-2">
          <label className="text-xs font-black text-[#5a3e36] uppercase tracking-widest ml-1">Cuerpo del Artículo</label>
          <div className="rounded-2xl border-2 border-gray-50 focus-within:border-[#5a3e36] overflow-hidden transition-all bg-gray-50/30">
            <ReactQuill
              ref={quillRef}
              value={body}
              onChange={setBody}
              modules={modules}
              className="editorial-quill"
              placeholder="Escribe tu historia aquí..."
            />
          </div>
        </div>

        {/* Publicar */}
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className={`w-full py-6 text-white font-black rounded-2xl transition-all shadow-xl text-lg tracking-widest ${
            isLoading ? 'bg-gray-400' : 'bg-[#5a3e36] hover:bg-[#462f29] active:scale-[0.99]'
          }`}
        >
          {isLoading ? 'SUBIENDO...' : 'PUBLICAR ARTÍCULO'}
        </button>

        {status.msg && (
          <div className={`p-6 rounded-2xl text-center font-bold text-sm ${
            status.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
          }`}>
            {status.msg}
          </div>
        )}
      </div>

      {/* Modal Moderno */}
      {showImageModal && (
        <div className="fixed inset-0 bg-[#5a3e36]/60 backdrop-blur-sm flex justify-center items-center z-[999] p-6">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-gray-50 bg-gray-50/50">
              <h3 className="font-black text-[#5a3e36]">GESTIÓN DE IMAGEN</h3>
            </div>
            <div className="p-8 space-y-6">
              <input type="text" value={imageData.url} onChange={(e)=>setImageData({...imageData, url: e.target.value})} 
                className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-xl focus:border-[#5a3e36] outline-none" placeholder="URL de la imagen" disabled={isEditingImage} />
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Ancho" value={imageData.width} onChange={(e)=>setImageData({...imageData, width: e.target.value})} className="p-4 bg-gray-50 border rounded-xl outline-none" />
                <input type="text" placeholder="Alto" value={imageData.height} onChange={(e)=>setImageData({...imageData, height: e.target.value})} className="p-4 bg-gray-50 border rounded-xl outline-none" />
              </div>
              <select value={imageData.align} onChange={(e)=>setImageData({...imageData, align: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-xl font-bold">
                <option value="left">Izquierda</option>
                <option value="center">Centro</option>
                <option value="right">Derecha</option>
                <option value="justify">Justificado (100%)</option>
              </select>
            </div>
            <div className="p-8 bg-gray-50 flex justify-end gap-4">
              <button onClick={() => setShowImageModal(false)} className="font-bold text-gray-400">CANCELAR</button>
              <button onClick={handleImageModalSubmit} className="px-8 py-3 bg-[#5a3e36] text-white rounded-xl font-black">CONFIRMAR</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
  .editorial-quill .ql-toolbar.ql-snow {
    border: none;
    padding: 25px;
    background: white;
    border-bottom: 2px solid #f8f9fa;
  }

  .editorial-quill .ql-container.ql-snow {
    border: none;
    min-height: 500px;
  }

  .editorial-quill .ql-editor {
    padding: 40px;
  }

  /* ===================================================
     Fallback tipográfico NO destructivo
     solo si la plantilla NO define nada
  =================================================== */

  .editorial-quill .ql-editor {
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    color: inherit;
  }

  .editorial-quill .ql-editor h1,
  .editorial-quill .ql-editor h2,
  .editorial-quill .ql-editor h3,
  .editorial-quill .ql-editor p {
    font-family: inherit;
    font-size: inherit;
    color: inherit;
  }

  /* ===================================================
     ÚNICO estilo editorial propio: blockquote
  =================================================== */

  .editorial-quill .ql-editor blockquote {
    border-left: 4px solid #5a3e36;
    background: #fdfaf9;
    padding: 20px 30px;
    margin: 2rem 0;
  }

  /* ===================================================
     Toolbar
  =================================================== */

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
`}</style>

    </div>
  );
}