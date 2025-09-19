// scripts/check-env.js
const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración de environment variables...\n');

const requiredVars = [
  'REACT_APP_ARTICULOS_SCRIPT_URL',
  'REACT_APP_GH_TOKEN'
];

const envVars = process.env;

requiredVars.forEach(varName => {
  const value = envVars[varName];
  const status = value && value.length > 10 ? '✅' : '❌';
  const displayValue = value ? `${value.slice(0, 30)}${value.length > 30 ? '...' : ''}` : 'MISSING';
  
  console.log(`${status} ${varName}: ${displayValue}`);
});

console.log('\n📋 Resumen:');
const missingVars = requiredVars.filter(varName => !envVars[varName] || envVars[varName].length < 10);
if (missingVars.length === 0) {
  console.log('🎉 ¡Todas las variables están configuradas correctamente!');
  console.log('🚀 Puedes ejecutar: npm run start o npm run build');
} else {
  console.log(`⚠️  Faltan ${missingVars.length} variables:`);
  missingVars.forEach(varName => console.log(`   - ${varName}`));
  console.log('\n💡 Copia .env.example a .env.local y completa los valores');
  process.exit(1);
}