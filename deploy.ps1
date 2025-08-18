# Crear directorio temporal
$tempDir = "temp_deploy"
New-Item -ItemType Directory -Force -Path $tempDir

# Copiar archivos necesarios
Copy-Item -Path "frontend\*" -Destination $tempDir -Recurse -Force
Copy-Item -Path "wrangler.toml" -Destination $tempDir -Force

# Eliminar archivos innecesarios
Remove-Item -Path "$tempDir\*.rar" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$tempDir\*.zip" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$tempDir\*.sql" -Force -ErrorAction SilentlyContinue

# Desplegar
Set-Location $tempDir
wrangler pages deploy . --project-name sistema-pos-mg

# Limpiar
Set-Location ..
Remove-Item -Path $tempDir -Recurse -Force
