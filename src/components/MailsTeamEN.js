import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import ReactQuill from 'react-quill';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [manualEmails, setManualEmails] = useState([]); // Added to track multiple manuals properly

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
        return roles.some(role => ['Revisor', 'Editor de Sección', 'Editor en Jefe', 'Director General'].includes(role));
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
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    if (newSelectAll) {
      setSelected([...team.map(member => member.Correo), ...manualEmails]);
    } else {
      setSelected(manualEmails); // Preserve manuals when deselecting all team
    }
  };

  const toggleSelect = (email) => {
    setSelected(prev => 
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const addManualEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmed = manualEmail.trim();
    if (!trimmed || !emailRegex.test(trimmed)) {
      setStatus('❌ Please enter a valid email address');
      return;
    }
    if (selected.includes(trimmed) || manualEmails.includes(trimmed)) {
      setStatus('❌ Email already added');
      return;
    }
    setManualEmails(prev => [...prev, trimmed]);
    setSelected(prev => [...prev, trimmed]);
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
    // TEMPLATE DE CORREO ESTILO "NATURE / ELSEVIER"
    const formattedBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { margin: 0; padding: 0; background-color: #f9f9f9; -webkit-font-smoothing: antialiased; }
          .wrapper { background-color: #f9f9f9; padding: 40px 10px; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-top: 4px solid #007398; }
          .header { padding: 30px 40px; text-align: center; border-bottom: 1px solid #f0f0f0; }
          .journal-name { font-family: 'Times New Roman', Times, serif; font-size: 12px; text-transform: uppercase; letter-spacing: 3px; color: #666; margin-bottom: 10px; display: block; }
          .subject-title { font-family: 'Times New Roman', Times, serif; font-size: 28px; color: #111; margin: 0; font-weight: normal; line-height: 1.2; }
          .content { padding: 40px; font-family: 'Georgia', serif; font-size: 16px; line-height: 1.8; color: #333; }
          .content a { color: #007398; text-decoration: none; border-bottom: 1px solid #007398; }
          .signature-area { margin-top: 40px; padding-top: 20px; border-top: 1px solid #f0f0f0; font-style: italic; }
          .footer { padding: 30px; background-color: #1a1a1a; text-align: center; }
          .footer p { font-family: Arial, sans-serif; font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 1px; margin: 0; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <span class="journal-name">The National Review of Sciences for Students</span>
              <h1 class="subject-title">${subject}</h1>
            </div>
            <div class="content">
              ${body}
              <div class="signature-area">
                <p>Cordially,<br>
                <strong>${directorGeneral}</strong><br>
                General Director<br>
                <small style="text-transform: uppercase; font-style: normal; font-family: sans-serif; font-size: 10px; color: #888;">Editorial Body</small></p>
              </div>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} TNRS | Open Access to Science</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    try {
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
      setStatus('✅ Communication sent successfully');
      setTimeout(closeModal, 2000);
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
    setManualEmails([]);
    setStatus('');
  };

  if (loading) return <div className="p-4 text-center">Loading team...</div>;

  return (
    <div className="mt-8">
      {/* Botón Principal Estilo Académico */}
      <button
        onClick={() => setShowModal(true)}
        disabled={!TEAM_GAS_URL}
        className={`group relative px-6 py-3 bg-white border border-gray-900 text-gray-900 text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-gray-900 hover:text-white transition-all duration-300 rounded-sm ${
          TEAM_GAS_URL ? '' : 'opacity-50 cursor-not-allowed'
        }`}
      >
        <span className="flex items-center gap-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Draft Official Communication
        </span>
      </button>
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={closeModal}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-4xl shadow-2xl rounded-sm overflow-hidden flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header Modal */}
              <div className="bg-gray-50 border-b border-gray-100 px-8 py-4 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-serif text-gray-900">New Editorial Communication</h3>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Internal Correspondence Management</p>
                </div>
                <button onClick={closeModal} className="text-gray-400 hover:text-black transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Panel Izquierdo: Configuración y Destinatarios */}
                <div className="lg:col-span-5 space-y-6 border-r border-gray-100 pr-8">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Selected Recipients</label>
                    <div className="flex items-center justify-between mb-4 bg-[#f0f7f9] p-3 border border-[#007398]/20">
                      <span className="text-xs font-serif italic text-gray-700">{selected.length} team members</span>
                      <input
                        type="checkbox" checked={selectAll}
                        onChange={toggleSelectAll}
                        className="accent-[#007398]"
                      />
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {team.map((member, i) => {
                        const roles = member['Rol en la Revista']?.split(';').map(role => role.trim()) || [];
                        return (
                          <div key={i} className="flex items-center gap-3 p-2 hover:bg-gray-50 border-b border-gray-50 transition-colors">
                            <input
                              type="checkbox" checked={selected.includes(member.Correo)}
                              onChange={() => toggleSelect(member.Correo)}
                              className="accent-[#007398]"
                            />
                            {member.Imagen && (
                              <img 
                                src={member.Imagen} 
                                alt={member.Nombre} 
                                className="w-8 h-8 rounded-full grayscale object-cover border border-gray-200" 
                                onError={(e) => (e.target.src = 'https://via.placeholder.com/40')}
                              />
                            )}
                            <div className="overflow-hidden">
                              <p className="text-[11px] font-bold text-gray-800 truncate">{member.Nombre}</p>
                              <p className="text-[9px] text-[#007398] uppercase tracking-tighter truncate">{roles.join(', ')}</p>
                            </div>
                          </div>
                        );
                      })}
                      {manualEmails.map((email, i) => (
                        <div key={`manual-${i}`} className="flex items-center gap-3 p-2 hover:bg-gray-50 border-b border-gray-50 transition-colors">
                          <input
                            type="checkbox" checked={selected.includes(email)}
                            onChange={() => toggleSelect(email)}
                            className="accent-[#007398]"
                          />
                          <div className="overflow-hidden">
                            <p className="text-[11px] font-bold text-gray-800 truncate">{email}</p>
                            <p className="text-[9px] text-[#007398] uppercase tracking-tighter truncate">Manual recipient</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-100">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Add External Email</label>
                    <div className="flex gap-2">
                      <input
                        type="text" value={manualEmail} onChange={e => setManualEmail(e.target.value)}
                        className="flex-1 px-3 py-2 text-xs border border-gray-200 focus:border-[#007398] outline-none transition-all rounded-sm"
                        placeholder="example@university.edu"
                      />
                      <button onClick={addManualEmail} className="px-3 py-2 bg-gray-100 text-[10px] font-bold uppercase rounded-sm hover:bg-gray-200">Add</button>
                    </div>
                  </div>
                </div>
                {/* Panel Derecho: Editor */}
                <div className="lg:col-span-7 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Subject of the Communication</label>
                    <input
                      type="text" value={subject} onChange={e => setSubject(e.target.value)}
                      placeholder="E.g.: Call for Peer Review - Vol. 4"
                      className="w-full px-4 py-3 text-sm font-serif border border-gray-200 focus:border-[#007398] outline-none transition-all rounded-sm bg-gray-50/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Message Body</label>
                    <div className="quill-modern-wrapper">
                      <ReactQuill
                        value={body} onChange={setBody}
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
                        className="h-64 mb-12 font-serif text-lg"
                      />
                    </div>
                  </div>
                </div>
              </div>
              {/* Footer Modal con Status */}
              <div className="bg-gray-50 border-t border-gray-100 px-8 py-4 flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${status.includes('✅') ? 'text-green-600' : status.includes('❌') ? 'text-red-600' : 'text-gray-400'}`}>
                  {status || (sending ? 'Processing submission...' : 'Ready to transmit')}
                </span>
                <div className="flex gap-4">
                  <button onClick={closeModal} className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-black">Discard</button>
                  <button
                    onClick={sendEmail} disabled={sending}
                    className="px-8 py-2 bg-[#007398] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#005a77] disabled:opacity-50 transition-all rounded-sm shadow-lg shadow-[#007398]/20"
                  >
                    {sending ? 'Sending...' : 'Issue Communication'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}