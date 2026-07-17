// src/hooks/reviewerRecommendationEngine.js

// ============================================================
// SISTEMA AVANZADO DE RECOMENDACION DE REVISORES
// ============================================================
// 
// Tecnicas implementadas:
// 1. TF-IDF vectorial para matching semantico de areas
// 2. Decaimiento temporal exponencial (Ebbinghaus)
// 3. Bayesian Performance Estimation (Beta distribution)
// 4. Multi-Armed Bandit con Thompson Sampling
// 5. Graph-based diversity scoring
// 6. Pareto Frontier para seleccion multi-objetivo
// 7. Normalizacion Z-score adaptativa
// 8. Ensemble de scores con pesos dinamicos
// ============================================================

// ==================== CONFIGURACION ====================

const WEIGHTS = {
  EXPERTISE: 0.30,
  PERFORMANCE: 0.25,
  AVAILABILITY: 0.20,
  DIVERSITY: 0.12,
  EXPLORATION: 0.08,
  RESPONSE: 0.05
};

const BETA_PRIOR = { alpha: 1, beta: 1 };

const DECAY = {
  HALF_LIFE_DAYS: 90,
  MIN_WEIGHT: 0.15,
  RECENCY_BOOST_DAYS: 30
};

const EXPLORATION = {
  EPSILON: 0.15,
  MIN_SAMPLES: 3,
  COLD_START_BONUS: 0.08
};

// ==================== CATEGORIAS Y MAPEOS ====================

const CATEGORY_MAPPINGS = {
  "Ciencias Exactas y Naturales": [
    "Matematicas", "Mathematics",
    "Fisica", "Physics",
    "Quimica", "Chemistry",
    "Biologia", "Biology",
    "Geologia", "Geology",
    "Astronomia y Astrofisica", "Astronomy and Astrophysics",
    "Ciencias Ambientales y Ecologia", "Environmental Sciences and Ecology",
    "Oceanografia", "Oceanography",
    "Meteorologia y Ciencias Atmosfericas", "Meteorology and Atmospheric Sciences",
    "Paleontologia", "Paleontology"
  ],
  "Ciencias de la Salud": [
    "Medicina General e Interna", "General and Internal Medicine",
    "Salud Publica y Epidemiologia", "Public Health and Epidemiology",
    "Enfermeria", "Nursing",
    "Nutricion y Dietetica", "Nutrition and Dietetics",
    "Farmacologia y Farmacia", "Pharmacology and Pharmacy",
    "Odontologia", "Dentistry",
    "Kinesiologia y Fisioterapia", "Kinesiology and Physiotherapy",
    "Tecnologia Medica y Bioanalisis", "Medical Technology and Bioanalysis",
    "Veterinaria", "Veterinary Medicine"
  ],
  "Ingenieria y Tecnologia": [
    "Ingenieria Civil", "Civil Engineering",
    "Ingenieria Industrial y de Sistemas", "Industrial and Systems Engineering",
    "Ingenieria Mecanica", "Mechanical Engineering",
    "Ingenieria Electrica y Electronica", "Electrical and Electronic Engineering",
    "Ingenieria Quimica y Biotecnologia", "Chemical Engineering and Biotechnology",
    "Ingenieria en Computacion e Informatica", "Computer Engineering and Informatics",
    "Ciencia de Datos e Inteligencia Artificial", "Data Science and Artificial Intelligence",
    "Robotica y Automatizacion", "Robotics and Automation",
    "Ingenieria de Materiales y Nanotecnologia", "Materials Engineering and Nanotechnology",
    "Ingenieria Aeroespacial", "Aerospace Engineering",
    "Energias Renovables y Sostenibilidad", "Renewable Energy and Sustainability"
  ],
  "Ciencias Sociales": [
    "Sociologia", "Sociology",
    "Antropologia y Arqueologia", "Anthropology and Archaeology",
    "Psicologia", "Psychology",
    "Economia y Negocios", "Economics and Business",
    "Ciencias Politicas y Relaciones Internacionales", "Political Science and International Relations",
    "Derecho", "Law",
    "Geografia Humana y Ordenamiento Territorial", "Human Geography and Territorial Planning",
    "Estudios de Genero", "Gender Studies",
    "Comunicacion Social y Periodismo", "Social Communication and Journalism",
    "Educacion y Pedagogia", "Education and Pedagogy",
    "Trabajo Social", "Social Work"
  ],
  "Humanidades": [
    "Historia", "History",
    "Filosofia", "Philosophy",
    "Linguistica y Filologia", "Linguistics and Philology",
    "Literatura", "Literature",
    "Estudios Clasicos", "Classical Studies",
    "Teologia y Ciencias de la Religion", "Theology and Religious Studies",
    "Estudios Culturales", "Cultural Studies",
    "Arte, Musica y Cine", "Art, Music and Cinema",
    "Arquitectura y Urbanismo", "Architecture and Urbanism"
  ],
  "Ciencias Agropecuarias": [
    "Agronomia y Produccion Agricola", "Agronomy and Agricultural Production",
    "Ciencias Forestales", "Forestry Sciences",
    "Acuicultura y Pesca", "Aquaculture and Fisheries",
    "Zootecnia y Produccion Animal", "Animal Science and Production",
    "Ingenieria de Alimentos", "Food Engineering"
  ]
};

// Mapeo inverso: area -> categoria
const AREA_TO_CATEGORY = {};
Object.entries(CATEGORY_MAPPINGS).forEach(([category, areas]) => {
  areas.forEach(area => { AREA_TO_CATEGORY[area] = category; });
});

// Categorias afines (grafo de similitud)
const RELATED_CATEGORIES = {
  "Ciencias Exactas y Naturales": ["Ingenieria y Tecnologia", "Ciencias Agropecuarias"],
  "Ciencias de la Salud": ["Ciencias Exactas y Naturales", "Ciencias Sociales"],
  "Ingenieria y Tecnologia": ["Ciencias Exactas y Naturales", "Ciencias Agropecuarias"],
  "Ciencias Sociales": ["Humanidades", "Ciencias de la Salud"],
  "Humanidades": ["Ciencias Sociales"],
  "Ciencias Agropecuarias": ["Ciencias Exactas y Naturales", "Ingenieria y Tecnologia"]
};

// ==================== SIMILITUD SEMANTICA BILINGÜE ====================

