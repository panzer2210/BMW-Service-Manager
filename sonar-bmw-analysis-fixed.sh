#!/bin/bash
# sonar-bmw-analysis-fixed.sh
# Script corregido de análisis SonarQube para BMW Service Manager
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
REPORT_DIR="sonar-reports-$TIMESTAMP"
PROJECT_PATH="/home/kali/Proyecto-final"
SONAR_HOST="http://localhost:9000"
SONAR_PROJECT_KEY="bmw-service-manager"
SONAR_PROJECT_NAME="BMW Service Manager"
SONAR_TOKEN=""
SONAR_CONTAINER_NAME="sonarqube-bmw-fixed"

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
    
    # Verificar Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker no está instalado"
        exit 1
    else
        print_success "Docker encontrado: $(docker --version)"
    fi
    
    # Verificar Node.js y npm
    if ! command -v node &> /dev/null; then
        print_error "Node.js no está instalado"
        exit 1
    else
        print_success "Node.js encontrado: $(node --version)"
    fi
    
    # Verificar jq
    if ! command -v jq &> /dev/null; then
        print_warning "jq no encontrado, instalando..."
        sudo apt-get update && sudo apt-get install -y jq
    fi
}

# Verificar si SonarScanner ya está instalado
check_sonar_scanner() {
    print_step "Verificando SonarScanner..."
    
    if command -v sonar-scanner &> /dev/null; then
        print_success "SonarScanner encontrado: $(sonar-scanner --version | head -1)"
        return 0
    fi
    
    # Verificar instalación en /opt
    if [ -f "/opt/sonar-scanner/bin/sonar-scanner" ]; then
        print_success "SonarScanner encontrado en /opt/sonar-scanner"
        export PATH="/opt/sonar-scanner/bin:$PATH"
        return 0
    fi
    
    print_warning "SonarScanner no encontrado"
    return 1
}

# Configurar entorno
setup_environment() {
    print_step "Configurando entorno de análisis..."
    
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
}

# Iniciar SonarQube server con imagen correcta
start_sonarqube() {
    print_step "Iniciando SonarQube server..."
    
    # Limpiar contenedores existentes
    docker stop sonarqube-bmw sonarqube-bmw-fixed 2>/dev/null || true
    docker rm sonarqube-bmw sonarqube-bmw-fixed 2>/dev/null || true
    
    # Verificar si ya está corriendo en puerto 9000
    if netstat -tuln 2>/dev/null | grep -q ":9000 "; then
        print_warning "Puerto 9000 ya está en uso, intentando conectar..."
        if curl -s "$SONAR_HOST/api/system/status" | grep -q '"status":"UP"'; then
            print_success "SonarQube ya está corriendo y disponible"
            return 0
        else
            print_error "Puerto 9000 ocupado pero SonarQube no responde"
            return 1
        fi
    fi
    
    # Configurar límites del sistema para SonarQube
    print_step "Configurando límites del sistema..."
    sudo sysctl -w vm.max_map_count=524288 2>/dev/null || true
    sudo sysctl -w fs.file-max=131072 2>/dev/null || true
    
    # Probar diferentes tags de imagen
    SONAR_IMAGES=("sonarqube:lts-community" "sonarqube:community" "sonarqube:latest" "sonarqube:lts")
    
    for image in "${SONAR_IMAGES[@]}"; do
        print_step "Intentando iniciar con imagen: $image"
        
        if docker run -d \
            --name "$SONAR_CONTAINER_NAME" \
            -p 9000:9000 \
            -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true \
            "$image" 2>/dev/null; then
            
            print_success "SonarQube iniciado con imagen: $image"
            break
        else
            print_warning "Falló imagen $image, probando siguiente..."
            docker rm "$SONAR_CONTAINER_NAME" 2>/dev/null || true
        fi
    done
    
    # Verificar que el contenedor esté corriendo
    if ! docker ps | grep -q "$SONAR_CONTAINER_NAME"; then
        print_error "No se pudo iniciar SonarQube con ninguna imagen"
        return 1
    fi
    
    print_step "Esperando que SonarQube inicie (esto puede tomar 3-5 minutos)..."
    
    # Esperar que SonarQube esté listo
    local max_attempts=60
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$SONAR_HOST/api/system/status" 2>/dev/null | grep -q '"status":"UP"'; then
            print_success "SonarQube está listo y funcionando"
            break
        fi
        
        # Verificar si el contenedor sigue corriendo
        if ! docker ps | grep -q "$SONAR_CONTAINER_NAME"; then
            print_error "El contenedor SonarQube se detuvo inesperadamente"
            docker logs "$SONAR_CONTAINER_NAME" | tail -20
            return 1
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            print_error "SonarQube no inició correctamente después de 5 minutos"
            echo "Logs del contenedor:"
            docker logs "$SONAR_CONTAINER_NAME" | tail -30
            return 1
        fi
        
        echo -n "."
        sleep 5
        ((attempt++))
    done
    
    echo ""
    print_success "SonarQube iniciado correctamente en $SONAR_HOST"
    print_warning "Credenciales por defecto: admin/admin"
}

