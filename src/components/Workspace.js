import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { debounce } from 'lodash';

const criteria = {
  'Revisor 1': [
    {
      key: 'gramatica',
      name: 'Gramática y ortografía',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Muchos errores graves, difícil de leer.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Algunos errores, pero comprensible.' },
        2: { label: '2 = Excelente ✅', desc: 'Muy pocos errores, texto limpio.' }
      }
    },
    {
      key: 'claridad',
      name: 'Claridad y coherencia',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Confuso, incoherente.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'A veces confuso pero comprensible.' },
        2: { label: '2 = Excelente ✅', desc: 'Claro, preciso y coherente.' }
      }
    },
    {
      key: 'estructura',
      name: 'Estructura y organización',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Desorganizado, sin secciones claras.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Secciones presentes pero débiles.' },
        2: { label: '2 = Excelente ✅', desc: 'Introducción, desarrollo y conclusión bien diferenciados.' }
      }
    },
    {
      key: 'citacion',
      name: 'Citación y referencias',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Sin fuentes o mal citadas.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Fuentes presentes pero con errores.' },
        2: { label: '2 = Excelente ✅', desc: 'Fuentes confiables, bien citadas.' }
      }
    }
  ],
  'Revisor 2': [
    {
      key: 'relevancia',
      name: 'Relevancia del tema',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Tema irrelevante o fuera de contexto.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Tema válido pero superficial.' },
        2: { label: '2 = Excelente ✅', desc: 'Tema relevante e interesante.' }
      }
    },
    {
      key: 'rigor',
      name: 'Rigor en el uso de fuentes',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Sin fuentes o poco confiables.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Pocas fuentes, algunas cuestionables.' },
        2: { label: '2 = Excelente ✅', desc: 'Fuentes variadas, confiables y bien usadas.' }
      }
    },
    {
      key: 'originalidad',
      name: 'Originalidad y creatividad',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Repite información sin análisis.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Combina ideas con poca elaboración.' },
        2: { label: '2 = Excelente ✅', desc: 'Aporta ideas originales y reflexiones.' }
      }
    },
    {
      key: 'argumentos',
      name: 'Calidad de los argumentos',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Confusos, no respaldados o incoherentes.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Claros pero débiles.' },
        2: { label: '2 = Excelente ✅', desc: 'Sólidos, bien respaldados y convincentes.' }
      }
    }
  ],
  'Editor': [
    {
      key: 'modificaciones',
      name: 'Grado de modificaciones',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Requerió correcciones extensas, casi reescrito.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Necesitó varias correcciones manejables.' },
        2: { label: '2 = Excelente ✅', desc: 'Solo ajustes menores.' }
      }
    },
    {
      key: 'calidad',
      name: 'Calidad final del texto',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Aún débil o poco claro después de cambios.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Texto aceptable, aunque mejorable.' },
        2: { label: '2 = Excelente ✅', desc: 'Texto sólido, claro y publicable.' }
      }
    },
    {
      key: 'aporte',
      name: 'Aporte global del ensayo',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Poca relevancia o repetitivo.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Interesante, pero no sobresaliente.' },
        2: { label: '2 = Excelente ✅', desc: 'Altamente valioso, innovador o inspirador.' }
      }
    },
    {
      key: 'potencial',
      name: 'Potencial motivador',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'No motiva ni contribuye al espíritu de la revista.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Puede motivar a algunos estudiantes.' },
        2: { label: '2 = Excelente ✅', desc: 'Inspira, fomenta la reflexión y el diálogo.' }
      }
    },
    {
      key: 'decision',
      name: 'Decisión final',
      levels: {
        0: { label: '0 = Rechazar', desc: 'Rechazar.' },
        1: { label: '1 = Aceptar con cambios mayores', desc: 'Aceptar con cambios mayores.' },
        2: { label: '2 = Aceptar (con o sin cambios menores)', desc: 'Aceptar (con o sin cambios menores).' }
      }
    }
  ]
};

const getDecisionText = (percent) => {
  if (percent >= 85) return 'Aceptar sin cambios.';
  if (percent >= 70) return 'Aceptar con cambios menores.';
  if (percent >= 50) return 'Revisión mayor requerida antes de publicar.';
  return 'Rechazar.';
};

const getTotal = (scores, crits) => crits.reduce((sum, c) => sum + (scores[c.key] || 0), 0);

/**
 * COMPONENTE: RÚBRICA INTERACTIVA "SENSE"
 * Diseñado para que el revisor haga clic con precisión y vea el impacto inmediato.
 */
