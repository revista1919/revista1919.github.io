// src/hooks/reviewerRecommendationEngine.js



const WEIGHTS = {
  EXPERTISE: 0.35,      // Coincidencia temática (reducido para dar más peso a otros factores)
  PERFORMANCE: 0.25,    // Calidad histórica
  AVAILABILITY: 0.20,   // Disponibilidad actual + carga
  DIVERSITY: 0.10,      // Diversidad institucional/geográfica
  HISTORY: 0.05,        // Lealtad y consistencia
  RESPONSE: 0.05        // Velocidad de respuesta (NUEVO)
};

// ==================== MAPEO DE CATEGORÍAS ====================
const CATEGORY_MAPPINGS = {
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
  ]
};

// Mapeo de áreas a categorías
const AREA_TO_CATEGORY = {};
Object.entries(CATEGORY_MAPPINGS).forEach(([category, areas]) => {
  areas.forEach(area => { AREA_TO_CATEGORY[area] = category; });
});

// Categorías afines para recomendación cruzada
const RELATED_CATEGORIES = {
  "Ciencias Exactas y Naturales": ["Ingeniería y Tecnología", "Ciencias Agropecuarias"],
  "Ciencias de la Salud": ["Ciencias Exactas y Naturales", "Ciencias Sociales"],
  "Ingeniería y Tecnología": ["Ciencias Exactas y Naturales", "Ciencias Agropecuarias"],
  "Ciencias Sociales": ["Humanidades", "Ciencias de la Salud"],
  "Humanidades": ["Ciencias Sociales", "Arte, Música y Cine"],
  "Ciencias Agropecuarias": ["Ciencias Exactas y Naturales", "Ingeniería y Tecnología"]
};

// Palabras clave por área para matching semántico mejorado
const AREA_KEYWORDS = {
  "Filosofía": ["filosofía", "filosófico", "epistemología", "ontología", "ética", "metafísica", "lógica", "pensamiento", "razón", "existencia", "ser", "conciencia", "moral"],
  "Matemáticas": ["matemática", "álgebra", "geometría", "cálculo", "estadística", "probabilidad", "teoría de números", "conjuntos", "matrices", "análisis matemático"],
  "Física": ["física", "mecánica", "termodinámica", "electromagnetismo", "óptica", "cuántica", "relatividad", "newton", "einstein"],
  "Química": ["química", "bioquímica", "estequiometría", "reactivo", "molécula", "átomo", "enlace", "compuesto", "orgánica", "inorgánica"],
  "Biología": ["biología", "célula", "genética", "evolución", "ecosistema", "organismo", "especie", "ADN", "biodiversidad"],
  "Historia": ["historia", "histórico", "civilización", "imperio", "guerra", "revolución", "antiguo", "medieval", "contemporáneo"],
  "Literatura": ["literatura", "poesía", "novela", "cuento", "ensayo", "narrativa", "ficción", "autor", "obra", "género literario"],
  "Psicología": ["psicología", "psicoanálisis", "conducta", "mente", "cognitivo", "emocional", "trastorno", "terapia", "freud", "jung"],
  "Economía y Negocios": ["economía", "finanzas", "mercado", "capital", "inversión", "comercio", "macroeconomía", "microeconomía", "PIB"],
  "Ciencias Políticas y Relaciones Internacionales": ["política", "gobierno", "estado", "democracia", "derecho", "internacional", "diplomacia", "geopolítica"],
  "Ingeniería en Computación e Informática": ["programación", "algoritmo", "software", "hardware", "código", "computación", "informática", "datos", "redes"],
  "Educación y Pedagogía": ["educación", "pedagogía", "enseñanza", "aprendizaje", "didáctica", "currículo", "evaluación", "docente", "estudiante"],
  "Astronomía y Astrofísica": ["astronomía", "astrofísica", "cosmos", "universo", "estrella", "planeta", "galaxia", "telescopio", "agujero negro"],
  "Arte, Música y Cine": ["arte", "música", "cine", "pintura", "escultura", "composición", "melodía", "cinematografía", "estética"],
  "Medicina General e Interna": ["medicina", "psiquiatría", "clínico", "diagnóstico", "tratamiento", "patología", "farmacología", "cirugía"],
  "Comunicación Social y Periodismo": ["comunicación", "periodismo", "medios", "debate", "discurso", "noticia", "prensa", "redes sociales", "opinión"]
};

