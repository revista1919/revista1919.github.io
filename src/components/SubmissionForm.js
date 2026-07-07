import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '../firebase';
import { useLanguage } from '../hooks/useLanguage';

// ============ COMPONENTES AUXILIARES ============

// Componente de Tooltip/Cápsula explicativa
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

// ============ CONFIGURACIÓN DE ÁREAS TEMÁTICAS ============

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

// ============ CONFIGURACIÓN DE VOCABULARIOS CONTROLADOS ============

const VOCABULARIO_POR_AREA = {
  "Matemáticas": {
    vocabulario: "MSC",
    nombre: "Mathematics Subject Classification (MSC2020)",
    formato: "Código MSC: Término",
    ejemplo: "11N05: Distribution of primes",
    searchUrl: "https://mathscinet.ams.org/mathscinet/msc/msc2020.html",
    instrucciones: "Busca tu código en la clasificación MSC2020 de la AMS y copia el código y descriptor exacto."
  },
  "Física": {
    vocabulario: "PhySH",
    nombre: "Physics Subject Headings (APS)",
    formato: "Término PhySH",
    ejemplo: "Quantum mechanics",
    searchUrl: "https://physh.aps.org/",
    instrucciones: "Usa PhySH, el esquema actual de la American Physical Society, y copia el descriptor."
  },
  "Química": {
    vocabulario: "CAS",
    nombre: "Chemical Abstracts Service Classification",
    formato: "Número CAS: Término",
    ejemplo: "78-10-4: Tetraethyl silicate",
    searchUrl: "https://commonchemistry.cas.org/",
    instrucciones: "Busca tu compuesto o sustancia en CAS Common Chemistry y copia el número de registro CAS."
  },
  "Biología": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D001777: Biology",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca y copia el código y descriptor MeSH."
  },
  "Geología": {
    vocabulario: "GeoRef",
    nombre: "GeoRef Thesaurus",
    formato: "Término controlado GeoRef",
    ejemplo: "Igneous rocks: Petrology",
    searchUrl: "https://www.americangeosciences.org/georef/georef-thesaurus",
    instrucciones: "Busca el descriptor controlado aceptado en el tesauro GeoRef."
  },
  "Astronomía y Astrofísica": {
    vocabulario: "UAT",
    nombre: "Unified Astronomy Thesaurus",
    formato: "Código UAT: Término",
    ejemplo: "1087: Exoplanet astronomy",
    searchUrl: "https://astrothesaurus.org/",
    instrucciones: "Navega por el tesauro astronómico unificado y copia el código numérico y descriptor."
  },
  "Ciencias Ambientales y Ecología": {
    vocabulario: "EnvThes",
    nombre: "Environmental Thesaurus",
    formato: "Código EnvThes: Término",
    ejemplo: "20286: Ecosystem services",
    searchUrl: "https://vocabs.lter-europe.net/envthes/en/",
    instrucciones: "Busca tu término en el tesauro ambiental europeo EnvThes."
  },
  "Oceanografía": {
    vocabulario: "BODC",
    nombre: "British Oceanographic Data Centre Vocabulary",
    formato: "Código BODC: Término",
    ejemplo: "P021: Ocean circulation",
    searchUrl: "https://vocab.nerc.ac.uk/",
    instrucciones: "Navega por el NERC Vocabulary Server y copia el código alfanumérico."
  },
  "Meteorología y Ciencias Atmosféricas": {
    vocabulario: "WMO",
    nombre: "World Meteorological Organization Vocabulary",
    formato: "Código WMO: Término",
    ejemplo: "3720: Atmospheric pressure",
    searchUrl: "https://codes.wmo.int/",
    instrucciones: "Busca tu código en los estándares de la Organización Meteorológica Mundial."
  },
  "Paleontología": {
    vocabulario: "PBDB",
    nombre: "Paleobiology Database Taxonomy",
    formato: "Código PBDB: Término",
    ejemplo: "52822: Tyrannosauridae",
    searchUrl: "https://paleobiodb.org/navigator/",
    instrucciones: "Busca tu taxón o grupo fósil en el navegador de la base de datos paleobiológica."
  },
  "Medicina General e Interna": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "Código MeSH: Término",
    ejemplo: "D008112: Internal Medicine",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Busca y copia el código y descriptor MeSH exacto."
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
  "Ingeniería Civil": {
    vocabulario: "Ei",
    nombre: "Engineering Index Thesaurus (Compendex)",
    formato: "Código Ei: Término",
    ejemplo: "405.1: Construction management",
    searchUrl: "https://www.engineeringvillage.com/",
    instrucciones: "Busca tu término en el Engineering Index Thesaurus de Compendex."
  },
  "Ingeniería Industrial y de Sistemas": {
    vocabulario: "IIE",
    nombre: "Industrial Engineering Terminology (IISE)",
    formato: "Código IIE: Término",
    ejemplo: "4.2.1: Supply chain optimization",
    searchUrl: "https://www.iise.org/",
    instrucciones: "Usa la terminología estándar de ingeniería industrial del IISE."
  },
  "Ingeniería Mecánica": {
    vocabulario: "ASME",
    nombre: "ASME Subject Classification",
    formato: "Código ASME: Término",
    ejemplo: "10-01: Thermodynamics",
    searchUrl: "https://www.asme.org/",
    instrucciones: "Navega por las áreas temáticas de la ASME."
  },
  "Ingeniería Eléctrica y Electrónica": {
    vocabulario: "IEEE",
    nombre: "IEEE Thesaurus",
    formato: "Término normalizado IEEE",
    ejemplo: "B6210L: Computer communications",
    searchUrl: "https://www.ieee.org/publications/services/thesaurus-access-page.html",
    instrucciones: "Busca tu término técnico en el tesauro oficial del IEEE."
  },
  "Ingeniería Química y Biotecnología": {
    vocabulario: "IChemE",
    nombre: "Institution of Chemical Engineers Thesaurus",
    formato: "Código IChemE: Término",
    ejemplo: "BIO-04: Bioprocessing",
    searchUrl: "https://www.icheme.org/",
    instrucciones: "Usa la clasificación temática de ingeniería química de IChemE."
  },
  "Ingeniería en Computación e Informática": {
    vocabulario: "ACM",
    nombre: "ACM Computing Classification System",
    formato: "Código ACM: Término",
    ejemplo: "CCS2012.10003116: Software engineering",
    searchUrl: "https://dl.acm.org/ccs",
    instrucciones: "ACM CCS es el estándar jerárquico global para ciencias de la computación."
  },
  "Ciencia de Datos e Inteligencia Artificial": {
    vocabulario: "ACM",
    nombre: "ACM Computing Classification System",
    formato: "Código ACM: Término",
    ejemplo: "CCS2012.10010179: Machine learning",
    searchUrl: "https://dl.acm.org/ccs",
    instrucciones: "ACM CCS cubre ramas de ML e IA extensamente."
  },
  "Robótica y Automatización": {
    vocabulario: "ACM",
    nombre: "ACM Computing Classification System",
    formato: "Código ACM: Término",
    ejemplo: "CCS2012.10010187: Robotics",
    searchUrl: "https://dl.acm.org/ccs",
    instrucciones: "Navega por la clasificación ACM y copia el código y descriptor."
  },
  "Ingeniería de Materiales y Nanotecnología": {
    vocabulario: "ASM",
    nombre: "ASM International Materials Thesaurus",
    formato: "Término controlado ASM",
    ejemplo: "Nanocomposites: Materials science",
    searchUrl: "https://www.asminternational.org/",
    instrucciones: "Busca tu material o proceso en el vocabulario controlado de ASM."
  },
  "Ingeniería Aeroespacial": {
    vocabulario: "NASA",
    nombre: "NASA Thesaurus",
    formato: "Término controlado NASA",
    ejemplo: "Aircraft design: Aeronautics",
    searchUrl: "https://sti.nasa.gov/nasa-thesaurus/",
    instrucciones: "Busca tu término en el tesauro aeroespacial de la NASA."
  },
  "Energías Renovables y Sostenibilidad": {
    vocabulario: "ETDE",
    nombre: "Energy Technology Data Exchange Thesaurus",
    formato: "Término controlado ETDE",
    ejemplo: "Solar energy: Photovoltaics",
    searchUrl: "https://www.etde.org/",
    instrucciones: "Busca tu término en el tesauro de tecnología energética ETDE."
  },
  "Sociología": {
    vocabulario: "JEL",
    nombre: "JEL Classification System",
    formato: "Código JEL: Término",
    ejemplo: "Z13: Economic Sociology",
    searchUrl: "https://www.aeaweb.org/econlit/jelCodes.php",
    instrucciones: "Busca el código JEL que mejor describa tu tema sociológico."
  },
  "Antropología y Arqueología": {
    vocabulario: "JEL",
    nombre: "JEL Classification System",
    formato: "Código JEL: Término",
    ejemplo: "Z19: Other Cultural Economics",
    searchUrl: "https://www.aeaweb.org/econlit/jelCodes.php",
    instrucciones: "Busca el código JEL más cercano a tu tema de antropología."
  },
  "Psicología": {
    vocabulario: "APA",
    nombre: "APA Thesaurus of Psychological Index Terms",
    formato: "Término indexado APA",
    ejemplo: "Cognitive Processes: Memory",
    searchUrl: "https://psycnet.apa.org/thesaurus/",
    instrucciones: "Busca tu término de indexación en el tesauro oficial de la APA."
  },
  "Economía y Negocios": {
    vocabulario: "JEL",
    nombre: "JEL Classification System",
    formato: "Código JEL: Término",
    ejemplo: "D00: General Economics",
    searchUrl: "https://www.aeaweb.org/econlit/jelCodes.php",
    instrucciones: "Selecciona los códigos JEL que mejor describan tu investigación."
  },
  "Ciencias Políticas y Relaciones Internacionales": {
    vocabulario: "JEL",
    nombre: "JEL Classification System",
    formato: "Código JEL: Término",
    ejemplo: "F50: International Relations",
    searchUrl: "https://www.aeaweb.org/econlit/jelCodes.php",
    instrucciones: "Busca códigos JEL en categorías F o H."
  },
  "Derecho": {
    vocabulario: "LCSH",
    nombre: "Library of Congress Subject Headings",
    formato: "Código/Descriptor LCSH",
    ejemplo: "KF385: Common law",
    searchUrl: "https://id.loc.gov/authorities/subjects.html",
    instrucciones: "Busca en los encabezamientos temáticos de la Biblioteca del Congreso."
  },
  "Geografía Humana y Ordenamiento Territorial": {
    vocabulario: "JEL",
    nombre: "JEL Classification System",
    formato: "Código JEL: Término",
    ejemplo: "R10: General Regional Economics",
    searchUrl: "https://www.aeaweb.org/econlit/jelCodes.php",
    instrucciones: "Usa categorías R o Q del sistema JEL."
  },
  "Estudios de Género": {
    vocabulario: "JEL",
    nombre: "JEL Classification System",
    formato: "Código JEL: Término",
    ejemplo: "J16: Economics of Gender",
    searchUrl: "https://www.aeaweb.org/econlit/jelCodes.php",
    instrucciones: "Busca en categorías J para estudios de género."
  },
  "Comunicación Social y Periodismo": {
    vocabulario: "CIOS",
    nombre: "Communication Institute for Online Scholarship Thesaurus",
    formato: "Término normalizado CIOS",
    ejemplo: "Mass media effects: Journalism",
    searchUrl: "https://www.cios.org/",
    instrucciones: "Navega por las categorías controladas especializadas en comunicación."
  },
  "Educación y Pedagogía": {
    vocabulario: "ERIC",
    nombre: "Education Resources Information Center Thesaurus",
    formato: "Término Descriptor ERIC",
    ejemplo: "Educational technology: Pedagogy",
    searchUrl: "https://eric.ed.gov/?ti=all",
    instrucciones: "Busca e identifica descriptores específicos en ERIC."
  },
  "Trabajo Social": {
    vocabulario: "JEL",
    nombre: "JEL Classification System",
    formato: "Código JEL: Término",
    ejemplo: "I38: Welfare, Well-Being, and Poverty",
    searchUrl: "https://www.aeaweb.org/econlit/jelCodes.php",
    instrucciones: "Busca en categorías I o J del sistema JEL."
  },
  "Historia": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Código UNESCO: Término",
    ejemplo: "6.25: Historia",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Navega por el tesauro de la UNESCO y copia el código y descriptor."
  },
  "Filosofía": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Código UNESCO: Término",
    ejemplo: "6.05: Filosofía",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Navega por el tesauro de la UNESCO."
  },
  "Lingüística y Filología": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Código UNESCO: Término",
    ejemplo: "6.10: Lingüística",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Navega por el tesauro de la UNESCO."
  },
  "Literatura": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Código UNESCO: Término",
    ejemplo: "6.15: Literatura",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Navega por el tesauro de la UNESCO."
  },
  "Estudios Clásicos": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Código UNESCO: Término",
    ejemplo: "6.20: Estudios Clásicos",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Navega por el tesauro de la UNESCO."
  },
  "Teología y Ciencias de la Religión": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Código UNESCO: Término",
    ejemplo: "6.30: Teología",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Navega por el tesauro de la UNESCO."
  },
  "Estudios Culturales": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Código UNESCO: Término",
    ejemplo: "6.35: Cultura",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Navega por el tesauro de la UNESCO."
  },
  "Arte, Música y Cine": {
    vocabulario: "AAT",
    nombre: "Art & Architecture Thesaurus",
    formato: "Código AAT: Término",
    ejemplo: "300033618: Oil paintings",
    searchUrl: "https://www.getty.edu/research/tools/vocabularies/aat/",
    instrucciones: "Busca descriptores artísticos en la base del Getty Research Institute."
  },
  "Arquitectura y Urbanismo": {
    vocabulario: "AAT",
    nombre: "Art & Architecture Thesaurus",
    formato: "Código AAT: Término",
    ejemplo: "300008125: Skyscrapers",
    searchUrl: "https://www.getty.edu/research/tools/vocabularies/aat/",
    instrucciones: "Busca estructuras o conceptos espaciales en la base del Getty."
  },
  "Agronomía y Producción Agrícola": {
    vocabulario: "AGROVOC",
    nombre: "FAO Agricultural Thesaurus (AGROVOC)",
    formato: "Código AGROVOC: Término",
    ejemplo: "c_867: Crop rotation",
    searchUrl: "https://agrovoc.fao.org/browse/agrovoc/en/",
    instrucciones: "AGROVOC es el estándar para ciencias agrícolas de la FAO."
  },
  "Ciencias Forestales": {
    vocabulario: "AGROVOC",
    nombre: "FAO Agricultural Thesaurus (AGROVOC)",
    formato: "Código AGROVOC: Término",
    ejemplo: "c_3014: Forest ecology",
    searchUrl: "https://agrovoc.fao.org/browse/agrovoc/en/",
    instrucciones: "AGROVOC cubre ciencias forestales."
  },
  "Acuicultura y Pesca": {
    vocabulario: "ASFA",
    nombre: "Aquatic Sciences and Fisheries Abstracts Thesaurus",
    formato: "Código ASFA: Término",
    ejemplo: "Q5 01521: Fish culture",
    searchUrl: "https://www.fao.org/fishery/asfa/en",
    instrucciones: "Busca en el tesauro ASFA de la FAO."
  },
  "Zootecnia y Producción Animal": {
    vocabulario: "AGROVOC",
    nombre: "FAO Agricultural Thesaurus (AGROVOC)",
    formato: "Código AGROVOC: Término",
    ejemplo: "c_433: Animal breeding",
    searchUrl: "https://agrovoc.fao.org/browse/agrovoc/en/",
    instrucciones: "Busca tu término en AGROVOC."
  },
  "Ingeniería de Alimentos": {
    vocabulario: "FSTA",
    nombre: "Food Science and Technology Abstracts Thesaurus",
    formato: "Código FSTA: Término",
    ejemplo: "Q04: Food microbiology",
    searchUrl: "https://www.ifis.org/fsta",
    instrucciones: "Usa el tesauro de ciencia y tecnología de alimentos FSTA."
  }
};

