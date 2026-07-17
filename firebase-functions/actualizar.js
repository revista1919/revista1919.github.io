/**
 * ============================================================
 * SCRIPT DE MIGRACIÓN COMPLETO: reviewers-collection-populator
 * ============================================================
 * 
 * Propósito: Crear documentos en la colección 'reviewers' para
 * todos los usuarios existentes que tienen el rol 'Revisor'.
 * 
 * Autor: Sistema Editorial
 * Versión: 1.0.0
 * Fecha: 2024
 * 
 * INSTRUCCIONES:
 * 1. Coloca tu serviceAccountKey.json en la misma carpeta
 * 2. Ajusta las constantes de configuración abajo
 * 3. Ejecuta: node scripts/populateReviewersCollection.js
 * 4. Revisa el archivo de log generado: migration-reviewers-[timestamp].log
 * 
 * PRECAUCIÓN: Este script realiza operaciones de escritura masiva.
 * Se recomienda hacer backup de Firestore antes de ejecutar.
 */

'use strict';

// ============================================================
// IMPORTS Y CONFIGURACIÓN INICIAL
// ============================================================

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ============================================================
// CONFIGURACIÓN - AJUSTA ESTOS VALORES
// ============================================================

const CONFIG = {
  // Ruta al archivo de credenciales de Firebase
  serviceAccountPath: path.join(__dirname, 'serviceAccountKey.json'),
  
  // URL de tu base de datos de Firebase
  databaseURL: 'https://usuarios-rnce.firebaseio.com',
  
  // Tamaño del lote para procesamiento
  batchSize: 10,
  
  // Tiempo de espera entre lotes (milisegundos)
  delayBetweenBatches: 1000,
  
  // Tiempo máximo de ejecución (minutos)
  maxExecutionTimeMinutes: 30,
  
  // ¿Confirmar antes de ejecutar?
  requireConfirmation: true,
  
  // ¿Modo dry-run? (solo simula, no escribe)
  dryRun: false,
  
  // Directorio de logs
  logsDir: path.join(__dirname, 'logs'),
  
  // ¿Forzar actualización de documentos existentes?
  forceUpdate: true,
  
  // ¿Crear documentos de auditoría de migración?
  createAuditTrail: true,
  
  // Colecciones a analizar para estadísticas
  statsCollections: {
    invitations: 'reviewerInvitations',
    assignments: 'reviewerAssignments',
    reviews: 'reviews',
    submissions: 'submissions',
  },
  
  // Roles que califican como revisor
  reviewerRoles: ['Revisor', 'Revisor / Comité Editorial'],
  
  // Roles de administrador para metadata de aprobación
  adminRoles: ['Director General', 'Editor en Jefe', 'Editor de Sección'],
  
  // Estado por defecto para revisores sin estado explícito
  defaultReviewerStatus: 'active',
  
  // Configuración de disponibilidad por defecto
  defaultAvailability: {
    maxActiveReviews: 3,
    currentActiveReviews: 0,
    preferredLanguage: 'es',
    timeAvailablePerReview: '2-weeks',
  },
  
  // Configuración de notificaciones por defecto
  defaultNotifications: {
    newReviewRequest: true,
    reminderBeforeDeadline: true,
    reminderDays: [7, 3, 1],
  },
};

// ============================================================
// SISTEMA DE LOGGING
// ============================================================

class Logger {
  constructor() {
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFileName = `migration-reviewers-${this.timestamp}.log`;
    
    // Crear directorio de logs si no existe
    if (!fs.existsSync(CONFIG.logsDir)) {
      fs.mkdirSync(CONFIG.logsDir, { recursive: true });
    }
    
    this.logFilePath = path.join(CONFIG.logsDir, this.logFileName);
    this.stream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
    this.startTime = Date.now();
  }
  
  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    
    let logLine = `[${timestamp}] [${elapsed}s] [${level.toUpperCase()}] ${message}`;
    
    if (data) {
      if (typeof data === 'object') {
        logLine += '\n' + JSON.stringify(data, null, 2);
      } else {
        logLine += ` - ${data}`;
      }
    }
    
    // Escribir a archivo
    this.stream.write(logLine + '\n');
    
    // Mostrar en consola según nivel
    switch (level) {
      case 'error':
        console.error(`\x1b[31m${logLine}\x1b[0m`);
        break;
      case 'warn':
        console.warn(`\x1b[33m${logLine}\x1b[0m`);
        break;
      case 'success':
        console.log(`\x1b[32m${logLine}\x1b[0m`);
        break;
      case 'info':
      default:
        console.log(logLine);
        break;
    }
  }
  
  info(message, data = null) { this.log('info', message, data); }
  warn(message, data = null) { this.log('warn', message, data); }
  error(message, data = null) { this.log('error', message, data); }
  success(message, data = null) { this.log('success', message, data); }
  
  close() {
    this.stream.end();
    console.log(`\n📄 Log guardado en: ${this.logFilePath}`);
  }
}

// ============================================================
// INICIALIZACIÓN DE FIREBASE
// ============================================================

