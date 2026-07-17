// src/hooks/reviewerRecommendationEngine.js

/**
 * SISTEMA DE RECOMENDACIÓN DE REVISORES - REVISTA NACIONAL DE LAS CIENCIAS
 * 
 * Fórmula de puntuación compuesta:
 * S(R) = α·S_expertise(R) + β·S_performance(R) + γ·S_availability(R) + δ·S_diversity(R) + ε·S_history(R)
 * 
 * Donde:
 * - S_expertise: Coincidencia temática (0-1)
 * - S_performance: Calidad histórica como revisor (0-1)
 * - S_availability: Capacidad actual para revisar (0-1)
 * - S_diversity: Diversidad institucional/geográfica (0-1)
 * - S_history: Historial con esta revista (0-1)
 * 
 * Pesos configurables:
 * α=0.40, β=0.25, γ=0.20, δ=0.10, ε=0.05
 */

const WEIGHTS = {
  EXPERTISE: 0.40,    // Coincidencia temática es lo más importante
  PERFORMANCE: 0.25,  // Calidad histórica
  AVAILABILITY: 0.20, // Disponibilidad actual
  DIVERSITY: 0.10,    // Diversidad institucional
  HISTORY: 0.05       // Historial con la revista
};

// Mapeo de categorías principales para fallback semántico
const CATEGORY_MAPPINGS = {
  // Español
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
    "Robótica y Automatización", "Ingeniería de Materiales y Nanotecnología",
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
    "Estudios Culturales", "Arte, Música y Cine", 
    "Arquitectura y Urbanismo"
  ],
  "Ciencias Agropecuarias": [
    "Agronomía y Producción Agrícola", "Ciencias Forestales",
    "Acuicultura y Pesca", "Zootecnia y Producción Animal", 
    "Ingeniería de Alimentos"
  ],
  // Inglés
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
    "Robotics and Automation", "Materials Science and Nanotechnology",
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
    "Cultural Studies", "Art, Music and Film", 
    "Architecture and Urbanism"
  ],
  "Agricultural Sciences": [
    "Agronomy and Agricultural Production", "Forestry Sciences",
    "Aquaculture and Fisheries", "Animal Science and Production", 
    "Food Engineering"
  ]
};

// Mapeo de áreas a categorías (bidireccional español-inglés)
const AREA_TO_CATEGORY = {};
Object.entries(CATEGORY_MAPPINGS).forEach(([category, areas]) => {
  areas.forEach(area => {
    AREA_TO_CATEGORY[area] = category;
  });
});

// Mapeo de traducción español ↔ inglés para categorías
const CATEGORY_TRANSLATIONS = {
  "Ciencias Exactas y Naturales": "Exact and Natural Sciences",
  "Ciencias de la Salud": "Health Sciences",
  "Ingeniería y Tecnología": "Engineering and Technology",
  "Ciencias Sociales": "Social Sciences",
  "Humanidades": "Humanities",
  "Ciencias Agropecuarias": "Agricultural Sciences",
  "Exact and Natural Sciences": "Ciencias Exactas y Naturales",
  "Health Sciences": "Ciencias de la Salud",
  "Engineering and Technology": "Ingeniería y Tecnología",
  "Social Sciences": "Ciencias Sociales",
  "Humanities": "Humanidades",
  "Agricultural Sciences": "Ciencias Agropecuarias"
};
/**
 * 1. SCORE DE EXPERTISE TEMÁTICA
 * 
 * Algoritmo de coincidencia semántica multinivel:
 * - Nivel 1: Coincidencia exacta en subárea (peso 1.0)
 * - Nivel 2: Coincidencia en categoría macro (peso 0.6)
 * - Nivel 3: Áreas relacionadas dentro de la categoría (peso 0.3)
 * 
 * Con fallback: si no hay revisores exactos, escala a categoría macro
 * y pondera por densidad de áreas en esa categoría
 */
