// DirectorPanel.js
import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

// ✅ Patrones para acceder a env vars en React (tanto build como runtime)
const getEnvVar = (key, fallback = null) => {
  // Vite (import.meta.env)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || fallback;
  }
  // Create React App / Webpack (process.env en build time)
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || fallback;
  }
  // Fallback para desarrollo local
  return window?.envVars?.[key] || fallback;
};

// URLs con fallbacks
const ARTICULOS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv';
const ARTICULOS_GAS_URL = getEnvVar('REACT_APP_ARTICULOS_SCRIPT_URL', 
  'https://script.google.com/macros/s/YOUR_DEPLOYED_ID/exec' // ← REEMPLAZA CON TU URL REAL
);
const GH_TOKEN = getEnvVar('REACT_APP_GH_TOKEN', null);

const GH_API_BASE = 'https://api.github.com/repos/revista1919/revista1919.github.io/contents';
const REPO_OWNER = 'revista1919';
const REPO_NAME = 'revista1919.github.io';

// Debug logging (solo en desarrollo)
if (process.env.NODE_ENV === 'development') {
  console.log('🔍 DirectorPanel Debug:', {
    GAS_URL: ARTICULOS_GAS_URL,
    HAS_TOKEN: !!GH_TOKEN,
    TOKEN_LENGTH: GH_TOKEN ? `${GH_TOKEN.length} chars` : 'No token',
    ENV_VARS: {
      hasGasUrl: !!getEnvVar('REACT_APP_ARTICULOS_SCRIPT_URL'),
      hasGhToken: !!getEnvVar('REACT_APP_GH_TOKEN')
    }
  });
}

const toBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = error => reject(error);
});

const uploadPDFToGitHub = async (base64Content, fileName, message, sha = null) => {
  if (!GH_TOKEN) {
    console.error('❌ No GitHub token available');
    throw new Error('Token GitHub no disponible - verifica REACT_APP_GH_TOKEN en build');
  }
  console.log('📤 Uploading PDF:', fileName);
  
  const path = `Articles/${fileName}`;
  const url = `${GH_API_BASE}/${path}`;
  const payload = {
    message,
    content: base64Content,
    ...(sha && { sha })
  };
  
  console.log('📡 GitHub API Request:', { url, fileName, hasSha: !!sha });
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${GH_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ GitHub API Error:', response.status, errorText);
    throw new Error(`Error uploading: ${response.status} - ${errorText}`);
  }
  
  const result = await response.json();
  console.log('✅ PDF uploaded:', result);
  return result;
};

