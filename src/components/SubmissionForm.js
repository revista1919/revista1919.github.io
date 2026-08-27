// src/components/SubmissionForm.js (DISEÑO EDITORIAL + LÓGICA COMPLETA + HELP CAPSULES)
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '../firebase';
import { useLanguage } from '../hooks/useLanguage';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { UserIcon } from '@heroicons/react/24/outline';
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
// ============ COMPONENTE: HELP CAPSULE (PIN DE AYUDA) ============

const AREAS_TEMATICAS = {
  es: {
    "Ciencias Exactas y Naturales": [
      "Matemáticas", "Física", "Química", "Biología", "Geología",
      "Astronomía y Astrofísica", "Ciencias Ambientales y Ecología",
      "Oceanografía", "Meteorología y Ciencias Atmosféricas", "Paleontología"
    ],
    "Ciencias de la Salud": [
      "Medicina General e Interna", "Salud Pública y Epidemiología",
      "Enfermería", "Nutrición y Dietética", "Farmacología y Farmacia",
      "Odontología", "Kinesiología y Fisioterapia", 
      "Tecnología Médica y Bioanálisis", "Veterinaria"
    ],
    "Ingeniería y Tecnología": [
      "Ingeniería Civil", "Ingeniería Industrial y de Sistemas",
      "Ingeniería Mecánica", "Ingeniería Eléctrica y Electrónica",
      "Ingeniería Química y Biotecnología", 
      "Ingeniería en Computación e Informática",
      "Ciencia de Datos e Inteligencia Artificial", 
      "Robótica y Automatización",
      "Ingeniería de Materiales y Nanotecnología", 
      "Ingeniería Aeroespacial", "Energías Renovables y Sostenibilidad"
    ],
    "Ciencias Sociales": [
      "Sociología", "Antropología y Arqueología", "Psicología",
      "Economía y Negocios", "Ciencias Políticas y Relaciones Internacionales",
      "Derecho", "Geografía Humana y Ordenamiento Territorial",
      "Estudios de Género", "Comunicación Social y Periodismo",
      "Educación y Pedagogía", "Trabajo Social"
    ],
    "Humanidades": [
      "Historia", "Filosofía", "Lingüística y Filología", "Literatura",
      "Estudios Clásicos", "Teología y Ciencias de la Religión",
      "Estudios Culturales", "Arte, Música y Cine", "Arquitectura y Urbanismo"
    ],
    "Ciencias Agropecuarias": [
      "Agronomía y Producción Agrícola", "Ciencias Forestales",
      "Acuicultura y Pesca", "Zootecnia y Producción Animal", 
      "Ingeniería de Alimentos"
    ]
  },
  en: {
    "Exact and Natural Sciences": [
      "Mathematics", "Physics", "Chemistry", "Biology", "Geology",
      "Astronomy and Astrophysics", "Environmental Sciences and Ecology",
      "Oceanography", "Meteorology and Atmospheric Sciences", "Paleontology"
    ],
    "Health Sciences": [
      "General and Internal Medicine", "Public Health and Epidemiology",
      "Nursing", "Nutrition and Dietetics", "Pharmacology and Pharmacy",
      "Dentistry", "Kinesiology and Physical Therapy",
      "Medical Technology and Bioanalysis", "Veterinary Medicine"
    ],
    "Engineering and Technology": [
      "Civil Engineering", "Industrial and Systems Engineering",
      "Mechanical Engineering", "Electrical and Electronic Engineering",
      "Chemical Engineering and Biotechnology", 
      "Computer Science and Informatics",
      "Data Science and Artificial Intelligence", 
      "Robotics and Automation",
      "Materials Science and Nanotechnology", 
      "Aerospace Engineering", "Renewable Energies and Sustainability"
    ],
    "Social Sciences": [
      "Sociology", "Anthropology and Archaeology", "Psychology",
      "Economics and Business", "Political Science and International Relations",
      "Law", "Human Geography and Land Planning",
      "Gender Studies", "Social Communication and Journalism",
      "Education and Pedagogy", "Social Work"
    ],
    "Humanities": [
      "History", "Philosophy", "Linguistics and Philology", "Literature",
      "Classical Studies", "Theology and Religious Studies",
      "Cultural Studies", "Art, Music and Film", "Architecture and Urbanism"
    ],
    "Agricultural Sciences": [
      "Agronomy and Agricultural Production", "Forestry Sciences",
      "Aquaculture and Fisheries", "Animal Science and Production", 
      "Food Engineering"
    ]
  }
};

