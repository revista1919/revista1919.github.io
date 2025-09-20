#!/bin/bash
echo "🔧 Instalando polyfills necesarios..."

# Polyfills críticos
npm install --save \
  crypto-browserify@^3.12.0 \
  stream-browserify@^3.0.0 \
  util@^0.12.5 \
  os-browserify@^0.3.0 \
  vm-browserify@^1.1.2 \
  url@^0.11.3 \
  assert@^2.0.0 \
  string_decoder@^1.3.0 \
  browserify-zlib@^0.2.0

echo "✅ Polyfills instalados correctamente"
echo "🔄 Limpiando cache de npm..."
npm cache clean --force

echo "🚀 Puedes ejecutar npm run build ahora"