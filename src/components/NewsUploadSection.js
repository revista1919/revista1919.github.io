import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import ImageResize from 'quill-image-resize-module-react';
import { debounce } from 'lodash';
import { useTranslation } from 'react-i18next';
// Registrar el módulo de resize
Quill.register('modules/imageResize', ImageResize);
const NEWS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxLlge7jy7WPz5z6NQ0n4v6Q5-7V3y-U1RYall6k1NNlS6kzY1cgiS-iQSWWBVG-ZoCHg/exec';
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
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const quillRef = useRef(null);
  const editorRef = useRef(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [imageData, setImageData] = useState({ url: '', width: '', height: '', align: 'left' });
  const [editingRange, setEditingRange] = useState(null);
  // Debounce para el onChange
  const debouncedSetBody = useCallback(
    debounce((value) => {
      setBody(value);
      localStorage.setItem('newsBody', value);
    }, 300),
    []
  );
  // Cargar datos de localStorage al montar
  useEffect(() => {
    const savedTitle = localStorage.getItem('newsTitle');
    const savedBody = localStorage.getItem('newsBody');
    if (savedTitle) setTitle(savedTitle);
    if (savedBody) setBody(savedBody);
  }, []);
  // Guardar title en localStorage
  useEffect(() => {
    localStorage.setItem('newsTitle', title);
  }, [title]);
  // Configurar editor: corrector ortográfico y limpieza inicial
  useEffect(() => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      editorRef.current = editor;
      editor.root.setAttribute('spellcheck', 'true');
      editor.root.setAttribute('lang', 'es');
      editor.theme.tooltip.hide();
    }
  }, []);
  // Añadir botón de eliminar y editar personalizado con reintentos
  useEffect(() => {
    if (!quillRef.current) return;
    const editor = quillRef.current.getEditor();
    let attempts = 0;
    const maxAttempts = 5;
    const interval = 100;
    const addButtons = () => {
      const imageResize = editor.getModule('imageResize');
      if (imageResize && imageResize.toolbar && typeof imageResize.toolbar.appendChild === 'function') {
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
          <button type="button" title="Editar imagen" class="ql-edit-image" style="color: #3b82f6">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
        `;
        imageResize.toolbar.appendChild(buttonContainer);
        buttonContainer.querySelector('.ql-delete-image').onclick = () => {
          const range = editor.getSelection();
          if (range) {
            let isImage = false;
            let deleteIndex = range.index;
            let deleteLength = 1;
            const [leaf] = editor.getLeaf(range.index);
            if (leaf && leaf.domNode && leaf.domNode.tagName === 'IMG') {
              isImage = true;
            } else {
              const [prevLeaf] = editor.getLeaf(range.index - 1);
              if (prevLeaf && prevLeaf.domNode && prevLeaf.domNode.tagName === 'IMG') {
                isImage = true;
                deleteIndex = range.index - 1;
              } else {
                const [nextLeaf] = editor.getLeaf(range.index);
                if (nextLeaf && nextLeaf.domNode && nextLeaf.domNode.tagName === 'IMG') {
                  isImage = true;
                  deleteIndex = range.index;
                }
              }
            }
            if (isImage) {
              try {
                editor.deleteText(deleteIndex, deleteLength, Quill.sources.USER);
                imageResize.hide();
              } catch (err) {
                console.error('Error al eliminar imagen:', err);
                setStatus({ type: 'error', msg: 'Error al eliminar la imagen' });
              }
            } else {
              setStatus({ type: 'error', msg: 'Selecciona una imagen para eliminar' });
            }
          } else {
            setStatus({ type: 'error', msg: 'No hay selección activa para eliminar' });
          }
        };
        buttonContainer.querySelector('.ql-edit-image').onclick = () => {
          const range = editor.getSelection();
          if (range) {
            const [leaf] = editor.getLeaf(range.index);
            if (leaf && leaf.domNode && leaf.domNode.tagName === 'IMG') {
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
            } else {
              setStatus({ type: 'error', msg: 'Selecciona una imagen para editar' });
            }
          }
        };
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(addButtons, interval);
      } else {
        console.warn('No se pudo añadir los botones: imageResize.toolbar no está disponible');
      }
    };
    addButtons();
  }, []);
  const modules = useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'image'],
      [{ 'align': ['', 'center', 'right', 'justify'] }],
      [{ 'size': ['small', false, 'large'] }],
      ['clean']
    ],
    imageResize: {
      parchment: Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize', 'Toolbar'],
      handleStyles: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        border: 'none',
        color: 'white',
      },
      displayStyles: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        border: 'none',
        color: 'white',
      },
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
  const encodeBody = (html) => {
    try {
      if (!html || html.trim() === '') return '';
      
      // Limpiar y procesar el HTML directamente sin DOMParser
      let cleanedHtml = html;
      
      // Sanitizar primero
      cleanedHtml = sanitizeInput(cleanedHtml);
      
      // Si hay imágenes, procesarlas
      if (cleanedHtml.includes('<img')) {
        // Obtener el HTML real del editor si está disponible
        let currentHtml = cleanedHtml;
        if (editorRef.current) {
          try {
            currentHtml = editorRef.current.root.innerHTML;
          } catch (e) {
            console.warn('No se pudo obtener HTML del editor:', e);
          }
        }
        
        // Procesar imágenes para asegurar estilos correctos
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = currentHtml;
        const images = tempDiv.querySelectorAll('img');
        
        images.forEach((img, index) => {
          const parent = img.parentElement;
          // Obtener alineación desde Quill si es posible
          let align = 'left';
          if (editorRef.current) {
            try {
              const imgIndex = editorRef.current.getIndex(img);
              const formats = editorRef.current.getFormat(imgIndex);
              align = formats.align || 'left';
            } catch (e) {
              console.warn(`No se pudo obtener formato para imagen ${index}:`, e);
            }
          }
          
          let style = 'max-width:100%;height:auto;border-radius:8px;margin:12px 0;display:block;';
          
          switch (align) {
            case 'center':
              style += 'margin-left:auto;margin-right:auto;';
              break;
            case 'right':
              style += 'float:right;margin-left:12px;margin-right:0;';
              if (parent) parent.style.overflow = 'hidden';
              break;
            case 'justify':
              style += 'width:100%;margin-left:0;margin-right:0;';
              break;
            case 'left':
            default:
              style += 'float:left;margin-right:12px;margin-left:0;';
              if (parent) parent.style.overflow = 'hidden';
              break;
          }
          
          // Preservar dimensiones si están establecidas
          if (img.style.width) style += `width:${img.style.width};`;
          if (img.style.height) style += `height:${img.style.height};`;
          
          img.setAttribute('style', style);
          img.setAttribute('loading', 'lazy'); // Buena práctica
          img.setAttribute('alt', 'Imagen de la noticia'); // Accesibilidad
        });
        
        // Obtener el HTML procesado
        cleanedHtml = tempDiv.innerHTML;
      }
      
      // Codificar en base64
      const encoder = new TextEncoder();
      const bytes = encoder.encode(cleanedHtml);
      let binary = '';
      bytes.forEach(b => binary += String.fromCharCode(b));
      return btoa(binary);
      
    } catch (err) {
      console.error('Error encoding body:', err);
      // Fallback: intentar codificar el HTML original sin procesar
      try {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(html);
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        return btoa(binary);
      } catch (fallbackErr) {
        console.error('Error en fallback encoding:', fallbackErr);
        return base64EncodeUnicode(html); // Último recurso
      }
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
    
    console.log('HTML original:', body); // Debug
    
    const encodedBody = encodeBody(body);
    console.log('Encoded body length:', encodedBody.length); // Debug
    console.log('Encoded body preview:', encodedBody.substring(0, 100)); // Debug
    
    if (!encodedBody) {
      setStatus({ type: 'error', msg: 'Error: No se pudo procesar el contenido' });
      setIsLoading(false);
      return;
    }
    
    const data = {
      title: sanitizeInput(title.trim()),
      body: encodedBody,
    };
    
    console.log('Datos finales a enviar:', {
      title: data.title.substring(0, 50) + '...',
      bodyLength: data.body.length,
      hasImages: body.includes('<img')
    });
    
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        const response = await fetch(NEWS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
        
        console.log(`Attempt ${attempt + 1}: Request sent successfully`);
        setStatus({ type: 'success', msg: '¡Noticia enviada exitosamente! 🎉' });
        setTitle('');
        setBody('');
        localStorage.removeItem('newsTitle');
        localStorage.removeItem('newsBody');
        setErrorCount(0);
        setIsLoading(false);
        if (editorRef.current) {
          editorRef.current.setText('');
        }
        return;
        
      } catch (err) {
        attempt++;
        console.error(`Attempt ${attempt} failed:`, err);
        
        if (attempt === maxRetries) {
          setStatus({ type: 'error', msg: `Error al enviar la noticia tras ${maxRetries} intentos. Verifica tu conexión.` });
          setErrorCount((prev) => prev + 1);
          setIsLoading(false);
          return;
        }
        
        // Esperar antes del siguiente intento (backoff exponencial)
        await new Promise((resolve) => 
          setTimeout(resolve, 1000 * Math.pow(2, attempt))
        );
      }
    }
  };
  const handleImageModalSubmit = () => {
    const editor = quillRef.current.getEditor();
    let { url, width, height, align } = imageData;
    if (!url) {
      setStatus({ type: 'error', msg: 'La URL de la imagen es obligatoria.' });
      return;
    }
    if (width && width !== 'auto' && !width.match(/%|px$/)) width += 'px';
    if (height && height !== 'auto' && !height.match(/%|px$/)) height += 'px';
    if (isEditingImage) {
      if (editingRange) {
        editor.setSelection(editingRange.index, 1, 'silent');
        const [leaf] = editor.getLeaf(editingRange.index);
        if (leaf && leaf.domNode.tagName === 'IMG') {
          if (width) leaf.domNode.style.width = width;
          if (height) leaf.domNode.style.height = height;
          editor.format('align', align, 'user');
        }
        editor.blur();
      }
    } else {
      const range = editor.getSelection() || { index: editor.getLength() };
      editor.insertText(range.index, '\n', 'user');
      editor.insertEmbed(range.index + 1, 'image', url, 'user');
      editor.setSelection(range.index + 2, 'silent');
      const [leaf] = editor.getLeaf(range.index + 1);
      if (leaf && leaf.domNode.tagName === 'IMG') {
        if (width) leaf.domNode.style.width = width;
        if (height) leaf.domNode.style.height = height;
        editor.setSelection(range.index + 1, 1, 'silent');
        editor.format('align', align, 'user');
        editor.setSelection(range.index + 2, 'silent');
      }
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
  return (
    <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 transition-all">
      {/* Header */}
      <div className="bg-[#5a3e36] p-6 text-white flex items-center justify-between">
        <div>
          <h4 className="text-xl font-bold tracking-tight">Subir Nueva Noticia</h4>
          <p className="text-sm opacity-80">Redacta y publica contenido de alta calidad</p>
        </div>
        <div className="bg-white/10 p-3 rounded-full">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none" strokeWidth="2"><path d="M19 20l-7-7-7 7V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
        </div>
      </div>
      <div className="p-8 space-y-6">
        {/* Input Título */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Título de la noticia</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-5 py-3 text-lg font-medium border-2 border-gray-100 rounded-xl focus:border-[#5a3e36] focus:ring-0 transition-all outline-none placeholder-gray-300"
            placeholder="Ej: Gran descubrimiento en la zona norte..."
            disabled={isLoading}
          />
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
        <div className="pt-2">
          <button
            onClick={handleSubmit}
            disabled={isLoading || errorCount >= 5}
            className={`relative w-full flex items-center justify-center gap-2 px-6 py-3 text-white font-bold rounded-xl transition-all shadow-lg ${
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
            ) : 'Enviar Noticia'}
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
          Corrector ortográfico activo (ES) • Sistema de auto-guardado habilitado
        </p>
      </div>
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
                  <option value="left">Izquierda (flota a la izquierda del texto)</option>
                  <option value="center">Centro (en el medio, sin flotar)</option>
                  <option value="right">Derecha (flota a la derecha del texto)</option>
                  <option value="justify">Justificado (ancho completo, sin flotar)</option>
                </select>
              </div>
            </div>
            <div className="p-6 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowImageModal(false)} className="px-5 py-2 text-gray-500 font-semibold hover:text-gray-700">
                Cancelar
              </button>
              <button onClick={handleImageModalSubmit} className="px-6 py-2 bg-[#5a3e36] text-white font-bold rounded-lg shadow-md hover:bg-[#462f29]">
                {isEditingImage ? 'Actualizar' : 'Insertar'}
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
      `}</style>
    </div>
  );
}