const calculateExpertiseScore = (reviewer, articleArea) => {
  const reviewerAreas = reviewer.areasOfExpertise || [];
  
  // Nivel 1: Coincidencia exacta
  const exactMatch = reviewerAreas.includes(articleArea);
  if (exactMatch) return 1.0;
  
  // Determinar categoría del artículo
  const articleCategory = AREA_TO_CATEGORY[articleArea];
  if (!articleCategory) return 0.0;
  
  // Nivel 2: Coincidencia en categoría macro
  const reviewerCategory = AREA_TO_CATEGORY[reviewerAreas[0]];
  const sameCategory = reviewerCategory === articleCategory || 
                        CATEGORY_TRANSLATIONS[reviewerCategory] === articleCategory;
  
  if (sameCategory) {
    // Contar áreas del revisor en esta categoría
    const categoryAreas = CATEGORY_MAPPINGS[articleCategory] || 
                          CATEGORY_MAPPINGS[CATEGORY_TRANSLATIONS[articleCategory]] || [];
    
    const matchesInCategory = reviewerAreas.filter(area => 
      categoryAreas.includes(area)
    ).length;
    
    // Densidad normalizada (0.3 - 0.9)
    const density = Math.min(matchesInCategory / categoryAreas.length, 1.0);
    return 0.3 + (density * 0.6); // Rango: 0.3 - 0.9
  }
  
  // Nivel 3: Áreas relacionadas (categorías afines)
  return 0.1; // Mínimo por estar en el sistema
};

/**
 * 2. SCORE DE DESEMPEÑO HISTÓRICO
 * 
 * Fórmula: S_perf = (P_puntualidad × P_calidad × P_aceptación) ^ (1/3)
 * Media geométrica para penalizar desequilibrios
 */
const calculatePerformanceScore = (reviewer) => {
  const stats = reviewer.stats || {};
  
  const punctuality = (stats.onTimeRate || 100) / 100;     // 0-1
  const quality = (stats.averageReviewScore || 3) / 5;      // 0-1 (normalizado a escala 5)
  const acceptance = (stats.acceptanceRate || 50) / 100;    // 0-1
  
  // Media geométrica: penaliza fuertemente si algún factor es bajo
  const geometricMean = Math.pow(
    Math.max(punctuality, 0.01) * 
    Math.max(quality, 0.01) * 
    Math.max(acceptance, 0.01), 
    1/3
  );
  
  // Bonus por experiencia
  const totalReviews = stats.totalReviewsCompleted || 0;
  const experienceBonus = Math.min(totalReviews / 20, 0.2); // Máximo +0.2 por 20+ revisiones
  
  return Math.min(geometricMean + experienceBonus, 1.0);
};

/**
 * 3. SCORE DE DISPONIBILIDAD
 * 
 * Considera carga actual, capacidad máxima y tiempo de respuesta
 */
const calculateAvailabilityScore = (reviewer) => {
  const availability = reviewer.availability || {};
  
  const maxReviews = availability.maxActiveReviews || 3;
  const currentReviews = availability.currentActiveReviews || 0;
  
  // Factor de carga (0-1): 1 = sin carga, 0 = lleno
  const loadFactor = Math.max(0, 1 - (currentReviews / maxReviews));
  
  // Factor de tiempo disponible
  const timeMap = {
    '1-week': 1.0,
    '2-weeks': 0.9,
    '3-weeks': 0.7,
    '1-month': 0.5
  };
  const timeFactor = timeMap[availability.timeAvailablePerReview] || 0.7;
  
  // Factor de estado activo
  const isActive = reviewer.status === 'active' ? 1.0 : 0.3;
  
  // Factor de respuesta rápida
  const responseTime = reviewer.stats?.responseTimeAvgDays || 7;
  const responseFactor = Math.max(0, 1 - (responseTime / 14)); // 14 días = 0
  
  return (loadFactor * 0.5 + timeFactor * 0.2 + isActive * 0.2 + responseFactor * 0.1);
};

/**
 * 4. SCORE DE DIVERSIDAD
 * 
 * Evita sobrecargar instituciones o regiones
 */
