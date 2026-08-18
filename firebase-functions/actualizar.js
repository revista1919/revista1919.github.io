// setCertificatesPublicReadOnly.js
"use strict";

const admin = require('firebase-admin');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// ==================== CONFIGURACIÓN ====================
const PROJECT_ID = 'usuarios-rnce';
const CERTIFICATES_ROOT_FOLDER_NAME = 'CERTIFICADOS_ACEPTACION';
const DRY_RUN = process.argv.includes('--dry-run');

// ==================== OBTENER SECRETS ====================
function getFirebaseSecret(secretName) {
  try {
    const secretValue = execSync(
      `firebase functions:secrets:access ${secretName} --project ${PROJECT_ID}`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    
    if (secretValue && secretValue.length > 0) {
      return secretValue;
    }
  } catch (error) {
    console.log(`⚠️ No se pudo obtener ${secretName} via CLI, buscando archivo local...`);
  }
  
  const localSecretPath = path.join(__dirname, `.secrets.${secretName}`);
  if (fs.existsSync(localSecretPath)) {
    return fs.readFileSync(localSecretPath, 'utf-8').trim();
  }
  
  throw new Error(`No se pudo obtener el secret ${secretName}`);
}

// ==================== INICIALIZAR FIREBASE ====================
console.log('🔐 Obteniendo secrets de Firebase...\n');

let OAUTH2_CLIENT_ID, OAUTH2_CLIENT_SECRET, OAUTH2_REFRESH_TOKEN;

try {
  OAUTH2_CLIENT_ID = getFirebaseSecret('OAUTH2_CLIENT_ID');
  OAUTH2_CLIENT_SECRET = getFirebaseSecret('OAUTH2_CLIENT_SECRET');
  OAUTH2_REFRESH_TOKEN = getFirebaseSecret('OAUTH2_REFRESH_TOKEN');
  console.log('✅ Secrets obtenidos correctamente\n');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = require('./serviceAccountKey.json');
  console.log('✅ Service account cargado');
} catch {
  serviceAccount = null;
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID
  });
} else {
  admin.initializeApp({ projectId: PROJECT_ID });
}

const db = admin.firestore();
console.log('✅ Firebase Admin inicializado\n');

// ==================== FUNCIÓN: OBTENER CLIENTE DE DRIVE ====================
async function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    OAUTH2_CLIENT_ID,
    OAUTH2_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  );
  
  oauth2Client.setCredentials({
    refresh_token: OAUTH2_REFRESH_TOKEN
  });
  
  await oauth2Client.getAccessToken();
  return google.drive({ version: 'v3', auth: oauth2Client });
}

// ==================== FUNCIÓN: HACER ARCHIVO PÚBLICO (SOLO LECTURA) ====================
async function makeFilePublicReadOnly(drive, fileId) {
  try {
    // Crear permiso para "cualquiera con el enlace" como lector
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      fields: 'id',
    });
    
    return { success: true, message: 'Permiso público de solo lectura otorgado' };
  } catch (error) {
    // Si el permiso ya existe, no es un error crítico
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      return { success: true, message: 'Permiso público ya existente' };
    }
    
    return { success: false, message: `Error: ${error.message}` };
  }
}

// ==================== FUNCIÓN: HACER CARPETA PÚBLICA (SOLO LECTURA) ====================
async function makeFolderPublicReadOnly(drive, folderId) {
  try {
    await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      fields: 'id',
    });
    
    return { success: true, message: 'Permiso público de solo lectura otorgado' };
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      return { success: true, message: 'Permiso público ya existente' };
    }
    
    return { success: false, message: `Error: ${error.message}` };
  }
}