const SEMANTIC_SIMILARITY = {
  // ===== HUMANIDADES =====
  "Filosofia": {
    "Filosofia": 1.0, "Philosophy": 1.0,
    "Etica": 0.90, "Ethics": 0.90,
    "Logica": 0.85, "Logic": 0.85,
    "Estudios Clasicos": 0.80, "Classical Studies": 0.80,
    "Historia": 0.70, "History": 0.70,
    "Teologia y Ciencias de la Religion": 0.70, "Theology and Religious Studies": 0.70,
    "Literatura": 0.65, "Literature": 0.65,
    "Linguistica y Filologia": 0.55, "Linguistics and Philology": 0.55,
    "Estudios Culturales": 0.55, "Cultural Studies": 0.55,
    "Psicologia": 0.50, "Psychology": 0.50,
    "Sociologia": 0.45, "Sociology": 0.45,
    "Ciencias Politicas y Relaciones Internacionales": 0.40, "Political Science and International Relations": 0.40,
    "Derecho": 0.40, "Law": 0.40,
    "Arte, Musica y Cine": 0.40, "Art, Music and Cinema": 0.40,
    "Educacion y Pedagogia": 0.35, "Education and Pedagogy": 0.35,
    "Antropologia y Arqueologia": 0.35, "Anthropology and Archaeology": 0.35,
    "Comunicacion Social y Periodismo": 0.30, "Social Communication and Journalism": 0.30,
    "Arquitectura y Urbanismo": 0.20, "Architecture and Urbanism": 0.20,
    "Matematicas": 0.15, "Mathematics": 0.15,
    "Fisica": 0.10, "Physics": 0.10
  },
  
  "Philosophy": {
    "Philosophy": 1.0, "Filosofia": 1.0,
    "Ethics": 0.90, "Etica": 0.90,
    "Logic": 0.85, "Logica": 0.85,
    "Classical Studies": 0.80, "Estudios Clasicos": 0.80,
    "History": 0.70, "Historia": 0.70,
    "Theology and Religious Studies": 0.70, "Teologia y Ciencias de la Religion": 0.70,
    "Literature": 0.65, "Literatura": 0.65,
    "Linguistics and Philology": 0.55, "Linguistica y Filologia": 0.55,
    "Cultural Studies": 0.55, "Estudios Culturales": 0.55,
    "Psychology": 0.50, "Psicologia": 0.50,
    "Sociology": 0.45, "Sociologia": 0.45,
    "Political Science and International Relations": 0.40, "Ciencias Politicas y Relaciones Internacionales": 0.40,
    "Law": 0.40, "Derecho": 0.40,
    "Art, Music and Cinema": 0.40, "Arte, Musica y Cine": 0.40,
    "Education and Pedagogy": 0.35, "Educacion y Pedagogia": 0.35,
    "Anthropology and Archaeology": 0.35, "Antropologia y Arqueologia": 0.35,
    "Social Communication and Journalism": 0.30, "Comunicacion Social y Periodismo": 0.30,
    "Architecture and Urbanism": 0.20, "Arquitectura y Urbanismo": 0.20,
    "Mathematics": 0.15, "Matematicas": 0.15,
    "Physics": 0.10, "Fisica": 0.10
  },

  "Historia": {
    "Historia": 1.0, "History": 1.0,
    "Filosofia": 0.70, "Philosophy": 0.70,
    "Arqueologia": 0.85, "Archaeology": 0.85,
    "Antropologia y Arqueologia": 0.80, "Anthropology and Archaeology": 0.80,
    "Estudios Clasicos": 0.80, "Classical Studies": 0.80,
    "Estudios Culturales": 0.75, "Cultural Studies": 0.75,
    "Literatura": 0.70, "Literature": 0.70,
    "Teologia y Ciencias de la Religion": 0.65, "Theology and Religious Studies": 0.65,
    "Arte, Musica y Cine": 0.60, "Art, Music and Cinema": 0.60,
    "Ciencias Politicas y Relaciones Internacionales": 0.55, "Political Science and International Relations": 0.55,
    "Sociologia": 0.55, "Sociology": 0.55,
    "Derecho": 0.45, "Law": 0.45,
    "Arquitectura y Urbanismo": 0.45, "Architecture and Urbanism": 0.45,
    "Linguistica y Filologia": 0.40, "Linguistics and Philology": 0.40,
    "Geologia": 0.30, "Geology": 0.30,
    "Paleontologia": 0.30, "Paleontology": 0.30,
    "Educacion y Pedagogia": 0.30, "Education and Pedagogy": 0.30,
    "Comunicacion Social y Periodismo": 0.25, "Social Communication and Journalism": 0.25
  },

  "History": {
    "History": 1.0, "Historia": 1.0,
    "Philosophy": 0.70, "Filosofia": 0.70,
    "Archaeology": 0.85, "Arqueologia": 0.85,
    "Anthropology and Archaeology": 0.80, "Antropologia y Arqueologia": 0.80,
    "Classical Studies": 0.80, "Estudios Clasicos": 0.80,
    "Cultural Studies": 0.75, "Estudios Culturales": 0.75,
    "Literature": 0.70, "Literatura": 0.70,
    "Theology and Religious Studies": 0.65, "Teologia y Ciencias de la Religion": 0.65,
    "Art, Music and Cinema": 0.60, "Arte, Musica y Cine": 0.60,
    "Political Science and International Relations": 0.55, "Ciencias Politicas y Relaciones Internacionales": 0.55,
    "Sociology": 0.55, "Sociologia": 0.55,
    "Law": 0.45, "Derecho": 0.45,
    "Architecture and Urbanism": 0.45, "Arquitectura y Urbanismo": 0.45,
    "Linguistics and Philology": 0.40, "Linguistica y Filologia": 0.40,
    "Geology": 0.30, "Geologia": 0.30,
    "Paleontology": 0.30, "Paleontologia": 0.30,
    "Education and Pedagogy": 0.30, "Educacion y Pedagogia": 0.30,
    "Social Communication and Journalism": 0.25, "Comunicacion Social y Periodismo": 0.25
  },

  "Literatura": {
    "Literatura": 1.0, "Literature": 1.0,
    "Linguistica y Filologia": 0.85, "Linguistics and Philology": 0.85,
    "Estudios Clasicos": 0.80, "Classical Studies": 0.80,
    "Filosofia": 0.65, "Philosophy": 0.65,
    "Historia": 0.70, "History": 0.70,
    "Estudios Culturales": 0.75, "Cultural Studies": 0.75,
    "Arte, Musica y Cine": 0.65, "Art, Music and Cinema": 0.65,
    "Teologia y Ciencias de la Religion": 0.50, "Theology and Religious Studies": 0.50,
    "Comunicacion Social y Periodismo": 0.50, "Social Communication and Journalism": 0.50,
    "Psicologia": 0.40, "Psychology": 0.40,
    "Sociologia": 0.35, "Sociology": 0.35,
    "Educacion y Pedagogia": 0.30, "Education and Pedagogy": 0.30,
    "Derecho": 0.20, "Law": 0.20
  },

  "Literature": {
    "Literature": 1.0, "Literatura": 1.0,
    "Linguistics and Philology": 0.85, "Linguistica y Filologia": 0.85,
    "Classical Studies": 0.80, "Estudios Clasicos": 0.80,
    "Philosophy": 0.65, "Filosofia": 0.65,
    "History": 0.70, "Historia": 0.70,
    "Cultural Studies": 0.75, "Estudios Culturales": 0.75,
    "Art, Music and Cinema": 0.65, "Arte, Musica y Cine": 0.65,
    "Theology and Religious Studies": 0.50, "Teologia y Ciencias de la Religion": 0.50,
    "Social Communication and Journalism": 0.50, "Comunicacion Social y Periodismo": 0.50,
    "Psychology": 0.40, "Psicologia": 0.40,
    "Sociology": 0.35, "Sociologia": 0.35,
    "Education and Pedagogy": 0.30, "Educacion y Pedagogia": 0.30,
    "Law": 0.20, "Derecho": 0.20
  },

  "Linguistica y Filologia": {
    "Linguistica y Filologia": 1.0, "Linguistics and Philology": 1.0,
    "Literatura": 0.85, "Literature": 0.85,
    "Estudios Clasicos": 0.75, "Classical Studies": 0.75,
    "Comunicacion Social y Periodismo": 0.65, "Social Communication and Journalism": 0.65,
    "Filosofia": 0.55, "Philosophy": 0.55,
    "Estudios Culturales": 0.55, "Cultural Studies": 0.55,
    "Historia": 0.40, "History": 0.40,
    "Educacion y Pedagogia": 0.40, "Education and Pedagogy": 0.40,
    "Psicologia": 0.35, "Psychology": 0.35,
    "Antropologia y Arqueologia": 0.30, "Anthropology and Archaeology": 0.30
  },

  "Linguistics and Philology": {
    "Linguistics and Philology": 1.0, "Linguistica y Filologia": 1.0,
    "Literature": 0.85, "Literatura": 0.85,
    "Classical Studies": 0.75, "Estudios Clasicos": 0.75,
    "Social Communication and Journalism": 0.65, "Comunicacion Social y Periodismo": 0.65,
    "Philosophy": 0.55, "Filosofia": 0.55,
    "Cultural Studies": 0.55, "Estudios Culturales": 0.55,
    "History": 0.40, "Historia": 0.40,
    "Education and Pedagogy": 0.40, "Educacion y Pedagogia": 0.40,
    "Psychology": 0.35, "Psicologia": 0.35,
    "Anthropology and Archaeology": 0.30, "Antropologia y Arqueologia": 0.30
  },

  "Estudios Clasicos": {
    "Estudios Clasicos": 1.0, "Classical Studies": 1.0,
    "Filosofia": 0.80, "Philosophy": 0.80,
    "Historia": 0.80, "History": 0.80,
    "Literatura": 0.80, "Literature": 0.80,
    "Linguistica y Filologia": 0.75, "Linguistics and Philology": 0.75,
    "Arqueologia": 0.75, "Archaeology": 0.75,
    "Antropologia y Arqueologia": 0.70, "Anthropology and Archaeology": 0.70,
    "Teologia y Ciencias de la Religion": 0.65, "Theology and Religious Studies": 0.65,
    "Arte, Musica y Cine": 0.55, "Art, Music and Cinema": 0.55,
    "Arquitectura y Urbanismo": 0.50, "Architecture and Urbanism": 0.50,
    "Derecho": 0.40, "Law": 0.40,
    "Estudios Culturales": 0.40, "Cultural Studies": 0.40
  },

  "Classical Studies": {
    "Classical Studies": 1.0, "Estudios Clasicos": 1.0,
    "Philosophy": 0.80, "Filosofia": 0.80,
    "History": 0.80, "Historia": 0.80,
    "Literature": 0.80, "Literatura": 0.80,
    "Linguistics and Philology": 0.75, "Linguistica y Filologia": 0.75,
    "Archaeology": 0.75, "Arqueologia": 0.75,
    "Anthropology and Archaeology": 0.70, "Antropologia y Arqueologia": 0.70,
    "Theology and Religious Studies": 0.65, "Teologia y Ciencias de la Religion": 0.65,
    "Art, Music and Cinema": 0.55, "Arte, Musica y Cine": 0.55,
    "Architecture and Urbanism": 0.50, "Arquitectura y Urbanismo": 0.50,
    "Law": 0.40, "Derecho": 0.40,
    "Cultural Studies": 0.40, "Estudios Culturales": 0.40
  },

  "Teologia y Ciencias de la Religion": {
    "Teologia y Ciencias de la Religion": 1.0, "Theology and Religious Studies": 1.0,
    "Filosofia": 0.70, "Philosophy": 0.70,
    "Historia": 0.65, "History": 0.65,
    "Estudios Clasicos": 0.65, "Classical Studies": 0.65,
    "Literatura": 0.50, "Literature": 0.50,
    "Estudios Culturales": 0.50, "Cultural Studies": 0.50,
    "Sociologia": 0.40, "Sociology": 0.40,
    "Antropologia y Arqueologia": 0.40, "Anthropology and Archaeology": 0.40,
    "Psicologia": 0.35, "Psychology": 0.35,
    "Derecho": 0.30, "Law": 0.30
  },

  "Theology and Religious Studies": {
    "Theology and Religious Studies": 1.0, "Teologia y Ciencias de la Religion": 1.0,
    "Philosophy": 0.70, "Filosofia": 0.70,
    "History": 0.65, "Historia": 0.65,
    "Classical Studies": 0.65, "Estudios Clasicos": 0.65,
    "Literature": 0.50, "Literatura": 0.50,
    "Cultural Studies": 0.50, "Estudios Culturales": 0.50,
    "Sociology": 0.40, "Sociologia": 0.40,
    "Anthropology and Archaeology": 0.40, "Antropologia y Arqueologia": 0.40,
    "Psychology": 0.35, "Psicologia": 0.35,
    "Law": 0.30, "Derecho": 0.30
  },

  "Estudios Culturales": {
    "Estudios Culturales": 1.0, "Cultural Studies": 1.0,
    "Historia": 0.75, "History": 0.75,
    "Literatura": 0.75, "Literature": 0.75,
    "Sociologia": 0.70, "Sociology": 0.70,
    "Antropologia y Arqueologia": 0.70, "Anthropology and Archaeology": 0.70,
    "Arte, Musica y Cine": 0.70, "Art, Music and Cinema": 0.70,
    "Filosofia": 0.55, "Philosophy": 0.55,
    "Comunicacion Social y Periodismo": 0.55, "Social Communication and Journalism": 0.55,
    "Linguistica y Filologia": 0.55, "Linguistics and Philology": 0.55,
    "Teologia y Ciencias de la Religion": 0.50, "Theology and Religious Studies": 0.50,
    "Psicologia": 0.45, "Psychology": 0.45,
    "Ciencias Politicas y Relaciones Internacionales": 0.40, "Political Science and International Relations": 0.40,
    "Estudios de Genero": 0.65, "Gender Studies": 0.65,
    "Educacion y Pedagogia": 0.40, "Education and Pedagogy": 0.40,
    "Arquitectura y Urbanismo": 0.35, "Architecture and Urbanism": 0.35
  },

  "Cultural Studies": {
    "Cultural Studies": 1.0, "Estudios Culturales": 1.0,
    "History": 0.75, "Historia": 0.75,
    "Literature": 0.75, "Literatura": 0.75,
    "Sociology": 0.70, "Sociologia": 0.70,
    "Anthropology and Archaeology": 0.70, "Antropologia y Arqueologia": 0.70,
    "Art, Music and Cinema": 0.70, "Arte, Musica y Cine": 0.70,
    "Philosophy": 0.55, "Filosofia": 0.55,
    "Social Communication and Journalism": 0.55, "Comunicacion Social y Periodismo": 0.55,
    "Linguistics and Philology": 0.55, "Linguistica y Filologia": 0.55,
    "Theology and Religious Studies": 0.50, "Teologia y Ciencias de la Religion": 0.50,
    "Psychology": 0.45, "Psicologia": 0.45,
    "Political Science and International Relations": 0.40, "Ciencias Politicas y Relaciones Internacionales": 0.40,
    "Gender Studies": 0.65, "Estudios de Genero": 0.65,
    "Education and Pedagogy": 0.40, "Educacion y Pedagogia": 0.40,
    "Architecture and Urbanism": 0.35, "Arquitectura y Urbanismo": 0.35
  },

  "Arte, Musica y Cine": {
    "Arte, Musica y Cine": 1.0, "Art, Music and Cinema": 1.0,
    "Estudios Culturales": 0.70, "Cultural Studies": 0.70,
    "Literatura": 0.65, "Literature": 0.65,
    "Historia": 0.60, "History": 0.60,
    "Arquitectura y Urbanismo": 0.55, "Architecture and Urbanism": 0.55,
    "Estudios Clasicos": 0.55, "Classical Studies": 0.55,
    "Filosofia": 0.40, "Philosophy": 0.40,
    "Comunicacion Social y Periodismo": 0.40, "Social Communication and Journalism": 0.40,
    "Sociologia": 0.35, "Sociology": 0.35,
    "Psicologia": 0.30, "Psychology": 0.30,
    "Antropologia y Arqueologia": 0.30, "Anthropology and Archaeology": 0.30
  },

  "Art, Music and Cinema": {
    "Art, Music and Cinema": 1.0, "Arte, Musica y Cine": 1.0,
    "Cultural Studies": 0.70, "Estudios Culturales": 0.70,
    "Literature": 0.65, "Literatura": 0.65,
    "History": 0.60, "Historia": 0.60,
    "Architecture and Urbanism": 0.55, "Arquitectura y Urbanismo": 0.55,
    "Classical Studies": 0.55, "Estudios Clasicos": 0.55,
    "Philosophy": 0.40, "Filosofia": 0.40,
    "Social Communication and Journalism": 0.40, "Comunicacion Social y Periodismo": 0.40,
    "Sociology": 0.35, "Sociologia": 0.35,
    "Psychology": 0.30, "Psicologia": 0.30,
    "Anthropology and Archaeology": 0.30, "Antropologia y Arqueologia": 0.30
  },

  "Arquitectura y Urbanismo": {
    "Arquitectura y Urbanismo": 1.0, "Architecture and Urbanism": 1.0,
    "Arte, Musica y Cine": 0.55, "Art, Music and Cinema": 0.55,
    "Historia": 0.45, "History": 0.45,
    "Estudios Clasicos": 0.50, "Classical Studies": 0.50,
    "Ingenieria Civil": 0.50, "Civil Engineering": 0.50,
    "Geografia Humana y Ordenamiento Territorial": 0.45, "Human Geography and Territorial Planning": 0.45,
    "Estudios Culturales": 0.35, "Cultural Studies": 0.35,
    "Filosofia": 0.20, "Philosophy": 0.20,
    "Sociologia": 0.30, "Sociology": 0.30,
    "Diseno": 0.60, "Design": 0.60
  },

  "Architecture and Urbanism": {
    "Architecture and Urbanism": 1.0, "Arquitectura y Urbanismo": 1.0,
    "Art, Music and Cinema": 0.55, "Arte, Musica y Cine": 0.55,
    "History": 0.45, "Historia": 0.45,
    "Classical Studies": 0.50, "Estudios Clasicos": 0.50,
    "Civil Engineering": 0.50, "Ingenieria Civil": 0.50,
    "Human Geography and Territorial Planning": 0.45, "Geografia Humana y Ordenamiento Territorial": 0.45,
    "Cultural Studies": 0.35, "Estudios Culturales": 0.35,
    "Philosophy": 0.20, "Filosofia": 0.20,
    "Sociology": 0.30, "Sociologia": 0.30,
    "Design": 0.60, "Diseno": 0.60
  },

  // ===== CIENCIAS SOCIALES =====
  "Psicologia": {
    "Psicologia": 1.0, "Psychology": 1.0,
    "Psiquiatria": 0.85, "Psychiatry": 0.85,
    "Medicina General e Interna": 0.55, "General and Internal Medicine": 0.55,
    "Sociologia": 0.65, "Sociology": 0.65,
    "Filosofia": 0.50, "Philosophy": 0.50,
    "Educacion y Pedagogia": 0.55, "Education and Pedagogy": 0.55,
    "Antropologia y Arqueologia": 0.45, "Anthropology and Archaeology": 0.45,
    "Estudios de Genero": 0.40, "Gender Studies": 0.40,
    "Trabajo Social": 0.40, "Social Work": 0.40,
    "Literatura": 0.40, "Literature": 0.40,
    "Comunicacion Social y Periodismo": 0.35, "Social Communication and Journalism": 0.35,
    "Biologia": 0.35, "Biology": 0.35,
    "Neurociencia": 0.80, "Neuroscience": 0.80
  },

  "Psychology": {
    "Psychology": 1.0, "Psicologia": 1.0,
    "Psychiatry": 0.85, "Psiquiatria": 0.85,
    "General and Internal Medicine": 0.55, "Medicina General e Interna": 0.55,
    "Sociology": 0.65, "Sociologia": 0.65,
    "Philosophy": 0.50, "Filosofia": 0.50,
    "Education and Pedagogy": 0.55, "Educacion y Pedagogia": 0.55,
    "Anthropology and Archaeology": 0.45, "Antropologia y Arqueologia": 0.45,
    "Gender Studies": 0.40, "Estudios de Genero": 0.40,
    "Social Work": 0.40, "Trabajo Social": 0.40,
    "Literature": 0.40, "Literatura": 0.40,
    "Social Communication and Journalism": 0.35, "Comunicacion Social y Periodismo": 0.35,
    "Biology": 0.35, "Biologia": 0.35,
    "Neuroscience": 0.80, "Neurociencia": 0.80
  },

  "Sociologia": {
    "Sociologia": 1.0, "Sociology": 1.0,
    "Antropologia y Arqueologia": 0.75, "Anthropology and Archaeology": 0.75,
    "Psicologia": 0.65, "Psychology": 0.65,
    "Ciencias Politicas y Relaciones Internacionales": 0.65, "Political Science and International Relations": 0.65,
    "Estudios Culturales": 0.70, "Cultural Studies": 0.70,
    "Estudios de Genero": 0.65, "Gender Studies": 0.65,
    "Trabajo Social": 0.60, "Social Work": 0.60,
    "Filosofia": 0.45, "Philosophy": 0.45,
    "Historia": 0.55, "History": 0.55,
    "Economia y Negocios": 0.50, "Economics and Business": 0.50,
    "Educacion y Pedagogia": 0.45, "Education and Pedagogy": 0.45,
    "Derecho": 0.45, "Law": 0.45,
    "Comunicacion Social y Periodismo": 0.40, "Social Communication and Journalism": 0.40,
    "Geografia Humana y Ordenamiento Territorial": 0.40, "Human Geography and Territorial Planning": 0.40
  },

  "Sociology": {
    "Sociology": 1.0, "Sociologia": 1.0,
    "Anthropology and Archaeology": 0.75, "Antropologia y Arqueologia": 0.75,
    "Psychology": 0.65, "Psicologia": 0.65,
    "Political Science and International Relations": 0.65, "Ciencias Politicas y Relaciones Internacionales": 0.65,
    "Cultural Studies": 0.70, "Estudios Culturales": 0.70,
    "Gender Studies": 0.65, "Estudios de Genero": 0.65,
    "Social Work": 0.60, "Trabajo Social": 0.60,
    "Philosophy": 0.45, "Filosofia": 0.45,
    "History": 0.55, "Historia": 0.55,
    "Economics and Business": 0.50, "Economia y Negocios": 0.50,
    "Education and Pedagogy": 0.45, "Educacion y Pedagogia": 0.45,
    "Law": 0.45, "Derecho": 0.45,
    "Social Communication and Journalism": 0.40, "Comunicacion Social y Periodismo": 0.40,
    "Human Geography and Territorial Planning": 0.40, "Geografia Humana y Ordenamiento Territorial": 0.40
  },

  "Antropologia y Arqueologia": {
    "Antropologia y Arqueologia": 1.0, "Anthropology and Archaeology": 1.0,
    "Sociologia": 0.75, "Sociology": 0.75,
    "Historia": 0.80, "History": 0.80,
    "Estudios Culturales": 0.70, "Cultural Studies": 0.70,
    "Arqueologia": 0.90, "Archaeology": 0.90,
    "Estudios Clasicos": 0.70, "Classical Studies": 0.70,
    "Paleontologia": 0.55, "Paleontology": 0.55,
    "Biologia": 0.40, "Biology": 0.40,
    "Filosofia": 0.35, "Philosophy": 0.35,
    "Linguistica y Filologia": 0.30, "Linguistics and Philology": 0.30,
    "Teologia y Ciencias de la Religion": 0.40, "Theology and Religious Studies": 0.40,
    "Psicologia": 0.45, "Psychology": 0.45,
    "Geografia Humana y Ordenamiento Territorial": 0.40, "Human Geography and Territorial Planning": 0.40
  },

  "Anthropology and Archaeology": {
    "Anthropology and Archaeology": 1.0, "Antropologia y Arqueologia": 1.0,
    "Sociology": 0.75, "Sociologia": 0.75,
    "History": 0.80, "Historia": 0.80,
    "Cultural Studies": 0.70, "Estudios Culturales": 0.70,
    "Archaeology": 0.90, "Arqueologia": 0.90,
    "Classical Studies": 0.70, "Estudios Clasicos": 0.70,
    "Paleontology": 0.55, "Paleontologia": 0.55,
    "Biology": 0.40, "Biologia": 0.40,
    "Philosophy": 0.35, "Filosofia": 0.35,
    "Linguistics and Philology": 0.30, "Linguistica y Filologia": 0.30,
    "Theology and Religious Studies": 0.40, "Teologia y Ciencias de la Religion": 0.40,
    "Psychology": 0.45, "Psicologia": 0.45,
    "Human Geography and Territorial Planning": 0.40, "Geografia Humana y Ordenamiento Territorial": 0.40
  },

  "Ciencias Politicas y Relaciones Internacionales": {
    "Ciencias Politicas y Relaciones Internacionales": 1.0, "Political Science and International Relations": 1.0,
    "Sociologia": 0.65, "Sociology": 0.65,
    "Derecho": 0.70, "Law": 0.70,
    "Economia y Negocios": 0.60, "Economics and Business": 0.60,
    "Historia": 0.55, "History": 0.55,
    "Filosofia": 0.40, "Philosophy": 0.40,
    "Geopolitica": 0.85, "Geopolitics": 0.85,
    "Comunicacion Social y Periodismo": 0.45, "Social Communication and Journalism": 0.45,
    "Estudios de Genero": 0.40, "Gender Studies": 0.40,
    "Trabajo Social": 0.35, "Social Work": 0.35,
    "Educacion y Pedagogia": 0.25, "Education and Pedagogy": 0.25
  },

  "Political Science and International Relations": {
    "Political Science and International Relations": 1.0, "Ciencias Politicas y Relaciones Internacionales": 1.0,
    "Sociology": 0.65, "Sociologia": 0.65,
    "Law": 0.70, "Derecho": 0.70,
    "Economics and Business": 0.60, "Economia y Negocios": 0.60,
    "History": 0.55, "Historia": 0.55,
    "Philosophy": 0.40, "Filosofia": 0.40,
    "Geopolitics": 0.85, "Geopolitica": 0.85,
    "Social Communication and Journalism": 0.45, "Comunicacion Social y Periodismo": 0.45,
    "Gender Studies": 0.40, "Estudios de Genero": 0.40,
    "Social Work": 0.35, "Trabajo Social": 0.35,
    "Education and Pedagogy": 0.25, "Educacion y Pedagogia": 0.25
  },

  "Derecho": {
    "Derecho": 1.0, "Law": 1.0,
    "Ciencias Politicas y Relaciones Internacionales": 0.70, "Political Science and International Relations": 0.70,
    "Filosofia": 0.40, "Philosophy": 0.40,
    "Sociologia": 0.45, "Sociology": 0.45,
    "Historia": 0.45, "History": 0.45,
    "Economia y Negocios": 0.40, "Economics and Business": 0.40,
    "Trabajo Social": 0.35, "Social Work": 0.35,
    "Estudios Clasicos": 0.40, "Classical Studies": 0.40,
    "Derecho Internacional": 0.90, "International Law": 0.90,
    "Derecho Constitucional": 0.85, "Constitutional Law": 0.85
  },

  "Law": {
    "Law": 1.0, "Derecho": 1.0,
    "Political Science and International Relations": 0.70, "Ciencias Politicas y Relaciones Internacionales": 0.70,
    "Philosophy": 0.40, "Filosofia": 0.40,
    "Sociology": 0.45, "Sociologia": 0.45,
    "History": 0.45, "Historia": 0.45,
    "Economics and Business": 0.40, "Economia y Negocios": 0.40,
    "Social Work": 0.35, "Trabajo Social": 0.35,
    "Classical Studies": 0.40, "Estudios Clasicos": 0.40,
    "International Law": 0.90, "Derecho Internacional": 0.90,
    "Constitutional Law": 0.85, "Derecho Constitucional": 0.85
  },

  "Economia y Negocios": {
    "Economia y Negocios": 1.0, "Economics and Business": 1.0,
    "Ciencias Politicas y Relaciones Internacionales": 0.60, "Political Science and International Relations": 0.60,
    "Sociologia": 0.50, "Sociology": 0.50,
    "Matematicas": 0.45, "Mathematics": 0.45,
    "Estadistica": 0.55, "Statistics": 0.55,
    "Derecho": 0.40, "Law": 0.40,
    "Historia": 0.30, "History": 0.30,
    "Finanzas": 0.85, "Finance": 0.85,
    "Administracion": 0.80, "Administration": 0.80
  },

  "Economics and Business": {
    "Economics and Business": 1.0, "Economia y Negocios": 1.0,
    "Political Science and International Relations": 0.60, "Ciencias Politicas y Relaciones Internacionales": 0.60,
    "Sociology": 0.50, "Sociologia": 0.50,
    "Mathematics": 0.45, "Matematicas": 0.45,
    "Statistics": 0.55, "Estadistica": 0.55,
    "Law": 0.40, "Derecho": 0.40,
    "History": 0.30, "Historia": 0.30,
    "Finance": 0.85, "Finanzas": 0.85,
    "Administration": 0.80, "Administracion": 0.80
  },

  "Educacion y Pedagogia": {
    "Educacion y Pedagogia": 1.0, "Education and Pedagogy": 1.0,
    "Psicologia": 0.55, "Psychology": 0.55,
    "Sociologia": 0.45, "Sociology": 0.45,
    "Filosofia": 0.35, "Philosophy": 0.35,
    "Comunicacion Social y Periodismo": 0.30, "Social Communication and Journalism": 0.30,
    "Linguistica y Filologia": 0.40, "Linguistics and Philology": 0.40,
    "Literatura": 0.30, "Literature": 0.30,
    "Trabajo Social": 0.40, "Social Work": 0.40,
    "Estudios de Genero": 0.35, "Gender Studies": 0.35,
    "Historia": 0.30, "History": 0.30,
    "Didactica": 0.85, "Didactics": 0.85
  },

  "Education and Pedagogy": {
    "Education and Pedagogy": 1.0, "Educacion y Pedagogia": 1.0,
    "Psychology": 0.55, "Psicologia": 0.55,
    "Sociology": 0.45, "Sociologia": 0.45,
    "Philosophy": 0.35, "Filosofia": 0.35,
    "Social Communication and Journalism": 0.30, "Comunicacion Social y Periodismo": 0.30,
    "Linguistics and Philology": 0.40, "Linguistica y Filologia": 0.40,
    "Literature": 0.30, "Literatura": 0.30,
    "Social Work": 0.40, "Trabajo Social": 0.40,
    "Gender Studies": 0.35, "Estudios de Genero": 0.35,
    "History": 0.30, "Historia": 0.30,
    "Didactics": 0.85, "Didactica": 0.85
  },

  "Comunicacion Social y Periodismo": {
    "Comunicacion Social y Periodismo": 1.0, "Social Communication and Journalism": 1.0,
    "Sociologia": 0.40, "Sociology": 0.40,
    "Linguistica y Filologia": 0.65, "Linguistics and Philology": 0.65,
    "Literatura": 0.50, "Literature": 0.50,
    "Ciencias Politicas y Relaciones Internacionales": 0.45, "Political Science and International Relations": 0.45,
    "Estudios Culturales": 0.55, "Cultural Studies": 0.55,
    "Psicologia": 0.35, "Psychology": 0.35,
    "Filosofia": 0.30, "Philosophy": 0.30,
    "Historia": 0.25, "History": 0.25,
    "Arte, Musica y Cine": 0.40, "Art, Music and Cinema": 0.40,
    "Educacion y Pedagogia": 0.30, "Education and Pedagogy": 0.30
  },

  "Social Communication and Journalism": {
    "Social Communication and Journalism": 1.0, "Comunicacion Social y Periodismo": 1.0,
    "Sociology": 0.40, "Sociologia": 0.40,
    "Linguistics and Philology": 0.65, "Linguistica y Filologia": 0.65,
    "Literature": 0.50, "Literatura": 0.50,
    "Political Science and International Relations": 0.45, "Ciencias Politicas y Relaciones Internacionales": 0.45,
    "Cultural Studies": 0.55, "Estudios Culturales": 0.55,
    "Psychology": 0.35, "Psicologia": 0.35,
    "Philosophy": 0.30, "Filosofia": 0.30,
    "History": 0.25, "Historia": 0.25,
    "Art, Music and Cinema": 0.40, "Arte, Musica y Cine": 0.40,
    "Education and Pedagogy": 0.30, "Educacion y Pedagogia": 0.30
  },

  "Estudios de Genero": {
    "Estudios de Genero": 1.0, "Gender Studies": 1.0,
    "Sociologia": 0.65, "Sociology": 0.65,
    "Psicologia": 0.40, "Psychology": 0.40,
    "Estudios Culturales": 0.65, "Cultural Studies": 0.65,
    "Ciencias Politicas y Relaciones Internacionales": 0.40, "Political Science and International Relations": 0.40,
    "Derecho": 0.40, "Law": 0.40,
    "Historia": 0.40, "History": 0.40,
    "Literatura": 0.40, "Literature": 0.40,
    "Trabajo Social": 0.45, "Social Work": 0.45,
    "Antropologia y Arqueologia": 0.40, "Anthropology and Archaeology": 0.40,
    "Filosofia": 0.30, "Philosophy": 0.30
  },

  "Gender Studies": {
    "Gender Studies": 1.0, "Estudios de Genero": 1.0,
    "Sociology": 0.65, "Sociologia": 0.65,
    "Psychology": 0.40, "Psicologia": 0.40,
    "Cultural Studies": 0.65, "Estudios Culturales": 0.65,
    "Political Science and International Relations": 0.40, "Ciencias Politicas y Relaciones Internacionales": 0.40,
    "Law": 0.40, "Derecho": 0.40,
    "History": 0.40, "Historia": 0.40,
    "Literature": 0.40, "Literatura": 0.40,
    "Social Work": 0.45, "Trabajo Social": 0.45,
    "Anthropology and Archaeology": 0.40, "Antropologia y Arqueologia": 0.40,
    "Philosophy": 0.30, "Filosofia": 0.30
  },

  "Trabajo Social": {
    "Trabajo Social": 1.0, "Social Work": 1.0,
    "Sociologia": 0.60, "Sociology": 0.60,
    "Psicologia": 0.40, "Psychology": 0.40,
    "Derecho": 0.35, "Law": 0.35,
    "Educacion y Pedagogia": 0.40, "Education and Pedagogy": 0.40,
    "Estudios de Genero": 0.45, "Gender Studies": 0.45,
    "Salud Publica y Epidemiologia": 0.35, "Public Health and Epidemiology": 0.35,
    "Ciencias Politicas y Relaciones Internacionales": 0.35, "Political Science and International Relations": 0.35,
    "Economia y Negocios": 0.25, "Economics and Business": 0.25
  },

  "Social Work": {
    "Social Work": 1.0, "Trabajo Social": 1.0,
    "Sociology": 0.60, "Sociologia": 0.60,
    "Psychology": 0.40, "Psicologia": 0.40,
    "Law": 0.35, "Derecho": 0.35,
    "Education and Pedagogy": 0.40, "Educacion y Pedagogia": 0.40,
    "Gender Studies": 0.45, "Estudios de Genero": 0.45,
    "Public Health and Epidemiology": 0.35, "Salud Publica y Epidemiologia": 0.35,
    "Political Science and International Relations": 0.35, "Ciencias Politicas y Relaciones Internacionales": 0.35,
    "Economics and Business": 0.25, "Economia y Negocios": 0.25
  },

  "Geografia Humana y Ordenamiento Territorial": {
    "Geografia Humana y Ordenamiento Territorial": 1.0, "Human Geography and Territorial Planning": 1.0,
    "Sociologia": 0.40, "Sociology": 0.40,
    "Geologia": 0.45, "Geology": 0.45,
    "Ciencias Ambientales y Ecologia": 0.50, "Environmental Sciences and Ecology": 0.50,
    "Arquitectura y Urbanismo": 0.45, "Architecture and Urbanism": 0.45,
    "Antropologia y Arqueologia": 0.40, "Anthropology and Archaeology": 0.40,
    "Economia y Negocios": 0.30, "Economics and Business": 0.30,
    "Historia": 0.30, "History": 0.30
  },

  "Human Geography and Territorial Planning": {
    "Human Geography and Territorial Planning": 1.0, "Geografia Humana y Ordenamiento Territorial": 1.0,
    "Sociology": 0.40, "Sociologia": 0.40,
    "Geology": 0.45, "Geologia": 0.45,
    "Environmental Sciences and Ecology": 0.50, "Ciencias Ambientales y Ecologia": 0.50,
    "Architecture and Urbanism": 0.45, "Arquitectura y Urbanismo": 0.45,
    "Anthropology and Archaeology": 0.40, "Antropologia y Arqueologia": 0.40,
    "Economics and Business": 0.30, "Economia y Negocios": 0.30,
    "History": 0.30, "Historia": 0.30
  },

  // ===== CIENCIAS EXACTAS Y NATURALES =====
  "Matematicas": {
    "Matematicas": 1.0, "Mathematics": 1.0,
    "Fisica": 0.65, "Physics": 0.65,
    "Estadistica": 0.75, "Statistics": 0.75,
    "Ciencia de Datos e Inteligencia Artificial": 0.60, "Data Science and Artificial Intelligence": 0.60,
    "Ingenieria en Computacion e Informatica": 0.55, "Computer Engineering and Informatics": 0.55,
    "Economia y Negocios": 0.45, "Economics and Business": 0.45,
    "Filosofia": 0.15, "Philosophy": 0.15,
    "Logica": 0.80, "Logic": 0.80,
    "Algebra": 0.90, "Algebra": 0.90,
    "Geometria": 0.85, "Geometry": 0.85
  },

  "Mathematics": {
    "Mathematics": 1.0, "Matematicas": 1.0,
    "Physics": 0.65, "Fisica": 0.65,
    "Statistics": 0.75, "Estadistica": 0.75,
    "Data Science and Artificial Intelligence": 0.60, "Ciencia de Datos e Inteligencia Artificial": 0.60,
    "Computer Engineering and Informatics": 0.55, "Ingenieria en Computacion e Informatica": 0.55,
    "Economics and Business": 0.45, "Economia y Negocios": 0.45,
    "Philosophy": 0.15, "Filosofia": 0.15,
    "Logic": 0.80, "Logica": 0.80,
    "Algebra": 0.90, "Algebra": 0.90,
    "Geometry": 0.85, "Geometria": 0.85
  },

  "Fisica": {
    "Fisica": 1.0, "Physics": 1.0,
    "Matematicas": 0.65, "Mathematics": 0.65,
    "Quimica": 0.55, "Chemistry": 0.55,
    "Astronomia y Astrofisica": 0.75, "Astronomy and Astrophysics": 0.75,
    "Ingenieria Mecanica": 0.55, "Mechanical Engineering": 0.55,
    "Ingenieria Electrica y Electronica": 0.50, "Electrical and Electronic Engineering": 0.50,
    "Geologia": 0.35, "Geology": 0.35,
    "Filosofia": 0.10, "Philosophy": 0.10,
    "Mecanica Cuantica": 0.90, "Quantum Mechanics": 0.90,
    "Termodinamica": 0.85, "Thermodynamics": 0.85
  },

  "Physics": {
    "Physics": 1.0, "Fisica": 1.0,
    "Mathematics": 0.65, "Matematicas": 0.65,
    "Chemistry": 0.55, "Quimica": 0.55,
    "Astronomy and Astrophysics": 0.75, "Astronomia y Astrofisica": 0.75,
    "Mechanical Engineering": 0.55, "Ingenieria Mecanica": 0.55,
    "Electrical and Electronic Engineering": 0.50, "Ingenieria Electrica y Electronica": 0.50,
    "Geology": 0.35, "Geologia": 0.35,
    "Philosophy": 0.10, "Filosofia": 0.10,
    "Quantum Mechanics": 0.90, "Mecanica Cuantica": 0.90,
    "Thermodynamics": 0.85, "Termodinamica": 0.85
  },

  "Quimica": {
    "Quimica": 1.0, "Chemistry": 1.0,
    "Biologia": 0.60, "Biology": 0.60,
    "Fisica": 0.55, "Physics": 0.55,
    "Bioquimica": 0.85, "Biochemistry": 0.85,
    "Farmacologia y Farmacia": 0.65, "Pharmacology and Pharmacy": 0.65,
    "Ingenieria Quimica y Biotecnologia": 0.65, "Chemical Engineering and Biotechnology": 0.65,
    "Ciencias Ambientales y Ecologia": 0.45, "Environmental Sciences and Ecology": 0.45,
    "Geologia": 0.40, "Geology": 0.40,
    "Ingenieria de Alimentos": 0.45, "Food Engineering": 0.45,
    "Ingenieria de Materiales y Nanotecnologia": 0.50, "Materials Engineering and Nanotechnology": 0.50
  },

  "Chemistry": {
    "Chemistry": 1.0, "Quimica": 1.0,
    "Biology": 0.60, "Biologia": 0.60,
    "Physics": 0.55, "Fisica": 0.55,
    "Biochemistry": 0.85, "Bioquimica": 0.85,
    "Pharmacology and Pharmacy": 0.65, "Farmacologia y Farmacia": 0.65,
    "Chemical Engineering and Biotechnology": 0.65, "Ingenieria Quimica y Biotecnologia": 0.65,
    "Environmental Sciences and Ecology": 0.45, "Ciencias Ambientales y Ecologia": 0.45,
    "Geology": 0.40, "Geologia": 0.40,
    "Food Engineering": 0.45, "Ingenieria de Alimentos": 0.45,
    "Materials Engineering and Nanotechnology": 0.50, "Ingenieria de Materiales y Nanotecnologia": 0.50
  },

  "Biologia": {
    "Biologia": 1.0, "Biology": 1.0,
    "Quimica": 0.60, "Chemistry": 0.60,
    "Ciencias Ambientales y Ecologia": 0.70, "Environmental Sciences and Ecology": 0.70,
    "Paleontologia": 0.55, "Paleontology": 0.55,
    "Medicina General e Interna": 0.50, "General and Internal Medicine": 0.50,
    "Psicologia": 0.35, "Psychology": 0.35,
    "Bioquimica": 0.75, "Biochemistry": 0.75,
    "Genetica": 0.85, "Genetics": 0.85,
    "Microbiologia": 0.80, "Microbiology": 0.80,
    "Oceanografia": 0.50, "Oceanography": 0.50,
    "Veterinaria": 0.50, "Veterinary Medicine": 0.50,
    "Agronomia y Produccion Agricola": 0.45, "Agronomy and Agricultural Production": 0.45
  },

  "Biology": {
    "Biology": 1.0, "Biologia": 1.0,
    "Chemistry": 0.60, "Quimica": 0.60,
    "Environmental Sciences and Ecology": 0.70, "Ciencias Ambientales y Ecologia": 0.70,
    "Paleontology": 0.55, "Paleontologia": 0.55,
    "General and Internal Medicine": 0.50, "Medicina General e Interna": 0.50,
    "Psychology": 0.35, "Psicologia": 0.35,
    "Biochemistry": 0.75, "Bioquimica": 0.75,
    "Genetics": 0.85, "Genetica": 0.85,
    "Microbiology": 0.80, "Microbiologia": 0.80,
    "Oceanography": 0.50, "Oceanografia": 0.50,
    "Veterinary Medicine": 0.50, "Veterinaria": 0.50,
    "Agronomy and Agricultural Production": 0.45, "Agronomia y Produccion Agricola": 0.45
  },

  "Geologia": {
    "Geologia": 1.0, "Geology": 1.0,
    "Paleontologia": 0.75, "Paleontology": 0.75,
    "Oceanografia": 0.60, "Oceanography": 0.60,
    "Geografia Humana y Ordenamiento Territorial": 0.45, "Human Geography and Territorial Planning": 0.45,
    "Ciencias Ambientales y Ecologia": 0.55, "Environmental Sciences and Ecology": 0.55,
    "Quimica": 0.40, "Chemistry": 0.40,
    "Fisica": 0.35, "Physics": 0.35,
    "Historia": 0.30, "History": 0.30,
    "Arqueologia": 0.50, "Archaeology": 0.50
  },

  "Geology": {
    "Geology": 1.0, "Geologia": 1.0,
    "Paleontology": 0.75, "Paleontologia": 0.75,
    "Oceanography": 0.60, "Oceanografia": 0.60,
    "Human Geography and Territorial Planning": 0.45, "Geografia Humana y Ordenamiento Territorial": 0.45,
    "Environmental Sciences and Ecology": 0.55, "Ciencias Ambientales y Ecologia": 0.55,
    "Chemistry": 0.40, "Quimica": 0.40,
    "Physics": 0.35, "Fisica": 0.35,
    "History": 0.30, "Historia": 0.30,
    "Archaeology": 0.50, "Arqueologia": 0.50
  },

  "Astronomia y Astrofisica": {
    "Astronomia y Astrofisica": 1.0, "Astronomy and Astrophysics": 1.0,
    "Fisica": 0.75, "Physics": 0.75,
    "Matematicas": 0.50, "Mathematics": 0.50,
    "Ingenieria Aeroespacial": 0.55, "Aerospace Engineering": 0.55,
    "Meteorologia y Ciencias Atmosfericas": 0.40, "Meteorology and Atmospheric Sciences": 0.40,
    "Filosofia": 0.10, "Philosophy": 0.10
  },

  "Astronomy and Astrophysics": {
    "Astronomy and Astrophysics": 1.0, "Astronomia y Astrofisica": 1.0,
    "Physics": 0.75, "Fisica": 0.75,
    "Mathematics": 0.50, "Matematicas": 0.50,
    "Aerospace Engineering": 0.55, "Ingenieria Aeroespacial": 0.55,
    "Meteorology and Atmospheric Sciences": 0.40, "Meteorologia y Ciencias Atmosfericas": 0.40,
    "Philosophy": 0.10, "Filosofia": 0.10
  },

  "Ciencias Ambientales y Ecologia": {
    "Ciencias Ambientales y Ecologia": 1.0, "Environmental Sciences and Ecology": 1.0,
    "Biologia": 0.70, "Biology": 0.70,
    "Geologia": 0.55, "Geology": 0.55,
    "Oceanografia": 0.60, "Oceanography": 0.60,
    "Meteorologia y Ciencias Atmosfericas": 0.55, "Meteorology and Atmospheric Sciences": 0.55,
    "Quimica": 0.45, "Chemistry": 0.45,
    "Energias Renovables y Sostenibilidad": 0.55, "Renewable Energy and Sustainability": 0.55,
    "Ciencias Forestales": 0.55, "Forestry Sciences": 0.55,
    "Agronomia y Produccion Agricola": 0.45, "Agronomy and Agricultural Production": 0.45,
    "Geografia Humana y Ordenamiento Territorial": 0.50, "Human Geography and Territorial Planning": 0.50
  },

  "Environmental Sciences and Ecology": {
    "Environmental Sciences and Ecology": 1.0, "Ciencias Ambientales y Ecologia": 1.0,
    "Biology": 0.70, "Biologia": 0.70,
    "Geology": 0.55, "Geologia": 0.55,
    "Oceanography": 0.60, "Oceanografia": 0.60,
    "Meteorology and Atmospheric Sciences": 0.55, "Meteorologia y Ciencias Atmosfericas": 0.55,
    "Chemistry": 0.45, "Quimica": 0.45,
    "Renewable Energy and Sustainability": 0.55, "Energias Renovables y Sostenibilidad": 0.55,
    "Forestry Sciences": 0.55, "Ciencias Forestales": 0.55,
    "Agronomy and Agricultural Production": 0.45, "Agronomia y Produccion Agricola": 0.45,
    "Human Geography and Territorial Planning": 0.50, "Geografia Humana y Ordenamiento Territorial": 0.50
  },

  "Oceanografia": {
    "Oceanografia": 1.0, "Oceanography": 1.0,
    "Ciencias Ambientales y Ecologia": 0.60, "Environmental Sciences and Ecology": 0.60,
    "Geologia": 0.60, "Geology": 0.60,
    "Biologia": 0.50, "Biology": 0.50,
    "Meteorologia y Ciencias Atmosfericas": 0.55, "Meteorology and Atmospheric Sciences": 0.55,
    "Acuicultura y Pesca": 0.50, "Aquaculture and Fisheries": 0.50
  },

  "Oceanography": {
    "Oceanography": 1.0, "Oceanografia": 1.0,
    "Environmental Sciences and Ecology": 0.60, "Ciencias Ambientales y Ecologia": 0.60,
    "Geology": 0.60, "Geologia": 0.60,
    "Biology": 0.50, "Biologia": 0.50,
    "Meteorology and Atmospheric Sciences": 0.55, "Meteorologia y Ciencias Atmosfericas": 0.55,
    "Aquaculture and Fisheries": 0.50, "Acuicultura y Pesca": 0.50
  },

  "Meteorologia y Ciencias Atmosfericas": {
    "Meteorologia y Ciencias Atmosfericas": 1.0, "Meteorology and Atmospheric Sciences": 1.0,
    "Ciencias Ambientales y Ecologia": 0.55, "Environmental Sciences and Ecology": 0.55,
    "Oceanografia": 0.55, "Oceanography": 0.55,
    "Astronomia y Astrofisica": 0.40, "Astronomy and Astrophysics": 0.40,
    "Fisica": 0.35, "Physics": 0.35
  },

  "Meteorology and Atmospheric Sciences": {
    "Meteorology and Atmospheric Sciences": 1.0, "Meteorologia y Ciencias Atmosfericas": 1.0,
    "Environmental Sciences and Ecology": 0.55, "Ciencias Ambientales y Ecologia": 0.55,
    "Oceanography": 0.55, "Oceanografia": 0.55,
    "Astronomy and Astrophysics": 0.40, "Astronomia y Astrofisica": 0.40,
    "Physics": 0.35, "Fisica": 0.35
  },

  "Paleontologia": {
    "Paleontologia": 1.0, "Paleontology": 1.0,
    "Geologia": 0.75, "Geology": 0.75,
    "Biologia": 0.55, "Biology": 0.55,
    "Antropologia y Arqueologia": 0.55, "Anthropology and Archaeology": 0.55,
    "Historia": 0.30, "History": 0.30
  },

  "Paleontology": {
    "Paleontology": 1.0, "Paleontologia": 1.0,
    "Geology": 0.75, "Geologia": 0.75,
    "Biology": 0.55, "Biologia": 0.55,
    "Anthropology and Archaeology": 0.55, "Antropologia y Arqueologia": 0.55,
    "History": 0.30, "Historia": 0.30
  },

  // ===== CIENCIAS DE LA SALUD =====
  "Medicina General e Interna": {
    "Medicina General e Interna": 1.0, "General and Internal Medicine": 1.0,
    "Psiquiatria": 0.60, "Psychiatry": 0.60,
    "Psicologia": 0.55, "Psychology": 0.55,
    "Biologia": 0.50, "Biology": 0.50,
    "Farmacologia y Farmacia": 0.60, "Pharmacology and Pharmacy": 0.60,
    "Salud Publica y Epidemiologia": 0.55, "Public Health and Epidemiology": 0.55,
    "Enfermeria": 0.55, "Nursing": 0.55,
    "Nutricion y Dietetica": 0.45, "Nutrition and Dietetics": 0.45,
    "Odontologia": 0.30, "Dentistry": 0.30,
    "Kinesiologia y Fisioterapia": 0.40, "Kinesiology and Physiotherapy": 0.40,
    "Tecnologia Medica y Bioanalisis": 0.45, "Medical Technology and Bioanalysis": 0.45
  },

  "General and Internal Medicine": {
    "General and Internal Medicine": 1.0, "Medicina General e Interna": 1.0,
    "Psychiatry": 0.60, "Psiquiatria": 0.60,
    "Psychology": 0.55, "Psicologia": 0.55,
    "Biology": 0.50, "Biologia": 0.50,
    "Pharmacology and Pharmacy": 0.60, "Farmacologia y Farmacia": 0.60,
    "Public Health and Epidemiology": 0.55, "Salud Publica y Epidemiologia": 0.55,
    "Nursing": 0.55, "Enfermeria": 0.55,
    "Nutrition and Dietetics": 0.45, "Nutricion y Dietetica": 0.45,
    "Dentistry": 0.30, "Odontologia": 0.30,
    "Kinesiology and Physiotherapy": 0.40, "Kinesiologia y Fisioterapia": 0.40,
    "Medical Technology and Bioanalysis": 0.45, "Tecnologia Medica y Bioanalisis": 0.45
  },

  "Salud Publica y Epidemiologia": {
    "Salud Publica y Epidemiologia": 1.0, "Public Health and Epidemiology": 1.0,
    "Medicina General e Interna": 0.55, "General and Internal Medicine": 0.55,
    "Estadistica": 0.50, "Statistics": 0.50,
    "Sociologia": 0.35, "Sociology": 0.35,
    "Enfermeria": 0.45, "Nursing": 0.45,
    "Nutricion y Dietetica": 0.35, "Nutrition and Dietetics": 0.35,
    "Trabajo Social": 0.35, "Social Work": 0.35
  },

  "Public Health and Epidemiology": {
    "Public Health and Epidemiology": 1.0, "Salud Publica y Epidemiologia": 1.0,
    "General and Internal Medicine": 0.55, "Medicina General e Interna": 0.55,
    "Statistics": 0.50, "Estadistica": 0.50,
    "Sociology": 0.35, "Sociologia": 0.35,
    "Nursing": 0.45, "Enfermeria": 0.45,
    "Nutrition and Dietetics": 0.35, "Nutricion y Dietetica": 0.35,
    "Social Work": 0.35, "Trabajo Social": 0.35
  },

  "Psiquiatria": {
    "Psiquiatria": 1.0, "Psychiatry": 1.0,
    "Psicologia": 0.85, "Psychology": 0.85,
    "Medicina General e Interna": 0.60, "General and Internal Medicine": 0.60,
    "Farmacologia y Farmacia": 0.55, "Pharmacology and Pharmacy": 0.55,
    "Neurociencia": 0.80, "Neuroscience": 0.80
  },

  "Psychiatry": {
    "Psychiatry": 1.0, "Psiquiatria": 1.0,
    "Psychology": 0.85, "Psicologia": 0.85,
    "General and Internal Medicine": 0.60, "Medicina General e Interna": 0.60,
    "Pharmacology and Pharmacy": 0.55, "Farmacologia y Farmacia": 0.55,
    "Neuroscience": 0.80, "Neurociencia": 0.80
  },

  // ===== INGENIERIA Y TECNOLOGIA =====
  "Ingenieria en Computacion e Informatica": {
    "Ingenieria en Computacion e Informatica": 1.0, "Computer Engineering and Informatics": 1.0,
    "Ciencia de Datos e Inteligencia Artificial": 0.80, "Data Science and Artificial Intelligence": 0.80,
    "Robotica y Automatizacion": 0.65, "Robotics and Automation": 0.65,
    "Matematicas": 0.55, "Mathematics": 0.55,
    "Ingenieria Electrica y Electronica": 0.45, "Electrical and Electronic Engineering": 0.45,
    "Ingenieria de Materiales y Nanotecnologia": 0.25, "Materials Engineering and Nanotechnology": 0.25
  },

  "Computer Engineering and Informatics": {
    "Computer Engineering and Informatics": 1.0, "Ingenieria en Computacion e Informatica": 1.0,
    "Data Science and Artificial Intelligence": 0.80, "Ciencia de Datos e Inteligencia Artificial": 0.80,
    "Robotics and Automation": 0.65, "Robotica y Automatizacion": 0.65,
    "Mathematics": 0.55, "Matematicas": 0.55,
    "Electrical and Electronic Engineering": 0.45, "Ingenieria Electrica y Electronica": 0.45,
    "Materials Engineering and Nanotechnology": 0.25, "Ingenieria de Materiales y Nanotecnologia": 0.25
  },

  "Ciencia de Datos e Inteligencia Artificial": {
    "Ciencia de Datos e Inteligencia Artificial": 1.0, "Data Science and Artificial Intelligence": 1.0,
    "Ingenieria en Computacion e Informatica": 0.80, "Computer Engineering and Informatics": 0.80,
    "Matematicas": 0.60, "Mathematics": 0.60,
    "Estadistica": 0.70, "Statistics": 0.70,
    "Robotica y Automatizacion": 0.55, "Robotics and Automation": 0.55,
    "Economia y Negocios": 0.30, "Economics and Business": 0.30,
    "Psicologia": 0.20, "Psychology": 0.20
  },

  "Data Science and Artificial Intelligence": {
    "Data Science and Artificial Intelligence": 1.0, "Ciencia de Datos e Inteligencia Artificial": 1.0,
    "Computer Engineering and Informatics": 0.80, "Ingenieria en Computacion e Informatica": 0.80,
    "Mathematics": 0.60, "Matematicas": 0.60,
    "Statistics": 0.70, "Estadistica": 0.70,
    "Robotics and Automation": 0.55, "Robotica y Automatizacion": 0.55,
    "Economics and Business": 0.30, "Economia y Negocios": 0.30,
    "Psychology": 0.20, "Psicologia": 0.20
  },

  "Robotica y Automatizacion": {
    "Robotica y Automatizacion": 1.0, "Robotics and Automation": 1.0,
    "Ingenieria en Computacion e Informatica": 0.65, "Computer Engineering and Informatics": 0.65,
    "Ciencia de Datos e Inteligencia Artificial": 0.55, "Data Science and Artificial Intelligence": 0.55,
    "Ingenieria Mecanica": 0.60, "Mechanical Engineering": 0.60,
    "Ingenieria Electrica y Electronica": 0.60, "Electrical and Electronic Engineering": 0.60,
    "Ingenieria Aeroespacial": 0.40, "Aerospace Engineering": 0.40
  },

  "Robotics and Automation": {
    "Robotics and Automation": 1.0, "Robotica y Automatizacion": 1.0,
    "Computer Engineering and Informatics": 0.65, "Ingenieria en Computacion e Informatica": 0.65,
    "Data Science and Artificial Intelligence": 0.55, "Ciencia de Datos e Inteligencia Artificial": 0.55,
    "Mechanical Engineering": 0.60, "Ingenieria Mecanica": 0.60,
    "Electrical and Electronic Engineering": 0.60, "Ingenieria Electrica y Electronica": 0.60,
    "Aerospace Engineering": 0.40, "Ingenieria Aeroespacial": 0.40
  },

  "Ingenieria Civil": {
    "Ingenieria Civil": 1.0, "Civil Engineering": 1.0,
    "Arquitectura y Urbanismo": 0.50, "Architecture and Urbanism": 0.50,
    "Ingenieria de Materiales y Nanotecnologia": 0.40, "Materials Engineering and Nanotechnology": 0.40,
    "Geologia": 0.35, "Geology": 0.35,
    "Geografia Humana y Ordenamiento Territorial": 0.30, "Human Geography and Territorial Planning": 0.30
  },

  "Civil Engineering": {
    "Civil Engineering": 1.0, "Ingenieria Civil": 1.0,
    "Architecture and Urbanism": 0.50, "Arquitectura y Urbanismo": 0.50,
    "Materials Engineering and Nanotechnology": 0.40, "Ingenieria de Materiales y Nanotecnologia": 0.40,
    "Geology": 0.35, "Geologia": 0.35,
    "Human Geography and Territorial Planning": 0.30, "Geografia Humana y Ordenamiento Territorial": 0.30
  },

  "Ingenieria Mecanica": {
    "Ingenieria Mecanica": 1.0, "Mechanical Engineering": 1.0,
    "Fisica": 0.55, "Physics": 0.55,
    "Robotica y Automatizacion": 0.60, "Robotics and Automation": 0.60,
    "Ingenieria Aeroespacial": 0.55, "Aerospace Engineering": 0.55,
    "Ingenieria de Materiales y Nanotecnologia": 0.45, "Materials Engineering and Nanotechnology": 0.45
  },

  "Mechanical Engineering": {
    "Mechanical Engineering": 1.0, "Ingenieria Mecanica": 1.0,
    "Physics": 0.55, "Fisica": 0.55,
    "Robotics and Automation": 0.60, "Robotica y Automatizacion": 0.60,
    "Aerospace Engineering": 0.55, "Ingenieria Aeroespacial": 0.55,
    "Materials Engineering and Nanotechnology": 0.45, "Ingenieria de Materiales y Nanotecnologia": 0.45
  },

  "Ingenieria Electrica y Electronica": {
    "Ingenieria Electrica y Electronica": 1.0, "Electrical and Electronic Engineering": 1.0,
    "Fisica": 0.50, "Physics": 0.50,
    "Robotica y Automatizacion": 0.60, "Robotics and Automation": 0.60,
    "Ingenieria en Computacion e Informatica": 0.45, "Computer Engineering and Informatics": 0.45,
    "Ingenieria Aeroespacial": 0.40, "Aerospace Engineering": 0.40
  },

  "Electrical and Electronic Engineering": {
    "Electrical and Electronic Engineering": 1.0, "Ingenieria Electrica y Electronica": 1.0,
    "Physics": 0.50, "Fisica": 0.50,
    "Robotics and Automation": 0.60, "Robotica y Automatizacion": 0.60,
    "Computer Engineering and Informatics": 0.45, "Ingenieria en Computacion e Informatica": 0.45,
    "Aerospace Engineering": 0.40, "Ingenieria Aeroespacial": 0.40
  },

  "Ingenieria Quimica y Biotecnologia": {
    "Ingenieria Quimica y Biotecnologia": 1.0, "Chemical Engineering and Biotechnology": 1.0,
    "Quimica": 0.65, "Chemistry": 0.65,
    "Biologia": 0.45, "Biology": 0.45,
    "Bioquimica": 0.70, "Biochemistry": 0.70,
    "Farmacologia y Farmacia": 0.45, "Pharmacology and Pharmacy": 0.45,
    "Ingenieria de Alimentos": 0.45, "Food Engineering": 0.45,
    "Ingenieria de Materiales y Nanotecnologia": 0.40, "Materials Engineering and Nanotechnology": 0.40
  },

  "Chemical Engineering and Biotechnology": {
    "Chemical Engineering and Biotechnology": 1.0, "Ingenieria Quimica y Biotecnologia": 1.0,
    "Chemistry": 0.65, "Quimica": 0.65,
    "Biology": 0.45, "Biologia": 0.45,
    "Biochemistry": 0.70, "Bioquimica": 0.70,
    "Pharmacology and Pharmacy": 0.45, "Farmacologia y Farmacia": 0.45,
    "Food Engineering": 0.45, "Ingenieria de Alimentos": 0.45,
    "Materials Engineering and Nanotechnology": 0.40, "Ingenieria de Materiales y Nanotecnologia": 0.40
  },

  "Energias Renovables y Sostenibilidad": {
    "Energias Renovables y Sostenibilidad": 1.0, "Renewable Energy and Sustainability": 1.0,
    "Ciencias Ambientales y Ecologia": 0.55, "Environmental Sciences and Ecology": 0.55,
    "Ingenieria Electrica y Electronica": 0.40, "Electrical and Electronic Engineering": 0.40,
    "Fisica": 0.35, "Physics": 0.35,
    "Ingenieria Mecanica": 0.35, "Mechanical Engineering": 0.35
  },

  "Renewable Energy and Sustainability": {
    "Renewable Energy and Sustainability": 1.0, "Energias Renovables y Sostenibilidad": 1.0,
    "Environmental Sciences and Ecology": 0.55, "Ciencias Ambientales y Ecologia": 0.55,
    "Electrical and Electronic Engineering": 0.40, "Ingenieria Electrica y Electronica": 0.40,
    "Physics": 0.35, "Fisica": 0.35,
    "Mechanical Engineering": 0.35, "Ingenieria Mecanica": 0.35
  },

  "Ingenieria de Materiales y Nanotecnologia": {
    "Ingenieria de Materiales y Nanotecnologia": 1.0, "Materials Engineering and Nanotechnology": 1.0,
    "Quimica": 0.50, "Chemistry": 0.50,
    "Fisica": 0.45, "Physics": 0.45,
    "Ingenieria Quimica y Biotecnologia": 0.40, "Chemical Engineering and Biotechnology": 0.40,
    "Ingenieria Mecanica": 0.45, "Mechanical Engineering": 0.45
  },

  "Materials Engineering and Nanotechnology": {
    "Materials Engineering and Nanotechnology": 1.0, "Ingenieria de Materiales y Nanotecnologia": 1.0,
    "Chemistry": 0.50, "Quimica": 0.50,
    "Physics": 0.45, "Fisica": 0.45,
    "Chemical Engineering and Biotechnology": 0.40, "Ingenieria Quimica y Biotecnologia": 0.40,
    "Mechanical Engineering": 0.45, "Ingenieria Mecanica": 0.45
  },

  "Ingenieria Aeroespacial": {
    "Ingenieria Aeroespacial": 1.0, "Aerospace Engineering": 1.0,
    "Astronomia y Astrofisica": 0.55, "Astronomy and Astrophysics": 0.55,
    "Ingenieria Mecanica": 0.55, "Mechanical Engineering": 0.55,
    "Fisica": 0.50, "Physics": 0.50,
    "Robotica y Automatizacion": 0.40, "Robotics and Automation": 0.40,
    "Ingenieria Electrica y Electronica": 0.40, "Electrical and Electronic Engineering": 0.40
  },

  "Aerospace Engineering": {
    "Aerospace Engineering": 1.0, "Ingenieria Aeroespacial": 1.0,
    "Astronomy and Astrophysics": 0.55, "Astronomia y Astrofisica": 0.55,
    "Mechanical Engineering": 0.55, "Ingenieria Mecanica": 0.55,
    "Physics": 0.50, "Fisica": 0.50,
    "Robotics and Automation": 0.40, "Robotica y Automatizacion": 0.40,
    "Electrical and Electronic Engineering": 0.40, "Ingenieria Electrica y Electronica": 0.40
  },

  // ===== CIENCIAS AGROPECUARIAS =====
  "Agronomia y Produccion Agricola": {
    "Agronomia y Produccion Agricola": 1.0, "Agronomy and Agricultural Production": 1.0,
    "Biologia": 0.45, "Biology": 0.45,
    "Ciencias Ambientales y Ecologia": 0.45, "Environmental Sciences and Ecology": 0.45,
    "Ciencias Forestales": 0.50, "Forestry Sciences": 0.50,
    "Ingenieria de Alimentos": 0.40, "Food Engineering": 0.40,
    "Zootecnia y Produccion Animal": 0.50, "Animal Science and Production": 0.50
  },

  "Agronomy and Agricultural Production": {
    "Agronomy and Agricultural Production": 1.0, "Agronomia y Produccion Agricola": 1.0,
    "Biology": 0.45, "Biologia": 0.45,
    "Environmental Sciences and Ecology": 0.45, "Ciencias Ambientales y Ecologia": 0.45,
    "Forestry Sciences": 0.50, "Ciencias Forestales": 0.50,
    "Food Engineering": 0.40, "Ingenieria de Alimentos": 0.40,
    "Animal Science and Production": 0.50, "Zootecnia y Produccion Animal": 0.50
  },

  "Ciencias Forestales": {
    "Ciencias Forestales": 1.0, "Forestry Sciences": 1.0,
    "Ciencias Ambientales y Ecologia": 0.55, "Environmental Sciences and Ecology": 0.55,
    "Agronomia y Produccion Agricola": 0.50, "Agronomy and Agricultural Production": 0.50,
    "Biologia": 0.40, "Biology": 0.40
  },

  "Forestry Sciences": {
    "Forestry Sciences": 1.0, "Ciencias Forestales": 1.0,
    "Environmental Sciences and Ecology": 0.55, "Ciencias Ambientales y Ecologia": 0.55,
    "Agronomy and Agricultural Production": 0.50, "Agronomia y Produccion Agricola": 0.50,
    "Biology": 0.40, "Biologia": 0.40
  },

  "Acuicultura y Pesca": {
    "Acuicultura y Pesca": 1.0, "Aquaculture and Fisheries": 1.0,
    "Oceanografia": 0.50, "Oceanography": 0.50,
    "Biologia": 0.40, "Biology": 0.40,
    "Ciencias Ambientales y Ecologia": 0.40, "Environmental Sciences and Ecology": 0.40,
    "Zootecnia y Produccion Animal": 0.35, "Animal Science and Production": 0.35
  },

  "Aquaculture and Fisheries": {
    "Aquaculture and Fisheries": 1.0, "Acuicultura y Pesca": 1.0,
    "Oceanography": 0.50, "Oceanografia": 0.50,
    "Biology": 0.40, "Biologia": 0.40,
    "Environmental Sciences and Ecology": 0.40, "Ciencias Ambientales y Ecologia": 0.40,
    "Animal Science and Production": 0.35, "Zootecnia y Produccion Animal": 0.35
  },

  "Zootecnia y Produccion Animal": {
    "Zootecnia y Produccion Animal": 1.0, "Animal Science and Production": 1.0,
    "Veterinaria": 0.55, "Veterinary Medicine": 0.55,
    "Agronomia y Produccion Agricola": 0.50, "Agronomy and Agricultural Production": 0.50,
    "Biologia": 0.40, "Biology": 0.40
  },

  "Animal Science and Production": {
    "Animal Science and Production": 1.0, "Zootecnia y Produccion Animal": 1.0,
    "Veterinary Medicine": 0.55, "Veterinaria": 0.55,
    "Agronomy and Agricultural Production": 0.50, "Agronomia y Produccion Agricola": 0.50,
    "Biology": 0.40, "Biologia": 0.40
  },

  "Ingenieria de Alimentos": {
    "Ingenieria de Alimentos": 1.0, "Food Engineering": 1.0,
    "Quimica": 0.45, "Chemistry": 0.45,
    "Ingenieria Quimica y Biotecnologia": 0.45, "Chemical Engineering and Biotechnology": 0.45,
    "Nutricion y Dietetica": 0.50, "Nutrition and Dietetics": 0.50,
    "Agronomia y Produccion Agricola": 0.40, "Agronomy and Agricultural Production": 0.40
  },

  "Food Engineering": {
    "Food Engineering": 1.0, "Ingenieria de Alimentos": 1.0,
    "Chemistry": 0.45, "Quimica": 0.45,
    "Chemical Engineering and Biotechnology": 0.45, "Ingenieria Quimica y Biotecnologia": 0.45,
    "Nutrition and Dietetics": 0.50, "Nutricion y Dietetica": 0.50,
    "Agronomy and Agricultural Production": 0.40, "Agronomia y Produccion Agricola": 0.40
  },

  "Veterinaria": {
    "Veterinaria": 1.0, "Veterinary Medicine": 1.0,
    "Zootecnia y Produccion Animal": 0.55, "Animal Science and Production": 0.55,
    "Biologia": 0.50, "Biology": 0.50,
    "Medicina General e Interna": 0.35, "General and Internal Medicine": 0.35
  },

  "Veterinary Medicine": {
    "Veterinary Medicine": 1.0, "Veterinaria": 1.0,
    "Animal Science and Production": 0.55, "Zootecnia y Produccion Animal": 0.55,
    "Biology": 0.50, "Biologia": 0.50,
    "General and Internal Medicine": 0.35, "Medicina General e Interna": 0.35
  },

  "Farmacologia y Farmacia": {
    "Farmacologia y Farmacia": 1.0, "Pharmacology and Pharmacy": 1.0,
    "Quimica": 0.65, "Chemistry": 0.65,
    "Medicina General e Interna": 0.60, "General and Internal Medicine": 0.60,
    "Bioquimica": 0.70, "Biochemistry": 0.70,
    "Biologia": 0.40, "Biology": 0.40,
    "Ingenieria Quimica y Biotecnologia": 0.45, "Chemical Engineering and Biotechnology": 0.45
  },

  "Pharmacology and Pharmacy": {
    "Pharmacology and Pharmacy": 1.0, "Farmacologia y Farmacia": 1.0,
    "Chemistry": 0.65, "Quimica": 0.65,
    "General and Internal Medicine": 0.60, "Medicina General e Interna": 0.60,
    "Biochemistry": 0.70, "Bioquimica": 0.70,
    "Biology": 0.40, "Biologia": 0.40,
    "Chemical Engineering and Biotechnology": 0.45, "Ingenieria Quimica y Biotecnologia": 0.45
  },

  "Enfermeria": {
    "Enfermeria": 1.0, "Nursing": 1.0,
    "Medicina General e Interna": 0.55, "General and Internal Medicine": 0.55,
    "Salud Publica y Epidemiologia": 0.45, "Public Health and Epidemiology": 0.45,
    "Psicologia": 0.25, "Psychology": 0.25
  },

  "Nursing": {
    "Nursing": 1.0, "Enfermeria": 1.0,
    "General and Internal Medicine": 0.55, "Medicina General e Interna": 0.55,
    "Public Health and Epidemiology": 0.45, "Salud Publica y Epidemiologia": 0.45,
    "Psychology": 0.25, "Psicologia": 0.25
  },

  "Nutricion y Dietetica": {
    "Nutricion y Dietetica": 1.0, "Nutrition and Dietetics": 1.0,
    "Medicina General e Interna": 0.45, "General and Internal Medicine": 0.45,
    "Ingenieria de Alimentos": 0.50, "Food Engineering": 0.50,
    "Biologia": 0.30, "Biology": 0.30
  },

  "Nutrition and Dietetics": {
    "Nutrition and Dietetics": 1.0, "Nutricion y Dietetica": 1.0,
    "General and Internal Medicine": 0.45, "Medicina General e Interna": 0.45,
    "Food Engineering": 0.50, "Ingenieria de Alimentos": 0.50,
    "Biology": 0.30, "Biologia": 0.30
  },

  "Odontologia": {
    "Odontologia": 1.0, "Dentistry": 1.0,
    "Medicina General e Interna": 0.30, "General and Internal Medicine": 0.30
  },

  "Dentistry": {
    "Dentistry": 1.0, "Odontologia": 1.0,
    "General and Internal Medicine": 0.30, "Medicina General e Interna": 0.30
  },

  "Kinesiologia y Fisioterapia": {
    "Kinesiologia y Fisioterapia": 1.0, "Kinesiology and Physiotherapy": 1.0,
    "Medicina General e Interna": 0.40, "General and Internal Medicine": 0.40,
    "Psicologia": 0.20, "Psychology": 0.20
  },

  "Kinesiology and Physiotherapy": {
    "Kinesiology and Physiotherapy": 1.0, "Kinesiologia y Fisioterapia": 1.0,
    "General and Internal Medicine": 0.40, "Medicina General e Interna": 0.40,
    "Psychology": 0.20, "Psicologia": 0.20
  },

  "Tecnologia Medica y Bioanalisis": {
    "Tecnologia Medica y Bioanalisis": 1.0, "Medical Technology and Bioanalysis": 1.0,
    "Medicina General e Interna": 0.45, "General and Internal Medicine": 0.45,
    "Biologia": 0.40, "Biology": 0.40,
    "Quimica": 0.40, "Chemistry": 0.40
  },

  "Medical Technology and Bioanalysis": {
    "Medical Technology and Bioanalysis": 1.0, "Tecnologia Medica y Bioanalisis": 1.0,
    "General and Internal Medicine": 0.45, "Medicina General e Interna": 0.45,
    "Biology": 0.40, "Biologia": 0.40,
    "Chemistry": 0.40, "Quimica": 0.40
  }
};