const ModernRubric = ({ roleKey, scores, onChange, readOnly }) => {
  const crits = criteria[roleKey];
  if (!crits) return null;
  return (
    <div className="space-y-12">
      {crits.map((c, idx) => (
        <motion.div
          key={c.key}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="group"
        >
          <div className="flex items-center gap-4 mb-4">
            <span className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-serif font-bold text-sm border border-blue-100">
              {idx + 1}
            </span>
            <h4 className="font-serif text-lg font-bold text-gray-800 group-hover:text-blue-900 transition-colors">
              {c.name}
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.entries(c.levels).map(([valStr, info]) => {
              const val = parseInt(valStr);
              const isSelected = scores[c.key] === val;
              const levelInfo = info.label.split('=')[1] || "Sin descripción";

              return (
                <button
                  key={val}
                  disabled={readOnly}
                  onClick={() => onChange(c.key, val)}
                  className={`relative p-4 text-left rounded-xl border-2 transition-all duration-300 ${isSelected ? 'border-blue-600 bg-blue-50/30 shadow-md ring-1 ring-blue-600/20' : 'border-gray-100 hover:border-blue-200 bg-white opacity-60 hover:opacity-100'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-tighter ${isSelected ? 'text-blue-700' : 'text-gray-400'}`}>
                      Nivel {val}
                    </span>
                    {isSelected && (
                      <motion.div layoutId={`check-${c.key}`} className="text-blue-600">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293l-4 4a1 1 0 01-1.414 0l-2-2a1 1 0 111.414-1.414L9 10.586l3.293-3.293a1 1 0 011.414 1.414z"/></svg>
                      </motion.div>
                    )}
                  </div>
                  <p className={`text-sm leading-snug ${isSelected ? 'text-blue-900 font-medium' : 'text-gray-600'}`}>
                    {levelInfo}
                  </p>
                </button>
              );
            })}
          </div>
        </motion.div>
      ))}
    </div>
  );
};

/**
 * WORKSPACE DEL REVISOR (MODAL MODERNIZADO)
 */
