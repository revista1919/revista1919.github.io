// scripts/normalizeReviewerAreas.js
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

/**
 * MAPA DE NORMALIZACIÓN DE ÁREAS
 * 
 * Cada área personalizada se mapea a un área oficial del sistema.
 * Las áreas oficiales deben existir en CATEGORY_MAPPINGS de reviewerRecommendationEngine.js
 * 
 * Categorías disponibles:
 * - Ciencias Exactas y Naturales: Matemáticas, Física, Química, Biología, Geología,
 *   Astronomía y Astrofísica, Ciencias Ambientales y Ecología, Oceanografía,
 *   Meteorología y Ciencias Atmosféricas, Paleontología
 * - Ciencias de la Salud: Medicina General e Interna, Salud Pública y Epidemiología,
 *   Enfermería, Nutrición y Dietética, Farmacología y Farmacia, Odontología,
 *   Kinesiología y Fisioterapia, Tecnología Médica y Bioanálisis, Veterinaria
 * - Ingeniería y Tecnología: Ingeniería Civil, Ingeniería Industrial y de Sistemas,
 *   Ingeniería Mecánica, Ingeniería Eléctrica y Electrónica,
 *   Ingeniería Química y Biotecnología, Ingeniería en Computación e Informática,
 *   Ciencia de Datos e Inteligencia Artificial, Robótica y Automatización,
 *   Ingeniería de Materiales y Nanotecnología, Ingeniería Aeroespacial,
 *   Energías Renovables y Sostenibilidad
 * - Ciencias Sociales: Sociología, Antropología y Arqueología, Psicología,
 *   Economía y Negocios, Ciencias Políticas y Relaciones Internacionales,
 *   Derecho, Geografía Humana y Ordenamiento Territorial, Estudios de Género,
 *   Comunicación Social y Periodismo, Educación y Pedagogía, Trabajo Social
 * - Humanidades: Historia, Filosofía, Lingüística y Filología, Literatura,
 *   Estudios Clásicos, Teología y Ciencias de la Religión, Estudios Culturales,
 *   Arte, Música y Cine, Arquitectura y Urbanismo
 * - Ciencias Agropecuarias: Agronomía y Producción Agrícola, Ciencias Forestales,
 *   Acuicultura y Pesca, Zootecnia y Producción Animal, Ingeniería de Alimentos
 */

const AREA_NORMALIZATION_MAP = {
  // ==================== MATEMÁTICAS ====================
  "Matemática": "Matemáticas",
  "Mathematics": "Matemáticas",
  "Matemáticas": "Matemáticas",
  "Álgebra": "Matemáticas",
  "Algebra": "Matemáticas",
  "Geometría": "Matemáticas",
  "Geometry": "Matemáticas",
  "Cálculo": "Matemáticas",
  "Análisis matemático": "Matemáticas",
  "Mathematical analysis": "Matemáticas",
  "Matrices": "Matemáticas",
  "Teoría de números": "Matemáticas",
  "Number Theory": "Matemáticas",
  "Number theory": "Matemáticas",
  "Teoría de conjuntos": "Matemáticas",
  "Set theory": "Matemáticas",
  "Teoría de Juegos": "Economía y Negocios",
  "Game Theory": "Economía y Negocios",

  // ==================== FÍSICA ====================
  "Física": "Física",
  "Physics": "Física",

  // ==================== QUÍMICA ====================
  "Química nuclear": "Química",
  "Nuclear Chemistry": "Química",
  "Estequiometría": "Química",
  "Estequiometria": "Química",
  "Stoichiometry": "Química",

  // ==================== BIOLOGÍA ====================
  "Biología": "Biología",
  "Biología celular": "Biología",
  "Bioquímica": "Bioquímica", // Nota: Bioquímica no está en el sistema. La agregaremos como "Química"
  "Biochemistry": "Química",

  // ==================== ASTRONOMÍA ====================
  "Astronomía": "Astronomía y Astrofísica",
  "Astronomy": "Astronomía y Astrofísica",
  "Astronomía y Astrofísica": "Astronomía y Astrofísica",

  // ==================== CIENCIAS AMBIENTALES ====================
  "Ciencias Ambientales y Ecología": "Ciencias Ambientales y Ecología",
  "Meteorología y Ciencias Atmosféricas": "Meteorología y Ciencias Atmosféricas",

  // ==================== INGENIERÍA Y TECNOLOGÍA ====================
  "Programación": "Ingeniería en Computación e Informática",
  "Programming": "Ingeniería en Computación e Informática",
  "Ciencia aplicada": "Ingeniería y Tecnología",
  "Applied science": "Ingeniería y Tecnología",

  // ==================== CIENCIAS SOCIALES ====================
  "Psicología": "Psicología",
  "Psicoanálisis": "Psicología",
  "Psiquiatría": "Medicina General e Interna",
  "Ciencias políticas": "Ciencias Políticas y Relaciones Internacionales",
  "Political Science": "Ciencias Políticas y Relaciones Internacionales",
  "Política Internacional": "Ciencias Políticas y Relaciones Internacionales",
  "International Politics": "Ciencias Políticas y Relaciones Internacionales",
  "Economía política": "Economía y Negocios",
  "Political Economy": "Economía y Negocios",
  "Finanzas": "Economía y Negocios",
  "Finance": "Economía y Negocios",
  "Debate": "Comunicación Social y Periodismo",

  // ==================== HUMANIDADES ====================
  "Filosofía": "Filosofía",
  "Philosophy": "Filosofía",
  "Historia": "Historia",
  "Historia Universal": "Historia",
  "World History": "Historia",
  "Literatura": "Literatura",
  "Literature": "Literatura",
  "Literatura universal": "Literatura",
  "World Literature": "Literatura",
  "Poesía latinoamericana": "Literatura",
  "Latin American Poetry": "Literatura",
  "Música": "Arte, Música y Cine",

  // ==================== DEPORTES (sin categoría) ====================
  "Deportes": "Educación y Pedagogía",
  "Sports": "Educación y Pedagogía",
  "Ajedrez": "Educación y Pedagogía",
  "Chess": "Educación y Pedagogía",
};

