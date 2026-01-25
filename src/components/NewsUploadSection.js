import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import ImageResize from 'quill-image-resize-module-react';
import { debounce } from 'lodash';
// Registrar el módulo de resize
Quill.register('modules/imageResize', ImageResize);
const NEWS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxLlge7jy7WPz5z6NQ0n4v6Q5-7V3y-U1RYall6k1NNlS6kzY1cgiS-iQSWWBVG-ZoCHg/exec';
// --- LÓGICA DE NEGOCIO (MANTENIDA FIEL A TU REQUERIMIENTO) ---
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
export default function NewsUploadSection() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState('');
  const [status, setStatus] = useState({ type: '', msg: '' }); // Mejor manejo de mensajes
  const [isLoading, setIsLoading] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const quillRef = useRef(null);
  const editorRef = useRef(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [imageData, setImageData] = useState({ url: '', width: '', height: '', align: 'left' });
  const [editingRange, setEditingRange] = useState(null);
  const debouncedSetBody = useCallback(
    debounce((value) => setBody(value), 300),
    []
  );
  // Persistencia local con localStorage
  useEffect(() => {
    const savedDraft = localStorage.getItem('newsDraftES');
    if (savedDraft) {
      const { title: savedTitle, body: savedBody } = JSON.parse(savedDraft);
      setTitle(savedTitle);
      setBody(savedBody);
    }
  }, []);
  const debouncedSaveDraft = useCallback(
    debounce((titleVal, bodyVal) => {
      localStorage.setItem('newsDraftES', JSON.stringify({ title: titleVal, body: bodyVal }));
    }, 500),
    []
  );
  useEffect(() => {
    debouncedSaveDraft(title, body);
  }, [title, body, debouncedSaveDraft]);
  // Limpieza al enviar exitosamente
  const clearDraft = () => {
    localStorage.removeItem('newsDraftES');
  };
  useEffect(() => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      editorRef.current = editor;
      editor.root.setAttribute('spellcheck', 'true');
      editor.root.setAttribute('lang', 'es');
    }
  }, []);
  // Inyección de botones de edición de imagen (Lógica original optimizada visualmente)
  useEffect(() => {
    if (!quillRef.current) return;
    const editor = quillRef.current.getEditor();
    let attempts = 0;
    const addButtons = () => {
      const imageResize = editor.getModule('imageResize');
      if (imageResize?.toolbar) {
        if (imageResize.toolbar.querySelector('.ql-custom-group')) return;
        const buttonContainer = document.createElement('span');
        buttonContainer.className = 'ql-formats ql-custom-group';
        buttonContainer.style.borderLeft = '1px solid #ccc';
        buttonContainer.style.marginLeft = '8px';
        buttonContainer.style.paddingLeft = '8px';
      
        buttonContainer.innerHTML = `
          <button type="button" title="Eliminar imagen" class="ql-delete-image" style="color: #ef4444">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
          <button type="button" title="Propiedades de imagen" class="ql-edit-image" style="color: #3b82f6">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
        `;
        imageResize.toolbar.appendChild(buttonContainer);
        buttonContainer.querySelector('.ql-delete-image').onclick = () => {
          const range = editor.getSelection();
          if (range) {
            editor.deleteText(range.index, 1, Quill.sources.USER);
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
      } else if (attempts < 5) {
        attempts++;
        setTimeout(addButtons, 150);
      }
    };
    addButtons();
  }, []);
  const modules = useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'image', 'blockquote'],
      [{ 'align': ['', 'center', 'right', 'justify'] }],
      ['clean']
    ],
    imageResize: {
      parchment: Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize', 'Toolbar'],
    },
    keyboard: {
      bindings: {
        deleteImage: {
          key: ['Delete', 'Backspace'],
          handler: function(range) {
            if (!range) {
              setStatus({ type: 'error', msg: 'No hay selección activa para eliminar' });
              return true;
            }
            const editor = this.quill;
            const imageResize = editor.getModule('imageResize');
            let isImage = false;
            let deleteIndex = range.index;
            let deleteLength = 1;
            if (range.length === 0) {
              const [leaf] = editor.getLeaf(range.index);
              if (leaf && leaf.domNode && leaf.domNode.tagName === 'IMG') {
                isImage = true;
              } else {
                if (this.key === 'Backspace') {
                  const [prevLeaf] = editor.getLeaf(range.index - 1);
                  if (prevLeaf && prevLeaf.domNode && prevLeaf.domNode.tagName === 'IMG') {
                    isImage = true;
                    deleteIndex = range.index - 1;
                  }
                } else if (this.key === 'Delete') {
                  const [nextLeaf] = editor.getLeaf(range.index);
                  if (nextLeaf && nextLeaf.domNode && nextLeaf.domNode.tagName === 'IMG') {
                    isImage = true;
                    deleteIndex = range.index;
                  }
                }
              }
            } else if (range.length === 1) {
              const [leaf] = editor.getLeaf(range.index);
              if (leaf && leaf.domNode && leaf.domNode.tagName === 'IMG') {
                isImage = true;
              }
            }
            if (isImage) {
              try {
                if (imageResize) {
                  imageResize.hide();
                }
                editor.deleteText(deleteIndex, deleteLength, Quill.sources.USER);
                return false;
              } catch (err) {
                console.error('Error deleting image:', err);
                setStatus({ type: 'error', msg: 'Error al eliminar la imagen' });
                return false;
              }
            }
            return true;
          },
        },
        enterAfterImage: {
          key: 'Enter',
          handler: function(range) {
            if (!range) return true;
            const editor = this.quill;
            const [leaf] = editor.getLeaf(range.index);
            if (leaf && leaf.domNode && leaf.domNode.tagName === 'IMG') {
              try {
                editor.insertText(range.index + 1, '\n', Quill.sources.USER);
                editor.setSelection(range.index + 2, Quill.sources.SILENT);
                return false;
              } catch (err) {
                console.error('Error inserting new line after image:', err);
                setStatus({ type: 'error', msg: 'Error al añadir texto después de la imagen' });
                return false;
              }
            }
            return true;
          },
        },
      },
    },
  }), []);
  const formats = useMemo(() => [
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet',
    'link', 'image',
    'align',
    'size'
  ], []);
  // --- LÓGICA DE ENVÍO (MANTENIDA) ---
  const encodeBody = (html) => {
    try {
      if (!html || html.trim() === '') return '';
      let cleanedHtml = sanitizeInput(html);
    
      if (cleanedHtml.includes('<img')) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = editorRef.current?.root.innerHTML || cleanedHtml;
        const images = tempDiv.querySelectorAll('img');
      
        images.forEach((img) => {
          let align = 'left';
          try {
            const imgIndex = editorRef.current.getIndex(img);
            align = editorRef.current.getFormat(imgIndex).align || 'left';
          } catch (e) {}
        
          let style = 'max-width:100%;height:auto;border-radius:8px;margin:12px 0;display:block;';
          if (align === 'center') style += 'margin-left:auto;margin-right:auto;';
          else if (align === 'right') style += 'float:right;margin-left:12px;';
          else if (align === 'justify') style += 'width:100%;';
          else style += 'float:left;margin-right:12px;';
        
          if (img.style.width) style += `width:${img.style.width};`;
          if (img.style.height) style += `height:${img.style.height};`;
        
          img.setAttribute('style', style);
          img.setAttribute('loading', 'lazy');
          img.setAttribute('alt', 'Imagen de la noticia');
        });
        cleanedHtml = tempDiv.innerHTML;
      }
      return base64EncodeUnicode(cleanedHtml);
    } catch (err) {
      return base64EncodeUnicode(html);
    }
  };
  const validateInputs = () => {
    if (!title.trim()) {
      return 'El título es obligatorio.';
    }
    if (!body.trim()) {
      return 'El cuerpo de la noticia es obligatorio.';
    }
    return null;
  };
  const handleSubmit = async () => {
    const validationError = validateInputs();
    if (validationError) {
      setStatus({ type: 'error', msg: validationError });
      return;
    }
    setIsLoading(true);
    setStatus({ type: 'info', msg: 'Procesando noticia...' });
    const encodedBody = encodeBody(body);
    if (!encodedBody) {
      setStatus({ type: 'error', msg: 'Error al procesar el contenido' });
      setIsLoading(false);
      return;
    }
    const data = {
      title: sanitizeInput(title.trim()),
      body: encodedBody,
      photo: photo ? photo.split(',')[1] : '',
    };
    let attempt = 0;
    const maxRetries = 3;
    while (attempt < maxRetries) {
      try {
        await fetch(NEWS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      
        setStatus({ type: 'success', msg: '¡Noticia publicada con éxito! 🎉' });
        setTitle('');
        setBody('');
        setPhoto('');
        editorRef.current.setText('');
        clearDraft();
        setErrorCount(0);
        setIsLoading(false);
        return;
      } catch (err) {
        attempt++;
        if (attempt === maxRetries) {
          setStatus({ type: 'error', msg: `Error tras ${maxRetries} intentos. Verifica tu conexión.` });
          setErrorCount(prev => prev + 1);
          setIsLoading(false);
        } else {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }
    }
  };
  const handleImageModalSubmit = () => {
    const editor = editorRef.current;
    let { url, width, height, align } = imageData;
    if (!url) {
      setStatus({ type: 'error', msg: 'La URL de la imagen es obligatoria.' });
      return;
    }
    if (width && width !== 'auto' && !width.match(/%|px$/)) width += 'px';
    if (height && height !== 'auto' && !height.match(/%|px$/)) height += 'px';
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
      if (width) {
        const [leaf] = editor.getLeaf(range.index + 1);
        if (leaf?.domNode) leaf.domNode.style.width = width;
      }
      if (height) {
        const [leaf] = editor.getLeaf(range.index + 1);
        if (leaf?.domNode) leaf.domNode.style.height = height;
      }
      editor.setSelection(range.index + 1, 1);
      editor.format('align', align);
      editor.setSelection(range.index + 2);
    }
    setShowImageModal(false);
    setIsEditingImage(false);
    setImageData({ url: '', width: '', height: '', align: 'left' });
    setEditingRange(null);
  };
  const handleImageDataChange = (e) => {
    const { name, value } = e.target;
    setImageData((prev) => ({ ...prev, [name]: value }));
  };
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhoto(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };
  return (
    <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 transition-all">
      {/* Header */}
      <div className="bg-[#5a3e36] p-6 text-white flex items-center justify-between">
        <div>
          <h4 className="text-xl font-bold tracking-tight">Portal de Noticias</h4>
          <p className="text-sm opacity-80">Redacta y publica contenido de alta calidad</p>
        </div>
        <div className="bg-white/10 p-3 rounded-full">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none" strokeWidth="2"><path d="M19 20l-7-7-7 7V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
        </div>
      </div>
      <div className="p-4 sm:p-8 space-y-6">
        {/* Input Título */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Título de la publicación</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-5 py-3 text-lg font-medium border-2 border-gray-100 rounded-xl focus:border-[#5a3e36] focus:ring-0 transition-all outline-none placeholder-gray-300"
            placeholder="Ej: Gran descubrimiento en la zona norte..."
            disabled={isLoading}
          />
        </div>
        {/* Foto de portada */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Foto de portada (miniatura)</label>
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="w-full px-5 py-3 border-2 border-gray-100 rounded-xl focus:border-[#5a3e36] focus:ring-0 transition-all outline-none"
            disabled={isLoading}
          />
          {photo && <p className="text-sm text-gray-500 mt-1">Imagen seleccionada: {photo.substring(0, 50)}...</p>}
        </div>
        {/* Editor Quill */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Cuerpo de la noticia</label>
          <div className={`rounded-xl border-2 transition-all ${isLoading ? 'opacity-50 pointer-events-none' : 'border-gray-100 focus-within:border-[#5a3e36]'}`}>
            <ReactQuill
              ref={quillRef}
              value={body || ''}
              onChange={debouncedSetBody}
              modules={modules}
              formats={formats}
              placeholder="Escribe aquí tu noticia..."
              className="modern-quill-editor"
              readOnly={isLoading}
            />
          </div>
        </div>
        {/* Botonera Principal */}
        <div className="grid grid-cols-1 gap-4 pt-2">
          <button
            onClick={handleSubmit}
            disabled={isLoading || errorCount >= 5}
            className={`relative flex items-center justify-center gap-2 px-6 py-3 text-white font-bold rounded-xl transition-all shadow-lg ${
              isLoading || errorCount >= 5 ? 'bg-gray-400' : 'bg-[#5a3e36] hover:bg-[#462f29] active:scale-95'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Enviando...
              </span>
            ) : 'Publicar Noticia'}
          </button>
        </div>
        {/* Mensajes de Estado */}
        {status.msg && (
          <div className={`p-4 rounded-xl text-center text-sm font-medium animate-in fade-in slide-in-from-bottom-2 ${
            status.type === 'error' ? 'bg-red-50 text-red-600' :
            status.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
          }`}>
            {status.msg}
          </div>
        )}
        {errorCount >= 5 && (
          <div className="p-4 rounded-xl text-center text-sm font-medium bg-red-50 text-red-600">
            Demasiados intentos fallidos. Por favor, intenta de nuevo más tarde.
          </div>
        )}
      </div>
      {/* Footer info */}
      <div className="bg-gray-50 p-4 border-t border-gray-100 flex items-center justify-center gap-2">
         <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
         <p className="text-[11px] text-gray-400 uppercase font-bold tracking-widest text-center">
            Corrector ortográfico activo (ES) • Sistema de auto-recuperación habilitado
         </p>
      </div>
      {/* Modal Moderno */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100">
              <h5 className="text-xl font-bold text-gray-800">{isEditingImage ? 'Editar Imagen' : 'Insertar Imagen'}</h5>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase">URL de la imagen</label>
                <input
                  type="text"
                  name="url"
                  value={imageData.url}
                  onChange={handleImageDataChange}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#5a3e36] outline-none"
                  placeholder="https://ejemplo.com/foto.jpg"
                  disabled={isEditingImage}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Ancho</label>
                  <input
                    type="text"
                    name="width"
                    value={imageData.width}
                    onChange={handleImageDataChange}
                    placeholder="300px o 50%"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Alto</label>
                  <input
                    type="text"
                    name="height"
                    value={imageData.height}
                    onChange={handleImageDataChange}
                    placeholder="200px o auto"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase">Alineación</label>
                <select
                  name="align"
                  value={imageData.align}
                  onChange={handleImageDataChange}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none"
                >
                  <option value="left">Izquierda</option>
                  <option value="center">Centro</option>
                  <option value="right">Derecha</option>
                  <option value="justify">Completo</option>
                </select>
              </div>
            </div>
            <div className="p-6 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowImageModal(false)} className="px-5 py-2 text-gray-500 font-semibold hover:text-gray-700">
                Cancelar
              </button>
              <button onClick={handleImageModalSubmit} className="px-6 py-2 bg-[#5a3e36] text-white font-bold rounded-lg shadow-md hover:bg-[#462f29]">
                {isEditingImage ? 'Guardar Cambios' : 'Insertar'}
              </button>
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`
        .modern-quill-editor .ql-toolbar.ql-snow {
          border: none;
          border-bottom: 1px solid #f3f4f6;
          padding: 12px;
        }
        .modern-quill-editor .ql-container.ql-snow {
          border: none;
          min-height: 300px;
          font-family: inherit;
          font-size: 1rem;
        }
        .ql-editor.ql-blank::before {
          color: #d1d5db;
          font-style: normal;
        }
        .ql-snow .ql-stroke { stroke: #5a3e36; }
        .ql-snow .ql-fill { fill: #5a3e36; }
        .ql-snow .ql-picker { color: #5a3e36; font-weight: 600; }
        @media (max-width: 640px) {
          .modern-quill-editor .ql-toolbar.ql-snow {
            padding: 8px;
          }
          .modern-quill-editor .ql-container.ql-snow {
            min-height: 200px;
          }
        }
      `}</style>
    </div>
  );
}