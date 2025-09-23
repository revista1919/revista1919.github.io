#!/bin/bash
echo "📊 Verificando tamaño del repositorio..."

# 1. Archivos grandes (>1MB)
echo "🔍 Archivos >1MB:"
git ls-files | xargs ls -lh 2>/dev/null | awk '$5 > 1048576' | sort -k5 -h || echo "✅ Ningún archivo >1MB"

# 2. Chromium restantes
echo -e "\n🔍 Buscando Chromium:"
if find node_modules -path "*/puppeteer*" -name "*chrome*" 2>/dev/null | grep -q .; then
    echo "❌ Chromium detectado:"
    find node_modules -path "*/puppeteer*" -name "*chrome*" 2>/dev/null
else
    echo "✅ Sin Chromium"
fi

# 3. Tamaño total
echo -e "\n📦 Tamaño del repo:"
echo "Git: $(du -sh .git 2>/dev/null || echo 'N/A')"
echo "Src: $(du -sh src 2>/dev/null || echo 'N/A')"
echo "Public: $(du -sh public 2>/dev/null || echo 'N/A')"
echo "Node_modules: $(du -sh node_modules 2>/dev/null || echo 'N/A')"

# 4. Listo para push?
LARGE_FILES=$(git ls-files | xargs ls -lh 2>/dev/null | awk '$5 > 104857600')
if [ -z "$LARGE_FILES" ]; then
    echo -e "\n✅ ¡LISTO PARA PUSH! No hay archivos >100MB"
    exit 0
else
    echo -e "\n❌ Archivos >100MB detectados:"
    echo "$LARGE_FILES"
    exit 1
fi