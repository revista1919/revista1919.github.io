import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '../firebase';
import { useLanguage } from '../hooks/useLanguage';

// Componente de Tooltip/Cápsula explicativa (estilo Oxford)
const HelpCapsule = ({ text, textEn }) => {
  const [show, setShow] = useState(false);
  const { language } = useLanguage();
  const displayText = language === 'es' ? text : textEn;

  return (
    <div className="relative inline-block ml-1.5 align-middle">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="w-4 h-4 rounded-full border border-zinc-300 text-zinc-400 text-xs flex items-center justify-center hover:border-[#0A1929] hover:text-[#0A1929] hover:bg-[#E5E9F0] transition-all duration-200 font-serif"
        aria-label="Ayuda"
      >
        i
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            className="absolute z-50 bottom-full mb-3 left-1/2 -translate-x-1/2 w-72 p-4 bg-[#0A1929] text-white text-xs rounded-2xl shadow-2xl leading-relaxed font-serif"
          >
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#0A1929]" />
            {displayText}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Componente para Keywords con chips (estilo Oxford)
const KeywordInput = ({ value, onChange, placeholder, label, helpText, helpTextEn }) => {
  const [inputValue, setInputValue] = useState('');
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const keywords = value ? value.split(';').filter(k => k.trim()) : [];

  const addKeyword = () => {
    if (inputValue.trim()) {
      const newKeywords = [...keywords, inputValue.trim()];
      onChange(newKeywords.join('; '));
      setInputValue('');
    }
  };

  const removeKeyword = (indexToRemove) => {
    const newKeywords = keywords.filter((_, index) => index !== indexToRemove);
    onChange(newKeywords.join('; '));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword();
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-[10px] font-mono font-semibold uppercase tracking-[0.125em] text-[#546E7A] flex items-center">
        {label}
        <HelpCapsule text={helpText} textEn={helpTextEn} />
      </label>

      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          className="flex-1 p-3.5 bg-white border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] focus:ring-1 focus:ring-[#0A1929] outline-none transition-all font-serif"
        />
        <button
          type="button"
          onClick={addKeyword}
          className="px-5 py-3 bg-[#E5E9F0] text-[#0A1929] rounded-2xl text-sm font-medium hover:bg-[#CCD4E0] transition-colors font-serif"
        >
          {isSpanish ? 'Agregar' : 'Add'}
        </button>
      </div>

      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#E5E9F0] text-[#0A1929] rounded-2xl text-xs font-medium font-serif"
            >
              {keyword}
              <button
                type="button"
                onClick={() => removeKeyword(index)}
                className="text-[#546E7A] hover:text-[#B22234] transition-colors"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// Componente para manejo de autores menores
const MinorConsentSection = ({ author, index, onUpdate }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const consentMethod = author.consentMethod || 'none';

  const consentUrls = {
    es: 'https://www.revistacienciasestudiantes.com/consent.pdf',
    en: 'https://www.revistacienciasestudiantes.com/consentEN.pdf'
  };

  const handleConsentChange = (method) => {
    onUpdate(index, 'consentMethod', method);
    if (method !== 'upload') {
      onUpdate(index, 'consentFile', null);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      onUpdate(index, 'consentFile', {
        name: file.name,
        data: reader.result.split(',')[1],
        type: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-6 pt-6 border-t border-[#E0E7E9] space-y-5 bg-[#F5F7FA] rounded-2xl p-5"
    >
      <div className="flex items-center gap-2 text-[#B22234]">
        <span className="text-lg">📋</span>
        <p className="text-sm font-medium font-serif">
          {isSpanish
            ? 'Autor menor de edad: se requiere consentimiento legal'
            : 'Minor author: legal guardian consent required'}
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-[#1A2B3C] mb-1.5 font-serif">
          {isSpanish ? 'Nombre completo del tutor legal *' : 'Legal guardian full name *'}
        </label>
        <input
          type="text"
          value={author.guardianName || ''}
          onChange={(e) => onUpdate(index, 'guardianName', e.target.value)}
          className="w-full p-3.5 bg-white border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
          placeholder={isSpanish ? 'Juan Pérez López' : 'John Doe Smith'}
        />
      </div>

      <div className="space-y-4">
        <p className="text-xs uppercase tracking-widest text-[#546E7A] font-mono">Método de consentimiento</p>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name={`consent-${index}`}
            value="email"
            checked={consentMethod === 'email'}
            onChange={() => handleConsentChange('email')}
            className="mt-0.5 w-4 h-4 text-[#0A1929]"
          />
          <div>
            <span className="text-sm text-[#1A2B3C] block font-serif">
              {isSpanish ? 'Enviar por correo electrónico' : 'Send by email'}
            </span>
            <span className="text-xs text-[#546E7A] font-serif">contact@revistacienciasestudiantes.com</span>
          </div>
        </label>

        {consentMethod === 'email' && (
          <div className="ml-7 p-4 bg-white border border-[#E0E7E9] rounded-xl text-xs text-[#1A2B3C] font-serif">
            {isSpanish ? (
              <>
                <p className="font-medium mb-2">El correo debe contener:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Nombre del autor menor</li>
                  <li>Nombre completo del tutor</li>
                  <li>Documento de identidad del tutor</li>
                  <li>Frase: "Autorizo la publicación en Revista Nacional de las Ciencias"</li>
                </ul>
              </>
            ) : (
              <>
                <p className="font-medium mb-2">Email must include:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Minor author name</li>
                  <li>Guardian full name</li>
                  <li>Guardian ID document</li>
                  <li>Phrase: "I authorize publication in National Review of Sciences"</li>
                </ul>
              </>
            )}
          </div>
        )}

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name={`consent-${index}`}
            value="upload"
            checked={consentMethod === 'upload'}
            onChange={() => handleConsentChange('upload')}
            className="mt-0.5 w-4 h-4 text-[#0A1929]"
          />
          <span className="text-sm text-[#1A2B3C] font-serif">
            {isSpanish ? 'Subir formulario firmado' : 'Upload signed form'}
          </span>
        </label>

        {consentMethod === 'upload' && (
          <div className="ml-7 space-y-4">
            <a
              href={consentUrls[language]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[#0A1929] hover:text-[#B22234] text-sm underline-offset-4 hover:underline font-serif"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v-4m0 0l4 4m-4-4l4-4m12 4v4m0-4l-4 4m4-4l-4-4" />
              </svg>
              {isSpanish ? 'Descargar formulario' : 'Download form'}
            </a>

            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileUpload}
              className="block w-full text-sm text-[#546E7A] file:mr-4 file:py-3 file:px-6 file:rounded-2xl file:border-0 file:text-sm file:font-medium file:bg-[#E5E9F0] file:text-[#0A1929] hover:file:bg-[#CCD4E0] font-serif"
            />

            {author.consentFile && (
              <div className="flex items-center gap-2 text-[#0A1929] text-xs font-serif">
                <span>✅</span>
                <span>{author.consentFile.name}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// NUEVO CAMBIO: Listado exhaustivo de áreas temáticas generales
const AREAS_TEMATICAS = {
  "Ciencias Exactas y Naturales": [
    "Matemáticas",
    "Física",
    "Química",
    "Biología",
    "Geología",
    "Astronomía y Astrofísica",
    "Ciencias Ambientales y Ecología",
    "Oceanografía",
    "Meteorología y Ciencias Atmosféricas",
    "Paleontología"
  ],
  "Ciencias de la Salud": [
    "Medicina General e Interna",
    "Salud Pública y Epidemiología",
    "Enfermería",
    "Nutrición y Dietética",
    "Farmacología y Farmacia",
    "Odontología",
    "Kinesiología y Fisioterapia",
    "Tecnología Médica y Bioanálisis",
    "Veterinaria"
  ],
  "Ingeniería y Tecnología": [
    "Ingeniería Civil",
    "Ingeniería Industrial y de Sistemas",
    "Ingeniería Mecánica",
    "Ingeniería Eléctrica y Electrónica",
    "Ingeniería Química y Biotecnología",
    "Ingeniería en Computación e Informática",
    "Ciencia de Datos e Inteligencia Artificial",
    "Robótica y Automatización",
    "Ingeniería de Materiales y Nanotecnología",
    "Ingeniería Aeroespacial",
    "Energías Renovables y Sostenibilidad"
  ],
  "Ciencias Sociales": [
    "Sociología",
    "Antropología y Arqueología",
    "Psicología",
    "Economía y Negocios",
    "Ciencias Políticas y Relaciones Internacionales",
    "Derecho",
    "Geografía Humana y Ordenamiento Territorial",
    "Estudios de Género",
    "Comunicación Social y Periodismo",
    "Educación y Pedagogía",
    "Trabajo Social"
  ],
  "Humanidades": [
    "Historia",
    "Filosofía",
    "Lingüística y Filología",
    "Literatura",
    "Estudios Clásicos",
    "Teología y Ciencias de la Religión",
    "Estudios Culturales",
    "Arte, Música y Cine",
    "Arquitectura y Urbanismo"
  ],
  "Ciencias Agropecuarias": [
    "Agronomía y Producción Agrícola",
    "Ciencias Forestales",
    "Acuicultura y Pesca",
    "Zootecnia y Producción Animal",
    "Ingeniería de Alimentos"
  ]
};
// Configuración de vocabularios controlados por área
const VOCABULARIO_POR_AREA = {
  // Ciencias Exactas y Naturales → MeSH
  "Matemáticas": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D009369: Neoplasms",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código (ej. D009369) y el descriptor exacto."
  },
  "Física": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D010825: Physics",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y el descriptor exacto."
  },
  "Química": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D002621: Chemistry",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y el descriptor exacto."
  },
  "Biología": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D001777: Biology",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y el descriptor exacto."
  },
  "Geología": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D005811: Geology",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y el descriptor exacto."
  },
  "Astronomía y Astrofísica": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D001260: Astronomy",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y el descriptor exacto."
  },
  "Ciencias Ambientales y Ecología": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D004463: Ecology",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y el descriptor exacto."
  },
  "Oceanografía": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D009791: Oceanography",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y el descriptor exacto."
  },
  "Meteorología y Ciencias Atmosféricas": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D008795: Meteorology",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y el descriptor exacto."
  },
  "Paleontología": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D010163: Paleontology",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y el descriptor exacto."
  },

  // Ciencias de la Salud → MeSH
  "Medicina General e Interna": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D008112: Internal Medicine",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y el descriptor exacto."
  },
  "Salud Pública y Epidemiología": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D011635: Public Health",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y el descriptor exacto."
  },
  "Enfermería": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D009729: Nursing",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y el descriptor exacto."
  },
  "Nutrición y Dietética": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D009750: Nutritional Sciences",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y el descriptor exacto."
  },
  "Farmacología y Farmacia": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D010597: Pharmacology",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y el descriptor exacto."
  },
  "Odontología": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D003813: Dentistry",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y el descriptor exacto."
  },
  "Kinesiología y Fisioterapia": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D026801: Physical Therapy Specialty",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y el descriptor exacto."
  },
  "Tecnología Médica y Bioanálisis": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D008364: Medical Laboratory Science",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y el descriptor exacto."
  },
  "Veterinaria": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D014730: Veterinary Medicine",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y el descriptor exacto."
  },

  // Ingeniería y Tecnología → ACM
  "Ingeniería Civil": {
    vocabulario: "ACM",
    nombre: "ACM Computing Classification System",
    formato: "Código ACM: Término",
    ejemplo: "CCS2012.10002944: Computing in civil engineering",
    searchUrl: "https://dl.acm.org/ccs",
    instrucciones: "Navega por la clasificación ACM y copia el código y descriptor más cercano a tu tema."
  },
  "Ingeniería Industrial y de Sistemas": {
    vocabulario: "ACM",
    nombre: "ACM Computing Classification System",
    formato: "Código ACM: Término",
    ejemplo: "CCS2012.10010405: Systems engineering",
    searchUrl: "https://dl.acm.org/ccs",
    instrucciones: "Navega por la clasificación ACM y copia el código y descriptor más cercano."
  },
  "Ingeniería Mecánica": {
    vocabulario: "ACM",
    nombre: "ACM Computing Classification System",
    formato: "Código ACM: Término",
    ejemplo: "CCS2012.10010405: Computer-aided engineering",
    searchUrl: "https://dl.acm.org/ccs",
    instrucciones: "Navega por la clasificación ACM y copia el código y descriptor más cercano."
  },
  "Ingeniería Eléctrica y Electrónica": {
    vocabulario: "ACM",
    nombre: "ACM Computing Classification System",
    formato: "Código ACM: Término",
    ejemplo: "CCS2012.10002726: Embedded systems",
    searchUrl: "https://dl.acm.org/ccs",
    instrucciones: "Navega por la clasificación ACM y copia el código y descriptor más cercano."
  },
  "Ingeniería Química y Biotecnología": {
    vocabulario: "ACM",
    nombre: "ACM Computing Classification System",
    formato: "Código ACM: Término",
    ejemplo: "CCS2012.10003041: Computational biology",
    searchUrl: "https://dl.acm.org/ccs",
    instrucciones: "Navega por la clasificación ACM y copia el código y descriptor más cercano."
  },
  "Ingeniería en Computación e Informática": {
    vocabulario: "ACM",
    nombre: "ACM Computing Classification System",
    formato: "Código ACM: Término",
    ejemplo: "CCS2012.10003116: Software engineering",
    searchUrl: "https://dl.acm.org/ccs",
    instrucciones: "Navega por la clasificación ACM y copia el código y descriptor más cercano."
  },
  "Ciencia de Datos e Inteligencia Artificial": {
    vocabulario: "ACM",
    nombre: "ACM Computing Classification System",
    formato: "Código ACM: Término",
    ejemplo: "CCS2012.10010179: Machine learning",
    searchUrl: "https://dl.acm.org/ccs",
    instrucciones: "Navega por la clasificación ACM y copia el código y descriptor más cercano."
  },
  "Robótica y Automatización": {
    vocabulario: "ACM",
    nombre: "ACM Computing Classification System",
    formato: "Código ACM: Término",
    ejemplo: "CCS2012.10010187: Robotics",
    searchUrl: "https://dl.acm.org/ccs",
    instrucciones: "Navega por la clasificación ACM y copia el código y descriptor más cercano."
  },
  "Ingeniería de Materiales y Nanotecnología": {
    vocabulario: "ACM",
    nombre: "ACM Computing Classification System",
    formato: "Código ACM: Término",
    ejemplo: "CCS2012.10003128: Nanotechnology",
    searchUrl: "https://dl.acm.org/ccs",
    instrucciones: "Navega por la clasificación ACM y copia el código y descriptor más cercano."
  },
  "Ingeniería Aeroespacial": {
    vocabulario: "ACM",
    nombre: "ACM Computing Classification System",
    formato: "Código ACM: Término",
    ejemplo: "CCS2012.10010535: Avionics",
    searchUrl: "https://dl.acm.org/ccs",
    instrucciones: "Navega por la clasificación ACM y copia el código y descriptor más cercano."
  },
  "Energías Renovables y Sostenibilidad": {
    vocabulario: "ACM",
    nombre: "ACM Computing Classification System",
    formato: "Código ACM: Término",
    ejemplo: "CCS2012.10003048: Green computing",
    searchUrl: "https://dl.acm.org/ccs",
    instrucciones: "Navega por la clasificación ACM y copia el código y descriptor más cercano."
  },

  // Ciencias Sociales → JEL
  "Sociología": {
    vocabulario: "JEL",
    nombre: "JEL Classification System (Journal of Economic Literature)",
    formato: "Código JEL: Término",
    ejemplo: "Z13: Economic Sociology",
    searchUrl: "https://www.aeaweb.org/econlit/jelCodes.php",
    instrucciones: "Busca el código JEL que mejor describa tu tema. Ej: Z13 para sociología económica, I31 para bienestar general."
  },
  "Antropología y Arqueología": {
    vocabulario: "JEL",
    nombre: "JEL Classification System",
    formato: "Código JEL: Término",
    ejemplo: "Z19: Other Cultural Economics",
    searchUrl: "https://www.aeaweb.org/econlit/jelCodes.php",
    instrucciones: "Busca el código JEL más cercano a tu tema de antropología económica o cultural."
  },
  "Psicología": {
    vocabulario: "JEL",
    nombre: "JEL Classification System",
    formato: "Código JEL: Término",
    ejemplo: "D91: Micro-Based Behavioral Economics",
    searchUrl: "https://www.aeaweb.org/econlit/jelCodes.php",
    instrucciones: "Busca el código JEL más cercano. Usa D (Microeconomía) o I (Salud) para psicología."
  },
  "Economía y Negocios": {
    vocabulario: "JEL",
    nombre: "JEL Classification System",
    formato: "Código JEL: Término",
    ejemplo: "D00: General Economics",
    searchUrl: "https://www.aeaweb.org/econlit/jelCodes.php",
    instrucciones: "Selecciona los códigos JEL que mejor describan tu investigación económica."
  },
  "Ciencias Políticas y Relaciones Internacionales": {
    vocabulario: "JEL",
    nombre: "JEL Classification System",
    formato: "Código JEL: Término",
    ejemplo: "F50: International Relations",
    searchUrl: "https://www.aeaweb.org/econlit/jelCodes.php",
    instrucciones: "Busca códigos JEL en categorías F (Economía Internacional) o H (Economía Pública)."
  },
  "Derecho": {
    vocabulario: "JEL",
    nombre: "JEL Classification System",
    formato: "Código JEL: Término",
    ejemplo: "K00: Law and Economics",
    searchUrl: "https://www.aeaweb.org/econlit/jelCodes.php",
    instrucciones: "Usa la categoría K (Law and Economics) del sistema JEL."
  },
  "Geografía Humana y Ordenamiento Territorial": {
    vocabulario: "JEL",
    nombre: "JEL Classification System",
    formato: "Código JEL: Término",
    ejemplo: "R10: General Regional Economics",
    searchUrl: "https://www.aeaweb.org/econlit/jelCodes.php",
    instrucciones: "Usa categorías R (Economía Regional) o Q (Economía de Recursos)."
  },
  "Estudios de Género": {
    vocabulario: "JEL",
    nombre: "JEL Classification System",
    formato: "Código JEL: Término",
    ejemplo: "J16: Economics of Gender",
    searchUrl: "https://www.aeaweb.org/econlit/jelCodes.php",
    instrucciones: "Busca en categorías J (Economía Laboral) para estudios de género."
  },
  "Comunicación Social y Periodismo": {
    vocabulario: "JEL",
    nombre: "JEL Classification System",
    formato: "Código JEL: Término",
    ejemplo: "L82: Entertainment; Media",
    searchUrl: "https://www.aeaweb.org/econlit/jelCodes.php",
    instrucciones: "Busca en categoría L (Organización Industrial) para medios y comunicación."
  },
  "Educación y Pedagogía": {
    vocabulario: "JEL",
    nombre: "JEL Classification System",
    formato: "Código JEL: Término",
    ejemplo: "I20: Education and Research Institutions",
    searchUrl: "https://www.aeaweb.org/econlit/jelCodes.php",
    instrucciones: "Usa categoría I (Salud, Educación y Bienestar) del sistema JEL."
  },
  "Trabajo Social": {
    vocabulario: "JEL",
    nombre: "JEL Classification System",
    formato: "Código JEL: Término",
    ejemplo: "I38: Welfare, Well-Being, and Poverty",
    searchUrl: "https://www.aeaweb.org/econlit/jelCodes.php",
    instrucciones: "Busca en categorías I (Bienestar) o J (Economía Laboral)."
  },

  // Humanidades → UNESCO Thesaurus
  "Historia": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Código UNESCO: Término",
    ejemplo: "6.25: Historia",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Navega por el tesauro de la UNESCO y copia el código numérico y el descriptor."
  },
  "Filosofía": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Código UNESCO: Término",
    ejemplo: "6.05: Filosofía",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Navega por el tesauro de la UNESCO y copia el código y descriptor."
  },
  "Lingüística y Filología": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Código UNESCO: Término",
    ejemplo: "6.10: Lingüística",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Navega por el tesauro de la UNESCO y copia el código y descriptor."
  },
  "Literatura": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Código UNESCO: Término",
    ejemplo: "6.15: Literatura",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Navega por el tesauro de la UNESCO y copia el código y descriptor."
  },
  "Estudios Clásicos": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Código UNESCO: Término",
    ejemplo: "6.20: Estudios Clásicos",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Navega por el tesauro de la UNESCO y copia el código y descriptor."
  },
  "Teología y Ciencias de la Religión": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Código UNESCO: Término",
    ejemplo: "6.30: Teología",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Navega por el tesauro de la UNESCO y copia el código y descriptor."
  },
  "Estudios Culturales": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Código UNESCO: Término",
    ejemplo: "6.35: Cultura",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Navega por el tesauro de la UNESCO y copia el código y descriptor."
  },
  "Arte, Música y Cine": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Código UNESCO: Término",
    ejemplo: "6.40: Arte",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Navega por el tesauro de la UNESCO y copia el código y descriptor."
  },
  "Arquitectura y Urbanismo": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Código UNESCO: Término",
    ejemplo: "6.45: Arquitectura",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Navega por el tesauro de la UNESCO y copia el código y descriptor."
  },

  // Ciencias Agropecuarias → MeSH
  "Agronomía y Producción Agrícola": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D000383: Agriculture",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH. Usa también Agrovoc si es muy específico."
  },
  "Ciencias Forestales": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D005560: Forestry",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y descriptor."
  },
  "Acuicultura y Pesca": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D017742: Aquaculture",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y descriptor."
  },
  "Zootecnia y Producción Animal": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D000825: Animal Husbandry",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y descriptor."
  },
  "Ingeniería de Alimentos": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D005494: Food Technology",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca tu término en MeSH y copia el código y descriptor."
  }
};