// ============ COMPONENTE: PALABRAS CLAVE CONTROLADAS ============

const ControlledKeywordInput = ({ vocabularyConfig, value, onChange, language }) => {
  const isSpanish = language === 'es';
  const [newCode, setNewCode] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [error, setError] = useState('');

  const maxKeywords = 6;
  const minKeywords = 2;
  const keywords = Array.isArray(value) ? value : [];

  // Limpiar error cuando cambian los inputs
  useEffect(() => {
    if (newCode.trim() && newTerm.trim()) {
      setError('');
    }
  }, [newCode, newTerm]);

  const addKeyword = () => {
    const code = newCode.trim();
    const term = newTerm.trim();
    
    // Validaciones con mensajes claros
    if (!code || !term) {
      setError(isSpanish 
        ? 'Debes ingresar tanto el código como el término.' 
        : 'You must enter both the code and the term.');
      return;
    }
    
    if (keywords.length >= maxKeywords) {
      setError(isSpanish 
        ? `Has alcanzado el máximo de ${maxKeywords} palabras clave.` 
        : `You have reached the maximum of ${maxKeywords} keywords.`);
      return;
    }
    
    if (keywords.some(k => k.code === code)) {
      setError(isSpanish 
        ? 'Este código ya existe en tus palabras clave. Usa un código diferente.' 
        : 'This code already exists in your keywords. Use a different code.');
      return;
    }

    const updatedKeywords = [...keywords, { code, term }];
    onChange(updatedKeywords);
    setNewCode('');
    setNewTerm('');
    setError('');
  };

  const removeKeyword = (index) => {
    const updatedKeywords = keywords.filter((_, i) => i !== index);
    onChange(updatedKeywords);
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
            placeholder={vocabularyConfig.vocabulario === 'JEL' ? 'B14' : 'CCS2012.10010179'}
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
            placeholder="Machine learning"
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

      {/* Mensaje de error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-[#B22234] font-serif">
          {error}
        </div>
      )}

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

// ============ COMPONENTE: SECCIÓN DE CONSENTIMIENTO PARA MENORES ============

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
        <p className="text-xs uppercase tracking-widest text-[#546E7A] font-mono">
          {isSpanish ? 'Método de consentimiento' : 'Consent method'}
        </p>

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

// ============ COMPONENTE PRINCIPAL DEL FORMULARIO ============

export default function SubmissionForm({ user, onSuccess }) {
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  // Estados del formulario
  const [currentStep, setCurrentStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState('');
  const [driveFolderId, setDriveFolderId] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  // Estado inicial del formulario
  const initialFormState = {
    title: '',
    titleEn: '',
    abstract: '',
    abstractEn: '',
    controlledKeywords: [],
    controlledKeywordsEn: [],
    area: '',
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
    requiresEthicsApproval: 'no',
    ethicsCommitteeName: '',
    aiUsed: 'no',
    aiTools: [{ name: '', version: '', purpose: '' }],
    declarations: {
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
  };

  const [formData, setFormData] = useState(initialFormState);

  // Opciones de tipo de artículo
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

  // Cargar borrador guardado
  useEffect(() => {
    const savedData = localStorage.getItem('submissionFormDraft');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData(prev => ({
          ...prev,
          ...parsed,
          manuscript: null,
          manuscriptName: parsed.manuscriptName || ''
        }));
      } catch (e) {
        console.error('[DEBUG] Error cargando borrador:', e);
      }
    }
  }, []);

  // Guardar borrador automáticamente
  useEffect(() => {
    const interval = setInterval(() => {
      const dataToSave = {
        ...formData,
        manuscript: null,
        manuscriptName: formData.manuscriptName
      };
      localStorage.setItem('submissionFormDraft', JSON.stringify(dataToSave));
      console.log('[DEBUG] Borrador guardado:', new Date().toLocaleTimeString());
    }, 30000);
    return () => clearInterval(interval);
  }, [formData]);

  // Utilidad para convertir archivo a base64
  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
    });

  // Manejador de cambios en inputs simples
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
    
    // Limpiar error del campo cuando se modifica
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[name];
      return newErrors;
    });
  };

  // Manejador de cambios en autores
  const handleAuthorChange = (index, field, value) => {
    const newAuthors = [...formData.authors];
    newAuthors[index] = { ...newAuthors[index], [field]: value };
    setFormData(prev => ({ ...prev, authors: newAuthors }));
  };

  // Agregar autor
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

  // Eliminar autor
  const removeAuthor = (index) => {
    if (formData.authors.length > 1) {
      const newAuthors = formData.authors.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, authors: newAuthors }));
    }
  };

  // Manejadores de herramientas de IA
  const handleAIToolChange = (index, field, value) => {
    const newTools = [...formData.aiTools];
    newTools[index] = { ...newTools[index], [field]: value };
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
    setFormData(prev => ({ 
      ...prev, 
      aiTools: newTools.length > 0 ? newTools : [{ name: '', version: '', purpose: '' }] 
    }));
  };

  // Manejador de archivo
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

  // Manejador de declaraciones
  const handleDeclarationChange = (key) => {
    setFormData(prev => ({
      ...prev,
      declarations: {
        ...prev.declarations,
        [key]: !prev.declarations[key]
      }
    }));
  };

  // Verificar si todas las declaraciones están aceptadas
  const allDeclarationsAccepted = () => Object.values(formData.declarations).every(Boolean);

  // ============ FUNCIÓN DE VALIDACIÓN CORREGIDA ============
  
 // ============ FUNCIÓN DE VALIDACIÓN CORREGIDA (SIN EFECTOS SECUNDARIOS) ============

// Función pura para validar sin modificar estado (para usar en el renderizado)
const isStepValid = (step) => {
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
      let isValid = allDeclarationsAccepted() && 
             (formData.manuscript || formData.manuscriptName) && 
             formData.dataAvailability && formData.dataAvailability.trim() !== '';
      if (formData.requiresEthicsApproval === 'yes' && !formData.ethicsCommitteeName.trim()) {
          isValid = false;
      }
      if (formData.aiUsed === 'yes') {
          const hasValidTool = formData.aiTools.some(tool => tool.name.trim() && tool.purpose.trim());
          if (!hasValidTool) isValid = false;
      }
      return isValid;
    
    default:
      return true;
  }
};

// Función de validación con efectos secundarios (solo para navegación y envío)
const validateAndProceed = (step) => {
  const errors = {};
  
  switch (step) {
    case 1:
      if (!formData.title.trim()) {
        errors.title = isSpanish ? 'El título es obligatorio' : 'Title is required';
      }
      if (!formData.abstract.trim()) {
        errors.abstract = isSpanish ? 'El resumen es obligatorio' : 'Abstract is required';
      }
      if (!formData.controlledKeywords || formData.controlledKeywords.length < 2) {
        errors.controlledKeywords = isSpanish 
          ? 'Debes agregar al menos 2 palabras clave (mínimo 2)' 
          : 'You must add at least 2 keywords (minimum 2)';
      }
      if (formData.controlledKeywords && formData.controlledKeywords.length > 6) {
        errors.controlledKeywords = isSpanish 
          ? 'Máximo 6 palabras clave permitidas' 
          : 'Maximum 6 keywords allowed';
      }
      if (!formData.area.trim()) {
        errors.area = isSpanish ? 'El área temática es obligatoria' : 'Subject area is required';
      }
      if (!formData.articleType) {
        errors.articleType = isSpanish ? 'El tipo de artículo es obligatorio' : 'Article type is required';
      }
      break;
      
    case 2:
      formData.authors.forEach((author, index) => {
        if (!author.firstName.trim()) {
          errors[`author_${index}_firstName`] = isSpanish ? 'Nombre requerido' : 'First name required';
        }
        if (!author.lastName.trim()) {
          errors[`author_${index}_lastName`] = isSpanish ? 'Apellido requerido' : 'Last name required';
        }
        if (!author.email.trim()) {
          errors[`author_${index}_email`] = isSpanish ? 'Email requerido' : 'Email required';
        }
        if (!author.institution.trim()) {
          errors[`author_${index}_institution`] = isSpanish ? 'Institución requerida' : 'Institution required';
        }
        if (author.isMinor) {
          if (!author.guardianName.trim()) {
            errors[`author_${index}_guardian`] = isSpanish 
              ? 'Nombre del tutor requerido para autor menor' 
              : 'Guardian name required for minor author';
          }
          if (author.consentMethod === 'none') {
            errors[`author_${index}_consent`] = isSpanish 
              ? 'Debes seleccionar un método de consentimiento' 
              : 'You must select a consent method';
          }
          if (author.consentMethod === 'upload' && !author.consentFile) {
            errors[`author_${index}_consentFile`] = isSpanish 
              ? 'Debes subir el formulario firmado' 
              : 'You must upload the signed form';
          }
        }
      });
      break;
      
    case 3:
      if (!allDeclarationsAccepted()) {
        errors.declarations = isSpanish 
          ? 'Debes aceptar todas las declaraciones obligatorias' 
          : 'You must accept all mandatory declarations';
      }
      if (!formData.manuscript && !formData.manuscriptName) {
        errors.manuscript = isSpanish 
          ? 'Debes subir el manuscrito' 
          : 'You must upload the manuscript';
      }
      if (!formData.dataAvailability || !formData.dataAvailability.trim()) {
        errors.dataAvailability = isSpanish 
          ? 'La declaración de disponibilidad de datos es obligatoria' 
          : 'Data availability statement is required';
      }
      if (formData.requiresEthicsApproval === 'yes' && !formData.ethicsCommitteeName.trim()) {
        errors.ethicsCommittee = isSpanish 
          ? 'Debes especificar el comité de ética' 
          : 'You must specify the ethics committee';
      }
      if (formData.aiUsed === 'yes') {
        const hasValidTool = formData.aiTools.some(tool => tool.name.trim() && tool.purpose.trim());
        if (!hasValidTool) {
          errors.aiTools = isSpanish 
            ? 'Debes especificar al menos una herramienta de IA con su propósito' 
            : 'You must specify at least one AI tool with its purpose';
        }
      }
      break;
      
    default:
      break;
  }
  
  setValidationErrors(errors);
  return Object.keys(errors).length === 0;
};

// Navegación entre pasos (CORREGIDA)
const nextStep = () => {
  console.log(`[DEBUG] Intentando avanzar del paso ${currentStep} al ${currentStep + 1}`);
  
  if (validateAndProceed(currentStep)) {
    console.log(`[DEBUG] Validación exitosa, avanzando al paso ${currentStep + 1}`);
    setValidationErrors({}); // Limpiar errores al avanzar
    setCurrentStep(prev => prev + 1);
  } else {
    console.log('[DEBUG] Validación fallida:', validationErrors);
    
    // Construir mensaje de error detallado
    const errorList = Object.entries(validationErrors)
      .map(([key, msg]) => `• ${msg}`)
      .join('\n');
    
    if (errorList) {
      alert(isSpanish 
        ? `Completa los campos requeridos antes de continuar:\n${errorList}` 
        : `Complete required fields before continuing:\n${errorList}`);
    }
  }
};

  // ============ FUNCIÓN DE ENVÍO CORREGIDA ============
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('[DEBUG] Iniciando validación del paso 3...');
    
    if (!validateStep(3)) {
      console.log('[DEBUG] Validación fallida:', validationErrors);
      alert(isSpanish 
        ? 'Completa todos los campos requeridos antes de enviar.' 
        : 'Complete all required fields before submitting.');
      return;
    }

    console.log('[DEBUG] Validación exitosa, preparando envío...');
    setUploading(true);
    setSubmitStatus(isSpanish ? 'Enviando artículo...' : 'Submitting article...');

    try {
      const token = await auth.currentUser.getIdToken();
      
      // Convertir manuscrito a base64
      const manuscriptBase64 = await toBase64(formData.manuscript);
      
      // Serializar palabras clave
      const keywordsSerialized = formData.controlledKeywords
        .map(kw => `${kw.code}: ${kw.term}`)
        .join('; ');
      
      const keywordsEnSerialized = formData.controlledKeywordsEn
        .map(kw => `${kw.code}: ${kw.term}`)
        .join('; ');

      // Construir payload
      const payload = {
        title: formData.title,
        titleEn: formData.titleEn,
        abstract: formData.abstract,
        abstractEn: formData.abstractEn,
        keywordsVocabulario: VOCABULARIO_POR_AREA[formData.area]?.vocabulario || 'unknown',
        keywordsRaw: formData.controlledKeywords,
        keywordsRawEn: formData.controlledKeywordsEn,
        keywordsSerialized,
        keywordsEnSerialized,
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

      console.log('[DEBUG] Payload preparado:', { ...payload, manuscriptBase64: '[BASE64_DATA]' });

      const response = await fetch('https://submitarticle-ggqsq2kkua-uc.a.run.app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DEBUG] Error del servidor:', errorText);
        throw new Error(errorText);
      }

      const result = await response.json();
      console.log('[DEBUG] Respuesta exitosa:', result);

      localStorage.removeItem('submissionFormDraft');
      setSubmissionId(result.submissionId);
      setDriveFolderId(result.driveFolderId);
      setSubmitStatus(isSpanish ? '✅ Artículo enviado con éxito' : '✅ Article submitted successfully');
      setSubmitted(true);

      if (onSuccess) onSuccess(result.submissionId);

    } catch (error) {
      console.error('[DEBUG] Error en el envío:', error);
      setSubmitStatus(isSpanish 
        ? `❌ Error: ${error.message}` 
        : `❌ Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Navegación entre pasos
  const nextStep = () => {
    console.log(`[DEBUG] Intentando avanzar del paso ${currentStep} al ${currentStep + 1}`);
    
    if (validateStep(currentStep)) {
      console.log(`[DEBUG] Validación exitosa, avanzando al paso ${currentStep + 1}`);
      setCurrentStep(prev => prev + 1);
    } else {
      console.log('[DEBUG] Validación fallida:', validationErrors);
      
      // Construir mensaje de error detallado
      const errorMessages = Object.values(validationErrors);
      const errorMessage = errorMessages.join('\n• ');
      
      alert(isSpanish 
        ? `Completa los campos requeridos antes de continuar:\n• ${errorMessage}` 
        : `Complete required fields before continuing:\n• ${errorMessage}`);
    }
  };

  const prevStep = () => {
    console.log(`[DEBUG] Retrocediendo del paso ${currentStep} al ${currentStep - 1}`);
    setCurrentStep(prev => prev - 1);
  };

  // Configuración de pasos
  const steps = [
    { id: 1, title: isSpanish ? 'INFORMACIÓN DEL ARTÍCULO' : 'ARTICLE INFORMATION' },
    { id: 2, title: isSpanish ? 'AUTORES Y ÉTICA' : 'AUTHORS & ETHICS' },
    { id: 3, title: isSpanish ? 'DATOS, IA Y DECLARACIONES' : 'DATA, AI & DECLARATIONS' }
  ];

  // ============ PANTALLA DE ÉXITO ============
  
  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-2xl mx-auto py-16 px-4"
      >
        <div className="bg-white border border-[#E0E7E9] shadow-2xl rounded-3xl overflow-hidden">
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

  // ============ RENDERIZADO DEL FORMULARIO ============
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto px-4 pb-20"
    >
      <div className="bg-white border border-[#E0E7E9] shadow-2xl shadow-[#0A1929]/5 rounded-3xl overflow-hidden">
        {/* Encabezado */}
        <div className="bg-[#0A1929] border-b border-[#1A2B3C] p-12 text-center">
          <div className="flex justify-center items-center gap-3 mb-4">
            <div className="h-px w-8 bg-[#B22234]" />
            <span className="uppercase text-[10px] font-mono tracking-[0.2em] text-[#E5E9F0]">
              Revista Nacional de las Ciencias para Estudiantes
            </span>
            <div className="h-px w-8 bg-[#B22234]" />
          </div>
          <h1 className="font-serif text-5xl font-light tracking-tight text-white">
            {isSpanish ? 'Envío de Manuscrito' : 'Manuscript Submission'}
          </h1>
          <p className="text-[#E0E7E9] text-sm mt-3 font-serif">
            {isSpanish ? 'Sistema seguro • Borrador guardado automáticamente' : 'Secure system • Draft auto-saved'}
          </p>
        </div>

        {/* Indicador de pasos */}
        <div className="px-8 py-7 bg-white border-b border-[#E0E7E9]">
          <div className="flex justify-between items-center relative">
            <div className="absolute top-5 left-0 w-full h-px bg-[#E0E7E9] z-0" />
            {steps.map((step) => (
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

        {/* Contenido del formulario */}
        <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-16">
          <AnimatePresence mode="wait">
            {/* PASO 1: INFORMACIÓN DEL ARTÍCULO */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="space-y-12"
              >
                {/* Título */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-2">
                    {isSpanish ? 'Título del artículo' : 'Article title'} *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className={`w-full p-4 border rounded-2xl text-lg font-serif focus:outline-none ${
                      validationErrors.title 
                        ? 'border-red-400 bg-red-50' 
                        : 'bg-[#F5F7FA] border-[#E0E7E9] focus:border-[#0A1929]'
                    }`}
                    placeholder={isSpanish ? 'Ejemplo: Impacto de la inteligencia artificial...' : 'Example: Impact of artificial intelligence...'}
                  />
                  {validationErrors.title && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.title}</p>
                  )}
                </div>

                {/* Título en inglés */}
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

                {/* Resumen */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-2">
                    {isSpanish ? 'Resumen' : 'Abstract'} *
                  </label>
                  <textarea
                    name="abstract"
                    value={formData.abstract}
                    onChange={handleInputChange}
                    rows={7}
                    className={`w-full p-4 border rounded-2xl text-sm focus:outline-none font-serif ${
                      validationErrors.abstract 
                        ? 'border-red-400 bg-red-50' 
                        : 'bg-[#F5F7FA] border-[#E0E7E9] focus:border-[#0A1929]'
                    }`}
                  />
                  {validationErrors.abstract && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.abstract}</p>
                  )}
                </div>

                {/* Abstract en inglés */}
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

                {/* Tipo de artículo */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-2">
                    {isSpanish ? 'Tipo de artículo' : 'Article type'} *
                  </label>
                  <select
                    name="articleType"
                    value={formData.articleType}
                    onChange={handleInputChange}
                    className={`w-full p-4 border rounded-2xl text-sm focus:outline-none font-serif ${
                      validationErrors.articleType 
                        ? 'border-red-400 bg-red-50' 
                        : 'bg-[#F5F7FA] border-[#E0E7E9] focus:border-[#0A1929]'
                    }`}
                  >
                    <option value="">— {isSpanish ? 'Selecciona tipo' : 'Select type'} —</option>
                    {articleTypeOptions[isSpanish ? 'es' : 'en'].map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {validationErrors.articleType && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.articleType}</p>
                  )}
                </div>

                {/* Área temática */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-2">
                    {isSpanish ? 'Área temática' : 'Subject area'} *
                  </label>
                  <select
                    name="area"
                    value={formData.area}
                    onChange={handleInputChange}
                    className={`w-full p-4 border rounded-2xl text-sm focus:outline-none font-serif ${
                      validationErrors.area 
                        ? 'border-red-400 bg-red-50' 
                        : 'bg-[#F5F7FA] border-[#E0E7E9] focus:border-[#0A1929]'
                    }`}
                  >
                    <option value="">— {isSpanish ? 'Selecciona un área general' : 'Select a general area'} —</option>
                    {Object.entries(AREAS_TEMATICAS).map(([categoria, subareas]) => (
                      <optgroup key={categoria} label={categoria}>
                        {subareas.map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {validationErrors.area && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.area}</p>
                  )}
                </div>

                {/* Palabras clave controladas */}
                {formData.area && VOCABULARIO_POR_AREA[formData.area] ? (
                  <div className="space-y-8">
                    <div>
                      <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-3">
                        {isSpanish ? 'Palabras Clave' : 'Keywords'} *
                      </label>
                      <ControlledKeywordInput
                        vocabularyConfig={VOCABULARIO_POR_AREA[formData.area]}
                        value={formData.controlledKeywords}
                        onChange={(val) => {
                          setFormData(prev => ({ ...prev, controlledKeywords: val }));
                          setValidationErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.controlledKeywords;
                            return newErrors;
                          });
                        }}
                        language={language}
                      />
                      {validationErrors.controlledKeywords && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.controlledKeywords}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-3">
                        {isSpanish ? 'Keywords en inglés' : 'English Keywords'}
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

                {/* Idioma del manuscrito */}
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

            {/* PASO 2: AUTORES Y ÉTICA */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="space-y-14"
              >
                {/* Sección de autores */}
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
                          <label className="text-xs text-[#546E7A] mb-1 block font-serif">
                            {isSpanish ? 'Nombre' : 'First name'} *
                          </label>
                          <input
                            type="text"
                            value={author.firstName}
                            onChange={(e) => handleAuthorChange(index, 'firstName', e.target.value)}
                            className={`w-full p-3.5 border rounded-2xl text-sm focus:outline-none font-serif ${
                              validationErrors[`author_${index}_firstName`] 
                                ? 'border-red-400 bg-red-50' 
                                : 'border-[#E0E7E9] focus:border-[#0A1929]'
                            }`}
                          />
                          {validationErrors[`author_${index}_firstName`] && (
                            <p className="text-red-500 text-xs mt-1">{validationErrors[`author_${index}_firstName`]}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs text-[#546E7A] mb-1 block font-serif">
                            {isSpanish ? 'Apellido' : 'Last name'} *
                          </label>
                          <input
                            type="text"
                            value={author.lastName}
                            onChange={(e) => handleAuthorChange(index, 'lastName', e.target.value)}
                            className={`w-full p-3.5 border rounded-2xl text-sm focus:outline-none font-serif ${
                              validationErrors[`author_${index}_lastName`] 
                                ? 'border-red-400 bg-red-50' 
                                : 'border-[#E0E7E9] focus:border-[#0A1929]'
                            }`}
                          />
                          {validationErrors[`author_${index}_lastName`] && (
                            <p className="text-red-500 text-xs mt-1">{validationErrors[`author_${index}_lastName`]}</p>
                          )}
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs text-[#546E7A] mb-1 block font-serif">
                            {isSpanish ? 'Correo electrónico' : 'Email'} *
                          </label>
                          <input
                            type="email"
                            value={author.email}
                            onChange={(e) => handleAuthorChange(index, 'email', e.target.value)}
                            className={`w-full p-3.5 border rounded-2xl text-sm focus:outline-none font-serif ${
                              validationErrors[`author_${index}_email`] 
                                ? 'border-red-400 bg-red-50' 
                                : 'border-[#E0E7E9] focus:border-[#0A1929]'
                            }`}
                          />
                          {validationErrors[`author_${index}_email`] && (
                            <p className="text-red-500 text-xs mt-1">{validationErrors[`author_${index}_email`]}</p>
                          )}
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs text-[#546E7A] mb-1 block font-serif">
                            {isSpanish ? 'Institución / Afiliación' : 'Institution / Affiliation'} *
                          </label>
                          <input
                            type="text"
                            value={author.institution}
                            onChange={(e) => handleAuthorChange(index, 'institution', e.target.value)}
                            className={`w-full p-3.5 border rounded-2xl text-sm focus:outline-none font-serif ${
                              validationErrors[`author_${index}_institution`] 
                                ? 'border-red-400 bg-red-50' 
                                : 'border-[#E0E7E9] focus:border-[#0A1929]'
                            }`}
                          />
                          {validationErrors[`author_${index}_institution`] && (
                            <p className="text-red-500 text-xs mt-1">{validationErrors[`author_${index}_institution`]}</p>
                          )}
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs text-[#546E7A] mb-1 block font-serif">
                            ORCID
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

                      {/* Menor de edad */}
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

                      {/* Autor de correspondencia */}
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
                  <h3 className="font-serif text-2xl font-light text-[#0A1929] border-b border-[#E0E7E9] pb-4">
                    {isSpanish ? 'Financiación' : 'Funding'}
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
                        <label className="text-xs text-[#546E7A] mb-1 block font-serif">
                          {isSpanish ? 'Entidad financiadora' : 'Funding entity'}
                        </label>
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
                        <label className="text-xs text-[#546E7A] mb-1 block font-serif">
                          {isSpanish ? 'Código(s) de la subvención' : 'Grant number(s)'}
                        </label>
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
                  <h3 className="font-serif text-2xl font-light text-[#0A1929] border-b border-[#E0E7E9] pb-4">
                    {isSpanish ? 'Conflicto de intereses' : 'Conflict of interest'}
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

                {/* Aprobación ética */}
                <div className="space-y-6">
                  <h3 className="font-serif text-2xl font-light text-[#0A1929] border-b border-[#E0E7E9] pb-4">
                    {isSpanish ? 'Aprobación Ética' : 'Ethics Approval'}
                  </h3>
                  <select
                    name="requiresEthicsApproval"
                    value={formData.requiresEthicsApproval}
                    onChange={handleInputChange}
                    className="w-full p-4 bg-[#F5F7FA] border border-[#E0E7E9] rounded-2xl text-sm focus:border-[#0A1929] outline-none font-serif"
                  >
                    <option value="no">
                      {isSpanish ? 'No, mi estudio está exento o no involucra sujetos humanos' : 'No, my study is exempt or does not involve human subjects'}
                    </option>
                    <option value="yes">
                      {isSpanish ? 'Sí, mi estudio requirió aprobación de un comité de ética' : 'Yes, my study required ethics committee approval'}
                    </option>
                  </select>

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

            {/* PASO 3: DATOS, IA Y DECLARACIONES */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="space-y-14"
              >
                {/* Uso de IA */}
                <div className="space-y-6">
                  <h3 className="font-serif text-2xl font-light text-[#0A1929] border-b border-[#E0E7E9] pb-4">
                    {isSpanish ? 'Uso de Inteligencia Artificial (IA)' : 'Use of Artificial Intelligence (AI)'}
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

                  {formData.aiUsed === 'yes' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 border border-[#E0E7E9] rounded-2xl p-6 bg-[#F5F7FA]">
                      <p className="text-xs font-mono text-[#546E7A] uppercase tracking-widest">
                        {isSpanish ? 'Especifica las herramientas usadas' : 'Specify the tools used'}
                      </p>
                      {formData.aiTools.map((tool, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white rounded-xl border border-[#E0E7E9] relative">
                          <div>
                            <label className="text-xs text-[#546E7A] block mb-1 font-serif">
                              {isSpanish ? 'Herramienta y versión' : 'Tool and version'}
                            </label>
                            <input
                              type="text"
                              value={tool.name}
                              onChange={(e) => handleAIToolChange(index, 'name', e.target.value)}
                              placeholder="ChatGPT-4, Gemini Pro..."
                              className="w-full p-2.5 border border-[#E0E7E9] rounded-xl text-sm font-serif outline-none"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-xs text-[#546E7A] block mb-1 font-serif">
                              {isSpanish ? 'Propósito y sección donde se usó' : 'Purpose and section where it was used'}
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={tool.purpose}
                                onChange={(e) => handleAIToolChange(index, 'purpose', e.target.value)}
                                placeholder={isSpanish ? 'Corrección de estilo en todo el manuscrito...' : 'Proofreading of the manuscript...'}
                                className="flex-1 p-2.5 border border-[#E0E7E9] rounded-xl text-sm font-serif outline-none"
                              />
                              {formData.aiTools.length > 1 && (
                                <button 
                                  type="button" 
                                  onClick={() => removeAITool(index)} 
                                  className="text-[#B22234] hover:bg-red-50 p-2 rounded-xl transition-colors"
                                >
                                  ✕
                                </button>
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

                {/* Disponibilidad de datos y código */}
                <div className="space-y-8">
                  <h3 className="font-serif text-2xl font-light text-[#0A1929] border-b border-[#E0E7E9] pb-4">
                    {isSpanish ? 'Disponibilidad de Datos y Código' : 'Data and Code Availability'}
                  </h3>
                  
                  <div>
                    <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-3">
                      {isSpanish ? 'Declaración de disponibilidad de los datos' : 'Data availability statement'} *
                    </label>
                    <select
                      name="dataAvailability"
                      value={formData.dataAvailability}
                      onChange={handleInputChange}
                      className={`w-full p-4 border rounded-2xl text-sm focus:outline-none font-serif mb-4 ${
                        validationErrors.dataAvailability 
                          ? 'border-red-400 bg-red-50' 
                          : 'bg-[#F5F7FA] border-[#E0E7E9] focus:border-[#0A1929]'
                      }`}
                    >
                      <option value="">— {isSpanish ? 'Selecciona una opción' : 'Select an option'} —</option>
                      {availabilityOptions[isSpanish ? 'es' : 'en'].map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    {validationErrors.dataAvailability && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.dataAvailability}</p>
                    )}
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

                {/* Declaraciones obligatorias */}
                <div>
                  <h3 className="font-serif text-2xl font-light text-[#0A1929] border-b border-[#E0E7E9] pb-4">
                    {isSpanish ? 'Declaraciones obligatorias' : 'Mandatory declarations'}
                  </h3>
                  <div className="mt-8 space-y-5">
                    {[
                      { key: 'originalAndSimilarity', 
                        text: 'El manuscrito es inédito y, en caso de derivar de un trabajo previo, la superposición textual no excede el 15% (Sección 3.2).', 
                        textEn: 'The manuscript is unpublished and, if derived from previous work, the textual overlap does not exceed 15% (Section 3.2).' },
                      { key: 'exclusiveSubmission', 
                        text: 'El manuscrito no está siendo evaluado simultáneamente en otra revista (Sección 3.3).', 
                        textEn: 'The manuscript is not being simultaneously evaluated in another journal (Section 3.3).' },
                      { key: 'authorshipCriteria', 
                        text: 'Todos los autores cumplen los 4 criterios de autoría del ICMJE y sus roles CRediT están declarados (Sección 4.1).', 
                        textEn: 'All authors meet the 4 ICMJE authorship criteria and their CRediT roles are declared (Section 4.1).' },
                      { key: 'dataAuthentic', 
                        text: 'Los datos presentados son auténticos, no han sido manipulados y la investigación cumplió con los estándares éticos aplicables (Capítulo 5).', 
                        textEn: 'The data presented are authentic, have not been manipulated, and the research complied with applicable ethical standards (Chapter 5).' },
                      { key: 'informedConsent', 
                        text: 'Se obtuvo el consentimiento/asentimiento informado cuando fue necesario y se declara en el manuscrito (Sección 5.2).', 
                        textEn: 'Informed consent/assent was obtained when necessary and is declared in the manuscript (Section 5.2).' },
                      { key: 'aiDisclosure', 
                        text: 'El uso de cualquier herramienta de IA ha sido declarado en el formulario y en el manuscrito (Capítulo 7).', 
                        textEn: 'The use of any AI tool has been declared in this form and in the manuscript (Chapter 7).' },
                      { key: 'conflicts', 
                        text: 'Todos los conflictos de interés (reales, potenciales o aparentes) están declarados en el formulario y en el manuscrito (Capítulo 6).', 
                        textEn: 'All conflicts of interest (real, potential, or apparent) are declared in this form and in the manuscript (Chapter 6).' }
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

                {/* Licencia CC-BY */}
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
                          ? 'Al marcar esta casilla, acepto que el artículo, si es aceptado, se publique bajo la licencia de acceso abierto CC BY 4.0.'
                          : 'By checking this box, I agree that the article, if accepted, will be published under the CC BY 4.0 open access license.'}
                      </p>
                    </div>
                  </label>
                </div>

                {/* Agradecimientos */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-3">
                    {isSpanish ? 'Agradecimientos' : 'Acknowledgments'} (opcional)
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

                {/* Revisores excluidos */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-3">
                    {isSpanish ? 'Revisores sugeridos a excluir (opcional)' : 'Reviewers to exclude (optional)'}
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

                {/* Archivo manuscrito */}
                <div>
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-[#546E7A] mb-3">
                    {isSpanish ? 'Manuscrito anonimizado' : 'Anonymized manuscript'} *
                  </label>
                  <div className={`border rounded-3xl p-8 ${
                    validationErrors.manuscript ? 'border-red-400 bg-red-50' : 'border-[#E0E7E9] bg-[#F5F7FA]'
                  }`}>
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
                  {validationErrors.manuscript && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.manuscript}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Botones de navegación */}
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
                  disabled={uploading || !isStepValid(3)}
                  className="px-12 py-4 bg-[#0A1929] text-white rounded-2xl text-sm font-bold hover:bg-[#B22234] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-3 shadow-xl font-serif"
                >
                  {uploading
                    ? (isSpanish ? 'Enviando...' : 'Submitting...')
                    : (isSpanish ? 'ENVIAR PARA REVISIÓN' : 'SUBMIT FOR REVIEW')}
                </button>
              )}
            </div>
          </div>

          {/* Estado del envío */}
          {submitStatus && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-center text-sm font-medium mt-4 font-serif ${
                submitStatus.includes('❌') ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {submitStatus}
            </motion.p>
          )}

          {/* Indicador de guardado automático */}
          <p className="text-center text-[10px] text-[#546E7A] font-mono tracking-widest">
            ⏺ {isSpanish ? 'Borrador guardado automáticamente cada 30 segundos' : 'Draft auto-saved every 30 seconds'}
          </p>
        </form>
      </div>
    </motion.div>
  );
}