import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { debounce } from 'lodash';

const criteria = {
  'Reviewer 1': [
    {
      key: 'gramatica',
      name: 'Grammar and Spelling',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'Many serious errors, very difficult to read.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Some errors, but still comprehensible.' },
        2: { label: '2 = Excellent ✅', desc: 'Very few or no errors, clean text.' }
      }
    },
    {
      key: 'claridad',
      name: 'Clarity and Coherence',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'Confusing and incoherent.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Occasionally confusing but understandable.' },
        2: { label: '2 = Excellent ✅', desc: 'Clear, precise and coherent.' }
      }
    },
    {
      key: 'estructura',
      name: 'Structure and Organization',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'Disorganized, no clear sections.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Sections present but weak or unclear.' },
        2: { label: '2 = Excellent ✅', desc: 'Well-differentiated introduction, body and conclusion.' }
      }
    },
    {
      key: 'citacion',
      name: 'Citation and References',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'No sources or incorrectly cited.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Sources present but with errors.' },
        2: { label: '2 = Excellent ✅', desc: 'Reliable sources, correctly and consistently cited.' }
      }
    }
  ],
  'Reviewer 2': [
    {
      key: 'relevancia',
      name: 'Topic Relevance',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'Irrelevant or off-topic.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Valid topic but superficial treatment.' },
        2: { label: '2 = Excellent ✅', desc: 'Highly relevant and engaging topic.' }
      }
    },
    {
      key: 'rigor',
      name: 'Rigor in Source Usage',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'No sources or unreliable ones.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Few sources, some questionable.' },
        2: { label: '2 = Excellent ✅', desc: 'Diverse, reliable and appropriately used sources.' }
      }
    },
    {
      key: 'originalidad',
      name: 'Originality and Creativity',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'Merely repeats information without analysis.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Combines ideas with limited development.' },
        2: { label: '2 = Excellent ✅', desc: 'Offers original ideas and thoughtful insights.' }
      }
    },
    {
      key: 'argumentos',
      name: 'Quality of Arguments',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'Confusing, unsupported or incoherent.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Clear but weak arguments.' },
        2: { label: '2 = Excellent ✅', desc: 'Strong, well-supported and persuasive.' }
      }
    }
  ],
  'Editor': [
    {
      key: 'modificaciones',
      name: 'Degree of Modifications',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'Required extensive rewriting.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Needed several manageable corrections.' },
        2: { label: '2 = Excellent ✅', desc: 'Only minor adjustments required.' }
      }
    },
    {
      key: 'calidad',
      name: 'Final Text Quality',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'Still weak or unclear after edits.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Acceptable but could be improved.' },
        2: { label: '2 = Excellent ✅', desc: 'Strong, clear and ready for publication.' }
      }
    },
    {
      key: 'aporte',
      name: 'Overall Contribution',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'Little relevance or highly repetitive.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Interesting but not outstanding.' },
        2: { label: '2 = Excellent ✅', desc: 'Highly valuable, innovative or inspiring.' }
      }
    },
    {
      key: 'potencial',
      name: 'Motivational Potential',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'Does not motivate or align with journal spirit.' },
        1: { label: '1 = Adequate ⚖️', desc: 'May inspire some readers.' },
        2: { label: '2 = Excellent ✅', desc: 'Inspires reflection and academic dialogue.' }
      }
    },
    {
      key: 'decision',
      name: 'Final Decision',
      levels: {
        0: { label: '0 = Reject', desc: 'Reject submission.' },
        1: { label: '1 = Accept with Major Changes', desc: 'Accept with major revisions.' },
        2: { label: '2 = Accept (with or without minor changes)', desc: 'Accept (minor or no changes needed).' }
      }
    }
  ]
};

const getDecisionText = (percent) => {
  if (percent >= 85) return 'Accept without changes.';
  if (percent >= 70) return 'Accept with minor changes.';
  if (percent >= 50) return 'Major revision required before publication.';
  return 'Reject.';
};

const getTotal = (scores, crits) => crits.reduce((sum, c) => sum + (scores[c.key] || 0), 0);

