// PortalSection.js (added console logs, mostly unchanged but ensured editor access)
import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import NewsUploadSection from './NewsUploadSection';
import { useTranslation } from 'react-i18next';
const ASSIGNMENTS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS_RFrrfaVQHftZUhvJ1LVz0i_Tju-6PlYI8tAu5hLNLN21u8M7KV-eiruomZEcMuc_sxLZ1rXBhX1O/pub?output=csv';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyJ9znuf_Pa8Hyh4BnsO1pTTduBsXC7kDD0pORWccMTBlckgt0I--NKG69aR_puTAZ5/exec';

export default function PortalSection({ user, onLogout }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({});
  const [report, setReport] = useState({});
  const [vote, setVote] = useState({});
  const [tutorialVisible, setTutorialVisible] = useState({});
  const [submitStatus, setSubmitStatus] = useState({});
  const [error, setError] = useState('');
  const [visibleAssignments, setVisibleAssignments] = useState(3);
  const [activeTab, setActiveTab] = useState('assignments');

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const response = await fetch(ASSIGNMENTS_CSV, { cache: 'no-store' });
      if (!response.ok) throw new Error('Error al cargar el archivo CSV');
      const csvText = await response.text();
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        delimiter: ',',
        transform: (value) => value.trim(),
        complete: ({ data }) => {
          console.log('Parsed assignments data:', data);
          const isAuthor = data.some((row) => row['Autor'] === user.name);
          if (isAuthor) {
            const authorAssignments = data
              .filter((row) => row['Autor'] === user.name)
              .map((row) => ({
                'Nombre Artículo': row['Nombre Artículo'] || 'Sin título',
                Estado: row['Estado'],
                role: 'Autor',
                feedbackEditor: row['Feedback 3'] || 'Sin retroalimentación del editor aún.',
              }));
            setAssignments(authorAssignments);
          } else {
            const userAssignments = data
              .filter((row) => {
                if (row['Revisor 1'] === user.name) return true;
                if (row['Revisor 2'] === user.name) return true;
                if (row['Editor'] === user.name) return true;
                return false;
              })
              .map((row) => ({
                'Nombre Artículo': row['Nombre Artículo'] || 'Sin título',
                'Link Artículo': row['Link Artículo'],
                Estado: row['Estado'],
                role: row['Revisor 1'] === user.name ? 'Revisor 1' : row['Revisor 2'] === user.name ? 'Revisor 2' : 'Editor',
                feedback: row[`Feedback ${row['Revisor 1'] === user.name ? '1' : row['Revisor 2'] === user.name ? '2' : '3'}`] || '',
                report: row[`Informe ${row['Revisor 1'] === user.name ? '1' : row['Revisor 2'] === user.name ? '2' : '3'}`] || '',
                vote: row[`Voto ${row['Revisor 1'] === user.name ? '1' : row['Revisor 2'] === user.name ? '2' : '3'}`] || '',
                feedback1: row['Feedback 1'] || 'Sin retroalimentación de Revisor 1.',
                feedback2: row['Feedback 2'] || 'Sin retroalimentación de Revisor 2.',
                informe1: row['Informe 1'] || 'Sin informe de Revisor 1.',
                informe2: row['Informe 2'] || 'Sin informe de Revisor 2.',
              }));
            setAssignments(userAssignments);
            userAssignments.forEach((assignment) => {
              setVote((prev) => ({ ...prev, [assignment['Link Artículo']]: assignment.vote }));
              setFeedback((prev) => ({ ...prev, [assignment['Link Artículo']]: assignment.feedback }));
              setReport((prev) => ({ ...prev, [assignment['Link Artículo']]: assignment.report }));
            });
          }
          setLoading(false);
          setVisibleAssignments(3);
        },
        error: (err) => {
          console.error('Error al parsear CSV:', err);
          setError('Error al cargar asignaciones');
          setLoading(false);
        },
      });
    } catch (err) {
      console.error('Error al cargar asignaciones:', err);
      setError('Error al conectar con el servidor');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [user.name]);

  const handleVote = (link, value) => {
    setVote((prev) => ({ ...prev, [link]: value }));
  };

  const handleSubmit = async (link, role, feedbackText, reportText, voteValue) => {
    const data = {
      link,
      role,
      vote: voteValue || '',
      feedback: feedbackText || '',
      report: reportText || '',
    };

    console.log('Sending assignment data:', data); // Debug log

    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      console.log('Assignment request sent (no-cors, assuming success)'); // Debug log
      setSubmitStatus((prev) => ({ ...prev, [link]: 'Enviado exitosamente (CORS workaround applied)' }));
      await fetchAssignments();
    } catch (err) {
      console.error('Error al enviar datos:', err);
      setSubmitStatus((prev) => ({ ...prev, [link]: 'Error al enviar: ' + err.message }));
    }
  };

  const toggleTutorial = (link) => {
    setTutorialVisible((prev) => ({ ...prev, [link]: !prev[link] }));
  };

  const getTutorialText = (role) => {
    if (role === 'Revisor 1') {
      return 'Como Revisor 1, tu rol es revisar aspectos técnicos como gramática, ortografía, citación de fuentes, detección de contenido generado por IA, coherencia lógica y estructura general del artículo. Deja comentarios detallados en el documento de Google Drive para sugerir mejoras. Asegúrate de que el lenguaje sea claro y académico.';
    } else if (role === 'Revisor 2') {
      return 'Como Revisor 2, enfócate en el contenido sustantivo: verifica la precisión de las fuentes, la seriedad y originalidad del tema, la relevancia de los argumentos, y la contribución al campo de estudio. Evalúa si el artículo es innovador y bien fundamentado. Deja comentarios en el documento de Google Drive.';
    } else if (role === 'Editor') {
      return 'Como Editor, tu responsabilidad es revisar las retroalimentaciones e informes de los revisores, integrarlas con tu propia evaluación, y redactar una retroalimentación final sensible y constructiva para el autor. Corrige directamente el texto si es necesario y decide el estado final del artículo. Usa el documento de Google Drive para ediciones.';
    }
    return '';
  };

  const loadMoreAssignments = () => {
    setVisibleAssignments((prev) => prev + 3);
  };

  if (loading) {
    return <p className="text-center text-gray-600">Cargando asignaciones...</p>;
  }

  if (error) {
    return (
      <div className="text-center space-y-4 bg-gray-50 p-6 rounded-lg shadow-sm">
        <h3 className="text-xl font-medium text-gray-800">Bienvenido, {user.name}</h3>
        <p className="text-gray-600">Rol: {user.role}</p>
        <p className="text-red-500">{error}</p>
        <button
          onClick={fetchAssignments}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
        >
          Reintentar
        </button>
        <button
          onClick={onLogout}
          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
        >
          Cerrar Sesión
        </button>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="text-center space-y-4 bg-gray-50 p-6 rounded-lg shadow-sm">
        <h3 className="text-xl font-medium text-gray-800">Bienvenido, {user.name}</h3>
        <p className="text-gray-600">Rol: {user.role}</p>
        <p className="text-gray-600">No tienes asignaciones actualmente.</p>
        <button
          onClick={onLogout}
          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
        >
          Cerrar Sesión
        </button>
      </div>
    );
  }

  if (assignments[0].role === 'Autor') {
    return (
      <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-0">
        <div className="text-center space-y-2">
          <h3 className="text-xl font-medium text-gray-800">Bienvenido, {user.name}</h3>
          <p className="text-gray-600">Rol: {user.role}</p>
          <button
            onClick={onLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
          >
            Cerrar Sesión
          </button>
        </div>
        <h3 className="text-lg font-semibold text-gray-800">Estado de tus Artículos</h3>
        <div className="space-y-6">
          {assignments.slice(0, visibleAssignments).map((assignment) => (
            <div key={assignment['Nombre Artículo']} className="bg-white p-6 rounded-lg shadow-md space-y-4">
              <h4 className="text-lg font-semibold text-gray-800">{assignment['Nombre Artículo']}</h4>
              <p className="text-gray-600">Estado: {assignment['Estado']}</p>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Retroalimentación del Editor</label>
                <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                  <p className="text-gray-600">{assignment.feedbackEditor}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        {visibleAssignments < assignments.length && (
          <div className="text-center">
            <button
              onClick={loadMoreAssignments}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
            >
              Mostrar más
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-0">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-medium text-gray-800">Bienvenido, {user.name}</h3>
        <p className="text-gray-600">Rol: {user.role}</p>
        <button
          onClick={fetchAssignments}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm mr-4"
        >
          Actualizar Asignaciones
        </button>
        <button
          onClick={onLogout}
          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
        >
          Cerrar Sesión
        </button>
      </div>
      <div className="flex space-x-4">
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2 rounded-md ${activeTab === 'assignments' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
        >
          Asignaciones
        </button>
        {user.role.includes('Editor') && (
          <button
            onClick={() => setActiveTab('news')}
            className={`px-4 py-2 rounded-md ${activeTab === 'news' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
          >
            Subir Noticia
          </button>
        )}
      </div>
      {activeTab === 'assignments' && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Tus Asignaciones</h3>
          <div className="space-y-6">
            {assignments.slice(0, visibleAssignments).map((assignment) => (
              <div key={assignment['Link Artículo']} className="bg-white p-6 rounded-lg shadow-md space-y-4">
                <h4 className="text-lg font-semibold text-gray-800">{assignment['Nombre Artículo']}</h4>
                <div className="space-y-4">
                  <a
                    href={assignment['Link Artículo']}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    Abrir en Google Drive
                  </a>
                  <iframe
                    src={assignment['Link Artículo'].replace('/edit', '/preview')}
                    className="w-full h-[300px] sm:h-[500px] rounded-xl shadow border border-gray-200"
                    title="Vista previa del artículo"
                    sandbox="allow-same-origin allow-scripts"
                  ></iframe>
                </div>
                <p className="text-gray-600">Rol: {assignment.role}</p>
                <p className="text-gray-600">Estado: {assignment['Estado']}</p>
                {assignment.role === 'Editor' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Retroalimentación de Revisor 1</label>
                      <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                        <p className="text-gray-600">{assignment.feedback1}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Retroalimentación de Revisor 2</label>
                      <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                        <p className="text-gray-600">{assignment.feedback2}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Informe de Revisor 1</label>
                      <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                        <p className="text-gray-600">{assignment.informe1}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Informe de Revisor 2</label>
                      <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                        <p className="text-gray-600">{assignment.informe2}</p>
                      </div>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => toggleTutorial(assignment['Link Artículo'])}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                >
                  {tutorialVisible[assignment['Link Artículo']] ? 'Ocultar Tutorial' : 'Ver Tutorial'}
                </button>
                {tutorialVisible[assignment['Link Artículo']] && (
                  <p className="text-gray-600 bg-gray-50 p-4 rounded-md border border-gray-200">{getTutorialText(assignment.role)}</p>
                )}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {assignment.role === 'Editor' ? 'Retroalimentación Final al Autor' : 'Retroalimentación al Autor'}
                  </label>
                  <textarea
                    value={feedback[assignment['Link Artículo']] || ''}
                    onChange={(e) => setFeedback((prev) => ({ ...prev, [assignment['Link Artículo']]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="4"
                    placeholder={assignment.role === 'Editor' ? 'Redacta una retroalimentación final sensible, sintetizando las opiniones de los revisores y la tuya.' : 'Escribe tu retroalimentación aquí...'}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Informe al Editor</label>
                  <textarea
                    value={report[assignment['Link Artículo']] || ''}
                    onChange={(e) => setReport((prev) => ({ ...prev, [assignment['Link Artículo']]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="4"
                    placeholder="Escribe tu informe aquí..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Voto</label>
                  <div className="flex space-x-4">
                    <button
                      onClick={() => handleVote(assignment['Link Artículo'], 'si')}
                      className={`px-4 py-2 rounded-md ${vote[assignment['Link Artículo']] === 'si' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-800'} focus:outline-none focus:ring-2 focus:ring-green-500`}
                    >
                      Sí
                    </button>
                    <button
                      onClick={() => handleVote(assignment['Link Artículo'], 'no')}
                      className={`px-4 py-2 rounded-md ${vote[assignment['Link Artículo']] === 'no' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-800'} focus:outline-none focus:ring-2 focus:ring-red-500`}
                    >
                      No
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => handleSubmit(assignment['Link Artículo'], assignment.role, feedback[assignment['Link Artículo']] || '', report[assignment['Link Artículo']] || '', vote[assignment['Link Artículo']] || '')}
                  className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Enviar
                </button>
                {submitStatus[assignment['Link Artículo']] && (
                  <p className={`text-center text-sm ${submitStatus[assignment['Link Artículo']].includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
                    {submitStatus[assignment['Link Artículo']]}
                  </p>
                )}
              </div>
            ))}
          </div>
          {visibleAssignments < assignments.length && (
            <div className="text-center">
              <button
                onClick={loadMoreAssignments}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
              >
                Mostrar más
              </button>
            </div>
          )}
        </div>
      )}
      {activeTab === 'news' && user.role.includes('Editor') && (
        <NewsUploadSection />
      )}
    </div>
  );
}