function initializeFirebase() {
  // Verificar si ya está inicializado
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }
  
  // Verificar que existe el archivo de credenciales
  if (!fs.existsSync(CONFIG.serviceAccountPath)) {
    console.error(`\x1b[31m❌ ERROR: No se encontró el archivo de credenciales en:\x1b[0m`);
    console.error(`   ${CONFIG.serviceAccountPath}`);
    console.error('\n   Asegúrate de:');
    console.error('   1. Ir a Firebase Console > Configuración del proyecto > Cuentas de servicio');
    console.error('   2. Generar nueva clave privada');
    console.error('   3. Guardar el archivo como serviceAccountKey.json en la carpeta scripts/');
    process.exit(1);
  }
  
  let serviceAccount;
  try {
    serviceAccount = require(CONFIG.serviceAccountPath);
  } catch (error) {
    console.error(`\x1b[31m❌ ERROR: No se pudo leer el archivo de credenciales:\x1b[0m`);
    console.error(`   ${error.message}`);
    process.exit(1);
  }
  
  try {
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: CONFIG.databaseURL,
    });
    
    console.log('✅ Firebase inicializado correctamente');
    return app;
  } catch (error) {
    console.error(`\x1b[31m❌ ERROR: No se pudo inicializar Firebase:\x1b[0m`);
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

// ============================================================
// UTILIDADES
// ============================================================

class Utils {
  /**
   * Pausa la ejecución por un tiempo determinado
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Divide un array en lotes del tamaño especificado
   */
  static chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  /**
   * Valida que un UID tenga formato válido
   */
  static isValidUID(uid) {
    return typeof uid === 'string' && uid.length > 0 && /^[a-zA-Z0-9_-]+$/.test(uid);
  }
  
  /**
   * Valida que un email tenga formato válido
   */
  static isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  
  /**
   * Escapa caracteres especiales en strings para logging seguro
   */
  static sanitizeString(str) {
    if (!str) return '';
    return str.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
  }
  
  /**
   * Calcula la diferencia en días entre dos fechas
   */
  static daysBetween(date1, date2) {
    const d1 = date1 instanceof Date ? date1 : new Date(date1);
    const d2 = date2 instanceof Date ? date2 : new Date(date2);
    return Math.abs((d2 - d1) / (1000 * 60 * 60 * 24));
  }
  
  /**
   * Formatea bytes a una representación legible
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * Formatea tiempo en milisegundos a representación legible
   */
  static formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}
// ============================================================
// ESTADÍSTICAS DEL REVISOR (VERSIÓN MEJORADA PARA DATOS MIGRADOS)
// ============================================================

class ReviewerStatsCalculator {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }
  
  /**
   * Calcula todas las estadísticas de un revisor
   * Busca en múltiples colecciones para manejar datos migrados
   */
  async calculate(reviewerUid, reviewerEmail = null) {
    this.logger.info(`   📊 Calculando estadísticas para ${reviewerUid}...`);
    
    try {
      const [
        invitationStats,
        assignmentStats,
        reviewStats,
        submissionStats,
      ] = await Promise.all([
        this._calculateInvitationStats(reviewerUid, reviewerEmail),
        this._calculateAssignmentStats(reviewerUid, reviewerEmail),
        this._calculateReviewStats(reviewerUid, reviewerEmail),
        this._calculateSubmissionStats(reviewerUid),
      ]);
      
      return {
        ...invitationStats,
        ...assignmentStats,
        ...reviewStats,
        ...submissionStats,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`   ❌ Error calculando estadísticas para ${reviewerUid}: ${error.message}`);
      return this._getDefaultStats(error.message);
    }
  }
  
  /**
   * Calcula estadísticas de invitaciones
   * Busca por UID y por email (para datos migrados)
   */
  async _calculateInvitationStats(reviewerUid, reviewerEmail) {
    try {
      let allInvitations = [];
      
      // Buscar por UID
      const byUidSnapshot = await this.db
        .collection(CONFIG.statsCollections.invitations)
        .where('reviewerUid', '==', reviewerUid)
        .get();
      
      byUidSnapshot.forEach(doc => {
        allInvitations.push({ id: doc.id, ...doc.data() });
      });
      
      // Si hay email, buscar también por email (para datos migrados que usan email)
      if (reviewerEmail) {
        const byEmailSnapshot = await this.db
          .collection(CONFIG.statsCollections.invitations)
          .where('reviewerEmail', '==', reviewerEmail)
          .get();
        
        byEmailSnapshot.forEach(doc => {
          // Evitar duplicados
          if (!allInvitations.find(inv => inv.id === doc.id)) {
            allInvitations.push({ id: doc.id, ...doc.data() });
          }
        });
      }
      
      // También buscar en reviewerAssignments con status 'pending' o 'sent' 
      // que funcionan como invitaciones en sistemas migrados
      if (reviewerEmail) {
        const pendingAssignmentsSnapshot = await this.db
          .collection(CONFIG.statsCollections.assignments)
          .where('reviewerEmail', '==', reviewerEmail)
          .where('status', 'in', ['pending', 'sent', 'invited'])
          .get();
        
        pendingAssignmentsSnapshot.forEach(doc => {
          const data = doc.data();
          allInvitations.push({
            id: doc.id,
            reviewerUid: data.reviewerUid || reviewerUid,
            status: data.status === 'invited' ? 'sent' : data.status,
            createdAt: data.createdAt || data.invitedAt || data.sentAt,
            respondedAt: data.respondedAt || data.acceptedAt || data.declinedAt,
            submissionId: data.submissionId,
          });
        });
      }
      
      const total = allInvitations.length;
      const accepted = allInvitations.filter(inv => inv.status === 'accepted').length;
      const declined = allInvitations.filter(inv => inv.status === 'declined').length;
      const expired = allInvitations.filter(inv => inv.status === 'expired').length;
      const failed = allInvitations.filter(inv => inv.status === 'failed').length;
      const pending = allInvitations.filter(inv => 
        inv.status === 'pending' || inv.status === 'sent'
      ).length;
      
      const acceptanceRate = total > 0 
        ? Math.round((accepted / (accepted + declined)) * 100) 
        : 0;
      
      // Tiempo promedio de respuesta
      const responseTimes = allInvitations
        .filter(inv => inv.respondedAt && inv.createdAt)
        .map(inv => {
          const created = this._toDate(inv.createdAt);
          const responded = this._toDate(inv.respondedAt);
          return Utils.daysBetween(created, responded);
        });
      
      const avgResponseTime = responseTimes.length > 0
        ? parseFloat((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(1))
        : null;
      
      // Última invitación
      const sortedByDate = allInvitations
        .filter(inv => inv.createdAt)
        .sort((a, b) => this._toDate(b.createdAt) - this._toDate(a.createdAt));
      
      return {
        totalInvitations: total,
        acceptedInvitations: accepted,
        declinedInvitations: declined,
        expiredInvitations: expired,
        failedInvitations: failed,
        pendingInvitations: pending,
        acceptanceRate,
        avgResponseTimeDays: avgResponseTime,
        lastInvitationAt: sortedByDate[0]?.createdAt 
          ? this._toDate(sortedByDate[0].createdAt).toISOString() 
          : null,
      };
    } catch (error) {
      this.logger.warn(`   ⚠️ Error en estadísticas de invitaciones: ${error.message}`);
      return {
        totalInvitations: 0,
        acceptedInvitations: 0,
        declinedInvitations: 0,
        expiredInvitations: 0,
        failedInvitations: 0,
        pendingInvitations: 0,
        acceptanceRate: 0,
        avgResponseTimeDays: null,
        lastInvitationAt: null,
      };
    }
  }
  
  /**
   * Calcula estadísticas de asignaciones
   * Busca en reviewerAssignments Y reviews (para datos migrados)
   */
  async _calculateAssignmentStats(reviewerUid, reviewerEmail) {
    try {
      let allAssignments = [];
      const seenIds = new Set();
      
      // 1. Buscar en reviewerAssignments por UID
      const byUidSnapshot = await this.db
        .collection(CONFIG.statsCollections.assignments)
        .where('reviewerUid', '==', reviewerUid)
        .get();
      
      byUidSnapshot.forEach(doc => {
        seenIds.add(doc.id);
        allAssignments.push({ 
          id: doc.id, 
          source: 'reviewerAssignments',
          ...doc.data() 
        });
      });
      
      // 2. Buscar en reviewerAssignments por email
      if (reviewerEmail) {
        const byEmailSnapshot = await this.db
          .collection(CONFIG.statsCollections.assignments)
          .where('reviewerEmail', '==', reviewerEmail)
          .get();
        
        byEmailSnapshot.forEach(doc => {
          if (!seenIds.has(doc.id)) {
            seenIds.add(doc.id);
            allAssignments.push({ 
              id: doc.id, 
              source: 'reviewerAssignments',
              ...doc.data() 
            });
          }
        });
      }
      
      // 3. Buscar en colección 'reviews' (datos migrados)
      // Estos documentos tienen la estructura que mostraste
      const reviewsByUidSnapshot = await this.db
        .collection(CONFIG.statsCollections.reviews)
        .where('reviewerUid', '==', reviewerUid)
        .get();
      
      reviewsByUidSnapshot.forEach(doc => {
        if (!seenIds.has(doc.id)) {
          seenIds.add(doc.id);
          const data = doc.data();
          // Normalizar a estructura de assignment
          allAssignments.push({
            id: doc.id,
            source: 'reviews',
            reviewerUid: data.reviewerUid,
            reviewerEmail: data.reviewerEmail,
            reviewerName: data.reviewerName,
            submissionId: data.submissionId,
            status: data.status || 'submitted',
            round: data.round || 1,
            submittedAt: data.submittedAt,
            createdAt: data.createdAt,
            dueDate: data.dueDate,
            completedAt: data.completedAt || data.submittedAt,
            scores: data.scores,
            recommendation: data.recommendation,
            migrated: data.migrated || false,
          });
        }
      });
      
      // 4. Buscar en 'reviews' por email
      if (reviewerEmail) {
        const reviewsByEmailSnapshot = await this.db
          .collection(CONFIG.statsCollections.reviews)
          .where('reviewerEmail', '==', reviewerEmail)
          .get();
        
        reviewsByEmailSnapshot.forEach(doc => {
          if (!seenIds.has(doc.id)) {
            seenIds.add(doc.id);
            const data = doc.data();
            allAssignments.push({
              id: doc.id,
              source: 'reviews',
              reviewerUid: data.reviewerUid || reviewerUid,
              reviewerEmail: data.reviewerEmail,
              reviewerName: data.reviewerName,
              submissionId: data.submissionId,
              status: data.status || 'submitted',
              round: data.round || 1,
              submittedAt: data.submittedAt,
              createdAt: data.createdAt,
              dueDate: data.dueDate,
              completedAt: data.completedAt || data.submittedAt,
              scores: data.scores,
              recommendation: data.recommendation,
              migrated: data.migrated || false,
            });
          }
        });
      }
      
      // Calcular estadísticas
      const total = allAssignments.length;
      const completed = allAssignments.filter(
        a => a.status === 'submitted' || a.status === 'completed'
      ).length;
      const inProgress = allAssignments.filter(
        a => a.status === 'accepted' || a.status === 'in_progress'
      ).length;
      const declined = allAssignments.filter(
        a => a.status === 'declined'
      ).length;
      
      // Revisiones a tiempo vs tarde
      let onTime = 0;
      let late = 0;
      let noDueDate = 0;
      
      allAssignments
        .filter(a => (a.status === 'submitted' || a.status === 'completed') && a.submittedAt)
        .forEach(a => {
          if (a.dueDate) {
            const submitted = this._toDate(a.submittedAt);
            const due = this._toDate(a.dueDate);
            if (submitted <= due) {
              onTime++;
            } else {
              late++;
            }
          } else {
            // Sin fecha de vencimiento (migrados) - contar como a tiempo
            noDueDate++;
            onTime++;
          }
        });
      
      const totalWithDates = onTime + late;
      const onTimeRate = totalWithDates > 0 
        ? Math.round((onTime / totalWithDates) * 100) 
        : 100;
      
      // Revisiones por ronda
      const byRound = {};
      allAssignments.forEach(a => {
        const round = a.round || 1;
        byRound[round] = (byRound[round] || 0) + 1;
      });
      
      // Revisiones por fuente (migrado vs nuevo)
      const fromMigration = allAssignments.filter(a => a.migrated === true).length;
      const fromNewSystem = total - fromMigration;
      
      // Última revisión entregada
      const sortedBySubmission = allAssignments
        .filter(a => a.submittedAt)
        .sort((a, b) => this._toDate(b.submittedAt) - this._toDate(a.submittedAt));
      
      return {
        totalAssignments: total,
        completedAssignments: completed,
        inProgressAssignments: inProgress,
        declinedAssignments: declined,
        onTimeReviews: onTime,
        lateReviews: late,
        noDueDateReviews: noDueDate,
        onTimeRate,
        reviewsByRound: byRound,
        totalRoundsParticipated: Object.keys(byRound).length,
        migratedReviews: fromMigration,
        newSystemReviews: fromNewSystem,
        lastReviewSubmittedAt: sortedBySubmission[0]?.submittedAt 
          ? this._toDate(sortedBySubmission[0].submittedAt).toISOString() 
          : null,
      };
    } catch (error) {
      this.logger.warn(`   ⚠️ Error en estadísticas de asignaciones: ${error.message}`);
      return {
        totalAssignments: 0,
        completedAssignments: 0,
        inProgressAssignments: 0,
        declinedAssignments: 0,
        onTimeReviews: 0,
        lateReviews: 0,
        noDueDateReviews: 0,
        onTimeRate: 100,
        reviewsByRound: {},
        totalRoundsParticipated: 0,
        migratedReviews: 0,
        newSystemReviews: 0,
        lastReviewSubmittedAt: null,
      };
    }
  }
  
  /**
   * Calcula estadísticas de revisiones (calidad)
   * Busca puntuaciones en todas las fuentes
   */
  async _calculateReviewStats(reviewerUid, reviewerEmail) {
    try {
      let allReviews = [];
      const seenIds = new Set();
      
      // 1. Buscar en colección 'reviews' con status 'submitted'
      const reviewsByUidSnapshot = await this.db
        .collection(CONFIG.statsCollections.reviews)
        .where('reviewerUid', '==', reviewerUid)
        .where('status', '==', 'submitted')
        .get();
      
      reviewsByUidSnapshot.forEach(doc => {
        seenIds.add(doc.id);
        allReviews.push({ id: doc.id, source: 'reviews', ...doc.data() });
      });
      
      // 2. Buscar en 'reviews' por email
      if (reviewerEmail) {
        const reviewsByEmailSnapshot = await this.db
          .collection(CONFIG.statsCollections.reviews)
          .where('reviewerEmail', '==', reviewerEmail)
          .where('status', '==', 'submitted')
          .get();
        
        reviewsByEmailSnapshot.forEach(doc => {
          if (!seenIds.has(doc.id)) {
            seenIds.add(doc.id);
            allReviews.push({ id: doc.id, source: 'reviews', ...doc.data() });
          }
        });
      }
      
      // 3. Buscar en reviewerAssignments con status 'submitted' y scores
      const assignmentsWithScoresSnapshot = await this.db
        .collection(CONFIG.statsCollections.assignments)
        .where('reviewerUid', '==', reviewerUid)
        .where('status', '==', 'submitted')
        .get();
      
      assignmentsWithScoresSnapshot.forEach(doc => {
        if (!seenIds.has(doc.id)) {
          const data = doc.data();
          if (data.scores) {
            seenIds.add(doc.id);
            allReviews.push({ id: doc.id, source: 'reviewerAssignments', ...data });
          }
        }
      });
      
      // Promedio de puntuaciones
      const scores = allReviews
        .filter(r => r.scores)
        .map(r => {
          const values = Object.values(r.scores).filter(v => typeof v === 'number');
          return values.length > 0
            ? values.reduce((sum, v) => sum + v, 0) / values.length
            : null;
        })
        .filter(s => s !== null);
      
      const avgScore = scores.length > 0
        ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
        : null;
      
      // Promedio de días para completar revisión
      const completionTimes = allReviews
        .filter(r => (r.completedAt || r.submittedAt) && r.createdAt)
        .map(r => {
          const start = this._toDate(r.createdAt);
          const end = this._toDate(r.completedAt || r.submittedAt);
          return Utils.daysBetween(start, end);
        });
      
      const avgCompletionTime = completionTimes.length > 0
        ? parseFloat((completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length).toFixed(1))
        : null;
      
      // Distribución de recomendaciones
      const recommendations = {};
      allReviews.forEach(r => {
        if (r.recommendation) {
          recommendations[r.recommendation] = (recommendations[r.recommendation] || 0) + 1;
        }
      });
      
      return {
        totalReviewsSubmitted: allReviews.length,
        averageReviewScore: avgScore,
        maxScore: 5,
        avgCompletionTimeDays: avgCompletionTime,
        recommendations,
        reviewsWithScores: scores.length,
      };
    } catch (error) {
      this.logger.warn(`   ⚠️ Error en estadísticas de revisiones: ${error.message}`);
      return {
        totalReviewsSubmitted: 0,
        averageReviewScore: null,
        maxScore: 5,
        avgCompletionTimeDays: null,
        recommendations: {},
        reviewsWithScores: 0,
      };
    }
  }
  
  /**
   * Calcula estadísticas relacionadas con submissions
   */
  async _calculateSubmissionStats(reviewerUid) {
    try {
      const snapshot = await this.db
        .collection(CONFIG.statsCollections.submissions)
        .where('authorUID', '==', reviewerUid)
        .where('wantsToBeReviewer', '==', true)
        .get();
      
      const applications = [];
      snapshot.forEach(doc => applications.push({ id: doc.id, ...doc.data() }));
      
      return {
        totalReviewerApplications: applications.length,
        approvedApplications: applications.filter(a => a.reviewerStatus === 'approved').length,
        rejectedApplications: applications.filter(a => a.reviewerStatus === 'rejected').length,
      };
    } catch (error) {
      this.logger.warn(`   ⚠️ Error en estadísticas de submissions: ${error.message}`);
      return {
        totalReviewerApplications: 0,
        approvedApplications: 0,
        rejectedApplications: 0,
      };
    }
  }
  
  /**
   * Convierte un valor a Date de manera segura
   */
  _toDate(value) {
    if (!value) return new Date(0);
    if (value instanceof Date) return value;
    if (value.toDate && typeof value.toDate === 'function') return value.toDate();
    if (value._seconds) return new Date(value._seconds * 1000);
    if (typeof value === 'string') return new Date(value);
    return new Date(value);
  }
  
  /**
   * Devuelve estadísticas por defecto en caso de error
   */
  _getDefaultStats(errorMessage = '') {
    return {
      totalInvitations: 0,
      acceptedInvitations: 0,
      declinedInvitations: 0,
      expiredInvitations: 0,
      failedInvitations: 0,
      pendingInvitations: 0,
      acceptanceRate: 0,
      avgResponseTimeDays: null,
      totalAssignments: 0,
      completedAssignments: 0,
      inProgressAssignments: 0,
      declinedAssignments: 0,
      onTimeReviews: 0,
      lateReviews: 0,
      noDueDateReviews: 0,
      onTimeRate: 100,
      totalReviewsSubmitted: 0,
      averageReviewScore: null,
      maxScore: 5,
      avgCompletionTimeDays: null,
      recommendations: {},
      reviewsWithScores: 0,
      reviewsByRound: {},
      totalRoundsParticipated: 0,
      migratedReviews: 0,
      newSystemReviews: 0,
      totalReviewerApplications: 0,
      approvedApplications: 0,
      rejectedApplications: 0,
      lastInvitationAt: null,
      lastReviewSubmittedAt: null,
      lastUpdated: new Date().toISOString(),
      error: errorMessage,
    };
  }
}

// ============================================================
// CONSTRUCTOR DE DOCUMENTO DE REVISOR
// ============================================================

class ReviewerDocumentBuilder {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
    this.statsCalculator = new ReviewerStatsCalculator(db, logger);
  }
  
  /**
   * Construye el documento completo del revisor
   */
  async build(userData, existingDoc = null) {
    const reviewerUid = userData.uid;
    
    this.logger.info(`Construyendo documento para ${reviewerUid}...`);
    
    // Calcular estadísticas
    const stats = await this.statsCalculator.calculate(reviewerUid, userData.email);
    
    // Buscar aplicación de revisor (submission donde solicitó ser revisor)
    const application = await this._findReviewerApplication(reviewerUid);
    
    // Buscar metadata de aprobación
    const approvalMetadata = await this._buildApprovalMetadata(userData, application);
    
    // Construir áreas de especialización
    const areasOfExpertise = this._buildAreasOfExpertise(userData, application);
    
    // Construir intereses
    const interests = this._buildInterests(userData);
    
    // Construir documento base
    const document = {
      // Identificación
      uid: reviewerUid,
      
      // Datos básicos
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      displayName: userData.displayName || 
        `${userData.firstName || ''} ${userData.lastName || ''}`.trim() ||
        userData.email?.split('@')[0] || 'Revisor sin nombre',
      email: userData.email || '',
      publicEmail: userData.publicEmail || userData.email || '',
      institution: userData.institution || '',
      orcid: userData.orcid || '',
      
      // Áreas de especialización
      areasOfExpertise,
      
      // Intereses
      interests,
      
      // Estado
      status: this._determineStatus(userData),
      
      // Disponibilidad
      availability: {
        maxActiveReviews: userData.maxActiveReviews || CONFIG.defaultAvailability.maxActiveReviews,
        currentActiveReviews: userData.currentActiveReviews || CONFIG.defaultAvailability.currentActiveReviews,
        preferredLanguage: userData.preferredLanguage || CONFIG.defaultAvailability.preferredLanguage,
        timeAvailablePerReview: userData.timeAvailablePerReview || CONFIG.defaultAvailability.timeAvailablePerReview,
      },
      
      // Estadísticas
      stats,
      
      // Metadata de aprobación
      ...approvalMetadata,
      
      // Origen de la postulación
      applicationSource: {
        type: application.found ? 'submission' : 'manual_assignment',
        submissionId: application.submissionId || null,
        articleTitle: application.submissionData?.title || '',
        articleArea: application.submissionData?.area || '',
        appliedAt: application.submissionData?.createdAt 
          ? (application.submissionData.createdAt.toDate?.() || application.submissionData.createdAt)
          : null,
      },
      
      // Configuración de notificaciones
      notifications: userData.reviewerNotifications || CONFIG.defaultNotifications,
      
      // Notas (si existen)
      notes: userData.reviewerNotes || existingDoc?.notes || '',
      
      // Timestamps
      createdAt: existingDoc?.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      
      // Metadata de migración
      _migration: {
        migratedAt: new Date().toISOString(),
        migratedBy: 'system-script',
        scriptVersion: '1.0.0',
        previousDocumentExisted: !!existingDoc,
      },
    };
    
    // Si el documento ya existe, preservar algunos campos
    if (existingDoc) {
      document._migration.previousData = {
        status: existingDoc.status,
        areasOfExpertise: existingDoc.areasOfExpertise,
        notes: existingDoc.notes,
      };
      
      // Preservar campos que no queremos sobrescribir
      if (existingDoc.notes && !userData.reviewerNotes) {
        document.notes = existingDoc.notes;
      }
      if (existingDoc.createdAt) {
        document.createdAt = existingDoc.createdAt;
      }
    }
    
    return document;
  }
  
  /**
   * Busca la aplicación de revisor del usuario
   */
  async _findReviewerApplication(reviewerUid) {
    try {
      const snapshot = await this.db
        .collection(CONFIG.statsCollections.submissions)
        .where('authorUID', '==', reviewerUid)
        .where('wantsToBeReviewer', '==', true)
        .where('reviewerStatus', '==', 'approved')
        .orderBy('reviewerApprovedAt', 'desc')
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return {
          found: true,
          submissionId: doc.id,
          submissionData: doc.data(),
        };
      }
      
      // Buscar cualquier submission con wantsToBeReviewer (aunque no esté aprobada)
      const anySnapshot = await this.db
        .collection(CONFIG.statsCollections.submissions)
        .where('authorUID', '==', reviewerUid)
        .where('wantsToBeReviewer', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      
      if (!anySnapshot.empty) {
        const doc = anySnapshot.docs[0];
        return {
          found: true,
          submissionId: doc.id,
          submissionData: doc.data(),
        };
      }
      
      return { found: false };
    } catch (error) {
      this.logger.warn(`Error buscando aplicación para ${reviewerUid}: ${error.message}`);
      return { found: false, error: error.message };
    }
  }
  
  /**
   * Construye metadata de aprobación
   */
  async _buildApprovalMetadata(userData, application) {
    const approvalInfo = {
      approvedBy: {
        uid: 'system-migration',
        email: 'migration@sistema-editorial.local',
        name: 'Migración del Sistema Editorial',
        role: 'Sistema',
      },
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    // Si hay una aplicación aprobada, usar esa metadata
    if (application.found && application.submissionData?.reviewerStatus === 'approved') {
      if (application.submissionData.reviewerApprovedBy) {
        try {
          const approverDoc = await this.db
            .collection('users')
            .doc(application.submissionData.reviewerApprovedBy)
            .get();
          
          if (approverDoc.exists) {
            const approverData = approverDoc.data();
            approvalInfo.approvedBy = {
              uid: application.submissionData.reviewerApprovedBy,
              email: approverData.email || 'desconocido@email.com',
              name: approverData.displayName || 'Aprobador desconocido',
              role: (approverData.roles || []).find(r => CONFIG.adminRoles.includes(r)) || 'Editor',
            };
          }
        } catch (error) {
          this.logger.warn(`No se pudo obtener datos del aprobador: ${error.message}`);
        }
      }
      
      if (application.submissionData.reviewerApprovedAt) {
        approvalInfo.approvedAt = application.submissionData.reviewerApprovedAt;
      }
    }
    
    return approvalInfo;
  }
  
  /**
   * Construye áreas de especialización
   */
  _buildAreasOfExpertise(userData, application) {
    // Prioridad: áreas de la aplicación > áreas del perfil > intereses > vacío
    if (application.found && 
        application.submissionData?.reviewerAreas && 
        application.submissionData.reviewerAreas.length > 0) {
      return application.submissionData.reviewerAreas;
    }
    
    if (userData.areasOfExpertise && userData.areasOfExpertise.length > 0) {
      return userData.areasOfExpertise;
    }
    
    if (userData.expertise && userData.expertise.length > 0) {
      return userData.expertise;
    }
    
    // Combinar intereses en español e inglés
    const interests = [];
    if (userData.interests?.es && Array.isArray(userData.interests.es)) {
      interests.push(...userData.interests.es);
    }
    if (userData.interests?.en && Array.isArray(userData.interests.en)) {
      interests.push(...userData.interests.en);
    }
    
    return [...new Set(interests)]; // Eliminar duplicados
  }
  
  /**
   * Construye intereses
   */
  _buildInterests(userData) {
    return {
      es: Array.isArray(userData.interests?.es) ? userData.interests.es : [],
      en: Array.isArray(userData.interests?.en) ? userData.interests.en : [],
    };
  }
  
  /**
   * Determina el estado del revisor
   */
  _determineStatus(userData) {
    if (userData.reviewerStatus && 
        ['active', 'inactive', 'suspended', 'vacation'].includes(userData.reviewerStatus)) {
      return userData.reviewerStatus;
    }
    
    if (userData.isActive === false) return 'inactive';
    if (userData.suspended === true) return 'suspended';
    
    return CONFIG.defaultReviewerStatus;
  }
}

// ============================================================
// EJECUTOR DE MIGRACIÓN
// ============================================================

class MigrationExecutor {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
    this.documentBuilder = new ReviewerDocumentBuilder(db, logger);
    
    this.results = {
      startTime: new Date(),
      endTime: null,
      duration: null,
      totalUsers: 0,
      totalReviewers: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      details: [],
      summary: {},
    };
    
    this.auditTrail = [];
  }
  
  /**
   * Ejecuta la migración completa
   */
  async execute() {
    this.logger.info('='.repeat(60));
    this.logger.info('INICIANDO MIGRACIÓN DE REVISORES');
    this.logger.info('='.repeat(60));
    this.logger.info(`Modo: ${CONFIG.dryRun ? 'DRY RUN (simulación)' : 'ESCRITURA REAL'}`);
    this.logger.info(`Forzar actualización: ${CONFIG.forceUpdate ? 'Sí' : 'No'}`);
    this.logger.info(`Tamaño de lote: ${CONFIG.batchSize}`);
    this.logger.info(`Timestamp: ${this.results.startTime.toISOString()}`);
    
    if (CONFIG.dryRun) {
      this.logger.warn('⚠️  MODO SIMULACIÓN: No se realizarán cambios en la base de datos');
    }
    
    try {
      // 1. Obtener todos los usuarios
      const allUsers = await this._fetchAllUsers();
      this.results.totalUsers = allUsers.length;
      this.logger.info(`Total de usuarios en el sistema: ${allUsers.length}`);
      
      // 2. Filtrar usuarios con rol de revisor
      const reviewers = this._filterReviewers(allUsers);
      this.results.totalReviewers = reviewers.length;
      this.logger.info(`Usuarios con rol de revisor: ${reviewers.length}`);
      
      if (reviewers.length === 0) {
        this.logger.warn('No se encontraron usuarios con rol de revisor. Nada que migrar.');
        return this.results;
      }
      
      // 3. Mostrar resumen de revisores encontrados
      this._displayReviewersSummary(reviewers);
      
      // 4. Procesar revisores en lotes
      await this._processBatch(reviewers);
      
      // 5. Generar auditoría si está habilitada
      if (CONFIG.createAuditTrail && !CONFIG.dryRun) {
        await this._createAuditTrail();
      }
      
      // 6. Calcular resultados finales
      this.results.endTime = new Date();
      this.results.duration = this.results.endTime - this.results.startTime;
      this._calculateSummary();
      
      // 7. Mostrar resultados
      this._displayResults();
      
      return this.results;
      
    } catch (error) {
      this.logger.error(`Error fatal en la migración: ${error.message}`);
      this.logger.error(error.stack);
      throw error;
    }
  }
  
  /**
   * Obtiene todos los usuarios del sistema
   */
  async _fetchAllUsers() {
    this.logger.info('Obteniendo todos los usuarios...');
    
    const users = [];
    let lastDoc = null;
    let pageCount = 0;
    
    while (true) {
      let query = this.db.collection('users')
        .orderBy('email')
        .limit(500);
      
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      const snapshot = await query.get();
      pageCount++;
      
      snapshot.forEach(doc => {
        users.push({
          id: doc.id,
          uid: doc.id,
          ...doc.data(),
        });
      });
      
      this.logger.info(`  Página ${pageCount}: ${snapshot.size} usuarios (total: ${users.length})`);
      
      if (snapshot.size < 500) break;
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }
    
    return users;
  }
  
  /**
   * Filtra usuarios que tienen rol de revisor
   */
  _filterReviewers(users) {
    return users.filter(user => {
      const roles = user.roles || [];
      return roles.some(role => CONFIG.reviewerRoles.includes(role));
    });
  }
  
  /**
   * Muestra resumen de revisores encontrados
   */
  _displayReviewersSummary(reviewers) {
    this.logger.info('\n📋 RESUMEN DE REVISORES ENCONTRADOS:');
    
    reviewers.forEach((reviewer, index) => {
      const roles = (reviewer.roles || []).join(', ');
      const email = reviewer.email || 'sin email';
      const name = reviewer.displayName || 
        `${reviewer.firstName || ''} ${reviewer.lastName || ''}`.trim() || 
        'Sin nombre';
      
      this.logger.info(`  ${index + 1}. ${name} (${email}) - Roles: [${roles}]`);
    });
    
    this.logger.info('');
  }
  
  /**
   * Procesa los revisores en lotes
   */
  async _processBatch(reviewers) {
    const chunks = Utils.chunkArray(reviewers, CONFIG.batchSize);
    const totalChunks = chunks.length;
    
    this.logger.info(`🔄 Procesando ${reviewers.length} revisores en ${totalChunks} lotes de ${CONFIG.batchSize}...`);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkNumber = i + 1;
      
      this.logger.info(`\n--- Lote ${chunkNumber}/${totalChunks} (${chunk.length} revisores) ---`);
      
      await Promise.all(chunk.map(reviewer => this._processReviewer(reviewer)));
      
      this.logger.info(`✅ Lote ${chunkNumber} completado.`);
      this.logger.info(`   Progreso: ${Math.min((i + 1) * CONFIG.batchSize, reviewers.length)}/${reviewers.length}`);
      this.logger.info(`   Creados: ${this.results.created} | Actualizados: ${this.results.updated} | Errores: ${this.results.errors}`);
      
      // Pausa entre lotes
      if (i < chunks.length - 1) {
        this.logger.info(`   Esperando ${CONFIG.delayBetweenBatches}ms antes del siguiente lote...`);
        await Utils.sleep(CONFIG.delayBetweenBatches);
      }
    }
  }
  
  /**
   * Procesa un revisor individual
   */
  async _processReviewer(userData) {
    const reviewerUid = userData.uid;
    const email = userData.email || 'sin email';
    const name = userData.displayName || 'Sin nombre';
    
    try {
      // Validar UID
      if (!Utils.isValidUID(reviewerUid)) {
        this.logger.warn(`⏭️ Omitido: UID inválido para ${email}`);
        this.results.skipped++;
        this.results.details.push({
          uid: reviewerUid || 'unknown',
          email,
          name,
          status: 'skipped',
          reason: 'UID inválido',
        });
        return;
      }
      
      // Verificar documento existente
      const reviewerRef = this.db.collection('reviewers').doc(reviewerUid);
      const existingDoc = await reviewerRef.get();
      const exists = existingDoc.exists;
      
      if (exists && !CONFIG.forceUpdate) {
        this.logger.info(`⏭️ Omitido (ya existe): ${name} (${email})`);
        this.results.skipped++;
        this.results.details.push({
          uid: reviewerUid,
          email,
          name,
          status: 'skipped',
          reason: 'Documento ya existe y forceUpdate=false',
        });
        return;
      }
      
      // Construir documento
      const document = await this.documentBuilder.build(
        userData, 
        exists ? existingDoc.data() : null
      );
      
      // Escribir en Firestore (o simular)
      if (!CONFIG.dryRun) {
        await reviewerRef.set(document, { merge: true });
        
        // Actualizar referencia en el perfil del usuario
        const userRef = this.db.collection('users').doc(reviewerUid);
        await userRef.update({
          reviewerProfileId: reviewerUid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      
      // Registrar resultado
      if (exists) {
        this.results.updated++;
        this.logger.success(`🔄 Actualizado: ${name} (${email})`);
      } else {
        this.results.created++;
        this.logger.success(`✅ Creado: ${name} (${email})`);
      }
      
      this.results.details.push({
        uid: reviewerUid,
        email,
        name,
        status: exists ? 'updated' : 'created',
        areasOfExpertise: document.areasOfExpertise,
        statsSummary: {
          totalInvitations: document.stats.totalInvitations,
          completedReviews: document.stats.totalReviewsSubmitted,
          acceptanceRate: document.stats.acceptanceRate,
        },
      });
      
      // Agregar a auditoría
      if (CONFIG.createAuditTrail) {
        this.auditTrail.push({
          action: exists ? 'reviewer_document_updated' : 'reviewer_document_created',
          reviewerUid,
          reviewerEmail: email,
          reviewerName: name,
          timestamp: new Date().toISOString(),
          previousStatus: exists ? existingDoc.data().status : null,
          newStatus: document.status,
          areasOfExpertise: document.areasOfExpertise,
        });
      }
      
    } catch (error) {
      this.logger.error(`❌ Error procesando ${name} (${email}): ${error.message}`);
      this.results.errors++;
      this.results.details.push({
        uid: reviewerUid || 'unknown',
        email,
        name,
        status: 'error',
        error: error.message,
        stack: error.stack,
      });
    }
  }
  
  /**
   * Crea el documento de auditoría en Firestore
   */
  async _createAuditTrail() {
    try {
      this.logger.info('Creando documento de auditoría...');
      
      const auditDoc = {
        type: 'reviewers_collection_migration',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        executedAt: this.results.startTime.toISOString(),
        completedAt: new Date().toISOString(),
        duration: this.results.duration,
        script: 'populateReviewersCollection.js',
        version: '1.0.0',
        dryRun: CONFIG.dryRun,
        summary: {
          totalUsers: this.results.totalUsers,
          totalReviewers: this.results.totalReviewers,
          created: this.results.created,
          updated: this.results.updated,
          skipped: this.results.skipped,
          errors: this.results.errors,
        },
        trail: this.auditTrail,
        configuration: {
          batchSize: CONFIG.batchSize,
          forceUpdate: CONFIG.forceUpdate,
          reviewerRoles: CONFIG.reviewerRoles,
        },
      };
      
      await this.db.collection('migrationAuditLogs').add(auditDoc);
      this.logger.success('✅ Documento de auditoría creado exitosamente');
    } catch (error) {
      this.logger.error(`Error creando auditoría: ${error.message}`);
    }
  }
  
  /**
   * Calcula el resumen final
   */
  _calculateSummary() {
    const total = this.results.totalReviewers;
    const success = this.results.created + this.results.updated;
    
    this.results.summary = {
      successRate: total > 0 ? Math.round((success / total) * 100) : 0,
      errorRate: total > 0 ? Math.round((this.results.errors / total) * 100) : 0,
      skippedRate: total > 0 ? Math.round((this.results.skipped / total) * 100) : 0,
      averageAreasPerReviewer: 0,
      reviewersWithApplications: 0,
      reviewersWithoutApplications: 0,
    };
    
    // Calcular promedios
    const successfulDetails = this.results.details.filter(
      d => d.status === 'created' || d.status === 'updated'
    );
    
    if (successfulDetails.length > 0) {
      const totalAreas = successfulDetails.reduce(
        (sum, d) => sum + (d.areasOfExpertise?.length || 0), 0
      );
      this.results.summary.averageAreasPerReviewer = 
        parseFloat((totalAreas / successfulDetails.length).toFixed(1));
    }
    
    // Contar con/sin aplicación
    this.results.summary.reviewersWithApplications = this.auditTrail.filter(
      t => t.areasOfExpertise && t.areasOfExpertise.length > 0
    ).length;
    this.results.summary.reviewersWithoutApplications = 
      success - this.results.summary.reviewersWithApplications;
  }
  
  /**
   * Muestra los resultados finales
   */
  _displayResults() {
    const duration = Utils.formatDuration(this.results.duration);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTADOS DE LA MIGRACIÓN');
    console.log('='.repeat(60));
    console.log(`⏱️  Duración total: ${duration}`);
    console.log(`📅 Inicio: ${this.results.startTime.toISOString()}`);
    console.log(`📅 Fin: ${this.results.endTime.toISOString()}`);
    console.log('');
    console.log(`👥 Total usuarios en el sistema: ${this.results.totalUsers}`);
    console.log(`🔍 Usuarios con rol de revisor: ${this.results.totalReviewers}`);
    console.log('');
    console.log(`✅ Creados: ${this.results.created}`);
    console.log(`🔄 Actualizados: ${this.results.updated}`);
    console.log(`⏭️  Omitidos: ${this.results.skipped}`);
    console.log(`❌ Errores: ${this.results.errors}`);
    console.log('');
    console.log(`📈 Tasa de éxito: ${this.results.summary.successRate}%`);
    console.log(`📉 Tasa de error: ${this.results.summary.errorRate}%`);
    console.log(`📊 Áreas promedio por revisor: ${this.results.summary.averageAreasPerReviewer}`);
    console.log('');
    
    if (this.results.errors > 0) {
      console.log('⚠️  DETALLES DE ERRORES:');
      this.results.details
        .filter(d => d.status === 'error')
        .forEach((d, i) => {
          console.log(`  ${i + 1}. ${d.name} (${d.email})`);
          console.log(`     Error: ${d.error}`);
        });
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (CONFIG.dryRun) {
      console.log('⚠️  ESTO FUE UNA SIMULACIÓN. No se realizaron cambios.');
      console.log('   Para ejecutar realmente, establece dryRun: false en la configuración.');
    } else {
      console.log('✅ Migración completada exitosamente.');
    }
  }
}

// ============================================================
// SISTEMA DE CONFIRMACIÓN INTERACTIVA
// ============================================================

async function confirmExecution(logger) {
  if (!CONFIG.requireConfirmation) return true;
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    console.log('\n' + '='.repeat(60));
    console.log('⚠️  CONFIRMACIÓN REQUERIDA');
    console.log('='.repeat(60));
    console.log(`Modo: ${CONFIG.dryRun ? 'SIMULACIÓN (dry-run)' : 'ESCRITURA REAL'}`);
    console.log(`Forzar actualización: ${CONFIG.forceUpdate ? 'Sí' : 'No'}`);
    console.log(`Base de datos: ${CONFIG.databaseURL}`);
    console.log('');
    
    if (!CONFIG.dryRun) {
      console.log('🔴 ADVERTENCIA: Este script realizará cambios REALES en la base de datos.');
      console.log('   Se recomienda hacer un backup de Firestore antes de continuar.');
    }
    
    console.log('');
    
    rl.question('¿Desea continuar con la migración? (escribe "EJECUTAR" para confirmar): ', (answer) => {
      rl.close();
      
      if (answer.trim().toUpperCase() === 'EJECUTAR') {
        console.log('\n✅ Confirmación recibida. Iniciando migración...\n');
        resolve(true);
      } else {
        console.log('\n❌ Migración cancelada por el usuario.\n');
        resolve(false);
      }
    });
  });
}

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

async function main() {
  const logger = new Logger();
  
  console.log('\n' + '='.repeat(60));
  console.log('🔧 SCRIPT DE MIGRACIÓN: REVIEWERS COLLECTION POPULATOR');
  console.log('='.repeat(60));
  console.log(`Versión: 1.0.0`);
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log(`PID: ${process.pid}`);
  console.log('');
  
  // Verificar configuración
  console.log('📋 CONFIGURACIÓN:');
  console.log(`   Service Account: ${CONFIG.serviceAccountPath}`);
  console.log(`   Database URL: ${CONFIG.databaseURL}`);
  console.log(`   Batch Size: ${CONFIG.batchSize}`);
  console.log(`   Force Update: ${CONFIG.forceUpdate}`);
  console.log(`   Dry Run: ${CONFIG.dryRun}`);
  console.log(`   Create Audit Trail: ${CONFIG.createAuditTrail}`);
  console.log(`   Reviewer Roles: ${CONFIG.reviewerRoles.join(', ')}`);
  console.log('');
  
  try {
    // Confirmar ejecución
    const confirmed = await confirmExecution(logger);
    if (!confirmed) {
      logger.close();
      process.exit(0);
    }
    
    // Inicializar Firebase
    const app = initializeFirebase();
    const db = app.firestore();
    
    // Configurar timeout de seguridad
    const timeoutMs = CONFIG.maxExecutionTimeMinutes * 60 * 1000;
    const timeout = setTimeout(() => {
      logger.error(`⏰ Timeout: La migración excedió los ${CONFIG.maxExecutionTimeMinutes} minutos máximos.`);
      logger.close();
      process.exit(1);
    }, timeoutMs);
    
    // Ejecutar migración
    const executor = new MigrationExecutor(db, logger);
    const results = await executor.execute();
    
    // Limpiar timeout
    clearTimeout(timeout);
    
    // Guardar resultados en archivo JSON
    const resultsFile = path.join(
      CONFIG.logsDir, 
      `migration-results-${logger.timestamp}.json`
    );
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n📄 Resultados detallados guardados en: ${resultsFile}`);
    
    // Cerrar logger
    logger.close();
    
    // Salir con código apropiado
    if (results.errors > 0) {
      console.log('\n⚠️  La migración completó con errores. Revisa el archivo de log para más detalles.');
      process.exit(1);
    } else {
      console.log('\n🎉 Migración completada exitosamente.');
      process.exit(0);
    }
    
  } catch (error) {
    logger.error(`Error fatal: ${error.message}`);
    logger.error(error.stack);
    logger.close();
    process.exit(1);
  }
}

// ============================================================
// MANEJO DE SEÑALES DE TERMINACIÓN
// ============================================================

process.on('SIGINT', () => {
  console.log('\n\n⚠️  Recibida señal SIGINT. Cancelando migración...');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Recibida señal SIGTERM. Cancelando migración...');
  process.exit(143);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled Rejection:');
  console.error(reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught Exception:');
  console.error(error);
  process.exit(1);
});

// ============================================================
// INICIAR
// ============================================================

if (require.main === module) {
  main().catch(error => {
    console.error('Error fatal no capturado:', error);
    process.exit(1);
  });
}

module.exports = {
  MigrationExecutor,
  ReviewerDocumentBuilder,
  ReviewerStatsCalculator,
  CONFIG,
};