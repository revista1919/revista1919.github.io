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
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
               .replace(/on\w+="[^"]*"/gi, '')
               .replace(/\s+/g, ' ')
               .trim();
};

export default function NewsUploadSection() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState(''); // Estado inmediato para evitar saltos de cursor
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

  // --- PERSISTENCIA LOCAL Y CLEANUP ---
  useEffect(() => {
    const savedDraft = localStorage.getItem('newsDraftES');
    if (savedDraft) {
      const { title: savedTitle, body: savedBody } = JSON.parse(savedDraft);
      setTitle(savedTitle);
      setBody(savedBody);
    }
  }, []);

  const debouncedSaveDraft = useMemo(() => 
    debounce((titleVal, bodyVal) => {
      localStorage.setItem('newsDraftES', JSON.stringify({ title: titleVal, body: bodyVal }));
    }, 1000), []);

  useEffect(() => {
    debouncedSaveDraft(title, body);
  }, [title, body, debouncedSaveDraft]);

  // Solución ✅ 4: Limpiar debounce al desmontar
  useEffect(() => {
    return () => debouncedSaveDraft.cancel();
  }, [debouncedSaveDraft]);

  const clearDraft = () => localStorage.removeItem('newsDraftES');

  // --- LÓGICA DE BOTONES DE EDICIÓN DE IMAGEN ---
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
        buttonContainer.style.cssText = "border-left: 1px solid #ccc; margin-left: 8px; padding-left: 8px; display: flex; gap: 4px;";
      
        buttonContainer.innerHTML = `
          <button type="button" class="ql-delete-image" style="color: #ef4444; width: 24px; height: 24px;">
            <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
          <button type="button" class="ql-edit-image" style="color: #3b82f6; width: 24px; height: 24px;">
            <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
        `;
        imageResize.toolbar.appendChild(buttonContainer);

        buttonContainer.querySelector('.ql-delete-image').onclick = () => {
          const range = editor.getSelection();
          if (range) {
            // Solución ✅ 2: Borrar con el length correcto
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

  // --- CONFIGURACIÓN DE MÓDULOS ---
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'size': ['small', false, 'large', 'huge'] }],
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
            if (!range) return true; // Solución ✅ seguridad range null
            const editor = this.quill;
            const imageResize = editor.getModule('imageResize');
            let isImage = false;
            let deleteIndex = range.index;
            let deleteLength = range.length || 1;

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

  // --- LÓGICA DE PROCESAMIENTO FINAL ---
  const encodeBody = (html) => {
    try {
      if (!html || html.trim() === '') return '';
      let cleanedHtml = sanitizeInput(html);
    
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cleanedHtml;
      const images = tempDiv.querySelectorAll('img');
    
      images.forEach((img) => {
        let align = 'left';
        // Solución ✅ 3: Uso correcto de Quill.find y getIndex
        const blot = Quill.find(img);
        if (blot && editorRef.current) {
          try {
            const imgIndex = editorRef.current.getIndex(blot);
            align = editorRef.current.getFormat(imgIndex, 1).align || 'left';
          } catch (e) { console.error("Error al obtener index", e); }
        }
      
        let style = 'max-width:100%;height:auto;border-radius:12px;margin:20px 0;display:block;';
        if (align === 'center') style += 'margin-left:auto;margin-right:auto;';
        else if (align === 'right') style += 'float:right;margin-left:20px;';
        else if (align === 'justify') style += 'width:100%;';
        else style += 'float:left;margin-right:20px;';
      
        if (img.style.width) style += `width:${img.style.width};`;
        if (img.style.height) style += `height:${img.style.height};`;
      
        img.setAttribute('style', style);
        img.setAttribute('loading', 'lazy');
        img.setAttribute('alt', 'Imagen de la noticia'); // Solución ✅ 3 ALT
      });

      return base64EncodeUnicode(tempDiv.innerHTML);
    } catch (err) {
      return base64EncodeUnicode(html);
    }
  };

  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user) return setStatus({ type: 'error', msg: 'Sesión no válida' });
    if (!title.trim() || !body.trim()) return setStatus({ type: 'error', msg: 'Campos incompletos' });

    setIsLoading(true);
    const token = await user.getIdToken();
    const encodedBody = encodeBody(body);

    const data = { title: sanitizeInput(title), body: encodedBody, photo: sanitizeInput(photo) };

    let attempt = 0;
    while (attempt < 3) {
      try {
        const res = await fetch(NEWS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error();
        setStatus({ type: 'success', msg: '¡Publicado con éxito! 🎉' });
        setTitle(''); setBody(''); setPhoto('');
        editorRef.current.setText('');
        clearDraft();
        setIsLoading(false);
        return;
      } catch {
        attempt++;
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
    setStatus({ type: 'error', msg: 'Error de conexión tras 3 intentos' });
    setIsLoading(false);
  };

  const handleImageModalSubmit = () => {
    const editor = editorRef.current;
    let { url, width, height, align } = imageData;
    if (!url) return setStatus({ type: 'error', msg: 'URL requerida' });

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
    <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 font-sans">
      {/* Header UI Elegante */}
      <div className="bg-gradient-to-r from-[#5a3e36] to-[#7d5a50] p-8 text-white flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tighter">REDACCIÓN PROFESIONAL</h2>
          <p className="text-sm font-medium opacity-70">Control de calidad editorial v3.0</p>
        </div>
        <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20">
          <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" fill="none" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {/* Título */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-[#5a3e36] uppercase tracking-[0.2em] ml-1">Título de Portada</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-6 py-4 text-xl font-bold border-2 border-gray-50 rounded-2xl focus:border-[#5a3e36] focus:bg-white bg-gray-50 transition-all outline-none"
            placeholder="¿Qué está pasando hoy?"
          />
        </div>

        {/* Portada URL */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-[#5a3e36] uppercase tracking-[0.2em] ml-1">Thumbnail (Direct Link)</label>
          <input
            type="text"
            value={photo}
            onChange={(e) => setPhoto(e.target.value)}
            className="w-full px-6 py-4 border-2 border-gray-50 rounded-2xl focus:border-[#5a3e36] bg-gray-50 outline-none transition-all"
            placeholder="Pega la URL de tu imagen de portada..."
          />
        </div>

        {/* Editor ✅ Solución 1: onChange={setBody} directo */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-[#5a3e36] uppercase tracking-[0.2em] ml-1">Cuerpo Editorial</label>
          <div className="rounded-2xl border-2 border-gray-50 focus-within:border-[#5a3e36] transition-all bg-gray-50 overflow-hidden">
            <ReactQuill
              ref={quillRef}
              value={body}
              onChange={setBody}
              modules={modules}
              placeholder="Desarrolla la noticia aquí..."
              className="modern-quill"
            />
          </div>
        </div>

        {/* Botonera */}
        <div className="pt-4">
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className={`w-full py-5 text-white font-black rounded-2xl transition-all flex justify-center items-center gap-3 shadow-xl ${
              isLoading ? 'bg-gray-400' : 'bg-[#5a3e36] hover:bg-[#462f29] hover:shadow-2xl active:scale-[0.99]'
            }`}
          >
            {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "PUBLICAR EN EL PORTAL"}
          </button>
        </div>

        {/* Status Toast */}
        {status.msg && (
          <div className={`p-5 rounded-2xl text-sm font-bold animate-in slide-in-from-bottom-5 duration-300 ${
            status.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
          }`}>
            {status.msg}
          </div>
        )}
      </div>

      {/* Modal Moderno */}
      {showImageModal && (
        <div className="fixed inset-0 bg-[#5a3e36]/40 backdrop-blur-md flex justify-center items-center z-[999] p-6">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-white/20 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-50 bg-gray-50/50">
              <h3 className="text-lg font-black text-[#5a3e36] tracking-tight">{isEditingImage ? 'AJUSTES DE IMAGEN' : 'NUEVA IMAGEN'}</h3>
            </div>
            <div className="p-8 space-y-5">
              <input type="text" value={imageData.url} onChange={(e)=>setImageData({...imageData, url: e.target.value})} 
                className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-xl focus:border-[#5a3e36] outline-none font-medium" placeholder="URL de la imagen" disabled={isEditingImage} />
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Ancho (auto/%)" value={imageData.width} onChange={(e)=>setImageData({...imageData, width: e.target.value})} className="p-4 bg-gray-50 border-2 border-transparent rounded-xl focus:border-[#5a3e36] outline-none" />
                <input type="text" placeholder="Alto (auto)" value={imageData.height} onChange={(e)=>setImageData({...imageData, height: e.target.value})} className="p-4 bg-gray-50 border-2 border-transparent rounded-xl focus:border-[#5a3e36] outline-none" />
              </div>
              <select value={imageData.align} onChange={(e)=>setImageData({...imageData, align: e.target.value})} className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-xl focus:border-[#5a3e36] outline-none font-bold">
                <option value="left">Alineación: Izquierda</option>
                <option value="center">Alineación: Centro</option>
                <option value="right">Alineación: Derecha</option>
                <option value="justify">Alineación: Justificado</option>
              </select>
            </div>
            <div className="p-6 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowImageModal(false)} className="px-5 py-3 text-gray-400 font-bold hover:text-gray-600">DESCARTAR</button>
              <button onClick={handleImageModalSubmit} className="px-8 py-3 bg-[#5a3e36] text-white rounded-xl font-black shadow-lg">CONFIRMAR</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .modern-quill .ql-toolbar.ql-snow { border: none !important; padding: 20px; background: white; border-bottom: 2px solid #f9fafb !important; }
        .modern-quill .ql-container.ql-snow { border: none !important; min-height: 400px; font-family: inherit; }
        .modern-quill .ql-editor { padding: 30px; font-size: 1.15rem; line-height: 1.8; color: #374151; }
        .ql-snow .ql-stroke { stroke: #5a3e36 !important; stroke-width: 2px; }
        .ql-snow .ql-fill { fill: #5a3e36 !important; }
        .ql-snow .ql-picker { color: #5a3e36 !important; font-weight: bold; }
        .ql-editor blockquote { border-left: 5px solid #5a3e36; background: #fdfaf9; padding: 20px 30px; font-style: italic; border-radius: 0 15px 15px 0; }
        .ql-editor.ql-blank::before { color: #9ca3af; font-style: normal; opacity: 0.6; }
      `}</style>
    </div>
  );
}