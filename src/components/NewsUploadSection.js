import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import ImageResize from 'quill-image-resize-module-react';
import { debounce } from 'lodash';

// Registrar el módulo de resize
Quill.register('modules/imageResize', ImageResize);

const NEWS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyHXyWeEJ6QXZCdIR-g33G_dN60mgjkHxRVxppbCBephMH1jTwBnsUN5qicYHku5ll2rw/exec';

export default function NewsUploadSection() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const quillRef = useRef(null);

  // Debounce para el onChange
  const debouncedSetBody = useCallback(
    debounce((value) => {
      setBody(value);
    }, 300),
    []
  );

  // Configurar editor: corrector ortográfico y limpieza inicial
  useEffect(() => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      editor.root.setAttribute('spellcheck', 'true');
      editor.root.setAttribute('lang', 'es');
      editor.theme.tooltip.hide();
    }
  }, []);

  // Añadir botón de eliminar personalizado con reintentos
  useEffect(() => {
    if (!quillRef.current) return;

    const editor = quillRef.current.getEditor();
    let attempts = 0;
    const maxAttempts = 5;
    const interval = 100; // 100ms entre intentos

    const addDeleteButton = () => {
      const imageResize = editor.getModule('imageResize');
      if (imageResize && imageResize.toolbar && typeof imageResize.toolbar.appendChild === 'function') {
        const buttonContainer = document.createElement('span');
        buttonContainer.className = 'ql-formats';
        buttonContainer.innerHTML = `
          <button type="button" title="Eliminar imagen" class="ql-delete-image">
            <svg viewBox="0 0 18 18">
              <line class="ql-stroke" x1="3" x2="15" y1="3" y2="15"></line>
              <line class="ql-stroke" x1="3" x2="15" y1="15" y2="3"></line>
            </svg>
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
              // Check previous for backspace-like behavior
              const [prevLeaf] = editor.getLeaf(range.index - 1);
              if (prevLeaf && prevLeaf.domNode && prevLeaf.domNode.tagName === 'IMG') {
                isImage = true;
                deleteIndex = range.index - 1;
              }
              // Check next for delete-like behavior
              else {
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
                setMessage('Error al eliminar la imagen');
              }
            } else {
              setMessage('Selecciona una imagen para eliminar');
            }
          } else {
            setMessage('No hay selección activa para eliminar');
          }
        };
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(addDeleteButton, interval);
      } else {
        console.warn('No se pudo añadir el botón de eliminar: imageResize.toolbar no está disponible');
        setMessage('Advertencia: No se pudo cargar el botón de eliminar imagen. Usa Supr/Backspace como alternativa.');
      }
    };

    // Ejecutar inmediatamente y luego en intervalos si falla
    addDeleteButton();
  }, []);

  // Memorizar modules y formats
  const modules = useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'image'],
      [{ 'align': ['', 'center', 'right'] }],
      [{ 'size': ['8px', '10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px'] }],
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
              setMessage('No hay selección activa para eliminar');
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
                // Check previous for backspace
                if (this.key === 'Backspace') {
                  const [prevLeaf] = editor.getLeaf(range.index - 1);
                  if (prevLeaf && prevLeaf.domNode && prevLeaf.domNode.tagName === 'IMG') {
                    isImage = true;
                    deleteIndex = range.index - 1;
                  }
                }
                // Check next for delete
                else if (this.key === 'Delete') {
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
                setMessage('Error al eliminar la imagen');
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
                setMessage('Error al añadir texto después de la imagen');
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

  const sanitizeInput = useCallback((input) => {
    if (!input) return '';
    return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/on\w+="[^"]*"/gi, '')
                .replace(/\s+/g, ' ')
                .trim();
  }, []);

  const encodeBody = (html) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const encodeNode = (node) => {
        if (node.nodeType === 3) return node.textContent;
        let children = Array.from(node.childNodes).map(encodeNode).join('');
        if (node.tagName === 'STRONG' || node.tagName === 'B') {
          return '*' + children + '*';
        } else if (node.tagName === 'EM' || node.tagName === 'I') {
          return '/' + children + '/';
        } else if (node.tagName === 'U') {
          return '$' + children + '$';
        } else if (node.tagName === 'S' || node.tagName === 'STRIKE') {
          return '~' + children + '~';
        } else if (node.tagName === 'A') {
          return children + '(' + node.href + ')';
        } else if (node.tagName === 'IMG') {
          const width = node.getAttribute('width') || node.style.width || 'auto';
          const height = node.getAttribute('height') || node.style.height || 'auto';
          const align = node.style.textAlign || 'left';
          return `[img:${node.src},${width},${height},${align}]`;
        } else if (node.tagName === 'P' || node.tagName === 'DIV') {
          const align = node.style.textAlign || '';
          const size = node.style.fontSize || '';
          let prefix = '';
          if (align) prefix += `[align:${align}]`;
          if (size) prefix += `[size:${size}]`;
          return prefix + children + '===';
        } else if (node.tagName === 'BR') {
          return '===';
        }
        return children;
      };
      let encoded = Array.from(doc.body.childNodes).map(encodeNode).join('');
      return sanitizeInput(encoded.replace(/===+/g, '==='));
    } catch (err) {
      console.error('Error encoding body:', err);
      return '';
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
      setMessage(validationError);
      return;
    }
    setIsLoading(true);
    setMessage('');
    const encodedBody = encodeBody(body);
    const data = {
      title: sanitizeInput(title.trim()),
      body: encodedBody,
    };
    console.log('Sending data:', data);
    const maxRetries = 3;
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        await fetch(NEWS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
        console.log(`Attempt ${attempt + 1}: Request sent (assuming success)`);
        setMessage('Noticia enviada exitosamente');
        setTitle('');
        setBody('');
        setErrorCount(0);
        setIsLoading(false);
        return;
      } catch (err) {
        attempt++;
        console.error(`Attempt ${attempt} failed:`, err);
        if (attempt === maxRetries) {
          setMessage(`Error al enviar la noticia tras ${maxRetries} intentos: ${err.message}`);
          setErrorCount((prev) => prev + 1);
          setIsLoading(false);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md space-y-4 max-w-2xl mx-auto">
      <h4 className="text-lg font-semibold text-[#5a3e36]">Subir Nueva Noticia</h4>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#5a3e36] text-[#5a3e36] placeholder-gray-400"
        placeholder="Título de la noticia"
        disabled={isLoading}
      />
      <ReactQuill
        ref={quillRef}
        value={body || ''}
        onChange={debouncedSetBody}
        modules={modules}
        formats={formats}
        placeholder="Cuerpo de la noticia"
        className="border rounded-md text-[#5a3e36] bg-white"
        readOnly={isLoading}
      />
      <p className="text-sm text-gray-500">
        Nota: El corrector ortográfico del navegador está activo (en español). Revisa sugerencias en rojo.
      </p>
      <p className="text-sm text-gray-500">
        Usa URLs de imágenes de Google (copia la URL directamente). No subas desde tu computadora. Haz clic y arrastra para redimensionar imágenes, usa los botones de alineación (izquierda, centro, derecha), selecciona tamaño de fuente, o usa el botón de eliminar (X) en la barra de la imagen. Para subrayar texto, selecciona el texto y usa el botón de subrayado o escribe $texto$. Para añadir texto debajo de una imagen, haz clic después de la imagen y presiona Enter para crear un nuevo párrafo. Usa Supr/Backspace para eliminar imágenes si el botón no está disponible.
      </p>
      <button
        onClick={handleSubmit}
        disabled={isLoading || errorCount >= 5}
        className={`w-full px-4 py-2 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-[#5a3e36] transition-colors ${
          isLoading || errorCount >= 5
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-[#5a3e36] hover:bg-[#7a5c4f]'
        }`}
      >
        {isLoading ? 'Enviando...' : 'Enviar Noticia'}
      </button>
      {message && (
        <p
          className={`text-center text-sm ${
            message.includes('Error') || message.includes('Advertencia') ? 'text-red-500' : 'text-green-500'
          }`}
        >
          {message}
        </p>
      )}
      {errorCount >= 5 && (
        <p className="text-center text-sm text-red-500">
          Demasiados intentos fallidos. Por favor, intenta de nuevo más tarde.
        </p>
      )}
    </div>
  );
}