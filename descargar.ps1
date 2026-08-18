# Crear carpeta de fuentes
New-Item -ItemType Directory -Force -Path "fonts"

# Definir la versión más reciente de las fuentes Libertinus
$version = "7.051"

# Descargar el archivo comprimido que contiene todas las fuentes Libertinus
Write-Host "Descargando la familia de fuentes Libertinus v$version..."
$downloadUrl = "https://github.com/alerque/libertinus/releases/download/v$version/Libertinus-$version.tar.zst"
$outputFile = "fonts/Libertinus-$version.tar.zst"

Invoke-WebRequest -Uri $downloadUrl -OutFile $outputFile

Write-Host "Fuentes descargadas correctamente como $outputFile"
Write-Host "Nota: El archivo descargado es un paquete comprimido que contiene todas las familias de fuentes (Serif, Sans, Mono, Math, etc.)."
Write-Host "Para usar las fuentes, descomprime el archivo .tar.zst con una herramienta como 7-Zip o WinRAR."