async function normalizeReviewerAreas({ dryRun = true } = {}) {
  console.log('🔄 INICIANDO NORMALIZACIÓN DE ÁREAS');
  console.log(`   Modo: ${dryRun ? '🔍 SIMULACIÓN (dry run)' : '⚠️ ESCRITURA REAL'}\n`);
  
  const reviewersRef = db.collection('reviewers');
  const snapshot = await reviewersRef.get();
  
  if (snapshot.empty) {
    console.log('❌ No se encontraron revisores.');
    return;
  }

  const results = [];
  let totalChanges = 0;
  let unmappedAreas = new Set();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const currentAreas = data.areasOfExpertise || [];
    
    // Normalizar cada área
    const normalized = currentAreas.map(area => {
      const mapped = AREA_NORMALIZATION_MAP[area];
      if (!mapped) {
        unmappedAreas.add(area);
        return area; // Mantener sin cambios si no está en el mapa
      }
      return mapped;
    });

    // Eliminar duplicados y ordenar
    const uniqueNormalized = [...new Set(normalized)].sort();
    
    // Verificar cambios
    const hasChanges = JSON.stringify(currentAreas.sort()) !== JSON.stringify(uniqueNormalized);
    
    const reviewerResult = {
      id: doc.id,
      name: data.displayName || 'Sin nombre',
      email: data.email || 'Sin email',
      originalAreas: currentAreas,
      normalizedAreas: uniqueNormalized,
      changes: [],
      hasChanges
    };

    if (hasChanges) {
      // Detectar cambios específicos
      currentAreas.forEach(area => {
        const mapped = AREA_NORMALIZATION_MAP[area];
        if (mapped && mapped !== area) {
          reviewerResult.changes.push(`"${area}" → "${mapped}"`);
        }
      });
      
      // Detectar áreas removidas (duplicados)
      const removedCount = currentAreas.length - uniqueNormalized.length;
      if (removedCount > 0) {
        reviewerResult.changes.push(`🗑️ ${removedCount} duplicado(s) eliminado(s)`);
      }
      
      totalChanges++;
    }

    results.push(reviewerResult);

    // Aplicar cambios si no es dry run
    if (!dryRun && hasChanges) {
      await doc.ref.update({
        areasOfExpertise: uniqueNormalized,
        _normalizedAt: new Date().toISOString(),
        _normalizedBy: 'area-normalization-script',
        _originalAreas: currentAreas // Backup de áreas originales
      });
      console.log(`   ✅ Actualizado: ${reviewerResult.name}`);
    }
  }

  // Generar reporte
  const report = {
    executionDate: new Date().toISOString(),
    mode: dryRun ? 'dry-run' : 'production',
    totalReviewers: results.length,
    reviewersWithChanges: totalChanges,
    reviewersWithoutChanges: results.length - totalChanges,
    unmappedAreas: Array.from(unmappedAreas).sort(),
    unmappedAreasCount: unmappedAreas.size,
    reviewers: results.filter(r => r.hasChanges)
  };

  // Guardar reporte
  const outputDir = path.join(__dirname, 'exports');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(outputDir, `normalization-report-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Mostrar resumen
  console.log('\n' + '='.repeat(80));
  console.log('  RESUMEN DE NORMALIZACIÓN');
  console.log('='.repeat(80));
  console.log(`\n📊 Total revisores: ${report.totalReviewers}`);
  console.log(`🔄 Con cambios: ${report.reviewersWithChanges}`);
  console.log(`✅ Sin cambios: ${report.reviewersWithoutChanges}`);
  
  if (report.unmappedAreasCount > 0) {
    console.log(`\n⚠️ ÁREAS SIN MAPEO (${report.unmappedAreasCount}):`);
    report.unmappedAreas.forEach(area => console.log(`   • "${area}"`));
  }

  console.log(`\n📝 Reporte guardado: ${reportPath}`);

  if (dryRun) {
    console.log('\n🔍 Esto fue una SIMULACIÓN. Para aplicar los cambios:');
    console.log('   node scripts/normalizeReviewerAreas.js --apply\n');
  }

  // Mostrar cambios detallados
  if (report.reviewers.length > 0) {
    console.log('\n─'.repeat(80));
    console.log('  CAMBIOS DETECTADOS');
    console.log('─'.repeat(80) + '\n');
    
    report.reviewers.forEach((reviewer, index) => {
      console.log(`${index + 1}. ${reviewer.name} (${reviewer.email})`);
      console.log(`   Original: [${reviewer.originalAreas.join(', ')}]`);
      console.log(`   Normalizado: [${reviewer.normalizedAreas.join(', ')}]`);
      reviewer.changes.forEach(change => {
        console.log(`   ↳ ${change}`);
      });
      console.log('');
    });
  }

  return report;
}

// Ejecutar
const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');

normalizeReviewerAreas({ dryRun })
  .then(() => {
    console.log('✨ Proceso completado.');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Error:', error);
    process.exit(1);
  });