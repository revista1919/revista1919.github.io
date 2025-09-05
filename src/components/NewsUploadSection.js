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
  const [showImageModal, setShowImageModal] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [imageData, setImageData] = useState({ url: '', width: '', height: '', align: 'left' });
  const [editingRange, setEditingRange] = useState(null);

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

  // Añadir botón de eliminar y editar personalizado con reintentos
  useEffect(() => {
    if (!quillRef.current) return;

    const editor = quillRef.current.getEditor();
    let attempts = 0;
    const maxAttempts = 5;
    const interval = 100; // 100ms entre intentos

    const addButtons = () => {
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
          <button type="button" title="Editar imagen" class="ql-edit-image">
            <svg viewBox="0 0 18 18">
              <polygon class="ql-fill ql-stroke" points="6 10 4 12 2 10 4 8"></polygon>
              <path class="ql-stroke" d="M8.09,13.91A4.6,4.6,0,0,0,9,14,5,5,0,1,0,4,9"></path>
            </svg>
          </button>
        `;
        imageResize.toolbar.appendChild(buttonContainer);

        // Botón eliminar
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
                setMessage('Error al eliminar la imagen');
              }
            } else {
              setMessage('Selecciona una imagen para eliminar');
            }
          } else {
            setMessage('No hay selección activa para eliminar');
          }
        };

        // Botón editar
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
              setMessage('Selecciona una imagen para editar');
            }
          }
        };
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(addButtons, interval);
      } else {
        console.warn('No se pudo añadir los botones: imageResize.toolbar no está disponible');
        // Removida la advertencia setMessage
      }
    };

    addButtons();
  }, []);

  // Memorizar modules y formats
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

  const getAlign = (node) => {
    if (node.style && node.style.textAlign) return node.style.textAlign;
    if (node.classList) {
      if (node.classList.contains('ql-align-center')) return 'center';
      if (node.classList.contains('ql-align-right')) return 'right';
      if (node.classList.contains('ql-align-justify')) return 'justify';
    }
    return '';
  };

  const encodeBody = (html) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const encodeNode = (node, parentAlign = '') => {
        if (node.nodeType === 3) return node.textContent;
        let children = Array.from(node.childNodes).map(n => encodeNode(n, getAlign(node) || parentAlign)).join('');
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
          let width = node.getAttribute('width') || node.style.width || 'auto';
          let height = node.getAttribute('height') || node.style.height || 'auto';
          const align = getAlign(node) || parentAlign || 'left';
          if (width !== 'auto' && !width.match(/%|px$/)) width += 'px';
          if (height !== 'auto' && !height.match(/%|px$/)) height += 'px';
          return `[img:${node.src},${width},${height},${align}]`;
        } else if (node.tagName === 'SPAN') {
          let size = '';
          if (node.classList.contains('ql-size-small')) size = 'small';
          else if (node.classList.contains('ql-size-large')) size = 'big';
          if (size) {
            return `[size:${size}]` + children + '[/size]';
          }
          return children;
        } else if (node.tagName === 'P' || node.tagName === 'DIV') {
          const align = getAlign(node);
          let size = '';
          let innerChildren = children;
          // Detectar si el párrafo tiene un span con size para todo el contenido
          if (node.childNodes.length === 1 && node.childNodes[0].tagName === 'SPAN' && node.childNodes[0].classList) {
            const span = node.childNodes[0];
            if (span.classList.contains('ql-size-small')) size = 'small';
            else if (span.classList.contains('ql-size-large')) size = 'big';
            if (size) {
              innerChildren = Array.from(span.childNodes).map(n => encodeNode(n, align)).join('');
            }
          }
          if (!size) size = 'normal';
          let params = [];
          if (size !== 'normal') params.push(size);
          if (align) params.push(align);
          let prefix = '';
          if (params.length > 0) {
            prefix = '(' + params.join(',') + ')';
          }
          return prefix + innerChildren + '===';
        } else if (node.tagName === 'BR') {
          return '===';
        } else if (node.tagName === 'UL') {
          const items = Array.from(node.childNodes)
            .filter(n => n.tagName === 'LI')
            .map(li => '- ' + encodeNode(li, parentAlign));
          return items.join('===') + '===';
        } else if (node.tagName === 'OL') {
          let counter = 1;
          const items = Array.from(node.childNodes)
            .filter(n => n.tagName === 'LI')
            .map(li => (counter++) + '. ' + encodeNode(li, parentAlign));
          return items.join('===') + '===';
        } else if (node.tagName === 'LI') {
          return children;
        }
        return children;
      };
      let encoded = Array.from(doc.body.childNodes).map(n => encodeNode(n)).join('');
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

  const handleImageModalSubmit = () => {
    const editor = quillRef.current.getEditor();
    let { url, width, height, align } = imageData;
    if (!url) {
      setMessage('La URL de la imagen es obligatoria.');
      return;
    }
    if (width && width !== 'auto' && !width.match(/%|px$/)) width += 'px';
    if (height && height !== 'auto' && !height.match(/%|px$/)) height += 'px';
    if (isEditingImage) {
      // Editar imagen existente
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
      // Insertar nueva imagen
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
      <button
        onClick={() => {
          setIsEditingImage(false);
          setImageData({ url: '', width: '', height: '', align: 'left' });
          setShowImageModal(true);
        }}
        className="px-4 py-2 bg-[#5a3e36] text-white rounded-md hover:bg-[#7a5c4f]"
        disabled={isLoading}
      >
        Insertar Imagen Manualmente
      </button>
      <p className="text-sm text-gray-500">
        Nota: El corrector ortográfico del navegador está activo (en español). Revisa sugerencias en rojo.
      </p>
      <p className="text-sm text-gray-500">
        Usa URLs de imágenes de Google (copia la URL directamente). No subas desde tu computadora. Haz clic y arrastra para redimensionar imágenes, usa los botones de alineación (izquierda, centro, derecha, justificado), selecciona tamaño de fuente (pequeño, normal, grande), o usa el botón de eliminar (X) o editar en la barra de la imagen. Para subrayar texto, selecciona el texto y usa el botón de subrayado o escribe $texto$. Para añadir texto debajo de una imagen, haz clic después de la imagen y presiona Enter para crear un nuevo párrafo. Usa Supr/Backspace para eliminar imágenes si el botón no está disponible.
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
      {showImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h5 className="text-lg font-semibold mb-4">{isEditingImage ? 'Editar Imagen' : 'Insertar Imagen'}</h5>
            <input
              type="text"
              name="url"
              value={imageData.url}
              onChange={handleImageDataChange}
              placeholder="URL de la imagen"
              className="w-full px-4 py-2 border rounded-md mb-2"
              disabled={isEditingImage}
            />
            <input
              type="text"
              name="width"
              value={imageData.width}
              onChange={handleImageDataChange}
              placeholder="Ancho (ej: 300px o 50%)"
              className="w-full px-4 py-2 border rounded-md mb-2"
            />
            <input
              type="text"
              name="height"
              value={imageData.height}
              onChange={handleImageDataChange}
              placeholder="Alto (ej: 200px o auto)"
              className="w-full px-4 py-2 border rounded-md mb-2"
            />
            <select
              name="align"
              value={imageData.align}
              onChange={handleImageDataChange}
              className="w-full px-4 py-2 border rounded-md mb-4"
            >
              <option value="left">Izquierda</option>
              <option value="center">Centro</option>
              <option value="right">Derecha</option>
              <option value="justify">Justificado</option>
            </select>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowImageModal(false)}
                className="px-4 py-2 bg-gray-300 rounded-md"
              >
                Cancelar
              </button>
              <button
                onClick={handleImageModalSubmit}
                className="px-4 py-2 bg-[#5a3e36] text-white rounded-md"
              >
                {isEditingImage ? 'Actualizar' : 'Insertar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}