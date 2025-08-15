#!/bin/bash
# trivy-bmw-analysis.sh
# Script completo de análisis de seguridad con Trivy para BMW Service Manager
# Autor: Security Team
# Fecha: $(date +%Y-%m-%d)

set -e  # Salir si hay errores

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Variables de configuración
PROJECT_NAME="bmw-service-manager"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="trivy-reports-$TIMESTAMP"
IMAGE_NAME="miguel2210/bmw-service-manager:latest"
PROJECT_PATH="/home/kali/Proyecto-final"

# Funciones auxiliares
print_header() {
    echo -e "${CYAN}================================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}================================================${NC}"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar dependencias
check_dependencies() {
    print_step "Verificando dependencias..."
    
    # Verificar si Trivy está instalado
    if ! command -v trivy &> /dev/null; then
        print_warning "Trivy no está instalado. Intentando instalar..."
        
        # Intentar instalar Trivy
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y wget
            wget https://github.com/aquasecurity/trivy/releases/latest/download/trivy_0.65.0_Linux-64bit.tar.gz
            tar -xzf trivy_0.65.0_Linux-64bit.tar.gz
            sudo mv trivy /usr/local/bin/
            sudo chmod +x /usr/local/bin/trivy
            rm trivy_0.65.0_Linux-64bit.tar.gz
            print_success "Trivy instalado correctamente"
        else
            print_error "No se pudo instalar Trivy automáticamente"
            echo "Por favor instala Trivy manualmente desde: https://github.com/aquasecurity/trivy"
            exit 1
        fi
    else
        print_success "Trivy encontrado: $(trivy version | head -1)"
    fi
    
    # Verificar si Docker está disponible
    if ! command -v docker &> /dev/null; then
        print_error "Docker no está instalado o no está en el PATH"
        exit 1
    else
        print_success "Docker encontrado: $(docker --version)"
    fi
    
    # Verificar si jq está disponible para análisis JSON
    if ! command -v jq &> /dev/null; then
        print_warning "jq no está instalado. Instalando..."
        sudo apt-get install -y jq
        print_success "jq instalado"
    fi
}

# Preparar entorno
setup_environment() {
    print_step "Preparando entorno de análisis..."
    
    # Crear directorio de reportes
    mkdir -p "$REPORT_DIR"
    print_success "Directorio de reportes creado: $REPORT_DIR"
    
    # Cambiar al directorio del proyecto
    if [ -d "$PROJECT_PATH" ]; then
        cd "$PROJECT_PATH"
        print_success "Cambiado al directorio del proyecto: $PROJECT_PATH"
    else
        print_warning "Directorio del proyecto no encontrado, usando directorio actual"
        PROJECT_PATH=$(pwd)
    fi
    
    # Crear archivo .trivyignore si no existe
    if [ ! -f ".trivyignore" ]; then
        cat > .trivyignore << 'EOF'
# Archivos a ignorar en el análisis
*.md
*.pdf
*.log
*.txt
.git/
node_modules/.cache/
trivy-reports-*/
*.zip
*.tar.gz
*.json
*.html
EOF
        print_success "Archivo .trivyignore creado"
    fi
}

# Actualizar base de datos de vulnerabilidades
update_db() {
    print_step "Actualizando base de datos de vulnerabilidades..."
    
    if trivy image --download-db-only; then
        print_success "Base de datos actualizada correctamente"
    else
        print_warning "Error al actualizar base de datos, continuando con la existente"
    fi
}

# Verificar disponibilidad de imagen Docker
check_image() {
    print_step "Verificando disponibilidad de imagen Docker..."
    
    # Intentar descargar la imagen si no existe
    if ! docker image inspect "$IMAGE_NAME" &> /dev/null; then
        print_step "Descargando imagen $IMAGE_NAME..."
        if docker pull "$IMAGE_NAME"; then
            print_success "Imagen descargada correctamente"
        else
            print_warning "No se pudo descargar la imagen. Intentando construir localmente..."
            if [ -f "Dockerfile" ]; then
                docker build -t bmw-service-manager:latest .
                IMAGE_NAME="bmw-service-manager:latest"
                print_success "Imagen construida localmente"
            else
                print_error "No se encontró Dockerfile y no se pudo descargar la imagen"
                exit 1
            fi
        fi
    else
        print_success "Imagen Docker disponible: $IMAGE_NAME"
    fi
}

# Análisis de imagen Docker
analyze_docker_image() {
    print_header "ANÁLISIS DE IMAGEN DOCKER"
    
    print_step "Analizando imagen Docker completa..."
    trivy image "$IMAGE_NAME" --format json --output "$REPORT_DIR/image-full.json" 2>/dev/null
    trivy image "$IMAGE_NAME" --format table --output "$REPORT_DIR/image-table.txt" 2>/dev/null
    print_success "Análisis completo de imagen guardado"
    
    print_step "Analizando vulnerabilidades críticas y altas..."
    trivy image "$IMAGE_NAME" --severity HIGH,CRITICAL --format json --output "$REPORT_DIR/image-critical.json" 2>/dev/null
    trivy image "$IMAGE_NAME" --severity HIGH,CRITICAL --format table --output "$REPORT_DIR/image-critical-table.txt" 2>/dev/null
    print_success "Análisis de vulnerabilidades críticas guardado"
    
    print_step "Analizando configuración de Docker..."
    trivy image "$IMAGE_NAME" --scanners config --format json --output "$REPORT_DIR/docker-config.json" 2>/dev/null
    trivy image "$IMAGE_NAME" --scanners config --format table --output "$REPORT_DIR/docker-config.txt" 2>/dev/null
    print_success "Análisis de configuración Docker guardado"
    
    print_step "Buscando secretos en imagen..."
    trivy image "$IMAGE_NAME" --scanners secret --format json --output "$REPORT_DIR/image-secrets.json" 2>/dev/null
    trivy image "$IMAGE_NAME" --scanners secret --format table --output "$REPORT_DIR/image-secrets.txt" 2>/dev/null
    print_success "Búsqueda de secretos completada"
}

# Análisis del código fuente
analyze_filesystem() {
    print_header "ANÁLISIS DE CÓDIGO FUENTE"
    
    print_step "Analizando sistema de archivos completo..."
    trivy fs . --format json --output "$REPORT_DIR/filesystem-full.json" 2>/dev/null
    trivy fs . --format table --output "$REPORT_DIR/filesystem-table.txt" 2>/dev/null
    print_success "Análisis de sistema de archivos guardado"
    
    print_step "Analizando dependencias específicamente..."
    trivy fs . --scanners vuln --format table --output "$REPORT_DIR/dependencies-table.txt" 2>/dev/null
    trivy fs . --scanners vuln --format json --output "$REPORT_DIR/dependencies.json" 2>/dev/null
    print_success "Análisis de dependencias guardado"
    
    print_step "Analizando configuración de archivos..."
    trivy fs . --scanners config --format json --output "$REPORT_DIR/config-issues.json" 2>/dev/null
    trivy fs . --scanners config --format table --output "$REPORT_DIR/config-issues.txt" 2>/dev/null
    print_success "Análisis de configuración guardado"
    
    print_step "Buscando secretos en código fuente..."
    trivy fs . --scanners secret --format json --output "$REPORT_DIR/secrets.json" 2>/dev/null
    trivy fs . --scanners secret --format table --output "$REPORT_DIR/secrets.txt" 2>/dev/null
    print_success "Búsqueda de secretos en código completada"
}

# Análisis específico de dependencias Node.js
analyze_nodejs_deps() {
    print_header "ANÁLISIS ESPECÍFICO NODE.JS"
    
    if [ -f "package.json" ]; then
        print_step "Analizando package.json..."
        trivy fs package.json --format json --output "$REPORT_DIR/package-vulnerabilities.json" 2>/dev/null
        trivy fs package.json --format table --output "$REPORT_DIR/package-table.txt" 2>/dev/null
        print_success "Análisis de package.json guardado"
    fi
    
    if [ -f "package-lock.json" ]; then
        print_step "Analizando package-lock.json..."
        trivy fs package-lock.json --format table --output "$REPORT_DIR/lockfile-analysis.txt" 2>/dev/null
        print_success "Análisis de package-lock.json guardado"
    fi
    
    if [ -d "node_modules" ]; then
        print_step "Analizando node_modules..."
        trivy fs node_modules --format json --output "$REPORT_DIR/node_modules-vulnerabilities.json" 2>/dev/null
        print_success "Análisis de node_modules guardado"
    fi
}

# Análisis específico BMW Service Manager
analyze_bmw_specific() {
    print_header "ANÁLISIS ESPECÍFICO BMW SERVICE MANAGER"
    
    print_step "Verificando dependencias críticas BMW..."
    if [ -f "$REPORT_DIR/dependencies.json" ]; then
        jq '.Results[]?.Vulnerabilities[]? | select(.PkgName | contains("express") or contains("bcrypt") or contains("sqlite") or contains("body-parser") or contains("express-session")) | {Package: .PkgName, Severity: .Severity, ID: .VulnerabilityID, Fixed: .FixedVersion}' "$REPORT_DIR/dependencies.json" > "$REPORT_DIR/bmw-critical-deps.json" 2>/dev/null
        print_success "Análisis de dependencias críticas BMW guardado"
    fi
    
    print_step "Analizando superficie de ataque..."
    {
        echo "=== INFORMACIÓN DE IMAGEN BMW SERVICE MANAGER ==="
        echo "Puertos expuestos:"
        docker image inspect "$IMAGE_NAME" 2>/dev/null | jq '.[0].Config.ExposedPorts' 2>/dev/null || echo "No disponible"
        echo ""
        echo "Variables de entorno:"
        docker image inspect "$IMAGE_NAME" 2>/dev/null | jq '.[0].Config.Env' 2>/dev/null || echo "No disponible"
        echo ""
        echo "Usuario configurado:"
        docker image inspect "$IMAGE_NAME" 2>/dev/null | jq '.[0].Config.User' 2>/dev/null || echo "No disponible"
        echo ""
        echo "Comando por defecto:"
        docker image inspect "$IMAGE_NAME" 2>/dev/null | jq '.[0].Config.Cmd' 2>/dev/null || echo "No disponible"
    } > "$REPORT_DIR/attack-surface.txt"
    print_success "Análisis de superficie de ataque guardado"
}

# Generar resumen ejecutivo
generate_summary() {
    print_header "GENERANDO RESUMEN EJECUTIVO"
    
    {
        echo "====================================================================="
        echo "           RESUMEN EJECUTIVO - BMW SERVICE MANAGER"
        echo "====================================================================="
        echo "Fecha de análisis: $(date)"
        echo "Imagen analizada: $IMAGE_NAME"
        echo "Proyecto: $PROJECT_PATH"
        echo ""
        
        echo "=== VULNERABILIDADES EN IMAGEN DOCKER ==="
        if [ -f "$REPORT_DIR/image-full.json" ]; then
            jq -r '.Results[]?.Vulnerabilities[]? | .Severity' "$REPORT_DIR/image-full.json" 2>/dev/null | sort | uniq -c || echo "0 vulnerabilidades encontradas"
        else
            echo "No se pudo analizar la imagen"
        fi
        
        echo ""
        echo "=== VULNERABILIDADES EN CÓDIGO FUENTE ==="
        if [ -f "$REPORT_DIR/filesystem-full.json" ]; then
            jq -r '.Results[]?.Vulnerabilities[]? | .Severity' "$REPORT_DIR/filesystem-full.json" 2>/dev/null | sort | uniq -c || echo "0 vulnerabilidades encontradas"
        else
            echo "No se pudo analizar el código fuente"
        fi
        
        echo ""
        echo "=== PROBLEMAS DE CONFIGURACIÓN ==="
        if [ -f "$REPORT_DIR/config-issues.json" ]; then
            jq -r '.Results[]?.Misconfigurations[]? | .Severity' "$REPORT_DIR/config-issues.json" 2>/dev/null | sort | uniq -c || echo "0 problemas de configuración"
        else
            echo "No se encontraron problemas de configuración"
        fi
        
        echo ""
        echo "=== SECRETOS DETECTADOS ==="
        if [ -f "$REPORT_DIR/secrets.json" ]; then
            SECRET_COUNT=$(jq -r '.Results[]?.Secrets[]? | .Title' "$REPORT_DIR/secrets.json" 2>/dev/null | wc -l)
            echo "$SECRET_COUNT secretos potenciales detectados"
        else
            echo "0 secretos detectados"
        fi
        
        echo ""
        echo "=== VULNERABILIDADES CRÍTICAS ==="
        if [ -f "$REPORT_DIR/image-critical.json" ]; then
            echo "Imagen Docker:"
            jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity=="CRITICAL") | "  - \(.VulnerabilityID): \(.PkgName) (\(.InstalledVersion))"' "$REPORT_DIR/image-critical.json" 2>/dev/null || echo "  Ninguna vulnerabilidad crítica"
        fi
        
        echo ""
        echo "=== DEPENDENCIAS BMW CRÍTICAS ==="
        if [ -f "$REPORT_DIR/bmw-critical-deps.json" ]; then
            jq -r '.[] | "  - \(.Package): \(.Severity) (\(.ID))"' "$REPORT_DIR/bmw-critical-deps.json" 2>/dev/null || echo "  Dependencias principales seguras"
        fi
        
        echo ""
        echo "=== RECOMENDACIONES INMEDIATAS ==="
        echo "1. Revisar vulnerabilidades críticas en: $REPORT_DIR/image-critical-table.txt"
        echo "2. Actualizar dependencias vulnerables: npm audit fix"
        echo "3. Verificar configuración Docker: cat $REPORT_DIR/docker-config.txt"
        echo "4. Revisar secretos detectados: cat $REPORT_DIR/secrets.txt"
        echo ""
        echo "====================================================================="
        
    } > "$REPORT_DIR/executive-summary.txt"
    
    print_success "Resumen ejecutivo generado"
}