// ==================== FUNCIONES DE CÁLCULO DE SCORES ====================

/**
 * 1. SCORE DE EXPERTISE TEMÁTICA (MEJORADO)
 * 
 * Niveles de coincidencia:
 * - Nivel 1: Coincidencia exacta de área (1.0)
 * - Nivel 2: Coincidencia por palabras clave semánticas (0.85)
 * - Nivel 3: Misma categoría (0.70)
 * - Nivel 4: Categoría relacionada/afín (0.50)
 * - Nivel 5: Sin relación aparente (0.15)
 */
const calculateExpertiseScore = (reviewer, articleArea) => {
  const reviewerAreas = reviewer.areasOfExpertise || [];
  if (reviewerAreas.length === 0) return 0.05; // Mínimo si no tiene áreas
  
  // Nivel 1: Coincidencia exacta
  if (reviewerAreas.includes(articleArea)) return 1.0;
  
  // Nivel 2: Coincidencia por palabras clave
  const articleKeywords = AREA_KEYWORDS[articleArea] || [];
  if (articleKeywords.length > 0) {
    const reviewerAreasLower = reviewerAreas.map(a => a.toLowerCase());
    const keywordMatch = articleKeywords.some(keyword => 
      reviewerAreasLower.some(area => area.includes(keyword))
    );
    if (keywordMatch) return 0.85;
  }
  
  // Nivel 3: Misma categoría
  const articleCategory = AREA_TO_CATEGORY[articleArea];
  if (!articleCategory) return 0.15;
  
  const reviewerCategories = reviewerAreas
    .map(area => AREA_TO_CATEGORY[area])
    .filter(Boolean);
  
  const sameCategory = reviewerCategories.includes(articleCategory);
  if (sameCategory) {
    // Bonus por cantidad de áreas en la misma categoría
    const categoryAreas = CATEGORY_MAPPINGS[articleCategory] || [];
    const matchesInCategory = reviewerAreas.filter(area => categoryAreas.includes(area)).length;
    const density = Math.min(matchesInCategory / Math.max(categoryAreas.length, 1), 1.0);
    return 0.55 + (density * 0.25); // Rango: 0.55 - 0.80
  }
  
  // Nivel 4: Categoría relacionada
  const relatedCategories = RELATED_CATEGORIES[articleCategory] || [];
  const hasRelatedCategory = reviewerCategories.some(rc => relatedCategories.includes(rc));
  if (hasRelatedCategory) return 0.40;
  
  // Nivel 5: Sin relación aparente
  return 0.10;
};

/**
 * 2. SCORE DE DESEMPEÑO HISTÓRICO (MEJORADO)
 * 
 * Considera:
 * - Puntualidad (onTimeRate)
 * - Calidad (averageReviewScore)
 * - Tasa de aceptación de invitaciones
 * - Experiencia (total de revisiones)
 * - Penalización por invitaciones expiradas
 */