/**
 * INTERACTIVE RUBRIC COMPONENT "SENSE"
 * Designed for precise clicking and immediate visual feedback.
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
              const levelInfo = info.label.split('=')[1]?.trim() || "No description";

              return (
                <button
                  key={val}
                  disabled={readOnly}
                  onClick={() => onChange(c.key, val)}
                  className={`relative p-4 text-left rounded-xl border-2 transition-all duration-300 ${isSelected ? 'border-blue-600 bg-blue-50/30 shadow-md ring-1 ring-blue-600/20' : 'border-gray-100 hover:border-blue-200 bg-white opacity-60 hover:opacity-100'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-tighter ${isSelected ? 'text-blue-700' : 'text-gray-400'}`}>
                      Level {val}
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
 * REVIEWER WORKSPACE (MODERN MODAL)
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
      const rev1Total = getTotal(assignment.rev1Scores, criteria['Reviewer 1']);
      const rev2Total = getTotal(assignment.rev2Scores, criteria['Reviewer 2']);
      const revPercent = ((rev1Total + rev2Total) / 16) * 100;
      const editorTotal = getTotal(localScores, criteria['Editor']);
      const overallTotal = rev1Total + rev2Total + editorTotal;
      const overallPercent = (overallTotal / 26) * 100;
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-8">
          <div className="space-y-2">
            <h5 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Reviewer 1 Rubric</h5>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => toggleFeedback(link, 'rubric1')}
              className="text-blue-600 hover:underline text-sm font-sans flex items-center"
            >
              {expandedFeedback[link]?.rubric1 ? 'Hide' : 'Show'}
              <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.rubric1 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </motion.button>
          </div>
          <AnimatePresence>
            {expandedFeedback[link]?.rubric1 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <ModernRubric roleKey="Reviewer 1" scores={assignment.rev1Scores} readOnly={true} />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="space-y-2">
            <h5 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Reviewer 1 Feedback</h5>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => toggleFeedback(link, 'feedback1')}
              className="text-blue-600 hover:underline text-sm font-sans flex items-center"
            >
              {expandedFeedback[link]?.feedback1 ? 'Hide' : 'Show'}
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
            <h5 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Reviewer 1 Report</h5>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => toggleFeedback(link, 'informe1')}
              className="text-blue-600 hover:underline text-sm font-sans flex items-center"
            >
              {expandedFeedback[link]?.informe1 ? 'Hide' : 'Show'}
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
            <h5 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Reviewer 2 Rubric</h5>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => toggleFeedback(link, 'rubric2')}
              className="text-blue-600 hover:underline text-sm font-sans flex items-center"
            >
              {expandedFeedback[link]?.rubric2 ? 'Hide' : 'Show'}
              <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.rubric2 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </motion.button>
          </div>
          <AnimatePresence>
            {expandedFeedback[link]?.rubric2 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <ModernRubric roleKey="Reviewer 2" scores={assignment.rev2Scores} readOnly={true} />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="space-y-2">
            <h5 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Reviewer 2 Feedback</h5>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => toggleFeedback(link, 'feedback2')}
              className="text-blue-600 hover:underline text-sm font-sans flex items-center"
            >
              {expandedFeedback[link]?.feedback2 ? 'Hide' : 'Show'}
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
            <h5 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Reviewer 2 Report</h5>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => toggleFeedback(link, 'informe2')}
              className="text-blue-600 hover:underline text-sm font-sans flex items-center"
            >
              {expandedFeedback[link]?.informe2 ? 'Hide' : 'Show'}
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
            <p className="font-sans text-sm text-yellow-800">Reviewers Combined: {revPercent.toFixed(1)}% - {getDecisionText(revPercent)}</p>
          </motion.div>
          <ModernRubric
            roleKey="Editor"
            scores={localScores}
            onChange={handleLocalRubricChange}
            readOnly={false}
          />
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-green-50 rounded-md border border-green-200">
            <p className="font-sans text-sm text-green-800">Suggested Overall Decision: {overallPercent.toFixed(1)}% - {getDecisionText(overallPercent)}</p>
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
  const isAuth = role === 'Author';
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
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em]">My Article</span>
              <h2 className="text-sm font-bold text-gray-900 truncate max-w-[200px] md:max-w-[400px]">{assignment['Nombre Artículo']}</h2>
            </div>
          </div>
        </header>
        <div className="flex-grow overflow-y-auto p-4 md:p-8 lg:p-16">
          <div className="max-w-2xl mx-auto space-y-8">
            {assignment.feedbackEditor && ['Aceptado', 'Rechazado'].includes(assignment.Estado) ? (
              <>
                <div className="p-6 bg-green-50 rounded-md border border-green-200">
                  <h5 className="font-sans text-xs font-bold uppercase tracking-widest text-green-700 mb-2">Final Status</h5>
                  <p className="font-serif text-xl font-bold text-green-800">
                    {assignment.Estado === 'Aceptado' ? 'Accepted' : 'Rejected'}
                  </p>
                </div>
                <div className="space-y-4">
                  <h5 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Editor Feedback</h5>
                  <div className="bg-gray-50 p-6 rounded-md border border-gray-200 max-h-96 overflow-y-auto font-sans text-sm text-gray-800 leading-relaxed">
                    {decodeBody(assignment.feedbackEditor)}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center space-y-4">
                <h5 className="font-serif text-2xl font-bold text-yellow-800">Article Under Review</h5>
                <p className="font-sans text-sm text-yellow-700 leading-relaxed">Your article "{assignment['Nombre Artículo']}" is currently being reviewed by peer reviewers and the editor.</p>
                <p className="font-sans text-sm text-yellow-600 leading-relaxed">You will be notified with the final decision and feedback once the process is complete.</p>
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
      <header className="h-16 border-b border-gray-200 px-4 md:px-8 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3 md:gap-6">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="h-6 w-[1px] bg-gray-200" />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em]">Peer Review</span>
            <h2 className="text-sm font-bold text-gray-900 truncate max-w-[200px] md:max-w-[400px]">{assignment['Nombre Artículo']}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex flex-col items-end mr-2 md:mr-4">
            <span className="text-[10px] text-gray-400 font-bold uppercase">Progress</span>
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
            Submit Review
          </button>
        </div>
      </header>
      <div className="flex-grow overflow-y-auto pt-16 md:pt-0 lg:flex">
        <section className="bg-gray-50/50 p-4 md:p-8 lg:p-16 border-b border-gray-100">
          <article className="max-w-2xl mx-auto bg-white p-6 md:p-12 shadow-sm border border-gray-100 rounded-sm space-y-8">
            <header className="border-b border-gray-900 pb-8">
              <span className="bg-gray-900 text-white px-2 py-1 text-[9px] font-bold uppercase mb-4 inline-block">Original Manuscript</span>
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
                  Open in New Tab
                </motion.button>
              </div>
            </header>
            <div className="font-serif text-base md:text-lg leading-relaxed text-gray-800 space-y-6">
              <div dangerouslySetInnerHTML={{ __html: assignment.content }} />
              <motion.iframe
                src={assignment['Link Artículo'] ? assignment['Link Artículo'].replace('/edit', '/preview') : ''}
                className="w-full h-64 md:h-96 border-2 border-dashed border-gray-100 rounded-xl"
                title="Article Preview"
              />
            </div>
          </article>
        </section>
        <section className="bg-white p-4 md:p-8 lg:p-12 mt-8 lg:mt-0">
          <div className="max-w-xl mx-auto space-y-8">
            <div className="pt-8 lg:pt-16">
              <h3 className="font-serif text-2xl font-bold text-gray-900 mb-2">Review Protocol</h3>
              <p className="text-sm text-gray-500 font-sans leading-relaxed">Assign scores based on the scientific and methodological quality of the submission.</p>
            </div>
            {handleRenderRubric()}
            <div className="mt-16 pt-8 border-t border-gray-100 space-y-6">
              <h4 className="font-serif text-xl font-bold text-gray-900">Comments for the Author</h4>
              <ReactQuill
                theme="snow"
                value={localFeedback}
                onChange={debouncedLocalFeedback}
                modules={modules}
                formats={formats}
                placeholder="Write your constructive observations here..."
                className="bg-white rounded-lg border border-gray-200"
              />
            </div>
            <div className="mt-8 space-y-6">
              <h4 className="font-serif text-xl font-bold text-gray-900">Confidential Report for the Editor</h4>
              <ReactQuill
                theme="snow"
                value={localReport}
                onChange={debouncedLocalReport}
                modules={modules}
                formats={formats}
                placeholder="Write your confidential report for the editor..."
                className="bg-white rounded-lg border border-gray-200"
              />
            </div>
            <div className="mt-8 space-y-4">
              <h4 className="font-serif text-xl font-bold text-gray-900">Final Vote</h4>
              <div className="flex space-x-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleLocalVote('yes')}
                  className={`flex-1 py-3 rounded-md font-sans text-sm font-bold uppercase tracking-widest ${localVote === 'yes' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} transition-colors`}
                >
                  Yes
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
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Final Score</p>
                <p className="text-3xl font-serif font-bold">{totalScore} <span className="text-sm opacity-50">/ {maxScore}</span></p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Recommendation</p>
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
          Submit Review
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
              <h4 className="font-serif text-xl font-bold text-gray-900">{isEditingImage[link] ? 'Edit Image' : 'Insert Image'}</h4>
              <div className="space-y-4">
                <div>
                  <label className="block font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Image URL</label>
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
                  <label className="block font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Width (px or %)</label>
                  <input
                    type="text"
                    name="width"
                    value={imageData[link]?.width || ''}
                    onChange={(e) => handleImageDataChange(link, e)}
                    className="mt-1 block w-full border border-gray-200 rounded-md p-2 text-sm font-sans"
                    placeholder="auto or 300px"
                  />
                </div>
                <div>
                  <label className="block font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Height (px or %)</label>
                  <input
                    type="text"
                    name="height"
                    value={imageData[link]?.height || ''}
                    onChange={(e) => handleImageDataChange(link, e)}
                    className="mt-1 block w-full border border-gray-200 rounded-md p-2 text-sm font-sans"
                    placeholder="auto or 200px"
                  />
                </div>
                <div>
                  <label className="block font-sans text-xs font-bold uppercase tracking-widest text-gray-500">Alignment</label>
                  <select
                    name="align"
                    value={imageData[link]?.align || 'left'}
                    onChange={(e) => handleImageDataChange(link, e)}
                    className="mt-1 block w-full border border-gray-200 rounded-md p-2 text-sm font-sans"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                    <option value="justify">Justified</option>
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
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleImageModalSubmit(link)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-sans font-bold uppercase tracking-widest"
                >
                  {isEditingImage[link] ? 'Update' : 'Insert'}
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