const calculateDiversityScore = (reviewer, existingReviewers = []) => {
  let score = 0.5; // Base neutral
  
  // Si ya hay revisores de la misma institución
  const sameInstitution = existingReviewers.some(
    r => r.institution === reviewer.institution
  );
  
  if (!sameInstitution) {
    score += 0.3; // Bonus por diversidad institucional
  }
  
  // Si el revisor no ha revisado este artículo antes
  const alreadyInvited = existingReviewers.some(
    r => r.email === reviewer.email
  );
  
  if (!alreadyInvited) {
    score += 0.2; // Bonus por no repetición
  }
  
  return Math.min(score, 1.0);
};

/**
 * 5. SCORE DE HISTORIAL CON LA REVISTA
 * 
 * Revisores frecuentes y confiables tienen ventaja
 */
const calculateHistoryScore = (reviewer) => {
  const stats = reviewer.stats || {};
  
  const totalReviews = stats.totalReviewsCompleted || 0;
  const roundsParticipated = stats.totalRoundsParticipated || 0;
  
  // Factor de lealtad (0-1)
  const loyaltyFactor = Math.min(roundsParticipated / 10, 1.0);
  
  // Factor de consistencia (0-1)
  const consistencyFactor = totalReviews > 0 
    ? Math.min(totalReviews / roundsParticipated / 3, 1.0) // 3 revisiones por ronda = consistente
    : 0.0;
  
  return (loyaltyFactor * 0.6 + consistencyFactor * 0.4);
};
/**
 * ALGORITMO PRINCIPAL DE RECOMENDACIÓN
 * 
 * 1. Filtra revisores ya invitados o que declinaron
 * 2. Calcula score compuesto para cada revisor
 * 3. Ordena por score descendente
 * 4. Aplica diversificación (evita recomendar solo de una institución)
 * 5. Retorna top N recomendaciones
 */