const calculatePerformanceScore = (reviewer) => {
  const stats = reviewer.stats || {};
  
  // Factores base (0-1)
  const punctuality = Math.max((stats.onTimeRate || 50) / 100, 0.1);
  const quality = Math.max((stats.averageReviewScore || 3) / 5, 0.1);
  
  // Tasa de aceptación de invitaciones
  const totalInvitations = (stats.acceptedInvitations || 0) + (stats.declinedInvitations || 0) + (stats.expiredInvitations || 0);
  const acceptanceRate = totalInvitations > 0 
    ? (stats.acceptedInvitations || 0) / totalInvitations 
    : 0.5; // Neutral si no hay datos
  
  // Penalización por invitaciones expiradas
  const expiredRate = totalInvitations > 0 
    ? (stats.expiredInvitations || 0) / totalInvitations 
    : 0;
  const expiredPenalty = Math.max(0, 1 - expiredRate * 3); // Penalización fuerte
  
  // Media geométrica de factores principales
  const geometricMean = Math.pow(
    Math.max(punctuality, 0.01) * 
    Math.max(quality, 0.01) * 
    Math.max(acceptanceRate, 0.01) * 
    Math.max(expiredPenalty, 0.01),
    1/4
  );
  
  // Bonus por experiencia
  const totalReviews = stats.totalReviewsCompleted || 0;
  const experienceBonus = Math.min(totalReviews / 15, 0.25); // +0.25 por 15+ revisiones
  
  // Bonus por consistencia (múltiples rondas)
  const roundsParticipated = stats.totalRoundsParticipated || 0;
  const consistencyBonus = Math.min(roundsParticipated / 8, 0.1); // +0.1 por 8+ rondas
  
  return Math.min(geometricMean + experienceBonus + consistencyBonus, 1.0);
};

/**
 * 3. SCORE DE DISPONIBILIDAD (MEJORADO)
 * 
 * Considera:
 * - Carga actual vs capacidad máxima
 * - Tiempo disponible para revisar
 * - Estado activo/suspendido
 * - Tiempo promedio de respuesta
 * - Última actividad
 */
