import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const TEAM_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';
const TEAM_GAS_URL = process.env.REACT_APP_TEAM_SCRIPT_URL || '';

export default function MailsTeam() {
  const [team, setTeam] = useState([]);
  const [directorGeneral, setDirectorGeneral] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectAll, setSelectAll] = useState(true);
  const [selected, setSelected] = useState([]);
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [manualEmail, setManualEmail] = useState('');

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
      const filteredTeam = parsed.filter(member => {
        if (!member['Rol en la Revista']) return false;
        const roles = member['Rol en la Revista'].split(';').map(role => role.trim());
        return roles.some(role => ['Revisor', 'Editor de Sección', 'Editor en Jefe'].includes(role));
      });
      const director = parsed.find(member => 
        member['Rol en la Revista']?.split(';').map(role => role.trim()).includes('Director General')
      );
      setTeam(filteredTeam);
      setDirectorGeneral(director ? director.Nombre : 'General Director');
      setSelected(filteredTeam.map(member => member.Correo));
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    setSelectAll(!selectAll);
    setSelected(!selectAll ? team.map(member => member.Correo) : manualEmail ? [manualEmail] : []);
  };

  const toggleSelect = (email) => {
    setSelected(prev => 
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const addManualEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!manualEmail.trim() || !emailRegex.test(manualEmail)) {
      setStatus('❌ Please enter a valid email address');
      return;
    }
    if (selected.includes(manualEmail)) {
      setStatus('❌ Email already added');
      return;
    }
    setSelected(prev => [...prev, manualEmail]);
    setManualEmail('');
    setStatus('✅ Email added manually');
  };

  const sendEmail = async () => {
    if (!subject.trim() || !body.trim() || selected.length === 0) {
      setStatus('❌ Subject, message, and recipients are required');
      return;
    }
    if (!TEAM_GAS_URL) {
      setStatus('❌ GAS URL not configured');
      return;
    }
    setSending(true);
    try {
      const formattedBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); overflow: hidden; }
            .header { background: linear-gradient(135deg, #1e3a8a, #3b82f6); padding: 20px; text-align: center; }
            .header h1 { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 24px; color: #ffffff; margin: 0; font-weight: 500; letter-spacing: 1px; }
            .subheader { background-color: #f8fafc; padding: 10px 20px; border-bottom: 1px solid #e2e8f0; }
            .subheader p { font-family: 'Georgia', serif; font-size: 14px; color: #475569; margin: 0; }
            .content { font-family: 'Georgia', serif; padding: 30px; color: #1f2937; font-size: 16px; line-height: 1.7; }
            .content p { margin: 10px 0; }
            .content a { color: #2563eb; text-decoration: none; font-weight: 500; }
            .content a:hover { text-decoration: underline; }
            .signature { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
            .signature p { font-family: 'Georgia', serif; font-size: 14px; color: #1f2937; margin: 5px 0; }
            .signature .title { font-weight: bold; }
            .footer { background-color: #1e3a8a; padding: 15px; text-align: center; }
            .footer p { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #ffffff; margin: 0; opacity: 0.8; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${subject}</h1>
            </div>
            <div class="subheader">
              <p>The National Review of Sciences for Students</p>
            </div>
            <div class="content">
              ${body}
              <div class="signature">
                <p>Sincerely,</p>
                <p class="title">General Director</p>
                <p>${directorGeneral}</p>
                <p>The National Review of Sciences for Students</p>
                <p><a href="https://www.revistacienciasestudiantes.com/#/en">www.revistacienciasestudiantes.com</a></p>
              </div>
            </div>
            <div class="footer">
              <p>The National Review of Sciences for Students | &copy; ${new Date().getFullYear()}</p>
            </div>
          </div>
        </body>
        </html>
      `;
      const base64Body = btoa(unescape(encodeURIComponent(formattedBody)));
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
      setStatus('✅ Email sent');
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
    setManualEmail('');
    setStatus('');
  };

  if (loading) return <div className="p-4 text-center">Loading team...</div>;

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
        <span>Send Email to Team</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50" onClick={closeModal}>
          <div 
            className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col" 
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-gray-900 mb-4">Send Email</h3>
            <div className="flex-1 space-y-4 overflow-y-auto">
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <input
                    type="text"
                    placeholder="Add email manually"
                    value={manualEmail}
                    onChange={e => setManualEmail(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={addManualEmail}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    Add
                  </button>
                </div>
                <div
                  onClick={toggleSelectAll}
                  className={`cursor-pointer px-4 py-2 border rounded-md flex items-center space-x-2 transition-colors ${
                    selectAll ? 'bg-indigo-100 border-indigo-500' : 'bg-gray-100 border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-900">Send to all ({team.length})</span>
                </div>
                {!selectAll && (
                  <div className="mt-2 max-h-48 overflow-y-auto border rounded-md p-3 bg-gray-50">
                    {team.map((member, index) => {
                      const roles = member['Rol en la Revista']?.split(';').map(role => role.trim()) || [];
                      return (
                        <div
                          key={index}
                          className="flex items-center space-x-3 py-2 border-b last:border-b-0 hover:bg-gray-100"
                        >
                          <input
                            type="checkbox"
                            checked={selected.includes(member.Correo)}
                            onChange={() => toggleSelect(member.Correo)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                          />
                          {member.Imagen && (
                            <img
                              src={member.Imagen}
                              alt={member.Nombre}
                              className="w-10 h-10 rounded-full object-cover border border-gray-200"
                              onError={(e) => (e.target.src = 'https://via.placeholder.com/40')}
                            />
                          )}
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">{member.Nombre}</div>
                            <div className="text-xs text-gray-500">{roles.join(', ')}</div>
                          </div>
                        </div>
                      );
                    })}
                    {manualEmail && selected.includes(manualEmail) && (
                      <div className="flex items-center space-x-3 py-2 border-b last:border-b-0 hover:bg-gray-100">
                        <input
                          type="checkbox"
                          checked={selected.includes(manualEmail)}
                          onChange={() => toggleSelect(manualEmail)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{manualEmail}</div>
                          <div className="text-xs text-gray-500">Manual recipient</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <input
                type="text"
                placeholder="Subject"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="h-40 mb-4"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                onClick={closeModal}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={sendEmail}
                disabled={sending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
            {status && <p className="text-sm text-gray-600 mt-2 text-center">{status}</p>}
          </div>
        </div>
      )}
    </div>
  );
}