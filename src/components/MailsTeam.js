// MailsTeam.js
import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const TEAM_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';
const TEAM_GAS_URL = process.env.REACT_APP_TEAM_SCRIPT_URL || '';

export default function MailsTeam() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectAll, setSelectAll] = useState(true);
  const [selected, setSelected] = useState([]);
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    try {
      setLoading(true);
      const response = await fetch(TEAM_CSV_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch team');
      const csvText = await response.text();
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
      setTeam(parsed.filter(member => member.Rol && (member.Rol.includes('Editor') || member.Rol.includes('Revisor'))));
      setSelected(parsed.map(member => member.Correo));
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    setSelectAll(!selectAll);
    setSelected(selectAll ? [] : team.map(member => member.Correo));
  };

  const toggleSelect = (email) => {
    setSelected(prev => 
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const sendEmail = async () => {
    if (!subject.trim() || !body.trim() || selected.length === 0) {
      setStatus('❌ Asunto, mensaje y destinatarios requeridos');
      return;
    }
    if (!TEAM_GAS_URL) {
      setStatus('❌ GAS URL no configurada');
      return;
    }
    setSending(true);
    try {
      const base64Body = btoa(unescape(encodeURIComponent(body)));
      await fetch(TEAM_GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'send_custom_email',
          to: selected,
          subject,
          htmlBody: base64Body,
        }),
      });
      setStatus('✅ Correo enviado');
      closeModal();
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSubject('');
    setBody('');
    setSelectAll(true);
    setSelected(team.map(member => member.Correo));
    setStatus('');
  };

  if (loading) return <div className="p-4 text-center">Cargando equipo...</div>;

  return (
    <div className="mt-8">
      <button
        onClick={() => setShowModal(true)}
        disabled={!TEAM_GAS_URL}
        className={`px-4 py-2 rounded-md font-medium flex items-center space-x-2 transition-colors ${
          TEAM_GAS_URL ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span>Enviar Correo al Equipo</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50" onClick={closeModal}>
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Enviar Correo</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Asunto"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
              <ReactQuill
                value={body}
                onChange={setBody}
                modules={{
                  toolbar: [
                    [{ header: [1, 2, false] }],
                    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    ['link', 'image'],
                    ['clean']
                  ]
                }}
                theme="snow"
              />
              <div>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} />
                  <span>Enviar a todos ({team.length})</span>
                </label>
                {!selectAll && (
                  <div className="mt-2 max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
                    {team.map((member, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(member.Correo)}
                          onChange={() => toggleSelect(member.Correo)}
                        />
                        {member.Imagen && <img src={member.Imagen} alt={member.Nombre} className="w-8 h-8 rounded-full" />}
                        <span>{member.Nombre} ({member.Correo})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-3">
                <button onClick={closeModal} className="px-4 py-2 border rounded-md">Cancelar</button>
                <button
                  onClick={sendEmail}
                  disabled={sending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
                >
                  {sending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
              {status && <p className="text-sm text-gray-600">{status}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}