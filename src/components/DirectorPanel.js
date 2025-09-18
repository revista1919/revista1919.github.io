// DirectorPanel.js
import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

const ARTICULOS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv';
const ARTICULOS_GAS_URL = (typeof process !== 'undefined' && process.env.REACT_APP_ARTICULOS_SCRIPT_URL) 
  ? process.env.REACT_APP_ARTICULOS_SCRIPT_URL 
  : 'https://script.google.com/macros/s/YOUR_DEPLOYED_ID/exec';
const toBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = error => reject(error);
});

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
      const response = await fetch(ARTICULOS_CSV_URL, { cache: 'no-store' });
      const csvText = await response.text();
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
      setArticles(parsed.map(row => ({
        ...row,
        areas: row['Área temática'] ? row['Área temática'].split(';').map(a => a.trim()).filter(Boolean) : [],
        keywords: row['Palabras clave'] ? row['Palabras clave'].split(';').map(k => k.trim()).filter(Boolean) : []
      })));
    } catch (err) {
      console.error('Error fetching articles:', err);
      setStatus('Error al cargar artículos');
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

  const handleSubmit = async (action = 'add') => {
    if (!formData.titulo || !formData.autores || !formData.pdfFile) {
      setStatus('Campos obligatorios faltantes');
      return;
    }
    try {
      setStatus('Procesando...');
      let pdfBase64 = '';
      if (formData.pdfFile) {
        pdfBase64 = await toBase64(formData.pdfFile);
      }
      const data = {
        action,
        article: {
          titulo: formData.titulo,
          autores: formData.autores,
          resumen: formData.resumen,
          abstract: formData.abstract,
          fecha: formData.fecha,
          volumen: formData.volumen,
          numero: action === 'add' ? '' : formData.numero, // Auto para add
          primeraPagina: formData.primeraPagina,
          ultimaPagina: formData.ultimaPagina,
          areaTematica: formData.areaTematica,
          palabrasClave: formData.palabrasClave
        },
        pdfBase64,
        ...(action === 'edit' && { numero: editingArticle.numeroArticulo })
      };
      const response = await fetch(ARTICULOS_GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      setStatus('Operación completada exitosamente');
      fetchArticles();
      closeModals();
    } catch (err) {
      console.error('Error submitting:', err);
      setStatus('Error en la operación');
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
      numero: article['Número de artículo'] || '',
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
      const data = { action: 'delete', numero: parseInt(numero) };
      await fetch(ARTICULOS_GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      setStatus('Artículo eliminado y renumerado');
      fetchArticles();
    } catch (err) {
      console.error('Error deleting:', err);
      setStatus('Error al eliminar');
    }
  };

  const handleRebuild = async () => {
    try {
      setStatus('Iniciando actualización...');
      const data = { action: 'rebuild' };
      await fetch(ARTICULOS_GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      setStatus('Actualización de página iniciada');
    } catch (err) {
      console.error('Error rebuilding:', err);
      setStatus('Error al actualizar página');
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
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Panel del Director General</h2>
          <button
            onClick={handleRebuild}
            className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors font-medium flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Actualizar Página</span>
          </button>
        </div>
        {status && (
          <div className={`p-4 rounded-md mb-6 ${status.includes('Error') || status.includes('elimin') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {status}
          </div>
        )}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-800">Artículos Archivados</h3>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Agregar Artículo</span>
            </button>
          </div>
          <div className="space-y-4">
            {articles.map((article, index) => (
              <div key={index} className="border border-gray-200 rounded-md overflow-hidden">
                <div
                  className="p-4 cursor-pointer bg-gray-50 hover:bg-gray-100 flex justify-between items-center"
                  onClick={() => toggleExpand(article['Número de artículo'])}
                >
                  <div>
                    <h4 className="font-medium text-gray-800">{article['Título']}</h4>
                    <p className="text-sm text-gray-600">{article['Autor(es)']}</p>
                  </div>
                  <svg className={`w-5 h-5 transform transition-transform ${expanded[article['Número de artículo']] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {expanded[article['Número de artículo']] && (
                  <div className="p-4 bg-white space-y-2 text-sm">
                    <p><strong>Resumen:</strong> {article['Resumen']}</p>
                    <p><strong>Abstract:</strong> {article['Abstract']}</p>
                    <p><strong>Fecha:</strong> {article['Fecha']}</p>
                    <p><strong>Volumen/Número:</strong> {article['Volumen']}/{article['Número']}</p>
                    <p><strong>Páginas:</strong> {article['Primera página']}-{article['Última página']}</p>
                    <p><strong>Áreas:</strong> {article.areas.join(', ')}</p>
                    <p><strong>Palabras clave:</strong> {article.keywords.join(', ')}</p>
                    <a
                      href={`https://www.revistacienciasestudiantes.com/Articles/Articulo${article['Número de artículo']}.pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Descargar PDF
                    </a>
                    <div className="flex space-x-2 mt-4">
                      <button
                        onClick={() => handleEdit(article)}
                        className="bg-yellow-600 text-white px-3 py-1 rounded text-xs hover:bg-yellow-700"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(article['Número de artículo'])}
                        className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Modal Agregar */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-screen overflow-y-auto">
              <h3 className="text-xl font-semibold mb-4">Agregar Artículo</h3>
              <div className="space-y-4">
                <input name="titulo" placeholder="Título" value={formData.titulo} onChange={handleInputChange} className="w-full border rounded-md p-2" required />
                <input name="autores" placeholder="Autor(es) (separados por ;)" value={formData.autores} onChange={handleInputChange} className="w-full border rounded-md p-2" required />
                <textarea name="resumen" placeholder="Resumen" value={formData.resumen} onChange={handleInputChange} className="w-full border rounded-md p-2 h-20" />
                <textarea name="abstract" placeholder="Abstract" value={formData.abstract} onChange={handleInputChange} className="w-full border rounded-md p-2 h-20" />
                <input name="fecha" type="date" value={formData.fecha} onChange={handleInputChange} className="w-full border rounded-md p-2" />
                <input name="volumen" placeholder="Volumen" value={formData.volumen} onChange={handleInputChange} className="w-full border rounded-md p-2" />
                <input name="numero" placeholder="Número (auto)" value={formData.numero} onChange={handleInputChange} className="w-full border rounded-md p-2" disabled />
                <input name="primeraPagina" placeholder="Primera página" value={formData.primeraPagina} onChange={handleInputChange} className="w-full border rounded-md p-2" />
                <input name="ultimaPagina" placeholder="Última página" value={formData.ultimaPagina} onChange={handleInputChange} className="w-full border rounded-md p-2" />
                <input name="areaTematica" placeholder="Área temática (separados por ;)" value={formData.areaTematica} onChange={handleInputChange} className="w-full border rounded-md p-2" />
                <input name="palabrasClave" placeholder="Palabras clave (separados por ;)" value={formData.palabrasClave} onChange={handleInputChange} className="w-full border rounded-md p-2" />
                <input type="file" accept=".pdf" onChange={handleFileChange} className="w-full" required />
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button onClick={closeModals} className="px-4 py-2 bg-gray-300 rounded-md">Cancelar</button>
                <button onClick={() => handleSubmit('add')} className="px-4 py-2 bg-blue-600 text-white rounded-md">Agregar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Editar */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-screen overflow-y-auto">
              <h3 className="text-xl font-semibold mb-4">Editar Artículo</h3>
              <div className="space-y-4">
                <input name="titulo" placeholder="Título" value={formData.titulo} onChange={handleInputChange} className="w-full border rounded-md p-2" required />
                <input name="autores" placeholder="Autor(es) (separados por ;)" value={formData.autores} onChange={handleInputChange} className="w-full border rounded-md p-2" required />
                <textarea name="resumen" placeholder="Resumen" value={formData.resumen} onChange={handleInputChange} className="w-full border rounded-md p-2 h-20" />
                <textarea name="abstract" placeholder="Abstract" value={formData.abstract} onChange={handleInputChange} className="w-full border rounded-md p-2 h-20" />
                <input name="fecha" type="date" value={formData.fecha} onChange={handleInputChange} className="w-full border rounded-md p-2" />
                <input name="volumen" placeholder="Volumen" value={formData.volumen} onChange={handleInputChange} className="w-full border rounded-md p-2" />
                <input name="numero" placeholder="Número" value={formData.numero} onChange={handleInputChange} className="w-full border rounded-md p-2" disabled />
                <input name="primeraPagina" placeholder="Primera página" value={formData.primeraPagina} onChange={handleInputChange} className="w-full border rounded-md p-2" />
                <input name="ultimaPagina" placeholder="Última página" value={formData.ultimaPagina} onChange={handleInputChange} className="w-full border rounded-md p-2" />
                <input name="areaTematica" placeholder="Área temática (separados por ;)" value={formData.areaTematica} onChange={handleInputChange} className="w-full border rounded-md p-2" />
                <input name="palabrasClave" placeholder="Palabras clave (separados por ;)" value={formData.palabrasClave} onChange={handleInputChange} className="w-full border rounded-md p-2" />
                <input type="file" accept=".pdf" onChange={handleFileChange} className="w-full" />
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button onClick={closeModals} className="px-4 py-2 bg-gray-300 rounded-md">Cancelar</button>
                <button onClick={() => handleSubmit('edit')} className="px-4 py-2 bg-blue-600 text-white rounded-md">Actualizar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}