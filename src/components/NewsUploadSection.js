import React, { useState, useCallback } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const NEWS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyHXyWeEJ6QXZCdIR-g33G_dN60mgjkHxRVxppbCBephMH1jTwBnsUN5qicYHku5ll2rw/exec';

export default function NewsUploadSection() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'image'],
      ['clean']
    ],
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet',
    'link', 'image'
  ];

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
        } else if (node.tagName === 'A') {
          return children + '(' + node.href + ')';
        } else if (node.tagName === 'IMG') {
          return node.src;
        } else if (node.tagName === 'P' || node.tagName === 'DIV') {
          return children + '===';
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
    if (title.length > 200) {
      return 'El título no puede exceder los 200 caracteres.';
    }
    if (!body.trim()) {
      return 'El cuerpo de la noticia es obligatorio.';
    }
    if (body.length > 5000) {
      return 'El cuerpo no puede exceder los 5000 caracteres.';
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
        maxLength={200}
        disabled={isLoading}
      />
      <ReactQuill
        value={body}
        onChange={setBody}
        modules={modules}
        formats={formats}
        placeholder="Cuerpo de la noticia"
        className="border rounded-md text-[#5a3e36] bg-white"
        readOnly={isLoading}
      />
      <p className="text-sm text-gray-500">
        Nota: Usa el corrector ortográfico de tu navegador si es necesario. Máximo 200 caracteres para el título y 5000 para el cuerpo.
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
            message.includes('Error') ? 'text-red-500' : 'text-green-500'
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