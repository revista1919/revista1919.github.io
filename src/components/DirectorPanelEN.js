import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import Admissions from './AdmissionsEN';
import MailsTeam from './MailsTeamEN';

// ✅ Environment variables
const ARTICULOS_GAS_URL = process.env.REACT_APP_ARTICULOS_SCRIPT_URL || '';
const VOLUMES_GAS_URL = process.env.REACT_APP_VOLUMES_SCRIPT_URL || '';
const GH_TOKEN = process.env.REACT_APP_GH_TOKEN || '';
const ARTICULOS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv';
const VOLUMES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTTs7eHa-_bbWkSzOxaM26oi79ioBYFyTcNB0EaEBt0VYWZeCZq2S4FUnaHXcB8lf2T78XhET9v5WTh/pub?output=csv';
const GH_API_BASE = 'https://api.github.com/repos/revista1919/revista1919.github.io/contents';
const REPO_OWNER = 'revista1919';
const REPO_NAME = 'revista1919.github.io';
const DOMAIN = 'https://www.revistacienciasestudiantes.com';

const generateSlug = (name) => {
  if (!name) return '';
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^\w-]/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
};

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

// GitHub API Functions
const uploadPDFToGitHub = async (base64Content, fileName, message, sha = null, folder = 'Articles') => {
  if (!GH_TOKEN) throw new Error('GitHub token not available');
  
  const path = `public/${folder}/${fileName}`;
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

const deletePDFFromGitHub = async (fileName, message, folder = 'Articles') => {
  if (!GH_TOKEN) throw new Error('GitHub token not available');
  
  const path = `public/${folder}/${fileName}`;
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
  if (!GH_TOKEN) throw new Error('GitHub token not available');
  
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

export default function DirectorPanelEN({ user }) {
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
    keywords: '',
    pdfFile: null,
  });
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);

  const [volumes, setVolumes] = useState([]);
  const [volumeLoading, setVolumeLoading] = useState(true);
  const [volumeExpanded, setVolumeExpanded] = useState({});
  const [showAddVolumeModal, setShowAddVolumeModal] = useState(false);
  const [showEditVolumeModal, setShowEditVolumeModal] = useState(false);
  const [editingVolume, setEditingVolume] = useState(null);
  const [volumeFormData, setVolumeFormData] = useState({
    volumen: '',
    numero: '',
    fecha: '',
    titulo: '',
    resumen: '',
    abstract: '',
    portada: '',
    areaTematica: '',
    palabrasClave: '',
    keywords: '',
    pdfFile: null,
  });
  const [volumeStatus, setVolumeStatus] = useState('');
  const [volumeUploading, setVolumeUploading] = useState(false);

  useEffect(() => {
    console.log('🔍 DirectorPanel Config:', {
      ARTICULOS_GAS: ARTICULOS_GAS_URL ? 'Set' : 'Missing',
      VOLUMES_GAS: VOLUMES_GAS_URL ? 'Set' : 'Missing',
      GH_TOKEN: GH_TOKEN ? 'Set' : 'Missing',
    });
  }, []);

  useEffect(() => {
    fetchArticles();
    fetchVolumes();
  }, []);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const response = await fetch(ARTICULOS_CSV_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to fetch articles CSV: ${response.status}`);
      const csvText = await response.text();
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
      const enriched = parsed.map(row => ({
        ...row,
        pdfUrl: row['PDF'] || `${DOMAIN}/Articles/Article-${generateSlug(row['Título'])}-${row['Número de artículo']}.pdf`,
      }));
      setArticles(enriched);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVolumes = async () => {
    try {
      setVolumeLoading(true);
      const response = await fetch(VOLUMES_CSV_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to fetch volumes CSV: ${response.status}`);
      const csvText = await response.text();
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
      const enriched = parsed.map(row => ({
        ...row,
        pdf: row['PDF'] || `${DOMAIN}/Volumes/Volume-${row['Volumen']}-${row['Número']}.pdf`,
      }));
      setVolumes(enriched);
    } catch (err) {
      setVolumeStatus(`Error: ${err.message}`);
      console.error(err);
    } finally {
      setVolumeLoading(false);
    }
  };

  const toggleExpand = (numero) => setExpanded(prev => ({ ...prev, [numero]: !prev[numero] }));

  const toggleVolumeExpand = (numero) => setVolumeExpanded(prev => ({ ...prev, [numero]: !prev[numero] }));

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleVolumeInputChange = (e) => {
    const { name, value } = e.target;
    setVolumeFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => setFormData(prev => ({ ...prev, pdfFile: e.target.files[0] }));

  const handleVolumeFileChange = (e) => setVolumeFormData(prev => ({ ...prev, pdfFile: e.target.files[0] }));

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
      keywords: '',
      pdfFile: null,
    });
  };

  const resetVolumeForm = () => {
    setVolumeFormData({
      volumen: '',
      numero: '',
      fecha: '',
      titulo: '',
      resumen: '',
      abstract: '',
      portada: '',
      areaTematica: '',
      palabrasClave: '',
      keywords: '',
      pdfFile: null,
    });
  };

  const updatePDFUrlInSheet = async (numero, pdfUrl, gasUrl = ARTICULOS_GAS_URL) => {
    if (!gasUrl) return;
    try {
      const data = { action: 'update_pdf_url', numero: parseInt(numero), pdfUrl };
      await fetch(gasUrl, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'text/plain' },
      });
    } catch (err) {
      console.error(err);
    }
  };

  const submitToSheet = async (action, dataObj, numero = null, gasUrl = ARTICULOS_GAS_URL, type = 'article') => {
    if (!gasUrl) throw new Error('GAS URL missing');
    const data = { action, [type]: dataObj, ...(numero && { numero }) };
    const response = await fetch(gasUrl, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'text/plain' },
    });
    const text = await response.text();
    if (text.includes('error')) throw new Error(text);
    await new Promise(r => setTimeout(r, 1000));
  };

  const handleSubmit = async (action = 'add', gasUrl = ARTICULOS_GAS_URL, form = formData, setU = setUploading, setS = setStatus, folder = 'Articles', fetchFunc = fetchArticles, closeFunc = closeModals, type = 'article', editing = editingArticle) => {
    if (!form.titulo?.trim()) {
      setS('❌ Title required');
      return;
    }
    setU(true);
    try {
      setS('Processing...');
      const dataObj = { ...form, pdfFile: null, urlPdf: '' };
      let num;
      if (action === 'add') {
        await submitToSheet('add', dataObj, null, gasUrl, type);
        await new Promise(r => setTimeout(r, 3000));
        await fetchFunc();
        const items = type === 'article' ? articles : volumes;
        const nums = items.map(i => parseInt(i['Número'] || '0')).filter(n => !isNaN(n));
        num = Math.max(...nums, 0) + 1;
      } else {
        num = editing['Número'];
        await submitToSheet('edit', dataObj, num, gasUrl, type);
      }
      let pdfUrl = null;
      if (form.pdfFile) {
        const base64 = await toBase64(form.pdfFile);
        const slug = `${generateSlug(form.titulo)}-${num}`;
        const fileName = `${type.charAt(0).toUpperCase() + type.slice(1)}-${slug}.pdf`;
        await uploadPDFToGitHub(base64, fileName, `${action} PDF for ${type} ${num}`, null, folder);
        pdfUrl = `${DOMAIN}/${folder}/${fileName}`;
        await updatePDFUrlInSheet(num, pdfUrl, gasUrl);
      }
      closeFunc();
      await fetchFunc();
      if (GH_TOKEN) await triggerRebuild();
      setS('✅ Operation completed');
    } catch (err) {
      setS(`❌ Error: ${err.message}`);
    } finally {
      setU(false);
    }
  };

  const handleVolumeSubmit = async (action = 'add') => {
    await handleSubmit(action, VOLUMES_GAS_URL, volumeFormData, setVolumeUploading, setVolumeStatus, 'Volumes', fetchVolumes, closeVolumeModals, 'volume', editingVolume);
  };

  const handleEdit = (item, setEditing, setForm, setShow, fields) => {
    setEditing(item);
    const newForm = {};
    fields.forEach(f => newForm[f] = item[f.toUpperCase().charAt(0) + f.slice(1)] || '');
    setForm({ ...newForm, pdfFile: null });
    setShow(true);
  };

  const handleVolumeEdit = (volume) => handleEdit(volume, setEditingVolume, setVolumeFormData, setShowEditVolumeModal, ['volumen', 'numero', 'fecha', 'titulo', 'resumen', 'abstract', 'portada', 'areaTematica', 'palabrasClave', 'keywords']);

  const handleDelete = async (numero, gasUrl, folder, fetchFunc, setS) => {
    if (!confirm('Delete?')) return;
    try {
      setS('Deleting...');
      const data = { action: 'delete', numero: parseInt(numero) };
      await fetch(gasUrl, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'text/plain' } });
      if (GH_TOKEN) {
        const items = gasUrl === ARTICULOS_GAS_URL ? articles : volumes;
        const item = items.find(i => i['Número'] === numero.toString());
        if (item) {
          const slug = `${generateSlug(item['Título'])}-${numero}`;
          const fileName = `${gasUrl === ARTICULOS_GAS_URL ? 'Article' : 'Volume'}-${slug}.pdf`;
          await deletePDFFromGitHub(fileName, `Delete PDF for ${gasUrl === ARTICULOS_GAS_URL ? 'article' : 'volume'} ${numero}`, folder);
        }
      }
      await fetchFunc();
      setS('✅ Deleted');
    } catch (err) {
      setS(`❌ Error: ${err.message}`);
    }
  };

  const handleVolumeDelete = async (numero) => await handleDelete(numero, VOLUMES_GAS_URL, 'Volumes', fetchVolumes, setVolumeStatus);

  const handleRebuild = async () => {
    try {
      setStatus('Starting rebuild...');
      await triggerRebuild();
      setStatus('✅ Rebuild started');
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    }
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setEditingArticle(null);
    resetForm();
  };

  const closeVolumeModals = () => {
    setShowAddVolumeModal(false);
    setShowEditVolumeModal(false);
    setEditingVolume(null);
    resetVolumeForm();
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
          <h3 className="text-sm font-medium text-yellow-800">Configuration Required</h3>
          <div className="mt-2 text-sm text-yellow-700 space-y-1">
            <p>
              ✅ GAS Articles:{' '}
              <span className={ARTICULOS_GAS_URL ? 'text-green-600' : 'text-red-600'}>
                {ARTICULOS_GAS_URL ? 'Configured' : 'Missing'}
              </span>
            </p>
            <p>
              ✅ GAS Volumes:{' '}
              <span className={VOLUMES_GAS_URL ? 'text-green-600' : 'text-red-600'}>
                {VOLUMES_GAS_URL ? 'Configured' : 'Missing'}
              </span>
            </p>
            <p>
              ✅ GitHub Token:{' '}
              <span className={GH_TOKEN ? 'text-green-600' : 'text-red-600'}>
                {GH_TOKEN ? 'Configured' : 'Missing'}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading || volumeLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading content...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {(!ARTICULOS_GAS_URL || !VOLUMES_GAS_URL || !GH_TOKEN) && <ConfigStatus />}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Director Dashboard</h1>
              <p className="mt-2 text-sm text-gray-600">Manage articles and journal content</p>
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
        {status && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              status.includes('Error') || status.includes('❌')
                ? 'bg-red-50 border border-red-200 text-red-800'
                : status.includes('Uploading') || status.includes('Processing')
                ? 'bg-blue-50 border border-blue-200 text-blue-800'
                : 'bg-green-50 border border-green-200 text-green-800'
            }`}
          >
            {status}
          </div>
        )}
        {volumeStatus && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              volumeStatus.includes('Error') || volumeStatus.includes('❌')
                ? 'bg-red-50 border border-red-200 text-red-800'
                : volumeStatus.includes('Uploading') || volumeStatus.includes('Processing')
                ? 'bg-blue-50 border border-blue-200 text-blue-800'
                : 'bg-green-50 border border-green-200 text-green-800'
            }`}
          >
            {volumeStatus}
          </div>
        )}
        {uploading && (
          <div className="fixed top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-50 border">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-sm font-medium text-gray-900">Uploading...</span>
            </div>
          </div>
        )}
        {volumeUploading && (
          <div className="fixed top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-50 border">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-sm font-medium text-gray-900">Uploading...</span>
            </div>
          </div>
        )}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
              <h2 className="text-lg font-medium text-gray-900">Articles ({articles.length})</h2>
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
                <span>Add Article</span>
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
                <h3 className="mt-2 text-sm font-medium text-gray-900">No Articles</h3>
                <p className="mt-1 text-sm text-gray-500">Start by adding your first article.</p>
                {ARTICULOS_GAS_URL && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Add First Article
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
                            <p className="text-gray-900 font-medium">Abstract (Spanish)</p>
                            <p className="mt-1 text-gray-600">{article['Resumen'] || 'Not available'}</p>
                          </div>
                          <div>
                            <p className="text-gray-900 font-medium">Abstract (English)</p>
                            <p className="mt-1 text-gray-600">{article['Abstract'] || 'Not available'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-gray-900 font-medium">Details</p>
                            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-500">Date</p>
                                <p className="font-medium">{article['Fecha'] || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Volume/Issue</p>
                                <p className="font-medium">{`${article['Volumen'] || 'N/A'}/${article['Número'] || 'N/A'}`}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Pages</p>
                                <p className="font-medium">{`${article['Primera página'] || ''}-${article['Última página'] || ''}`}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Thematic Areas</p>
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
                                Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(article['Número de artículo']);
                                }}
                                className="px-3 py-2 text-sm font-medium text-red-600 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
                              >
                                Delete
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
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden mt-8">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
              <h2 className="text-lg font-medium text-gray-900">Volumes ({volumes.length})</h2>
              <button
                onClick={() => setShowAddVolumeModal(true)}
                disabled={!VOLUMES_GAS_URL}
                className={`px-4 py-2 rounded-md font-medium flex items-center space-x-2 transition-colors ${
                  VOLUMES_GAS_URL
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Volume</span>
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {volumes.length === 0 ? (
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
                <h3 className="mt-2 text-sm font-medium text-gray-900">No Volumes</h3>
                <p className="mt-1 text-sm text-gray-500">Start by adding your first volume.</p>
                {VOLUMES_GAS_URL && (
                  <button
                    onClick={() => setShowAddVolumeModal(true)}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Add First Volume
                  </button>
                )}
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {volumes.map((volume, index) => (
                  <div key={index} className="hover:bg-gray-50">
                    <div
                      className="px-6 py-4 cursor-pointer flex justify-between items-center"
                      onClick={() => toggleVolumeExpand(volume['Número'])}
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate" title={volume['Título']}>
                          {volume['Título']}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500 truncate">
                          Volume {volume['Volumen']} Issue {volume['Número']}
                        </p>
                      </div>
                      <div className="ml-4 flex-shrink-0 flex items-center space-x-2">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          #{volume['Número']}
                        </span>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${
                            volumeExpanded[volume['Número']] ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {volumeExpanded[volume['Número']] && (
                      <div className="px-6 pb-4 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-900 font-medium">Abstract (Spanish)</p>
                            <p className="mt-1 text-gray-600">{volume['Resumen'] || 'Not available'}</p>
                          </div>
                          <div>
                            <p className="text-gray-900 font-medium">Abstract (English)</p>
                            <p className="mt-1 text-gray-600">{volume['Abstract'] || 'Not available'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-gray-900 font-medium">Details</p>
                            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-500">Date</p>
                                <p className="font-medium">{volume['Fecha'] || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Volume/Issue</p>
                                <p className="font-medium">{`${volume['Volumen'] || 'N/A'}/${volume['Número'] || 'N/A'}`}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Cover</p>
                                <p className="font-medium">{volume['Portada'] || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Thematic Area</p>
                                <p className="font-medium">{volume['Área temática'] || 'N/A'}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="flex justify-between items-center">
                            <a
                              href={volume.pdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md transition-colors ${
                                volume.pdf.startsWith('http')
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
                                  handleVolumeEdit(volume);
                                }}
                                className="px-3 py-2 text-sm font-medium text-yellow-600 bg-yellow-100 hover:bg-yellow-200 rounded-md transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVolumeDelete(volume['Número']);
                                }}
                                className="px-3 py-2 text-sm font-medium text-red-600 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
                              >
                                Delete
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
          </div>
        </div>
        <MailsTeam />
        <Admissions />
      </div>
    </div>
  );
}