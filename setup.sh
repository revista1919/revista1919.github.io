#!/bin/bash
echo "🚀 Setup inicial del Codespace..."

# 1. Instala Chromium del sistema
if ! command -v chromium-browser &> /dev/null; then
    echo "🐛 Instalando Chromium..."
    sudo apt-get update -qq
    sudo apt-get install -y -qq chromium-browser
    echo "✅ Chromium instalado: $(chromium-browser --version)"
else
    echo "✅ Chromium ya disponible: $(chromium-browser --version)"
fi

# 2. Verifica .npmrc
if [ ! -f .npmrc ]; then
    echo "📝 Creando .npmrc..."
    cat > .npmrc << 'EOF'
puppeteer_skip_chromium_download=true
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
MINIMALCSS_SKIP_CHROMIUM_DOWNLOAD=true
cache=min
audit=false
fund=false
optional=false
EOF
    echo "✅ .npmrc creado"
fi

# 3. Instala dependencias
echo "📦 Instalando dependencias..."
npm ci

# 4. Verifica que NO hay Chromium local
echo "🔍 Verificando node_modules..."
if find node_modules -path "*/.local-chromium*" -type d 2>/dev/null | grep -q .; then
    echo "❌ ¡HAY CHROMIUM LOCAL! Limpiando..."
    find node_modules -path "*/.local-chromium*" -type f -delete 2>/dev/null
    echo "✅ Limpiado"
else
    echo "✅ Sin Chromium local"
fi

# 5. Test rápido
echo "🧪 Probando build..."
npm run build

echo "🎉 Setup completado. Ejecuta 'npm run start' para desarrollo."