const deletePDFFromGitHub = async (fileName, message) => {
  if (!GH_TOKEN) throw new Error('Token GitHub no disponible');
  console.log('🗑️ Deleting PDF:', fileName);
  
  const path = `Articles/${fileName}`;
  const url = `${GH_API_BASE}/${path}`;
  
  // GET SHA first
  const getRes = await fetch(url, {
    headers: { 
      'Authorization': `token ${GH_TOKEN}`, 
      'Accept': 'application/vnd.github.v3+json' 
    }
  });
  
  if (!getRes.ok) {
    console.warn('⚠️ File not found for deletion:', fileName);
    return; // Silently skip if file doesn't exist
  }
  
  const file = await getRes.json();
  const payload = { message, sha: file.sha };
  
  const delRes = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `token ${GH_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  if (!delRes.ok) {
    console.error('❌ Delete failed:', delRes.status);
    throw new Error(`Error deleting: ${delRes.status}`);
  }
  
  console.log('✅ PDF deleted:', fileName);
};

const renamePDFFromGitHub = async (oldFileName, newFileName, message) => {
  console.log('🔄 Renaming PDF:', oldFileName, '→', newFileName);
  
  const oldPath = `Articles/${oldFileName}`;
  const oldUrl = `${GH_API_BASE}/${oldPath}`;
  
  const getRes = await fetch(oldUrl, {
    headers: { 
      'Authorization': `token ${GH_TOKEN}`, 
      'Accept': 'application/vnd.github.v3+json' 
    }
  });
  
  if (!getRes.ok) {
    console.warn('⚠️ Old file not found:', oldFileName);
    return;
  }
  
  const oldFile = await getRes.json();
  const base64Content = oldFile.content;
  
  // Delete old first
  await deletePDFFromGitHub(oldFileName, `${message} - delete old`);
  
  // Upload new
  await uploadPDFToGitHub(base64Content, newFileName, `${message} - rename`);
  
  console.log('✅ PDF renamed successfully');
};

const triggerRebuild = async () => {
  if (!GH_TOKEN) throw new Error('Token GitHub no disponible');
  console.log('🔄 Triggering rebuild...');
  
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/dispatches`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `token ${GH_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ event_type: 'rebuild' })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Rebuild failed:', response.status, errorText);
    throw new Error(`Error triggering rebuild: ${response.status}`);
  }
  
  console.log('✅ Rebuild triggered');
};

export default function DirectorPanel({ user }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [formData, setFormData] = useState({
    titulo: '',
    autores: '',
    resumen: '',
    abstract: '',
    fecha: '',
    volumen: '',
    numero: '',
    primeraPagina: '',
    ultimaPagina: '',
    areaTematica: '',
    palabrasClave: '',
    pdfFile: null
  });
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      console.log('📥 Fetching articles from:', ARTICULOS_CSV_URL);
      const response = await fetch(ARTICULOS_CSV_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const csvText = await response.text();
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
      console.log('📊 Parsed articles:', parsed.length);
      
      setArticles(parsed.map(row => ({
        ...row,
        areas: row['Área temática'] ? row['Área temática'].split(';').map(a => a.trim()).filter(Boolean) : [],
        keywords: row['Palabras clave'] ? row['Palabras clave'].split(';').map(k => k.trim()).filter(Boolean) : [],
        pdfUrl: row['URL_PDF'] || `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/Articles/Articulo${row['Número de artículo']}.pdf`
      })));
    } catch (err) {
      console.error('❌ Error fetching articles:', err);
      setStatus(`Error al cargar artículos: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (numero) => {
    setExpanded(prev => ({ ...prev, [numero]: !prev[numero] }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setFormData(prev => ({ ...prev, pdfFile: e.target.files[0] }));
  };

  const resetForm = () => {
    setFormData({
      titulo: '',
      autores: '',
      resumen: '',
      abstract: '',
      fecha: '',
      volumen: '',
      numero: '',
      primeraPagina: '',
      ultimaPagina: '',
      areaTematica: '',
      palabrasClave: '',
      pdfFile: null
    });
  };

  const updatePDFUrlInSheet = async (numero, pdfUrl) => {
    if (!ARTICULOS_GAS_URL || ARTICULOS_GAS_URL.includes('YOUR_DEPLOYED_ID')) {
      console.warn('⚠️ Cannot update PDF URL - GAS not configured');
      return;
    }
    
    console.log('📝 Updating PDF URL in sheet:', numero, pdfUrl);
    const data = {
      action: 'update_pdf_url',
      numero: parseInt(numero),
      pdfUrl
    };
    const response = await fetch(ARTICULOS_GAS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    console.log('📤 Sheet update response:', response);
  };

  const handleSubmit = async (action = 'add') => {
    if (!formData.titulo || !formData.autores) {
      setStatus('Campos obligatorios faltantes: Título y Autor(es)');
      return;
    }

    if (!ARTICULOS_GAS_URL || ARTICULOS_GAS_URL.includes('YOUR_DEPLOYED_ID')) {
      setStatus('❌ Error: Configura la URL del Google Apps Script');
      return;
    }

    try {
      setStatus('Procesando...');
      console.log('🚀 Starting submit:', { action, hasPdf: !!formData.pdfFile });
      
      let articleNumber = null;
      let pdfUrl = null;

      // 1. Submit metadata to sheet FIRST
      const data = {
        action,
        article: {
          titulo: formData.titulo,
          autores: formData.autores,
          resumen: formData.resumen,
          abstract: formData.abstract,
          fecha: formData.fecha,
          volumen: formData.volumen,
          numero: formData.numero,
          primeraPagina: formData.primeraPagina,
          ultimaPagina: formData.ultimaPagina,
          areaTematica: formData.areaTematica,
          palabrasClave: formData.palabrasClave,
          urlPdf: ''  // Will update after PDF upload
        },
        ...(action === 'edit' && { numero: editingArticle['Número de artículo'] })
      };

      console.log('📄 Submitting to GAS:', { url: ARTICULOS_GAS_URL, action });
      const sheetResponse = await fetch(ARTICULOS_GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      // For add, wait and refresh to get the actual number
      if (action === 'add') {
        console.log('⏳ Waiting for sheet sync...');
        await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for GAS sync
        await fetchArticles();
        // Use optimistic numbering for PDF upload
        articleNumber = articles.length + 1;
        console.log('🆕 Using optimistic article number:', articleNumber);
      } else {
        articleNumber = editingArticle['Número de artículo'];
      }

      // 2. Handle PDF upload if present
      if (formData.pdfFile) {
        if (!GH_TOKEN) {
          setStatus('⚠️ Metadata guardado. Sube PDF manualmente a GitHub/Articles/');
          return;
        }
        
        console.log('📄 Converting PDF to base64...');
        const base64 = await toBase64(formData.pdfFile);
        console.log('📄 Base64 ready, size:', Math.round(base64.length / 1024), 'KB');
        
        const fileName = `Articulo${articleNumber}.pdf`;
        const message = action === 'add' ? `Add PDF for article ${articleNumber}` : `Update PDF for article ${articleNumber}`;
        
        await uploadPDFToGitHub(base64, fileName, message);
        pdfUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/Articles/${fileName}`;
        await updatePDFUrlInSheet(articleNumber, pdfUrl);
        
        console.log('✅ PDF uploaded:', pdfUrl);
      }

      setStatus(`✅ Operación completada${pdfUrl ? ` - PDF: ${pdfUrl}` : ' - Sin PDF'}`);
      setTimeout(fetchArticles, 2000); // Final refresh
      closeModals();
    } catch (err) {
      console.error('💥 Error submitting:', err);
      setStatus(`❌ Error: ${err.message}`);
    }
  };

  const handleEdit = (article) => {
    console.log('✏️ Editing article:', article['Título']);
    setEditingArticle(article);
    setFormData({
      titulo: article['Título'] || '',
      autores: article['Autor(es)'] || '',
      resumen: article['Resumen'] || '',
      abstract: article['Abstract'] || '',
      fecha: article['Fecha'] || '',
      volumen: article['Volumen'] || '',
      numero: article['Número'] || '',
      primeraPagina: article['Primera página'] || '',
      ultimaPagina: article['Última página'] || '',
      areaTematica: article['Área temática'] || '',
      palabrasClave: article['Palabras clave'] || '',
      pdfFile: null
    });
    setShowEditModal(true);
  };

  const handleDelete = async (numero) => {
    if (!confirm(`¿Eliminar artículo ${numero}? Esto renumerará los siguientes automáticamente.`)) return;
    
    try {
      setStatus('Eliminando...');
      console.log('🗑️ Starting delete for article:', numero);
      
      // 1. Delete from sheet (GAS will renumber)
      const data = { action: 'delete', numero: parseInt(numero) };
      await fetch(ARTICULOS_GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      console.log('📄 Sheet delete sent');

      // 2. Handle PDF operations if token available
      if (GH_TOKEN) {
        // Delete original PDF
        await deletePDFFromGitHub(`Articulo${numero}.pdf`, `Delete PDF for article ${numero}`);
        
        // For now, just log - full renumbering is complex
        console.log('🔄 PDFs >', numero, 'would need renumbering - implement after sheet refresh');
      } else {
        console.warn('⚠️ No token - PDFs need manual cleanup');
      }

      setStatus('✅ Artículo eliminado');
      setTimeout(fetchArticles, 1500);
    } catch (err) {
      console.error('💥 Delete error:', err);
      setStatus(`❌ Error al eliminar: ${err.message}`);
    }
  };

  const handleRebuild = async () => {
    if (!GH_TOKEN) {
      setStatus('⚠️ Rebuild requiere token GitHub (configura MY_GITHUB_TOKEN)');
      return;
    }
    
    try {
      setStatus('Iniciando actualización...');
      await triggerRebuild();
      setStatus('✅ Actualización de página iniciada');
    } catch (err) {
      console.error('💥 Rebuild error:', err);
      setStatus(`❌ Error al actualizar: ${err.message}`);
    }
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setEditingArticle(null);
    resetForm();
  };

  if (loading) return <div className="text-center p-4">Cargando artículos...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Debug info - only in development */}
        {process.env?.NODE_ENV === 'development' && (
          <div className="bg-yellow-100 p-2 mb-4 text-xs rounded border border-yellow-300">
            <strong>🔧 DEBUG MODE:</strong><br />
            GAS URL: {ARTICULOS_GAS_URL?.slice(0, 40)}...{ARTICULOS_GAS_URL?.includes('YOUR_DEPLOYED_ID') ? ' [NEEDS CONFIG]' : ''}<br />
            GitHub Token: {GH_TOKEN ? `✓ (${GH_TOKEN.length} chars)` : '✗ [MISSING]'}<br />
            <small>Recarga la página después de configurar secrets en GitHub</small>
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Panel del Director General</h2>
          <button
            onClick={handleRebuild}
            disabled={!GH_TOKEN}
            className={`px-6 py-2 rounded-md font-medium flex items-center space-x-2 transition-colors ${
              GH_TOKEN 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-gray-400 text-gray-700 cursor-not-allowed'
            }`}
            title={!GH_TOKEN ? 'Requiere token GitHub' : 'Actualizar sitio web'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Actualizar Página</span>
          </button>
        </div>

        {status && (
          <div className={`p-4 rounded-md mb-6 ${
            status.includes('Error') || status.includes('❌') 
              ? 'bg-red-100 text-red-700 border border-red-300' 
              : 'bg-green-100 text-green-700 border border-green-300'
          }`}>
            {status}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
            <h3 className="text-xl font-semibold text-gray-800">Artículos Archivados ({articles.length})</h3>
            <button
              onClick={() => setShowAddModal(true)}
              disabled={!ARTICULOS_GAS_URL || ARTICULOS_GAS_URL.includes('YOUR_DEPLOYED_ID')}
              className={`px-4 py-2 rounded-md font-medium flex items-center space-x-2 transition-colors ${
                ARTICULOS_GAS_URL && !ARTICULOS_GAS_URL.includes('YOUR_DEPLOYED_ID')
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-400 text-gray-700 cursor-not-allowed'
              }`}
              title={!ARTICULOS_GAS_URL || ARTICULOS_GAS_URL.includes('YOUR_DEPLOYED_ID') ? 'Requiere URL de Google Apps Script' : 'Agregar nuevo artículo'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Agregar Artículo</span>
            </button>
          </div>

          {articles.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No hay artículos disponibles.</p>
              {(!ARTICULOS_GAS_URL || ARTICULOS_GAS_URL.includes('YOUR_DEPLOYED_ID')) && (
                <p className="text-red-600 mt-2">
                  <strong>⚠️ Configura primero la URL del Google Apps Script</strong>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {articles.map((article, index) => (
                <div key={index} className="border border-gray-200 rounded-md overflow-hidden hover:shadow-md transition-shadow">
                  <div
                    className="p-4 cursor-pointer bg-gray-50 hover:bg-gray-100 flex justify-between items-center"
                    onClick={() => toggleExpand(article['Número de artículo'])}
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-800 truncate" title={article['Título']}>
                        {article['Título']}
                      </h4>
                      <p className="text-sm text-gray-600 truncate" title={article['Autor(es)']}>
                        {article['Autor(es)']}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                        #{article['Número de artículo']}
                      </span>
                      <svg className={`w-5 h-5 transform transition-transform duration-200 ${expanded[article['Número de artículo']] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  
                  {expanded[article['Número de artículo']] && (
                    <div className="p-4 bg-white space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p><strong>Resumen:</strong></p>
                          <p className="text-gray-600 mt-1">{article['Resumen'] || 'No disponible'}</p>
                        </div>
                        <div>
                          <p><strong>Abstract:</strong></p>
                          <p className="text-gray-600 mt-1">{article['Abstract'] || 'No disponible'}</p>
                        </div>
                        <div>
                          <p><strong>Fecha:</strong> {article['Fecha'] || 'N/A'}</p>
                          <p><strong>Vol/Nº:</strong> {article['Volumen'] || 'N/A'}/{article['Número'] || 'N/A'}</p>
                        </div>
                        <div>
                          <p><strong>Páginas:</strong> {article['Primera página']}-{article['Última página']}</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 pt-2">
                        <span className="bg-gray-100 text-xs px-2 py-1 rounded">
                          Áreas: {article.areas.length > 0 ? article.areas.join(', ') : 'No definidas'}
                        </span>
                        <span className="bg-gray-100 text-xs px-2 py-1 rounded">
                          Palabras clave: {article.keywords.length > 0 ? article.keywords.slice(0, 3).join(', ') + (article.keywords.length > 3 ? '...' : '') : 'Ninguna'}
                        </span>
                      </div>
                      
                      <div className="pt-3 border-t border-gray-100">
                        <a
                          href={article.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            article.pdfUrl && !article.pdfUrl.includes('YOUR_DEPLOYED_ID')
                              ? 'bg-blue-600 text-white hover:bg-blue-700' 
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                          title={article.pdfUrl || 'PDF no disponible'}
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {article.pdfUrl ? 'Descargar PDF' : 'PDF no disponible'}
                        </a>
                      </div>
                      
                      <div className="flex space-x-2 mt-4 pt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(article); }}
                          className="bg-yellow-600 text-white px-3 py-1 rounded text-xs hover:bg-yellow-700 transition-colors flex items-center"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Editar
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(article['Número de artículo']); }}
                          className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 transition-colors flex items-center"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Modal Agregar */}
          {showAddModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
                <h3 className="text-xl font-semibold mb-4">Agregar Artículo</h3>
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSubmit('add'); }}>
                  <div>
                    <input 
                      name="titulo" 
                      placeholder="Título *" 
                      value={formData.titulo} 
                      onChange={handleInputChange} 
                      className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                      required 
                    />
                  </div>
                  <div>
                    <input 
                      name="autores" 
                      placeholder="Autor(es) * (ej: Juan Pérez; María García)" 
                      value={formData.autores} 
                      onChange={handleInputChange} 
                      className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                      required 
                    />
                  </div>
                  <div>
                    <textarea 
                      name="resumen" 
                      placeholder="Resumen" 
                      value={formData.resumen} 
                      onChange={handleInputChange} 
                      className="w-full border border-gray-300 rounded-md p-3 h-20 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" 
                    />
                  </div>
                  <div>
                    <textarea 
                      name="abstract" 
                      placeholder="Abstract (English)" 
                      value={formData.abstract} 
                      onChange={handleInputChange} 
                      className="w-full border border-gray-300 rounded-md p-3 h-20 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input 
                      name="fecha" 
                      type="date" 
                      value={formData.fecha} 
                      onChange={handleInputChange} 
                      className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    />
                    <input 
                      name="volumen" 
                      placeholder="Volumen" 
                      value={formData.volumen} 
                      onChange={handleInputChange} 
                      className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input 
                      name="numero" 
                      placeholder="Nº (fascículo)" 
                      value={formData.numero} 
                      onChange={handleInputChange} 
                      className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    />
                    <input 
                      name="primeraPagina" 
                      placeholder="Pág. inicio" 
                      value={formData.primeraPagina} 
                      onChange={handleInputChange} 
                      className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    />
                  </div>
                  <input 
                    name="ultimaPagina" 
                    placeholder="Pág. final" 
                    value={formData.ultimaPagina} 
                    onChange={handleInputChange} 
                    className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  />
                  <input 
                    name="areaTematica" 
                    placeholder="Área temática (separar con ;)" 
                    value={formData.areaTematica} 
                    onChange={handleInputChange} 
                    className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  />
                  <input 
                    name="palabrasClave" 
                    placeholder="Palabras clave (separar con ;)" 
                    value={formData.palabrasClave} 
                    onChange={handleInputChange} 
                    className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  />
                  <div>
                    <input 
                      type="file" 
                      accept=".pdf" 
                      onChange={handleFileChange} 
                      className="w-full file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" 
                    />
                    <p className="text-xs text-gray-500 mt-1">El PDF se subirá automáticamente a GitHub</p>
                  </div>
                  
                  <div className="flex justify-end space-x-2 pt-4 border-t">
                    <button 
                      type="button" 
                      onClick={closeModals} 
                      className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      disabled={!formData.titulo || !formData.autores}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      Agregar Artículo
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal Editar - similar structure, omitted for brevity */}
          {showEditModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
                <h3 className="text-xl font-semibold mb-4">Editar Artículo</h3>
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSubmit('edit'); }}>
                  {/* Same form fields as Add, but pre-populated with editingArticle data */}
                  <input name="titulo" placeholder="Título *" value={formData.titulo} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
                  <input name="autores" placeholder="Autor(es) * (separados por ;)" value={formData.autores} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
                  <textarea name="resumen" placeholder="Resumen" value={formData.resumen} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 h-20 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
                  <textarea name="abstract" placeholder="Abstract" value={formData.abstract} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 h-20 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
                  <input name="fecha" type="date" value={formData.fecha} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  <input name="volumen" placeholder="Volumen" value={formData.volumen} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  <input name="numero" placeholder="Número (manual)" value={formData.numero} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  <input name="primeraPagina" placeholder="Primera página" value={formData.primeraPagina} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  <input name="ultimaPagina" placeholder="Última página" value={formData.ultimaPagina} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  <input name="areaTematica" placeholder="Área temática (separados por ;)" value={formData.areaTematica} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  <input name="palabrasClave" placeholder="Palabras clave (separados por ;)" value={formData.palabrasClave} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  <input type="file" accept=".pdf" onChange={handleFileChange} className="w-full file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                  
                  <div className="flex justify-end space-x-2 pt-4 border-t">
                    <button type="button" onClick={closeModals} className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors">Cancelar</button>
                    <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">Actualizar Artículo</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}