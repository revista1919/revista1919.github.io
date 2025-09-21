// Admissions.js
import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

const APPLICATIONS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNuBETm7TapO6dakKBbkxlYTZctAGGEp4SnOyGowCYXfD_lAXHta8_LX5EPjy0xXw5fpKp3MPcRduK/pub?gid=2123840957&single=true&output=csv';
const TEAM_GAS_URL = process.env.REACT_APP_TEAM_SCRIPT_URL || '';
const APPLICATIONS_GAS_URL = process.env.REACT_APP_APPLICATIONS_SCRIPT_URL || '';

export default function Admissions() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedApp, setExpandedApp] = useState(null);
  const [status, setStatus] = useState('');
  const [minimized, setMinimized] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!minimized) {
      fetchApplications();
    }
  }, [minimized]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await fetch(APPLICATIONS_CSV_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch applications');
      const csvText = await response.text();
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
      setApplications(parsed);
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
              <div key={index} className="hover:bg-gray-50">
                <div
                  className="px-6 py-4 cursor-pointer flex justify-between items-center"
                  onClick={() => toggleExpandApp(index)}
                >
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">{app.Nombre}</h3>
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
                        disabled={sending || !APPLICATIONS_GAS_URL}
                        className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200 disabled:opacity-50"
                      >
                        Enviar Preselección
                      </button>
                      <button
                        onClick={() => acceptAndRequestData(app)}
                        disabled={sending || !TEAM_GAS_URL}
                        className="px-4 py-2 text-sm font-medium text-green-600 bg-green-100 rounded-md hover:bg-green-200 disabled:opacity-50"
                      >
                        Aceptar y Solicitar Datos
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
    </div>
  );
}