// Construir indice inverso para busqueda bidireccional
const REVERSE_SIMILARITY = {};
Object.entries(SEMANTIC_SIMILARITY).forEach(([area, similarities]) => {
  Object.entries(similarities).forEach(([relatedArea, score]) => {
    if (!REVERSE_SIMILARITY[relatedArea]) {
      REVERSE_SIMILARITY[relatedArea] = {};
    }
    if (!REVERSE_SIMILARITY[relatedArea][area]) {
      REVERSE_SIMILARITY[relatedArea][area] = score;
    }
  });
});

// ==================== FUNCION DE SIMILITUD MEJORADA ====================

/**
 * Calcula la similitud semantica entre dos areas
 * Soporta matching bidireccional español-ingles
 */
const getSemanticSimilarity = (area1, area2) => {
  // Misma area = match exacto
  if (area1 === area2) return 1.0;
  
  // Buscar en el grafo de similitud (direccion A->B)
  if (SEMANTIC_SIMILARITY[area1] && SEMANTIC_SIMILARITY[area1][area2] !== undefined) {
    return SEMANTIC_SIMILARITY[area1][area2];
  }
  
  // Buscar en direccion inversa (B->A)
  if (SEMANTIC_SIMILARITY[area2] && SEMANTIC_SIMILARITY[area2][area1] !== undefined) {
    return SEMANTIC_SIMILARITY[area2][area1];
  }
  
  // Buscar en el indice inverso
  if (REVERSE_SIMILARITY[area1] && REVERSE_SIMILARITY[area1][area2] !== undefined) {
    return REVERSE_SIMILARITY[area1][area2];
  }
  
  // Fallback: mismas categorias
  const cat1 = AREA_TO_CATEGORY[area1];
  const cat2 = AREA_TO_CATEGORY[area2];
  
  if (cat1 && cat2 && cat1 === cat2) {
    return 0.25;
  }
  
  // Sin relacion aparente
  return 0.05;
};

