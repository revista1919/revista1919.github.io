// Admissions.js
import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

const APPLICATIONS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNuBETm7TapO6dakKBbkxlYTZctAGGEp4SnOyGowCYXfD_lAXHta8_LX5EPjy0xXw5fpKp3MPcRduK/pub?gid=2123840957&single=true&output=csv';
const TEAM_CSV_URL = 'https://docs.google.com/spreadsheets/d/1FIP4yMTNYtRYWiPwovWGPiWxQZ8wssko8u0-NkZOido/pub?gid=0&single=true&output=csv';
const TEAM_GAS_URL = process.env.REACT_APP_TEAM_SCRIPT_URL || '';
const APPLICATIONS_GAS_URL = process.env.REACT_APP_APPLICATIONS_SCRIPT_URL || '';

export default function Admissions() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedApp, setExpandedApp] = useState(null);
  const [status, setStatus] = useState('');
  const [minimized, setMinimized] = useState(true);
  const [sending, setSending] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({});
  const [teamEmails, setTeamEmails] = useState(new Set());

  useEffect(() => {
    if (!minimized) {
      fetchData();
    }
  }, [minimized]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [appsRes, teamRes] = await Promise.all([
        fetch(APPLICATIONS_CSV_URL, { cache: 'no-store' }),
        fetch(TEAM_CSV_URL, { cache: 'no-store' })
      ]);
      if (!appsRes.ok) throw new Error('Failed to fetch applications');
      if (!teamRes.ok) throw new Error('Failed to fetch team');
      const appsText = await appsRes.text();
      const teamText = await teamRes.text();
      const parsedApps = Papa.parse(appsText, { header: true, skipEmptyLines: true }).data;
      const parsedTeam = Papa.parse(teamText, { header: true, skipEmptyLines: true }).data;
      const emails = new Set(parsedTeam.map(t => t.Correo?.trim().toLowerCase() || ''));
      const enhancedApps = parsedApps.map(app => ({
        ...app,
        isArchived: emails.has(app['Correo electrónico']?.trim().toLowerCase() || '')
      }));
      setApplications(enhancedApps);
      setTeamEmails(emails);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleMinimized = () => setMinimized(!minimized);

  const toggleExpandApp = (index) => {
    setExpandedApp(expandedApp === index ? null : index);
  };

  const sendPreselection = async (name) => {
    if (!APPLICATIONS_GAS_URL) {
      setStatus('❌ GAS URL no configurada');
      return;
    }
    if (!confirm(`¿Enviar correo de preselección a ${name}?`)) return;
    setSending(true);
    try {
      await fetch(APPLICATIONS_GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'aceptar_postulante', name }),
      });
      setStatus('✅ Preselección enviada');
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const acceptAndRequestData = async (app) => {
    if (!TEAM_GAS_URL) {
      setStatus('❌ GAS URL no configurada');
      return;
    }
    if (!confirm(`¿Aceptar a ${app.Nombre} y solicitar datos?`)) return;
    setSending(true);
    try {
      // Add to team
      await fetch(TEAM_GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'add_team_member',
          name: app.Nombre,
          role: app['Cargo al que desea postular'],
          email: app['Correo electrónico'],
        }),
      });
      // Send acceptance and request data
      await fetch(TEAM_GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'solicitar_datos',
          type: 'team',
          name: app.Nombre,
        }),
      });
      setStatus('✅ Aceptado y solicitud enviada');
      fetchData(); // Refresh to update archived status
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const openAddModal = (app) => {
    setFormData({
      name: app.Nombre,
      email: app['Correo electrónico'],
      role: app['Cargo al que desea postular'],
      description: '',
      areas: '',
      image: ''
    });
    setShowAddModal(true);
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddSubmit = async () => {
    if (!TEAM_GAS_URL) {
      setStatus('❌ GAS URL no configurada');
      return;
    }
    if (!confirm(`¿Agregar ${formData.name} al equipo?`)) return;
    setSending(true);
    try {
      await fetch(TEAM_GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'add_and_accept_team',
          name: formData.name,
          description: formData.description,
          areas: formData.areas,
          role: formData.role,
          email: formData.email,
          image: formData.image
        }),
      });
      setStatus('✅ Agregado al equipo y correo enviado');
      setShowAddModal(false);
      fetchData(); // Refresh to update archived status
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-8 bg-white rounded-lg shadow-sm overflow-hidden">
      <div 
        className="px-6 py-5 border-b border-gray-200 flex justify-between items-center cursor-pointer"
        onClick={toggleMinimized}
      >
        <h2 className="text-lg font-medium text-gray-900">Gestionar Postulaciones ({applications.length})</h2>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${minimized ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {!minimized && (
        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-gray-600">Cargando...</div>
          ) : applications.length === 0 ? (
            <div className="p-6 text-center text-gray-600">No hay postulaciones</div>
          ) : (
            applications.map((app, index) => (
              <div key={index} className={`hover:bg-gray-50 ${app.isArchived ? 'bg-gray-100' : ''}`}>
                <div
                  className="px-6 py-4 cursor-pointer flex justify-between items-center"
                  onClick={() => toggleExpandApp(index)}
                >
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">
                      {app.Nombre}
                      {app.isArchived && <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Ya en el equipo</span>}
                    </h3>
                    <p className="text-sm text-gray-500">{app['Cargo al que desea postular']}</p>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${expandedApp === index ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {expandedApp === index && (
                  <div className="px-6 pb-4 bg-gray-50">
                    <div className="grid grid-cols-1 gap-4 text-sm">
                      <div>
                        <p className="text-gray-900 font-medium">Correo</p>
                        <p className="text-gray-600">{app['Correo electrónico']}</p>
                      </div>
                      <div>
                        <p className="text-gray-900 font-medium">Establecimiento</p>
                        <p className="text-gray-600">{app['Establecimiento educativo']}</p>
                      </div>
                      <div>
                        <p className="text-gray-900 font-medium">Teléfono</p>
                        <p className="text-gray-600">{app['Número de teléfono']}</p>
                      </div>
                      <div>
                        <p className="text-gray-900 font-medium">Carta de Motivación</p>
                        <p className="text-gray-600 whitespace-pre-wrap">{app['Breve carta de motivación (por qué desea este cargo) y listado de logros. 250-500 palabras.']}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex space-x-3">
                      <button
                        onClick={() => sendPreselection(app.Nombre)}
                        disabled={sending || app.isArchived || !APPLICATIONS_GAS_URL}
                        className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200 disabled:opacity-50"
                      >
                        Enviar Preselección
                      </button>
                      <button
                        onClick={() => acceptAndRequestData(app)}
                        disabled={sending || app.isArchived || !TEAM_GAS_URL}
                        className="px-4 py-2 text-sm font-medium text-green-600 bg-green-100 rounded-md hover:bg-green-200 disabled:opacity-50"
                      >
                        Aceptar y Solicitar Datos
                      </button>
                      <button
                        onClick={() => openAddModal(app)}
                        disabled={sending || app.isArchived || !TEAM_GAS_URL}
                        className="px-4 py-2 text-sm font-medium text-purple-600 bg-purple-100 rounded-md hover:bg-purple-200 disabled:opacity-50"
                      >
                        Agregar al Equipo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
      {status && <div className="p-4 text-center text-sm text-gray-600">{status}</div>}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-bold mb-4">Agregar al Equipo</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre</label>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleFormChange} 
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Correo</label>
                <input 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  readOnly 
                  className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Rol en la Revista</label>
                <input 
                  type="text" 
                  name="role" 
                  value={formData.role} 
                  onChange={handleFormChange} 
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Descripción</label>
                <textarea 
                  name="description" 
                  value={formData.description} 
                  onChange={handleFormChange} 
                  rows={4} 
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Áreas de interés</label>
                <input 
                  type="text" 
                  name="areas" 
                  value={formData.areas} 
                  onChange={handleFormChange} 
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" 
                  placeholder="Separadas por comas, ej: Historia de las ideas, Física teórica"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Imagen (link)</label>
                <input 
                  type="url" 
                  name="image" 
                  value={formData.image} 
                  onChange={handleFormChange} 
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" 
                />
                <p className="mt-2 text-sm text-gray-500">
                  Si no tienes el link de la imagen, <a href="https://postimages.org/es/" target="_blank" className="text-blue-600 hover:underline">créalo aquí</a>
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  onClick={handleAddSubmit} 
                  disabled={sending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  Agregar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}