// DirectorPanel completo modificado
import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { collection, onSnapshot } from "firebase/firestore";
import { db } from '../firebase';
import Admissions from './Admissions';
import MailsTeam from './MailsTeam';
const DOMAIN = 'https://www.revistacienciasestudiantes.com';
const MANAGE_ARTICLES_URL =
  'https://managearticles-ggqsq2kkua-uc.a.run.app';
const MANAGE_VOLUMES_URL = 'https://managevolumes-ggqsq2kkua-uc.a.run.app';
const REBUILD_URL = 'https://triggerrebuild-ggqsq2kkua-uc.a.run.app';
const REPO_OWNER = 'revista1919';
const REPO_NAME = 'revista1919.github.io';
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
const triggerRebuild = async () => {
  const token = await auth.currentUser.getIdToken();
  const url = REBUILD_URL;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
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
  const [volumes, setVolumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [volumeLoading, setVolumeLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [volumeExpanded, setVolumeExpanded] = useState({});
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
    area: '',
    palabras_clave: '',
    keywords_english: '',
    tipo: '',
    type: '',
    pdfFile: null,
  });
  const [showAddVolumeModal, setShowAddVolumeModal] = useState(false);
  const [showEditVolumeModal, setShowEditVolumeModal] = useState(false);
  const [editingVolume, setEditingVolume] = useState(null);
  const [volumeFormData, setVolumeFormData] = useState({
    volumen: '',
    numero: '',
    fecha: '',
    titulo: '',
    issn: '',
    editorial: '',
    englishEditorial: '',
    portada: '',
    pdfFile: null,
  });
  const [status, setStatus] = useState('');
  const [volumeStatus, setVolumeStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [volumeUploading, setVolumeUploading] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  useEffect(() => {
    if (user && user.role && user.role.includes('Director General')) {
      setHasAccess(true);
    } else {
      setHasAccess(false);
    }
  }, [user]);
  useEffect(() => {
    if (!hasAccess) return;
    setLoading(true);
    const unsubscribeArticles = onSnapshot(collection(db, 'articles'), (snapshot) => {
      const arts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setArticles(arts);
      setLoading(false);
    });
    setVolumeLoading(true);
    const unsubscribeVolumes = onSnapshot(collection(db, 'volumes'), (snapshot) => {
      const vols = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setVolumes(vols);
      setVolumeLoading(false);
    });
    return () => {
      unsubscribeArticles();
      unsubscribeVolumes();
    };
  }, [hasAccess]);
  if (!hasAccess) {
    return <div className="p-4 text-red-600">Acceso denegado. Solo para Director General.</div>;
  }
  if (loading || volumeLoading) return <div>Cargando...</div>;
  const toggleExpand = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleVolumeExpand = (id) => setVolumeExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  const handleVolumeInputChange = (e) => {
    const { name, value } = e.target;
    setVolumeFormData((prev) => {
      const newData = { ...prev, [name]: value };
      // Auto-generar título si fecha y volumen están presentes
      if (name === 'fecha' || name === 'volumen') {
        const year = new Date(newData.fecha).getFullYear();
        if (newData.volumen && year) {
          newData.titulo = `Volumen ${newData.volumen} (${year})`;
        }
      }
      return newData;
    });
  };
  const handleFileChange = (e) => setFormData((prev) => ({ ...prev, pdfFile: e.target.files[0] }));
  const handleVolumeFileChange = (e) => setVolumeFormData((prev) => ({ ...prev, pdfFile: e.target.files[0] }));
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
      area: '',
      palabras_clave: '',
      keywords_english: '',
      tipo: '',
      type: '',
      pdfFile: null,
    });
  };
  const resetVolumeForm = () => {
    setVolumeFormData({
      volumen: '',
      numero: '',
      fecha: '',
      titulo: '',
      issn: '',
      editorial: '',
      englishEditorial: '',
      portada: '',
      pdfFile: null,
    });
  };
  const handleSubmit = async (e, isVolume = false) => {
    e.preventDefault();
    const isEdit = isVolume ? !!editingVolume : !!editingArticle;
    const setU = isVolume ? setVolumeUploading : setUploading;
    const setS = isVolume ? setVolumeStatus : setStatus;
    const editing = isVolume ? editingVolume : editingArticle;
    const form = isVolume ? volumeFormData : formData;
    const url = isVolume ? MANAGE_VOLUMES_URL : MANAGE_ARTICLES_URL;
    const typeKey = isVolume ? 'volume' : 'article';
    const closeFunc = isVolume ? closeVolumeModals : closeModals;
    setU(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const pdfBase64 = form.pdfFile ? await toBase64(form.pdfFile) : null;
      let dataObj;
      if (isVolume) {
        const year = new Date(form.fecha).getFullYear();
        const autoTituloEs = form.volumen && year ? `Volumen ${form.volumen} (${year})` : form.titulo;
        const autoTituloEn = form.volumen && year ? `Volume ${form.volumen} (${year})` : form.titulo;
        dataObj = {
          titulo: autoTituloEs,
          englishTitulo: autoTituloEn,
          fecha: form.fecha, // ISO format from date input
          volumen: form.volumen,
          numero: form.numero,
          portada: form.portada,
          issn: form.issn || null,
          editorial: form.editorial || null,
          englishEditorial: form.englishEditorial || null,
        };
      } else {
        dataObj = {
          titulo: form.titulo,
          autores: form.autores,
          resumen: form.resumen,
          abstract: form.abstract,
          fecha: form.fecha,
          volumen: form.volumen,
          numero: form.numero,
          primeraPagina: form.primeraPagina,
          ultimaPagina: form.ultimaPagina,
          area: form.area,
          palabras_clave: form.palabras_clave ? form.palabras_clave.split(';').map(k => k.trim()) : [],
          keywords_english: form.keywords_english ? form.keywords_english.split(';').map(k => k.trim()) : [],
          tipo: form.tipo || '',
          type: form.type || '',
        };
      }
      const payload = {
        action: isEdit ? 'edit' : 'add',
        [typeKey]: dataObj,
        pdfBase64,
        id: isEdit ? editing.id : undefined,
      };
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }
      closeFunc();
      await triggerRebuild();
      setS('✅ Operación completada');
    } catch (err) {
      setS(`❌ Error: ${err.message}`);
    } finally {
      setU(false);
    }
  };
  const handleVolumeSubmit = (e) => handleSubmit(e, true);
  const handleDelete = async (id, isVolume = false) => {
    if (!confirm('¿Eliminar?')) return;
    const setS = isVolume ? setVolumeStatus : setStatus;
    const url = isVolume ? MANAGE_VOLUMES_URL : MANAGE_ARTICLES_URL;
    try {
      setS('Eliminando...');
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'delete', id }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }
      await triggerRebuild();
      setS('✅ Eliminado');
    } catch (err) {
      setS(`❌ Error: ${err.message}`);
    }
  };
  const handleArticleDelete = (id) => handleDelete(id);
  const handleVolumeDelete = (id) => handleDelete(id, true);
  const handleEdit = (item, isVolume = false) => {
    const setEditing = isVolume ? setEditingVolume : setEditingArticle;
    const setForm = isVolume ? setVolumeFormData : setFormData;
    const setShow = isVolume ? setShowEditVolumeModal : setShowEditModal;
    setEditing(item);
    const newForm = isVolume ? {
      titulo: item.titulo || '',
      fecha: item.fecha || '',
      volumen: item.volumen || '',
      numero: item.numero || '',
      portada: item.portada || '',
      issn: item.issn || '',
      editorial: item.editorial || '',
      englishEditorial: item.englishEditorial || '',
      pdfFile: null,
    } : {
      titulo: item.titulo || '',
      autores: item.autores || '',
      resumen: item.resumen || '',
      abstract: item.abstract || '',
      fecha: item.fecha || '',
      volumen: item.volumen || '',
      numero: item.numero || '',
      primeraPagina: item.primeraPagina || '',
      ultimaPagina: item.ultimaPagina || '',
      area: item.area || '',
      palabras_clave: item.palabras_clave ? item.palabras_clave.join('; ') : '',
      keywords_english: item.keywords_english ? item.keywords_english.join('; ') : '',
      tipo: item.tipo || '',
      type: item.type || '',
      pdfFile: null,
    };
    setForm(newForm);
    setShow(true);
  };
  const handleArticleEdit = (article) => handleEdit(article);
  const handleVolumeEdit = (volume) => handleEdit(volume, true);
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
  const handleRebuild = async () => {
    try {
      setStatus('Iniciando rebuild...');
      await triggerRebuild();
      setStatus('✅ Rebuild iniciado');
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    }
  };
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Panel del Director</h1>
          <button onClick={handleRebuild} className="mt-4 bg-green-600 text-white px-4 py-2 rounded">Rebuild Site</button>
        </div>
        {status && <div className="mb-4 p-2 bg-blue-100 text-blue-800 rounded">{status}</div>}
        {volumeStatus && <div className="mb-4 p-2 bg-blue-100 text-blue-800 rounded">{volumeStatus}</div>}
        {/* Sección Artículos */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
              <h2 className="text-lg font-medium text-gray-900">Artículos ({articles.length})</h2>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 rounded-md font-medium flex items-center space-x-2 transition-colors bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
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
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Agregar primer artículo
                </button>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {articles.map((article) => {
                  const numeroArticulo = article.numeroArticulo || article.id.slice(0, 5);
                  return (
                    <div key={article.id} className="hover:bg-gray-50">
                      <div
                        className="px-6 py-4 cursor-pointer flex justify-between items-center"
                        onClick={() => toggleExpand(article.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900 truncate" title={article.titulo}>
                            {article.titulo}
                          </h3>
                          <p className="mt-1 text-sm text-gray-500 truncate" title={article.autores}>
                            {article.autores}
                          </p>
                        </div>
                        <div className="ml-4 flex-shrink-0 flex items-center space-x-2">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            #{numeroArticulo}
                          </span>
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform ${
                              expanded[article.id] ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                      {expanded[article.id] && (
                        <div className="px-6 pb-4 bg-gray-50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-gray-900 font-medium">Resumen</p>
                              <p className="mt-1 text-gray-600">{article.resumen || 'No disponible'}</p>
                            </div>
                            <div>
                              <p className="text-gray-900 font-medium">Abstract</p>
                              <p className="mt-1 text-gray-600">{article.abstract || 'No disponible'}</p>
                            </div>
                            <div>
                              <p className="text-gray-900 font-medium">Palabras Clave</p>
                              <p className="mt-1 text-gray-600">{article.palabras_clave?.join(', ') || 'No disponible'}</p>
                            </div>
                            <div>
                              <p className="text-gray-900 font-medium">Keywords</p>
                              <p className="mt-1 text-gray-600">{article.keywords_english?.join(', ') || 'No disponible'}</p>
                            </div>
                            <div className="md:col-span-2">
                              <p className="text-gray-900 font-medium">Detalles</p>
                              <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-gray-500">Fecha</p>
                                  <p className="font-medium">{article.fecha || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Vol/Nº</p>
                                  <p className="font-medium">{`${article.volumen || 'N/A'}/${article.numero || 'N/A'}`}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Páginas</p>
                                  <p className="font-medium">{`${article.primeraPagina || ''}-${article.ultimaPagina || ''}`}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Área</p>
                                  <p className="font-medium">{article.area || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Tipo</p>
                                  <p className="font-medium">{article.tipo || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Type</p>
                                  <p className="font-medium">{article.type || 'N/A'}</p>
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
                                  article.pdfUrl ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
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
                                    handleArticleEdit(article);
                                  }}
                                  className="px-3 py-2 text-sm font-medium text-yellow-600 bg-yellow-100 hover:bg-yellow-200 rounded-md transition-colors"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleArticleDelete(article.id);
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
                  );
                })}
              </div>
            )}
          </div>
          {/* Add Modal for Articles */}
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
                  <form className="space-y-4" onSubmit={(e) => handleSubmit(e)}>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Autor(es) * (separar con ;)</label>
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
                        name="area"
                        value={formData.area}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Palabras clave (separar con ;)
                      </label>
                      <input
                        name="palabras_clave"
                        value={formData.palabras_clave}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Keywords (Inglés, separar con ;)
                      </label>
                      <input
                        name="keywords_english"
                        value={formData.keywords_english}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                      <input
                        name="tipo"
                        value={formData.tipo}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <input
                        name="type"
                        value={formData.type}
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
                      <p className="mt-1 text-xs text-gray-500">El PDF se subirá automáticamente</p>
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
          {/* Edit Modal for Articles */}
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
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Editar Artículo</h3>
                  <form className="space-y-4" onSubmit={(e) => handleSubmit(e)}>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Autor(es) * (separar con ;)</label>
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
                        name="area"
                        value={formData.area}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Palabras clave (separar con ;)
                      </label>
                      <input
                        name="palabras_clave"
                        value={formData.palabras_clave}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Keywords (Inglés, separar con ;)
                      </label>
                      <input
                        name="keywords_english"
                        value={formData.keywords_english}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                      <input
                        name="tipo"
                        value={formData.tipo}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <input
                        name="type"
                        value={formData.type}
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
                      <p className="mt-1 text-xs text-gray-500">El PDF se subirá automáticamente</p>
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
        {/* Sección Volúmenes */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mt-8">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
              <h2 className="text-lg font-medium text-gray-900">Volúmenes ({volumes.length})</h2>
              <button
                onClick={() => setShowAddVolumeModal(true)}
                className="px-4 py-2 rounded-md font-medium flex items-center space-x-2 transition-colors bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Agregar Volumen</span>
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
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hay volúmenes</h3>
                <p className="mt-1 text-sm text-gray-500">Comienza agregando tu primer volumen.</p>
                <button
                  onClick={() => setShowAddVolumeModal(true)}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Agregar primer volumen
                </button>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {volumes.map((volume) => (
                  <div key={volume.id} className="hover:bg-gray-50">
                    <div
                      className="px-6 py-4 cursor-pointer flex justify-between items-center"
                      onClick={() => toggleVolumeExpand(volume.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate" title={volume.titulo}>
                          {volume.titulo}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500 truncate" title={volume.volumen}>
                          Volumen {volume.volumen}, Número {volume.numero}
                        </p>
                      </div>
                      <div className="ml-4 flex-shrink-0 flex items-center space-x-2">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          #{volume.numero}
                        </span>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${
                            volumeExpanded[volume.id] ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {volumeExpanded[volume.id] && (
                      <div className="px-6 pb-4 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {volume.editorial && (
                            <div>
                              <p className="text-gray-900 font-medium">Nota Editorial</p>
                              <p className="mt-1 text-gray-600">{volume.editorial || 'No disponible'}</p>
                            </div>
                          )}
                          {volume.englishEditorial && (
                            <div>
                              <p className="text-gray-900 font-medium">Editorial Note</p>
                              <p className="mt-1 text-gray-600">{volume.englishEditorial || 'No disponible'}</p>
                            </div>
                          )}
                          <div className="md:col-span-2">
                            <p className="text-gray-900 font-medium">Detalles</p>
                            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-500">Fecha</p>
                                <p className="font-medium">{volume.fecha || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Vol/Nº</p>
                                <p className="font-medium">{`${volume.volumen || 'N/A'}/${volume.numero || 'N/A'}`}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Portada</p>
                                <p className="font-medium">{volume.portada || 'N/A'}</p>
                              </div>
                              {volume.issn && (
                                <div>
                                  <p className="text-gray-500">ISSN</p>
                                  <p className="font-medium">{volume.issn || 'N/A'}</p>
                                </div>
                              )}
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
                                volume.pdf ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
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
                                Editar
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVolumeDelete(volume.id);
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
          </div>
          {/* Add Modal for Volumes */}
          {showAddVolumeModal && (
            <div
              className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
              onClick={closeVolumeModals}
            >
              <div
                className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Agregar Nuevo Volumen</h3>
                  <form className="space-y-4" onSubmit={handleVolumeSubmit}>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Volumen *</label>
                      <input
                        name="volumen"
                        value={volumeFormData.volumen}
                        onChange={handleVolumeInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Número *</label>
                      <input
                        name="numero"
                        value={volumeFormData.numero}
                        onChange={handleVolumeInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                      <input
                        name="fecha"
                        type="date"
                        value={volumeFormData.fecha}
                        onChange={handleVolumeInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Título (auto-generado si vacío)</label>
                      <input
                        name="titulo"
                        value={volumeFormData.titulo}
                        onChange={handleVolumeInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ISSN (opcional)</label>
                      <input
                        name="issn"
                        value={volumeFormData.issn}
                        onChange={handleVolumeInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nota Editorial (opcional)</label>
                      <textarea
                        name="editorial"
                        value={volumeFormData.editorial}
                        onChange={handleVolumeInputChange}
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Editorial Note (opcional)</label>
                      <textarea
                        name="englishEditorial"
                        value={volumeFormData.englishEditorial}
                        onChange={handleVolumeInputChange}
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Portada (URL, opcional)</label>
                      <input
                        name="portada"
                        value={volumeFormData.portada}
                        onChange={handleVolumeInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Archivo PDF (opcional)</label>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleVolumeFileChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      <p className="mt-1 text-xs text-gray-500">El PDF se subirá automáticamente</p>
                    </div>
                    <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={closeVolumeModals}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={!volumeFormData.volumen.trim() || !volumeFormData.numero.trim() || volumeUploading}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {volumeUploading ? 'Procesando...' : 'Agregar Volumen'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
          {/* Edit Modal for Volumes */}
          {showEditVolumeModal && editingVolume && (
            <div
              className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
              onClick={closeVolumeModals}
            >
              <div
                className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Editar Volumen</h3>
                  <form className="space-y-4" onSubmit={handleVolumeSubmit}>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Volumen *</label>
                      <input
                        name="volumen"
                        value={volumeFormData.volumen}
                        onChange={handleVolumeInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Número *</label>
                      <input
                        name="numero"
                        value={volumeFormData.numero}
                        onChange={handleVolumeInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                      <input
                        name="fecha"
                        type="date"
                        value={volumeFormData.fecha}
                        onChange={handleVolumeInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Título (auto-generado si vacío)</label>
                      <input
                        name="titulo"
                        value={volumeFormData.titulo}
                        onChange={handleVolumeInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ISSN (opcional)</label>
                      <input
                        name="issn"
                        value={volumeFormData.issn}
                        onChange={handleVolumeInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nota Editorial (opcional)</label>
                      <textarea
                        name="editorial"
                        value={volumeFormData.editorial}
                        onChange={handleVolumeInputChange}
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Editorial Note (opcional)</label>
                      <textarea
                        name="englishEditorial"
                        value={volumeFormData.englishEditorial}
                        onChange={handleVolumeInputChange}
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Portada (URL, opcional)</label>
                      <input
                        name="portada"
                        value={volumeFormData.portada}
                        onChange={handleVolumeInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Archivo PDF (opcional)</label>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleVolumeFileChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      <p className="mt-1 text-xs text-gray-500">El PDF se subirá automáticamente</p>
                    </div>
                    <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={closeVolumeModals}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={!volumeFormData.volumen.trim() || !volumeFormData.numero.trim() || volumeUploading}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {volumeUploading ? 'Actualizando...' : 'Actualizar Volumen'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
        <MailsTeam />
        <Admissions />
      </div>
    </div>
  );
}