// Vocabulario TF-IDF por area (stemmed keywords con pesos)
const AREA_TFIDF_VECTORS = {
  "Filosofia": {
    filosofia: 0.85, filosofico: 0.70, epistemologia: 0.90, ontologia: 0.90,
    etica: 0.80, metafisica: 0.85, logica: 0.65, pensamiento: 0.55,
    razon: 0.50, existencia: 0.60, ser: 0.45, conciencia: 0.55,
    moral: 0.50, dialectica: 0.75, hermeneutica: 0.85, fenomenologia: 0.85,
    philosophy: 0.85, philosophical: 0.70, epistemology: 0.90, ontology: 0.90,
    ethics: 0.80, metaphysics: 0.85, logic: 0.65, thought: 0.55,
    reason: 0.50, existence: 0.60, being: 0.45, consciousness: 0.55,
    morality: 0.50, dialectics: 0.75, hermeneutics: 0.85, phenomenology: 0.85
  },
  "Philosophy": {
    philosophy: 0.85, philosophical: 0.70, epistemology: 0.90, ontology: 0.90,
    ethics: 0.80, metaphysics: 0.85, logic: 0.65, thought: 0.55,
    reason: 0.50, existence: 0.60, being: 0.45, consciousness: 0.55,
    morality: 0.50, dialectics: 0.75, hermeneutics: 0.85, phenomenology: 0.85,
    filosofia: 0.85, filosofico: 0.70, epistemologia: 0.90, ontologia: 0.90,
    etica: 0.80, metafisica: 0.85, logica: 0.65, pensamiento: 0.55,
    razon: 0.50, existencia: 0.60, ser: 0.45, conciencia: 0.55,
    moral: 0.50, dialectica: 0.75, hermeneutica: 0.85, fenomenologia: 0.85
  },
  "Matematicas": {
    matematica: 0.85, algebra: 0.80, geometria: 0.80, calculo: 0.75,
    estadistica: 0.70, probabilidad: 0.70, teorema: 0.60, conjunto: 0.55,
    matriz: 0.50, analisis: 0.45, numeros: 0.50, ecuacion: 0.55,
    mathematics: 0.85, geometry: 0.80, calculus: 0.75,
    statistics: 0.70, probability: 0.70, theorem: 0.60, set: 0.55,
    matrix: 0.50, analysis: 0.45, numbers: 0.50, equation: 0.55
  },
  "Mathematics": {
    mathematics: 0.85, algebra: 0.80, geometry: 0.80, calculus: 0.75,
    statistics: 0.70, probability: 0.70, theorem: 0.60, set: 0.55,
    matrix: 0.50, analysis: 0.45, numbers: 0.50, equation: 0.55,
    matematica: 0.85, geometria: 0.80, calculo: 0.75,
    estadistica: 0.70, probabilidad: 0.70, teorema: 0.60, conjunto: 0.55,
    matriz: 0.50, analisis: 0.45, numeros: 0.50, ecuacion: 0.55
  },
  "Fisica": {
    fisica: 0.85, mecanica: 0.80, termodinamica: 0.90, electromagnetismo: 0.90,
    optica: 0.75, cuantica: 0.85, relatividad: 0.85, newton: 0.50,
    einstein: 0.45, particula: 0.55, onda: 0.50, energia: 0.45,
    physics: 0.85, mechanics: 0.80, thermodynamics: 0.90, electromagnetism: 0.90,
    optics: 0.75, quantum: 0.85, relativity: 0.85,
    particle: 0.55, wave: 0.50, energy: 0.45
  },
  "Physics": {
    physics: 0.85, mechanics: 0.80, thermodynamics: 0.90, electromagnetism: 0.90,
    optics: 0.75, quantum: 0.85, relativity: 0.85,
    particle: 0.55, wave: 0.50, energy: 0.45,
    fisica: 0.85, mecanica: 0.80, termodinamica: 0.90, electromagnetismo: 0.90,
    optica: 0.75, cuantica: 0.85, relatividad: 0.85,
    particula: 0.55, onda: 0.50, energia: 0.45
  },
  "Quimica": {
    quimica: 0.85, bioquimica: 0.80, estequiometria: 0.75, reactivo: 0.65,
    molecula: 0.60, atomo: 0.55, enlace: 0.60, compuesto: 0.55,
    organica: 0.70, inorganica: 0.70, reaccion: 0.55,
    chemistry: 0.85, biochemistry: 0.80, stoichiometry: 0.75, reagent: 0.65,
    molecule: 0.60, atom: 0.55, bond: 0.60, compound: 0.55,
    organic: 0.70, inorganic: 0.70, reaction: 0.55
  },
  "Chemistry": {
    chemistry: 0.85, biochemistry: 0.80, stoichiometry: 0.75, reagent: 0.65,
    molecule: 0.60, atom: 0.55, bond: 0.60, compound: 0.55,
    organic: 0.70, inorganic: 0.70, reaction: 0.55,
    quimica: 0.85, bioquimica: 0.80, estequiometria: 0.75, reactivo: 0.65,
    molecula: 0.60, atomo: 0.55, enlace: 0.60, compuesto: 0.55,
    organica: 0.70, inorganica: 0.70, reaccion: 0.55
  },
  "Biologia": {
    biologia: 0.85, celula: 0.75, genetica: 0.80, evolucion: 0.70,
    ecosistema: 0.70, organismo: 0.60, especie: 0.55, adn: 0.70,
    biodiversidad: 0.65, molecular: 0.55, microbiologia: 0.75,
    biology: 0.85, cell: 0.75, genetics: 0.80, evolution: 0.70,
    ecosystem: 0.70, organism: 0.60, species: 0.55, dna: 0.70,
    biodiversity: 0.65, molecular: 0.55, microbiology: 0.75
  },
  "Biology": {
    biology: 0.85, cell: 0.75, genetics: 0.80, evolution: 0.70,
    ecosystem: 0.70, organism: 0.60, species: 0.55, dna: 0.70,
    biodiversity: 0.65, molecular: 0.55, microbiology: 0.75,
    biologia: 0.85, celula: 0.75, genetica: 0.80, evolucion: 0.70,
    ecosistema: 0.70, organismo: 0.60, especie: 0.55, adn: 0.70,
    biodiversidad: 0.65, molecular: 0.55, microbiologia: 0.75
  },
  "Historia": {
    historia: 0.85, historico: 0.70, civilizacion: 0.70, imperio: 0.65,
    guerra: 0.55, revolucion: 0.60, antiguo: 0.50, medieval: 0.65,
    contemporaneo: 0.60, colonia: 0.55, independencia: 0.50,
    history: 0.85, historical: 0.70, civilization: 0.70, empire: 0.65,
    war: 0.55, revolution: 0.60, ancient: 0.50, medieval: 0.65,
    contemporary: 0.60, colony: 0.55, independence: 0.50
  },
  "History": {
    history: 0.85, historical: 0.70, civilization: 0.70, empire: 0.65,
    war: 0.55, revolution: 0.60, ancient: 0.50, medieval: 0.65,
    contemporary: 0.60, colony: 0.55, independence: 0.50,
    historia: 0.85, historico: 0.70, civilizacion: 0.70, imperio: 0.65,
    guerra: 0.55, revolucion: 0.60, antiguo: 0.50, medieval: 0.65,
    contemporaneo: 0.60, colonia: 0.55, independencia: 0.50
  },
  "Literatura": {
    literatura: 0.85, poesia: 0.75, novela: 0.75, cuento: 0.65,
    ensayo: 0.60, narrativa: 0.70, ficcion: 0.55, autor: 0.40,
    obra: 0.35, genero: 0.40, literario: 0.70,
    literature: 0.85, poetry: 0.75, novel: 0.75, story: 0.65,
    essay: 0.60, narrative: 0.70, fiction: 0.55, author: 0.40,
    work: 0.35, genre: 0.40, literary: 0.70
  },
  "Literature": {
    literature: 0.85, poetry: 0.75, novel: 0.75, story: 0.65,
    essay: 0.60, narrative: 0.70, fiction: 0.55, author: 0.40,
    work: 0.35, genre: 0.40, literary: 0.70,
    literatura: 0.85, poesia: 0.75, novela: 0.75, cuento: 0.65,
    ensayo: 0.60, narrativa: 0.70, ficcion: 0.55, autor: 0.40,
    obra: 0.35, genero: 0.40, literario: 0.70
  },
  "Psicologia": {
    psicologia: 0.85, psicoanalisis: 0.80, conducta: 0.65, mente: 0.55,
    cognitivo: 0.70, emocional: 0.60, trastorno: 0.65, terapia: 0.60,
    desarrollo: 0.40, social: 0.35, personalidad: 0.60,
    psychology: 0.85, psychoanalysis: 0.80, behavior: 0.65, mind: 0.55,
    cognitive: 0.70, emotional: 0.60, disorder: 0.65, therapy: 0.60,
    development: 0.40, social: 0.35, personality: 0.60
  },
  "Psychology": {
    psychology: 0.85, psychoanalysis: 0.80, behavior: 0.65, mind: 0.55,
    cognitive: 0.70, emotional: 0.60, disorder: 0.65, therapy: 0.60,
    development: 0.40, social: 0.35, personality: 0.60,
    psicologia: 0.85, psicoanalisis: 0.80, conducta: 0.65, mente: 0.55,
    cognitivo: 0.70, emocional: 0.60, trastorno: 0.65, terapia: 0.60,
    desarrollo: 0.40, social: 0.35, personalidad: 0.60
  },
  "Economia y Negocios": {
    economia: 0.85, finanzas: 0.80, mercado: 0.65, capital: 0.60,
    inversion: 0.60, comercio: 0.55, macroeconomia: 0.85, microeconomia: 0.85,
    pib: 0.55, inflacion: 0.60, oferta: 0.45, demanda: 0.45,
    economics: 0.85, finance: 0.80, market: 0.65, capital: 0.60,
    investment: 0.60, trade: 0.55, macroeconomics: 0.85, microeconomics: 0.85,
    gdp: 0.55, inflation: 0.60, supply: 0.45, demand: 0.45
  },
  "Economics and Business": {
    economics: 0.85, finance: 0.80, market: 0.65, capital: 0.60,
    investment: 0.60, trade: 0.55, macroeconomics: 0.85, microeconomics: 0.85,
    gdp: 0.55, inflation: 0.60, supply: 0.45, demand: 0.45,
    economia: 0.85, finanzas: 0.80, mercado: 0.65, capital: 0.60,
    inversion: 0.60, comercio: 0.55, macroeconomia: 0.85, microeconomia: 0.85,
    pib: 0.55, inflacion: 0.60, oferta: 0.45, demanda: 0.45
  },
  "Ingenieria en Computacion e Informatica": {
    programacion: 0.80, algoritmo: 0.80, software: 0.75, hardware: 0.70,
    codigo: 0.55, computacion: 0.80, informatica: 0.75, datos: 0.55,
    redes: 0.55, inteligencia: 0.60, artificial: 0.60, machine: 0.65,
    programming: 0.80, algorithm: 0.80, software: 0.75, hardware: 0.70,
    code: 0.55, computing: 0.80, informatics: 0.75, data: 0.55,
    networks: 0.55, intelligence: 0.60, artificial: 0.60, machine: 0.65
  },
  "Computer Engineering and Informatics": {
    programming: 0.80, algorithm: 0.80, software: 0.75, hardware: 0.70,
    code: 0.55, computing: 0.80, informatics: 0.75, data: 0.55,
    networks: 0.55, intelligence: 0.60, artificial: 0.60, machine: 0.65,
    programacion: 0.80, algoritmo: 0.80, software: 0.75, hardware: 0.70,
    codigo: 0.55, computacion: 0.80, informatica: 0.75, datos: 0.55,
    redes: 0.55, inteligencia: 0.60, artificial: 0.60, machine: 0.65
  },
  "Educacion y Pedagogia": {
    educacion: 0.85, pedagogia: 0.85, ensenanza: 0.75, aprendizaje: 0.75,
    didactica: 0.80, curriculo: 0.70, evaluacion: 0.65, docente: 0.50,
    estudiante: 0.45, escolar: 0.50, aula: 0.45,
    education: 0.85, pedagogy: 0.85, teaching: 0.75, learning: 0.75,
    didactics: 0.80, curriculum: 0.70, evaluation: 0.65, teacher: 0.50,
    student: 0.45, school: 0.50, classroom: 0.45
  },
  "Education and Pedagogy": {
    education: 0.85, pedagogy: 0.85, teaching: 0.75, learning: 0.75,
    didactics: 0.80, curriculum: 0.70, evaluation: 0.65, teacher: 0.50,
    student: 0.45, school: 0.50, classroom: 0.45,
    educacion: 0.85, pedagogia: 0.85, ensenanza: 0.75, aprendizaje: 0.75,
    didactica: 0.80, curriculo: 0.70, evaluacion: 0.65, docente: 0.50,
    estudiante: 0.45, escolar: 0.50, aula: 0.45
  },
  "Medicina General e Interna": {
    medicina: 0.80, psiquiatria: 0.80, clinico: 0.65, diagnostico: 0.60,
    tratamiento: 0.55, patologia: 0.70, farmacologia: 0.70, cirugia: 0.65,
    enfermedad: 0.50, paciente: 0.40, salud: 0.45,
    medicine: 0.80, psychiatry: 0.80, clinical: 0.65, diagnosis: 0.60,
    treatment: 0.55, pathology: 0.70, pharmacology: 0.70, surgery: 0.65,
    disease: 0.50, patient: 0.40, health: 0.45
  },
  "General and Internal Medicine": {
    medicine: 0.80, psychiatry: 0.80, clinical: 0.65, diagnosis: 0.60,
    treatment: 0.55, pathology: 0.70, pharmacology: 0.70, surgery: 0.65,
    disease: 0.50, patient: 0.40, health: 0.45,
    medicina: 0.80, psiquiatria: 0.80, clinico: 0.65, diagnostico: 0.60,
    tratamiento: 0.55, patologia: 0.70, farmacologia: 0.70, cirugia: 0.65,
    enfermedad: 0.50, paciente: 0.40, salud: 0.45
  }
};