// Componente para palabras clave con vocabulario controlado
const ControlledKeywordInput = ({ vocabularyConfig, value, onChange, language }) => {
  const isSpanish = language === 'es';
  const keywords = value || [];
  const [newCode, setNewCode] = useState('');
  const [newTerm, setNewTerm] = useState('');

  const maxKeywords = 6;
  const minKeywords = 2;

  const addKeyword = () => {
    const code = newCode.trim();
    const term = newTerm.trim();
    if (!code || !term) return;
    if (keywords.length >= maxKeywords) return;
    
    // Verificar que el código no esté duplicado
    if (keywords.some(k => k.code === code)) {
      alert(isSpanish ? 'Este código ya existe en tus palabras clave.' : 'This code already exists in your keywords.');
      return;
    }

    onChange([...keywords, { code, term }]);
    setNewCode('');
    setNewTerm('');
  };

  const removeKeyword = (index) => {
    onChange(keywords.filter((_, i) => i !== index));
  };

  const handleCodeKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('controlled-term-input')?.focus();
    }
  };

  const handleTermKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  };

  return (
    <div className="space-y-4">
      {/* Info del vocabulario */}
      <div className="bg-[#F0F4F8] border border-[#C0A86A] rounded-2xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📚</span>
          <div className="flex-1">
            <h4 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-base">
              {vocabularyConfig.vocabulario}: {vocabularyConfig.nombre}
            </h4>
            <p className="text-[#5A6B7A] text-sm mt-1 font-['Lora']">
              {vocabularyConfig.instrucciones}
            </p>
            <a
              href={vocabularyConfig.searchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-[#0A1929] hover:text-[#C0A86A] text-sm font-medium transition-colors font-['Lora']"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {isSpanish ? 'Abrir buscador' : 'Open search'} →
            </a>
            <span className="text-[#5A6B7A] text-xs mx-2">·</span>
<a
  href={isSpanish ? 'https://www.revistacienciasestudiantes.com/policies.html#clasificacion' : 'https://www.revistacienciasestudiantes.com/policiesEN.html#classification'}
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-1 text-[#0A1929] hover:text-[#C0A86A] text-xs font-medium transition-colors font-['Lora']"
>
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
  {isSpanish ? 'Ver políticas de keywords' : 'View keyword policies'} ↗
</a>
          </div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-[#E5E9F0]">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#5A6B7A]">
            {isSpanish ? 'Formato esperado:' : 'Expected format:'}
          </span>
          <code className="ml-2 text-sm font-mono text-[#0A1929] bg-[#F5F7FA] px-2 py-0.5 rounded">
            {vocabularyConfig.formato}
          </code>
          <span className="text-[#5A6B7A] text-sm mx-2">·</span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#5A6B7A]">
            {isSpanish ? 'Ejemplo:' : 'Example:'}
          </span>
          <code className="ml-2 text-sm font-mono text-[#C0A86A] bg-[#F5F7FA] px-2 py-0.5 rounded">
            {vocabularyConfig.ejemplo}
          </code>
        </div>
      </div>

      {/* Campos de entrada */}
      <div className="flex gap-3">
        <div className="w-1/3">
          <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-[#546E7A] mb-1.5">
            {isSpanish ? 'Código' : 'Code'} *
          </label>
          <input
            type="text"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            onKeyPress={handleCodeKeyPress}
            placeholder={vocabularyConfig.vocabulario === 'JEL' ? 'B14' : vocabularyConfig.vocabulario === 'MeSH' ? 'D009369' : 'CCS2012.10010179'}
            className="w-full p-3.5 bg-white border border-[#E0E7E9] rounded-2xl text-sm font-mono focus:border-[#0A1929] focus:ring-1 focus:ring-[#0A1929] outline-none transition-all"
          />
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-[#546E7A] mb-1.5">
            {isSpanish ? 'Término' : 'Term'} *
          </label>
          <input
            id="controlled-term-input"
            type="text"
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            onKeyPress={handleTermKeyPress}
            placeholder={vocabularyConfig.vocabulario === 'JEL' ? 'Marxism' : 'Neoplasms'}
            className="w-full p-3.5 bg-white border border-[#E0E7E9] rounded-2xl text-sm font-['Lora'] focus:border-[#0A1929] focus:ring-1 focus:ring-[#0A1929] outline-none transition-all"
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={addKeyword}
            disabled={!newCode.trim() || !newTerm.trim() || keywords.length >= maxKeywords}
            className="px-5 py-3.5 bg-[#E5E9F0] text-[#0A1929] rounded-2xl text-sm font-medium hover:bg-[#CCD4E0] transition-colors font-serif disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            + {isSpanish ? 'Agregar' : 'Add'}
          </button>
        </div>
      </div>

      {/* Contador y validación */}
      <div className="flex items-center justify-between">
        <p className={`text-xs font-mono ${keywords.length < minKeywords ? 'text-[#B22234]' : 'text-[#5A6B7A]'}`}>
          {isSpanish 
            ? `${keywords.length} de ${minKeywords}-${maxKeywords} palabras clave requeridas`
            : `${keywords.length} of ${minKeywords}-${maxKeywords} required keywords`
          }
          {keywords.length < minKeywords && (
            <span className="ml-2">
              {isSpanish ? `(mínimo ${minKeywords})` : `(minimum ${minKeywords})`}
            </span>
          )}
        </p>
        {keywords.length >= maxKeywords && (
          <p className="text-xs text-[#C0A86A] font-mono">
            {isSpanish ? 'Máximo alcanzado' : 'Maximum reached'}
          </p>
        )}
      </div>

      {/* Chips de palabras clave */}
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {keywords.map((kw, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border-2 border-[#C0A86A] text-[#0A1929] rounded-2xl text-sm font-medium shadow-sm"
            >
              <code className="text-xs font-mono bg-[#F0F4F8] px-1.5 py-0.5 rounded text-[#C0A86A]">
                {kw.code}
              </code>
              <span className="font-['Lora']">{kw.term}</span>
              <button
                type="button"
                onClick={() => removeKeyword(index)}
                className="ml-1 text-[#546E7A] hover:text-[#B22234] transition-colors"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
// Componente principal COMPLETO - ESTILO OXFORD
export default function SubmissionForm({ user, onSuccess }) {
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  const [currentStep, setCurrentStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState('');
  const [driveFolderId, setDriveFolderId] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    titleEn: '',
    abstract: '',
    abstractEn: '',
    controlledKeywords: [],
controlledKeywordsEn: [],
    area: '', // Ahora será un select
    paperLanguage: 'es',
    articleType: '',
    acknowledgments: '',

    authors: [{
      firstName: '',
      lastName: '',
      email: '',
      institution: '',
      orcid: '',
      contribution: '',
      isMinor: false,
      guardianName: '',
      consentMethod: 'none',
      consentFile: null,
      isCorresponding: true
    }],

    funding: {
      hasFunding: false,
      sources: '',
      grantNumbers: ''
    },

    conflictOfInterest: '',

    dataAvailability: '',
    dataAvailabilityEn: '',
    codeAvailability: '',
    codeAvailabilityEn: '',

    // NUEVO CAMBIO: Campos adicionales para ética e IA
    requiresEthicsApproval: 'no',
    ethicsCommitteeName: '',
    aiUsed: 'no',
    aiTools: [{ name: '', version: '', purpose: '' }],

    declarations: {
      // Cambio: Declaraciones más específicas basadas en las políticas
      originalAndSimilarity: false,
      exclusiveSubmission: false,
      authorshipCriteria: false,
      dataAuthentic: false,
      informedConsent: false,
      aiDisclosure: false,
      conflicts: false,
      ccByLicense: false
    },

    excludedReviewers: '',
    manuscript: null,
    manuscriptName: ''
  });

  // NUEVO CAMBIO: Opciones de tipo de artículo ahora son EXACTAMENTE las de la política 2.2
  const articleTypeOptions = {
    es: [
      { value: 'research', label: 'Artículo de Investigación Original' },
      { value: 'review', label: 'Revisión Sistemática' },
      { value: 'essay', label: 'Ensayo Académico y Reflexivo' },
      { value: 'case', label: 'Reporte de Caso' },
      { value: 'book_review', label: 'Reseña de Libros (Book Review)' }
    ],
    en: [
      { value: 'research', label: 'Original Research Article' },
      { value: 'review', label: 'Systematic Review' },
      { value: 'essay', label: 'Academic and Reflective Essay' },
      { value: 'case', label: 'Case Report' },
      { value: 'book_review', label: 'Book Review' }
    ]
  };

  const availabilityOptions = {
    es: [
      { value: 'public_repo', label: 'Disponible en repositorio público' },
      { value: 'supplementary', label: 'En material suplementario' },
      { value: 'upon_request', label: 'Disponible bajo solicitud razonable al autor de correspondencia' },
      { value: 'not_available', label: 'No disponible (especificar razón)' },
      { value: 'not_applicable', label: 'No aplica (ensayo teórico, revisión sin datos nuevos)' }
    ],
    en: [
      { value: 'public_repo', label: 'Available in a public repository' },
      { value: 'supplementary', label: 'In supplementary material' },
      { value: 'upon_request', label: 'Available upon reasonable request from the corresponding author' },
      { value: 'not_available', label: 'Not available (specify reason)' },
      { value: 'not_applicable', label: 'Not applicable (theoretical essay, review without new data)' }
    ]
  };

  // Persistencia de borrador
  useEffect(() => {
    const savedData = localStorage.getItem('submissionFormDraft');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData(prev => ({
          ...prev,
          ...parsed,
          manuscript: null,
          manuscriptName: ''
        }));
      } catch (e) {
        console.error('Error loading draft:', e);
      }
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const dataToSave = {
        ...formData,
        manuscript: null,
        manuscriptName: formData.manuscriptName
      };
      localStorage.setItem('submissionFormDraft', JSON.stringify(dataToSave));
    }, 30000);
    return () => clearInterval(interval);
  }, [formData]);

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
    });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAuthorChange = (index, field, value) => {
    const newAuthors = [...formData.authors];
    newAuthors[index][field] = value;
    setFormData(prev => ({ ...prev, authors: newAuthors }));
  };

  const addAuthor = () => {
    setFormData(prev => ({
      ...prev,
      authors: [...prev.authors, {
        firstName: '',
        lastName: '',
        email: '',
        institution: '',
        orcid: '',
        contribution: '',
        isMinor: false,
        guardianName: '',
        consentMethod: 'none',
        consentFile: null,
        isCorresponding: false
      }]
    }));
  };

  const removeAuthor = (index) => {
    if (formData.authors.length > 1) {
      const newAuthors = formData.authors.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, authors: newAuthors }));
    }
  };

  // NUEVO CAMBIO: Manejo de herramientas de IA
  const handleAIToolChange = (index, field, value) => {
    const newTools = [...formData.aiTools];
    newTools[index][field] = value;
    setFormData(prev => ({ ...prev, aiTools: newTools }));
  };

  const addAITool = () => {
    setFormData(prev => ({
      ...prev,
      aiTools: [...prev.aiTools, { name: '', version: '', purpose: '' }]
    }));
  };

  const removeAITool = (index) => {
    const newTools = formData.aiTools.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, aiTools: newTools.length > 0 ? newTools : [{ name: '', version: '', purpose: '' }] }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.match(/\.(doc|docx)$/i)) {
      alert(isSpanish ? 'Solo archivos Word (.doc, .docx)' : 'Only Word files (.doc, .docx)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert(isSpanish ? 'Máximo 10 MB' : 'Maximum 10 MB');
      return;
    }

    setFormData(prev => ({
      ...prev,
      manuscript: file,
      manuscriptName: file.name
    }));
  };

  const handleDeclarationChange = (key) => {
    setFormData(prev => ({
      ...prev,
      declarations: {
        ...prev.declarations,
        [key]: !prev.declarations[key]
      }
    }));
  };

  const allDeclarationsAccepted = () => Object.values(formData.declarations).every(Boolean);

  const validateStep = (step) => {
    switch (step) {
      case 1:
         return formData.title.trim() &&
          formData.abstract.trim() &&
          formData.controlledKeywords.length >= 2 && 
          formData.controlledKeywords.length <= 6 &&
          formData.area.trim() &&
          formData.articleType;
      case 2:
        const basicOk = formData.authors.every(a =>
          a.firstName.trim() && a.lastName.trim() && a.email.trim() && a.institution.trim()
        );
        const minorsOk = formData.authors
          .filter(a => a.isMinor)
          .every(a =>
            a.guardianName.trim() &&
            a.consentMethod !== 'none' &&
            (a.consentMethod !== 'upload' || !!a.consentFile)
          );
        return basicOk && minorsOk;
      case 3:
        // Cambio: Validación incluye disponibilidad de datos y declaraciones
        let isValid = allDeclarationsAccepted() && 
               formData.manuscript && 
               formData.dataAvailability.trim();
        // Si requiere aprobación ética, debe especificar el comité
        if (formData.requiresEthicsApproval === 'yes' && !formData.ethicsCommitteeName.trim()) {
            isValid = false;
        }
        // Si usa IA, debe completar al menos una herramienta
        if (formData.aiUsed === 'yes') {
            const hasValidTool = formData.aiTools.some(tool => tool.name.trim() && tool.purpose.trim());
            if (!hasValidTool) isValid = false;
        }
        return isValid;
      default:
        return true;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep(3)) {
      alert(isSpanish ? 'Completa todos los campos requeridos, incluyendo la declaración de datos y el uso de IA si aplica.' : 'Complete all required fields, including data declaration and AI use if applicable.');
      return;
    }

    setUploading(true);
    setSubmitStatus(isSpanish ? 'Enviando artículo...' : 'Submitting article...');

    try {
      const token = await auth.currentUser.getIdToken();
      const manuscriptBase64 = await toBase64(formData.manuscript);
const keywordsSerialized = formData.controlledKeywords
  .map(kw => `${kw.code}: ${kw.term}`)
  .join('; ');

const keywordsEnSerialized = formData.controlledKeywordsEn
  .map(kw => `${kw.code}: ${kw.term}`)
  .join('; ');
      // NUEVO CAMBIO: Construir el payload con los nuevos campos
      const payload = {
          title: formData.title,
          titleEn: formData.titleEn,
          abstract: formData.abstract,
          abstractEn: formData.abstractEn,
          keywordsVocabulario: VOCABULARIO_POR_AREA[formData.area]?.vocabulario || 'unknown',
keywordsRaw: formData.controlledKeywords,
keywordsRawEn: formData.controlledKeywordsEn,
          area: formData.area,
          paperLanguage: formData.paperLanguage,
          articleType: formData.articleType,
          acknowledgments: formData.acknowledgments,

          dataAvailability: formData.dataAvailability,
          dataAvailabilityEn: formData.dataAvailabilityEn,
          codeAvailability: formData.codeAvailability,
          codeAvailabilityEn: formData.codeAvailabilityEn,

          authors: formData.authors.map(a => ({
            firstName: a.firstName,
            lastName: a.lastName,
            email: a.email,
            institution: a.institution,
            orcid: a.orcid || null,
            contribution: a.contribution,
            isMinor: a.isMinor,
            guardianName: a.guardianName,
            isCorresponding: a.isCorresponding
          })),

          funding: formData.funding,
          conflictOfInterest: formData.conflictOfInterest,
          excludedReviewers: formData.excludedReviewers,

          // Nuevos campos de ética e IA
          requiresEthicsApproval: formData.requiresEthicsApproval === 'yes',
          ethicsCommitteeName: formData.ethicsCommitteeName,
          aiUsed: formData.aiUsed === 'yes',
          aiTools: formData.aiUsed === 'yes' ? formData.aiTools : [],

          minorAuthors: formData.authors
            .filter(a => a.isMinor)
            .map(a => ({
              name: `${a.firstName} ${a.lastName}`,
              guardianName: a.guardianName,
              consentMethod: a.consentMethod,
              consentFile: a.consentFile
            })),

          manuscriptBase64,
          manuscriptName: formData.manuscript.name,

          authorUID: user.uid,
          authorEmail: user.email,
          authorName: user.displayName || `${formData.authors[0].firstName} ${formData.authors[0].lastName}`.trim()
        };

      const response = await fetch('https://submitarticle-ggqsq2kkua-uc.a.run.app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(await response.text());

      const result = await response.json();

      localStorage.removeItem('submissionFormDraft');
      setSubmissionId(result.submissionId);
      setDriveFolderId(result.driveFolderId);
      setSubmitStatus(isSpanish ? '✅ Artículo enviado con éxito' : '✅ Article submitted successfully');
      setSubmitted(true);

      if (onSuccess) onSuccess(result.submissionId);

    } catch (error) {
      console.error('Error:', error);
      setSubmitStatus(isSpanish ? `❌ Error: ${error.message}` : `❌ Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    } else {
      alert(isSpanish ? 'Completa los campos requeridos antes de continuar.' : 'Complete required fields before continuing.');
    }
  };

  const prevStep = () => setCurrentStep(prev => prev - 1);

  const steps = [
    { id: 1, title: isSpanish ? 'INFORMACIÓN DEL ARTÍCULO' : 'ARTICLE INFORMATION' },
    { id: 2, title: isSpanish ? 'AUTORES Y ÉTICA' : 'AUTHORS & ETHICS' },
    { id: 3, title: isSpanish ? 'DATOS, IA Y DECLARACIONES' : 'DATA, AI & DECLARATIONS' }
  ];

  // Pantalla de éxito final (sin cambios sustanciales, solo estética)
  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-2xl mx-auto py-16 px-4"
      >
        <div className="bg-white border border-[#E0E7E9] shadow-2xl rounded-3xl overflow-hidden">
          {/* BANNER DE POLÍTICAS Y GUÍAS - PERSISTENTE */}
<div className="bg-[#001f3f] border-b border-[#c0a86a] px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
  <div className="flex items-center gap-3">
    <svg className="w-5 h-5 text-[#c0a86a] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
    <p className="text-white text-xs font-serif leading-relaxed">
      {isSpanish
        ? 'El envío de un manuscrito implica la aceptación íntegra de nuestras '
        : 'Submitting a manuscript implies full acceptance of our '}
      <a
        href={isSpanish ? 'https://www.revistacienciasestudiantes.com/policies.html' : 'https://www.revistacienciasestudiantes.com/policiesEN.html'}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#c0a86a] underline hover:text-white transition-colors font-semibold"
      >
        {isSpanish ? 'Políticas Editoriales' : 'Editorial Policies'}
      </a>
      {isSpanish ? ' y nuestras ' : ' and our '}
      <button
        type="button"
        onClick={() => window.open(isSpanish ? '/guidelines' : '/en/guidelines', '_blank')}
        className="text-[#c0a86a] underline hover:text-white transition-colors font-semibold"
      >
        {isSpanish ? 'Directrices para Autores' : 'Author Guidelines'}
      </button>
      .
    </p>
  </div>
  <div className="flex gap-3 flex-shrink-0">
    <a
      href={isSpanish ? 'https://www.revistacienciasestudiantes.com/policies.html' : 'https://www.revistacienciasestudiantes.com/policiesEN.html'}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[10px] uppercase font-bold tracking-[0.15em] text-[#c0a86a] border border-[#c0a86a] px-4 py-2 rounded-sm hover:bg-[#c0a86a] hover:text-[#001f3f] transition-colors whitespace-nowrap"
    >
      {isSpanish ? 'Políticas' : 'Policies'} ↗
    </a>
    <button
      type="button"
      onClick={() => window.open(isSpanish ? '/guidelines' : '/en/guidelines', '_blank')}
      className="text-[10px] uppercase font-bold tracking-[0.15em] text-white border border-white px-4 py-2 rounded-sm hover:bg-white hover:text-[#001f3f] transition-colors whitespace-nowrap"
    >
      {isSpanish ? 'Guías' : 'Guidelines'} ↗
    </button>
  </div>
</div>
          <div className="bg-[#0A1929] p-12 text-center">
            <div className="mx-auto w-24 h-24 bg-[#E5E9F0] rounded-full flex items-center justify-center mb-6">
              <span className="text-5xl">📮</span>
            </div>
            <h2 className="text-3xl font-light text-white mb-3 font-serif">
              {isSpanish ? '¡Gracias por tu envío!' : 'Thank you for your submission!'}
            </h2>
            <p className="text-[#E0E7E9] font-serif">
              {isSpanish
                ? 'Tu artículo ha sido recibido y será revisado por el equipo editorial.'
                : 'Your article has been received and will be reviewed by the editorial team.'}
            </p>
          </div>
          
          <div className="p-12 space-y-8">
            <div className="bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl p-6">
              <p className="text-xs font-mono text-[#546E7A] mb-2">SUBMISSION ID</p>
              <p className="text-2xl font-serif text-[#0A1929] tracking-wider">{submissionId}</p>
            </div>

            <div className="border border-[#E0E7E9] rounded-2xl p-8 hover:border-[#0A1929] transition-colors">
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 bg-[#E5E9F0] rounded-2xl flex items-center justify-center flex-shrink-0">
                  <span className="text-3xl">📁</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-serif text-[#0A1929] mb-2">
                    {isSpanish ? 'Tu carpeta de documentos' : 'Your documents folder'}
                  </h3>
                  <p className="text-sm text-[#546E7A] mb-4 font-serif">
                    {isSpanish 
                      ? 'Aquí puedes ver los documentos que subiste (solo lectura)' 
                      : 'Here you can view the documents you uploaded (read-only)'}
                  </p>
                  <a 
                    href={`https://drive.google.com/drive/folders/${driveFolderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[#0A1929] text-sm font-medium hover:text-[#B22234] transition-colors"
                  >
                    {isSpanish ? 'Abrir en Google Drive' : 'Open in Google Drive'} →
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl p-8">
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 border border-[#E0E7E9]">
                  <span className="text-3xl">📋</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-serif text-[#0A1929] mb-2">
                    {isSpanish ? 'Seguimiento del envío' : 'Submission tracking'}
                  </h3>
                  <p className="text-sm text-[#546E7A] mb-4 font-serif">
                    {isSpanish 
                      ? 'Puedes ver el estado de tu artículo en la pestaña "Mis envíos" del portal' 
                      : 'You can check your article status in the "My submissions" tab on the portal'}
                  </p>
                  <div className="inline-flex items-center gap-2 text-sm text-[#0A1929] font-medium">
                    <span className="text-[#B22234]">⬤</span>
                    {isSpanish ? 'Estado actual: Recibido' : 'Current status: Received'}
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center pt-6 border-t border-[#E0E7E9]">
              <p className="text-xs text-[#546E7A] font-serif">
                {isSpanish 
                  ? 'Recibirás un correo con los detalles del envío' 
                  : 'You will receive an email with submission details'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto px-4 pb-20"
    >
      <div className="bg-white border border-[#E0E7E9] shadow-2xl shadow-[#0A1929]/5 rounded-3xl overflow-hidden">

        <div className="bg-[#0A1929] border-b border-[#1A2B3C] p-12 text-center">
          <div className="flex justify-center items-center gap-3 mb-4">
            <div className="h-px w-8 bg-[#B22234]" />
            <span className="uppercase text-[10px] font-mono tracking-[0.2em] text-[#E5E9F0]">Revista Nacional de las Ciencias para Estudiantes</span>
            <div className="h-px w-8 bg-[#B22234]" />
          </div>
          <h1 className="font-serif text-5xl font-light tracking-tight text-white">
            {isSpanish ? 'Envío de Manuscrito' : 'Manuscript Submission'}
          </h1>
          <p className="text-[#E0E7E9] text-sm mt-3 font-serif">
  {isSpanish ? 'Sistema seguro • Borrador guardado automáticamente' : 'Secure system • Draft auto-saved'}
</p>
<p className="text-[#c0a86a] text-xs mt-2 font-serif">
  {isSpanish ? 'Rige: ' : 'Governed by: '}
  <a
    href={isSpanish ? 'https://www.revistacienciasestudiantes.com/policies.html' : 'https://www.revistacienciasestudiantes.com/policiesEN.html'}
    target="_blank"
    rel="noopener noreferrer"
    className="underline hover:text-white transition-colors"
  >
    {isSpanish ? 'Políticas Editoriales' : 'Editorial Policies'}
  </a>
  {' · '}
  <button
    type="button"
    onClick={() => window.open(isSpanish ? '/guidelines' : '/en/guidelines', '_blank')}
    className="underline hover:text-white transition-colors"
  >
    {isSpanish ? 'Guía para Autores' : 'Author Guidelines'}
  </button>
</p>
        </div>

        <div className="px-8 py-7 bg-white border-b border-[#E0E7E9]">
          <div className="flex justify-between items-center relative">
            <div className="absolute top-5 left-0 w-full h-px bg-[#E0E7E9] z-0" />
            {steps.map((step, idx) => (
              <div key={step.id} className="relative z-10 flex flex-col items-center">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-mono text-base font-semibold transition-all shadow-sm
                  ${currentStep >= step.id
                    ? 'bg-[#0A1929] text-white'
                    : 'bg-white border-2 border-[#E0E7E9] text-[#546E7A]'}`}>
                  {step.id}
                </div>
                <span className={`mt-3 text-[10px] font-mono font-bold uppercase tracking-widest text-center max-w-[90px]
                  ${currentStep >= step.id ? 'text-[#0A1929]' : 'text-[#546E7A]'}`}>
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-16">

          <AnimatePresence mode="wait">
            {/* STEP 1: INFORMACIÓN DEL ARTÍCULO */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="space-y-12"
              >
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-2">
                    {isSpanish ? 'Título del artículo' : 'Article title'} *
                    <HelpCapsule text="Claro, conciso y representativo. Máximo 20 palabras." textEn="Clear, concise and representative. Max 20 words." />
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-lg font-serif focus:border-[#0A1929] outline-none"
                    placeholder={isSpanish ? 'Ejemplo: Impacto de la inteligencia artificial...' : 'Example: Impact of artificial intelligence...'}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-2">
                    {isSpanish ? 'Título en inglés (recomendado)' : 'English title (recommended)'}
                  </label>
                  <input
                    type="text"
                    name="titleEn"
                    value={formData.titleEn}
                    onChange={handleInputChange}
                    className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-lg font-serif focus:border-[#0A1929] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-2">
                    {isSpanish ? 'Resumen' : 'Abstract'} *
                    <HelpCapsule text="Máximo 250 palabras. Estructurado: introducción, métodos, resultados, conclusiones." textEn="Max 250 words. Structured: introduction, methods, results, conclusions." />
                  </label>
                  <textarea
                    name="abstract"
                    value={formData.abstract}
                    onChange={handleInputChange}
                    required
                    rows={7}
                    className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-2">
                    {isSpanish ? 'Abstract en inglés' : 'English abstract'}
                  </label>
                  <textarea
                    name="abstractEn"
                    value={formData.abstractEn}
                    onChange={handleInputChange}
                    rows={7}
                    className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                  />
                </div>

                {/* NUEVO CAMBIO: Selector de tipo de artículo alineado a la política */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-2">
                    {isSpanish ? 'Tipo de artículo' : 'Article type'} *
                    <HelpCapsule
                      text="Selecciona la tipología que mejor se adapte a tu manuscrito según las políticas editoriales (Sección 2.2)."
                      textEn="Select the typology that best fits your manuscript according to the editorial policies (Section 2.2)."
                    />
                  </label>
                  <select
                    name="articleType"
                    value={formData.articleType}
                    onChange={handleInputChange}
                    className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                  >
                    <option value="">— Selecciona tipo —</option>
                    {articleTypeOptions[isSpanish ? 'es' : 'en'].map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[#546E7A] mt-2 font-serif leading-relaxed">
  {isSpanish
    ? 'Consulte la '
    : 'Refer to the '}
  <a
    href={isSpanish ? 'https://www.revistacienciasestudiantes.com/policies.html#alcance' : 'https://www.revistacienciasestudiantes.com/policiesEN.html#scope'}
    target="_blank"
    rel="noopener noreferrer"
    className="text-[#0A1929] underline hover:text-[#B22234] transition-colors"
  >
    {isSpanish ? 'Sección 2.2 de las Políticas Editoriales' : 'Section 2.2 of the Editorial Policies'}
  </a>
  {isSpanish ? ' para una descripción detallada de cada tipología.' : ' for a detailed description of each typology.'}
</p>
                </div>

                {/* NUEVO CAMBIO: Área temática ahora es un select obligatorio */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-2">
                    {isSpanish ? 'Área temática' : 'Subject area'} *
                    <HelpCapsule text="Selecciona el área principal de tu investigación." textEn="Select the main area of your research." />
                  </label>
                  <select
                    name="area"
                    value={formData.area}
                    onChange={handleInputChange}
                    required
                    className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                  >
                    <option value="">— Selecciona un área general —</option>
                    {Object.entries(AREAS_TEMATICAS).map(([categoria, subareas]) => (
                      <optgroup key={categoria} label={categoria}>
                        {subareas.map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <p className="text-[11px] text-[#546E7A] mt-2 font-serif leading-relaxed">
  {isSpanish
    ? 'El área determina el vocabulario controlado para las palabras clave. Consulte la '
    : 'The area determines the controlled vocabulary for keywords. See the '}
  <a
    href={isSpanish ? 'https://www.revistacienciasestudiantes.com/policies.html#clasificacion' : 'https://www.revistacienciasestudiantes.com/policiesEN.html#classification'}
    target="_blank"
    rel="noopener noreferrer"
    className="text-[#0A1929] underline hover:text-[#B22234] transition-colors"
  >
    {isSpanish ? 'Sección 2.5 de las Políticas' : 'Section 2.5 of the Policies'}
  </a>
  .
</p>
                </div>

                {/* PALABRAS CLAVE CON VOCABULARIO CONTROLADO */}
{formData.area && VOCABULARIO_POR_AREA[formData.area] ? (
  <div className="space-y-8">
    <div>
      <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-3">
        {isSpanish ? 'Palabras Clave' : 'Keywords'} *
        <HelpCapsule
          text={`Mínimo 2, máximo 6. Usa el vocabulario ${VOCABULARIO_POR_AREA[formData.area]?.vocabulario || 'controlado'} para esta área. Cada palabra debe tener un código y un término.`}
          textEn={`Minimum 2, maximum 6. Use the ${VOCABULARIO_POR_AREA[formData.area]?.vocabulario || 'controlled'} vocabulary for this area. Each keyword must have a code and a term.`}
        />
      </label>
      <ControlledKeywordInput
        vocabularyConfig={VOCABULARIO_POR_AREA[formData.area]}
        value={formData.controlledKeywords}
        onChange={(val) => setFormData(prev => ({ ...prev, controlledKeywords: val }))}
        language={language}
      />
    </div>
    
    <div>
      <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-3">
        {isSpanish ? 'Keywords en inglés' : 'English Keywords'}
        <HelpCapsule
          text="Traduce tus palabras clave al inglés usando el mismo formato y vocabulario."
          textEn="Translate your keywords to English using the same format and vocabulary."
        />
      </label>
      <ControlledKeywordInput
        vocabularyConfig={VOCABULARIO_POR_AREA[formData.area]}
        value={formData.controlledKeywordsEn}
        onChange={(val) => setFormData(prev => ({ ...prev, controlledKeywordsEn: val }))}
        language={language}
      />
    </div>
  </div>
) : (
  <div className="bg-[#F5F7FA] rounded-2xl p-6 text-center border-2 border-dashed border-[#E0E7E9]">
    <p className="text-[#5A6B7A] text-sm font-['Lora']">
      {isSpanish 
        ? 'Selecciona primero un área temática para configurar el vocabulario controlado.'
        : 'Select a subject area first to configure the controlled vocabulary.'}
    </p>
  </div>
)}

                

                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-2">
                    {isSpanish ? 'Idioma del manuscrito' : 'Manuscript language'} *
                  </label>
                  <select
                    name="paperLanguage"
                    value={formData.paperLanguage}
                    onChange={handleInputChange}
                    className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                  >
                    <option value="es">Español</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </motion.div>
            )}

            {/* STEP 2: AUTORES Y ÉTICA */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="space-y-14"
              >
                <div>
                  <h3 className="font-serif text-2xl font-light text-[#0A1929] mb-6 border-b border-[#E0E7E9] pb-4">
                    {isSpanish ? 'Autores' : 'Authors'}
                  </h3>

                  {formData.authors.map((author, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-8 bg-white border border-[#E0E7E9] rounded-3xl p-8 relative"
                    >
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => removeAuthor(index)}
                          className="absolute top-6 right-6 text-[#546E7A] hover:text-[#B22234]"
                        >
                          ✕
                        </button>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-xs text-[#546E7A] mb-1 block font-serif">Nombre *</label>
                          <input
                            type="text"
                            value={author.firstName}
                            onChange={(e) => handleAuthorChange(index, 'firstName', e.target.value)}
                            className="w-full p-3.5 border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[#546E7A] mb-1 block font-serif">Apellido *</label>
                          <input
                            type="text"
                            value={author.lastName}
                            onChange={(e) => handleAuthorChange(index, 'lastName', e.target.value)}
                            className="w-full p-3.5 border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs text-[#546E7A] mb-1 block font-serif">Correo electrónico *</label>
                          <input
                            type="email"
                            value={author.email}
                            onChange={(e) => handleAuthorChange(index, 'email', e.target.value)}
                            className="w-full p-3.5 border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs text-[#546E7A] mb-1 block font-serif">Institución / Afiliación *</label>
                          <input
                            type="text"
                            value={author.institution}
                            onChange={(e) => handleAuthorChange(index, 'institution', e.target.value)}
                            className="w-full p-3.5 border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs text-[#546E7A] mb-1 block flex items-center font-serif">
                            ORCID
                            <HelpCapsule text="0000-0000-0000-0000" textEn="0000-0000-0000-0000" />
                          </label>
                          <input
                            type="text"
                            value={author.orcid}
                            onChange={(e) => handleAuthorChange(index, 'orcid', e.target.value)}
                            placeholder="0000-0000-0000-0000"
                            className="w-full p-3.5 border border-[#E0E7E9] rounded-2xl text-sm font-mono focus:border-[#0A1929] outline-none"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs text-[#546E7A] mb-1 block font-serif">
                            {isSpanish ? 'Contribución del autor (CRediT)' : 'Author contribution (CRediT)'} *
                            <HelpCapsule
                              text="Especifica el rol según la taxonomía CRediT (Conceptualización, Metodología, Software, Validación, Análisis Formal, Investigación, Recursos, Curación de Datos, Escritura - Original, Escritura - Revisión, Visualización, Supervisión, Administración de Proyecto, Adquisición de Fondos). Debe cumplir los 4 criterios de autoría ICMJE."
                              textEn="Specify the role according to the CRediT taxonomy (Conceptualization, Methodology, Software, Validation, Formal analysis, Investigation, Resources, Data Curation, Writing - Original Draft, Writing - Review & Editing, Visualization, Supervision, Project administration, Funding acquisition). Must meet all 4 ICMJE authorship criteria."
                            />
                          </label>
                          <textarea
                            value={author.contribution}
                            onChange={(e) => handleAuthorChange(index, 'contribution', e.target.value)}
                            rows={2}
                            className="w-full p-3.5 border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                            placeholder={isSpanish ? 'Conceptualización, análisis de datos y redacción' : 'Conceptualization, data analysis and writing'}
                          />
                        </div>
                      </div>

                      <div className="mt-8 border-t border-[#E0E7E9] pt-6">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={author.isMinor}
                            onChange={(e) => {
                              handleAuthorChange(index, 'isMinor', e.target.checked);
                              if (!e.target.checked) {
                                handleAuthorChange(index, 'guardianName', '');
                                handleAuthorChange(index, 'consentMethod', 'none');
                                handleAuthorChange(index, 'consentFile', null);
                              }
                            }}
                            className="w-4 h-4 text-[#0A1929]"
                          />
                          <span className="text-sm text-[#1A2B3C] font-serif">
                            {isSpanish ? 'Este autor es menor de edad' : 'This author is a minor'}
                          </span>
                        </label>

                        {author.isMinor && (
                          <MinorConsentSection
                            author={author}
                            index={index}
                            onUpdate={handleAuthorChange}
                          />
                        )}
                      </div>

                      <div className="mt-6">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={author.isCorresponding}
                            onChange={(e) => handleAuthorChange(index, 'isCorresponding', e.target.checked)}
                            className="w-4 h-4 text-[#0A1929]"
                          />
                          <span className="text-sm text-[#1A2B3C] font-serif">
                            {isSpanish ? 'Autor de correspondencia' : 'Corresponding author'}
                          </span>
                        </label>
                      </div>
                    </motion.div>
                  ))}

                  <button
                    type="button"
                    onClick={addAuthor}
                    className="w-full py-5 border-2 border-dashed border-[#E0E7E9] rounded-3xl text-[#546E7A] hover:text-[#0A1929] hover:border-[#0A1929] flex items-center justify-center gap-3 transition-all font-serif"
                  >
                    <span className="text-2xl">+</span>
                    {isSpanish ? 'Agregar otro autor' : 'Add another author'}
                  </button>
                </div>

                {/* Financiación */}
                <div className="space-y-6">
                  <h3 className="font-serif text-2xl font-light text-[#0A1929] border-b border-[#E0E7E9] pb-4 flex items-center gap-2">
                    {isSpanish ? 'Financiación' : 'Funding'}
                    <HelpCapsule
                      text="Declara todas las fuentes de financiamiento, incluyendo códigos de subvención. Si no hubo financiamiento, lo declararás en el manuscrito."
                      textEn="Declare all funding sources, including grant numbers. If there was no funding, you will declare this in the manuscript."
                    />
                  </h3>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      name="funding.hasFunding"
                      checked={formData.funding.hasFunding}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-[#0A1929]"
                    />
                    <span className="text-sm text-[#1A2B3C] font-serif">
                      {isSpanish ? 'Este trabajo recibió financiación externa' : 'This work received external funding'}
                    </span>
                  </label>

                  {formData.funding.hasFunding && (
                    <div className="pl-8 space-y-6">
                      <div>
                        <label className="text-xs text-[#546E7A] mb-1 block font-serif">{isSpanish ? 'Entidad financiadora' : 'Funding entity'}</label>
                        <input
                          type="text"
                          name="funding.sources"
                          value={formData.funding.sources}
                          onChange={handleInputChange}
                          className="w-full p-3.5 border border-[#E0E7E9] rounded-2xl font-serif"
                          placeholder={isSpanish ? 'FONDECYT, ANID...' : 'NSF, NIH...'}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#546E7A] mb-1 block font-serif">{isSpanish ? 'Código(s) de la subvención' : 'Grant number(s)'}</label>
                        <input
                          type="text"
                          name="funding.grantNumbers"
                          value={formData.funding.grantNumbers}
                          onChange={handleInputChange}
                          className="w-full p-3.5 border border-[#E0E7E9] rounded-2xl font-serif"
                          placeholder="123456, 789012"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Conflicto de intereses */}
                <div>
                  <h3 className="font-serif text-2xl font-light text-[#0A1929] border-b border-[#E0E7E9] pb-4 flex items-center gap-2">
                    {isSpanish ? 'Conflicto de intereses' : 'Conflict of interest'}
                    <HelpCapsule
                      text="Declara cualquier relación financiera, personal, académica o ideológica que pueda influir. Si no hay, declara: 'Los autores declaran no tener conflictos de interés'."
                      textEn="Declare any financial, personal, academic, or ideological relationship that could influence. If none, declare: 'The authors declare no conflicts of interest'."
                    />
                  </h3>
                  <textarea
                    name="conflictOfInterest"
                    value={formData.conflictOfInterest}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full p-4 border border-[#E0E7E9] rounded-2xl text-sm mt-4 font-serif"
                    placeholder={isSpanish ? 'Los autores declaran no tener conflictos de interés.' : 'The authors declare no conflicts of interest.'}
                  />
                </div>

                {/* NUEVA SECCIÓN: Aprobación Ética */}
                <div className="space-y-6">
                  <h3 className="font-serif text-2xl font-light text-[#0A1929] border-b border-[#E0E7E9] pb-4 flex items-center gap-2">
                    {isSpanish ? 'Aprobación Ética' : 'Ethics Approval'}
                    <HelpCapsule
                      text="Requerida para estudios con interacción directa con seres humanos, datos personales identificables o muestras biológicas. Exenta para revisiones, ensayos teóricos o datos públicos anónimos. (Política 5.2)"
                      textEn="Required for studies involving direct interaction with humans, identifiable personal data, or human biological samples. Exempt for reviews, theoretical essays, or public anonymous data. (Policy 5.2)"
                    />
                  </h3>
                  <select
                    name="requiresEthicsApproval"
                    value={formData.requiresEthicsApproval}
                    onChange={handleInputChange}
                    className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                  >
                    <option value="no">{isSpanish ? 'No, mi estudio está exento o no involucra sujetos humanos' : 'No, my study is exempt or does not involve human subjects'}</option>
                    <option value="yes">{isSpanish ? 'Sí, mi estudio requirió aprobación de un comité de ética' : 'Yes, my study required ethics committee approval'}</option>
                  </select>
                  <p className="text-[11px] text-[#546E7A] mt-2 font-serif leading-relaxed">
  {isSpanish
    ? 'Consulte los criterios de exención y requisitos en la '
    : 'See the exemption criteria and requirements in '}
  <a
    href={isSpanish ? 'https://www.revistacienciasestudiantes.com/policies.html#etica' : 'https://www.revistacienciasestudiantes.com/policiesEN.html#ethics'}
    target="_blank"
    rel="noopener noreferrer"
    className="text-[#0A1929] underline hover:text-[#B22234] transition-colors"
  >
    {isSpanish ? 'Sección 5.2 de las Políticas Editoriales' : 'Section 5.2 of the Editorial Policies'}
  </a>
  .
</p>

                  {formData.requiresEthicsApproval === 'yes' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <label className="text-xs text-[#546E7A] mb-1 block font-serif">
                        {isSpanish ? 'Nombre del comité, código de aprobación y fecha *' : 'Committee name, approval code and date *'}
                      </label>
                      <input
                        type="text"
                        name="ethicsCommitteeName"
                        value={formData.ethicsCommitteeName}
                        onChange={handleInputChange}
                        className="w-full p-3.5 border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                        placeholder={isSpanish ? 'Comité de Ética Universidad X, Acta 123, 01/2024' : 'Ethics Committee University X, Protocol 123, 01/2024'}
                      />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 3: DATOS, IA Y DECLARACIONES FINALES */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="space-y-14"
              >
                {/* NUEVA SECCIÓN: USO DE INTELIGENCIA ARTIFICIAL */}
                <div className="space-y-6">
                  <h3 className="font-serif text-2xl font-light text-[#0A1929] border-b border-[#E0E7E9] pb-4 flex items-center gap-2">
                    {isSpanish ? 'Uso de Inteligencia Artificial (IA)' : 'Use of Artificial Intelligence (AI)'}
                    <HelpCapsule
                      text="La IA no puede ser autora. Declara si usaste herramientas como ChatGPT para corrección, traducción, análisis de datos o generación de texto/imágenes. Esto es obligatorio según la Sección 7.3."
                      textEn="AI cannot be an author. Declare if you used tools like ChatGPT for editing, translation, data analysis, or text/image generation. This is mandatory per Section 7.3."
                    />
                  </h3>
                  <select
                    name="aiUsed"
                    value={formData.aiUsed}
                    onChange={handleInputChange}
                    className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                  >
                    <option value="no">{isSpanish ? 'No se utilizó IA en este trabajo' : 'AI was not used in this work'}</option>
                    <option value="yes">{isSpanish ? 'Sí, se utilizó IA en este trabajo' : 'Yes, AI was used in this work'}</option>
                  </select>
                  <p className="text-[11px] text-[#546E7A] mt-2 font-serif leading-relaxed">
  {isSpanish
    ? 'La IA no puede ser autora ni citada como fuente. Consulte el '
    : 'AI cannot be an author or cited as a source. See '}
  <a
    href={isSpanish ? 'https://www.revistacienciasestudiantes.com/policies.html#ia' : 'https://www.revistacienciasestudiantes.com/policiesEN.html#ai'}
    target="_blank"
    rel="noopener noreferrer"
    className="text-[#0A1929] underline hover:text-[#B22234] transition-colors"
  >
    {isSpanish ? 'Capítulo 7 de las Políticas' : 'Chapter 7 of the Policies'}
  </a>
  {isSpanish ? ' para los usos permitidos y prohibidos.' : ' for permitted and prohibited uses.'}
</p>

                  {formData.aiUsed === 'yes' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 border border-[#E0E7E9] rounded-2xl p-6 bg-[#F5F7FA]">
                      <p className="text-xs font-mono text-[#546E7A] uppercase tracking-widest">{isSpanish ? 'Especifica las herramientas usadas' : 'Specify the tools used'}</p>
                      {formData.aiTools.map((tool, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white rounded-xl border border-[#E0E7E9] relative">
                          <div>
                            <label className="text-xs text-[#546E7A] block mb-1 font-serif">{isSpanish ? 'Herramienta y versión' : 'Tool and version'}</label>
                            <input
                              type="text"
                              value={tool.name}
                              onChange={(e) => handleAIToolChange(index, 'name', e.target.value)}
                              placeholder="ChatGPT-4, Gemini Pro..."
                              className="w-full p-2.5 border border-[#E0E7E9] rounded-xl text-sm font-serif outline-none"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-xs text-[#546E7A] block mb-1 font-serif">{isSpanish ? 'Propósito y sección donde se usó' : 'Purpose and section where it was used'}</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={tool.purpose}
                                onChange={(e) => handleAIToolChange(index, 'purpose', e.target.value)}
                                placeholder={isSpanish ? 'Corrección de estilo en todo el manuscrito, traducción del resumen...' : 'Proofreading of the manuscript, translation of the abstract...'}
                                className="flex-1 p-2.5 border border-[#E0E7E9] rounded-xl text-sm font-serif outline-none"
                              />
                              {formData.aiTools.length > 1 && (
                                <button type="button" onClick={() => removeAITool(index)} className="text-[#B22234] hover:bg-red-50 p-2 rounded-xl transition-colors">✕</button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addAITool}
                        className="text-sm text-[#0A1929] hover:text-[#B22234] font-medium flex items-center gap-1 font-serif"
                      >
                        + {isSpanish ? 'Agregar otra herramienta' : 'Add another tool'}
                      </button>
                    </motion.div>
                  )}
                </div>

                {/* DISPONIBILIDAD DE DATOS Y CÓDIGO */}
                <div className="space-y-8">
                  <h3 className="font-serif text-2xl font-light text-[#0A1929] border-b border-[#E0E7E9] pb-4">
                    {isSpanish ? 'Disponibilidad de Datos y Código' : 'Data and Code Availability'}
                  </h3>
                  <p className="text-[11px] text-[#546E7A] -mt-4 mb-6 font-serif leading-relaxed">
  {isSpanish
    ? 'Obligatorio según el '
    : 'Mandatory as per '}
  <a
    href={isSpanish ? 'https://www.revistacienciasestudiantes.com/policies.html#datos' : 'https://www.revistacienciasestudiantes.com/policiesEN.html#data'}
    target="_blank"
    rel="noopener noreferrer"
    className="text-[#0A1929] underline hover:text-[#B22234] transition-colors"
  >
    {isSpanish ? 'Capítulo 8 de las Políticas Editoriales' : 'Chapter 8 of the Editorial Policies'}
  </a>
  .
</p>
                  
                  <div>
                    <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-3">
                      {isSpanish ? 'Declaración de disponibilidad de los datos' : 'Data availability statement'} *
                      <HelpCapsule
                        text="Obligatorio incluso si no hay datos. Recomendamos repositorios como Zenodo, Figshare, OSF o Dryad."
                        textEn="Mandatory even if there is no data. We recommend repositories such as Zenodo, Figshare, OSF or Dryad."
                      />
                    </label>
                    <select
                      name="dataAvailability"
                      value={formData.dataAvailability}
                      onChange={handleInputChange}
                      required
                      className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif mb-4"
                    >
                      <option value="">— {isSpanish ? 'Selecciona una opción' : 'Select an option'} —</option>
                      {availabilityOptions[isSpanish ? 'es' : 'en'].map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      name="dataAvailabilityEn"
                      value={formData.dataAvailabilityEn}
                      onChange={handleInputChange}
                      placeholder={isSpanish ? 'Especificar en inglés (si aplica)' : 'Specify in English (if applicable)'}
                      className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-3">
                      {isSpanish ? 'Declaración de disponibilidad del código' : 'Code availability statement'}
                      <HelpCapsule
                        text="Recomendamos depositar el código en GitHub (archivado con Zenodo para un DOI), GitLab u OSF con licencia abierta (MIT, BSD, GPL)."
                        textEn="We recommend depositing the code in GitHub (archived with Zenodo for a DOI), GitLab, or OSF under an open license (MIT, BSD, GPL)."
                      />
                    </label>
                    <select
                      name="codeAvailability"
                      value={formData.codeAvailability}
                      onChange={handleInputChange}
                      className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif mb-4"
                    >
                      <option value="">— {isSpanish ? 'Selecciona una opción (opcional)' : 'Select an option (optional)'} —</option>
                      {availabilityOptions[isSpanish ? 'es' : 'en'].map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      name="codeAvailabilityEn"
                      value={formData.codeAvailabilityEn}
                      onChange={handleInputChange}
                      placeholder={isSpanish ? 'Especificar en inglés (si aplica)' : 'Specify in English (if applicable)'}
                      className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                    />
                  </div>
                </div>

                {/* DECLARACIONES OBLIGATORIAS (Actualizadas) */}
                <div>
                  <h3 className="font-serif text-2xl font-light text-[#0A1929] border-b border-[#E0E7E9] pb-4">
                    {isSpanish ? 'Declaraciones obligatorias' : 'Mandatory declarations'}
                  </h3>
                  <div className="mt-8 space-y-5">
                    {[
                      { key: 'originalAndSimilarity', text: 'El manuscrito es inédito y, en caso de derivar de un trabajo previo, la superposición textual no excede el 15% (Sección 3.2).', textEn: 'The manuscript is unpublished and, if derived from previous work, the textual overlap does not exceed 15% (Section 3.2).' },
                      { key: 'exclusiveSubmission', text: 'El manuscrito no está siendo evaluado simultáneamente en otra revista (Sección 3.3).', textEn: 'The manuscript is not being simultaneously evaluated in another journal (Section 3.3).' },
                      { key: 'authorshipCriteria', text: 'Todos los autores cumplen los 4 criterios de autoría del ICMJE y sus roles CRediT están declarados (Sección 4.1).', textEn: 'All authors meet the 4 ICMJE authorship criteria and their CRediT roles are declared (Section 4.1).' },
                      { key: 'dataAuthentic', text: 'Los datos presentados son auténticos, no han sido manipulados y la investigación cumplió con los estándares éticos aplicables (Capítulo 5).', textEn: 'The data presented are authentic, have not been manipulated, and the research complied with applicable ethical standards (Chapter 5).' },
                      { key: 'informedConsent', text: 'Se obtuvo el consentimiento/asentimiento informado cuando fue necesario y se declara en el manuscrito (Sección 5.2).', textEn: 'Informed consent/assent was obtained when necessary and is declared in the manuscript (Section 5.2).' },
                      { key: 'aiDisclosure', text: 'El uso de cualquier herramienta de IA ha sido declarado en el formulario y en el manuscrito (Capítulo 7).', textEn: 'The use of any AI tool has been declared in this form and in the manuscript (Chapter 7).' },
                      { key: 'conflicts', text: 'Todos los conflictos de interés (reales, potenciales o aparentes) están declarados en el formulario y en el manuscrito (Capítulo 6).', textEn: 'All conflicts of interest (real, potential, or apparent) are declared in this form and in the manuscript (Chapter 6).' }
                    ].map(d => (
                      <label key={d.key} className="flex gap-4 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={formData.declarations[d.key]}
                          onChange={() => handleDeclarationChange(d.key)}
                          className="mt-1 w-5 h-5 text-[#0A1929] rounded"
                        />
                        <span className="text-sm text-[#1A2B3C] group-hover:text-[#0A1929] font-serif">
                          {isSpanish ? d.text : d.textEn}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* LICENCIA CC-BY */}
                <div className="bg-[#E5E9F0] border border-[#0A1929] rounded-3xl p-8">
                  <label className="flex gap-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.declarations.ccByLicense}
                      onChange={() => handleDeclarationChange('ccByLicense')}
                      className="mt-1 w-5 h-5 text-[#0A1929] rounded"
                    />
                    <div>
                      <div className="font-medium text-[#0A1929] font-serif">
                        {isSpanish ? 'Acuerdo de Licencia Creative Commons CC-BY 4.0' : 'Creative Commons CC-BY 4.0 License Agreement'}
                      </div>
                      <p className="text-xs text-[#1A2B3C] mt-1 font-serif">
                        {isSpanish
                          ? 'Al marcar esta casilla, acepto que el artículo, si es aceptado, se publique bajo la licencia de acceso abierto CC BY 4.0. Esto permite a otros compartir y adaptar el material para cualquier propósito, incluso comercial, siempre que se otorgue la atribución adecuada. No cedo mis derechos de autor, solo otorgo una licencia no exclusiva a la revista (Sección 13.2).'
                          : 'By checking this box, I agree that the article, if accepted, will be published under the CC BY 4.0 open access license. This allows others to share and adapt the material for any purpose, even commercially, as long as appropriate credit is given. I do not transfer my copyright, I only grant a non-exclusive license to the journal (Section 13.2).'}
                      </p>
                    </div>
                  </label>
                </div>

                {/* AGRADECIMIENTOS */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-3">
                    {isSpanish ? 'Agradecimientos' : 'Acknowledgments'} (opcional)
                    <HelpCapsule
                      text="Personas que no cumplen criterios de autoría. NO incluir en el manuscrito anonimizado para la revisión."
                      textEn="People who do not meet authorship criteria. Do NOT include in the anonymized manuscript for review."
                    />
                  </label>
                  <textarea
                    name="acknowledgments"
                    value={formData.acknowledgments}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full p-4 border border-[#E0E7E9] rounded-2xl text-sm font-serif"
                    placeholder={isSpanish ? 'Agradecemos al Dr. Juan Pérez por sus comentarios...' : 'We thank Dr. John Smith for his comments...'}
                  />
                </div>

                {/* REVISORES EXCLUIDOS */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-3">
                    {isSpanish ? 'Revisores sugeridos a excluir (opcional)' : 'Reviewers to exclude (optional)'}
                    <HelpCapsule
                      text="Nombres completos separados por punto y coma. No es una garantía absoluta."
                      textEn="Full names separated by semicolon. Not an absolute guarantee."
                    />
                  </label>
                  <input
                    type="text"
                    name="excludedReviewers"
                    value={formData.excludedReviewers}
                    onChange={handleInputChange}
                    className="w-full p-4 border border-[#E0E7E9] rounded-2xl text-sm font-serif"
                    placeholder={isSpanish ? 'Dra. Ana López; Dr. Carlos Mendoza' : 'Dr. Jane Smith; Prof. Michael Brown'}
                  />
                </div>

                {/* ARCHIVO MANUSCRITO */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-3">
                    {isSpanish ? 'Manuscrito anonimizado' : 'Anonymized manuscript'} *
                    <HelpCapsule
                      text="Obligatorio: Word (.doc/.docx), máx. 10 MB. SIN autores, afiliaciones ni agradecimientos. No se aceptan working papers o informes no finalizados (Sección 2.4)."
                      textEn="Required: Word (.doc/.docx), max 10 MB. WITHOUT authors, affiliations, or acknowledgments. Working papers or unfinished reports are not accepted (Section 2.4)."
                    />
                  </label>
                  <div className="border border-[#E0E7E9] rounded-3xl p-8 bg-[#F5F7FA]">
                    <input
                      type="file"
                      accept=".doc,.docx"
                      onChange={handleFileChange}
                      className="block w-full text-sm text-[#546E7A] file:py-4 file:px-8 file:rounded-2xl file:border-0 file:bg-white file:text-[#0A1929] file:font-medium font-serif"
                    />
                    {formData.manuscriptName && (
                      <div className="mt-6 flex items-center gap-3 text-[#0A1929] text-sm font-serif">
                        <span>📄</span>
                        {formData.manuscriptName}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-between items-center pt-8 border-t border-[#E0E7E9]">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="px-7 py-3.5 text-sm font-medium text-[#546E7A] hover:text-[#0A1929] flex items-center gap-2 transition-colors font-serif"
              >
                ← {isSpanish ? 'Anterior' : 'Previous'}
              </button>
            )}

            <div className="ml-auto">
              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-10 py-4 bg-[#0A1929] text-white rounded-2xl text-sm font-semibold hover:bg-[#B22234] transition-all flex items-center gap-3 shadow-lg font-serif"
                >
                  {isSpanish ? 'Continuar' : 'Continue'}
                  <span>→</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={uploading || !allDeclarationsAccepted() || !formData.manuscript}
                  className="px-12 py-4 bg-[#0A1929] text-white rounded-2xl text-sm font-bold hover:bg-[#B22234] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-3 shadow-xl font-serif"
                >
                  {uploading
                    ? (isSpanish ? 'Enviando...' : 'Submitting...')
                    : (isSpanish ? 'ENVIAR PARA REVISIÓN' : 'SUBMIT FOR REVIEW')}
                </button>
              )}
            </div>
          </div>

          {submitStatus && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-sm font-medium mt-4 font-serif"
            >
              {submitStatus}
            </motion.p>
          )}

          <p className="text-center text-[10px] text-[#546E7A] font-mono tracking-widest">
            ⏺ {isSpanish ? 'Borrador guardado automáticamente cada 30 segundos' : 'Draft auto-saved every 30 seconds'}
          </p>
        </form>
      </div>
    </motion.div>
  );
}