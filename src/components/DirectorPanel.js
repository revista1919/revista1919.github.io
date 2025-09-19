import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

// ✅ Variables de entorno inyectadas por Webpack DefinePlugin
const ARTICULOS_GAS_URL = process.env.REACT_APP_ARTICULOS_SCRIPT_URL || '';
const GH_TOKEN = process.env.REACT_APP_GH_TOKEN || '';
const ARTICULOS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv';
const GH_API_BASE = 'https://api.github.com/repos/revista1919/revista1919.github.io/contents';
const REPO_OWNER = 'revista1919';
const REPO_NAME = 'revista1919.github.io';

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

// GitHub API Functions
const uploadPDFToGitHub = async (base64Content, fileName, message, sha = null) => {
  if (!GH_TOKEN) throw new Error('GitHub token no disponible');
  
  const path = `Articles/${fileName}`;
  const url = `${GH_API_BASE}/${path}`;
  const payload = {
    message,
    content: base64Content,
    ...(sha && { sha }),
  };
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${response.status} - ${errorText}`);
  }
  
  return await response.json();
};

const deletePDFFromGitHub = async (fileName, message) => {
  if (!GH_TOKEN) throw new Error('GitHub token no disponible');
  
  const path = `Articles/${fileName}`;
  const url = `${GH_API_BASE}/${path}`;
  
  const getRes = await fetch(url, {
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  
  if (getRes.status === 404) {
    console.log('ℹ️ PDF not found, skipping delete:', fileName);
    return;
  }
  
  if (!getRes.ok) throw new Error(`Failed to get file info: ${getRes.status}`);
  
  const file = await getRes.json();
  const payload = { message, sha: file.sha };
  
  const delRes = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  
  if (!delRes.ok) throw new Error(`Delete failed: ${delRes.status}`);
};

const triggerRebuild = async () => {
  if (!GH_TOKEN) throw new Error('GitHub token no disponible');
  
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/dispatches`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ event_type: 'rebuild' }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Rebuild failed: ${response.status} - ${errorText}`);
  }
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
    pdfFile: null,
  });
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);

  // ✅ Debug logging movido dentro del componente
  useEffect(() => {
    console.log('🔍 DirectorPanel Config:', {
      GAS_URL: ARTICULOS_GAS_URL ? `${ARTICULOS_GAS_URL.slice(0, 40)}...` : 'MISSING',
      HAS_TOKEN: !!GH_TOKEN,
      TOKEN_LENGTH: GH_TOKEN ? `${GH_TOKEN.length} chars` : '0',
      READY: !!(ARTICULOS_GAS_URL && GH_TOKEN),
    });
  }, []);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      console.log('📥 Loading articles from Google Sheets...');
      
      const response = await fetch(ARTICULOS_CSV_URL, {
        cache: 'no-store',
        headers: { Accept: 'text/csv' },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch CSV: ${response.status}`);
      }
      
      const csvText = await response.text();
      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
      }).data;
      
      console.log(`📊 Loaded ${parsed.length} articles`);
      
      const enrichedArticles = parsed.map((row) => ({
        ...row,
        areas: (row['Área temática'] || '').split(';').map((a) => a.trim()).filter(Boolean),
        keywords: (row['Palabras clave'] || '').split(';').map((k) => k.trim()).filter(Boolean),
        pdfUrl: row['URL_PDF'] || `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/Articles/Articulo${row['Número de artículo']}.pdf`,
      }));
      
      setArticles(enrichedArticles);
      setStatus('');
    } catch (err) {
      console.error('❌ Error loading articles:', err);
      setStatus(`Error loading articles: ${err.message}`);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (numero) => {
    setExpanded((prev) => ({ ...prev, [numero]: !prev[numero] }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setFormData((prev) => ({ ...prev, pdfFile: e.target.files[0] }));
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
      pdfFile: null,
    });
  };

  const updatePDFUrlInSheet = async (numero, pdfUrl) => {
    if (!ARTICULOS_GAS_URL) {
      console.warn('⚠️ No GAS URL, skipping PDF URL update');
      return;
    }
    
    try {
      const data = {
  action: 'update_pdf_url',
  numero: parseInt(numero),
  pdfUrl,
};
await fetch(ARTICULOS_GAS_URL, {
  method: 'POST',
  redirect: 'follow',
  body: JSON.stringify(data),
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
});
console.log('✅ PDF URL updated in sheet:', numero, pdfUrl);
    } catch (err) {
      console.error('❌ Failed to update PDF URL:', err);
    }
  };

  const submitToSheet = async (action, articleData, numero = null) => {
    if (!ARTICULOS_GAS_URL) {
      throw new Error('Google Apps Script URL no configurada');
    }

    const data = {
      action,
      article: articleData,
      ...(numero && { numero }),
    };

    console.log(`📄 Submitting to GAS: ${action}`, { hasNumero: !!numero });
    
    const response = await fetch(ARTICULOS_GAS_URL, {
  method: 'POST',
  redirect: 'follow',  // Para manejar redirects de GAS
  body: JSON.stringify(data),
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
});

  const resText = await response.text();
if (resText.includes('error')) {
  throw new Error(`GAS error: ${resText}`);
}

    // Wait for sync
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await fetchArticles();
  };

  const handleSubmit = async (action = 'add') => {
    if (!formData.titulo.trim() || !formData.autores.trim()) {
      setStatus('❌ Título y autor(es) son obligatorios');
      return;
    }

    if (!ARTICULOS_GAS_URL) {
      setStatus('❌ Google Apps Script no configurado');
      return;
    }

    setUploading(true);
    try {
      setStatus('Procesando...');
      console.log(`🚀 ${action === 'add' ? 'Adding' : 'Editing'} article...`);
      
      const articleData = {
        titulo: formData.titulo.trim(),
        autores: formData.autores.trim(),
        resumen: formData.resumen || '',
        abstract: formData.abstract || '',
        fecha: formData.fecha,
        volumen: formData.volumen || '',
        numero: formData.numero || '',
        primeraPagina: formData.primeraPagina || '',
        ultimaPagina: formData.ultimaPagina || '',
        areaTematica: formData.areaTematica || '',
        palabrasClave: formData.palabrasClave || '',
        urlPdf: '',
      };

      let articleNumber;
      if (action === 'add') {
        await submitToSheet('add', articleData);
        await new Promise(resolve => setTimeout(resolve, 3000));  // Espera 3 segundos para propagación
        // Get the new article number after refresh
        await fetchArticles();
        const nums = articles.map(a => parseInt(a['Número de artículo'] || '0', 10)).filter(n => !isNaN(n) && isFinite(n));
const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
articleNumber = maxNum + 1;
console.log('🆕 Calculated articleNumber:', articleNumber, 'from nums:', nums);
        console.log('🆕 New article number:', articleNumber);
      } else {
        articleNumber = editingArticle['Número de artículo'];
        await submitToSheet('edit', articleData, articleNumber);
      }

      // Handle PDF upload
      let pdfUrl = null;
      if (formData.pdfFile) {
        if (!GH_TOKEN) {
          setStatus('✅ Metadata guardado. Sube PDF manualmente.');
          return;
        }

        setStatus('Subiendo PDF...');
        const base64 = await toBase64(formData.pdfFile);
        const fileName = `Articulo${articleNumber}.pdf`;
        const message = `${action === 'add' ? 'Add' : 'Update'} PDF for article ${articleNumber}`;
        
        await uploadPDFToGitHub(base64, fileName, message);
        pdfUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/Articles/${fileName}`;
        await updatePDFUrlInSheet(articleNumber, pdfUrl);
        
        console.log('✅ PDF uploaded:', pdfUrl);
        setStatus(`✅ ${action === 'add' ? 'Artículo agregado' : 'Artículo actualizado'} con PDF`);
      } else {
        setStatus(`✅ ${action === 'add' ? 'Artículo agregado' : 'Artículo actualizado'}`);
      }

      closeModals();
      await fetchArticles();
      if (GH_TOKEN) {
  await triggerRebuild();
  setStatus(`${status} y rebuild iniciado.`);
}
      
    } catch (err) {
      console.error('💥 Submit error:', err);
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (article) => {
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
      pdfFile: null,
    });
    setShowEditModal(true);
  };

  const handleDelete = async (numero) => {
    if (!confirm(`¿Eliminar artículo #${numero}?`)) return;
    
    if (!ARTICULOS_GAS_URL) {
      setStatus('❌ Google Apps Script no configurado');
      return;
    }

    try {
      setStatus('Eliminando...');
      
      // Delete from sheet
      const data = { action: 'delete', numero: parseInt(numero) };
      await fetch(ARTICULOS_GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      // Delete PDF if exists
      if (GH_TOKEN) {
        await deletePDFFromGitHub(`Articulo${numero}.pdf`, `Delete PDF for article ${numero}`);
      }
      
      setStatus('✅ Artículo eliminado');
      await fetchArticles();
      
    } catch (err) {
      console.error('💥 Delete error:', err);
      setStatus(`❌ Error: ${err.message}`);
    }
  };

  const handleRebuild = async () => {
    if (!GH_TOKEN) {
      setStatus('❌ GitHub token no configurado');
      return;
    }

    try {
      setStatus('Iniciando rebuild...');
      await triggerRebuild();
      setStatus('✅ Rebuild iniciado');
    } catch (err) {
      console.error('💥 Rebuild error:', err);
      setStatus(`❌ Error: ${err.message}`);
    }
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setEditingArticle(null);
    resetForm();
  };

  // Config status component
  const ConfigStatus = () => (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <div className="flex items-center space-x-2">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">Configuración requerida</h3>
          <div className="mt-2 text-sm text-yellow-700 space-y-1">
            <p>
              ✅ Google Apps Script:{' '}
              <span className={ARTICULOS_GAS_URL ? 'text-green-600' : 'text-red-600'}>
                {ARTICULOS_GAS_URL ? 'Configurado' : 'Falta configurar'}
              </span>
            </p>
            <p>
              ✅ GitHub Token:{' '}
              <span className={GH_TOKEN ? 'text-green-600' : 'text-red-600'}>
                {GH_TOKEN ? 'Configurado' : 'Falta configurar'}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando artículos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Config Status */}
        {(!ARTICULOS_GAS_URL || !GH_TOKEN) && <ConfigStatus />}

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Panel del Director</h1>
              <p className="mt-2 text-sm text-gray-600">Gestiona artículos y contenido de la revista</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleRebuild}
                disabled={!GH_TOKEN}
                className={`px-4 py-2 rounded-md font-medium flex items-center space-x-2 transition-colors ${
                  GH_TOKEN
                    ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>Rebuild Site</span>
              </button>
            </div>
          </div>
        </div>

        {/* Status Message */}
        {status && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              status.includes('Error') || status.includes('❌')
                ? 'bg-red-50 border border-red-200 text-red-800'
                : status.includes('Subiendo') || status.includes('Procesando')
                ? 'bg-blue-50 border border-blue-200 text-blue-800'
                : 'bg-green-50 border border-green-200 text-green-800'
            }`}
          >
            {status}
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="fixed top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-50 border">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-sm font-medium text-gray-900">Subiendo...</span>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
              <h2 className="text-lg font-medium text-gray-900">Artículos ({articles.length})</h2>
              <button
                onClick={() => setShowAddModal(true)}
                disabled={!ARTICULOS_GAS_URL}
                className={`px-4 py-2 rounded-md font-medium flex items-center space-x-2 transition-colors ${
                  ARTICULOS_GAS_URL
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Agregar Artículo</span>
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {articles.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hay artículos</h3>
                <p className="mt-1 text-sm text-gray-500">Comienza agregando tu primer artículo.</p>
                {ARTICULOS_GAS_URL && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Agregar primer artículo
                  </button>
                )}
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {articles.map((article, index) => (
                  <div key={index} className="hover:bg-gray-50">
                    <div
                      className="px-6 py-4 cursor-pointer flex justify-between items-center"
                      onClick={() => toggleExpand(article['Número de artículo'])}
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate" title={article['Título']}>
                          {article['Título']}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500 truncate" title={article['Autor(es)']}>
                          {article['Autor(es)']}
                        </p>
                      </div>
                      <div className="ml-4 flex-shrink-0 flex items-center space-x-2">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          #{article['Número de artículo']}
                        </span>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${
                            expanded[article['Número de artículo']] ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {expanded[article['Número de artículo']] && (
                      <div className="px-6 pb-4 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-900 font-medium">Resumen</p>
                            <p className="mt-1 text-gray-600">{article['Resumen'] || 'No disponible'}</p>
                          </div>
                          <div>
                            <p className="text-gray-900 font-medium">Abstract</p>
                            <p className="mt-1 text-gray-600">{article['Abstract'] || 'No disponible'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-gray-900 font-medium">Detalles</p>
                            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-500">Fecha</p>
                                <p className="font-medium">{article['Fecha'] || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Vol/Nº</p>
                                <p className="font-medium">{`${article['Volumen'] || 'N/A'}/${article['Número'] || 'N/A'}`}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Páginas</p>
                                <p className="font-medium">{`${article['Primera página'] || ''}-${article['Última página'] || ''}`}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Áreas</p>
                                <p className="font-medium">{article.areas.length ? article.areas.join(', ') : 'N/A'}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="flex justify-between items-center">
                            <a
                              href={article.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md transition-colors ${
                                article.pdfUrl.startsWith('http')
                                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                            >
                              <svg
                                className="w-4 h-4 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                              PDF
                            </a>
                            <div className="flex space-x-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(article);
                                }}
                                className="px-3 py-2 text-sm font-medium text-yellow-600 bg-yellow-100 hover:bg-yellow-200 rounded-md transition-colors"
                              >
                                Editar
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(article['Número de artículo']);
                                }}
                                className="px-3 py-2 text-sm font-medium text-red-600 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add Modal */}
            {showAddModal && (
              <div
                className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
                onClick={closeModals}
              >
                <div
                  className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mt-3">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Agregar Nuevo Artículo</h3>
                    <form
                      className="space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSubmit('add');
                      }}
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                        <input
                          name="titulo"
                          value={formData.titulo}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Autor(es) * (separar con ;)
                        </label>
                        <input
                          name="autores"
                          value={formData.autores}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                          <input
                            name="fecha"
                            type="date"
                            value={formData.fecha}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Volumen</label>
                          <input
                            name="volumen"
                            value={formData.volumen}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Número (fascículo)
                          </label>
                          <input
                            name="numero"
                            value={formData.numero}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Páginas</label>
                          <input
                            name="primeraPagina"
                            placeholder="Inicio"
                            value={formData.primeraPagina}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                          <input
                            name="ultimaPagina"
                            placeholder="Final"
                            value={formData.ultimaPagina}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 mt-1"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Área temática (separar con ;)
                        </label>
                        <input
                          name="areaTematica"
                          value={formData.areaTematica}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Palabras clave (separar con ;)
                        </label>
                        <input
                          name="palabrasClave"
                          value={formData.palabrasClave}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Resumen</label>
                        <textarea
                          name="resumen"
                          value={formData.resumen}
                          onChange={handleInputChange}
                          rows="3"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Abstract (English)
                        </label>
                        <textarea
                          name="abstract"
                          value={formData.abstract}
                          onChange={handleInputChange}
                          rows="3"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Archivo PDF</label>
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={handleFileChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        <p className="mt-1 text-xs text-gray-500">El PDF se subirá automáticamente a GitHub</p>
                      </div>

                      <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
                        <button
                          type="button"
                          onClick={closeModals}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={!formData.titulo.trim() || !formData.autores.trim() || uploading}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {uploading ? 'Procesando...' : 'Agregar Artículo'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Modal */}
            {showEditModal && editingArticle && (
              <div
                className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
                onClick={closeModals}
              >
                <div
                  className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mt-3">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Editar Artículo #{editingArticle['Número de artículo']}
                    </h3>
                    <form
                      className="space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSubmit('edit');
                      }}
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                        <input
                          name="titulo"
                          value={formData.titulo}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Autor(es) * (separar con ;)
                        </label>
                        <input
                          name="autores"
                          value={formData.autores}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                          <input
                            name="fecha"
                            type="date"
                            value={formData.fecha}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Volumen</label>
                          <input
                            name="volumen"
                            value={formData.volumen}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Número (fascículo)
                          </label>
                          <input
                            name="numero"
                            value={formData.numero}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Páginas</label>
                          <input
                            name="primeraPagina"
                            placeholder="Inicio"
                            value={formData.primeraPagina}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                          <input
                            name="ultimaPagina"
                            placeholder="Final"
                            value={formData.ultimaPagina}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 mt-1"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Área temática (separar con ;)
                        </label>
                        <input
                          name="areaTematica"
                          value={formData.areaTematica}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Palabras clave (separar con ;)
                        </label>
                        <input
                          name="palabrasClave"
                          value={formData.palabrasClave}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Resumen</label>
                        <textarea
                          name="resumen"
                          value={formData.resumen}
                          onChange={handleInputChange}
                          rows="3"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Abstract (English)
                        </label>
                        <textarea
                          name="abstract"
                          value={formData.abstract}
                          onChange={handleInputChange}
                          rows="3"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Archivo PDF</label>
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={handleFileChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        <p className="mt-1 text-xs text-gray-500">El PDF se subirá automáticamente a GitHub</p>
                      </div>

                      <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
                        <button
                          type="button"
                          onClick={closeModals}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={!formData.titulo.trim() || !formData.autores.trim() || uploading}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {uploading ? 'Actualizando...' : 'Actualizar Artículo'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}