// Helper para obtener áreas según idioma
const getAreasByLanguage = (language) => {
  return AREAS_TEMATICAS[language] || AREAS_TEMATICAS.es;
};
// ============ CONFIGURACIÓN DE VOCABULARIOS CONTROLADOS ============
// ============ CONFIGURACIÓN DE VOCABULARIOS CONTROLADOS ============
const VOCABULARIO_POR_AREA = {
  // ========== CIENCIAS EXACTAS Y NATURALES ==========
  "Matemáticas": {
    vocabulario: "MSC",
    nombre: "Mathematics Subject Classification (MSC2020)",
    formato: "Código alfanumérico MSC",
    ejemplo: "11N05",
    searchUrl: "https://mathscinet.ams.org/mathscinet/msc/msc2020.html",
    instrucciones: "Ingresa solo el código MSC (ej: 11N05, 68T05). No incluyas el descriptor. Usado por MathSciNet, zbMATH y la mayoría de journals de matemáticas."
  },
  "Física": {
    vocabulario: "PhySH",
    nombre: "Physics Subject Headings (APS)",
    formato: "Identificador de concepto PhySH",
    ejemplo: "quantum-mechanics",
    searchUrl: "https://physh.aps.org/",
    instrucciones: "Ingresa el identificador/concepto PhySH (ej: quantum-mechanics, condensed-matter-physics). No es un código numérico rígido. Reemplazó a PACS."
  },
  "Química": {
    vocabulario: "CA-Sections + CAS-RN",
    nombre: "Chemical Abstracts Subject Sections + CAS Registry Numbers",
    formato: "Número de sección CA (1-80) o CAS RN (solo sustancias)",
    ejemplo: "78-10-4 (CAS RN) o sección 35 (Organic Chemistry)",
    searchUrl: "https://commonchemistry.cas.org/",
    instrucciones: "NO existe un sistema jerárquico de códigos temáticos tipo MSC. Usa: 1) CAS Registry Number solo para compuestos específicos (ej: 78-10-4). 2) Secciones temáticas de Chemical Abstracts (aprox. 80 secciones). 3) Términos controlados de SciFinder."
  },
  "Biología": {
    vocabulario: "MeSH + NCBI-Taxonomy",
    nombre: "Medical Subject Headings + NCBI Taxonomy",
    formato: "MeSH Unique ID / Tree Number o TaxID NCBI",
    ejemplo: "D001777 (MeSH) o NCBI TaxID",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "MeSH es el estándar biomédico (PubMed). Para biología pura/organismos se usa más NCBI Taxonomy. Ingresa código MeSH (ej: D001777) o TaxID."
  },
  "Geología": {
    vocabulario: "GeoRef",
    nombre: "GeoRef Thesaurus + Subject Categories (AGI)",
    formato: "Código de categoría GeoRef (01-30) o término del tesauro",
    ejemplo: "05 (Igneous and metamorphic petrology) o igneous-rocks",
    searchUrl: "https://www.americangeosciences.org/georef/georef-thesaurus",
    instrucciones: "Usa códigos de categoría (01 Mineralogy … 30 Engineering geology) o términos controlados del tesauro GeoRef. Ejemplo de categoría: 05."
  },
  "Astronomía y Astrofísica": {
    vocabulario: "UAT",
    nombre: "Unified Astronomy Thesaurus",
    formato: "Código numérico UAT",
    ejemplo: "1087",
    searchUrl: "https://astrothesaurus.org/",
    instrucciones: "Ingresa solo el código numérico UAT (ej: 1087). No incluyas el descriptor. Estándar de la AAS."
  },
  "Ciencias Ambientales y Ecología": {
    vocabulario: "GEMET / EnvThes",
    nombre: "GEneral Multilingual Environmental Thesaurus / Environmental Thesaurus (LTER)",
    formato: "Identificador o término controlado",
    ejemplo: "20286 (EnvThes) o término GEMET",
    searchUrl: "https://www.eionet.europa.eu/gemet/es/",
    instrucciones: "GEMET es el más general y usado internacionalmente. EnvThes es específico de redes LTER europeas. Ingresa identificador o término preferido."
  },
  "Oceanografía": {
    vocabulario: "BODC/NERC",
    nombre: "NERC Vocabulary Server (BODC) – Parameter Usage Vocabulary",
    formato: "Código alfanumérico de colección (P01, P02, etc.)",
    ejemplo: "P021 o código P01 completo",
    searchUrl: "https://vocab.nerc.ac.uk/",
    instrucciones: "Ingresa el código de la colección NERC/BODC (ej: P01 para parámetros). Estándar para datos marinos y oceanográficos."
  },
  "Meteorología y Ciencias Atmosféricas": {
    vocabulario: "AMS-Terms / WMO-Codes",
    nombre: "American Meteorological Society terminology + WMO Codes (solo datos)",
    formato: "Términos controlados AMS o códigos WMO (BUFR/GRIB)",
    ejemplo: "atmospheric-river o código WMO específico",
    searchUrl: "https://www.ametsoc.org/",
    instrucciones: "NO existe un sistema de clasificación temática de papers equivalente a MSC o MeSH. Los journals de AMS usan términos controlados. Los códigos WMO son para transmisión de datos, no para indexar literatura."
  },
  "Paleontología": {
    vocabulario: "GeoRef",
    nombre: "GeoRef Subject Categories (08-11) + Thesaurus",
    formato: "Código de categoría GeoRef o término del tesauro",
    ejemplo: "10 (Invertebrate paleontology)",
    searchUrl: "https://www.americangeosciences.org/georef/georef-thesaurus",
    instrucciones: "Usa categorías GeoRef: 08 General paleontology, 09 Paleobotany, 10 Invertebrate, 11 Vertebrate. PBDB es una base de datos de taxones, NO un sistema de clasificación de papers."
  },

  // ========== CIENCIAS DE LA SALUD ==========
  "Medicina General e Interna": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "MeSH Unique ID / Tree Number",
    ejemplo: "D008112",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Ingresa solo el código MeSH (ej: D008112). No incluyas el descriptor. Estándar absoluto en PubMed/MEDLINE."
  },
  "Salud Pública y Epidemiología": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "MeSH Unique ID / Tree Number",
    ejemplo: "D011635",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Ingresa solo el código MeSH (ej: D011635). No incluyas el descriptor."
  },
  "Enfermería": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "MeSH Unique ID / Tree Number",
    ejemplo: "D009729",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Ingresa solo el código MeSH (ej: D009729). No incluyas el descriptor."
  },
  "Nutrición y Dietética": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "MeSH Unique ID / Tree Number",
    ejemplo: "D009750",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Ingresa solo el código MeSH (ej: D009750). No incluyas el descriptor."
  },
  "Farmacología y Farmacia": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "MeSH Unique ID / Tree Number",
    ejemplo: "D010597",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Ingresa solo el código MeSH (ej: D010597). No incluyas el descriptor. También se usan CAS RN para compuestos."
  },
  "Odontología": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "MeSH Unique ID / Tree Number",
    ejemplo: "D003813",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Ingresa solo el código MeSH (ej: D003813). No incluyas el descriptor."
  },
  "Kinesiología y Fisioterapia": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "MeSH Unique ID / Tree Number",
    ejemplo: "D026801",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Ingresa solo el código MeSH (ej: D026801). No incluyas el descriptor."
  },
  "Tecnología Médica y Bioanálisis": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "MeSH Unique ID / Tree Number",
    ejemplo: "D008364",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Ingresa solo el código MeSH (ej: D008364). No incluyas el descriptor."
  },
  "Veterinaria": {
    vocabulario: "MeSH",
    nombre: "Medical Subject Headings",
    formato: "MeSH Unique ID / Tree Number",
    ejemplo: "D014730",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instrucciones: "Ingresa solo el código MeSH (ej: D014730). No incluyas el descriptor."
  },

  // ========== INGENIERÍAS ==========
  "Ingeniería Civil": {
    vocabulario: "Ei",
    nombre: "Engineering Index Thesaurus / Compendex Classification",
    formato: "Código de clasificación Ei",
    ejemplo: "405.1",
    searchUrl: "https://www.engineeringvillage.com/",
    instrucciones: "Ingresa solo el código Ei/Compendex (ej: 405.1). También se usan términos controlados del Ei Thesaurus."
  },
  "Ingeniería Industrial y de Sistemas": {
    vocabulario: "Ei",
    nombre: "Engineering Index Thesaurus / Compendex Classification",
    formato: "Código de clasificación Ei",
    ejemplo: "912.2",
    searchUrl: "https://www.engineeringvillage.com/",
    instrucciones: "No existe un sistema 'IIE/IISE' de códigos de papers. Se usa el sistema Ei/Compendex (igual que el resto de ingenierías)."
  },
  "Ingeniería Mecánica": {
    vocabulario: "Ei / ASME",
    nombre: "Engineering Index Thesaurus (Compendex) + ASME subject categories",
    formato: "Código Ei o categoría ASME",
    ejemplo: "601.1 o 10-01",
    searchUrl: "https://www.engineeringvillage.com/",
    instrucciones: "Principalmente códigos Ei/Compendex. ASME tiene categorías propias en sus journals."
  },
  "Ingeniería Eléctrica y Electrónica": {
    vocabulario: "IEEE",
    nombre: "IEEE Thesaurus / IEEE Taxonomy",
    formato: "Término controlado del IEEE Thesaurus",
    ejemplo: "power-systems",
    searchUrl: "https://www.ieee.org/publications/services/thesaurus-access-page.html",
    instrucciones: "Ingresa el término preferido del IEEE Thesaurus. Existe también la IEEE Taxonomy (jerárquica de 3 niveles). El ejemplo antiguo tipo B6210L no es el formato principal actual."
  },
  "Ingeniería Química y Biotecnología": {
    vocabulario: "Ei",
    nombre: "Engineering Index Thesaurus / Compendex",
    formato: "Código de clasificación Ei",
    ejemplo: "804.1",
    searchUrl: "https://www.engineeringvillage.com/",
    instrucciones: "No existe un 'IChemE Thesaurus' estándar de clasificación de papers. Se usa Ei/Compendex."
  },
  "Ingeniería en Computación e Informática": {
    vocabulario: "ACM-CCS",
    nombre: "ACM Computing Classification System (2012)",
    formato: "Código CCS jerárquico",
    ejemplo: "10003116",
    searchUrl: "https://dl.acm.org/ccs",
    instrucciones: "Ingresa el código ACM CCS (ej: 10003116). Estándar en ACM Digital Library y journals de CS."
  },
  "Ciencia de Datos e Inteligencia Artificial": {
    vocabulario: "ACM-CCS",
    nombre: "ACM Computing Classification System (2012)",
    formato: "Código CCS jerárquico",
    ejemplo: "10010179",
    searchUrl: "https://dl.acm.org/ccs",
    instrucciones: "Ingresa el código ACM CCS correspondiente a AI / Machine Learning / Data Mining."
  },
  "Robótica y Automatización": {
    vocabulario: "ACM-CCS / IEEE",
    nombre: "ACM Computing Classification System + IEEE Thesaurus",
    formato: "Código ACM-CCS o término IEEE",
    ejemplo: "10010187",
    searchUrl: "https://dl.acm.org/ccs",
    instrucciones: "Principalmente ACM CCS. También se usan términos del IEEE Thesaurus en journals IEEE."
  },
  "Ingeniería de Materiales y Nanotecnología": {
    vocabulario: "Ei / ASM",
    nombre: "Engineering Index Thesaurus + ASM International terms",
    formato: "Código Ei o término ASM",
    ejemplo: "nanocomposites o código Ei correspondiente",
    searchUrl: "https://www.engineeringvillage.com/",
    instrucciones: "No hay un sistema de códigos ASM único dominante para papers. Se usa principalmente Ei + términos controlados."
  },
  "Ingeniería Aeroespacial": {
    vocabulario: "NASA",
    nombre: "NASA Thesaurus",
    formato: "Término controlado del NASA Thesaurus",
    ejemplo: "aircraft-design",
    searchUrl: "https://sti.nasa.gov/nasa-thesaurus/",
    instrucciones: "Ingresa el identificador/término del NASA Thesaurus. Históricamente el estándar en literatura aeroespacial."
  },
  "Energías Renovables y Sostenibilidad": {
    vocabulario: "Ei / ETDE (histórico)",
    nombre: "Engineering Index Thesaurus (principal) + ETDE residual",
    formato: "Código Ei o término",
    ejemplo: "solar-energy",
    searchUrl: "https://www.engineeringvillage.com/",
    instrucciones: "ETDE ya no es el estándar activo principal. Usa códigos/términos Ei/Compendex."
  },

  // ========== CIENCIAS SOCIALES ==========
  "Sociología": {
    vocabulario: "LCSH / UNESCO",
    nombre: "Library of Congress Subject Headings + UNESCO Thesaurus",
    formato: "Término LCSH o UNESCO",
    ejemplo: "Sociology",
    searchUrl: "https://id.loc.gov/authorities/subjects.html",
    instrucciones: "JEL NO es de sociología (es solo de Economía). Se usan LCSH, UNESCO Thesaurus o tesauros de Sociological Abstracts."
  },
  "Antropología y Arqueología": {
    vocabulario: "LCSH / UNESCO",
    nombre: "Library of Congress Subject Headings + UNESCO Thesaurus",
    formato: "Término LCSH o UNESCO",
    ejemplo: "Anthropology",
    searchUrl: "https://id.loc.gov/authorities/subjects.html",
    instrucciones: "JEL NO aplica. Usar LCSH o UNESCO."
  },
  "Psicología": {
    vocabulario: "APA",
    nombre: "APA Thesaurus of Psychological Index Terms",
    formato: "Término controlado APA",
    ejemplo: "cognitive-processes",
    searchUrl: "https://psycnet.apa.org/thesaurus/",
    instrucciones: "Ingresa el término preferido del APA Thesaurus. Usado en PsycINFO."
  },
  "Economía y Negocios": {
    vocabulario: "JEL",
    nombre: "Journal of Economic Literature Classification System",
    formato: "Código JEL (letra + números)",
    ejemplo: "D00",
    searchUrl: "https://www.aeaweb.org/econlit/jelCodes.php",
    instrucciones: "Ingresa solo el código JEL (ej: D00, J16, F50). Estándar absoluto en economía."
  },
  "Ciencias Políticas y Relaciones Internacionales": {
    vocabulario: "LCSH / UNESCO",
    nombre: "Library of Congress Subject Headings + UNESCO Thesaurus",
    formato: "Término LCSH o UNESCO",
    ejemplo: "International relations",
    searchUrl: "https://id.loc.gov/authorities/subjects.html",
    instrucciones: "JEL NO es de ciencias políticas. Usar LCSH o UNESCO."
  },
  "Derecho": {
    vocabulario: "LCSH / LCC",
    nombre: "Library of Congress Subject Headings + Library of Congress Classification (K)",
    formato: "Término LCSH o número de clasificación",
    ejemplo: "KF385",
    searchUrl: "https://id.loc.gov/authorities/subjects.html",
    instrucciones: "Mezcla de subject headings (LCSH) y clasificación bibliográfica (clase K)."
  },
  "Geografía Humana y Ordenamiento Territorial": {
    vocabulario: "LCSH / UNESCO",
    nombre: "Library of Congress Subject Headings + UNESCO Thesaurus",
    formato: "Término LCSH o UNESCO",
    ejemplo: "Human geography",
    searchUrl: "https://id.loc.gov/authorities/subjects.html",
    instrucciones: "JEL (R10) es solo de economía regional. No es el estándar de geografía humana."
  },
  "Estudios de Género": {
    vocabulario: "LCSH / UNESCO",
    nombre: "Library of Congress Subject Headings + UNESCO Thesaurus",
    formato: "Término LCSH o UNESCO",
    ejemplo: "Gender identity",
    searchUrl: "https://id.loc.gov/authorities/subjects.html",
    instrucciones: "JEL (J16) es de economía de género. No es el estándar de Gender Studies."
  },
  "Comunicación Social y Periodismo": {
    vocabulario: "LCSH",
    nombre: "Library of Congress Subject Headings",
    formato: "Término controlado",
    ejemplo: "Mass media",
    searchUrl: "https://id.loc.gov/authorities/subjects.html",
    instrucciones: "No existe un 'CIOS Thesaurus' dominante y estándar. Se usan LCSH o términos de bases especializadas."
  },
  "Educación y Pedagogía": {
    vocabulario: "ERIC",
    nombre: "Education Resources Information Center Thesaurus",
    formato: "Término controlado ERIC",
    ejemplo: "educational-technology",
    searchUrl: "https://eric.ed.gov/?ti=all",
    instrucciones: "Ingresa el identificador/término ERIC. Estándar en educación."
  },
  "Trabajo Social": {
    vocabulario: "LCSH / MeSH",
    nombre: "Library of Congress Subject Headings + MeSH (aspectos sanitarios)",
    formato: "Término LCSH o código MeSH",
    ejemplo: "Social work",
    searchUrl: "https://id.loc.gov/authorities/subjects.html",
    instrucciones: "JEL (I38) es de economía del bienestar. No es el estándar de Trabajo Social."
  },

  // ========== HUMANIDADES ==========
  "Historia": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Término preferido (descriptor)",
    ejemplo: "History",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Ingresa el término preferido exacto del UNESCO Thesaurus (ej: History). No uses códigos numéricos antiguos de microthesauri (tipo 6.25)."
  },
  "Filosofía": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Término preferido (descriptor)",
    ejemplo: "Philosophy",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Ingresa el término preferido exacto del UNESCO Thesaurus (ej: Philosophy). No uses códigos numéricos antiguos de microthesauri (tipo 6.05)."
  },
  "Lingüística y Filología": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Término preferido (descriptor)",
    ejemplo: "Linguistics",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Ingresa el término preferido exacto del UNESCO Thesaurus (ej: Linguistics). No uses códigos numéricos antiguos de microthesauri (tipo 6.10)."
  },
  "Literatura": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Término preferido (descriptor)",
    ejemplo: "Literature",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Ingresa el término preferido exacto del UNESCO Thesaurus (ej: Literature). No uses códigos numéricos antiguos de microthesauri (tipo 6.15)."
  },
  "Estudios Clásicos": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Término preferido (descriptor)",
    ejemplo: "Classical studies",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Ingresa el término preferido exacto del UNESCO Thesaurus (ej: Classical studies). No uses códigos numéricos antiguos de microthesauri (tipo 6.20)."
  },
  "Teología y Ciencias de la Religión": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Término preferido (descriptor)",
    ejemplo: "Religion",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Ingresa el término preferido exacto del UNESCO Thesaurus (ej: Religion o Theology). No uses códigos numéricos antiguos de microthesauri (tipo 6.30)."
  },
  "Estudios Culturales": {
    vocabulario: "UNESCO",
    nombre: "UNESCO Thesaurus",
    formato: "Término preferido (descriptor)",
    ejemplo: "Cultural studies",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/es/",
    instrucciones: "Ingresa el término preferido exacto del UNESCO Thesaurus (ej: Cultural studies o Culture). No uses códigos numéricos antiguos de microthesauri (tipo 6.35)."
  },
  "Arte, Música y Cine": {
    vocabulario: "AAT",
    nombre: "Art & Architecture Thesaurus (Getty)",
    formato: "Código numérico AAT",
    ejemplo: "300033618",
    searchUrl: "https://www.getty.edu/research/tools/vocabularies/aat/",
    instrucciones: "Ingresa solo el código numérico AAT (ej: 300033618). No incluyas el descriptor."
  },
  "Arquitectura y Urbanismo": {
    vocabulario: "AAT",
    nombre: "Art & Architecture Thesaurus (Getty)",
    formato: "Código numérico AAT",
    ejemplo: "300008125",
    searchUrl: "https://www.getty.edu/research/tools/vocabularies/aat/",
    instrucciones: "Ingresa solo el código numérico AAT (ej: 300008125). No incluyas el descriptor."
  },

  // ========== CIENCIAS AGRÍCOLAS ==========
  "Agronomía y Producción Agrícola": {
    vocabulario: "AGROVOC",
    nombre: "FAO Agricultural Thesaurus (AGROVOC)",
    formato: "Código AGROVOC (c_XXXX)",
    ejemplo: "c_867",
    searchUrl: "https://agrovoc.fao.org/browse/agrovoc/es/",
    instrucciones: "Ingresa solo el código AGROVOC (ej: c_867). No incluyas el término."
  },
  "Ciencias Forestales": {
    vocabulario: "AGROVOC",
    nombre: "FAO Agricultural Thesaurus (AGROVOC)",
    formato: "Código AGROVOC",
    ejemplo: "c_3014",
    searchUrl: "https://agrovoc.fao.org/browse/agrovoc/es/",
    instrucciones: "Ingresa solo el código AGROVOC (ej: c_3014)."
  },
  "Acuicultura y Pesca": {
    vocabulario: "ASFA + AGROVOC",
    nombre: "Aquatic Sciences and Fisheries Abstracts Thesaurus + AGROVOC",
    formato: "Código ASFA o AGROVOC",
    ejemplo: "Q5 01521 o c_XXXX",
    searchUrl: "https://www.fao.org/fishery/asfa/es",
    instrucciones: "ASFA es el clásico de pesca/acuicultura. AGROVOC también se usa ampliamente."
  },
  "Zootecnia y Producción Animal": {
    vocabulario: "AGROVOC",
    nombre: "FAO Agricultural Thesaurus (AGROVOC)",
    formato: "Código AGROVOC",
    ejemplo: "c_433",
    searchUrl: "https://agrovoc.fao.org/browse/agrovoc/es/",
    instrucciones: "Ingresa solo el código AGROVOC (ej: c_433)."
  },
  "Ingeniería de Alimentos": {
    vocabulario: "FSTA",
    nombre: "Food Science and Technology Abstracts Thesaurus (IFIS)",
    formato: "Código o término FSTA",
    ejemplo: "Q04",
    searchUrl: "https://www.ifis.org/fsta",
    instrucciones: "Ingresa el código o término FSTA (ej: Q04)."
  }
};
const VOCABULARIO_POR_AREA_EN = {
  // ========== EXACT AND NATURAL SCIENCES ==========
  "Mathematics": {
    vocabulary: "MSC",
    name: "Mathematics Subject Classification (MSC2020)",
    format: "Alphanumeric MSC code",
    example: "11N05",
    searchUrl: "https://mathscinet.ams.org/mathscinet/msc/msc2020.html",
    instructions: "Enter only the MSC code (e.g., 11N05, 68T05). Do not include the descriptor. Used by MathSciNet, zbMATH, and most mathematics journals."
  },
  "Physics": {
    vocabulary: "PhySH",
    name: "Physics Subject Headings (APS)",
    format: "PhySH concept identifier",
    example: "quantum-mechanics",
    searchUrl: "https://physh.aps.org/",
    instructions: "Enter the PhySH identifier/concept (e.g., quantum-mechanics, condensed-matter-physics). It is not a rigid numeric code. It replaced PACS."
  },
  "Chemistry": {
    vocabulary: "CA-Sections + CAS-RN",
    name: "Chemical Abstracts Subject Sections + CAS Registry Numbers",
    format: "CA section number (1-80) or CAS RN (substances only)",
    example: "78-10-4 (CAS RN) or section 35 (Organic Chemistry)",
    searchUrl: "https://commonchemistry.cas.org/",
    instructions: "There is NO hierarchical thematic code system like MSC. Use: 1) CAS Registry Number only for specific compounds (e.g., 78-10-4). 2) Chemical Abstracts thematic sections (approx. 80 sections). 3) SciFinder controlled terms."
  },
  "Biology": {
    vocabulary: "MeSH + NCBI-Taxonomy",
    name: "Medical Subject Headings + NCBI Taxonomy",
    format: "MeSH Unique ID / Tree Number or NCBI TaxID",
    example: "D001777 (MeSH) or NCBI TaxID",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instructions: "MeSH is the biomedical standard (PubMed). For pure biology/organisms, NCBI Taxonomy is more commonly used. Enter MeSH code (e.g., D001777) or TaxID."
  },
  "Geology": {
    vocabulary: "GeoRef",
    name: "GeoRef Thesaurus + Subject Categories (AGI)",
    format: "GeoRef category code (01-30) or thesaurus term",
    example: "05 (Igneous and metamorphic petrology) or igneous-rocks",
    searchUrl: "https://www.americangeosciences.org/georef/georef-thesaurus",
    instructions: "Use category codes (01 Mineralogy … 30 Engineering geology) or controlled terms from the GeoRef Thesaurus. Example category: 05."
  },
  "Astronomy and Astrophysics": {
    vocabulary: "UAT",
    name: "Unified Astronomy Thesaurus",
    format: "Numeric UAT code",
    example: "1087",
    searchUrl: "https://astrothesaurus.org/",
    instructions: "Enter only the numeric UAT code (e.g., 1087). Do not include the descriptor. AAS standard."
  },
  "Environmental Sciences and Ecology": {
    vocabulary: "GEMET / EnvThes",
    name: "GEneral Multilingual Environmental Thesaurus / Environmental Thesaurus (LTER)",
    format: "Identifier or controlled term",
    example: "20286 (EnvThes) or GEMET term",
    searchUrl: "https://www.eionet.europa.eu/gemet/",
    instructions: "GEMET is the most general and internationally used. EnvThes is specific to European LTER networks. Enter identifier or preferred term."
  },
  "Oceanography": {
    vocabulary: "BODC/NERC",
    name: "NERC Vocabulary Server (BODC) – Parameter Usage Vocabulary",
    format: "Alphanumeric collection code (P01, P02, etc.)",
    example: "P021 or full P01 code",
    searchUrl: "https://vocab.nerc.ac.uk/",
    instructions: "Enter the NERC/BODC collection code (e.g., P01 for parameters). Standard for marine and oceanographic data."
  },
  "Meteorology and Atmospheric Sciences": {
    vocabulary: "AMS-Terms / WMO-Codes",
    name: "American Meteorological Society terminology + WMO Codes (data only)",
    format: "AMS controlled terms or WMO codes (BUFR/GRIB)",
    example: "atmospheric-river or specific WMO code",
    searchUrl: "https://www.ametsoc.org/",
    instructions: "There is NO thematic paper classification system equivalent to MSC or MeSH. AMS journals use controlled terms. WMO codes are for data transmission, not for indexing literature."
  },
  "Paleontology": {
    vocabulary: "GeoRef",
    name: "GeoRef Subject Categories (08-11) + Thesaurus",
    format: "GeoRef category code or thesaurus term",
    example: "10 (Invertebrate paleontology)",
    searchUrl: "https://www.americangeosciences.org/georef/georef-thesaurus",
    instructions: "Use GeoRef categories: 08 General paleontology, 09 Paleobotany, 10 Invertebrate, 11 Vertebrate. PBDB is a taxon database, NOT a paper classification system."
  },

  // ========== HEALTH SCIENCES ==========
  "General and Internal Medicine": {
    vocabulary: "MeSH",
    name: "Medical Subject Headings",
    format: "MeSH Unique ID / Tree Number",
    example: "D008112",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instructions: "Enter only the MeSH code (e.g., D008112). Do not include the descriptor. Absolute standard in PubMed/MEDLINE."
  },
  "Public Health and Epidemiology": {
    vocabulary: "MeSH",
    name: "Medical Subject Headings",
    format: "MeSH Unique ID / Tree Number",
    example: "D011635",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instructions: "Enter only the MeSH code (e.g., D011635). Do not include the descriptor."
  },
  "Nursing": {
    vocabulary: "MeSH",
    name: "Medical Subject Headings",
    format: "MeSH Unique ID / Tree Number",
    example: "D009729",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instructions: "Enter only the MeSH code (e.g., D009729). Do not include the descriptor."
  },
  "Nutrition and Dietetics": {
    vocabulary: "MeSH",
    name: "Medical Subject Headings",
    format: "MeSH Unique ID / Tree Number",
    example: "D009750",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instructions: "Enter only the MeSH code (e.g., D009750). Do not include the descriptor."
  },
  "Pharmacology and Pharmacy": {
    vocabulary: "MeSH",
    name: "Medical Subject Headings",
    format: "MeSH Unique ID / Tree Number",
    example: "D010597",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instructions: "Enter only the MeSH code (e.g., D010597). Do not include the descriptor. CAS RN are also used for compounds."
  },
  "Dentistry": {
    vocabulary: "MeSH",
    name: "Medical Subject Headings",
    format: "MeSH Unique ID / Tree Number",
    example: "D003813",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instructions: "Enter only the MeSH code (e.g., D003813). Do not include the descriptor."
  },
  "Kinesiology and Physical Therapy": {
    vocabulary: "MeSH",
    name: "Medical Subject Headings",
    format: "MeSH Unique ID / Tree Number",
    example: "D026801",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instructions: "Enter only the MeSH code (e.g., D026801). Do not include the descriptor."
  },
  "Medical Technology and Bioanalysis": {
    vocabulary: "MeSH",
    name: "Medical Subject Headings",
    format: "MeSH Unique ID / Tree Number",
    example: "D008364",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instructions: "Enter only the MeSH code (e.g., D008364). Do not include the descriptor."
  },
  "Veterinary Medicine": {
    vocabulary: "MeSH",
    name: "Medical Subject Headings",
    format: "MeSH Unique ID / Tree Number",
    example: "D014730",
    searchUrl: "https://meshb.nlm.nih.gov/search",
    instructions: "Enter only the MeSH code (e.g., D014730). Do not include the descriptor."
  },

  // ========== ENGINEERING AND TECHNOLOGY ==========
  "Civil Engineering": {
    vocabulary: "Ei",
    name: "Engineering Index Thesaurus / Compendex Classification",
    format: "Ei classification code",
    example: "405.1",
    searchUrl: "https://www.engineeringvillage.com/",
    instructions: "Enter only the Ei/Compendex code (e.g., 405.1). Controlled terms from the Ei Thesaurus are also used."
  },
  "Industrial and Systems Engineering": {
    vocabulary: "Ei",
    name: "Engineering Index Thesaurus / Compendex Classification",
    format: "Ei classification code",
    example: "912.2",
    searchUrl: "https://www.engineeringvillage.com/",
    instructions: "There is no 'IIE/IISE' paper code system. The Ei/Compendex system is used (same as other engineering fields)."
  },
  "Mechanical Engineering": {
    vocabulary: "Ei / ASME",
    name: "Engineering Index Thesaurus (Compendex) + ASME subject categories",
    format: "Ei code or ASME category",
    example: "601.1 or 10-01",
    searchUrl: "https://www.engineeringvillage.com/",
    instructions: "Primarily Ei/Compendex codes. ASME has its own categories in its journals."
  },
  "Electrical and Electronic Engineering": {
    vocabulary: "IEEE",
    name: "IEEE Thesaurus / IEEE Taxonomy",
    format: "IEEE Thesaurus controlled term",
    example: "power-systems",
    searchUrl: "https://www.ieee.org/publications/services/thesaurus-access-page.html",
    instructions: "Enter the preferred term from the IEEE Thesaurus. The IEEE Taxonomy (3-level hierarchical) also exists. The old B6210L-type example is not the current primary format."
  },
  "Chemical Engineering and Biotechnology": {
    vocabulary: "Ei",
    name: "Engineering Index Thesaurus / Compendex",
    format: "Ei classification code",
    example: "804.1",
    searchUrl: "https://www.engineeringvillage.com/",
    instructions: "There is no standard 'IChemE Thesaurus' for paper classification. Ei/Compendex is used."
  },
  "Computer Science and Informatics": {
    vocabulary: "ACM-CCS",
    name: "ACM Computing Classification System (2012)",
    format: "Hierarchical CCS code",
    example: "10003116",
    searchUrl: "https://dl.acm.org/ccs",
    instructions: "Enter the ACM CCS code (e.g., 10003116). Standard in ACM Digital Library and CS journals."
  },
  "Data Science and Artificial Intelligence": {
    vocabulary: "ACM-CCS",
    name: "ACM Computing Classification System (2012)",
    format: "Hierarchical CCS code",
    example: "10010179",
    searchUrl: "https://dl.acm.org/ccs",
    instructions: "Enter the ACM CCS code corresponding to AI / Machine Learning / Data Mining."
  },
  "Robotics and Automation": {
    vocabulary: "ACM-CCS / IEEE",
    name: "ACM Computing Classification System + IEEE Thesaurus",
    format: "ACM-CCS code or IEEE term",
    example: "10010187",
    searchUrl: "https://dl.acm.org/ccs",
    instructions: "Primarily ACM CCS. IEEE Thesaurus terms are also used in IEEE journals."
  },
  "Materials Science and Nanotechnology": {
    vocabulary: "Ei / ASM",
    name: "Engineering Index Thesaurus + ASM International terms",
    format: "Ei code or ASM term",
    example: "nanocomposites or corresponding Ei code",
    searchUrl: "https://www.engineeringvillage.com/",
    instructions: "There is no single dominant ASM code system for papers. Mainly Ei + controlled terms are used."
  },
  "Aerospace Engineering": {
    vocabulary: "NASA",
    name: "NASA Thesaurus",
    format: "NASA Thesaurus controlled term",
    example: "aircraft-design",
    searchUrl: "https://sti.nasa.gov/nasa-thesaurus/",
    instructions: "Enter the NASA Thesaurus identifier/term. Historically the standard in aerospace literature."
  },
  "Renewable Energies and Sustainability": {
    vocabulary: "Ei / ETDE (historical)",
    name: "Engineering Index Thesaurus (primary) + ETDE residual",
    format: "Ei code or term",
    example: "solar-energy",
    searchUrl: "https://www.engineeringvillage.com/",
    instructions: "ETDE is no longer the primary active standard. Use Ei/Compendex codes/terms."
  },

  // ========== SOCIAL SCIENCES ==========
  "Sociology": {
    vocabulary: "LCSH / UNESCO",
    name: "Library of Congress Subject Headings + UNESCO Thesaurus",
    format: "LCSH or UNESCO term",
    example: "Sociology",
    searchUrl: "https://id.loc.gov/authorities/subjects.html",
    instructions: "JEL is NOT for sociology (it is Economics only). Use LCSH, UNESCO Thesaurus, or Sociological Abstracts thesauri."
  },
  "Anthropology and Archaeology": {
    vocabulary: "LCSH / UNESCO",
    name: "Library of Congress Subject Headings + UNESCO Thesaurus",
    format: "LCSH or UNESCO term",
    example: "Anthropology",
    searchUrl: "https://id.loc.gov/authorities/subjects.html",
    instructions: "JEL does NOT apply. Use LCSH or UNESCO."
  },
  "Psychology": {
    vocabulary: "APA",
    name: "APA Thesaurus of Psychological Index Terms",
    format: "APA controlled term",
    example: "cognitive-processes",
    searchUrl: "https://psycnet.apa.org/thesaurus/",
    instructions: "Enter the preferred term from the APA Thesaurus. Used in PsycINFO."
  },
  "Economics and Business": {
    vocabulary: "JEL",
    name: "Journal of Economic Literature Classification System",
    format: "JEL code (letter + numbers)",
    example: "D00",
    searchUrl: "https://www.aeaweb.org/econlit/jelCodes.php",
    instructions: "Enter only the JEL code (e.g., D00, J16, F50). Absolute standard in economics."
  },
  "Political Science and International Relations": {
    vocabulary: "LCSH / UNESCO",
    name: "Library of Congress Subject Headings + UNESCO Thesaurus",
    format: "LCSH or UNESCO term",
    example: "International relations",
    searchUrl: "https://id.loc.gov/authorities/subjects.html",
    instructions: "JEL is NOT for political science. Use LCSH or UNESCO."
  },
  "Law": {
    vocabulary: "LCSH / LCC",
    name: "Library of Congress Subject Headings + Library of Congress Classification (K)",
    format: "LCSH term or classification number",
    example: "KF385",
    searchUrl: "https://id.loc.gov/authorities/subjects.html",
    instructions: "Mix of subject headings (LCSH) and bibliographic classification (class K)."
  },
  "Human Geography and Land Planning": {
    vocabulary: "LCSH / UNESCO",
    name: "Library of Congress Subject Headings + UNESCO Thesaurus",
    format: "LCSH or UNESCO term",
    example: "Human geography",
    searchUrl: "https://id.loc.gov/authorities/subjects.html",
    instructions: "JEL (R10) is only for regional economics. It is not the standard for human geography."
  },
  "Gender Studies": {
    vocabulary: "LCSH / UNESCO",
    name: "Library of Congress Subject Headings + UNESCO Thesaurus",
    format: "LCSH or UNESCO term",
    example: "Gender identity",
    searchUrl: "https://id.loc.gov/authorities/subjects.html",
    instructions: "JEL (J16) is for gender economics. It is not the standard for Gender Studies."
  },
  "Social Communication and Journalism": {
    vocabulary: "LCSH",
    name: "Library of Congress Subject Headings",
    format: "Controlled term",
    example: "Mass media",
    searchUrl: "https://id.loc.gov/authorities/subjects.html",
    instructions: "There is no dominant standard 'CIOS Thesaurus'. LCSH or specialized database terms are used."
  },
  "Education and Pedagogy": {
    vocabulary: "ERIC",
    name: "Education Resources Information Center Thesaurus",
    format: "ERIC controlled term",
    example: "educational-technology",
    searchUrl: "https://eric.ed.gov/?ti=all",
    instructions: "Enter the ERIC identifier/term. Standard in education."
  },
  "Social Work": {
    vocabulary: "LCSH / MeSH",
    name: "Library of Congress Subject Headings + MeSH (health aspects)",
    format: "LCSH term or MeSH code",
    example: "Social work",
    searchUrl: "https://id.loc.gov/authorities/subjects.html",
    instructions: "JEL (I38) is welfare economics. It is not the standard for Social Work."
  },

  // ========== HUMANITIES ==========
  "History": {
    vocabulary: "UNESCO",
    name: "UNESCO Thesaurus",
    format: "Preferred term (descriptor)",
    example: "History",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/en/",
    instructions: "Enter the exact preferred term from the UNESCO Thesaurus (e.g., History). Do not use old numeric microthesauri codes (like 6.25)."
  },
  "Philosophy": {
    vocabulary: "UNESCO",
    name: "UNESCO Thesaurus",
    format: "Preferred term (descriptor)",
    example: "Philosophy",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/en/",
    instructions: "Enter the exact preferred term from the UNESCO Thesaurus (e.g., Philosophy). Do not use old numeric microthesauri codes (like 6.05)."
  },
  "Linguistics and Philology": {
    vocabulary: "UNESCO",
    name: "UNESCO Thesaurus",
    format: "Preferred term (descriptor)",
    example: "Linguistics",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/en/",
    instructions: "Enter the exact preferred term from the UNESCO Thesaurus (e.g., Linguistics). Do not use old numeric microthesauri codes (like 6.10)."
  },
  "Literature": {
    vocabulary: "UNESCO",
    name: "UNESCO Thesaurus",
    format: "Preferred term (descriptor)",
    example: "Literature",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/en/",
    instructions: "Enter the exact preferred term from the UNESCO Thesaurus (e.g., Literature). Do not use old numeric microthesauri codes (like 6.15)."
  },
  "Classical Studies": {
    vocabulary: "UNESCO",
    name: "UNESCO Thesaurus",
    format: "Preferred term (descriptor)",
    example: "Classical studies",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/en/",
    instructions: "Enter the exact preferred term from the UNESCO Thesaurus (e.g., Classical studies). Do not use old numeric microthesauri codes (like 6.20)."
  },
  "Theology and Religious Studies": {
    vocabulary: "UNESCO",
    name: "UNESCO Thesaurus",
    format: "Preferred term (descriptor)",
    example: "Religion",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/en/",
    instructions: "Enter the exact preferred term from the UNESCO Thesaurus (e.g., Religion or Theology). Do not use old numeric microthesauri codes (like 6.30)."
  },
  "Cultural Studies": {
    vocabulary: "UNESCO",
    name: "UNESCO Thesaurus",
    format: "Preferred term (descriptor)",
    example: "Cultural studies",
    searchUrl: "https://vocabularies.unesco.org/browser/thesaurus/en/",
    instructions: "Enter the exact preferred term from the UNESCO Thesaurus (e.g., Cultural studies or Culture). Do not use old numeric microthesauri codes (like 6.35)."
  },
  "Art, Music and Film": {
    vocabulary: "AAT",
    name: "Art & Architecture Thesaurus (Getty)",
    format: "Numeric AAT code",
    example: "300033618",
    searchUrl: "https://www.getty.edu/research/tools/vocabularies/aat/",
    instructions: "Enter only the numeric AAT code (e.g., 300033618). Do not include the descriptor."
  },
  "Architecture and Urbanism": {
    vocabulary: "AAT",
    name: "Art & Architecture Thesaurus (Getty)",
    format: "Numeric AAT code",
    example: "300008125",
    searchUrl: "https://www.getty.edu/research/tools/vocabularies/aat/",
    instructions: "Enter only the numeric AAT code (e.g., 300008125). Do not include the descriptor."
  },

  // ========== AGRICULTURAL SCIENCES ==========
  "Agronomy and Agricultural Production": {
    vocabulary: "AGROVOC",
    name: "FAO Agricultural Thesaurus (AGROVOC)",
    format: "AGROVOC code (c_XXXX)",
    example: "c_867",
    searchUrl: "https://agrovoc.fao.org/browse/agrovoc/en/",
    instructions: "Enter only the AGROVOC code (e.g., c_867). Do not include the term."
  },
  "Forestry Sciences": {
    vocabulary: "AGROVOC",
    name: "FAO Agricultural Thesaurus (AGROVOC)",
    format: "AGROVOC code",
    example: "c_3014",
    searchUrl: "https://agrovoc.fao.org/browse/agrovoc/en/",
    instructions: "Enter only the AGROVOC code (e.g., c_3014)."
  },
  "Aquaculture and Fisheries": {
    vocabulary: "ASFA + AGROVOC",
    name: "Aquatic Sciences and Fisheries Abstracts Thesaurus + AGROVOC",
    format: "ASFA or AGROVOC code",
    example: "Q5 01521 or c_XXXX",
    searchUrl: "https://www.fao.org/fishery/asfa/en",
    instructions: "ASFA is the classic for fisheries/aquaculture. AGROVOC is also widely used."
  },
  "Animal Science and Production": {
    vocabulary: "AGROVOC",
    name: "FAO Agricultural Thesaurus (AGROVOC)",
    format: "AGROVOC code",
    example: "c_433",
    searchUrl: "https://agrovoc.fao.org/browse/agrovoc/en/",
    instructions: "Enter only the AGROVOC code (e.g., c_433)."
  },
  "Food Engineering": {
    vocabulary: "FSTA",
    name: "Food Science and Technology Abstracts Thesaurus (IFIS)",
    format: "FSTA code or term",
    example: "Q04",
    searchUrl: "https://www.ifis.org/fsta",
    instructions: "Enter the FSTA code or term (e.g., Q04)."
  }
};
// Agrega esto después de AREAS_TEMATICAS
const AREA_MAPPING = {};
Object.entries(AREAS_TEMATICAS.es).forEach(([catEs, areasEs]) => {
  areasEs.forEach((areaEs, index) => {
    const catEn = Object.keys(AREAS_TEMATICAS.en)[Object.keys(AREAS_TEMATICAS.es).indexOf(catEs)];
    const areaEn = AREAS_TEMATICAS.en[catEn]?.[index];
    if (areaEn) {
      AREA_MAPPING[areaEn] = areaEs;
      AREA_MAPPING[areaEs] = areaEs; // Por si acaso
    }
  });
});