# Configurar proyecto en SonarQube
setup_sonar_project() {
    print_step "Configurando proyecto en SonarQube..."
    
    # Esperar un poco más para asegurar que la API esté lista
    sleep 15
    
    # Verificar conectividad a la API
    if ! curl -s "$SONAR_HOST/api/system/status" >/dev/null 2>&1; then
        print_error "No se puede conectar a la API de SonarQube"
        return 1
    fi
    
    print_step "Creando proyecto BMW Service Manager..."
    
    # Crear proyecto usando API (puede fallar si ya existe)
    curl -s -u admin:admin -X POST \
        "$SONAR_HOST/api/projects/create" \
        -d "name=$SONAR_PROJECT_NAME" \
        -d "project=$SONAR_PROJECT_KEY" \
        > /dev/null 2>&1 && print_success "Proyecto creado" || print_warning "Proyecto puede que ya exista"
    
    # Generar token para el proyecto
    print_step "Generando token de acceso..."
    
    # Eliminar token anterior si existe
    curl -s -u admin:admin -X POST \
        "$SONAR_HOST/api/user_tokens/revoke" \
        -d "name=bmw-analysis-token" > /dev/null 2>&1 || true
    
    # Generar nuevo token
    TOKEN_RESPONSE=$(curl -s -u admin:admin -X POST \
        "$SONAR_HOST/api/user_tokens/generate" \
        -d "name=bmw-analysis-token")
    
    if echo "$TOKEN_RESPONSE" | grep -q "token"; then
        SONAR_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token')
        print_success "Token generado correctamente"
        echo "$SONAR_TOKEN" > "$REPORT_DIR/sonar-token.txt"
    else
        print_warning "No se pudo generar token, usando credenciales básicas"
        SONAR_TOKEN="admin:admin"
    fi
}