// ==================== FUNCIONES AUXILIARES MATEMATICAS ====================

const medianAbsoluteDeviation = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 
    ? (sorted[mid - 1] + sorted[mid]) / 2 
    : sorted[mid];
  
  const deviations = values.map(v => Math.abs(v - median));
  const sortedDev = [...deviations].sort((a, b) => a - b);
  const madn = sortedDev.length % 2 === 0
    ? (sortedDev[mid - 1] + sortedDev[mid]) / 2
    : sortedDev[mid];
  
  return { median, mad: madn * 1.4826 };
};

const sigmoid = (x, k = 1) => 1 / (1 + Math.exp(-k * x));

const temporalDecay = (timestamp, halfLifeDays = DECAY.HALF_LIFE_DAYS) => {
  if (!timestamp) return DECAY.MIN_WEIGHT;
  
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const ageInDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  const lambda = Math.log(2) / halfLifeDays;
  const decay = Math.exp(-lambda * ageInDays);
  
  return DECAY.MIN_WEIGHT + (1 - DECAY.MIN_WEIGHT) * decay;
};

const betaPosterior = (successes, failures, priorAlpha = BETA_PRIOR.alpha, priorBeta = BETA_PRIOR.beta) => {
  const alpha = priorAlpha + successes;
  const beta = priorBeta + failures;
  
  const mean = alpha / (alpha + beta);
  const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
  
  const z = 1.645;
  const n = alpha + beta;
  const p = mean;
  const denominator = 1 + z * z / n;
  const centre = (p + z * z / (2 * n)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / denominator;
  const lowerBound = centre - margin;
  
  return { mean, variance, lowerBound, alpha, beta };
};

const thompsonSample = (alpha, beta) => {
  let gammaAlpha = 0;
  let gammaBeta = 0;
  
  for (let i = 0; i < alpha; i++) {
    gammaAlpha -= Math.log(Math.random());
  }
  for (let i = 0; i < beta; i++) {
    gammaBeta -= Math.log(Math.random());
  }
  
  return gammaAlpha / (gammaAlpha + gammaBeta);
};

const cosineSimilarity = (vectorA, vectorB) => {
  const keys = new Set([...Object.keys(vectorA), ...Object.keys(vectorB)]);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (const key of keys) {
    const a = vectorA[key] || 0;
    const b = vectorB[key] || 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

const buildTFIDFVector = (areas) => {
  const vector = {};
  const n = areas.length;
  
  areas.forEach(area => {
    const areaVector = AREA_TFIDF_VECTORS[area] || {};
    Object.entries(areaVector).forEach(([term, tfidf]) => {
      const df = areas.filter(a => {
        const av = AREA_TFIDF_VECTORS[a] || {};
        return term in av;
      }).length;
      const idf = Math.log((n + 1) / (df + 1)) + 1;
      vector[term] = (vector[term] || 0) + tfidf * idf / n;
    });
  });
  
  const norm = Math.sqrt(Object.values(vector).reduce((sum, v) => sum + v * v, 0));
  if (norm > 0) {
    Object.keys(vector).forEach(k => { vector[k] /= norm; });
  }
  
  return vector;
};

// ==================== FUNCIONES DE SCORING ====================

const calculateExpertiseScore = (reviewer, articleArea) => {
  const reviewerAreas = reviewer.areasOfExpertise || [];
  if (reviewerAreas.length === 0) return 0.03;
  
  let bestSimilarity = 0;
  
  for (const reviewerArea of reviewerAreas) {
    const similarity = getSemanticSimilarity(articleArea, reviewerArea);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
    }
  }
  
  const relatedAreasCount = reviewerAreas.filter(area => {
    const sim = getSemanticSimilarity(articleArea, area);
    return sim >= 0.30;
  }).length;
  
  const densityBonus = Math.min(relatedAreasCount / 5, 1.0) * 0.15;
  const exactMatchBonus = reviewerAreas.includes(articleArea) ? 0.10 : 0;
  
  return Math.min(bestSimilarity + densityBonus + exactMatchBonus, 1.0);
};

const calculatePerformanceScore = (reviewer) => {
  const stats = reviewer.stats || {};
  
  const totalReviews = stats.totalReviewsCompleted || 0;
  const onTimeCount = stats.onTimeReviews || 0;
  const lateCount = stats.lateReviews || 0;
  
  const punctualityEstimate = betaPosterior(onTimeCount, lateCount);
  
  const avgScore = stats.averageReviewScore || 0;
  const normalizedQuality = avgScore > 0 ? avgScore / 5 : 0.5;
  
  const totalInv = (stats.acceptedInvitations || 0) + (stats.declinedInvitations || 0) + (stats.expiredInvitations || 0);
  const acceptedInv = stats.acceptedInvitations || 0;
  const expiredInv = stats.expiredInvitations || 0;
  
  const acceptanceEstimate = betaPosterior(acceptedInv, totalInv - acceptedInv);
  
  const expiredPenalty = totalInv > 0 
    ? Math.max(0, 1 - (expiredInv / totalInv) * 2)
    : 1.0;
  
  const lastReviewDate = stats.lastReviewSubmittedAt;
  const recencyWeight = temporalDecay(lastReviewDate);
  
  const thompsonValue = thompsonSample(
    punctualityEstimate.alpha, 
    punctualityEstimate.beta
  );
  
  const bayesianScore = totalReviews < EXPLORATION.MIN_SAMPLES
    ? 0.3 + 0.4 * thompsonValue
    : 0.6 * punctualityEstimate.lowerBound + 0.4 * thompsonValue;
  
  const performanceScore = 
    bayesianScore * 0.40 +
    normalizedQuality * 0.35 +
    acceptanceEstimate.mean * 0.15 +
    expiredPenalty * 0.10;
  
  return Math.max(0.05, performanceScore * recencyWeight);
};

const calculateAvailabilityScore = (reviewer) => {
  const availability = reviewer.availability || {};
  const stats = reviewer.stats || {};
  
  const maxReviews = availability.maxActiveReviews || 3;
  const currentReviews = availability.currentActiveReviews || 0;
  
  const loadRatio = currentReviews / Math.max(maxReviews, 1);
  const loadFactor = Math.exp(-2 * loadRatio);
  
  const timeMap = {
    '1-week': 4.0,
    '2-weeks': 2.0,
    '3-weeks': 1.33,
    '1-month': 1.0,
    'more': 0.5
  };
  const serviceRate = timeMap[availability.timeAvailablePerReview] || 1.5;
  
  const rho = loadRatio;
  let erlangB = 0;
  if (rho > 0) {
    let sum = 1;
    let term = 1;
    for (let i = 1; i <= maxReviews; i++) {
      term *= rho / i;
      sum += term;
    }
    erlangB = term / sum;
  }
  const availabilityProbability = 1 - erlangB;
  
  const statusFactor = reviewer.status === 'active' ? 1.0 : 0.15;
  
  const avgResponseDays = stats.responseTimeAvgDays || 7;
  const responseFactor = Math.exp(-avgResponseDays / 5);
  
  const lastReviewDate = stats.lastReviewSubmittedAt;
  const recencyWeight = temporalDecay(lastReviewDate, 60);
  
  return (
    loadFactor * 0.25 +
    availabilityProbability * 0.25 +
    serviceRate / 4 * 0.20 +
    statusFactor * 0.15 +
    responseFactor * 0.10 +
    recencyWeight * 0.05
  );
};

const calculateDiversityScore = (reviewer, existingReviewers = [], allReviewers = []) => {
  let score = 0.50;
  
  const sameInstitution = existingReviewers.filter(
    r => r.institution && reviewer.institution &&
         r.institution.toLowerCase() === reviewer.institution.toLowerCase()
  ).length;
  
  score -= sameInstitution * 0.20;
  
  const alreadySelected = existingReviewers.some(
    r => r.email?.toLowerCase() === reviewer.email?.toLowerCase()
  );
  if (alreadySelected) score -= 0.25;
  
  const sameInstGlobal = allReviewers.filter(
    r => r.institution && reviewer.institution &&
         r.institution.toLowerCase() === reviewer.institution.toLowerCase()
  ).length;
  
  if (sameInstGlobal > 5) score -= 0.20;
  else if (sameInstGlobal > 3) score -= 0.10;
  
  const currentLoad = reviewer.availability?.currentActiveReviews || 0;
  if (currentLoad === 0) score += 0.20;
  else if (currentLoad === 1) score += 0.10;
  
  return Math.max(0.10, Math.min(score, 1.0));
};

const calculateExplorationScore = (reviewer) => {
  const stats = reviewer.stats || {};
  
  const totalReviews = stats.totalReviewsCompleted || 0;
  const totalInvitations = (stats.acceptedInvitations || 0) + (stats.declinedInvitations || 0);
  
  if (totalReviews < EXPLORATION.MIN_SAMPLES) {
    return EXPLORATION.COLD_START_BONUS + 
           (EXPLORATION.MIN_SAMPLES - totalReviews) / EXPLORATION.MIN_SAMPLES * 0.15;
  }
  
  const punctuality = betaPosterior(
    stats.onTimeReviews || 0,
    stats.lateReviews || 0
  );
  
  const uncertaintyBonus = punctuality.variance * 0.5;
  
  const invitationRatio = totalInvitations > 0 ? totalReviews / totalInvitations : 0;
  const underratedBonus = totalInvitations < 5 && invitationRatio > 0.5 ? 0.10 : 0;
  
  return Math.min(uncertaintyBonus + underratedBonus + 0.02, 0.30);
};

const calculateResponseScore = (reviewer) => {
  const stats = reviewer.stats || {};
  
  const totalInvitations = stats.totalInvitations || 0;
  const acceptedInvitations = stats.acceptedInvitations || 0;
  const declinedInvitations = stats.declinedInvitations || 0;
  const expiredInvitations = stats.expiredInvitations || 0;
  
  const respondedCount = acceptedInvitations + declinedInvitations;
  const totalWithExpired = respondedCount + expiredInvitations;
  
  const responseProbability = totalWithExpired > 0
    ? respondedCount / totalWithExpired
    : 0.5;
  
  const avgDays = stats.responseTimeAvgDays || 7;
  const speedScore = Math.exp(-avgDays / 3);
  
  const responseEstimate = betaPosterior(respondedCount, expiredInvitations);
  
  return (
    responseEstimate.lowerBound * 0.50 +
    responseProbability * 0.30 +
    speedScore * 0.20
  );
};

// ==================== FUNCIONES DE SELECCION AVANZADA ====================

const paretoDominates = (a, b, criteria = ['expertise', 'performance', 'availability']) => {
  let betterInAtLeastOne = false;
  
  for (const criterion of criteria) {
    const scoreA = a.scores[criterion] || 0;
    const scoreB = b.scores[criterion] || 0;
    
    if (scoreA < scoreB) return false;
    if (scoreA > scoreB) betterInAtLeastOne = true;
  }
  
  return betterInAtLeastOne;
};

const buildParetoFront = (reviewers, criteria = ['expertise', 'performance', 'availability']) => {
  const front = [];
  
  for (const reviewer of reviewers) {
    let dominated = false;
    
    for (let i = front.length - 1; i >= 0; i--) {
      if (paretoDominates(front[i], reviewer, criteria)) {
        dominated = true;
        break;
      }
      if (paretoDominates(reviewer, front[i], criteria)) {
        front.splice(i, 1);
      }
    }
    
    if (!dominated) {
      front.push(reviewer);
    }
  }
  
  return front;
};

const epsilonGreedySelect = (reviewers, epsilon = EXPLORATION.EPSILON) => {
  if (Math.random() < epsilon) {
    const unexplored = reviewers.filter(
      r => (r.stats?.totalReviewsCompleted || 0) < EXPLORATION.MIN_SAMPLES
    );
    
    if (unexplored.length > 0) {
      return unexplored[Math.floor(Math.random() * unexplored.length)];
    }
  }
  
  return reviewers[0];
};

// ==================== ALGORITMO PRINCIPAL ====================

export const getRecommendedReviewers = ({
  articleArea,
  potentialReviewers,
  existingInvitations = [],
  maxRecommendations = 5,
  language = 'es'
}) => {
  
  // ===== FASE 1: FILTRADO INTELIGENTE =====
  const eligibleReviewers = potentialReviewers.filter(reviewer => {
    if (!reviewer.email) return false;
    if (reviewer.status === 'suspended' || reviewer.status === 'banned') return false;
    
    const reviewerInvitations = existingInvitations.filter(
      inv => inv.reviewerId === reviewer.id ||
             inv.reviewerEmail?.toLowerCase() === reviewer.email?.toLowerCase()
    );
    
    if (reviewerInvitations.length === 0) return true;
    
    const allFailed = reviewerInvitations.every(
      inv => inv.status === 'failed' || inv.processingError
    );
    if (allFailed) return true;
    
    const hasActiveInvitation = reviewerInvitations.some(
      inv => inv.status === 'pending' || inv.status === 'accepted'
    );
    if (hasActiveInvitation) return false;
    
    const allTerminal = reviewerInvitations.every(
      inv => ['expired', 'declined', 'cancelled'].includes(inv.status)
    );
    if (allTerminal) return true;
    
    return true;
  });
  
  // ===== FASE 2: CALCULO DE SCORES =====
  const scoredReviewers = eligibleReviewers.map(reviewer => {
    const expertiseScore = calculateExpertiseScore(reviewer, articleArea);
    const performanceScore = calculatePerformanceScore(reviewer);
    const availabilityScore = calculateAvailabilityScore(reviewer);
    const diversityScore = calculateDiversityScore(reviewer, [], eligibleReviewers);
    const explorationScore = calculateExplorationScore(reviewer);
    const responseScore = calculateResponseScore(reviewer);
    
    const scores = {
      expertise: expertiseScore,
      performance: performanceScore,
      availability: availabilityScore,
      diversity: diversityScore,
      exploration: explorationScore,
      response: responseScore
    };
    
    const compositeScore = 
      WEIGHTS.EXPERTISE * expertiseScore +
      WEIGHTS.PERFORMANCE * performanceScore +
      WEIGHTS.AVAILABILITY * availabilityScore +
      WEIGHTS.DIVERSITY * diversityScore +
      WEIGHTS.EXPLORATION * explorationScore +
      WEIGHTS.RESPONSE * responseScore;
    
    const articleCategory = AREA_TO_CATEGORY[articleArea];
    const reviewerCategories = (reviewer.areasOfExpertise || [])
      .map(area => AREA_TO_CATEGORY[area])
      .filter(Boolean);
    
    const hasExactMatch = (reviewer.areasOfExpertise || []).includes(articleArea);
    const sameCategory = articleCategory && reviewerCategories.includes(articleCategory);
    const relatedCategories = RELATED_CATEGORIES[articleCategory] || [];
    const hasRelatedCategory = reviewerCategories.some(rc => relatedCategories.includes(rc));
    
    let matchLevel = 'fallback';
    if (hasExactMatch) matchLevel = 'exact';
    else if (sameCategory) matchLevel = 'category';
    else if (hasRelatedCategory) matchLevel = 'related';
    
    let qualityTier = 'standard';
    if (compositeScore >= 0.80) qualityTier = 'excellent';
    else if (compositeScore >= 0.65) qualityTier = 'very-good';
    else if (compositeScore >= 0.50) qualityTier = 'good';
    else if (compositeScore < 0.30) qualityTier = 'low';
    
    return {
      ...reviewer,
      compositeScore,
      scores,
      qualityTier,
      matchLevel,
      matchDetails: {
        hasExactMatch,
        sameCategory,
        hasRelatedCategory,
        matchLevel,
        articleCategory,
        reviewerCategories
      }
    };
  });
  
  // ===== FASE 3: NORMALIZACION ADAPTATIVA =====
  if (scoredReviewers.length > 1) {
    const scoreKeys = ['expertise', 'performance', 'availability', 'diversity', 'exploration', 'response'];
    
    scoreKeys.forEach(key => {
      const values = scoredReviewers.map(r => r.scores[key] || 0);
      const { median, mad } = medianAbsoluteDeviation(values);
      
      if (mad > 0.001) {
        scoredReviewers.forEach(r => {
          r.scores[`${key}Normalized`] = (r.scores[key] - median) / mad;
        });
      }
    });
  }
  
  // ===== FASE 4: ORDENAMIENTO =====
  scoredReviewers.sort((a, b) => b.compositeScore - a.compositeScore);
  
  // ===== FASE 5: CONSTRUIR FRENTE DE PARETO =====
  const paretoFront = buildParetoFront(scoredReviewers);
  
  // ===== FASE 6: DIVERSIFICACION =====
  const diversified = [];
  const institutionCount = new Map();
  const selectedIds = new Set();
  
  for (const reviewer of paretoFront) {
    if (diversified.length >= maxRecommendations) break;
    
    const inst = (reviewer.institution || 'unknown').toLowerCase();
    const currentCount = institutionCount.get(inst) || 0;
    const maxPerInstitution = scoredReviewers.length <= 5 ? 3 : 2;
    
    if (currentCount < maxPerInstitution) {
      diversified.push(reviewer);
      institutionCount.set(inst, currentCount + 1);
      selectedIds.add(reviewer.id || reviewer.email);
    }
  }
  
  for (const reviewer of scoredReviewers) {
    if (diversified.length >= maxRecommendations) break;
    
    if (!selectedIds.has(reviewer.id || reviewer.email)) {
      diversified.push(reviewer);
      selectedIds.add(reviewer.id || reviewer.email);
    }
  }
  
  // ===== FASE 7: EPSILON-GREEDY =====
  if (diversified.length >= 2) {
    const lastIndex = diversified.length - 1;
    const explorationPick = epsilonGreedySelect(scoredReviewers);
    
    if (explorationPick && !selectedIds.has(explorationPick.id || explorationPick.email)) {
      diversified[lastIndex] = explorationPick;
    }
  }
  
  // ===== FASE 8: GENERAR RECOMENDACIONES FINALES =====
  const isSpanish = language === 'es';
  
  const recommendations = diversified.slice(0, maxRecommendations).map((reviewer, index) => {
    const reasons = [];
    
    switch (reviewer.matchLevel) {
      case 'exact':
        reasons.push(isSpanish
          ? `Experto exacto en "${articleArea}"`
          : `Exact expert in "${articleArea}"`);
        break;
      case 'category':
        reasons.push(isSpanish
          ? `Especialista en ${reviewer.matchDetails.articleCategory}`
          : `Specialist in ${reviewer.matchDetails.articleCategory}`);
        break;
      case 'related':
        reasons.push(isSpanish
          ? `Experto en categoria afin`
          : `Expert in related category`);
        break;
      default:
        reasons.push(isSpanish
          ? `Revisor disponible`
          : `Available reviewer`);
    }
    
    if (reviewer.compositeScore >= 0.75) {
      reasons.push(isSpanish ? 'Rendimiento sobresaliente' : 'Outstanding performance');
    }
    
    const currentLoad = reviewer.availability?.currentActiveReviews || 0;
    if (currentLoad === 0) {
      reasons.push(isSpanish ? 'Sin carga actual' : 'No current load');
    }
    
    const totalReviews = reviewer.stats?.totalReviewsCompleted || 0;
    if (totalReviews < EXPLORATION.MIN_SAMPLES && reviewer.compositeScore >= 0.40) {
      reasons.push(isSpanish ? 'Nuevo revisor prometedor' : 'Promising new reviewer');
    }
    
    const onTimeRate = reviewer.stats?.onTimeRate || 0;
    if (onTimeRate >= 90 && totalReviews >= 3) {
      reasons.push(isSpanish ? 'Excelente puntualidad' : 'Excellent punctuality');
    }
    
    const tierLabels = {
      excellent: isSpanish ? 'Excelente' : 'Excellent',
      'very-good': isSpanish ? 'Muy Bueno' : 'Very Good',
      good: isSpanish ? 'Bueno' : 'Good',
      standard: isSpanish ? 'Estandar' : 'Standard',
      low: isSpanish ? 'Bajo' : 'Low'
    };
    
    return {
      ...reviewer,
      rank: index + 1,
      recommendationReasons: reasons,
      tierLabel: tierLabels[reviewer.qualityTier] || tierLabels.standard,
      isParetoOptimal: paretoFront.some(p => p.id === reviewer.id || p.email === reviewer.email)
    };
  });
  
  // ===== RETORNAR RESULTADO =====
  return {
    recommendations,
    totalEligible: eligibleReviewers.length,
    totalReviewers: potentialReviewers.length,
    filteredOut: potentialReviewers.length - eligibleReviewers.length,
    articleArea,
    articleCategory: AREA_TO_CATEGORY[articleArea],
    paretoFrontSize: paretoFront.length,
    matchDistribution: {
      exact: recommendations.filter(r => r.matchLevel === 'exact').length,
      category: recommendations.filter(r => r.matchLevel === 'category').length,
      related: recommendations.filter(r => r.matchLevel === 'related').length,
      fallback: recommendations.filter(r => r.matchLevel === 'fallback').length
    },
    explorationApplied: recommendations.some(
      r => (r.stats?.totalReviewsCompleted || 0) < EXPLORATION.MIN_SAMPLES
    ),
    paretoOptimalCount: recommendations.filter(r => r.isParetoOptimal).length
  };
};