// ==================== FUNCIÓN: CONFIGURAR PERMISOS DE UN ARCHIVO ====================
async function setFilePermissions(drive, fileId, fileName = '') {
  console.log(`   📄 Procesando archivo: ${fileName || fileId}`);
  
  // Obtener permisos actuales
  try {
    const permissions = await drive.permissions.list({
      fileId: fileId,
      fields: 'permissions(id, type, role, emailAddress)'
    });
    
    console.log(`      Permisos actuales: ${permissions.data.permissions.length}`);
    
    // Verificar si ya tiene permiso público
    const publicPermission = permissions.data.permissions.find(p => p.type === 'anyone');
    
    if (publicPermission && publicPermission.role === 'reader') {
      console.log(`      ✓ Ya tiene permiso público de solo lectura`);
      return { success: true, alreadyConfigured: true };
    }
    
    // Si hay un permiso público pero no es de solo lectura, actualizarlo
    if (publicPermission && publicPermission.role !== 'reader') {
      console.log(`      ⚠️ Actualizando permiso público de "${publicPermission.role}" a "reader"`);
      await drive.permissions.update({
        fileId: fileId,
        permissionId: publicPermission.id,
        requestBody: {
          role: 'reader'
        }
      });
      return { success: true, updated: true };
    }
    
    // Si no hay permiso público, crearlo
    if (!DRY_RUN) {
      const result = await makeFilePublicReadOnly(drive, fileId);
      if (result.success) {
        console.log(`      ✓ ${result.message}`);
        return { success: true };
      } else {
        console.log(`      ❌ ${result.message}`);
        return { success: false, error: result.message };
      }
    } else {
      console.log(`      [DRY RUN] Se otorgaría permiso público de solo lectura`);
      return { success: true, dryRun: true };
    }
    
  } catch (error) {
    console.error(`      ❌ Error al listar permisos:`, error.message);
    return { success: false, error: error.message };
  }
}

// ==================== FUNCIÓN: CONFIGURAR PERMISOS RECURSIVAMENTE ====================
async function setFolderAndContentsPermissions(drive, folderId, folderName = '', depth = 0) {
  const indent = '  '.repeat(depth);
  console.log(`\n${indent}📁 Configurando carpeta: ${folderName || folderId}`);
  
  try {
    // Configurar permisos de la carpeta
    if (!DRY_RUN) {
      const folderResult = await makeFolderPublicReadOnly(drive, folderId);
      if (folderResult.success) {
        console.log(`${indent}   ✓ ${folderResult.message}`);
      } else {
        console.log(`${indent}   ❌ ${folderResult.message}`);
      }
    } else {
      console.log(`${indent}   [DRY RUN] Se otorgaría permiso público de solo lectura a la carpeta`);
    }
    
    // Listar archivos y subcarpetas
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType)',
      pageSize: 100
    });
    
    const items = response.data.files || [];
    console.log(`${indent}   Contenido: ${items.length} elementos`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Procesar cada elemento
    for (const item of items) {
      if (item.mimeType === 'application/vnd.google-apps.folder') {
        // Es una subcarpeta, procesar recursivamente
        const result = await setFolderAndContentsPermissions(drive, item.id, item.name, depth + 1);
        if (result.success) {
          successCount += result.successCount;
          errorCount += result.errorCount;
        }
      } else if (item.mimeType === 'application/pdf' || item.name.toLowerCase().endsWith('.pdf')) {
        // Es un PDF, configurar permisos
        const result = await setFilePermissions(drive, item.id, item.name);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      } else {
        console.log(`${indent}   ⏭️ Omitiendo: ${item.name} (${item.mimeType})`);
      }
      
      // Pequeña pausa para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return { success: true, successCount, errorCount };
    
  } catch (error) {
    console.error(`${indent}❌ Error procesando carpeta ${folderName || folderId}:`, error.message);
    return { success: false, successCount: 0, errorCount: 1 };
  }
}

// ==================== FUNCIÓN: ENCONTRAR CARPETA ====================
async function findFolder(drive, folderName, parentId = null) {
  let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }
  
  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive'
  });
  
  return response.data.files[0] || null;
}