# Mostrar resultados en pantalla
display_results() {
    print_header "RESULTADOS DEL ANÁLISIS"
    
    echo -e "${CYAN}📁 Directorio de reportes:${NC} $REPORT_DIR"
    echo ""
    
    echo -e "${CYAN}📄 Archivos generados:${NC}"
    ls -la "$REPORT_DIR/" | awk '{print "  " $9 " (" $5 " bytes)"}'
    echo ""
    
    # Mostrar resumen en pantalla
    if [ -f "$REPORT_DIR/executive-summary.txt" ]; then
        cat "$REPORT_DIR/executive-summary.txt"
    fi
    
    echo ""
    print_header "COMANDOS ÚTILES PARA REVISAR RESULTADOS"
    echo ""
    echo -e "${YELLOW}📊 Ver resumen completo:${NC}"
    echo "cat $REPORT_DIR/executive-summary.txt"
    echo ""
    echo -e "${YELLOW}🔍 Ver vulnerabilidades críticas:${NC}"
    echo "cat $REPORT_DIR/image-critical-table.txt"
    echo ""
    echo -e "${YELLOW}📦 Ver dependencias vulnerables:${NC}"
    echo "cat $REPORT_DIR/dependencies-table.txt"
    echo ""
    echo -e "${YELLOW}⚙️  Ver problemas de configuración:${NC}"
    echo "cat $REPORT_DIR/config-issues.txt"
    echo ""
    echo -e "${YELLOW}🔐 Ver secretos detectados:${NC}"
    echo "cat $REPORT_DIR/secrets.txt"
    echo ""
    echo -e "${YELLOW}🎯 Ver superficie de ataque:${NC}"
    echo "cat $REPORT_DIR/attack-surface.txt"
    echo ""
    echo -e "${YELLOW}📋 Análisis JSON detallado:${NC}"
    echo "jq '.' $REPORT_DIR/image-full.json"
}

# Función principal
main() {
    print_header "TRIVY SECURITY ANALYSIS - BMW SERVICE MANAGER"
    echo -e "${CYAN}Iniciando análisis completo de seguridad...${NC}"
    echo ""
    
    check_dependencies
    setup_environment
    update_db
    check_image
    analyze_docker_image
    analyze_filesystem
    analyze_nodejs_deps
    analyze_bmw_specific
    generate_summary
    display_results
    
    echo ""
    print_success "✅ ANÁLISIS COMPLETO TERMINADO EXITOSAMENTE"
    echo -e "${GREEN}Revisa los archivos en el directorio: $REPORT_DIR${NC}"
}

# Manejo de errores
trap 'print_error "Script interrumpido"; exit 1' INT TERM

# Ejecutar función principal
main "$@"