const calculateAvailabilityScore = (reviewer) => {
  const availability = reviewer.availability || {};
  const stats = reviewer.stats || {};
  
  const maxReviews = availability.maxActiveReviews || 3;
  const currentReviews = availability.currentActiveReviews || 0;
  
  // Factor de carga (0-1): 1 = sin carga, decae exponencialmente
  const loadRatio = currentReviews / Math.max(maxReviews, 1);
  const loadFactor = Math.max(0, Math.pow(1 - loadRatio, 1.5)); // Curva más pronunciada
  
  // Factor de tiempo disponible
  const timeMap = {
    '1-week': 1.0,
    '2-weeks': 0.85,
    '3-weeks': 0.65,
    '1-month': 0.45,
    'more': 0.25
  };
  const timeFactor = timeMap[availability.timeAvailablePerReview] || 0.6;
  
  // Factor de estado
  const statusFactor = reviewer.status === 'active' ? 1.0 : 0.2;
  
  // Factor de respuesta rápida
  const avgResponseDays = stats.avgResponseTimeDays || 7;
  const responseFactor = Math.max(0, 1 - (avgResponseDays / 10)); // 10 días = 0
  
  // Factor de última actividad (si no ha revisado en 6 meses, penalizar)
  const lastReviewDate = stats.lastReviewSubmittedAt ? new Date(stats.lastReviewSubmittedAt) : null;
  const monthsSinceLastReview = lastReviewDate 
    ? (Date.now() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    : 12;
  const recencyFactor = Math.max(0.3, 1 - (monthsSinceLastReview / 12)); // Mínimo 0.3
  
  // Ponderación
  return (
    loadFactor * 0.35 +
    timeFactor * 0.20 +
    statusFactor * 0.20 +
    responseFactor * 0.15 +
    recencyFactor * 0.10
  );
};

/**
 * 4. SCORE DE DIVERSIDAD (MEJORADO)
 * 
 * Evita:
 * - Sobrecargar una misma institución
 * - Usar siempre los mismos revisores
 * - Falta de diversidad geográfica
 */
const calculateDiversityScore = (reviewer, existingReviewers = [], allReviewers = []) => {
  let score = 0.50; // Base neutral
  
  // Bonus por institución diferente
  const sameInstitution = existingReviewers.some(
    r => r.institution && reviewer.institution && 
         r.institution.toLowerCase() === reviewer.institution.toLowerCase()
  );
  if (!sameInstitution) score += 0.20;
  
  // Bonus si el revisor no ha sido usado recientemente
  const alreadyUsed = existingReviewers.some(
    r => r.email?.toLowerCase() === reviewer.email?.toLowerCase()
  );
  if (!alreadyUsed) score += 0.15;
  
  // Bonus por baja carga actual (favorece revisores disponibles)
  const currentLoad = reviewer.availability?.currentActiveReviews || 0;
  if (currentLoad === 0) score += 0.10;
  else if (currentLoad === 1) score += 0.05;
  
  // Penalización si ya hay muchos revisores de la misma institución
  const sameInstCount = allReviewers.filter(
    r => r.institution && reviewer.institution &&
         r.institution.toLowerCase() === reviewer.institution.toLowerCase()
  ).length;
  if (sameInstCount > 3) score -= 0.10; // Demasiados de la misma institución
  
  return Math.max(0.1, Math.min(score, 1.0));
};

/**
 * 5. SCORE DE HISTORIAL CON LA REVISTA (MEJORADO)
 */
const calculateHistoryScore = (reviewer) => {
  const stats = reviewer.stats || {};
  
  const totalReviews = stats.totalReviewsCompleted || 0;
  const roundsParticipated = stats.totalRoundsParticipated || 0;
  
  // Lealtad: proporción de rondas participadas
  const loyaltyFactor = Math.min(roundsParticipated / 8, 1.0);
  
  // Consistencia: revisiones por ronda
  const consistencyFactor = roundsParticipated > 0 
    ? Math.min(totalReviews / (roundsParticipated * 2), 1.0)
    : 0.0;
  
  // Antigüedad: tiempo desde la primera revisión
  const firstReviewDate = stats.lastReviewSubmittedAt ? new Date(stats.lastReviewSubmittedAt) : null;
  const monthsSinceFirstReview = firstReviewDate 
    ? (Date.now() - firstReviewDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    : 0;
  const seniorityFactor = Math.min(monthsSinceFirstReview / 24, 1.0); // 2 años = máximo
  
  return (loyaltyFactor * 0.4 + consistencyFactor * 0.3 + seniorityFactor * 0.3);
};

/**
 * 6. SCORE DE VELOCIDAD DE RESPUESTA (NUEVO)
 * 
 * Evalúa qué tan rápido responde el revisor a las invitaciones
 */
const calculateResponseScore = (reviewer) => {
  const stats = reviewer.stats || {};
  
  // Tiempo promedio de respuesta a invitaciones (días)
  const avgResponseDays = stats.avgResponseTimeDays;
  
  if (avgResponseDays === undefined || avgResponseDays === null) return 0.5; // Sin datos
  
  if (avgResponseDays <= 1) return 1.0;    // Responde en 1 día o menos
  if (avgResponseDays <= 2) return 0.9;
  if (avgResponseDays <= 3) return 0.8;
  if (avgResponseDays <= 5) return 0.65;
  if (avgResponseDays <= 7) return 0.5;
  if (avgResponseDays <= 10) return 0.3;
  if (avgResponseDays <= 14) return 0.15;
  return 0.05; // Más de 2 semanas
};

// ==================== ALGORITMO PRINCIPAL ====================

/**
 * SISTEMA DE RECOMENDACIÓN INTELIGENTE
 * 
 * Mejoras:
 * - Filtro inteligente: excluye invitados activos, permite expirados/declinados
 * - Keywords semánticas para matching mejorado
 * - Categorías afines para ampliar recomendaciones
 * - Score de respuesta para priorizar revisores rápidos
 * - Diversificación institucional mejorada
 * - Penalización por invitaciones expiradas
 */
export const getRecommendedReviewers = ({
  articleArea,
  potentialReviewers,
  existingInvitations = [],
  maxRecommendations = 5,
  language = 'es'
}) => {
  
  // 1. FILTRADO INTELIGENTE
  const eligibleReviewers = potentialReviewers.filter(reviewer => {
    // Verificar si ya tiene una invitación ACTIVA (no expirada ni declinada)
    const hasActiveInvitation = existingInvitations.some(
      inv => (inv.reviewerId === reviewer.id || inv.reviewerEmail === reviewer.email) &&
             inv.status !== 'expired' && 
             inv.status !== 'declined' &&
             inv.status !== 'cancelled'
    );
    
    if (hasActiveInvitation) return false;
    
    // No recomendar revisores suspendidos o baneados
    if (reviewer.status === 'suspended' || reviewer.status === 'banned') return false;
    
    // No recomendar revisores sin email
    if (!reviewer.email) return false;
    
    return true;
  });
  
  // 2. CÁLCULO DE SCORES
  const scoredReviewers = eligibleReviewers.map(reviewer => {
    const expertiseScore = calculateExpertiseScore(reviewer, articleArea);
    const performanceScore = calculatePerformanceScore(reviewer);
    const availabilityScore = calculateAvailabilityScore(reviewer);
    const diversityScore = calculateDiversityScore(reviewer, [], eligibleReviewers);
    const historyScore = calculateHistoryScore(reviewer);
    const responseScore = calculateResponseScore(reviewer);
    
    // Score compuesto ponderado
    const compositeScore = 
      WEIGHTS.EXPERTISE * expertiseScore +
      WEIGHTS.PERFORMANCE * performanceScore +
      WEIGHTS.AVAILABILITY * availabilityScore +
      WEIGHTS.DIVERSITY * diversityScore +
      WEIGHTS.HISTORY * historyScore +
      WEIGHTS.RESPONSE * responseScore;
    
    // Score breakdown detallado
    const scoreBreakdown = {
      expertise: +(WEIGHTS.EXPERTISE * expertiseScore).toFixed(3),
      performance: +(WEIGHTS.PERFORMANCE * performanceScore).toFixed(3),
      availability: +(WEIGHTS.AVAILABILITY * availabilityScore).toFixed(3),
      diversity: +(WEIGHTS.DIVERSITY * diversityScore).toFixed(3),
      history: +(WEIGHTS.HISTORY * historyScore).toFixed(3),
      response: +(WEIGHTS.RESPONSE * responseScore).toFixed(3)
    };
    
    // Determinar nivel de coincidencia
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
    
    // Etiqueta de calidad
    let qualityTier = 'standard';
    if (compositeScore >= 0.80) qualityTier = 'excellent';
    else if (compositeScore >= 0.65) qualityTier = 'very-good';
    else if (compositeScore >= 0.50) qualityTier = 'good';
    else if (compositeScore < 0.30) qualityTier = 'low';
    
    return {
      ...reviewer,
      compositeScore,
      scoreBreakdown,
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
  
  // 3. ORDENAMIENTO POR SCORE
  scoredReviewers.sort((a, b) => b.compositeScore - a.compositeScore);
  
  // 4. DIVERSIFICACIÓN INTELIGENTE
  const diversified = [];
  const institutionCount = new Map();
  
  // Primera pasada: priorizar matchLevel + diversidad institucional
  for (const reviewer of scoredReviewers) {
    if (diversified.length >= maxRecommendations) break;
    
    const inst = (reviewer.institution || 'unknown').toLowerCase();
    const currentCount = institutionCount.get(inst) || 0;
    
    // Máximo 2 por institución, pero sin límite si hay pocos revisores
    const maxPerInstitution = scoredReviewers.length <= 5 ? 3 : 2;
    
    if (currentCount < maxPerInstitution) {
      diversified.push(reviewer);
      institutionCount.set(inst, currentCount + 1);
    }
  }
  
  // Segunda pasada: llenar slots restantes con los mejores
  if (diversified.length < maxRecommendations) {
    for (const reviewer of scoredReviewers) {
      if (diversified.length >= maxRecommendations) break;
      if (!diversified.find(d => d.id === reviewer.id)) {
        diversified.push(reviewer);
      }
    }
  }
  
  // 5. GENERAR RECOMENDACIONES FINALES
  const isSpanish = language === 'es';
  
  const recommendations = diversified.slice(0, maxRecommendations).map((reviewer, index) => {
    const reasons = [];
    
    // Razones basadas en matchLevel
    switch (reviewer.matchLevel) {
      case 'exact':
        reasons.push(isSpanish 
          ? `✅ Experto exacto en "${articleArea}"` 
          : `✅ Exact expert in "${articleArea}"`);
        break;
      case 'category':
        reasons.push(isSpanish 
          ? `📚 Especialista en la misma categoría (${reviewer.matchDetails.articleCategory})` 
          : `📚 Specialist in same category (${reviewer.matchDetails.articleCategory})`);
        break;
      case 'related':
        reasons.push(isSpanish 
          ? `🔗 Experto en categoría afín` 
          : `🔗 Expert in related category`);
        break;
      default:
        reasons.push(isSpanish 
          ? `📋 Revisor disponible en el sistema` 
          : `📋 Available reviewer in system`);
    }
    
    // Razones de rendimiento
    if (reviewer.compositeScore >= 0.75) {
      reasons.push(isSpanish ? '⭐ Rendimiento sobresaliente' : '⭐ Outstanding performance');
    } else if (reviewer.compositeScore >= 0.60) {
      reasons.push(isSpanish ? '👍 Buen rendimiento histórico' : '👍 Good historical performance');
    }
    
    // Razones de disponibilidad
    const currentLoad = reviewer.availability?.currentActiveReviews || 0;
    const maxLoad = reviewer.availability?.maxActiveReviews || 3;
    
    if (currentLoad === 0) {
      reasons.push(isSpanish ? '🟢 Sin carga actual' : '🟢 No current load');
    } else if (currentLoad < maxLoad) {
      reasons.push(isSpanish 
        ? `🟡 Capacidad disponible (${currentLoad}/${maxLoad})` 
        : `🟡 Capacity available (${currentLoad}/${maxLoad})`);
    }
    
    // Razones de experiencia
    const totalReviews = reviewer.stats?.totalReviewsCompleted || 0;
    if (totalReviews >= 5) {
      reasons.push(isSpanish 
        ? `📝 ${totalReviews} revisiones completadas` 
        : `📝 ${totalReviews} reviews completed`);
    }
    
    // Razones de puntualidad
    const onTimeRate = reviewer.stats?.onTimeRate || 0;
    if (onTimeRate >= 90) {
      reasons.push(isSpanish ? '⏰ Excelente puntualidad' : '⏰ Excellent punctuality');
    }
    
    const tierLabels = {
      excellent: isSpanish ? '🌟 Excelente' : '🌟 Excellent',
      'very-good': isSpanish ? '✅ Muy Bueno' : '✅ Very Good',
      good: isSpanish ? '👍 Bueno' : '👍 Good',
      standard: isSpanish ? '📋 Estándar' : '📋 Standard',
      low: isSpanish ? '⚠️ Bajo' : '⚠️ Low'
    };
    
    return {
      ...reviewer,
      rank: index + 1,
      recommendationReasons: reasons,
      tierLabel: tierLabels[reviewer.qualityTier] || tierLabels.standard
    };
  });
  
  // 6. RETORNAR RESULTADO
  return {
    recommendations,
    totalEligible: eligibleReviewers.length,
    totalReviewers: potentialReviewers.length,
    filteredOut: potentialReviewers.length - eligibleReviewers.length,
    articleArea,
    articleCategory: AREA_TO_CATEGORY[articleArea],
    fallbackActivated: recommendations.every(r => r.matchLevel === 'fallback'),
    matchDistribution: {
      exact: recommendations.filter(r => r.matchLevel === 'exact').length,
      category: recommendations.filter(r => r.matchLevel === 'category').length,
      related: recommendations.filter(r => r.matchLevel === 'related').length,
      fallback: recommendations.filter(r => r.matchLevel === 'fallback').length
    }
  };
};