const ReviewerWorkspace = ({ assignment, onClose, handleSubmitRubric, handleSubmit, handleVote, rubricScores, feedback, report, vote, rubricStatus, submitStatus, isPending, role, link, toggleTutorial, tutorialVisible, debouncedSetFeedback, debouncedSetReport, modules, formats, decodeBody, showImageModal, imageData, isEditingImage, handleImageDataChange, handleImageModalSubmit, expandedFeedback, toggleFeedback, getDecisionText }) => {
  const [localScores, setLocalScores] = useState(rubricScores[link] || {});
  const [localFeedback, setLocalFeedback] = useState(feedback[link] || '');
  const [localReport, setLocalReport] = useState(report[link] || '');
  const [localVote, setLocalVote] = useState(vote[link] || '');
  const totalScore = useMemo(() => getTotal(localScores, criteria[role] || []), [localScores, role]);
  const maxScore = (criteria[role] || []).length * 2;
  const progress = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  const handleLocalRubricChange = (key, val) => {
    setLocalScores(prev => ({...prev, [key]: val}));
  };
  const handleLocalVote = (value) => {
    setLocalVote(value);
    handleVote(link, value);
  };
  const debouncedLocalFeedback = debounce(setLocalFeedback, 300);
  const debouncedLocalReport = debounce(setLocalReport, 300);
  const onSave = () => {
    handleSubmitRubric(link, role);
    handleSubmit(link, role, localFeedback, localReport, localVote);
  };
  const handleRenderRubric = () => {
    if (role === 'Editor') {
      const rev1Total = getTotal(assignment.rev1Scores, criteria['Revisor 1']);
      const rev2Total = getTotal(assignment.rev2Scores, criteria['Revisor 2']);
      const revPercent = ((rev1Total + rev2Total) / 16) * 100;
      const editorTotal = getTotal(localScores, criteria['Editor']);
      const overallTotal = rev1Total + rev2Total + editorTotal;
      const overallPercent = (overallTotal / 26) * 100;
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-8">
          <div className="space-y-2">
            <h5 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Rúbrica del Revisor 1</h5>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => toggleFeedback(link, 'rubric1')}
              className="text-blue-600 hover:underline text-sm font-sans flex items-center"
            >
              {expandedFeedback[link]?.rubric1 ? 'Ocultar' : 'Mostrar'}
              <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.rubric1 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </motion.button>
          </div>
          <AnimatePresence>
            {expandedFeedback[link]?.rubric1 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <ModernRubric roleKey="Revisor 1" scores={assignment.rev1Scores} readOnly={true} />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="space-y-2">
            <h5 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Feedback del Revisor 1</h5>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => toggleFeedback(link, 'feedback1')}
              className="text-blue-600 hover:underline text-sm font-sans flex items-center"
            >
              {expandedFeedback[link]?.feedback1 ? 'Ocultar' : 'Mostrar'}
              <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.feedback1 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </motion.button>
          </div>
          <AnimatePresence>
            {expandedFeedback[link]?.feedback1 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-gray-50 p-6 rounded-md border border-gray-200 max-h-64 overflow-y-auto font-sans text-sm text-gray-800 leading-relaxed"
              >
                {decodeBody(assignment.feedback1)}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="space-y-2">
            <h5 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Informe del Revisor 1</h5>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => toggleFeedback(link, 'informe1')}
              className="text-blue-600 hover:underline text-sm font-sans flex items-center"
            >
              {expandedFeedback[link]?.informe1 ? 'Ocultar' : 'Mostrar'}
              <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.informe1 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </motion.button>
          </div>
          <AnimatePresence>
            {expandedFeedback[link]?.informe1 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-gray-50 p-6 rounded-md border border-gray-200 max-h-64 overflow-y-auto font-sans text-sm text-gray-800 leading-relaxed"
              >
                {decodeBody(assignment.informe1)}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="space-y-2">
            <h5 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Rúbrica del Revisor 2</h5>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => toggleFeedback(link, 'rubric2')}
              className="text-blue-600 hover:underline text-sm font-sans flex items-center"
            >
              {expandedFeedback[link]?.rubric2 ? 'Ocultar' : 'Mostrar'}
              <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.rubric2 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </motion.button>
          </div>
          <AnimatePresence>
            {expandedFeedback[link]?.rubric2 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <ModernRubric roleKey="Revisor 2" scores={assignment.rev2Scores} readOnly={true} />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="space-y-2">
            <h5 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Feedback del Revisor 2</h5>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => toggleFeedback(link, 'feedback2')}
              className="text-blue-600 hover:underline text-sm font-sans flex items-center"
            >
              {expandedFeedback[link]?.feedback2 ? 'Ocultar' : 'Mostrar'}
              <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.feedback2 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </motion.button>
          </div>
          <AnimatePresence>
            {expandedFeedback[link]?.feedback2 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-gray-50 p-6 rounded-md border border-gray-200 max-h-64 overflow-y-auto font-sans text-sm text-gray-800 leading-relaxed"
              >
                {decodeBody(assignment.feedback2)}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="space-y-2">
            <h5 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Informe del Revisor 2</h5>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => toggleFeedback(link, 'informe2')}
              className="text-blue-600 hover:underline text-sm font-sans flex items-center"
            >
              {expandedFeedback[link]?.informe2 ? 'Ocultar' : 'Mostrar'}
              <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.informe2 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </motion.button>
          </div>
          <AnimatePresence>
            {expandedFeedback[link]?.informe2 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-gray-50 p-6 rounded-md border border-gray-200 max-h-64 overflow-y-auto font-sans text-sm text-gray-800 leading-relaxed"
              >
                {decodeBody(assignment.informe2)}
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-yellow-50 rounded-md border border-yellow-200">
            <p className="font-sans text-sm text-yellow-800">Implicación de los Revisores: {revPercent.toFixed(1)}% - {getDecisionText(revPercent)}</p>
          </motion.div>
          <ModernRubric
            roleKey="Editor"
            scores={localScores}
            onChange={handleLocalRubricChange}
            readOnly={false}
          />
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-green-50 rounded-md border border-green-200">
            <p className="font-sans text-sm text-green-800">Decisión General Sugerida: {overallPercent.toFixed(1)}% - {getDecisionText(overallPercent)}</p>
          </motion.div>
        </motion.div>
      );
    } else {
      return (
        <ModernRubric
          roleKey={role}
          scores={localScores}
          onChange={handleLocalRubricChange}
          readOnly={false}
        />
      );
    }
  };
  const isAuth = role === 'Autor';
  if (isAuth) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-white flex flex-col"
      >
        <header className="h-16 border-b border-gray-200 px-4 md:px-8 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3 md:gap-6">
            <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="h-6 w-[1px] bg-gray-200" />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em]">Mi Artículo</span>
              <h2 className="text-sm font-bold text-gray-900 truncate max-w-[200px] md:max-w-[400px]">{assignment['Nombre Artículo']}</h2>
            </div>
          </div>
        </header>
        <div className="flex-grow overflow-y-auto p-4 md:p-8 lg:p-16">
          <div className="max-w-2xl mx-auto space-y-8">
            {assignment.feedbackEditor && ['Aceptado', 'Rechazado'].includes(assignment.Estado) ? (
              <>
                <div className="p-6 bg-green-50 rounded-md border border-green-200">
                  <h5 className="font-sans text-xs font-bold uppercase tracking-widest text-green-700 mb-2">Estado Final</h5>
                  <p className="font-serif text-xl font-bold text-green-800">{assignment.Estado}</p>
                </div>
                <div className="space-y-4">
                  <h5 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Feedback del Editor</h5>
                  <div className="bg-gray-50 p-6 rounded-md border border-gray-200 max-h-96 overflow-y-auto font-sans text-sm text-gray-800 leading-relaxed">
                    {decodeBody(assignment.feedbackEditor)}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center space-y-4">
                <h5 className="font-serif text-2xl font-bold text-yellow-800">Artículo en Revisión</h5>
                <p className="font-sans text-sm text-yellow-700 leading-relaxed">Su artículo "{assignment['Nombre Artículo']}" se encuentra actualmente en proceso de revisión por parte de los evaluadores y el editor.</p>
                <p className="font-sans text-sm text-yellow-600 leading-relaxed">Recibirá una notificación con la decisión final y el feedback correspondiente una vez completado el proceso.</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-white flex flex-col"
    >
      {/* Top Bar Editorial */}
      <header className="h-16 border-b border-gray-200 px-4 md:px-8 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3 md:gap-6">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="h-6 w-[1px] bg-gray-200" />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em]">Evaluación por Pares</span>
            <h2 className="text-sm font-bold text-gray-900 truncate max-w-[200px] md:max-w-[400px]">{assignment['Nombre Artículo']}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex flex-col items-end mr-2 md:mr-4">
            <span className="text-[10px] text-gray-400 font-bold uppercase">Progreso</span>
            <div className="w-24 md:w-32 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-blue-600"
              />
            </div>
          </div>
          <button
            onClick={onSave}
            className="hidden md:block px-4 md:px-6 py-2 bg-gray-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-blue-700 transition-all rounded-sm"
          >
            Enviar Revisión
          </button>
        </div>
      </header>
      {/* Main Content: Split View - Stack vertical in mobile */}
      <div className="flex-grow overflow-y-auto pt-16 md:pt-0 lg:flex">
        {/* Lado Izquierdo: El Manuscrito (Modo Lectura) */}
        <section className="bg-gray-50/50 p-4 md:p-8 lg:p-16 border-b border-gray-100">
          <article className="max-w-2xl mx-auto bg-white p-6 md:p-12 shadow-sm border border-gray-100 rounded-sm space-y-8">
            <header className="border-b border-gray-900 pb-8">
              <span className="bg-gray-900 text-white px-2 py-1 text-[9px] font-bold uppercase mb-4 inline-block">Manuscrito Original</span>
              <h1 className="font-serif text-2xl md:text-3xl font-bold leading-tight text-gray-900 mb-6">
                {assignment['Nombre Artículo']}
              </h1>
              <div className="mt-4">
                <motion.button
                  onClick={() => window.open(assignment['Link Artículo'], '_blank')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-blue-700 transition-all rounded-sm"
                >
                  Abrir en Nueva Pestaña
                </motion.button>
              </div>
            </header>
            <div className="font-serif text-base md:text-lg leading-relaxed text-gray-800 space-y-6">
              {/* Aquí iría el contenido del artículo o un visor de PDF */}
              <div dangerouslySetInnerHTML={{ __html: assignment.content }} />
              <motion.iframe
                src={assignment['Link Artículo'] ? assignment['Link Artículo'].replace('/edit', '/preview') : ''}
                className="w-full h-64 md:h-96 border-2 border-dashed border-gray-100 rounded-xl"
                title="Vista Previa del Artículo"
              />
            </div>
          </article>
        </section>
        {/* Lado Derecho: La Evaluación (Modo Escritura) */}
        <section className="bg-white p-4 md:p-8 lg:p-12 mt-8 lg:mt-0">
          <div className="max-w-xl mx-auto space-y-8">
            <div className="pt-8 lg:pt-16">
              <h3 className="font-serif text-2xl font-bold text-gray-900 mb-2">Protocolo de Evaluación</h3>
              <p className="text-sm text-gray-500 font-sans leading-relaxed">Asigne el puntaje correspondiente basándose en la calidad científica y metodológica del texto.</p>
            </div>
            {handleRenderRubric()}
            <div className="mt-16 pt-8 border-t border-gray-100 space-y-6">
              <h4 className="font-serif text-xl font-bold text-gray-900">Comentarios para el Autor</h4>
              <ReactQuill
                theme="snow"
                value={localFeedback}
                onChange={debouncedLocalFeedback}
                modules={modules}
                formats={formats}
                placeholder="Escriba aquí sus observaciones constructivas..."
                className="bg-white rounded-lg border border-gray-200"
              />
            </div>
            <div className="mt-8 space-y-6">
              <h4 className="font-serif text-xl font-bold text-gray-900">Informe para el Editor</h4>
              <ReactQuill
                theme="snow"
                value={localReport}
                onChange={debouncedLocalReport}
                modules={modules}
                formats={formats}
                placeholder="Escriba su informe confidencial para el editor..."
                className="bg-white rounded-lg border border-gray-200"
              />
            </div>
            <div className="mt-8 space-y-4">
              <h4 className="font-serif text-xl font-bold text-gray-900">Voto Final</h4>
              <div className="flex space-x-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleLocalVote('si')}
                  className={`flex-1 py-3 rounded-md font-sans text-sm font-bold uppercase tracking-widest ${localVote === 'si' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} transition-colors`}
                >
                  Sí
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleLocalVote('no')}
                  className={`flex-1 py-3 rounded-md font-sans text-sm font-bold uppercase tracking-widest ${localVote === 'no' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} transition-colors`}
                >
                  No
                </motion.button>
              </div>
            </div>
            <div className="mt-12 p-6 bg-blue-900 rounded-xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0 shadow-xl">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Calificación Final</p>
                <p className="text-3xl font-serif font-bold">{totalScore} <span className="text-sm opacity-50">/ {maxScore}</span></p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Recomendación</p>
                <p className="font-bold text-lg">
                  {getDecisionText(progress)}
                </p>
              </div>
            </div>
            {rubricStatus[link] && (
              <p className={`text-sm font-sans mt-4 ${rubricStatus[link].includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {rubricStatus[link]}
              </p>
            )}
            {submitStatus[link] && (
              <p className={`text-sm font-sans mt-4 ${submitStatus[link].includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {submitStatus[link]}
              </p>
            )}
          </div>
        </section>
      </div>
      <div className="block md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 z-20">
        <button
          onClick={onSave}
          className="w-full px-4 py-3 bg-gray-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-blue-700 transition-all rounded-sm"
        >
          Enviar Revisión
        </button>
      </div>
      <AnimatePresence>
        {showImageModal[link] && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4"
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-white p-6 md:p-8 rounded-lg shadow-xl max-w-md w-full space-y-6"
            >
              <h4 className="font-serif text-xl font-bold text-gray-900">{isEditingImage[link] ? 'Editar Imagen' : 'Insertar Imagen'}</h4>
              <div className="space-y-4">
                <div>
                  <label className="block font-sans text-xs font-bold uppercase tracking-widest text-gray-500">URL de la Imagen</label>
                  <input
                    type="text"
                    name="url"
                    value={imageData[link]?.url || ''}
                    onChange={(e) => handleImageDataChange(link, e)}
                    className="mt-1 block w-full border border-gray-200 rounded-md p-2 text-sm font-sans"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                <div>
                  <label className="block font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Ancho (px o %)</label>
                  <input
                    type="text"
                    name="width"
                    value={imageData[link]?.width || ''}
                    onChange={(e) => handleImageDataChange(link, e)}
                    className="mt-1 block w-full border border-gray-200 rounded-md p-2 text-sm font-sans"
                    placeholder="auto o 300px"
                  />
                </div>
                <div>
                  <label className="block font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Alto (px o %)</label>
                  <input
                    type="text"
                    name="height"
                    value={imageData[link]?.height || ''}
                    onChange={(e) => handleImageDataChange(link, e)}
                    className="mt-1 block w-full border border-gray-200 rounded-md p-2 text-sm font-sans"
                    placeholder="auto o 200px"
                  />
                </div>
                <div>
                  <label className="block font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Alineación</label>
                  <select
                    name="align"
                    value={imageData[link]?.align || 'left'}
                    onChange={(e) => handleImageDataChange(link, e)}
                    className="mt-1 block w-full border border-gray-200 rounded-md p-2 text-sm font-sans"
                  >
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                    <option value="right">Derecha</option>
                    <option value="justify">Justificado</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowImageModal((prev) => ({ ...prev, [link]: false }))}
                  className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-sm font-sans font-bold uppercase tracking-widest"
                >
                  Cancelar
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleImageModalSubmit(link)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-sans font-bold uppercase tracking-widest"
                >
                  {isEditingImage[link] ? 'Actualizar' : 'Insertar'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export { ReviewerWorkspace };