// Helper para obtener vocabulario
// Helper para obtener vocabulario (actualizado para soportar inglés)
const getVocabularyForArea = (area, lang = 'es') => {
  // Si el área está en inglés, buscar su equivalente en español
  const spanishArea = AREA_MAPPING[area] || area;
  
  // Si el idioma es inglés, buscar en VOCABULARIO_POR_AREA_EN
  if (lang === 'en') {
    // El área ya está en inglés (viene del selector)
    const englishArea = area;
    
    // Buscar directamente en el objeto en inglés
    if (VOCABULARIO_POR_AREA_EN[englishArea]) {
      return VOCABULARIO_POR_AREA_EN[englishArea];
    }
    
    // Si no se encuentra, buscar el equivalente en inglés del área en español
    const areaEn = Object.keys(AREA_MAPPING).find(
      en => AREA_MAPPING[en] === spanishArea && en !== spanishArea
    );
    
    if (areaEn && VOCABULARIO_POR_AREA_EN[areaEn]) {
      return VOCABULARIO_POR_AREA_EN[areaEn];
    }
    
    // Fallback al español
    return VOCABULARIO_POR_AREA[spanishArea];
  }
  
  // Para español, usar el objeto original
  return VOCABULARIO_POR_AREA[spanishArea];
};
const HelpCapsule = ({ text, title }) => {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-flex items-center ml-2 align-middle">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="w-5 h-5 rounded-full bg-slate-100 hover:bg-[#003b5c] text-slate-500 hover:text-white flex items-center justify-center transition-all duration-300 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#003b5c]/30"
        aria-label={title || 'Help'}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute z-50 bottom-full mb-3 left-1/2 -translate-x-1/2 w-80 p-5 bg-gradient-to-br from-[#003b5c] to-[#002b44] text-white text-xs rounded-xl shadow-2xl leading-relaxed font-sans ring-1 ring-white/10 backdrop-blur-sm"
          >
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#002b44]" />
            <div className="flex items-start gap-3 mb-2">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-sm mb-1 text-white/90">{title || 'Help'}</h4>
                <p className="text-white/70 text-xs leading-relaxed">{text}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============ COMPONENTE: PALABRAS CLAVE CONTROLADAS ============

const ControlledKeywordInput = ({ vocabularyConfig, value, onChange, language, mode = 'keywords' }) => {
  const isSpanish = language === 'es';
  const [newTerm, setNewTerm] = useState('');
  const [error, setError] = useState('');

  const maxKeywords = mode === 'codes' ? 4 : 6;
  const minKeywords = mode === 'codes' ? 2 : 2;
  const keywords = Array.isArray(value) ? value : [];

  const addKeyword = () => {
    const term = newTerm.trim();
    
    if (!term) {
      setError(mode === 'codes'
        ? (isSpanish ? 'Debes ingresar un código.' : 'You must enter a code.')
        : (isSpanish ? 'Debes ingresar una palabra clave.' : 'You must enter a keyword.')
      );
      return;
    }
    
    if (keywords.length >= maxKeywords) {
      setError(isSpanish 
        ? `Has alcanzado el máximo de ${maxKeywords} palabras clave.` 
        : `You have reached the maximum of ${maxKeywords} keywords.`);
      return;
    }
    
    if (keywords.some(k => k === term || k.term === term)) {
      setError(mode === 'codes'
        ? (isSpanish ? 'Este código ya existe.' : 'This code already exists.')
        : (isSpanish ? 'Esta palabra clave ya existe.' : 'This keyword already exists.')
      );
      return;
    }
    const updatedKeywords = [...keywords, term];
    onChange(updatedKeywords);
    setNewTerm('');
    setError('');
  };

  const removeKeyword = (index) => {
    const updatedKeywords = keywords.filter((_, i) => i !== index);
    onChange(updatedKeywords);
  };

  const handleTermKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  };

  return (
    <div className="space-y-4">
      {mode === 'codes' && vocabularyConfig && (
        <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-[#003b5c]/5 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#003b5c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-serif font-bold text-[#003b5c] text-sm tracking-wide">
  {vocabularyConfig.vocabulario || vocabularyConfig.vocabulary}: {vocabularyConfig.nombre || vocabularyConfig.name}
</h4>
<p className="text-slate-500 text-xs mt-1.5 font-sans leading-relaxed">
  {vocabularyConfig.instrucciones || vocabularyConfig.instructions}
</p>
              <a
                href={vocabularyConfig.searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-[#003b5c] hover:text-[#e86125] text-xs font-semibold transition-colors font-sans"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {isSpanish ? 'Explorar vocabulario' : 'Explore vocabulary'} 
                <span aria-hidden="true">&rarr;</span>
              </a>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-100">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
  {isSpanish ? 'Formato esperado:' : 'Expected format:'}
</span>
<code className="ml-2 text-sm font-mono text-[#003b5c] bg-slate-50 px-2 py-1 rounded">
  {vocabularyConfig.formato || vocabularyConfig.format}
</code>
<span className="text-slate-400 text-sm mx-2">·</span>
<span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
  {isSpanish ? 'Ejemplo:' : 'Example:'}
</span>
<code className="ml-2 text-sm font-mono text-[#e86125] bg-slate-50 px-2 py-1 rounded">
  {vocabularyConfig.ejemplo || vocabularyConfig.example}
</code>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            onKeyPress={handleTermKeyPress}
            // En ControlledKeywordInput
placeholder={mode === 'codes' 
  ? (isSpanish 
      ? `Ej: ${vocabularyConfig.ejemplo || vocabularyConfig.example}` 
      : `e.g., ${vocabularyConfig.example || vocabularyConfig.ejemplo}`)
  : (isSpanish ? "Ej: Aprendizaje automático" : "e.g., Machine learning")
}
            className="w-full p-3.5 bg-white border-0 ring-1 ring-slate-200 rounded-lg text-sm font-sans focus:ring-2 focus:ring-[#003b5c] focus:bg-slate-50 outline-none transition-all duration-300 shadow-sm"
          />
          {mode === 'keywords' && (
            <HelpCapsule
              title={isSpanish ? '¿Qué son las palabras clave?' : 'What are keywords?'}
              text={isSpanish 
                ? 'Son términos que describen tu investigación. Usa palabras específicas de tu campo. Por ejemplo: "machine learning", "células madre", "cambio climático". Ayudan a que otros investigadores encuentren tu trabajo.'
                : 'These are terms that describe your research. Use specific words from your field. For example: "machine learning", "stem cells", "climate change". They help other researchers find your work.'}
            />
          )}
        </div>
        <button
          type="button"
          onClick={addKeyword}
          disabled={!newTerm.trim() || keywords.length >= maxKeywords}
          className="px-6 py-3.5 bg-slate-900 text-white rounded-lg text-sm font-semibold tracking-wide hover:bg-[#003b5c] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
        >
          {isSpanish ? 'Añadir' : 'Add'}
        </button>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -5 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="flex items-center gap-2 text-xs text-red-500 font-medium bg-red-50 px-3 py-2 rounded-lg"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </motion.div>
      )}

      <div className="flex items-center justify-between">
        <p className={`text-xs font-mono ${keywords.length < minKeywords ? 'text-red-600' : 'text-slate-500'}`}>
          {mode === 'codes' 
            ? (isSpanish 
                ? `${keywords.length} de 2-4 códigos requeridos`
                : `${keywords.length} of 2-4 required codes`)
            : (isSpanish 
                ? `${keywords.length} de ${minKeywords}-${maxKeywords} palabras clave requeridas`
                : `${keywords.length} of ${minKeywords}-${maxKeywords} required keywords`)
          }
          {keywords.length < minKeywords && (
            <span className="ml-2">
              {mode === 'codes' 
                ? (isSpanish ? '(mínimo 2)' : '(minimum 2)')
                : (isSpanish ? `(mínimo ${minKeywords})` : `(minimum ${minKeywords})`)}
            </span>
          )}
        </p>
        {keywords.length >= maxKeywords && (
          <p className="text-xs text-[#e86125] font-mono">
            {isSpanish ? 'Máximo alcanzado' : 'Maximum reached'}
          </p>
        )}
      </div>

      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          <AnimatePresence>
            {keywords.map((kw, index) => (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.8 }}
                key={index}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium shadow-sm ring-1 transition-all
                  ${mode === 'codes' 
                    ? 'bg-amber-50 ring-amber-200/60 text-amber-900 font-mono font-bold' 
                    : 'bg-slate-50 ring-slate-200/60 text-slate-700 hover:bg-white'
                  }`}
              >
                <span>{typeof kw === 'string' ? kw : kw.term}</span>
                <button 
                  type="button" 
                  onClick={() => removeKeyword(index)} 
                  className="ml-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
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
    es: {
      pdf: 'https://www.revistacienciasestudiantes.com/consent.pdf',
      docx: 'https://www.revistacienciasestudiantes.com/acuerdo_publicacion_autor_menor_ES.docx'
    },
    en: {
      pdf: 'https://www.revistacienciasestudiantes.com/consentEN.pdf',
      docx: 'https://www.revistacienciasestudiantes.com/publication_agreement_minor_author_EN.docx'
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
      className="mt-6 pt-6 border-t border-slate-200 space-y-6 bg-gradient-to-br from-amber-50/50 to-white rounded-xl p-6"
    >
      <div className="flex items-center gap-3 text-amber-800">
        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h4 className="font-serif font-bold text-sm tracking-wide">
          {isSpanish 
            ? 'Autorización de Tutor Legal Requerida' 
            : 'Legal Guardian Consent Required'}
        </h4>
        <HelpCapsule
          title={isSpanish ? '¿Por qué se requiere esto?' : 'Why is this required?'}
          text={isSpanish
            ? 'Por razones legales, los autores menores de 18 años necesitan que su tutor legal autorice la publicación. Esto protege al menor y asegura que toda su investigación cumpla con estándares éticos.'
            : 'For legal reasons, authors under 18 years old need their legal guardian to authorize publication. This protects the minor and ensures all research meets ethical standards.'}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-700 tracking-wide">
          {isSpanish ? 'Nombre completo del tutor legal' : 'Legal guardian full name'} 
          <span className="text-red-500">*</span>
          <HelpCapsule
            title={isSpanish ? '¿Quién es el tutor legal?' : 'Who is the legal guardian?'}
            text={isSpanish
              ? 'Es la persona responsable legalmente del menor: padre, madre o tutor designado. Su nombre aparecerá en la autorización formal.'
              : 'This is the person legally responsible for the minor: father, mother, or designated guardian. Their name will appear in the formal authorization.'}
          />
        </label>
        <input
          type="text"
          value={author.guardianName || ''}
          onChange={(e) => onUpdate(index, 'guardianName', e.target.value)}
          className="w-full p-3.5 bg-white border-0 ring-1 ring-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#003b5c] transition-all shadow-sm"
          placeholder={isSpanish ? 'Ej: Juan Pérez López' : 'e.g., John Doe Smith'}
        />
      </div>

      <div className="space-y-4">
        <label className="block text-xs font-semibold text-slate-700 tracking-wide">
          {isSpanish ? 'Método de validación' : 'Validation method'}
          <HelpCapsule
            title={isSpanish ? '¿Cómo funciona la validación?' : 'How does validation work?'}
            text={isSpanish
              ? 'Puedes elegir entre enviar el consentimiento por correo electrónico o subir un formulario firmado. Ambos métodos son igualmente válidos.'
              : 'You can choose between sending consent by email or uploading a signed form. Both methods are equally valid.'}
          />
        </label>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className={`relative flex cursor-pointer rounded-xl bg-white p-4 ring-1 transition-all hover:bg-slate-50 ${author.consentMethod === 'email' ? 'ring-2 ring-[#003b5c] shadow-md' : 'ring-slate-200 shadow-sm'}`}>
            <input 
              type="radio" 
              name={`consent-${index}-${author.firstName}-${author.lastName}`}
              value="email" 
              checked={author.consentMethod === 'email'} 
              onChange={() => onUpdate(index, 'consentMethod', 'email')} 
              className="peer sr-only" 
            />
            <span className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-5 h-5 rounded-full border ${author.consentMethod === 'email' ? 'border-[#003b5c] bg-[#003b5c]' : 'border-slate-300'}`}>
                {author.consentMethod === 'email' && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-900">{isSpanish ? 'Vía Correo' : 'Via Email'}</span>
                <span className="text-xs text-slate-500">contact@revistacienciasestudiantes.com</span>
              </div>
            </span>
          </label>

          <label className={`relative flex cursor-pointer rounded-xl bg-white p-4 ring-1 transition-all hover:bg-slate-50 ${author.consentMethod === 'upload' ? 'ring-2 ring-[#003b5c] shadow-md' : 'ring-slate-200 shadow-sm'}`}>
            <input 
              type="radio" 
              name={`consent-${index}-${author.firstName}-${author.lastName}`}
              value="upload" 
              checked={author.consentMethod === 'upload'} 
              onChange={() => onUpdate(index, 'consentMethod', 'upload')} 
              className="peer sr-only" 
            />
            <span className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-5 h-5 rounded-full border ${author.consentMethod === 'upload' ? 'border-[#003b5c] bg-[#003b5c]' : 'border-slate-300'}`}>
                {author.consentMethod === 'upload' && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-900">{isSpanish ? 'Subir Documento' : 'Upload File'}</span>
                <span className="text-xs text-slate-500">{isSpanish ? 'PDF firmado' : 'Signed PDF'}</span>
              </div>
            </span>
          </label>
        </div>
      </div>

      {author.consentMethod === 'email' && (
        <div className="space-y-4">
          <div className="p-4 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-sans">
            <p className="font-medium mb-2">{isSpanish ? 'El correo debe contener:' : 'Email must include:'}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{isSpanish ? 'Nombre del autor menor' : 'Minor author name'}</li>
              <li>{isSpanish ? 'Nombre completo del tutor' : 'Guardian full name'}</li>
              <li>{isSpanish ? 'Documento de identidad del tutor' : 'Guardian ID document'}</li>
              <li>{isSpanish ? 'Frase: "Autorizo la publicación en Revista Nacional de las Ciencias"' : 'Phrase: "I authorize publication in National Review of Sciences"'}</li>
            </ul>
          </div>
          
          <button
            type="button"
            onClick={() => {
              const minorName = `${author.firstName} ${author.lastName}`.trim();
              const guardianName = author.guardianName || (isSpanish ? '[Nombre del tutor]' : '[Guardian name]');
              const titleElement = document.querySelector('input[name="title"]');
              const articleTitle = titleElement ? titleElement.value : (isSpanish ? '[Título del artículo]' : '[Article title]');
              
              const subject = isSpanish
                ? `Consentimiento para publicación - Autor menor: ${minorName}`
                : `Publication Consent - Minor Author: ${minorName}`;
              
              const body = isSpanish
                ? `ACUERDO DE PUBLICACIÓN — AUTOR MENOR DE EDAD\nRevista Nacional de las Ciencias para Estudiantes\n\nEstimado equipo editorial,\n\nPor medio del presente documento, en mi calidad de tutor legal de ${minorName}, declaro, consiento y autorizo expresamente los siguientes términos institucionales:\n\n1. REPRESENTACIÓN LEGAL:\nTengo plena autoridad legal para otorgar este consentimiento en representación del menor autor. He leído, analizado y aprobado el contenido íntegro del manuscrito postulado titulado «${articleTitle}».\n\n2. LICENCIAMIENTO Y ACCESO ABIERTO:\nAutorizo la publicación, reproducción y distribución del artículo en la Revista Nacional de las Ciencias para Estudiantes bajo los términos de la licencia Creative Commons Atribución 4.0 Internacional (CC-BY 4.0). Comprendo que esto permite el libre acceso, uso y adaptación de la obra por parte de terceros, garantizando siempre el reconocimiento de la autoría original.\n\n3. TRATAMIENTO DE DATOS PERSONALES:\nAutorizo a la Revista a almacenar, procesar y gestionar los datos personales proporcionados en el formulario de envío. Estos datos se guardan de forma segura en una base de datos privada y no se exponen públicamente. Solo se mostrarán los datos necesarios para la publicación, incluyendo el email proporcionado en el formulario, por lo que queda a discreción del autor y tutor elegir con cuidado el mismo. El autor puede editar su perfil público en la página en cualquier momento.\n\n4. PARTICIPACIÓN COMO REVISOR CIENTÍFICO:\nEn caso de que el menor haya manifestado afirmativamente su deseo en el formulario de envío, autorizo expresamente que sea contactado e invitado a participar como revisor de pares para otros trabajos que se enmarquen dentro de sus áreas de conocimiento.\n\n5. NATURALEZA DEL ACUERDO:\nComprendo que la postulación y potencial publicación no conllevan ningún tipo de retribución económica ni obligación pecuniaria entre las partes.\n\n6. DERECHO DE RETRACTACIÓN:\nEntiendo que dispongo del derecho inalienable de retirar este consentimiento en cualquier momento antes de que el manuscrito alcance la fase de producción (publicación efectiva), mediante notificación formal al correo electrónico contact@revistacienciasestudiantes.com.\n\nDATOS DEL TUTOR LEGAL:\nNombre completo: ${guardianName}\nRelación con el menor: [Indicar: Padre / Madre / Tutor legal]\nDocumento de identidad: [Indicar tipo y número]\n\nDATOS DEL MENOR AUTOR:\nNombre completo: ${minorName}\nEdad: [Indicar edad]\nFecha de nacimiento: [Indicar fecha]\n\nSin otro particular, saluda atentamente,\n\n${guardianName}\n[Ciudad, país] — [Fecha]`
                : `PUBLICATION AGREEMENT — MINOR AUTHOR\nNational Review of Sciences for Students\n\nDear Editorial Team,\n\nThrough this document, as legal guardian of ${minorName}, I declare, consent to, and expressly authorize the following institutional terms:\n\n1. LEGAL REPRESENTATION:\nI have full legal authority to grant this consent on behalf of the minor author. I have read, analyzed, and approved the complete content of the submitted manuscript titled «${articleTitle}».\n\n2. LICENSING AND OPEN ACCESS:\nI authorize the publication, reproduction, and distribution of the article in the National Review of Sciences for Students under the terms of the Creative Commons Attribution 4.0 International license (CC-BY 4.0). I understand that this allows free access, use, and adaptation of the work by third parties, always guaranteeing recognition of the original authorship.\n\n3. PERSONAL DATA PROCESSING:\nI authorize the Journal to store, process, and manage the personal data provided in the submission form. This data is securely stored in a private database and is not publicly exposed. Only the necessary data for publication will be displayed, including the email provided in the form, so it is at the discretion of the author and guardian to choose it carefully. The author can edit their public profile on the page at any time.\n\n4. PARTICIPATION AS SCIENTIFIC REVIEWER:\nIn the event that the minor has affirmatively expressed their desire in the submission form, I expressly authorize that they be contacted and invited to participate as a peer reviewer for other works within their areas of knowledge.\n\n5. NATURE OF THE AGREEMENT:\nI understand that submission and potential publication do not entail any financial compensation or pecuniary obligation between the parties.\n\n6. RIGHT OF RETRACTION:\nI understand that I have the inalienable right to withdraw this consent at any time before the manuscript reaches the production phase (effective publication), by formal notification to contact@revistacienciasestudiantes.com.\n\nLEGAL GUARDIAN INFORMATION:\nFull name: ${guardianName}\nRelationship to minor: [Specify: Father / Mother / Legal guardian]\nID document: [Specify type and number]\n\nMINOR AUTHOR INFORMATION:\nFull name: ${minorName}\nAge: [Specify age]\nDate of birth: [Specify date]\n\nSincerely,\n\n${guardianName}\n[City, country] — [Date]`;

              const gmailUrl = `https://mail.google.com/mail/u/0/?fs=1&to=contact@revistacienciasestudiantes.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}&tf=cm`;
              window.open(gmailUrl, '_blank', 'noopener,noreferrer');
            }}
            className="w-full px-5 py-3 bg-[#003b5c] text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-[#002b44] transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {isSpanish ? 'Redactar correo en Gmail' : 'Compose email in Gmail'}
          </button>
        </div>
      )}

            {author.consentMethod === 'upload' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={consentUrls[language].pdf}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[#003b5c] hover:text-[#e86125] text-sm underline-offset-4 hover:underline font-sans font-medium bg-white rounded-lg px-4 py-2.5 ring-1 ring-slate-200 hover:ring-[#003b5c] transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              {isSpanish ? 'Descargar PDF' : 'Download PDF'}
            </a>
            <a
              href={consentUrls[language].docx}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[#003b5c] hover:text-[#e86125] text-sm underline-offset-4 hover:underline font-sans font-medium bg-white rounded-lg px-4 py-2.5 ring-1 ring-slate-200 hover:ring-[#003b5c] transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {isSpanish ? 'Descargar DOCX' : 'Download DOCX'}
            </a>
          </div>

          <input
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileUpload}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-[#003b5c] hover:file:bg-slate-200 font-sans uppercase tracking-wider"
          />

          {author.consentFile && (
            <div className="flex items-center gap-2 text-[#003b5c] text-xs font-sans bg-green-50 px-3 py-2 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{author.consentFile.name}</span>
            </div>
          )}
        </div>
      )}
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
    keywordsEs: [],
    keywordsEn: [],
    specializedCodes: [],
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
  isCorresponding: true,
  phone: ''
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
    editorComment: '',
    manuscript: null,
    manuscriptName: '',
    wantsToBeReviewer: false,
    reviewerAreas: [],
  };

  const [formData, setFormData] = useState(initialFormState);
  const formDataRef = useRef(formData);

  // Opciones de tipo de artículo
  const articleTypeOptions = {
    es: [
      { value: 'research', label: 'Artículo de Investigación Original' },
      { value: 'review', label: 'Revisión Sistemática' },
      { value: 'essay', label: 'Ensayo Académico o Reflexivo' },
      { value: 'case', label: 'Reporte de Caso' },
      { value: 'book_review', label: 'Reseña de Libros (Book Review)' }
    ],
    en: [
      { value: 'research', label: 'Original Research Article' },
      { value: 'review', label: 'Systematic Review' },
      { value: 'essay', label: 'Academic or Reflective Essay' },
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
// Después de availabilityOptions y antes de los useEffect:

// ============ STEPS ============
const steps = [
  { id: 1, title: isSpanish ? 'Manuscrito' : 'Manuscript' },
  { id: 2, title: isSpanish ? 'Autores' : 'Authors' },
  { id: 3, title: isSpanish ? 'Envío' : 'Submission' }
];
  // Sincronizar refs
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // Carga del borrador
  useEffect(() => {
    const savedData = localStorage.getItem('submissionFormDraft');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData(prev => ({
          ...prev,
          ...parsed,
          manuscript: null,
          manuscriptName: parsed.manuscriptName || '',
          editorComment: parsed.editorComment || ''
        }));
      } catch (e) {
        console.error('[DEBUG] Error cargando borrador:', e);
      }
    }
  }, []);

  // Autoguardado
  useEffect(() => {
    const interval = setInterval(() => {
      const dataToSave = {
        ...formDataRef.current,
        manuscript: null,
        manuscriptName: formDataRef.current.manuscriptName,
      };
      localStorage.setItem('submissionFormDraft', JSON.stringify(dataToSave));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

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

  // Importar perfil del usuario logueado
  const handleImportMyProfile = (authorIndex) => {
    if (!user) return;

    const updatedAuthors = [...formData.authors];
    const author = updatedAuthors[authorIndex];

updatedAuthors[authorIndex] = {
  firstName: user.firstName || author.firstName,
  lastName: user.lastName || author.lastName,
  email: user.email || author.email,
  institution: user.institution || author.institution || '',
  orcid: user.orcid || author.orcid || '',
  contribution: author.contribution,
  isMinor: author.isMinor,
  guardianName: author.guardianName,
  consentMethod: author.consentMethod,
  consentFile: author.consentFile,
  isCorresponding: author.isCorresponding,
  phone: author.phone
};
    setFormData(prev => ({ ...prev, authors: updatedAuthors }));
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
      isCorresponding: false,
      phone: '',
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
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.declarations;
      return newErrors;
    });
  };

  // Verificar si todas las declaraciones están aceptadas
  const allDeclarationsAccepted = () => {
    const d = formData.declarations;
    return (
      d.originalAndSimilarity === true &&
      d.exclusiveSubmission === true &&
      d.authorshipCriteria === true &&
      d.dataAuthentic === true &&
      d.informedConsent === true &&
      d.aiDisclosure === true &&
      d.conflicts === true &&
      d.ccByLicense === true
    );
  };

  // Validación sin modificar estado (para renderizado)
  const isStepValid = (step) => {
    switch (step) {
      case 1:
        return formData.title.trim() &&
          formData.abstract.trim() &&
          formData.keywordsEs.length >= 2 && 
          formData.keywordsEs.length <= 6 &&
          formData.area.trim() &&
          formData.articleType;
           if (formData.area && getVocabularyForArea(formData.area, language)) {
          if (!formData.specializedCodes || formData.specializedCodes.length < 2) {
            return false;
          }
        }
      
            case 2:
        const basicOk = formData.authors.every(a =>
          a.firstName.trim() && a.lastName.trim() && a.email.trim() && a.institution.trim()
        );
        
        // Verificar contribución CRediT si hay más de un autor
        const creditOk = formData.authors.length === 1 || formData.authors.every(a => a.contribution.trim());
        
        const minorsOk = formData.authors
          .filter(a => a.isMinor)
          .every(a =>
            a.guardianName.trim() &&
            a.consentMethod !== 'none' &&
            (a.consentMethod !== 'upload' || !!a.consentFile)
          );
        return basicOk && creditOk && minorsOk;
      
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

  // Validación con efectos secundarios (para navegación y envío)
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
        if (!formData.keywordsEs || formData.keywordsEs.length < 2) {
          errors.controlledKeywords = isSpanish 
            ? 'Debes agregar al menos 2 palabras clave en español' 
            : 'You must add at least 2 keywords in Spanish';
        }
        if (formData.keywordsEs && formData.keywordsEs.length > 6) {
          errors.controlledKeywords = isSpanish 
            ? 'Máximo 6 palabras clave permitidas' 
            : 'Maximum 6 keywords allowed';
        }
        if (!formData.area.trim()) {
          errors.area = isSpanish ? 'El área temática es obligatoria' : 'Subject area is required';
        }
                // Validación de códigos especializados (si hay área con vocabulario)
        if (formData.area && getVocabularyForArea(formData.area, language)) {
          if (!formData.specializedCodes || formData.specializedCodes.length < 2) {
            errors.specializedCodes = isSpanish 
              ? `Debes agregar al menos 2 códigos especializados (${getVocabularyForArea(formData.area, language)?.vocabulario})` 
              : `You must add at least 2 specialized codes (${getVocabularyForArea(formData.area, language)?.vocabulario})`;
          }
          if (formData.specializedCodes && formData.specializedCodes.length > 4) {
            errors.specializedCodes = isSpanish 
              ? 'Máximo 4 códigos especializados permitidos' 
              : 'Maximum 4 specialized codes allowed';
          }
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
            // ✅ AGREGAR AQUÍ: Validación de teléfono para autor de correspondencia
if (author.isCorresponding && !author.phone) {
  errors[`author_${index}_phone`] = isSpanish 
    ? 'Teléfono requerido para el autor de correspondencia' 
    : 'Phone required for corresponding author';
}
          // NUEVO: Validación de contribución CRediT (solo si hay más de un autor)
          if (formData.authors.length > 1 && !author.contribution.trim()) {
            errors[`author_${index}_contribution`] = isSpanish 
              ? 'Debes especificar la contribución CRediT de este autor' 
              : 'You must specify the CRediT contribution for this author';
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

  // Navegación entre pasos
  const nextStep = () => {
    if (validateAndProceed(currentStep)) {
      setValidationErrors({});
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const errorList = Object.entries(validationErrors)
        .map(([key, msg]) => `• ${msg}`)
        .join('\n');
      
      if (errorList) {
        alert(isSpanish 
          ? `Completa los campos requeridos antes de continuar:\n\n${errorList}` 
          : `Complete required fields before continuing:\n\n${errorList}`);
      }
    }
  };

  const prevStep = () => {
    setValidationErrors({});
    setCurrentStep(prev => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Función de envío
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateAndProceed(3)) {
      const errorList = Object.entries(validationErrors)
        .map(([key, msg]) => `• ${msg}`)
        .join('\n');
      
      alert(isSpanish 
        ? `Completa todos los campos requeridos antes de enviar:\n\n${errorList}` 
        : `Complete all required fields before submitting:\n\n${errorList}`);
      return;
    }

    setUploading(true);
    setSubmitStatus(isSpanish ? 'Enviando artículo...' : 'Submitting article...');

    try {
      const token = await auth.currentUser.getIdToken();
      const manuscriptBase64 = await toBase64(formData.manuscript);
      const correspondingAuthor = formData.authors.find(a => a.isCorresponding) || formData.authors[0];

      const payload = {
  title: formData.title,
  titleEn: formData.titleEn,
  abstract: formData.abstract,
  abstractEn: formData.abstractEn,
  keywordsEs: formData.keywordsEs,  // ✅ Nombre correcto
  keywordsEn: formData.keywordsEn,  // ✅ Nombre correcto
  keywordsVocabulario: getVocabularyForArea(formData.area, language)?.vocabulario || 'unknown',  // ✅ CORRECTO
  specializedCodes: formData.specializedCodes,  // ✅ Nombre correcto (si el backend lo espera así)
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
  isCorresponding: a.isCorresponding,
  phone: a.phone || '',
})),
        funding: formData.funding,
        conflictOfInterest: formData.conflictOfInterest,
        excludedReviewers: formData.excludedReviewers,
        editorComment: formData.editorComment,
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
        wantsToBeReviewer: formData.wantsToBeReviewer,
        reviewerAreas: formData.wantsToBeReviewer ? formData.reviewerAreas : [],
         authorUID: user.uid,
  submitterEmail: user.email,  // ← NUEVO: Email del que sube
  submitterName: user.displayName || `${correspondingAuthor.firstName} ${correspondingAuthor.lastName}`.trim(),  // ← NUEVO: Nombre del que sube
  
  // Datos del autor de correspondencia (para correos)
  authorEmail: correspondingAuthor.email,  // ← CAMBIADO: Email del autor de correspondencia
  authorName: `${correspondingAuthor.firstName} ${correspondingAuthor.lastName}`.trim(),  // ← CAMBIADO: Nombre del autor de correspondencia
  
  // También enviar la información completa del autor de correspondencia
  correspondingAuthor: {
    firstName: correspondingAuthor.firstName,
    lastName: correspondingAuthor.lastName,
    email: correspondingAuthor.email,
    institution: correspondingAuthor.institution,
    orcid: correspondingAuthor.orcid || null,
    isCorresponding: true,
    correspondingAuthorPhone: correspondingAuthor.phone || '',
  }

      };

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
        throw new Error(errorText);
      }

      const result = await response.json();
      localStorage.removeItem('submissionFormDraft');
      setSubmissionId(result.submissionId);
      setDriveFolderId(result.driveFolderId);
      setSubmitStatus(isSpanish ? 'Artículo enviado con éxito' : 'Article submitted successfully');
      setSubmitted(true);

      if (onSuccess) onSuccess(result.submissionId);

    } catch (error) {
      console.error('[DEBUG] Error en el envío:', error);
      setSubmitStatus(isSpanish 
        ? `Error: ${error.message}` 
        : `Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Pantalla de éxito
  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-3xl mx-auto py-20 px-4"
      >
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden ring-1 ring-slate-100">
          <div className="bg-gradient-to-br from-[#003b5c] to-[#001f30] p-16 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-5 rounded-full blur-3xl"></div>
            <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-4xl font-serif font-light text-white mb-4 tracking-tight">
              {isSpanish ? 'Manuscrito Recibido' : 'Manuscript Received'}
            </h2>
            <p className="text-slate-300 text-sm font-sans tracking-wide max-w-md mx-auto">
              {isSpanish ? 'Tu investigación está ahora en manos de nuestro equipo editorial.' : 'Your research is now in the hands of our editorial team.'}
            </p>
          </div>
          
          <div className="p-12 space-y-8">
            <div className="bg-slate-50 rounded-xl p-6">
              <p className="text-xs font-mono text-slate-500 mb-2 uppercase tracking-widest">Submission ID</p>
              <p className="text-2xl font-serif text-[#003b5c] tracking-wider">{submissionId}</p>
            </div>

            <div className="border border-slate-200 rounded-xl p-8 hover:border-[#003b5c] transition-colors">
              <div className="flex items-start gap-6">
                <div className="w-14 h-14 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-7 h-7 text-[#003b5c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-serif text-[#003b5c] mb-2">
                    {isSpanish ? 'Tu carpeta de documentos' : 'Your documents folder'}
                  </h3>
                  <p className="text-sm text-slate-500 mb-4 font-sans">
                    {isSpanish 
                      ? 'Aquí puedes ver los documentos que subiste (solo lectura)' 
                      : 'Here you can view the documents you uploaded (read-only)'}
                  </p>
                  <a 
                    href={`https://drive.google.com/drive/folders/${driveFolderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[#003b5c] text-sm font-bold hover:text-[#e86125] transition-colors uppercase tracking-wider"
                  >
                    {isSpanish ? 'Abrir en Google Drive' : 'Open in Google Drive'} 
                    <span aria-hidden="true">&rarr;</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-8">
              <div className="flex items-start gap-6">
                <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center flex-shrink-0 border border-slate-200">
                  <svg className="w-7 h-7 text-[#003b5c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-serif text-[#003b5c] mb-2">
                    {isSpanish ? 'Seguimiento del envío' : 'Submission tracking'}
                  </h3>
                  <p className="text-sm text-slate-500 mb-4 font-sans">
                    {isSpanish 
                      ? 'Puedes ver el estado de tu artículo en la pestaña "Mis envíos" del portal' 
                      : 'You can check your article status in the "My submissions" tab on the portal'}
                  </p>
                  <div className="inline-flex items-center gap-2 text-sm text-[#003b5c] font-bold uppercase tracking-wider">
                    <span className="w-2 h-2 bg-[#e86125] rounded-full"></span>
                    {isSpanish ? 'Estado actual: Recibido' : 'Current status: Received'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Renderizado principal del formulario
  return (
    
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-[#003b5c] selection:text-white pb-24">
      {/* HEADER SUPERIOR */}
      <header className="bg-white sticky top-0 z-40 border-b border-slate-200/80 shadow-sm backdrop-blur-md bg-white/90">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#003b5c] flex items-center justify-center text-white shadow-inner">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <span className="font-serif font-semibold text-[#003b5c] tracking-wide text-lg">
              {isSpanish ? 'Portal de Autores' : 'Author Portal'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full ring-1 ring-slate-200">
            <UserIcon className="w-4 h-4" />
            {user?.email || 'Autor'}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 mt-10">
        {/* STEPPER ACADÉMICO */}
        <div className="mb-12 relative">
          <div className="absolute top-5 left-8 right-8 h-0.5 bg-slate-200 -z-10 rounded-full"></div>
          <div className="absolute top-5 left-8 h-0.5 bg-[#003b5c] -z-10 transition-all duration-700 ease-out rounded-full" 
               style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}></div>
          
          <div className="flex justify-between">
            {steps.map((step) => {
              const isActive = currentStep === step.id;
              const isPast = currentStep > step.id;
              return (
                <div key={step.id} className="flex flex-col items-center gap-3 relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 shadow-sm ring-4 ring-[#F8FAFC]
                    ${isActive ? 'bg-[#003b5c] text-white scale-110 shadow-md' : isPast ? 'bg-[#003b5c] text-white' : 'bg-white text-slate-400 border border-slate-300'}`}>
                    {isPast ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-sm font-bold">{step.id}</span>
                    )}
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-widest text-center transition-colors duration-300
                    ${isActive ? 'text-[#003b5c]' : isPast ? 'text-slate-700' : 'text-slate-400'}`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* FORMULARIO CONTENEDOR */}
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-100">
          <form onSubmit={handleSubmit} className="p-8 sm:p-12">
            <AnimatePresence mode="wait">
              {/* PASO 1: MANUSCRITO */}
              {currentStep === 1 && (
                <motion.div 
                  key="step1" 
                  initial={{ opacity: 0, x: 20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0, x: -20 }} 
                  className="space-y-10"
                >
                  <div className="border-b border-slate-100 pb-4 mb-8">
                    <h2 className="text-2xl font-serif text-[#003b5c] font-medium">
                      {isSpanish ? 'Metadatos del Artículo' : 'Article Metadata'}
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                      {isSpanish ? 'Asegúrese de que el título y resumen coincidan exactamente con su documento Word.' : 'Ensure that the title and abstract match exactly with your Word document.'}
                    </p>
                  </div>

                  <div className="space-y-6">
                    {/* Título */}
                    <div className="group">
                      <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 transition-colors group-focus-within:text-[#003b5c]">
                        {isSpanish ? 'Título del Trabajo' : 'Article Title'} 
                        <span className="text-red-500 ml-1">*</span>
                        <HelpCapsule
                          title={isSpanish ? '¿Qué título debo usar?' : 'What title should I use?'}
                          text={isSpanish
                            ? 'Escribe el título completo y exacto de tu investigación. Debe ser descriptivo y específico. Evita títulos genéricos como "Estudio de investigación". Un buen título resume el tema principal y el enfoque de tu trabajo.'
                            : 'Write the complete and exact title of your research. It should be descriptive and specific. Avoid generic titles like "Research study". A good title summarizes the main topic and focus of your work.'}
                        />
                      </label>
                      <input 
                        type="text" 
                        name="title" 
                        value={formData.title} 
                        onChange={handleInputChange} 
                        className={`w-full p-4 bg-slate-50/50 border-0 ring-1 rounded-xl text-lg font-serif text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#003b5c] transition-all shadow-sm
                          ${validationErrors.title ? 'ring-red-300' : 'ring-slate-200'}`}
                        placeholder={isSpanish ? 'Escriba el título completo aquí...' : 'Write the full title here...'}
                      />
                      {validationErrors.title && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.title}</p>
                      )}
                    </div>

                    {/* Título en inglés */}
                    <div className="group">
                      <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 transition-colors group-focus-within:text-[#003b5c]">
                        {isSpanish ? 'Título en Inglés (Recomendado)' : 'English Title (Recommended)'}
                        <HelpCapsule
                          title={isSpanish ? '¿Por qué en inglés?' : 'Why in English?'}
                          text={isSpanish
                            ? 'El inglés es el idioma internacional de la ciencia. Incluir un título en inglés aumenta la visibilidad de tu trabajo y permite que más investigadores lo encuentren en bases de datos internacionales.'
                            : 'English is the international language of science. Including an English title increases the visibility of your work and allows more researchers to find it in international databases.'}
                        />
                      </label>
                      <input 
                        type="text" 
                        name="titleEn" 
                        value={formData.titleEn} 
                        onChange={handleInputChange} 
                        className="w-full p-4 bg-slate-50/50 border-0 ring-1 ring-slate-200 rounded-xl text-lg font-serif text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#003b5c] transition-all shadow-sm"
                        placeholder={isSpanish ? 'English title...' : 'English title...'}
                      />
                    </div>

                    {/* Resumen */}
                    <div className="group">
                      <label className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 transition-colors group-focus-within:text-[#003b5c]">
                        <span className="flex items-center">
                          {isSpanish ? 'Resumen / Abstract' : 'Abstract'} 
                          <span className="text-red-500 ml-1">*</span>
                          <HelpCapsule
                            title={isSpanish ? '¿Cómo escribir un buen resumen?' : 'How to write a good abstract?'}
                            text={isSpanish
                              ? 'Tu resumen debe incluir: 1) Contexto del problema, 2) Objetivo de la investigación, 3) Metodología utilizada, 4) Resultados principales, 5) Conclusión breve. Máximo 250 palabras. Es lo primero que leen los evaluadores, ¡hazlo claro y conciso!'
                              : 'Your abstract should include: 1) Problem context, 2) Research objective, 3) Methodology used, 4) Main results, 5) Brief conclusion. Maximum 250 words. It is the first thing reviewers read, make it clear and concise!'}
                          />
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          {isSpanish ? 'Máx 250 palabras' : 'Max 250 words'}
                        </span>
                      </label>
                      <textarea 
                        name="abstract" 
                        value={formData.abstract} 
                        onChange={handleInputChange} 
                        rows={6}
                        className={`w-full p-4 bg-slate-50/50 border-0 ring-1 rounded-xl text-sm font-sans text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#003b5c] transition-all resize-y shadow-sm leading-relaxed
                          ${validationErrors.abstract ? 'ring-red-300' : 'ring-slate-200'}`}
                        placeholder={isSpanish ? 'Contexto, metodología, resultados principales y conclusiones...' : 'Context, methodology, main results and conclusions...'}
                      />
                      {validationErrors.abstract && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.abstract}</p>
                      )}
                    </div>

                    {/* Abstract en inglés */}
                    <div className="group">
                      <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 transition-colors group-focus-within:text-[#003b5c]">
                        {isSpanish ? 'Abstract en Inglés' : 'English Abstract'}
                        <HelpCapsule
                          title={isSpanish ? '¿Es obligatorio?' : 'Is it mandatory?'}
                          text={isSpanish
                            ? 'Es altamente recomendado. Traduce tu resumen al inglés para maximizar la difusión internacional. No uses traductores automáticos sin revisar; pide ayuda a alguien con buen nivel de inglés académico.'
                            : 'It is highly recommended. Translate your abstract to English to maximize international dissemination. Do not use automatic translators without review; ask someone with good academic English level for help.'}
                        />
                      </label>
                      <textarea 
                        name="abstractEn" 
                        value={formData.abstractEn} 
                        onChange={handleInputChange} 
                        rows={6}
                        className="w-full p-4 bg-slate-50/50 border-0 ring-1 ring-slate-200 rounded-xl text-sm font-sans text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#003b5c] transition-all resize-y shadow-sm leading-relaxed"
                        placeholder="English abstract..."
                      />
                    </div>

                    {/* Comentarios al editor */}
                    <div className="group">
                      <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                        {isSpanish ? 'Comentarios al Editor' : 'Comments to the Editor'}
                        <HelpCapsule
                          title={isSpanish ? '¿Qué debo escribir aquí?' : 'What should I write here?'}
                          text={isSpanish
                            ? 'Explica brevemente por qué tu tema es relevante y merece ser considerado para publicación. No es una carta larga, solo un párrafo conciso. Menciona si tu trabajo tiene implicaciones prácticas o contribuye a resolver un problema importante.'
                            : 'Briefly explain why your topic is relevant and deserves consideration for publication. This is not a long letter, just a concise paragraph. Mention if your work has practical implications or contributes to solving an important problem.'}
                        />
                      </label>
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 focus-within:border-[#003b5c] transition-colors">
                        <ReactQuill
                          theme="snow"
                          value={formData.editorComment}
                          onChange={(value) => setFormData(prev => ({ ...prev, editorComment: value }))}
                          placeholder={isSpanish ? 'Comentarios para el equipo editorial...' : 'Comments for the editorial team...'}
                          modules={{
                            toolbar: [
                              ['bold', 'italic', 'underline'],
                              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                              ['clean']
                            ]
                          }}
                          formats={['bold', 'italic', 'underline', 'list', 'bullet']}
                          className="font-serif text-sm"
                          style={{ height: '160px' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tipo de artículo y área */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                        {isSpanish ? 'Tipo de Artículo' : 'Article Type'} 
                        <span className="text-red-500 ml-1">*</span>
                        <HelpCapsule
                          title={isSpanish ? '¿Qué tipo de artículo es el tuyo?' : 'What type of article is yours?'}
                          text={isSpanish
                            ? 'Elige la categoría que mejor describa tu trabajo: Investigación Original (datos nuevos), Revisión (análisis de literatura existente), Ensayo (reflexión académica), Reporte de Caso (estudio de caso único), o Reseña (crítica de un libro).'
                            : 'Choose the category that best describes your work: Original Research (new data), Review (analysis of existing literature), Essay (academic reflection), Case Report (single case study), or Book Review (critique of a book).'}
                        />
                      </label>
                      <select
                        name="articleType"
                        value={formData.articleType}
                        onChange={handleInputChange}
                        className={`w-full p-3.5 border-0 ring-1 rounded-xl text-sm font-sans focus:ring-2 focus:ring-[#003b5c] outline-none appearance-none bg-white transition-all
                          ${validationErrors.articleType ? 'ring-red-300' : 'ring-slate-200 text-slate-600'}`}
                      >
                        <option value="">— {isSpanish ? 'Seleccionar tipo...' : 'Select type...'} —</option>
                        {articleTypeOptions[isSpanish ? 'es' : 'en'].map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {validationErrors.articleType && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.articleType}</p>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                        {isSpanish ? 'Área Temática' : 'Subject Area'} 
                        <span className="text-red-500 ml-1">*</span>
                        <HelpCapsule
                          title={isSpanish ? '¿Qué área elegir?' : 'What area to choose?'}
                          text={isSpanish
                            ? 'Selecciona el área que mejor se ajuste a tu investigación. Esto ayuda a asignar los revisores adecuados y a indexar tu artículo correctamente. Si tu trabajo es interdisciplinario, elige el área principal.'
                            : 'Select the area that best fits your research. This helps assign appropriate reviewers and index your article correctly. If your work is interdisciplinary, choose the main area.'}
                        />
                      </label>
                      <select
                        name="area"
                        value={formData.area}
                        onChange={handleInputChange}
                        className={`w-full p-3.5 border-0 ring-1 rounded-xl text-sm font-sans focus:ring-2 focus:ring-[#003b5c] outline-none appearance-none bg-white transition-all
                          ${validationErrors.area ? 'ring-red-300' : 'ring-slate-200 text-slate-600'}`}
                      >
                        <option value="">— {isSpanish ? 'Seleccionar área...' : 'Select area...'} —</option>
                        {Object.entries(getAreasByLanguage(language)).map(([categoria, subareas]) => (
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
                  </div>

                  {/* Palabras clave */}
                  <div className="space-y-8">
                    <div>
                      <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                        {isSpanish ? 'Palabras Clave (Español)' : 'Keywords (Spanish)'} 
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      <ControlledKeywordInput
                        vocabularyConfig={getVocabularyForArea(formData.area, language) || {}}
                        value={formData.keywordsEs}
                        onChange={(val) => {
                          setFormData(prev => ({ ...prev, keywordsEs: val }));
                          setValidationErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.controlledKeywords;
                            return newErrors;
                          });
                        }}
                        language={language}
                        mode="keywords"
                      />
                      {validationErrors.controlledKeywords && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.controlledKeywords}</p>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                        {isSpanish ? 'Keywords (Inglés)' : 'Keywords (English)'} 
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      <ControlledKeywordInput
                        vocabularyConfig={getVocabularyForArea(formData.area, language) || {}}
                        value={formData.keywordsEn}
                        onChange={(val) => setFormData(prev => ({ ...prev, keywordsEn: val }))}
                        language={language}
                        mode="keywords"
                      />
                    </div>
                  </div>
{/* Códigos especializados - SOLO si hay área seleccionada con vocabulario */}
{formData.area && getVocabularyForArea(formData.area, language) ? (
  <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-6 ring-1 ring-slate-200/60 shadow-sm">
    <div className="flex items-center gap-2 mb-4">
      <div className="w-10 h-10 bg-[#003b5c]/5 rounded-lg flex items-center justify-center">
        <svg className="w-5 h-5 text-[#003b5c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" />
        </svg>
      </div>
      <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-600">
        {isSpanish ? 'Códigos Especializados' : 'Specialized Codes'}
        <HelpCapsule
          title={isSpanish ? '¿Qué son los códigos especializados?' : 'What are specialized codes?'}
          text={isSpanish
            ? `Son códigos estandarizados del vocabulario ${getVocabularyForArea(formData.area, language)?.vocabulario || ''}. Solo necesitas ingresar el código (ej: ${getVocabularyForArea(formData.area, language)?.ejemplo?.split(':')[0] || getVocabularyForArea(formData.area, language)?.ejemplo || ''}). No incluyas el término completo. Debes agregar entre 2 y 4 códigos.`
            : `These are standardized codes from the ${getVocabularyForArea(formData.area, language)?.vocabulario || ''} vocabulary. You only need to enter the code (e.g., ${getVocabularyForArea(formData.area, language)?.ejemplo?.split(':')[0] || getVocabularyForArea(formData.area, language)?.ejemplo || ''}). Do not include the full term. You must add between 2 and 4 codes.`}
        />
      </label>
    </div>
    
    <ControlledKeywordInput
      vocabularyConfig={getVocabularyForArea(formData.area, language)}
      value={formData.specializedCodes}
      onChange={(val) => {
        setFormData(prev => ({ ...prev, specializedCodes: val }));
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.specializedCodes;
          return newErrors;
        });
      }}
      language={language}
      mode="codes"
    />
    
    {validationErrors.specializedCodes && (
      <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {validationErrors.specializedCodes}
      </p>
    )}
  </div>
) : (
  <div className="bg-slate-50/50 rounded-xl p-6 text-center border-2 border-dashed border-slate-200">
    <div className="flex flex-col items-center gap-3">
      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      </div>
      <p className="text-slate-500 text-sm font-sans">
        {isSpanish 
          ? 'Selecciona un área temática para ver los códigos especializados disponibles.'
          : 'Select a subject area to see available specialized codes.'}
      </p>
    </div>
  </div>
)}
                  {/* Idioma del manuscrito */}
                  <div>
                    <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      {isSpanish ? 'Idioma del Manuscrito' : 'Manuscript Language'} 
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <select
                      name="paperLanguage"
                      value={formData.paperLanguage}
                      onChange={handleInputChange}
                      className="w-full p-3.5 border-0 ring-1 ring-slate-200 rounded-xl text-sm font-sans text-slate-600 focus:ring-2 focus:ring-[#003b5c] outline-none appearance-none bg-white transition-all"
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
                  initial={{ opacity: 0, x: 20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0, x: -20 }} 
                  className="space-y-10"
                >
                  <div className="border-b border-slate-100 pb-4 mb-8">
                    <h2 className="text-2xl font-serif text-[#003b5c] font-medium">
                      {isSpanish ? 'Autores y Ética' : 'Authors & Ethics'}
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                      {isSpanish ? 'Incluya a todos los autores que contribuyeron significativamente al trabajo.' : 'Include all authors who significantly contributed to the work.'}
                    </p>
                  </div>

                  {/* Sección de autores */}
                  <div className="space-y-6">
                    {formData.authors.map((author, index) => (
                      <div key={index} className="bg-slate-50/50 rounded-xl p-6 ring-1 ring-slate-200/60 relative">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-serif font-bold text-[#003b5c] text-sm">
                            {isSpanish ? `Autor ${index + 1}` : `Author ${index + 1}`}
                          </h3>
                          {index > 0 && (
                            <button
                              type="button"
                              onClick={() => removeAuthor(index)}
                              className="text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                              {isSpanish ? 'Nombre' : 'First name'} *
                            </label>
                            <input
                              type="text"
                              value={author.firstName}
                              onChange={(e) => handleAuthorChange(index, 'firstName', e.target.value)}
                              className={`w-full p-3 bg-white border-0 ring-1 rounded-lg text-sm focus:ring-2 focus:ring-[#003b5c] outline-none transition-all
                                ${validationErrors[`author_${index}_firstName`] ? 'ring-red-300' : 'ring-slate-200'}`}
                            />
                            {validationErrors[`author_${index}_firstName`] && (
                              <p className="text-red-500 text-xs mt-1">{validationErrors[`author_${index}_firstName`]}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                              {isSpanish ? 'Apellido' : 'Last name'} *
                            </label>
                            <input
                              type="text"
                              value={author.lastName}
                              onChange={(e) => handleAuthorChange(index, 'lastName', e.target.value)}
                              className={`w-full p-3 bg-white border-0 ring-1 rounded-lg text-sm focus:ring-2 focus:ring-[#003b5c] outline-none transition-all
                                ${validationErrors[`author_${index}_lastName`] ? 'ring-red-300' : 'ring-slate-200'}`}
                            />
                            {validationErrors[`author_${index}_lastName`] && (
                              <p className="text-red-500 text-xs mt-1">{validationErrors[`author_${index}_lastName`]}</p>
                            )}
                          </div>
                          <div>
                            <label className="flex items-center text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                              {isSpanish ? 'Institución' : 'Institution'} *
                              <HelpCapsule
                                title={isSpanish ? '¿Qué institución pongo?' : 'What institution do I put?'}
                                text={isSpanish
                                  ? 'Escribe el nombre completo de tu escuela, universidad o centro de investigación. Si no estás afiliado a ninguna institución, escribe "Investigador independiente".'
                                  : 'Write the full name of your school, university, or research center. If you are not affiliated with any institution, write "Independent researcher".'}
                              />
                            </label>
                            <input
                              type="text"
                              value={author.institution}
                              onChange={(e) => handleAuthorChange(index, 'institution', e.target.value)}
                              className={`w-full p-3 bg-white border-0 ring-1 rounded-lg text-sm focus:ring-2 focus:ring-[#003b5c] outline-none transition-all
                                ${validationErrors[`author_${index}_institution`] ? 'ring-red-300' : 'ring-slate-200'}`}
                            />
                            {validationErrors[`author_${index}_institution`] && (
                              <p className="text-red-500 text-xs mt-1">{validationErrors[`author_${index}_institution`]}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                              {isSpanish ? 'Email' : 'Email'} *
                            </label>
                            <input
                              type="email"
                              value={author.email}
                              onChange={(e) => handleAuthorChange(index, 'email', e.target.value)}
                              className={`w-full p-3 bg-white border-0 ring-1 rounded-lg text-sm focus:ring-2 focus:ring-[#003b5c] outline-none transition-all
                                ${validationErrors[`author_${index}_email`] ? 'ring-red-300' : 'ring-slate-200'}`}
                            />
                            {validationErrors[`author_${index}_email`] && (
                              <p className="text-red-500 text-xs mt-1">{validationErrors[`author_${index}_email`]}</p>
                            )}
                          </div>
{author.isCorresponding && (
  <div className="md:col-span-2">
    <label className="flex items-center text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
      {isSpanish ? 'Teléfono de contacto' : 'Contact phone'}
      <span className="text-red-500 ml-1">*</span>
    </label>

    <PhoneInput
      international
      defaultCountry="CL"
      value={author.phone || undefined}
      onChange={(value) => handleAuthorChange(index, 'phone', value || '')}
      className={`PhoneInput ${validationErrors[`author_${index}_phone`] ? 'PhoneInput--error' : ''}`}
    />

    {validationErrors[`author_${index}_phone`] && (
      <p className="text-red-500 text-xs mt-1.5">
        {validationErrors[`author_${index}_phone`]}
      </p>
    )}
  </div>
)}
                          <div>
                            <label className="flex items-center text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                              ORCID
                              <HelpCapsule
                                title={isSpanish ? '¿Qué es ORCID?' : 'What is ORCID?'}
                                text={isSpanish
                                  ? 'ORCID es un identificador digital único para investigadores. Si no tienes uno, puedes registrarte gratis en orcid.org. Ayuda a distinguirte de otros investigadores con nombres similares.'
                                  : 'ORCID is a unique digital identifier for researchers. If you do not have one, you can register for free at orcid.org. It helps distinguish you from other researchers with similar names.'}
                              />
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={author.orcid}
                                onChange={(e) => handleAuthorChange(index, 'orcid', e.target.value)}
                                placeholder="0000-0000-0000-0000"
                                className="flex-1 p-3 bg-white border-0 ring-1 ring-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#003b5c] outline-none transition-all"
                              />
                              {user && (
                                <button
                                  type="button"
                                  onClick={() => handleImportMyProfile(index)}
                                  className="px-3 py-2 bg-[#003b5c] hover:bg-[#002b44] text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 whitespace-nowrap"
                                >
                                  <UserIcon className="w-3 h-3" />
                                  {isSpanish ? 'Yo' : 'Me'}
                                </button>
                              )}
                            </div>
                          </div>
                                                    {/* Contribución - SOLO si hay más de un autor */}
                          {formData.authors.length > 1 ? (
                            <div>
                              <label className="flex items-center text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                {isSpanish ? 'Contribución (CRediT)' : 'Contribution (CRediT)'} *
                                <HelpCapsule
                                  title={isSpanish ? '¿Qué es el formato CRediT?' : 'What is the CRediT format?'}
                                  text={isSpanish
                                    ? 'CRediT (Contributor Roles Taxonomy) es un estándar internacional que define 14 roles específicos de contribución científica: Conceptualización, Curación de datos, Análisis formal, Adquisición de fondos, Investigación, Metodología, Administración del proyecto, Recursos, Software, Supervisión, Validación, Visualización, Redacción - borrador original, Redacción - revisión y edición. Solo necesitas completar este campo cuando hay múltiples autores, para dejar claro qué hizo cada uno. Ejemplo: "Conceptualización, Metodología, Análisis formal, Redacción - borrador original".'
                                    : 'CRediT (Contributor Roles Taxonomy) is an international standard that defines 14 specific scientific contribution roles: Conceptualization, Data curation, Formal analysis, Funding acquisition, Investigation, Methodology, Project administration, Resources, Software, Supervision, Validation, Visualization, Writing - original draft, Writing - review & editing. You only need to complete this field when there are multiple authors, to make clear what each one did. Example: "Conceptualization, Methodology, Formal analysis, Writing - original draft".'}
                                />
                              </label>
                              <textarea
                                value={author.contribution}
                                onChange={(e) => handleAuthorChange(index, 'contribution', e.target.value)}
                                rows={3}
                                className={`w-full p-3 bg-white border-0 ring-1 rounded-lg text-sm focus:ring-2 focus:ring-[#003b5c] outline-none transition-all resize-y
                                  ${validationErrors[`author_${index}_contribution`] ? 'ring-red-300' : 'ring-slate-200'}`}
                                placeholder={isSpanish 
                                  ? 'Ej: Conceptualización, Metodología, Análisis formal, Redacción - borrador original' 
                                  : 'e.g., Conceptualization, Methodology, Formal analysis, Writing - original draft'}
                              />
                              {validationErrors[`author_${index}_contribution`] && (
                                <p className="text-red-500 text-xs mt-1">{validationErrors[`author_${index}_contribution`]}</p>
                              )}
                              <p className="text-[10px] text-slate-400 mt-1 font-sans">
                                {isSpanish 
                                  ? 'Separa los roles con comas. Usa los términos estándar CRediT.'
                                  : 'Separate roles with commas. Use standard CRediT terms.'}
                              </p>
                            </div>
                          ) : (
                            <div className="bg-slate-100 rounded-lg p-4 text-xs text-slate-500 font-sans flex items-start gap-3">
                              <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <p className="font-semibold text-slate-600 mb-1">
                                  {isSpanish ? 'Autor único' : 'Single author'}
                                </p>
                                <p>
                                  {isSpanish 
                                    ? 'La contribución CRediT solo es necesaria cuando hay más de un autor. Al ser el único autor, se asume que realizaste todas las etapas del trabajo.'
                                    : 'CRediT contribution is only required when there are multiple authors. As the sole author, it is assumed you performed all stages of the work.'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Menor de edad */}
                        <div className="mt-6 pt-4 border-t border-slate-200">
                          <label className="flex items-center gap-3 cursor-pointer">
  <input
    type="checkbox"
    checked={author.isMinor}
    onChange={(e) => {
      const isMinor = e.target.checked;
      const newAuthors = [...formData.authors];
      newAuthors[index] = {
        ...newAuthors[index],
        isMinor: isMinor,
        guardianName: isMinor ? newAuthors[index].guardianName : '',
        consentMethod: isMinor ? newAuthors[index].consentMethod : 'none',
        consentFile: isMinor ? newAuthors[index].consentFile : null
      };
      setFormData(prev => ({ ...prev, authors: newAuthors }));
    }}
    className="w-4 h-4 text-[#003b5c] rounded"
  />
  <span className="text-sm text-slate-700 font-sans">
    {isSpanish ? 'Este autor es menor de edad' : 'This author is a minor'}
  </span>
  <HelpCapsule
    title={isSpanish ? '¿Qué significa ser menor?' : 'What does being a minor mean?'}
    text={isSpanish
      ? 'Si alguno de los autores tiene menos de 18 años, debe marcarse esta casilla. Se requerirá autorización de un tutor legal para poder publicar el artículo.'
      : 'If any of the authors is under 18 years old, this box must be checked. Authorization from a legal guardian will be required to publish the article.'}
  />
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
                        <div className="mt-4">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={author.isCorresponding}
                              onChange={(e) => handleAuthorChange(index, 'isCorresponding', e.target.checked)}
                              className="w-4 h-4 text-[#003b5c] rounded"
                            />
                            <span className="text-sm text-slate-700 font-sans">
                              {isSpanish ? 'Autor de correspondencia' : 'Corresponding author'}
                            </span>
                            <HelpCapsule
                              title={isSpanish ? '¿Quién es el autor de correspondencia?' : 'Who is the corresponding author?'}
                              text={isSpanish
                                ? 'Es el autor que recibirá todas las comunicaciones de la revista. Debe ser alguien que revise su correo regularmente. Generalmente es el primer autor o el supervisor del proyecto.'
                                : 'This is the author who will receive all communications from the journal. They should be someone who checks their email regularly. Usually the first author or project supervisor.'}
                            />
                          </label>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addAuthor}
                      className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-[#003b5c] hover:text-[#003b5c] transition-colors font-sans text-sm"
                    >
                      + {isSpanish ? 'Agregar otro autor' : 'Add another author'}
                    </button>
                  </div>

                  {/* Financiación */}
                  <div className="bg-slate-50/50 rounded-xl p-6 ring-1 ring-slate-200/60">
                    <h3 className="font-serif font-bold text-[#003b5c] mb-4">
                      {isSpanish ? 'Financiación' : 'Funding'}
                    </h3>
                    <label className="flex items-center gap-3 mb-4">
                      <input
                        type="checkbox"
                        name="funding.hasFunding"
                        checked={formData.funding.hasFunding}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-[#003b5c] rounded"
                      />
                      <span className="text-sm text-slate-700 font-sans">
                        {isSpanish ? 'Este trabajo recibió financiación externa' : 'This work received external funding'}
                      </span>
                    </label>

                    {formData.funding.hasFunding && (
                      <div className="pl-7 space-y-4">
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block font-sans uppercase tracking-wider">
                            {isSpanish ? 'Entidad financiadora' : 'Funding entity'}
                          </label>
                          <input
                            type="text"
                            name="funding.sources"
                            value={formData.funding.sources}
                            onChange={handleInputChange}
                            className="w-full p-3 bg-white border-0 ring-1 ring-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#003b5c] outline-none transition-all"
                            placeholder={isSpanish ? 'FONDECYT, ANID...' : 'NSF, NIH...'}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block font-sans uppercase tracking-wider">
                            {isSpanish ? 'Código(s) de la subvención' : 'Grant number(s)'}
                          </label>
                          <input
                            type="text"
                            name="funding.grantNumbers"
                            value={formData.funding.grantNumbers}
                            onChange={handleInputChange}
                            className="w-full p-3 bg-white border-0 ring-1 ring-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#003b5c] outline-none transition-all"
                            placeholder="123456, 789012"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Conflicto de intereses */}
                  <div className="bg-slate-50/50 rounded-xl p-6 ring-1 ring-slate-200/60">
                    <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      {isSpanish ? 'Conflicto de Intereses' : 'Conflict of Interest'}
                      <HelpCapsule
                        title={isSpanish ? '¿Qué es un conflicto de intereses?' : 'What is a conflict of interest?'}
                        text={isSpanish
                          ? 'Un conflicto de intereses existe cuando un autor tiene intereses personales o financieros que podrían influir en su investigación. Si no tienes ninguno, escribe: "Los autores declaran no tener conflictos de interés".'
                          : 'A conflict of interest exists when an author has personal or financial interests that could influence their research. If you have none, write: "The authors declare no conflicts of interest."'}
                      />
                    </label>
                    <textarea
                      name="conflictOfInterest"
                      value={formData.conflictOfInterest}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full p-3 bg-white border-0 ring-1 ring-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#003b5c] outline-none transition-all resize-y"
                      placeholder={isSpanish ? 'Los autores declaran no tener conflictos de interés.' : 'The authors declare no conflicts of interest.'}
                    />
                  </div>

                  {/* Aprobación ética */}
                  <div className="bg-slate-50/50 rounded-xl p-6 ring-1 ring-slate-200/60">
                    <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      {isSpanish ? 'Aprobación Ética' : 'Ethics Approval'}
                      <HelpCapsule
                        title={isSpanish ? '¿Necesito aprobación ética?' : 'Do I need ethics approval?'}
                        text={isSpanish
                          ? 'Si tu investigación involucra personas, animales o datos sensibles, probablemente necesitas aprobación de un comité de ética. Si es un ensayo teórico o revisión sin datos nuevos, generalmente no aplica.'
                          : 'If your research involves people, animals, or sensitive data, you probably need approval from an ethics committee. If it is a theoretical essay or review without new data, it generally does not apply.'}
                      />
                    </label>
                    <select
                      name="requiresEthicsApproval"
                      value={formData.requiresEthicsApproval}
                      onChange={handleInputChange}
                      className="w-full p-3 border-0 ring-1 ring-slate-200 rounded-lg text-sm font-sans text-slate-600 focus:ring-2 focus:ring-[#003b5c] outline-none appearance-none bg-white mb-4 transition-all"
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
                        <input
                          type="text"
                          name="ethicsCommitteeName"
                          value={formData.ethicsCommitteeName}
                          onChange={handleInputChange}
                          className="w-full p-3 bg-white border-0 ring-1 ring-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#003b5c] outline-none transition-all"
                          placeholder={isSpanish ? 'Comité de Ética Universidad X, Acta 123, 01/2024' : 'Ethics Committee University X, Protocol 123, 01/2024'}
                        />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* PASO 3: DECLARACIONES Y ENVÍO */}
              {currentStep === 3 && (
                <motion.div 
                  key="step3" 
                  initial={{ opacity: 0, x: 20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0, x: -20 }} 
                  className="space-y-10"
                >
                  <div className="border-b border-slate-100 pb-4 mb-8">
                    <h2 className="text-2xl font-serif text-[#003b5c] font-medium">
                      {isSpanish ? 'Declaraciones Finales' : 'Final Declarations'}
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                      {isSpanish ? 'Requisito obligatorio para el proceso de revisión por pares.' : 'Mandatory requirement for the peer review process.'}
                    </p>
                  </div>

                  {/* Uso de IA */}
                  <div className="bg-slate-50/50 rounded-xl p-6 ring-1 ring-slate-200/60">
                    <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      {isSpanish ? 'Uso de Inteligencia Artificial' : 'Use of Artificial Intelligence'}
                      <HelpCapsule
                        title={isSpanish ? '¿Debo declarar uso de IA?' : 'Should I declare AI use?'}
                        text={isSpanish
                          ? 'Sé transparente sobre el uso de herramientas de IA. Si usaste ChatGPT u otra IA para redactar, analizar datos o generar código, decláralo. La transparencia es fundamental para la integridad científica.'
                          : 'Be transparent about the use of AI tools. If you used ChatGPT or other AI to write, analyze data, or generate code, declare it. Transparency is fundamental for scientific integrity.'}
                      />
                    </label>
                    <select
                      name="aiUsed"
                      value={formData.aiUsed}
                      onChange={handleInputChange}
                      className="w-full p-3 border-0 ring-1 ring-slate-200 rounded-lg text-sm font-sans text-slate-600 focus:ring-2 focus:ring-[#003b5c] outline-none appearance-none bg-white mb-4 transition-all"
                    >
                      <option value="no">{isSpanish ? 'No se utilizó IA en este trabajo' : 'AI was not used in this work'}</option>
                      <option value="yes">{isSpanish ? 'Sí, se utilizó IA en este trabajo' : 'Yes, AI was used in this work'}</option>
                    </select>

                    {formData.aiUsed === 'yes' && (
  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4">
    {formData.aiTools.map((tool, index) => (
      <div key={index} className="bg-white rounded-lg p-4 ring-1 ring-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Campo 1: Nombre de la herramienta */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {isSpanish ? 'Herramienta' : 'Tool'} *
            </label>
            <input
              type="text"
              value={tool.name}
              onChange={(e) => handleAIToolChange(index, 'name', e.target.value)}
              placeholder="ChatGPT, Claude, Gemini..."
              className="w-full p-2.5 bg-white border-0 ring-1 ring-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#003b5c] outline-none transition-all"
            />
          </div>
          
          {/* Campo 2: Versión (SEPARADO) */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {isSpanish ? 'Versión' : 'Version'}
            </label>
            <input
              type="text"
              value={tool.version}
              onChange={(e) => handleAIToolChange(index, 'version', e.target.value)}
              placeholder="GPT-4, Claude 3.5, etc."
              className="w-full p-2.5 bg-white border-0 ring-1 ring-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#003b5c] outline-none transition-all"
            />
          </div>
          
          {/* Campo 3: Propósito */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {isSpanish ? 'Propósito' : 'Purpose'} *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tool.purpose}
                onChange={(e) => handleAIToolChange(index, 'purpose', e.target.value)}
                placeholder={isSpanish ? 'Análisis de datos' : 'Data analysis'}
                className="flex-1 p-2.5 bg-white border-0 ring-1 ring-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#003b5c] outline-none transition-all"
              />
              {formData.aiTools.length > 1 && (
                <button 
                  type="button" 
                  onClick={() => removeAITool(index)} 
                  className="text-slate-400 hover:text-red-500 p-2 transition-colors flex-shrink-0"
                  title={isSpanish ? 'Eliminar herramienta' : 'Remove tool'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    ))}
    <button
      type="button"
      onClick={addAITool}
      className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-[#003b5c] hover:text-[#003b5c] transition-colors font-sans text-sm"
    >
      + {isSpanish ? 'Agregar otra herramienta' : 'Add another tool'}
    </button>
  </motion.div>
)}
                  </div>

                  {/* Disponibilidad de datos */}
                  <div className="bg-slate-50/50 rounded-xl p-6 ring-1 ring-slate-200/60">
                    <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      {isSpanish ? 'Disponibilidad de Datos' : 'Data Availability'} *
                      <HelpCapsule
                        title={isSpanish ? '¿Qué es la disponibilidad de datos?' : 'What is data availability?'}
                        text={isSpanish
                          ? 'Indica dónde pueden otros investigadores acceder a tus datos. Esto promueve la transparencia y reproducibilidad de tu investigación. Si no tienes datos nuevos (ensayo teórico), selecciona "No aplica".'
                          : 'Indicate where other researchers can access your data. This promotes transparency and reproducibility of your research. If you have no new data (theoretical essay), select "Not applicable".'}
                      />
                    </label>
                    <select
                      name="dataAvailability"
                      value={formData.dataAvailability}
                      onChange={handleInputChange}
                      className={`w-full p-3 border-0 ring-1 rounded-lg text-sm font-sans focus:ring-2 focus:ring-[#003b5c] outline-none appearance-none bg-white mb-3 transition-all
                        ${validationErrors.dataAvailability ? 'ring-red-300' : 'ring-slate-200 text-slate-600'}`}
                    >
                      <option value="">— {isSpanish ? 'Selecciona una opción' : 'Select an option'} —</option>
                      {availabilityOptions[isSpanish ? 'es' : 'en'].map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    {validationErrors.dataAvailability && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.dataAvailability}</p>
                    )}
                  </div>

                  {/* Declaraciones obligatorias */}
                  <div className="bg-slate-50/50 rounded-xl p-6 ring-1 ring-slate-200/60">
                    <h3 className="font-serif font-bold text-[#003b5c] mb-4">
                      {isSpanish ? 'Declaraciones Obligatorias' : 'Mandatory Declarations'}
                    </h3>
                    <div className="space-y-4">
                      {[
                        { key: 'originalAndSimilarity', 
                          title: isSpanish ? 'Originalidad y Similitud' : 'Originality and Similarity',
                          desc: isSpanish ? 'El manuscrito es inédito y la superposición textual no excede el 15%.' : 'The manuscript is unpublished and textual overlap does not exceed 15%.',
                          help: isSpanish ? 'Esto significa que tu trabajo no ha sido publicado antes y no es muy similar a otros trabajos existentes.' : 'This means your work has not been published before and is not very similar to other existing works.' },
                        { key: 'exclusiveSubmission', 
                          title: isSpanish ? 'Envío Exclusivo' : 'Exclusive Submission',
                          desc: isSpanish ? 'El manuscrito no está siendo evaluado simultáneamente en otra revista.' : 'The manuscript is not being simultaneously evaluated in another journal.',
                          help: isSpanish ? 'No puedes enviar el mismo artículo a dos revistas al mismo tiempo. Es una práctica no ética.' : 'You cannot submit the same article to two journals at the same time. It is an unethical practice.' },
                        { key: 'authorshipCriteria', 
                          title: isSpanish ? 'Criterios de Autoría' : 'Authorship Criteria',
                          desc: isSpanish ? 'Todos los autores cumplen los criterios de autoría y sus roles están declarados.' : 'All authors meet authorship criteria and their roles are declared.',
                          help: isSpanish ? 'Solo deben aparecer como autores quienes realmente contribuyeron significativamente al trabajo.' : 'Only those who really contributed significantly to the work should appear as authors.' },
                        { key: 'dataAuthentic', 
                          title: isSpanish ? 'Datos Auténticos' : 'Authentic Data',
                          desc: isSpanish ? 'Los datos son auténticos y no han sido manipulados.' : 'The data are authentic and have not been manipulated.',
                          help: isSpanish ? 'Los datos presentados deben ser reales. Manipular o fabricar datos es una falta grave a la ética científica.' : 'The data presented must be real. Manipulating or fabricating data is a serious breach of scientific ethics.' },
                        { key: 'informedConsent', 
                          title: isSpanish ? 'Consentimiento Informado' : 'Informed Consent',
                          desc: isSpanish ? 'Se obtuvo consentimiento cuando fue necesario.' : 'Consent was obtained when necessary.',
                          help: isSpanish ? 'Si tu investigación involucra personas, debes haber obtenido su permiso informado.' : 'If your research involves people, you must have obtained their informed permission.' },
                        { key: 'aiDisclosure', 
                          title: isSpanish ? 'Divulgación de IA' : 'AI Disclosure',
                          desc: isSpanish ? 'El uso de IA ha sido declarado en el formulario y manuscrito.' : 'AI use has been declared in the form and manuscript.',
                          help: isSpanish ? 'Sé transparente sobre cualquier herramienta de IA que hayas utilizado en tu investigación.' : 'Be transparent about any AI tools you have used in your research.' },
                        { key: 'conflicts', 
                          title: isSpanish ? 'Conflictos de Interés' : 'Conflicts of Interest',
                          desc: isSpanish ? 'Todos los conflictos de interés están declarados.' : 'All conflicts of interest are declared.',
                          help: isSpanish ? 'Declara cualquier interés personal o financiero que pueda influir en tu trabajo.' : 'Declare any personal or financial interest that may influence your work.' },
                      ].map((decl) => {
                        const isChecked = formData.declarations[decl.key];
                        return (
                          <label key={decl.key} className={`group relative flex items-start p-5 cursor-pointer rounded-xl transition-all duration-300 transform hover:-translate-y-0.5
                            ${isChecked ? 'bg-[#003b5c]/5 ring-2 ring-[#003b5c] shadow-md' : 'bg-white ring-1 ring-slate-200 shadow-sm hover:shadow-md'}`}>
                            <div className="flex items-center h-6 mr-4 mt-0.5">
                              <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={isChecked} 
                                onChange={() => handleDeclarationChange(decl.key)} 
                              />
                              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors
                                ${isChecked ? 'bg-[#003b5c] border-[#003b5c]' : 'bg-white border-slate-300 group-hover:border-[#003b5c]/50'}`}>
                                <svg className={`w-4 h-4 text-white transition-transform duration-300 ${isChecked ? 'scale-100' : 'scale-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className={`text-sm font-bold tracking-wide transition-colors ${isChecked ? 'text-[#003b5c]' : 'text-slate-800'}`}>
                                  {decl.title}
                                </h4>
                                <HelpCapsule
                                  title={decl.title}
                                  text={decl.help}
                                />
                              </div>
                              <p className="mt-1 text-xs text-slate-500 font-sans leading-relaxed">
                                {decl.desc}
                              </p>
                            </div>
                          </label>
                        );
                      })}

                      {/* Licencia CC-BY */}
                      <label className={`group relative flex items-start p-5 cursor-pointer rounded-xl transition-all duration-300 transform hover:-translate-y-0.5
                        ${formData.declarations.ccByLicense ? 'bg-[#003b5c]/5 ring-2 ring-[#003b5c] shadow-md' : 'bg-white ring-1 ring-slate-200 shadow-sm hover:shadow-md'}`}>
                        <div className="flex items-center h-6 mr-4 mt-0.5">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={formData.declarations.ccByLicense} 
                            onChange={() => handleDeclarationChange('ccByLicense')} 
                          />
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors
                            ${formData.declarations.ccByLicense ? 'bg-[#003b5c] border-[#003b5c]' : 'bg-white border-slate-300 group-hover:border-[#003b5c]/50'}`}>
                            <svg className={`w-4 h-4 text-white transition-transform duration-300 ${formData.declarations.ccByLicense ? 'scale-100' : 'scale-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold tracking-wide">
                              {isSpanish ? 'Licencia Creative Commons CC-BY 4.0' : 'Creative Commons CC-BY 4.0 License'}
                            </h4>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#e86125]/10 text-[#e86125] uppercase">
                              Open Access
                            </span>
                            <HelpCapsule
                              title={isSpanish ? '¿Qué es CC-BY 4.0?' : 'What is CC-BY 4.0?'}
                              text={isSpanish
                                ? 'Esta licencia permite que otros compartan y adapten tu trabajo, incluso con fines comerciales, siempre que te den crédito. Es la licencia más abierta y la que promueve la revista.'
                                : 'This license allows others to share and adapt your work, even for commercial purposes, as long as they give you credit. It is the most open license and the one promoted by the journal.'}
                            />
                          </div>
                          <p className="mt-1 text-xs text-slate-500 font-sans leading-relaxed">
                            {isSpanish
                              ? 'Al marcar esta casilla, acepto que el artículo, si es aceptado, se publique bajo la licencia de acceso abierto CC BY 4.0.'
                              : 'By checking this box, I agree that the article, if accepted, will be published under the CC BY 4.0 open access license.'}
                          </p>
                        </div>
                      </label>
                    </div>
                    {validationErrors.declarations && (
                      <p className="text-red-500 text-xs mt-2">{validationErrors.declarations}</p>
                    )}
                  </div>

                  {/* Subir manuscrito */}
                  <div className="bg-slate-50/50 rounded-xl p-6 ring-1 ring-slate-200/60">
                    <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      {isSpanish ? 'Manuscrito Anonimizado' : 'Anonymized Manuscript'} *
                      <HelpCapsule
                        title={isSpanish ? '¿Qué es un manuscrito anonimizado?' : 'What is an anonymized manuscript?'}
                        text={isSpanish
                          ? 'Debes subir tu manuscrito SIN nombres de autores ni afiliaciones. Esto permite una revisión por pares imparcial. Revisa que no haya metadatos con tu nombre en el documento.'
                          : 'You must upload your manuscript WITHOUT author names or affiliations. This allows impartial peer review. Check that there are no metadata with your name in the document.'}
                      />
                    </label>
                    <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors
                      ${validationErrors.manuscript ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white hover:border-[#003b5c]'}`}>
                      <input
                        type="file"
                        accept=".doc,.docx"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:bg-[#003b5c] file:text-white file:font-bold file:uppercase file:tracking-wider file:text-xs hover:file:bg-[#002b44] font-sans"
                      />
                      {formData.manuscriptName && (
                        <div className="mt-4 flex items-center justify-center gap-3 text-[#003b5c] text-sm font-sans bg-green-50 px-4 py-2 rounded-lg">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {formData.manuscriptName}
                        </div>
                      )}
                    </div>
                    {validationErrors.manuscript && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.manuscript}</p>
                    )}
                  </div>

                  {/* Agradecimientos */}
                  <div className="bg-slate-50/50 rounded-xl p-6 ring-1 ring-slate-200/60">
                    <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      {isSpanish ? 'Agradecimientos' : 'Acknowledgments'} (opcional)
                      <HelpCapsule
                        title={isSpanish ? '¿A quién agradezco?' : 'Who do I thank?'}
                        text={isSpanish
                          ? 'Agradece a personas que ayudaron pero no son autores, o a instituciones que brindaron apoyo. Sé breve y específico.'
                          : 'Thank people who helped but are not authors, or institutions that provided support. Be brief and specific.'}
                      />
                    </label>
                    <textarea
                      name="acknowledgments"
                      value={formData.acknowledgments}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full p-3 bg-white border-0 ring-1 ring-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#003b5c] outline-none transition-all resize-y"
                      placeholder={isSpanish ? 'Agradecemos al Dr. Juan Pérez por sus comentarios...' : 'We thank Dr. John Smith for his comments...'}
                    />
                  </div>

                  {/* Revisores excluidos */}
                  <div className="bg-slate-50/50 rounded-xl p-6 ring-1 ring-slate-200/60">
                    <label className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      {isSpanish ? 'Revisores a Excluir' : 'Reviewers to Exclude'} (opcional)
                      <HelpCapsule
                        title={isSpanish ? '¿Por qué excluir revisores?' : 'Why exclude reviewers?'}
                        text={isSpanish
                          ? 'Si hay investigadores que podrían tener un conflicto de intereses con tu trabajo (por ejemplo, competidores directos), puedes solicitar que no revisen tu artículo. Separa los nombres con punto y coma.'
                          : 'If there are researchers who might have a conflict of interest with your work (e.g., direct competitors), you can request that they not review your article. Separate names with semicolons.'}
                      />
                    </label>
                    <input
                      type="text"
                      name="excludedReviewers"
                      value={formData.excludedReviewers}
                      onChange={handleInputChange}
                      className="w-full p-3 bg-white border-0 ring-1 ring-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#003b5c] outline-none transition-all"
                      placeholder={isSpanish ? 'Dra. Ana López; Dr. Carlos Mendoza' : 'Dr. Jane Smith; Prof. Michael Brown'}
                    />
                  </div>

                  {/* Postulación como revisor */}
                  <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-6 ring-1 ring-slate-200/60">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-[#003b5c] rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="font-serif text-lg font-bold text-[#003b5c] mb-2">
                          {isSpanish ? '¿Te gustaría ser revisor/a?' : 'Would you like to be a reviewer?'}
                        </h3>
                        <p className="text-sm text-slate-600 mb-5 font-sans leading-relaxed">
                          {isSpanish 
                            ? 'Nuestra revista busca constantemente revisores comprometidos. Si te interesa contribuir con tu experiencia, indícalo aquí. Esto no afecta la evaluación de tu artículo actual.'
                            : 'Our journal is constantly seeking committed reviewers. If you are interested in contributing with your expertise, please indicate it here. This does not affect the evaluation of your current article.'}
                        </p>

                        <label className="flex items-center gap-3 cursor-pointer group mb-5">
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={formData.wantsToBeReviewer}
                              onChange={(e) => {
                                setFormData(prev => ({
                                  ...prev,
                                  wantsToBeReviewer: e.target.checked,
                                  reviewerAreas: e.target.checked ? prev.reviewerAreas : []
                                }));
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-12 h-6 bg-slate-200 rounded-full peer-checked:bg-[#003b5c] transition-colors duration-300"></div>
                            <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm peer-checked:translate-x-6 transition-transform duration-300"></div>
                          </div>
                          <span className="text-sm font-medium text-slate-700 group-hover:text-[#003b5c] transition-colors font-sans">
                            {isSpanish 
                              ? 'Sí, deseo ser considerado/a como revisor/a en mi área de especialización'
                              : 'Yes, I wish to be considered as a reviewer in my area of expertise'}
                          </span>
                        </label>

                        <AnimatePresence>
                          {formData.wantsToBeReviewer && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-4"
                            >
                              <div className="bg-white rounded-lg p-5 ring-1 ring-slate-200">
                                <div className="flex items-center gap-2 mb-4">
                                  <span className="text-xs font-bold uppercase tracking-wider text-[#003b5c] font-sans">
                                    {isSpanish ? 'Selecciona hasta 4 áreas de especialización' : 'Select up to 4 areas of expertise'}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-sans">
                                    ({formData.reviewerAreas.length}/4)
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {Object.entries(getAreasByLanguage(language)).map(([categoria, subareas]) => (
                                    <div key={categoria} className="space-y-2">
                                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-sans border-b border-slate-200 pb-1">
                                        {categoria}
                                      </h4>
                                      <div className="space-y-1.5">
                                        {subareas.map(area => {
                                          const isSelected = formData.reviewerAreas.includes(area);
                                          const isDisabled = !isSelected && formData.reviewerAreas.length >= 4;
                                          
                                          return (
                                            <button
                                              key={area}
                                              type="button"
                                              onClick={() => {
                                                setFormData(prev => {
                                                  const current = prev.reviewerAreas;
                                                  if (isSelected) {
                                                    return {
                                                      ...prev,
                                                      reviewerAreas: current.filter(a => a !== area)
                                                    };
                                                  } else if (current.length < 4) {
                                                    return {
                                                      ...prev,
                                                      reviewerAreas: [...current, area]
                                                    };
                                                  }
                                                  return prev;
                                                });
                                              }}
                                              disabled={isDisabled}
                                              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-sans transition-all duration-200
                                                ${isSelected 
                                                  ? 'bg-[#003b5c] text-white shadow-sm' 
                                                  : isDisabled
                                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-[#003b5c] border border-transparent hover:border-[#003b5c]/30'
                                                }`}
                                            >
                                              <span className="flex items-center gap-2">
                                                {isSelected ? (
                                                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                  </svg>
                                                ) : (
                                                  <svg className="w-3.5 h-3.5 flex-shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                  </svg>
                                                )}
                                                {area}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {formData.reviewerAreas.length > 0 && (
                                  <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <p className="text-xs text-[#003b5c] font-sans">
                                      <strong>{isSpanish ? 'Áreas seleccionadas:' : 'Selected areas:'}</strong>{' '}
                                      {formData.reviewerAreas.join(' • ')}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Botones de navegación */}
            <div className="mt-12 pt-6 border-t border-slate-200 flex items-center justify-between bg-white">
              <button 
                type="button" 
                onClick={prevStep} 
                className={`px-6 py-3 rounded-xl font-bold text-sm tracking-wide transition-all 
                  ${currentStep === 1 ? 'opacity-0 pointer-events-none' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
              >
                &larr; {isSpanish ? 'Volver' : 'Back'}
              </button>
              
              {currentStep < 3 ? (
                <button 
                  type="button" 
                  onClick={nextStep} 
                  className="px-8 py-3 bg-[#003b5c] text-white rounded-xl font-bold text-sm tracking-wide hover:bg-[#00273f] hover:shadow-lg hover:shadow-[#003b5c]/20 transition-all active:scale-95"
                >
                  {isSpanish ? 'Continuar' : 'Continue'} &rarr;
                </button>
              ) : (
                <button 
                  type="submit" 
                  disabled={uploading || !isStepValid(3)}
                  className="px-10 py-3 bg-gradient-to-r from-[#003b5c] to-[#005282] text-white rounded-xl font-bold text-sm tracking-wide hover:shadow-xl hover:shadow-[#003b5c]/30 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading 
                    ? (isSpanish ? 'Enviando...' : 'Submitting...') 
                    : (isSpanish ? 'Enviar Manuscrito' : 'Submit Manuscript')}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              )}
            </div>

            {/* Estado del envío */}
            {submitStatus && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`text-center text-xs font-bold uppercase tracking-wider mt-4 font-sans ${
                  submitStatus.includes('Error') ? 'text-red-600' : 'text-green-700'
                }`}
              >
                {submitStatus}
              </motion.p>
            )}

            {/* Indicador de guardado automático */}
            <div className="mt-4 text-[10px] text-slate-400 text-center tracking-widest uppercase border-t border-slate-200 pt-4 font-sans">
              <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
              {isSpanish ? 'Borrador guardado automáticamente cada 30 segundos' : 'Draft auto-saved every 30 seconds'}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}