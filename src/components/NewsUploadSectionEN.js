import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import ImageResize from 'quill-image-resize-module-react';
import { debounce } from 'lodash';
import { useTranslation } from 'react-i18next';

// Register the resize module
Quill.register('modules/imageResize', ImageResize);

const NEWS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyTbnLD0651YAUbanSZd-PNKnfYbCYeimDAZWkhRgEAoR4ewT9hjIw_F2HdQC6TcXK2Ug/exec';

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
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const quillRef = useRef(null);
  const editorRef = useRef(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [imageData, setImageData] = useState({ url: '', width: '', height: '', align: 'left' });
  const [editingRange, setEditingRange] = useState(null);

  // Debounce for onChange
  const debouncedSetBody = useCallback(
    debounce((value) => {
      setBody(value);
    }, 300),
    []
  );

  // Configure editor: spell checker and initial cleanup
  useEffect(() => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      editorRef.current = editor;
      editor.root.setAttribute('spellcheck', 'true');
      editor.root.setAttribute('lang', 'es'); // Note: Language for spellcheck is still Spanish
      editor.theme.tooltip.hide();
    }
  }, []);

  // Add custom delete and edit buttons with retries
  useEffect(() => {
    if (!quillRef.current) return;
    const editor = quillRef.current.getEditor();
    let attempts = 0;
    const maxAttempts = 5;
    const interval = 100;
    const addButtons = () => {
      const imageResize = editor.getModule('imageResize');
      if (imageResize && imageResize.toolbar && typeof imageResize.toolbar.appendChild === 'function') {
        const buttonContainer = document.createElement('span');
        buttonContainer.className = 'ql-formats';
        buttonContainer.innerHTML = `
          <button type="button" title="Delete image" class="ql-delete-image">
            <svg viewBox="0 0 18 18">
              <line class="ql-stroke" x1="3" x2="15" y1="3" y2="15"></line>
              <line class="ql-stroke" x1="3" x2="15" y1="15" y2="3"></line>
            </svg>
          </button>
          <button type="button" title="Edit image" class="ql-edit-image">
            <svg viewBox="0 0 18 18">
              <polygon class="ql-fill ql-stroke" points="6 10 4 12 2 10 4 8"></polygon>
              <path class="ql-stroke" d="M8.09,13.91A4.6,4.6,0,0,0,9,14,5,5,0,1,0,4,9"></path>
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
                console.error('Error deleting image:', err);
                setMessage('Error deleting the image');
              }
            } else {
              setMessage('Select an image to delete');
            }
          } else {
            setMessage('No active selection to delete');
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
              setMessage('Select an image to edit');
            }
          }
        };
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(addButtons, interval);
      } else {
        console.warn('Could not add buttons: imageResize.toolbar is not available');
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
              setMessage('No active selection to delete');
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
                setMessage('Error deleting the image');
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
                setMessage('Error adding text after the image');
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
      
      let cleanedHtml = html;
      cleanedHtml = sanitizeInput(cleanedHtml);
      
      if (cleanedHtml.includes('<img')) {
        let currentHtml = cleanedHtml;
        if (editorRef.current) {
          try {
            currentHtml = editorRef.current.root.innerHTML;
          } catch (e) {
            console.warn('Could not get HTML from editor:', e);
          }
        }
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = currentHtml;
        const images = tempDiv.querySelectorAll('img');
        
        images.forEach((img, index) => {
          const parent = img.parentElement;
          let align = 'left';
          if (editorRef.current) {
            try {
              const imgIndex = editorRef.current.getIndex(img);
              const formats = editorRef.current.getFormat(imgIndex);
              align = formats.align || 'left';
            } catch (e) {
              console.warn(`Could not get format for image ${index}:`, e);
            }
          }
          
          let style = 'max-width:100%;height:auto;border-radius:4px;margin:8px 0;display:block;';
          
          switch (align) {
            case 'center':
              style += 'margin-left:auto;margin-right:auto;';
              break;
            case 'right':
              style += 'float:right;margin-left:8px;margin-right:0;';
              if (parent) parent.style.overflow = 'hidden';
              break;
            case 'justify':
              style += 'width:100%;margin-left:0;margin-right:0;';
              break;
            case 'left':
            default:
              style += 'float:left;margin-right:8px;margin-left:0;';
              if (parent) parent.style.overflow = 'hidden';
              break;
          }
          
          if (img.style.width) style += `width:${img.style.width};`;
          if (img.style.height) style += `height:${img.style.height};`;
          
          img.setAttribute('style', style);
          img.setAttribute('loading', 'lazy');
          img.setAttribute('alt', 'News image');
        });
        
        cleanedHtml = tempDiv.innerHTML;
      }
      
      const encoder = new TextEncoder();
      const bytes = encoder.encode(cleanedHtml);
      let binary = '';
      bytes.forEach(b => binary += String.fromCharCode(b));
      return btoa(binary);
      
    } catch (err) {
      console.error('Error encoding body:', err);
      try {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(html);
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        return btoa(binary);
      } catch (fallbackErr) {
        console.error('Error in fallback encoding:', fallbackErr);
        return base64EncodeUnicode(html);
      }
    }
  };

  const validateInputs = () => {
    if (!title.trim()) {
      return 'The title is required.';
    }
    if (!body.trim()) {
      return 'The body of the news is required.';
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
    
    console.log('Original HTML:', body);
    
    const encodedBody = encodeBody(body);
    console.log('Encoded body length:', encodedBody.length);
    console.log('Encoded body preview:', encodedBody.substring(0, 100));
    
    if (!encodedBody) {
      setMessage('Error: Could not process the content');
      setIsLoading(false);
      return;
    }
    
    const data = {
      title: sanitizeInput(title.trim()),
      body: encodedBody,
    };
    
    console.log('Final data to send:', {
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
        setMessage('News sent successfully! 🎉');
        setTitle('');
        setBody('');
        setErrorCount(0);
        setIsLoading(false);
        return;
        
      } catch (err) {
        attempt++;
        console.error(`Attempt ${attempt} failed:`, err);
        
        if (attempt === maxRetries) {
          setMessage(`Error sending news after ${maxRetries} attempts. Check your connection.`);
          setErrorCount((prev) => prev + 1);
          setIsLoading(false);
          return;
        }
        
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
      setMessage('The image URL is required.');
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

  // Optional: Add a useEffect to clear the editor on successful submission
  useEffect(() => {
    if (message.includes('successfully') && quillRef.current) {
      const editor = quillRef.current.getEditor();
      if (editor) {
        editor.setText(''); // Clear the editor
      }
    }
  }, [message]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md space-y-4 max-w-2xl mx-auto">
      <h4 className="text-lg font-semibold text-[#5a3e36]">Upload New News</h4>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#5a3e36] text-[#5a3e36] placeholder-gray-400"
        placeholder="Title of the news"
        disabled={isLoading}
      />
      <div className="flex flex-col space-y-4">
        <div className="min-h-[16rem] border rounded-md overflow-auto">
          <ReactQuill
            ref={quillRef}
            value={body || ''}
            onChange={debouncedSetBody}
            modules={modules}
            formats={formats}
            placeholder="Body of the news"
            className="h-full text-[#5a3e36] bg-white"
            readOnly={isLoading}
          />
        </div>
        <div className="flex flex-col space-y-2">
          <button
            onClick={() => {
              setIsEditingImage(false);
              setImageData({ url: '', width: '', height: '', align: 'left' });
              setShowImageModal(true);
            }}
            className="px-4 py-2 bg-[#5a3e36] text-white rounded-md hover:bg-[#7a5c4f]"
            disabled={isLoading}
          >
            Insert Image Manually
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || errorCount >= 5}
            className={`w-full px-4 py-2 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-[#5a3e36] transition-colors ${
              isLoading || errorCount >= 5
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-[#5a3e36] hover:bg-[#7a5c4f]'
            }`}
          >
            {isLoading ? 'Sending...' : 'Send News'}
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500">
        Note: The browser's spell checker is active (set to Spanish). Check for red suggestions.
      </p>
      {message && (
        <p
          className={`text-center text-sm ${
            !message.includes('successfully') ? 'text-red-500' : 'text-green-500'
          }`}
        >
          {message}
        </p>
      )}
      {errorCount >= 5 && (
        <p className="text-center text-sm text-red-500">
          Too many failed attempts. Please try again later.
        </p>
      )}
      {showImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h5 className="text-lg font-semibold mb-4">{isEditingImage ? 'Edit Image' : 'Insert Image'}</h5>
            <input
              type="text"
              name="url"
              value={imageData.url}
              onChange={handleImageDataChange}
              placeholder="Image URL"
              className="w-full px-4 py-2 border rounded-md mb-2"
              disabled={isEditingImage}
            />
            <input
              type="text"
              name="width"
              value={imageData.width}
              onChange={handleImageDataChange}
              placeholder="Width (e.g., 300px or 50%)"
              className="w-full px-4 py-2 border rounded-md mb-2"
            />
            <input
              type="text"
              name="height"
              value={imageData.height}
              onChange={handleImageDataChange}
              placeholder="Height (e.g., 200px or auto)"
              className="w-full px-4 py-2 border rounded-md mb-2"
            />
            <select
              name="align"
              value={imageData.align}
              onChange={handleImageDataChange}
              className="w-full px-4 py-2 border rounded-md mb-4"
            >
              <option value="left">Left (floats to the left of text)</option>
              <option value="center">Center (in the middle, no float)</option>
              <option value="right">Right (floats to the right of text)</option>
              <option value="justify">Justify (full width, no float)</option>
            </select>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowImageModal(false)}
                className="px-4 py-2 bg-gray-300 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleImageModalSubmit}
                className="px-4 py-2 bg-[#5a3e36] text-white rounded-md"
              >
                {isEditingImage ? 'Update' : 'Insert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}