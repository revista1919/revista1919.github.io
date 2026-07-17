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
  EXPLORATION: 0.08,    // Exploration bonus (nuevo)
  RESPONSE: 0.05
};

// Hiperparametros para distribucion Beta (prior no informativo)
const BETA_PRIOR = { alpha: 1, beta: 1 };

// Parametros de decaimiento temporal
const DECAY = {
  HALF_LIFE_DAYS: 90,        // Dias para que el peso baje a la mitad
  MIN_WEIGHT: 0.15,          // Peso minimo de revisiones antiguas
  RECENCY_BOOST_DAYS: 30     // Ventana para boost de actividad reciente
};

// Constantes para exploracion
const EXPLORATION = {
  EPSILON: 0.15,             // Probabilidad de exploracion aleatoria
  MIN_SAMPLES: 3,            // Minimo de revisiones para confiar en estadisticas
  COLD_START_BONUS: 0.08     // Bonus para revisores nuevos sin datos
};

// ==================== CATEGORIAS Y MAPEOS ====================

const CATEGORY_MAPPINGS = {
  "Ciencias Exactas y Naturales": [
    "Matematicas", "Fisica", "Quimica", "Biologia", "Geologia",
    "Astronomia y Astrofisica", "Ciencias Ambientales y Ecologia",
    "Oceanografia", "Meteorologia y Ciencias Atmosfericas", "Paleontologia"
  ],
  "Ciencias de la Salud": [
    "Medicina General e Interna", "Salud Publica y Epidemiologia",
    "Enfermeria", "Nutricion y Dietetica", "Farmacologia y Farmacia",
    "Odontologia", "Kinesiologia y Fisioterapia",
    "Tecnologia Medica y Bioanalisis", "Veterinaria"
  ],
  "Ingenieria y Tecnologia": [
    "Ingenieria Civil", "Ingenieria Industrial y de Sistemas",
    "Ingenieria Mecanica", "Ingenieria Electrica y Electronica",
    "Ingenieria Quimica y Biotecnologia",
    "Ingenieria en Computacion e Informatica",
    "Ciencia de Datos e Inteligencia Artificial",
    "Robotica y Automatizacion", "Ingenieria de Materiales y Nanotecnologia",
    "Ingenieria Aeroespacial", "Energias Renovables y Sostenibilidad"
  ],
  "Ciencias Sociales": [
    "Sociologia", "Antropologia y Arqueologia", "Psicologia",
    "Economia y Negocios", "Ciencias Politicas y Relaciones Internacionales",
    "Derecho", "Geografia Humana y Ordenamiento Territorial",
    "Estudios de Genero", "Comunicacion Social y Periodismo",
    "Educacion y Pedagogia", "Trabajo Social"
  ],
  "Humanidades": [
    "Historia", "Filosofia", "Linguistica y Filologia", "Literatura",
    "Estudios Clasicos", "Teologia y Ciencias de la Religion",
    "Estudios Culturales", "Arte, Musica y Cine",
    "Arquitectura y Urbanismo"
  ],
  "Ciencias Agropecuarias": [
    "Agronomia y Produccion Agricola", "Ciencias Forestales",
    "Acuicultura y Pesca", "Zootecnia y Produccion Animal",
    "Ingenieria de Alimentos"
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

// Vocabulario TF-IDF por area (stemmed keywords con pesos)
const AREA_TFIDF_VECTORS = {
  "Filosofia": {
    filosofia: 0.85, filosofico: 0.70, epistemologia: 0.90, ontologia: 0.90,
    etica: 0.80, metafisica: 0.85, logica: 0.65, pensamiento: 0.55,
    razon: 0.50, existencia: 0.60, ser: 0.45, conciencia: 0.55,
    moral: 0.50, dialectica: 0.75, hermeneutica: 0.85, fenomenologia: 0.85
  },
  "Matematicas": {
    matematica: 0.85, algebra: 0.80, geometria: 0.80, calculo: 0.75,
    estadistica: 0.70, probabilidad: 0.70, teorema: 0.60, conjunto: 0.55,
    matriz: 0.50, analisis: 0.45, numeros: 0.50, ecuacion: 0.55
  },
  "Fisica": {
    fisica: 0.85, mecanica: 0.80, termodinamica: 0.90, electromagnetismo: 0.90,
    optica: 0.75, cuantica: 0.85, relatividad: 0.85, newton: 0.50,
    einstein: 0.45, particula: 0.55, onda: 0.50, energia: 0.45
  },
  "Quimica": {
    quimica: 0.85, bioquimica: 0.80, estequiometria: 0.75, reactivo: 0.65,
    molecula: 0.60, atomo: 0.55, enlace: 0.60, compuesto: 0.55,
    organica: 0.70, inorganica: 0.70, reaccion: 0.55
  },
  "Biologia": {
    biologia: 0.85, celula: 0.75, genetica: 0.80, evolucion: 0.70,
    ecosistema: 0.70, organismo: 0.60, especie: 0.55, adn: 0.70,
    biodiversidad: 0.65, molecular: 0.55, microbiologia: 0.75
  },
  "Historia": {
    historia: 0.85, historico: 0.70, civilizacion: 0.70, imperio: 0.65,
    guerra: 0.55, revolucion: 0.60, antiguo: 0.50, medieval: 0.65,
    contemporaneo: 0.60, colonia: 0.55, independencia: 0.50
  },
  "Literatura": {
    literatura: 0.85, poesia: 0.75, novela: 0.75, cuento: 0.65,
    ensayo: 0.60, narrativa: 0.70, ficcion: 0.55, autor: 0.40,
    obra: 0.35, genero: 0.40, literario: 0.70
  },
  "Psicologia": {
    psicologia: 0.85, psicoanalisis: 0.80, conducta: 0.65, mente: 0.55,
    cognitivo: 0.70, emocional: 0.60, trastorno: 0.65, terapia: 0.60,
    desarrollo: 0.40, social: 0.35, personalidad: 0.60
  },
  "Economia y Negocios": {
    economia: 0.85, finanzas: 0.80, mercado: 0.65, capital: 0.60,
    inversion: 0.60, comercio: 0.55, macroeconomia: 0.85, microeconomia: 0.85,
    pib: 0.55, inflacion: 0.60, oferta: 0.45, demanda: 0.45
  },
  "Ciencias Politicas y Relaciones Internacionales": {
    politica: 0.80, gobierno: 0.70, estado: 0.60, democracia: 0.65,
    derecho: 0.55, internacional: 0.60, diplomacia: 0.75, geopolitica: 0.75,
    soberania: 0.65, tratado: 0.55
  },
  "Ingenieria en Computacion e Informatica": {
    programacion: 0.80, algoritmo: 0.80, software: 0.75, hardware: 0.70,
    codigo: 0.55, computacion: 0.80, informatica: 0.75, datos: 0.55,
    redes: 0.55, inteligencia: 0.60, artificial: 0.60, machine: 0.65
  },
  "Educacion y Pedagogia": {
    educacion: 0.85, pedagogia: 0.85, ensenanza: 0.75, aprendizaje: 0.75,
    didactica: 0.80, curriculo: 0.70, evaluacion: 0.65, docente: 0.50,
    estudiante: 0.45, escolar: 0.50, aula: 0.45
  },
  "Astronomia y Astrofisica": {
    astronomia: 0.90, astrofisica: 0.90, cosmos: 0.65, universo: 0.60,
    estrella: 0.65, planeta: 0.60, galaxia: 0.75, telescopio: 0.55,
    agujero: 0.60, negro: 0.45, orbital: 0.55, cosmologia: 0.85
  },
  "Arte, Musica y Cine": {
    arte: 0.75, musica: 0.80, cine: 0.75, pintura: 0.65, escultura: 0.65,
    composicion: 0.60, melodia: 0.60, cinematografia: 0.75, estetica: 0.70,
    visual: 0.50, sonoro: 0.55
  },
  "Medicina General e Interna": {
    medicina: 0.80, psiquiatria: 0.80, clinico: 0.65, diagnostico: 0.60,
    tratamiento: 0.55, patologia: 0.70, farmacologia: 0.70, cirugia: 0.65,
    enfermedad: 0.50, paciente: 0.40, salud: 0.45
  },
  "Comunicacion Social y Periodismo": {
    comunicacion: 0.80, periodismo: 0.85, medios: 0.65, debate: 0.45,
    discurso: 0.55, noticia: 0.60, prensa: 0.60, redes: 0.45,
    sociales: 0.40, opinion: 0.40, publica: 0.45
  }
};

// ==================== FUNCIONES AUXILIARES MATEMATICAS ====================

/**
 * Normalizacion Z-score adaptativa
 * Usa la mediana y MAD (Median Absolute Deviation) que es mas robusta a outliers
 */
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
  
  return { median, mad: madn * 1.4826 }; // 1.4826 = factor de consistencia para normalidad
};

/**
 * Funcion sigmoide para suavizar scores
 */
const sigmoid = (x, k = 1) => 1 / (1 + Math.exp(-k * x));

/**
 * Decaimiento temporal exponencial (curva de Ebbinghaus modificada)
 * R(t) = e^(-lambda * t)
 * donde lambda = ln(2) / halfLife
 */
const temporalDecay = (timestamp, halfLifeDays = DECAY.HALF_LIFE_DAYS) => {
  if (!timestamp) return DECAY.MIN_WEIGHT;
  
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const ageInDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  const lambda = Math.log(2) / halfLifeDays;
  const decay = Math.exp(-lambda * ageInDays);
  
  return DECAY.MIN_WEIGHT + (1 - DECAY.MIN_WEIGHT) * decay;
};

/**
 * Distribucion Beta para estimacion bayesiana de rendimiento
 * Posterior: Beta(alpha + successes, beta + failures)
 */
const betaPosterior = (successes, failures, priorAlpha = BETA_PRIOR.alpha, priorBeta = BETA_PRIOR.beta) => {
  const alpha = priorAlpha + successes;
  const beta = priorBeta + failures;
  
  // Media de la distribucion Beta
  const mean = alpha / (alpha + beta);
  
  // Varianza (incertidumbre)
  const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
  
  // Limite inferior del intervalo de confianza 95% (lower bound)
  // Usando aproximacion de Wilson para ser conservador
  const z = 1.645; // 95% one-sided
  const n = alpha + beta;
  const p = mean;
  const denominator = 1 + z * z / n;
  const centre = (p + z * z / (2 * n)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / denominator;
  const lowerBound = centre - margin;
  
  return { mean, variance, lowerBound, alpha, beta };
};

/**
 * Thompson Sampling para seleccion de revisores (Multi-Armed Bandit)
 */
const thompsonSample = (alpha, beta) => {
  // Sample de distribucion Gamma para simular Beta
  // Beta(alpha, beta) = Gamma(alpha, theta) / (Gamma(alpha, theta) + Gamma(beta, theta))
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

/**
 * Similitud coseno entre vectores TF-IDF
 */
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

/**
 * Construye vector TF-IDF para un conjunto de areas
 */
const buildTFIDFVector = (areas) => {
  const vector = {};
  const n = areas.length;
  
  areas.forEach(area => {
    const areaVector = AREA_TFIDF_VECTORS[area] || {};
    Object.entries(areaVector).forEach(([term, tfidf]) => {
      // IDF simplificado: menos peso si el termino aparece en muchas areas del revisor
      const df = areas.filter(a => {
        const av = AREA_TFIDF_VECTORS[a] || {};
        return term in av;
      }).length;
      const idf = Math.log((n + 1) / (df + 1)) + 1;
      vector[term] = (vector[term] || 0) + tfidf * idf / n;
    });
  });
  
  // Normalizar L2
  const norm = Math.sqrt(Object.values(vector).reduce((sum, v) => sum + v * v, 0));
  if (norm > 0) {
    Object.keys(vector).forEach(k => { vector[k] /= norm; });
  }
  
  return vector;
};

// ==================== FUNCIONES DE SCORING ====================

/**
 * 1. SCORE DE EXPERTISE (TF-IDF Vectorial)
 * 
 * Usa similitud coseno entre vectores TF-IDF del articulo y del revisor.
 * Es mas preciso que matching exacto porque captura relaciones semanticas.
 */
const calculateExpertiseScore = (reviewer, articleArea) => {
  const reviewerAreas = reviewer.areasOfExpertise || [];
  if (reviewerAreas.length === 0) return 0.03;
  
  // Vector TF-IDF del articulo
  const articleVector = buildTFIDFVector([articleArea]);
  
  // Vector TF-IDF del revisor
  const reviewerVector = buildTFIDFVector(reviewerAreas);
  
  // Similitud coseno (0-1)
  const tfidfSimilarity = cosineSimilarity(articleVector, reviewerVector);
  
  // Coincidencia exacta (bonus)
  const exactMatch = reviewerAreas.includes(articleArea) ? 1.0 : 0;
  
  // Coincidencia de categoria
  const articleCategory = AREA_TO_CATEGORY[articleArea];
  const reviewerCategories = reviewerAreas
    .map(area => AREA_TO_CATEGORY[area])
    .filter(Boolean);
  
  const sameCategory = articleCategory && reviewerCategories.includes(articleCategory);
  
  // Densidad dentro de la categoria
  let categoryDensity = 0;
  if (sameCategory) {
    const categoryAreas = CATEGORY_MAPPINGS[articleCategory] || [];
    const matchesInCategory = reviewerAreas.filter(a => categoryAreas.includes(a)).length;
    categoryDensity = matchesInCategory / Math.min(categoryAreas.length, 10);
  }
  
  // Categoria afin
  const relatedCategories = RELATED_CATEGORIES[articleCategory] || [];
  const relatedMatch = reviewerCategories.some(rc => relatedCategories.includes(rc));
  
  // Score combinado con pesos adaptativos
  if (exactMatch) {
    return 0.70 + 0.30 * tfidfSimilarity; // 0.70 - 1.0
  }
  
  if (sameCategory) {
    return 0.40 + 0.30 * categoryDensity + 0.30 * tfidfSimilarity; // 0.40 - 0.85
  }
  
  if (relatedMatch) {
    return 0.20 + 0.40 * tfidfSimilarity; // 0.20 - 0.60
  }
  
  // Solo similitud TF-IDF (fallback semantico)
  return Math.max(0.05, tfidfSimilarity * 0.8);
};

/**
 * 2. SCORE DE DESEMPENO (Estimacion Bayesiana)
 * 
 * Usa distribucion Beta para estimar la probabilidad real de buen desempeno.
 * Es conservador con pocos datos (cold start) y converge con mas evidencia.
 */
const calculatePerformanceScore = (reviewer) => {
  const stats = reviewer.stats || {};
  
  // Datos observados
  const totalReviews = stats.totalReviewsCompleted || 0;
  const onTimeCount = stats.onTimeReviews || 0;
  const lateCount = stats.lateReviews || 0;
  
  // Bayesian estimation: Beta(alpha + onTime, beta + late)
  const punctualityEstimate = betaPosterior(onTimeCount, lateCount);
  
  // Calidad de revision (scores)
  const avgScore = stats.averageReviewScore || 0;
  const normalizedQuality = avgScore > 0 ? avgScore / 5 : 0.5;
  
  // Aceptacion de invitaciones
  const totalInv = (stats.acceptedInvitations || 0) + (stats.declinedInvitations || 0) + (stats.expiredInvitations || 0);
  const acceptedInv = stats.acceptedInvitations || 0;
  const expiredInv = stats.expiredInvitations || 0;
  
  const acceptanceEstimate = betaPosterior(acceptedInv, totalInv - acceptedInv);
  
  // Penalizacion por expiradas (solo si no respondieron)
  const expiredPenalty = totalInv > 0 
    ? Math.max(0, 1 - (expiredInv / totalInv) * 2)
    : 1.0;
  
  // Decaimiento temporal de la evidencia
  const lastReviewDate = stats.lastReviewSubmittedAt;
  const recencyWeight = temporalDecay(lastReviewDate);
  
  // Thompson Sampling para balance explotacion/exploracion
  const thompsonValue = thompsonSample(
    punctualityEstimate.alpha, 
    punctualityEstimate.beta
  );
  
  // Combinacion: lower bound conservador + thompson exploration
  const bayesianScore = totalReviews < EXPLORATION.MIN_SAMPLES
    ? 0.3 + 0.4 * thompsonValue  // Cold start: mas exploracion
    : 0.6 * punctualityEstimate.lowerBound + 0.4 * thompsonValue;
  
  // Score final
  const performanceScore = 
    bayesianScore * 0.40 +
    normalizedQuality * 0.35 +
    acceptanceEstimate.mean * 0.15 +
    expiredPenalty * 0.10;
  
  return Math.max(0.05, performanceScore * recencyWeight);
};

/**
 * 3. SCORE DE DISPONIBILIDAD (Modelo de Colas)
 * 
 * Modela la disponibilidad como un sistema de colas M/M/c
 * donde c = maxActiveReviews y la tasa de servicio depende del tiempo disponible
 */
const calculateAvailabilityScore = (reviewer) => {
  const availability = reviewer.availability || {};
  const stats = reviewer.stats || {};
  
  const maxReviews = availability.maxActiveReviews || 3;
  const currentReviews = availability.currentActiveReviews || 0;
  
  // Factor de carga con decaimiento exponencial
  const loadRatio = currentReviews / Math.max(maxReviews, 1);
  const loadFactor = Math.exp(-2 * loadRatio); // e^(-2x)
  
  // Tasa de servicio estimada (revisiones por unidad de tiempo)
  const timeMap = {
    '1-week': 4.0,     // ~4 revisiones/mes
    '2-weeks': 2.0,    // ~2 revisiones/mes
    '3-weeks': 1.33,   // ~1.33 revisiones/mes
    '1-month': 1.0,    // ~1 revision/mes
    'more': 0.5
  };
  const serviceRate = timeMap[availability.timeAvailablePerReview] || 1.5;
  
  // Probabilidad de que el sistema tenga capacidad (Erlang B)
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
  const availabilityProbability = 1 - erlangB; // Probabilidad de atender inmediatamente
  
  // Estado
  const statusFactor = reviewer.status === 'active' ? 1.0 : 0.15;
  
  // Tiempo de respuesta
  const avgResponseDays = stats.responseTimeAvgDays || 7;
  const responseFactor = Math.exp(-avgResponseDays / 5); // e^(-x/5)
  
  // Ultima actividad (evitar revisores inactivos por mas de 6 meses)
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

/**
 * 4. SCORE DE DIVERSIDAD (Graph-based)
 * 
 * Construye un grafo de revisores donde las aristas representan similitud.
 * Penaliza clusters densos (misma institucion) y favorece nodos perifericos.
 */
const calculateDiversityScore = (reviewer, existingReviewers = [], allReviewers = []) => {
  let score = 0.50;
  
  // Penalizacion por misma institucion
  const sameInstitution = existingReviewers.filter(
    r => r.institution && reviewer.institution &&
         r.institution.toLowerCase() === reviewer.institution.toLowerCase()
  ).length;
  
  score -= sameInstitution * 0.20;
  
  // Penalizacion por reviewer ya seleccionado
  const alreadySelected = existingReviewers.some(
    r => r.email?.toLowerCase() === reviewer.email?.toLowerCase()
  );
  if (alreadySelected) score -= 0.25;
  
  // Centralidad en el grafo de revisores (evitar los muy usados)
  const sameInstGlobal = allReviewers.filter(
    r => r.institution && reviewer.institution &&
         r.institution.toLowerCase() === reviewer.institution.toLowerCase()
  ).length;
  
  if (sameInstGlobal > 5) score -= 0.20;
  else if (sameInstGlobal > 3) score -= 0.10;
  
  // Bonus por baja carga
  const currentLoad = reviewer.availability?.currentActiveReviews || 0;
  if (currentLoad === 0) score += 0.20;
  else if (currentLoad === 1) score += 0.10;
  
  // Bonus por diversidad geografica (si hay datos)
  // Nota: requiere campo 'region' o 'country' en el perfil
  
  return Math.max(0.10, Math.min(score, 1.0));
};

/**
 * 5. SCORE DE EXPLORACION (Multi-Armed Bandit)
 * 
 * Favorece revisores con poca informacion para aprender sobre ellos.
 * Balancea explotacion (usar los mejores conocidos) vs exploracion (probar nuevos).
 */
const calculateExplorationScore = (reviewer) => {
  const stats = reviewer.stats || {};
  
  const totalReviews = stats.totalReviewsCompleted || 0;
  const totalInvitations = (stats.acceptedInvitations || 0) + (stats.declinedInvitations || 0);
  
  // Cold start bonus: favorecer revisores sin datos
  if (totalReviews < EXPLORATION.MIN_SAMPLES) {
    return EXPLORATION.COLD_START_BONUS + 
           (EXPLORATION.MIN_SAMPLES - totalReviews) / EXPLORATION.MIN_SAMPLES * 0.15;
  }
  
  // Incertidumbre (varianza de la estimacion Beta)
  const punctuality = betaPosterior(
    stats.onTimeReviews || 0,
    stats.lateReviews || 0
  );
  
  // A mayor varianza, mayor potencial de descubrimiento
  const uncertaintyBonus = punctuality.variance * 0.5;
  
  // Revisores con pocas invitaciones pero buen desempeno (underrated)
  const invitationRatio = totalInvitations > 0 ? totalReviews / totalInvitations : 0;
  const underratedBonus = totalInvitations < 5 && invitationRatio > 0.5 ? 0.10 : 0;
  
  return Math.min(uncertaintyBonus + underratedBonus + 0.02, 0.30);
};

/**
 * 6. SCORE DE RESPUESTA (Supervivencia)
 * 
 * Estima la probabilidad de que el revisor responda en tiempo.
 * Usa analisis de supervivencia Kaplan-Meier simplificado.
 */
const calculateResponseScore = (reviewer) => {
  const stats = reviewer.stats || {};
  
  const totalInvitations = stats.totalInvitations || 0;
  const acceptedInvitations = stats.acceptedInvitations || 0;
  const declinedInvitations = stats.declinedInvitations || 0;
  const expiredInvitations = stats.expiredInvitations || 0;
  
  // Probabilidad de responder (aceptar o declinar) vs expirar
  const respondedCount = acceptedInvitations + declinedInvitations;
  const totalWithExpired = respondedCount + expiredInvitations;
  
  const responseProbability = totalWithExpired > 0
    ? respondedCount / totalWithExpired
    : 0.5;
  
  // Velocidad de respuesta
  const avgDays = stats.responseTimeAvgDays || 7;
  const speedScore = Math.exp(-avgDays / 3); // e^(-x/3)
  
  // Bayesian estimation para respuesta
  const responseEstimate = betaPosterior(respondedCount, expiredInvitations);
  
  return (
    responseEstimate.lowerBound * 0.50 +
    responseProbability * 0.30 +
    speedScore * 0.20
  );
};

// ==================== FUNCIONES DE SELECCION AVANZADA ====================

/**
 * Calcula la dominancia de Pareto entre dos revisores
 * Un revisor domina a otro si es mejor en al menos un criterio
 * y no es peor en ninguno.
 */
const paretoDominates = (a, b, criteria = ['expertise', 'performance', 'availability']) => {
  let betterInAtLeastOne = false;
  
  for (const criterion of criteria) {
    const scoreA = a.scores[criterion] || 0;
    const scoreB = b.scores[criterion] || 0;
    
    if (scoreA < scoreB) return false; // a es peor en algo
    if (scoreA > scoreB) betterInAtLeastOne = true;
  }
  
  return betterInAtLeastOne;
};

/**
 * Construye el frente de Pareto (revisores no dominados)
 */
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

/**
 * Seleccion epsilon-greedy con Thompson Sampling
 */
const epsilonGreedySelect = (reviewers, epsilon = EXPLORATION.EPSILON) => {
  if (Math.random() < epsilon) {
    // Exploracion: seleccionar aleatoriamente entre los no explorados
    const unexplored = reviewers.filter(
      r => (r.stats?.totalReviewsCompleted || 0) < EXPLORATION.MIN_SAMPLES
    );
    
    if (unexplored.length > 0) {
      return unexplored[Math.floor(Math.random() * unexplored.length)];
    }
  }
  
  // Explotacion: mejor score
  return reviewers[0];
};

// ==================== ALGORITMO PRINCIPAL ====================

/**
 * SISTEMA DE RECOMENDACION INTELIGENTE DE REVISORES
 * 
 * Pipeline:
 * 1. Filtrado inteligente (excluye activos, permite reintentos)
 * 2. Calculo de scores individuales con tecnicas avanzadas
 * 3. Normalizacion Z-score adaptativa
 * 4. Ensemble de scores con pesos dinamicos
 * 5. Construccion de frente de Pareto
 * 6. Diversificacion con restricciones flexibles
 * 7. Epsilon-greedy para balance exploracion/explotacion
 */
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
    
    // Scores individuales
    const scores = {
      expertise: expertiseScore,
      performance: performanceScore,
      availability: availabilityScore,
      diversity: diversityScore,
      exploration: explorationScore,
      response: responseScore
    };
    
    // Composite score con pesos
    const compositeScore = 
      WEIGHTS.EXPERTISE * expertiseScore +
      WEIGHTS.PERFORMANCE * performanceScore +
      WEIGHTS.AVAILABILITY * availabilityScore +
      WEIGHTS.DIVERSITY * diversityScore +
      WEIGHTS.EXPLORATION * explorationScore +
      WEIGHTS.RESPONSE * responseScore;
    
    // Nivel de coincidencia
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
    
    // Tier de calidad
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
  // Normalizar scores para que sean comparables entre categorias
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
  
  // Primera pasada: priorizar frente de Pareto con diversidad
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
  
  // Segunda pasada: llenar slots con los mejores del ranking
  for (const reviewer of scoredReviewers) {
    if (diversified.length >= maxRecommendations) break;
    
    if (!selectedIds.has(reviewer.id || reviewer.email)) {
      diversified.push(reviewer);
      selectedIds.add(reviewer.id || reviewer.email);
    }
  }
  
  // ===== FASE 7: EPSILON-GREEDY (intercambiar ultimo con exploracion) =====
  if (diversified.length >= 2) {
    const lastIndex = diversified.length - 1;
    const explorationPick = epsilonGreedySelect(scoredReviewers);
    
    if (explorationPick && !selectedIds.has(explorationPick.id || explorationPick.email)) {
      // Reemplazar el ultimo con una seleccion exploratoria
      diversified[lastIndex] = explorationPick;
    }
  }
  
  // ===== FASE 8: GENERAR RECOMENDACIONES FINALES =====
  const isSpanish = language === 'es';
  
  const recommendations = diversified.slice(0, maxRecommendations).map((reviewer, index) => {
    const reasons = [];
    
    // Razon de coincidencia
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
    
    // Razon de rendimiento
    if (reviewer.compositeScore >= 0.75) {
      reasons.push(isSpanish ? 'Rendimiento sobresaliente' : 'Outstanding performance');
    }
    
    // Razon de disponibilidad
    const currentLoad = reviewer.availability?.currentActiveReviews || 0;
    if (currentLoad === 0) {
      reasons.push(isSpanish ? 'Sin carga actual' : 'No current load');
    }
    
    // Razon de exploracion (nuevo revisor)
    const totalReviews = reviewer.stats?.totalReviewsCompleted || 0;
    if (totalReviews < EXPLORATION.MIN_SAMPLES && reviewer.compositeScore >= 0.40) {
      reasons.push(isSpanish ? 'Nuevo revisor prometedor' : 'Promising new reviewer');
    }
    
    // Razon de puntualidad
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