export const getRecommendedReviewers = ({
  articleArea,
  potentialReviewers,
  existingInvitations = [],
  maxRecommendations = 5,
  language = 'es'
}) => {
  
  // 1. FILTRADO INICIAL
  const eligibleReviewers = potentialReviewers.filter(reviewer => {
    // No recomendar revisores ya invitados
    const alreadyInvited = existingInvitations.some(
      inv => inv.reviewerId === reviewer.id || inv.reviewerEmail === reviewer.email
    );
    if (alreadyInvited) return false;
    
    // No recomendar revisores inactivos o suspendidos
    if (reviewer.status === 'suspended' || reviewer.status === 'banned') return false;
    
    return true;
  });
  
  // 2. CÁLCULO DE SCORES
  const scoredReviewers = eligibleReviewers.map(reviewer => {
    const expertiseScore = calculateExpertiseScore(reviewer, articleArea);
    const performanceScore = calculatePerformanceScore(reviewer);
    const availabilityScore = calculateAvailabilityScore(reviewer);
    const diversityScore = calculateDiversityScore(reviewer, []);
    const historyScore = calculateHistoryScore(reviewer);
    
    // Score compuesto ponderado
    const compositeScore = 
      WEIGHTS.EXPERTISE * expertiseScore +
      WEIGHTS.PERFORMANCE * performanceScore +
      WEIGHTS.AVAILABILITY * availabilityScore +
      WEIGHTS.DIVERSITY * diversityScore +
      WEIGHTS.HISTORY * historyScore;
    
    // Detalles para transparencia
    const scoreBreakdown = {
      expertise: (WEIGHTS.EXPERTISE * expertiseScore).toFixed(3),
      performance: (WEIGHTS.PERFORMANCE * performanceScore).toFixed(3),
      availability: (WEIGHTS.AVAILABILITY * availabilityScore).toFixed(3),
      diversity: (WEIGHTS.DIVERSITY * diversityScore).toFixed(3),
      history: (WEIGHTS.HISTORY * historyScore).toFixed(3)
    };
    
    // Etiqueta de calidad
    let qualityTier = 'standard';
    if (compositeScore >= 0.8) qualityTier = 'excellent';
    else if (compositeScore >= 0.65) qualityTier = 'very-good';
    else if (compositeScore >= 0.5) qualityTier = 'good';
    else if (compositeScore < 0.3) qualityTier = 'low';
    
    return {
      ...reviewer,
      compositeScore,
      scoreBreakdown,
      qualityTier,
      matchDetails: {
        hasExactMatch: reviewer.areasOfExpertise?.includes(articleArea),
        sameCategory: AREA_TO_CATEGORY[reviewer.areasOfExpertise?.[0]] === 
                     AREA_TO_CATEGORY[articleArea],
        matchLevel: reviewer.areasOfExpertise?.includes(articleArea) 
          ? 'exact' 
          : AREA_TO_CATEGORY[reviewer.areasOfExpertise?.[0]] === AREA_TO_CATEGORY[articleArea]
            ? 'category'
            : 'fallback'
      }
    };
  });
  
  // 3. ORDENAMIENTO
  scoredReviewers.sort((a, b) => b.compositeScore - a.compositeScore);
  
  // 4. DIVERSIFICACIÓN
  const diversified = [];
  const usedInstitutions = new Set();
  
  // Primera pasada: tomar los mejores de cada institución
  for (const reviewer of scoredReviewers) {
    if (diversified.length >= maxRecommendations) break;
    
    const institution = reviewer.institution || 'unknown';
    
    // Permitir máximo 2 revisores por institución
    const institutionCount = diversified.filter(
      r => r.institution === institution
    ).length;
    
    if (institutionCount < 2) {
      diversified.push(reviewer);
      usedInstitutions.add(institution);
    }
  }
  
  // Si no hay suficientes, agregar los mejores restantes
  if (diversified.length < maxRecommendations) {
    for (const reviewer of scoredReviewers) {
      if (diversified.length >= maxRecommendations) break;
      if (!diversified.includes(reviewer)) {
        diversified.push(reviewer);
      }
    }
  }
  
  // 5. GENERAR EXPLICACIONES
  const recommendations = diversified.slice(0, maxRecommendations).map((reviewer, index) => {
    const reasons = [];
    const isSpanish = language === 'es';
    
    if (reviewer.matchDetails.matchLevel === 'exact') {
      reasons.push(isSpanish 
        ? `Experto exacto en "${articleArea}"` 
        : `Exact expert in "${articleArea}"`);
    } else if (reviewer.matchDetails.matchLevel === 'category') {
      reasons.push(isSpanish 
        ? `Especialista en categoría afín con ${reviewer.areasOfExpertise?.length || 0} áreas` 
        : `Specialist in related category with ${reviewer.areasOfExpertise?.length || 0} areas`);
    }
    
    if (reviewer.compositeScore >= 0.8) {
      reasons.push(isSpanish ? 'Rendimiento excepcional' : 'Outstanding performance');
    }
    
    if ((reviewer.availability?.currentActiveReviews || 0) === 0) {
      reasons.push(isSpanish ? 'Disponible inmediatamente' : 'Immediately available');
    }
    
    return {
      ...reviewer,
      rank: index + 1,
      recommendationReasons: reasons,
      tierLabel: isSpanish 
        ? { excellent: '🌟 Excelente', 'very-good': '✅ Muy Bueno', good: '👍 Bueno', standard: '📋 Estándar', low: '⚠️ Bajo' }[reviewer.qualityTier]
        : { excellent: '🌟 Excellent', 'very-good': '✅ Very Good', good: '👍 Good', standard: '📋 Standard', low: '⚠️ Low' }[reviewer.qualityTier]
    };
  });
  
  return {
    recommendations,
    totalEligible: eligibleReviewers.length,
    articleArea,
    articleCategory: AREA_TO_CATEGORY[articleArea],
    fallbackActivated: recommendations.every(r => r.matchDetails.matchLevel === 'fallback')
  };
};