# Crear archivo de configuración sonar-project.properties
create_sonar_config() {
    print_step "Creando configuración de SonarQube..."
    
    cat > sonar-project.properties << EOF
# Configuración del proyecto BMW Service Manager
sonar.projectKey=$SONAR_PROJECT_KEY
sonar.projectName=$SONAR_PROJECT_NAME
sonar.projectVersion=1.0.0

# Información del proyecto
sonar.projectDescription=Sistema de gestión de servicios BMW - Análisis de seguridad

# Configuración de archivos fuente
sonar.sources=.
sonar.sourceEncoding=UTF-8

# Exclusiones importantes
sonar.exclusions=node_modules/**,*.log,*.md,*.pdf,*.zip,*.tar.gz,sonar-reports-*/**,trivy-reports-*/**,.git/**,coverage/**,dist/**,build/**

# Configuración de lenguajes
sonar.javascript.file.suffixes=.js,.jsx
sonar.css.file.suffixes=.css
sonar.html.file.suffixes=.html,.htm

# Configuración del servidor
sonar.host.url=$SONAR_HOST
sonar.login=$SONAR_TOKEN

# Configuración de análisis
sonar.scm.disabled=true

# Configuración de calidad
sonar.qualitygate.wait=false
sonar.qualitygate.timeout=300

# Configuración específica JavaScript
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.javascript.exclusions=node_modules/**,*.min.js

# Configuración de seguridad
sonar.security.hotspots.inheritFromParent=true

# Debug
sonar.verbose=false
EOF
    
    print_success "Archivo sonar-project.properties creado"
}

# Ejecutar análisis con SonarScanner
run_sonar_analysis() {
    print_step "Ejecutando análisis de SonarScanner..."
    
    # Crear directorio de logs
    mkdir -p "$REPORT_DIR/logs"
    
    # Verificar que SonarScanner esté disponible
    if ! check_sonar_scanner; then
        print_error "SonarScanner no está disponible"
        return 1
    fi
    
    # Ejecutar SonarScanner con logging
    print_step "Iniciando escaneo del código fuente..."
    
    if sonar-scanner > "$REPORT_DIR/logs/sonar-scanner.log" 2>&1; then
        print_success "Análisis de SonarScanner completado exitosamente"
    else
        EXIT_CODE=$?
        print_warning "Análisis completado con código de salida: $EXIT_CODE"
        echo "Últimas líneas del log:"
        tail -20 "$REPORT_DIR/logs/sonar-scanner.log"
        
        # Si el código de salida es 0 o pequeño, continuar
        if [ $EXIT_CODE -le 2 ]; then
            print_success "Continuando con la generación de reportes..."
        else
            print_error "Error grave en el análisis"
            return 1
        fi
    fi
}

# Obtener métricas del proyecto
get_project_metrics() {
    print_step "Obteniendo métricas del proyecto..."
    
    # Esperar que el análisis se procese
    sleep 30
    
    # Obtener métricas principales
    METRICS="ncloc,bugs,vulnerabilities,code_smells,coverage,duplicated_lines_density,reliability_rating,security_rating,sqale_rating"
    
    # Hacer petición a la API de métricas
    METRICS_RESPONSE=$(curl -s -u admin:admin \
        "$SONAR_HOST/api/measures/component?component=$SONAR_PROJECT_KEY&metricKeys=$METRICS")
    
    if echo "$METRICS_RESPONSE" | grep -q "measures"; then
        echo "$METRICS_RESPONSE" > "$REPORT_DIR/metrics.json"
        print_success "Métricas obtenidas correctamente"
        
        # Mostrar métricas principales en pantalla
        echo ""
        echo -e "${CYAN}📊 MÉTRICAS PRINCIPALES:${NC}"
        jq -r '.component.measures[] | "\(.metric): \(.value)"' "$REPORT_DIR/metrics.json" 2>/dev/null | while IFS=': ' read metric value; do
            case $metric in
                "ncloc") echo "📏 Líneas de código: $value" ;;
                "bugs") echo "🐛 Bugs: $value" ;;
                "vulnerabilities") echo "🔒 Vulnerabilidades: $value" ;;
                "code_smells") echo "🧹 Code Smells: $value" ;;
                "security_rating") echo "🛡️  Security Rating: $value" ;;
                "reliability_rating") echo "⚡ Reliability Rating: $value" ;;
                "sqale_rating") echo "🔧 Maintainability Rating: $value" ;;
            esac
        done
        echo ""
    else
        print_warning "No se pudieron obtener métricas completas"
        echo "$METRICS_RESPONSE" > "$REPORT_DIR/metrics-error.json"
        
        # Intentar obtener información básica del proyecto
        curl -s -u admin:admin \
            "$SONAR_HOST/api/projects/search?projects=$SONAR_PROJECT_KEY" \
            > "$REPORT_DIR/project-info.json"
    fi
}

# Obtener issues del proyecto
get_project_issues() {
    print_step "Obteniendo issues del proyecto..."
    
    # Obtener todos los issues
    curl -s -u admin:admin \
        "$SONAR_HOST/api/issues/search?componentKeys=$SONAR_PROJECT_KEY&ps=500" \
        > "$REPORT_DIR/all-issues.json"
    
    # Verificar si se obtuvieron issues
    if jq -e '.total' "$REPORT_DIR/all-issues.json" >/dev/null 2>&1; then
        TOTAL_ISSUES=$(jq '.total' "$REPORT_DIR/all-issues.json")
        print_success "Se encontraron $TOTAL_ISSUES issues"
        
        # Obtener issues por tipo
        curl -s -u admin:admin \
            "$SONAR_HOST/api/issues/search?componentKeys=$SONAR_PROJECT_KEY&types=VULNERABILITY&ps=100" \
            > "$REPORT_DIR/vulnerabilities.json"
        
        curl -s -u admin:admin \
            "$SONAR_HOST/api/issues/search?componentKeys=$SONAR_PROJECT_KEY&types=BUG&ps=100" \
            > "$REPORT_DIR/bugs.json"
        
        curl -s -u admin:admin \
            "$SONAR_HOST/api/issues/search?componentKeys=$SONAR_PROJECT_KEY&types=CODE_SMELL&ps=100" \
            > "$REPORT_DIR/code-smells.json"
        
        # Obtener security hotspots
        curl -s -u admin:admin \
            "$SONAR_HOST/api/hotspots/search?projectKey=$SONAR_PROJECT_KEY&ps=100" \
            > "$REPORT_DIR/security-hotspots.json"
        
        print_success "Issues detallados obtenidos por categoría"
    else
        print_warning "No se pudieron obtener issues o el proyecto aún no tiene datos"
    fi
}

# Generar resumen ejecutivo
generate_executive_summary() {
    print_step "Generando resumen ejecutivo..."
    
    {
        echo "====================================================================="
        echo "           RESUMEN EJECUTIVO SONARQUBE - BMW SERVICE MANAGER"
        echo "====================================================================="
        echo "Fecha de análisis: $(date)"
        echo "Proyecto: $SONAR_PROJECT_NAME"
        echo "Clave del proyecto: $SONAR_PROJECT_KEY"
        echo "URL del dashboard: $SONAR_HOST/dashboard?id=$SONAR_PROJECT_KEY"
        echo ""
        
        if [ -f "$REPORT_DIR/metrics.json" ]; then
            echo "=== MÉTRICAS PRINCIPALES ==="
            
            # Extraer métricas principales con manejo de errores
            NCLOC=$(jq -r '.component.measures[]? | select(.metric=="ncloc") | .value' "$REPORT_DIR/metrics.json" 2>/dev/null || echo "N/A")
            BUGS=$(jq -r '.component.measures[]? | select(.metric=="bugs") | .value' "$REPORT_DIR/metrics.json" 2>/dev/null || echo "0")
            VULNERABILITIES=$(jq -r '.component.measures[]? | select(.metric=="vulnerabilities") | .value' "$REPORT_DIR/metrics.json" 2>/dev/null || echo "0")
            CODE_SMELLS=$(jq -r '.component.measures[]? | select(.metric=="code_smells") | .value' "$REPORT_DIR/metrics.json" 2>/dev/null || echo "0")
            SECURITY_RATING=$(jq -r '.component.measures[]? | select(.metric=="security_rating") | .value' "$REPORT_DIR/metrics.json" 2>/dev/null || echo "N/A")
            RELIABILITY_RATING=$(jq -r '.component.measures[]? | select(.metric=="reliability_rating") | .value' "$REPORT_DIR/metrics.json" 2>/dev/null || echo "N/A")
            MAINTAINABILITY_RATING=$(jq -r '.component.measures[]? | select(.metric=="sqale_rating") | .value' "$REPORT_DIR/metrics.json" 2>/dev/null || echo "N/A")
            
            echo "📏 Líneas de código: $NCLOC"
            echo "🐛 Bugs: $BUGS"
            echo "🔒 Vulnerabilidades de seguridad: $VULNERABILITIES"
            echo "🧹 Code Smells: $CODE_SMELLS"
            echo "🛡️  Security Rating: $SECURITY_RATING (A=1, B=2, C=3, D=4, E=5)"
            echo "⚡ Reliability Rating: $RELIABILITY_RATING"
            echo "🔧 Maintainability Rating: $MAINTAINABILITY_RATING"
        else
            echo "=== MÉTRICAS NO DISPONIBLES ==="
            echo "⚠️  No se pudieron obtener métricas del servidor"
            if [ -f "$REPORT_DIR/project-info.json" ]; then
                echo "Información del proyecto disponible en: project-info.json"
            fi
        fi
        
        echo ""
        echo "=== RESUMEN DE ISSUES ==="
        if [ -f "$REPORT_DIR/all-issues.json" ] && jq -e '.total' "$REPORT_DIR/all-issues.json" >/dev/null 2>&1; then
            TOTAL_ISSUES=$(jq '.total' "$REPORT_DIR/all-issues.json" 2>/dev/null || echo "0")
            echo "Total de issues encontrados: $TOTAL_ISSUES"
            
            if [ "$TOTAL_ISSUES" != "0" ] && [ "$TOTAL_ISSUES" != "null" ]; then
                echo ""
                echo "Distribución por severidad:"
                jq -r '.issues[]? | .severity' "$REPORT_DIR/all-issues.json" 2>/dev/null | sort | uniq -c | while read count severity; do
                    echo "  $severity: $count issues"
                done
                
                echo ""
                echo "Distribución por tipo:"
                jq -r '.issues[]? | .type' "$REPORT_DIR/all-issues.json" 2>/dev/null | sort | uniq -c | while read count type; do
                    case $type in
                        "BUG") echo "  🐛 Bugs: $count" ;;
                        "VULNERABILITY") echo "  🔒 Vulnerabilidades: $count" ;;
                        "CODE_SMELL") echo "  🧹 Code Smells: $count" ;;
                        *) echo "  $type: $count" ;;
                    esac
                done
            fi
        else
            echo "⚠️  No se encontraron issues o están en proceso"
        fi
        
        echo ""
        echo "=== RECOMENDACIONES INMEDIATAS ==="
        echo "1. 🌐 Revisar dashboard completo: $SONAR_HOST/dashboard?id=$SONAR_PROJECT_KEY"
        echo "2. 🔍 Verificar issues críticos en la interfaz web"
        echo "3. 📊 Analizar métricas de calidad y tendencias"
        echo "4. 🔒 Revisar vulnerabilidades de seguridad detectadas"
        echo "5. 📋 Planificar corrección de bugs y code smells"
        echo ""
        echo "=== ARCHIVOS DE REPORTE GENERADOS ==="
        ls -la "$REPORT_DIR/" | grep -v "^d" | awk '{print "  📄 " $9 " (" $5 " bytes)"}'
        echo ""
        echo "=== INFORMACIÓN DE ACCESO ==="
        echo "🌐 URL: $SONAR_HOST"
        echo "👤 Usuario: admin"
        echo "🔑 Contraseña: admin"
        echo "📂 Proyecto: $SONAR_PROJECT_KEY"
        echo ""
        echo "====================================================================="
        
    } > "$REPORT_DIR/executive-summary.txt"
    
    print_success "Resumen ejecutivo generado"
}

# Mostrar resultados
display_results() {
    print_header "RESULTADOS DEL ANÁLISIS SONARQUBE"
    
    echo -e "${CYAN}📁 Directorio de reportes:${NC} $REPORT_DIR"
    echo -e "${CYAN}🌐 Dashboard SonarQube:${NC} $SONAR_HOST/dashboard?id=$SONAR_PROJECT_KEY"
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
    echo -e "${YELLOW}🔍 Ver métricas detalladas:${NC}"
    echo "jq '.' $REPORT_DIR/metrics.json"
    echo ""
    echo -e "${YELLOW}🐛 Ver bugs:${NC}"
    echo "jq '.issues[]? | {message: .message, severity: .severity, file: .component}' $REPORT_DIR/bugs.json"
    echo ""
    echo -e "${YELLOW}🔒 Ver vulnerabilidades:${NC}"
    echo "jq '.issues[]? | {message: .message, severity: .severity, file: .component}' $REPORT_DIR/vulnerabilities.json"
    echo ""
    echo -e "${YELLOW}🌐 Abrir en navegador:${NC}"
    echo "firefox $SONAR_HOST/dashboard?id=$SONAR_PROJECT_KEY &"
}

# Cleanup opcional
cleanup() {
    echo ""
    print_step "¿Quieres parar el servidor SonarQube? (y/N)"
    read -t 10 -r response || response="n"
    if [[ "$response" =~ ^[Yy]$ ]]; then
        print_step "Parando SonarQube..."
        docker stop "$SONAR_CONTAINER_NAME" 2>/dev/null || true
        docker rm "$SONAR_CONTAINER_NAME" 2>/dev/null || true
        print_success "SonarQube parado"
    else
        print_success "SonarQube sigue corriendo en $SONAR_HOST"
        echo -e "${CYAN}Para pararlo manualmente: docker stop $SONAR_CONTAINER_NAME${NC}"
    fi
}

# Función principal
main() {
    print_header "SONARQUBE ANALYSIS - BMW SERVICE MANAGER (CORREGIDO)"
    echo -e "${CYAN}Iniciando análisis completo de código estático...${NC}"
    echo ""
    
    check_dependencies
    setup_environment
    start_sonarqube
    setup_sonar_project
    create_sonar_config
    run_sonar_analysis
    get_project_metrics
    get_project_issues
    generate_executive_summary
    display_results
    cleanup
    
    echo ""
    print_success "✅ ANÁLISIS SONARQUBE COMPLETO TERMINADO"
    echo -e "${GREEN}🌐 Dashboard: $SONAR_HOST/dashboard?id=$SONAR_PROJECT_KEY${NC}"
    echo -e "${GREEN}📁 Reportes: $REPORT_DIR${NC}"
}

# Manejo de errores y señales
trap 'print_error "Script interrumpido"; docker stop $SONAR_CONTAINER_NAME 2>/dev/null || true; exit 1' INT TERM

# Ejecutar función principal
main "$@"