// ==================== FUNCIÓN: CONFIGURAR PERMISOS DESDE FIRESTORE ====================
async function setPermissionsFromFirestore(drive) {
  console.log('\n📋 Configurando permisos basados en datos de Firestore...\n');
  
  try {
    // Obtener todos los certificados
    const certSnapshot = await db.collection('certificates').get();
    console.log(`📦 Certificados encontrados: ${certSnapshot.docs.length}\n`);
    
    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;
    
    for (const certDoc of certSnapshot.docs) {
      const certData = certDoc.data();
      const fileId = certData.fileId;
      
      if (!fileId) {
        console.log(`⏭️ Certificado sin fileId: ${certDoc.id}`);
        skipCount++;
        continue;
      }
      
      console.log(`\n📄 Procesando certificado: ${certDoc.id}`);
      console.log(`   File ID: ${fileId}`);
      
      const result = await setFilePermissions(drive, fileId, certData.fileName || certDoc.id);
      
      if (result.success && !result.alreadyConfigured && !result.dryRun) {
        successCount++;
      } else if (result.alreadyConfigured) {
        console.log(`   ✓ Ya configurado correctamente`);
        successCount++;
      } else if (result.dryRun) {
        console.log(`   [DRY RUN] Configuración simulada`);
        successCount++;
      } else {
        errorCount++;
      }
      
      // Actualizar Firestore con la información de permisos
      if (!DRY_RUN && result.success) {
        await certDoc.ref.update({
          isPublic: true,
          permissionType: 'anyone_reader',
          permissionsUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`   ✓ Firestore actualizado con estado de permisos`);
      }
      
      // Pausa para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 RESULTADOS DE CONFIGURACIÓN (desde Firestore)');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Configurados: ${successCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`⏭️ Omitidos (sin fileId): ${skipCount}`);
    console.log(`📦 Total: ${certSnapshot.docs.length}`);
    
    return { successCount, errorCount, skipCount, total: certSnapshot.docs.length };
    
  } catch (error) {
    console.error('❌ Error al configurar permisos desde Firestore:', error);
    throw error;
  }
}

// ==================== FUNCIÓN: CONFIGURAR TODA LA ESTRUCTURA DE CARPETAS ====================
async function setEntireFolderStructurePermissions(drive) {
  console.log('\n📁 Configurando permisos de toda la estructura de carpetas...\n');
  
  try {
    // Encontrar la carpeta raíz
    const rootFolder = await findFolder(drive, CERTIFICATES_ROOT_FOLDER_NAME);
    
    if (!rootFolder) {
      console.log(`❌ No se encontró la carpeta raíz: ${CERTIFICATES_ROOT_FOLDER_NAME}`);
      return { successCount: 0, errorCount: 0, total: 0 };
    }
    
    console.log(`📁 Carpeta raíz encontrada: ${rootFolder.name} (${rootFolder.id})\n`);
    
    // Configurar permisos recursivamente
    const result = await setFolderAndContentsPermissions(drive, rootFolder.id, rootFolder.name);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 RESULTADOS DE CONFIGURACIÓN (estructura de carpetas)');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Configurados: ${result.successCount}`);
    console.log(`❌ Errores: ${result.errorCount}`);
    
    return { 
      successCount: result.successCount, 
      errorCount: result.errorCount, 
      total: result.successCount + result.errorCount 
    };
    
  } catch (error) {
    console.error('❌ Error al configurar estructura de carpetas:', error);
    throw error;
  }
}

// ==================== FUNCIÓN PRINCIPAL ====================
async function main() {
  console.log('🔐 Iniciando configuración de permisos de certificados...');
  console.log(`⏰ Inicio: ${new Date().toISOString()}`);
  console.log(`📋 Modo: ${DRY_RUN ? 'SIMULACIÓN (--dry-run)' : 'EJECUCIÓN REAL'}`);
  console.log(`👁️ Permisos: Público (cualquiera con el enlace) - Solo lectura\n`);
  
  try {
    // Inicializar Drive
    const drive = await getDriveClient();
    console.log('✅ Drive inicializado\n');
    
    // Opciones de configuración
    const args = process.argv;
    const useFirestore = args.includes('--firestore');
    const useFolderStructure = args.includes('--folders');
    const useBoth = !useFirestore && !useFolderStructure; // Por defecto, ambos
    
    let results = {};
    
    // Configurar desde Firestore
    if (useBoth || useFirestore) {
      console.log('📋 Modo: Configuración basada en Firestore\n');
      results.firestore = await setPermissionsFromFirestore(drive);
    }
    
    // Configurar estructura de carpetas
    if (useBoth || useFolderStructure) {
      console.log('\n📁 Modo: Configuración de estructura de carpetas\n');
      results.folders = await setEntireFolderStructurePermissions(drive);
    }
    
    // Resumen final
    console.log(`\n${'='.repeat(60)}`);
    console.log('🎉 CONFIGURACIÓN COMPLETADA');
    console.log(`${'='.repeat(60)}`);
    
    if (results.firestore) {
      console.log('\n📋 Desde Firestore:');
      console.log(`   ✅ Configurados: ${results.firestore.successCount}`);
      console.log(`   ❌ Errores: ${results.firestore.errorCount}`);
      console.log(`   ⏭️ Omitidos: ${results.firestore.skipCount}`);
    }
    
    if (results.folders) {
      console.log('\n📁 Desde estructura de carpetas:');
      console.log(`   ✅ Configurados: ${results.folders.successCount}`);
      console.log(`   ❌ Errores: ${results.folders.errorCount}`);
    }
    
    console.log(`\n⏰ Fin: ${new Date().toISOString()}`);
    
  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    throw error;
  }
}

// ==================== EJECUTAR ====================
main()
  .then(() => {
    console.log('\n✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falló:', error);
    process.exit(1);
  });